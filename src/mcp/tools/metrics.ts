import { z } from 'zod';
import { SCOPES } from '@/lib/auth/scopes';
import { isValidTimezone, localDateOf } from '@/lib/dates';
import {
  getUserTimezone,
  latestPerType,
  listMetrics,
  listMetricSeries,
  upsertMetrics,
} from '@/lib/repos/body-metric';
import { decodeCursor, encodeCursor } from '../pagination';
import { METRIC_RANGES, zCursor, zDate, zDateTime, zLimit, zMetricType } from '../schemas/common';
import { ToolError, type AnyToolDef } from '../types';

// Body metric time series: one value per (metricType, local day).
// Kolo stores measurements verbatim — trends/targets are the calling agent's job.

const zMetricTypeDescribed = zMetricType.describe(
  'Metric type; the unit is fixed by the type: weight=kg, body_fat_pct=%, ' +
    'waist/hip/chest/arm/thigh=cm, muscle_mass_kg=kg, visceral_fat=device level',
);

const zMetricEntry = z.object({
  metric_type: zMetricTypeDescribed,
  value: z.number(),
  measured_at: zDateTime.optional().describe('When measured; omitted = now'),
  source: z.enum(['manual', 'smart_scale', 'agent']).default('agent'),
  note: z.string().max(200).optional(),
});

// DB rows may also carry source 'import' (ETL), so output is the wider enum.
const zMetricSourceOut = z.enum(['manual', 'smart_scale', 'agent', 'import']);

/** YYYY-MM-DD of a @db.Date column (stored as UTC midnight). */
function dateOnly(value: Date): string {
  return localDateOf(value, 'UTC');
}

export const metricTools: AnyToolDef[] = [
  {
    name: 'log_body_metrics',
    title: 'Log body metrics',
    description:
      'Record body measurements (weight, body fat %, circumferences, muscle mass, visceral fat) ' +
      'for the current user. Call whenever the user reports one or more new measurements. ' +
      'Only one value per metric type per local day: logging the same type again for the same ' +
      'day overwrites the earlier entry (replaced=true in the result).',
    inputSchema: {
      entries: z.array(zMetricEntry).min(1).max(20),
    },
    outputSchema: {
      saved: z.array(
        z.object({
          metric_id: z.string(),
          metric_type: zMetricType,
          value: z.number(),
          measured_at: z.string(),
          measured_date: zDate,
          replaced: z.boolean().describe('true when a same-day entry of this type was overwritten'),
        }),
      ),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    requiredScopes: [SCOPES.PROFILE],
    handler: async (rawInput, ctx) => {
      // zod .default() makes parsed keys required, which clashes with the
      // contravariant ToolDef<any> handler signature — assert the real shape.
      const input = rawInput as { entries: z.infer<typeof zMetricEntry>[] };
      for (const [i, entry] of input.entries.entries()) {
        const [min, max] = METRIC_RANGES[entry.metric_type];
        if (entry.value < min || entry.value > max) {
          throw new ToolError(
            'VALIDATION',
            `entries[${i}].value ${entry.value} is out of range for ${entry.metric_type} (allowed ${min}-${max})`,
            { index: i, field: 'value', metric_type: entry.metric_type, min, max },
          );
        }
      }

      const profileTz = await getUserTimezone(ctx.userId);
      const timezone = profileTz && isValidTimezone(profileTz) ? profileTz : 'UTC';

      const entries = input.entries.map((entry) => {
        const measuredAt = entry.measured_at ? new Date(entry.measured_at) : new Date();
        return {
          metricType: entry.metric_type,
          value: entry.value,
          measuredAt,
          measuredDate: localDateOf(measuredAt, timezone),
          timezone,
          source: entry.source,
          note: entry.note,
        };
      });

      const results = await upsertMetrics(ctx.userId, entries);
      return {
        saved: results.map(({ record, replaced }, i) => ({
          metric_id: record.id,
          metric_type: record.metricType,
          value: record.value,
          measured_at: record.measuredAt,
          measured_date: entries[i].measuredDate,
          replaced,
        })),
      };
    },
  },
  {
    name: 'list_body_metrics',
    title: 'List body metrics',
    description:
      'Read the body measurement history of the current user (weight, body fat %, ' +
      'circumferences, ...), newest first. Call when the user asks about past measurements or ' +
      'when an agent needs raw data points for its own trend/progress calculations. ' +
      'Set latest_only=true to get just the most recent entry per metric type ' +
      '(from/to and pagination are ignored in that mode).',
    inputSchema: {
      metric_types: z
        .array(zMetricTypeDescribed)
        .min(1)
        .max(9)
        .optional()
        .describe('Filter to these types; omitted = all'),
      from: zDate.optional().describe('Inclusive lower bound on measured_date'),
      to: zDate.optional().describe('Inclusive upper bound on measured_date'),
      latest_only: z
        .boolean()
        .default(false)
        .describe('true = one latest entry per metric type, ignoring from/to and pagination'),
      limit: zLimit,
      cursor: zCursor.optional(),
    },
    outputSchema: {
      items: z.array(
        z.object({
          metric_id: z.string(),
          metric_type: zMetricType,
          value: z.number(),
          measured_at: z.string(),
          measured_date: zDate,
          source: zMetricSourceOut,
          note: z.string().nullable(),
        }),
      ),
      next_cursor: z.string().optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    requiredScopes: [SCOPES.PROFILE],
    handler: async (input, ctx) => {
      const toItem = (row: {
        id: string;
        metricType: string;
        value: unknown;
        measuredAt: Date;
        measuredDate: Date;
        source: string;
        note: string | null;
      }) => ({
        metric_id: row.id,
        metric_type: row.metricType,
        value: row.value,
        measured_at: row.measuredAt,
        measured_date: dateOnly(row.measuredDate),
        source: row.source,
        note: row.note,
      });

      if (input.latest_only) {
        const rows = await latestPerType(ctx.userId);
        const filtered = input.metric_types
          ? rows.filter((r) => (input.metric_types as string[]).includes(r.metricType))
          : rows;
        return { items: filtered.map(toItem) };
      }

      if (input.from && input.to && input.from > input.to) {
        throw new ToolError('VALIDATION', 'from must be on or before to');
      }

      let cursorKey: { measuredAt: Date; id: string } | undefined;
      if (input.cursor) {
        const key = decodeCursor(input.cursor);
        const [at, id] = key;
        if (
          key.length !== 2 ||
          typeof at !== 'string' ||
          typeof id !== 'string' ||
          Number.isNaN(Date.parse(at))
        ) {
          throw new ToolError('VALIDATION', 'invalid cursor');
        }
        cursorKey = { measuredAt: new Date(at), id };
      }

      const rows = await listMetrics(ctx.userId, {
        metricTypes: input.metric_types,
        from: input.from,
        to: input.to,
        limit: input.limit,
        cursorKey,
      });

      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      const last = page[page.length - 1];
      return {
        items: page.map(toItem),
        ...(hasMore ? { next_cursor: encodeCursor([last.measuredAt.toISOString(), last.id]) } : {}),
      };
    },
  },
  {
    name: 'get_body_metric_trend',
    title: 'Get body metric trend data',
    description:
      'Fetch the change history of one body metric (weight, body fat %, …) over a date ' +
      'range: the raw daily series plus per-bucket aggregates (avg/min/max/first/last/count ' +
      'by day, ISO week or calendar month). Call when the user asks how their weight or ' +
      'another measurement has been developing. Returns raw numbers only — trend ' +
      'interpretation, plateaus and goal progress are the calling agent\'s job.',
    inputSchema: {
      metric_type: zMetricTypeDescribed,
      from: zDate,
      to: zDate,
      bucket: z
        .enum(['day', 'week', 'month'])
        .default('week')
        .describe('Aggregation window; weeks start Monday (ISO)'),
    },
    outputSchema: {
      metric_type: zMetricType,
      from: zDate,
      to: zDate,
      bucket: z.enum(['day', 'week', 'month']),
      points: z.array(
        z.object({
          date: zDate,
          value: z.number(),
          measured_at: z.string(),
          source: zMetricSourceOut,
        }),
      ),
      buckets: z.array(
        z.object({
          start: zDate,
          end: zDate.describe('Inclusive; clamped to the requested range'),
          avg: z.number(),
          min: z.number(),
          max: z.number(),
          first: z.number().describe('Earliest value in the bucket'),
          last: z.number().describe('Latest value in the bucket'),
          count: z.number().int(),
        }),
      ),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    requiredScopes: [SCOPES.PROFILE],
    handler: async (rawInput, ctx) => {
      const input = rawInput as {
        metric_type: z.infer<typeof zMetricType>;
        from: string;
        to: string;
        bucket: 'day' | 'week' | 'month';
      };
      if (input.from > input.to) {
        throw new ToolError('VALIDATION', 'from must be on or before to');
      }
      const days =
        (Date.parse(`${input.to}T00:00:00Z`) - Date.parse(`${input.from}T00:00:00Z`)) / 86_400_000 +
        1;
      if (days > 366) {
        throw new ToolError('LIMIT_EXCEEDED', `date range covers ${days} days; the maximum is 366`);
      }

      const rows = await listMetricSeries(ctx.userId, input.metric_type, input.from, input.to);
      const points = rows.map((row) => ({
        date: dateOnly(row.measuredDate),
        value: Number(row.value),
        measured_at: row.measuredAt,
        source: row.source,
      }));

      const buckets: {
        start: string;
        end: string;
        values: number[];
      }[] = [];
      for (const point of points) {
        const start = bucketStart(point.date, input.bucket);
        const current = buckets[buckets.length - 1];
        if (current && current.start === start) {
          current.values.push(point.value);
        } else {
          buckets.push({ start, end: bucketEnd(start, input.bucket, input.to), values: [point.value] });
        }
      }

      return {
        metric_type: input.metric_type,
        from: input.from,
        to: input.to,
        bucket: input.bucket,
        points,
        buckets: buckets.map(({ start, end, values }) => ({
          start,
          end,
          avg: Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100,
          min: Math.min(...values),
          max: Math.max(...values),
          first: values[0],
          last: values[values.length - 1],
          count: values.length,
        })),
      };
    },
  },
];

/** First calendar date of the bucket containing `date` (dates are UTC-midnight). */
function bucketStart(date: string, bucket: 'day' | 'week' | 'month'): string {
  if (bucket === 'day') return date;
  if (bucket === 'month') return `${date.slice(0, 7)}-01`;
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // back to Monday
  return d.toISOString().slice(0, 10);
}

/** Inclusive last date of the bucket, clamped to the requested `to`. */
function bucketEnd(start: string, bucket: 'day' | 'week' | 'month', to: string): string {
  if (bucket === 'day') return start;
  const d = new Date(`${start}T00:00:00.000Z`);
  if (bucket === 'week') {
    d.setUTCDate(d.getUTCDate() + 6);
  } else {
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0); // last day of the start month
  }
  const end = d.toISOString().slice(0, 10);
  return end < to ? end : to;
}
