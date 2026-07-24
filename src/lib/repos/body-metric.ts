import { prisma } from '@/lib/db';
import { dateColumn } from '@/lib/dates';
import type { BodyMetric, MetricSource, Prisma } from '@/generated/prisma/client';

// Pure data access for the body_metric time series. No auth, no MCP shapes:
// callers pass camelCase fields and get Prisma rows back.

export interface MetricEntryInput {
  metricType: string;
  value: number;
  measuredAt: Date;
  /** Local calendar date, YYYY-MM-DD (already derived from measuredAt + timezone). */
  measuredDate: string;
  /** IANA zone measuredDate was derived with — persisted for auditability. */
  timezone: string;
  source: MetricSource;
  note?: string;
}

export interface UpsertMetricResult {
  record: BodyMetric;
  /** true when an existing (userId, metricType, measuredDate) row was overwritten. */
  replaced: boolean;
}

/** Reads the user's profile timezone (used to derive measuredDate); null when unset. */
export async function getUserTimezone(userId: string): Promise<string | null> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return profile?.timezone ?? null;
}

/**
 * Upserts metric entries keyed on (userId, metricType, measuredDate).
 * One measurement per type per local day: a same-day re-log replaces the row.
 */
export async function upsertMetrics(
  userId: string,
  entries: MetricEntryInput[],
): Promise<UpsertMetricResult[]> {
  return prisma.$transaction(async (tx) => {
    const results: UpsertMetricResult[] = [];
    for (const entry of entries) {
      const where = {
        userId_metricType_measuredDate: {
          userId,
          metricType: entry.metricType,
          measuredDate: dateColumn(entry.measuredDate),
        },
      };
      const existing = await tx.bodyMetric.findUnique({ where, select: { id: true } });
      const data = {
        value: entry.value,
        measuredAt: entry.measuredAt,
        timezone: entry.timezone,
        source: entry.source,
        note: entry.note ?? null,
      };
      const record = existing
        ? await tx.bodyMetric.update({ where, data })
        : await tx.bodyMetric.create({
            data: {
              userId,
              metricType: entry.metricType,
              measuredDate: dateColumn(entry.measuredDate),
              ...data,
            },
          });
      results.push({ record, replaced: existing !== null });
    }
    return results;
  });
}

export interface ListMetricsOptions {
  metricTypes?: string[];
  /** Inclusive measuredDate lower bound, YYYY-MM-DD. */
  from?: string;
  /** Inclusive measuredDate upper bound, YYYY-MM-DD. */
  to?: string;
  limit: number;
  /** Keyset position: rows strictly after this (measuredAt DESC, id DESC) key. */
  cursorKey?: { measuredAt: Date; id: string };
}

/**
 * Lists metrics ordered by (measuredAt DESC, id DESC).
 * Returns up to limit + 1 rows so the caller can detect another page.
 */
export async function listMetrics(
  userId: string,
  { metricTypes, from, to, limit, cursorKey }: ListMetricsOptions,
): Promise<BodyMetric[]> {
  const where: Prisma.BodyMetricWhereInput = {
    userId,
    ...(metricTypes ? { metricType: { in: metricTypes } } : {}),
    ...(from || to
      ? {
          measuredDate: {
            ...(from ? { gte: dateColumn(from) } : {}),
            ...(to ? { lte: dateColumn(to) } : {}),
          },
        }
      : {}),
    ...(cursorKey
      ? {
          OR: [
            { measuredAt: { lt: cursorKey.measuredAt } },
            { measuredAt: cursorKey.measuredAt, id: { lt: cursorKey.id } },
          ],
        }
      : {}),
  };
  return prisma.bodyMetric.findMany({
    where,
    orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
}

/** Latest row per metricType (exported for get_overview as well). */
export async function latestPerType(userId: string): Promise<BodyMetric[]> {
  const groups = await prisma.bodyMetric.groupBy({
    by: ['metricType'],
    where: { userId },
    _max: { measuredAt: true },
  });
  if (groups.length === 0) return [];
  const rows = await prisma.bodyMetric.findMany({
    where: {
      userId,
      OR: groups.map((g) => ({
        metricType: g.metricType,
        // _max is non-null: every group has at least one row.
        measuredAt: g._max.measuredAt!,
      })),
    },
    orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],
  });
  // measuredAt ties across dates are possible in theory; keep the first
  // (highest id) per type so the result is one row per metricType.
  const seen = new Set<string>();
  const latest: BodyMetric[] = [];
  for (const row of rows) {
    if (!seen.has(row.metricType)) {
      seen.add(row.metricType);
      latest.push(row);
    }
  }
  return latest;
}
