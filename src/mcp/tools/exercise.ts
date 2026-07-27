import { z } from 'zod';
import { SCOPES } from '@/lib/auth/scopes';
import { localDateOf, dateColumn, isValidTimezone } from '@/lib/dates';
import * as exerciseRepo from '@/lib/repos/exercise-log';
import { getProfileTimezone } from '@/lib/repos/diet-log';
import type { ExerciseLog } from '@/generated/prisma/client';
import type { ExerciseLogWriteData, ExerciseLogPatch } from '@/lib/repos/exercise-log';
import { decodeCursor, encodeCursor } from '../pagination';
import { zCursor, zDate, zDateTime, zLimit, zTimezone } from '../schemas/common';
import { ToolError, type AnyToolDef } from '../types';

// Exercise/activity records: the expenditure side of the ledger. The agent
// estimates energy burned (MET math, device readings) — Kolo only stores.

const zExerciseCategory = z.enum([
  'cardio',
  'strength',
  'flexibility',
  'sports',
  'daily_activity',
  'other',
]);
const zExerciseIntensity = z.enum(['low', 'moderate', 'high']);
const zExerciseSource = z.enum(['photo', 'text', 'device', 'manual', 'import']);

const zExerciseEntry = z.object({
  started_at: zDateTime,
  timezone: zTimezone.optional().describe('Falls back to profile.timezone'),
  activity: z.string().min(1).max(100).describe('What was done, e.g. "晨跑", "bench press"'),
  category: zExerciseCategory.optional(),
  intensity: zExerciseIntensity.optional(),
  duration_min: z.number().positive().max(1440).optional(),
  distance_km: z.number().positive().max(1000).optional(),
  energy_kcal: z
    .number()
    .min(0)
    .max(20000)
    .describe('Energy expended for the session, estimated by the calling agent'),
  extra_metrics: z
    .record(z.number())
    .optional()
    .describe('Free-form numeric extras, keys carry units: {"avg_hr_bpm": 152, "steps": 8200}'),
  source: zExerciseSource.default('text'),
  confidence: z.number().min(0).max(1).optional(),
  original_description: z.string().max(2000).optional(),
  note: z.string().max(500).optional(),
});

const exerciseOutput = z.object({
  entry_id: z.string(),
  activity: z.string(),
  category: zExerciseCategory.nullable(),
  intensity: zExerciseIntensity.nullable(),
  duration_min: z.number().nullable(),
  distance_km: z.number().nullable(),
  energy_kcal: z.number(),
  extra_metrics: z.record(z.number()).nullable(),
  started_at: z.string(),
  local_date: zDate,
  timezone: z.string(),
  source: zExerciseSource,
  confidence: z.number().nullable(),
  original_description: z.string().nullable(),
  note: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string(),
});

function toEntry(row: ExerciseLog): Record<string, unknown> {
  return {
    entry_id: row.id,
    activity: row.activity,
    category: row.category,
    intensity: row.intensity,
    duration_min: row.durationMin,
    distance_km: row.distanceKm,
    energy_kcal: row.energyKcal,
    extra_metrics: row.extraMetrics ?? null,
    started_at: row.startedAt,
    local_date: localDateOf(row.localDate, 'UTC'),
    timezone: row.timezone,
    source: row.source,
    confidence: row.confidence,
    original_description: row.originalDescription,
    note: row.note,
    created_by: row.createdBy,
    created_at: row.createdAt,
  };
}

async function resolveTimezones(
  userId: string,
  entries: { timezone?: string }[],
): Promise<string[]> {
  const needsProfile = entries.some((e) => e.timezone === undefined);
  const profileTz = needsProfile ? await getProfileTimezone(userId) : null;
  return entries.map((e, i) => {
    const tz = e.timezone ?? profileTz;
    if (!tz) {
      throw new ToolError(
        'VALIDATION',
        `entries[${i}]: no timezone given and the profile has none — pass timezone or call update_profile first`,
      );
    }
    if (!isValidTimezone(tz)) {
      throw new ToolError('VALIDATION', `entries[${i}]: invalid timezone: ${tz}`);
    }
    return tz;
  });
}

function parseRange(from: string, to: string, maxDays: number): { from: Date; to: Date } {
  if (from > to) throw new ToolError('VALIDATION', 'from must be on or before to');
  const fromDate = dateColumn(from);
  const toDate = dateColumn(to);
  const days = (toDate.getTime() - fromDate.getTime()) / 86_400_000 + 1;
  if (days > maxDays) {
    throw new ToolError('LIMIT_EXCEEDED', `date range covers ${days} days; the maximum is ${maxDays}`);
  }
  return { from: fromDate, to: toDate };
}

export const exerciseTools: AnyToolDef[] = [
  {
    name: 'log_exercise',
    title: 'Log exercise sessions',
    description:
      'Record one or more workouts/activities with the energy the calling agent estimates ' +
      'was burned (from MET tables, device screenshots, user reports — the estimation is ' +
      'yours, Kolo only stores it). Call whenever the user reports training or activity. ' +
      'Together with log_meal this completes the intake-vs-expenditure ledger.',
    inputSchema: {
      entries: z.array(zExerciseEntry).min(1).max(20),
    },
    outputSchema: { entries: z.array(exerciseOutput) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    requiredScopes: [SCOPES.DIARY],
    handler: async (rawInput, ctx) => {
      const input = rawInput as { entries: z.infer<typeof zExerciseEntry>[] };
      const timezones = await resolveTimezones(ctx.userId, input.entries);
      const createdBy = `${ctx.authMethod}:${ctx.clientId}`.slice(0, 120);

      const writeData: ExerciseLogWriteData[] = input.entries.map((e, i) => {
        const startedAt = new Date(e.started_at);
        return {
          activity: e.activity,
          category: e.category ?? null,
          intensity: e.intensity ?? null,
          durationMin: e.duration_min ?? null,
          distanceKm: e.distance_km ?? null,
          energyKcal: e.energy_kcal,
          extraMetrics: e.extra_metrics ?? null,
          startedAt,
          localDate: dateColumn(localDateOf(startedAt, timezones[i])),
          timezone: timezones[i],
          source: e.source,
          confidence: e.confidence ?? null,
          originalDescription: e.original_description ?? null,
          note: e.note ?? null,
          createdBy,
        };
      });

      const rows = await exerciseRepo.createExercises(ctx.userId, writeData);
      return { entries: rows.map(toEntry) };
    },
  },
  {
    name: 'update_exercise_entry',
    title: 'Update an exercise entry',
    description:
      'Modify one previously logged exercise session. Only the provided fields change; ' +
      'pass null to clear a nullable field. Changing started_at or timezone re-derives ' +
      'the local date.',
    inputSchema: {
      entry_id: z.string().min(1).max(64),
      started_at: zDateTime.optional(),
      timezone: zTimezone.optional(),
      activity: z.string().min(1).max(100).optional(),
      category: zExerciseCategory.nullable().optional(),
      intensity: zExerciseIntensity.nullable().optional(),
      duration_min: z.number().positive().max(1440).nullable().optional(),
      distance_km: z.number().positive().max(1000).nullable().optional(),
      energy_kcal: z.number().min(0).max(20000).optional(),
      extra_metrics: z.record(z.number()).nullable().optional(),
      confidence: z.number().min(0).max(1).nullable().optional(),
      note: z.string().max(500).nullable().optional(),
    },
    outputSchema: { entry: exerciseOutput },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    requiredScopes: [SCOPES.DIARY],
    handler: async (rawInput, ctx) => {
      const input = rawInput as {
        entry_id: string;
        started_at?: string;
        timezone?: string;
      } & Record<string, unknown>;

      const patch: ExerciseLogPatch = {};
      if (input.activity !== undefined) patch.activity = input.activity as string;
      if (input.category !== undefined) patch.category = input.category as ExerciseLogPatch['category'];
      if (input.intensity !== undefined) patch.intensity = input.intensity as ExerciseLogPatch['intensity'];
      if (input.duration_min !== undefined) patch.durationMin = input.duration_min as number | null;
      if (input.distance_km !== undefined) patch.distanceKm = input.distance_km as number | null;
      if (input.energy_kcal !== undefined) patch.energyKcal = input.energy_kcal as number;
      if (input.extra_metrics !== undefined)
        patch.extraMetrics = input.extra_metrics as Record<string, number> | null;
      if (input.confidence !== undefined) patch.confidence = input.confidence as number | null;
      if (input.note !== undefined) patch.note = input.note as string | null;

      // Re-derive localDate when the instant or zone moves.
      if (input.started_at !== undefined || input.timezone !== undefined) {
        const existing = await exerciseRepo.updateExercise(ctx.userId, input.entry_id, {});
        if (!existing) throw new ToolError('NOT_FOUND', `exercise entry not found: ${input.entry_id}`);
        const startedAt = input.started_at ? new Date(input.started_at) : existing.startedAt;
        const tz = input.timezone ?? existing.timezone;
        if (!isValidTimezone(tz)) throw new ToolError('VALIDATION', `invalid timezone: ${tz}`);
        patch.startedAt = startedAt;
        patch.timezone = tz;
        patch.localDate = dateColumn(localDateOf(startedAt, tz));
      }

      const row = await exerciseRepo.updateExercise(ctx.userId, input.entry_id, patch);
      if (!row) throw new ToolError('NOT_FOUND', `exercise entry not found: ${input.entry_id}`);
      return { entry: toEntry(row) };
    },
  },
  {
    name: 'delete_exercise_entries',
    title: 'Delete exercise entries',
    description:
      'Delete one or more exercise sessions by id. Unknown ids are reported in not_found ' +
      'rather than failing the call.',
    inputSchema: {
      entry_ids: z.array(z.string().min(1).max(64)).min(1).max(50),
    },
    outputSchema: {
      deleted_count: z.number().int(),
      not_found: z.array(z.string()),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    requiredScopes: [SCOPES.DIARY],
    handler: async (rawInput, ctx) => {
      const input = rawInput as { entry_ids: string[] };
      const result = await exerciseRepo.deleteExercises(ctx.userId, input.entry_ids);
      return { deleted_count: result.deletedCount, not_found: result.notFound };
    },
  },
  {
    name: 'list_exercises',
    title: 'List exercise entries',
    description:
      'Read exercise/activity history for a date range (local dates, newest first). ' +
      'Call when the user asks about past workouts or when an agent needs raw expenditure ' +
      'data for its own energy-balance calculations.',
    inputSchema: {
      from: zDate,
      to: zDate,
      category: zExerciseCategory.optional(),
      limit: zLimit,
      cursor: zCursor.optional(),
    },
    outputSchema: {
      items: z.array(exerciseOutput),
      next_cursor: z.string().optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    requiredScopes: [SCOPES.DIARY],
    handler: async (rawInput, ctx) => {
      const input = rawInput as {
        from: string;
        to: string;
        category?: z.infer<typeof zExerciseCategory>;
        limit: number;
        cursor?: string;
      };
      const range = parseRange(input.from, input.to, 92);

      let cursorKey: { startedAt: Date; id: string } | undefined;
      if (input.cursor) {
        const key = decodeCursor(input.cursor);
        const [at, id] = key;
        if (key.length !== 2 || typeof at !== 'string' || typeof id !== 'string' || Number.isNaN(Date.parse(at))) {
          throw new ToolError('VALIDATION', 'invalid cursor');
        }
        cursorKey = { startedAt: new Date(at), id };
      }

      const rows = await exerciseRepo.listExercises(ctx.userId, {
        from: range.from,
        to: range.to,
        category: input.category,
        limit: input.limit,
        cursorKey,
      });
      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      const last = page[page.length - 1];
      return {
        items: page.map(toEntry),
        ...(hasMore ? { next_cursor: encodeCursor([last.startedAt.toISOString(), last.id]) } : {}),
      };
    },
  },
];
