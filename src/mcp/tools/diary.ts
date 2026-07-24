import { z } from 'zod';
import { SCOPES } from '@/lib/auth/scopes';
import { ToolError } from '@/mcp/types';
import type { AnyToolDef, AuthContext } from '@/mcp/types';
import { encodeCursor, decodeCursor } from '@/mcp/pagination';
import {
  zDate,
  zDateTime,
  zTimezone,
  zLimit,
  zCursor,
  zId,
  zMealType,
  zLogSource,
  zNutrients,
} from '@/mcp/schemas/common';
import { localDateOf, dateColumn, isValidTimezone } from '@/lib/dates';
import * as dietLogRepo from '@/lib/repos/diet-log';
import type { DietLogWriteData, DietLogPatch } from '@/lib/repos/diet-log';
import type { DietLog } from '@/generated/prisma/client';

// Diet diary tools. Kolo stores what the caller reports — nutrient values are
// snapshots computed by the calling agent, never derived or judged here.

type Infer<T extends z.ZodRawShape> = z.objectOutputType<T, z.ZodTypeAny>;

const LIST_RANGE_MAX_DAYS = 92;
const SUMMARY_RANGE_MAX_DAYS = 31;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseFoodId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new ToolError('VALIDATION', `invalid food_id: ${value}`);
  }
}

/** Validates a [from, to] local-date range and converts it to @db.Date values. */
function parseDateRange(from: string, to: string, maxDays: number): { from: Date; to: Date } {
  const fromDate = dateColumn(from);
  const toDate = dateColumn(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new ToolError('VALIDATION', 'from/to must be real calendar dates (YYYY-MM-DD)');
  }
  if (from > to) {
    throw new ToolError('LIMIT_EXCEEDED', 'from must be on or before to');
  }
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  if (days > maxDays) {
    throw new ToolError('LIMIT_EXCEEDED', `date range covers ${days} days; the maximum is ${maxDays}`);
  }
  return { from: fromDate, to: toDate };
}

/** snake_case snapshot -> DB snapshot columns; omitted optionals reset to null. */
function nutrientColumns(n: z.infer<typeof zNutrients>) {
  return {
    energyKcal: n.energy_kcal,
    proteinG: n.protein_g,
    carbG: n.carb_g,
    fatG: n.fat_g,
    fiberG: n.fiber_g ?? null,
    sugarG: n.sugar_g ?? null,
    satFatG: n.sat_fat_g ?? null,
    sodiumMg: n.sodium_mg ?? null,
  };
}

/** DB row -> MCP entry. Only renames fields; register.ts serializes values. */
function toEntry(row: DietLog): Record<string, unknown> {
  return {
    entry_id: row.id,
    food_id: row.foodId,
    description: row.description,
    meal_type: row.mealType,
    custom_meal_label: row.mealLabel,
    amount_input: row.amountInput,
    unit_input: row.unitInput,
    grams: row.grams,
    nutrients: {
      energy_kcal: row.energyKcal,
      protein_g: row.proteinG,
      carb_g: row.carbG,
      fat_g: row.fatG,
      fiber_g: row.fiberG,
      sugar_g: row.sugarG,
      sat_fat_g: row.satFatG,
      sodium_mg: row.sodiumMg,
    },
    eaten_at: row.eatenAt,
    local_date: row.localDate.toISOString().slice(0, 10),
    timezone: row.timezone,
    source: row.source,
    confidence: row.confidence,
    original_description: row.originalDescription,
    note: row.note,
    created_by: row.createdBy,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Output schemas (post-serialization shapes: BigInt→string, Decimal→number,
// Date→ISO string)
// ---------------------------------------------------------------------------

const zNutrientsOut = z.object({
  energy_kcal: z.number(),
  protein_g: z.number(),
  carb_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number().nullable(),
  sugar_g: z.number().nullable(),
  sat_fat_g: z.number().nullable(),
  sodium_mg: z.number().nullable(),
});

const zEntryOut = z.object({
  entry_id: z.string(),
  food_id: z.string().nullable().describe('Food library id; null for self-reported entries'),
  description: z.string().nullable(),
  meal_type: zMealType,
  custom_meal_label: z.string().nullable(),
  amount_input: z.number().nullable(),
  unit_input: z.string().nullable(),
  grams: z.number().nullable(),
  nutrients: zNutrientsOut.describe('Snapshot of the actual intake, as reported at log time'),
  eaten_at: z.string().describe('UTC instant, ISO 8601'),
  local_date: zDate,
  timezone: z.string(),
  source: zLogSource,
  confidence: z.number().nullable(),
  original_description: z.string().nullable(),
  note: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const zTotalsOut = z.object({
  energy_kcal: z.number(),
  protein_g: z.number(),
  carb_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number().nullable().describe('null when no entry that day carried the value'),
  sugar_g: z.number().nullable(),
  sat_fat_g: z.number().nullable(),
  sodium_mg: z.number().nullable(),
});

const zMealGroupOut = z.object({
  entry_count: z.number().int(),
  totals: zTotalsOut,
});

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const logEntryShape = z.object({
  eaten_at: zDateTime,
  timezone: zTimezone.optional().describe(
    'IANA timezone used to derive local_date; falls back to the profile timezone',
  ),
  meal_type: zMealType,
  custom_meal_label: z.string().max(50).optional().describe('Free-form meal label, e.g. "夜宵"'),
  food_id: zId
    .optional()
    .describe('Food library id (form A); at least one of food_id / description is required'),
  description: z
    .string()
    .max(500)
    .optional()
    .describe('Self-reported food text (form B); defaults to the food name when food_id is set'),
  amount_input: z.number().positive().optional().describe('Raw amount as reported, e.g. 1 for "1碗"'),
  unit_input: z.string().max(50).optional().describe('Raw unit as reported, e.g. "碗"'),
  grams: z
    .number()
    .positive()
    .max(10000)
    .optional()
    .describe('Normalized weight in grams; provide whenever it can be estimated'),
  nutrients: zNutrients.describe(
    'Required snapshot of the ACTUAL intake (not per-100g); for library foods the caller must scale by the eaten amount first',
  ),
  source: zLogSource.default('text'),
  confidence: z.number().min(0).max(1).optional(),
  original_description: z
    .string()
    .max(2000)
    .optional()
    .describe("The user's original wording, kept for provenance"),
  note: z.string().max(500).optional(),
});

const logMealInput = {
  entries: z.array(logEntryShape).min(1).max(30),
};

const updateMealEntryInput = {
  entry_id: zId,
  eaten_at: zDateTime.optional(),
  timezone: zTimezone.optional(),
  meal_type: zMealType.optional(),
  custom_meal_label: z.string().max(50).nullable().optional(),
  food_id: zId
    .nullable()
    .optional()
    .describe('New library food id; null detaches the entry (description must remain)'),
  description: z.string().max(500).nullable().optional(),
  amount_input: z.number().positive().nullable().optional(),
  unit_input: z.string().max(50).nullable().optional(),
  grams: z.number().positive().max(10000).nullable().optional(),
  nutrients: zNutrients.optional().describe(
    'Replaces the whole snapshot; omitted optional keys reset to null',
  ),
  source: zLogSource.optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  original_description: z.string().max(2000).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
};

const deleteMealEntriesInput = {
  entry_ids: z.array(zId).min(1).max(50),
};

const listMealsInput = {
  from: zDate,
  to: zDate,
  meal_type: zMealType.optional(),
  food_id: zId.optional().describe('Only entries referencing this library food'),
  limit: zLimit,
  cursor: zCursor.optional(),
};

const getDailySummaryInput = {
  from: zDate,
  to: zDate,
};

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const diaryTools: AnyToolDef[] = [
  {
    name: 'log_meal',
    title: 'Log meal entries',
    description:
      'Record one or more eaten items in the diet diary. Call after the user reports food intake ' +
      '(text, photo, barcode...). Each entry either references a library food via food_id or is ' +
      'self-reported via description; nutrients is always the snapshot of the ACTUAL amount eaten, ' +
      'pre-computed by the caller. local_date is derived server-side from eaten_at plus the given ' +
      '(or profile) timezone.',
    inputSchema: logMealInput,
    outputSchema: {
      entries: z.array(zEntryOut),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    requiredScopes: [SCOPES.DIARY],
    handler: async (rawInput, ctx: AuthContext) => {
      const input = rawInput as Infer<typeof logMealInput>;
      const parsed = input.entries.map((e, i) => {
        if (e.food_id === undefined && e.description === undefined) {
          throw new ToolError(
            'VALIDATION',
            `entries[${i}]: at least one of food_id and description is required`,
          );
        }
        return { ...e, foodIdBig: e.food_id !== undefined ? parseFoodId(e.food_id) : null };
      });

      // Resolve timezones; the profile fallback is fetched once, only if needed.
      const needsProfileTz = parsed.some((e) => e.timezone === undefined);
      const profileTz = needsProfileTz ? await dietLogRepo.getProfileTimezone(ctx.userId) : null;
      const timezones = parsed.map((e, i) => {
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

      // Referenced foods must exist and be visible (public or own custom).
      const foodIds = [
        ...new Set(parsed.map((e) => e.foodIdBig).filter((v): v is bigint => v !== null)),
      ];
      const foodNames = await dietLogRepo.getVisibleFoodNames(ctx.userId, foodIds);
      const createdBy = `${ctx.authMethod}:${ctx.clientId}`.slice(0, 120);

      const writeData: DietLogWriteData[] = parsed.map((e, i) => {
        let description = e.description ?? null;
        if (e.foodIdBig !== null) {
          const name = foodNames.get(e.foodIdBig);
          if (name === undefined) {
            throw new ToolError('NOT_FOUND', `food not found: ${e.food_id}`);
          }
          // Snapshot the food name so the entry stays readable if the food
          // is later retired or unlinked.
          if (description === null) description = name.slice(0, 500);
        }
        const eatenAt = new Date(e.eaten_at);
        return {
          foodId: e.foodIdBig,
          description,
          mealType: e.meal_type,
          mealLabel: e.custom_meal_label ?? null,
          amountInput: e.amount_input ?? null,
          unitInput: e.unit_input ?? null,
          grams: e.grams ?? null,
          ...nutrientColumns(e.nutrients),
          eatenAt,
          localDate: dateColumn(localDateOf(eatenAt, timezones[i])),
          timezone: timezones[i],
          source: e.source,
          confidence: e.confidence ?? null,
          originalDescription: e.original_description ?? null,
          note: e.note ?? null,
          createdBy,
        };
      });

      const rows = await dietLogRepo.createLogs(ctx.userId, writeData);
      return { entries: rows.map(toEntry) };
    },
  },
  {
    name: 'update_meal_entry',
    title: 'Update a diary entry',
    description:
      'Correct a single existing diary entry — wrong amount, time, meal type, nutrients, etc. ' +
      'Call when the user amends an earlier log. Pass only the fields to change; null clears a ' +
      'clearable field; nutrients replaces the whole snapshot. local_date is re-derived when ' +
      'eaten_at or timezone changes.',
    inputSchema: updateMealEntryInput,
    outputSchema: {
      entry: zEntryOut,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    requiredScopes: [SCOPES.DIARY],
    handler: async (rawInput, ctx: AuthContext) => {
      const input = rawInput as Infer<typeof updateMealEntryInput>;
      const row = await dietLogRepo.getLog(ctx.userId, input.entry_id);
      if (!row) throw new ToolError('NOT_FOUND', 'diary entry not found');

      // The dual-form invariant must still hold after the patch.
      const newFoodId =
        input.food_id === undefined
          ? row.foodId
          : input.food_id === null
            ? null
            : parseFoodId(input.food_id);
      const newDescription = input.description === undefined ? row.description : input.description;
      if (newFoodId === null && newDescription === null) {
        throw new ToolError(
          'VALIDATION',
          'at least one of food_id and description must remain on the entry',
        );
      }

      // Look the food up when a new one is referenced (visibility check) or a
      // name snapshot is needed to keep description non-null.
      let snapshotDescription: string | undefined;
      if (newFoodId !== null && (input.food_id !== undefined || newDescription === null)) {
        const names = await dietLogRepo.getVisibleFoodNames(ctx.userId, [newFoodId]);
        const name = names.get(newFoodId);
        if (name === undefined) {
          throw new ToolError('NOT_FOUND', `food not found: ${newFoodId.toString()}`);
        }
        if (newDescription === null) snapshotDescription = name.slice(0, 500);
      }

      const patch: DietLogPatch = {};
      if (input.food_id !== undefined) patch.foodId = newFoodId;
      if (snapshotDescription !== undefined) {
        patch.description = snapshotDescription;
      } else if (input.description !== undefined) {
        patch.description = input.description;
      }
      if (input.meal_type !== undefined) patch.mealType = input.meal_type;
      if (input.custom_meal_label !== undefined) patch.mealLabel = input.custom_meal_label;
      if (input.amount_input !== undefined) patch.amountInput = input.amount_input;
      if (input.unit_input !== undefined) patch.unitInput = input.unit_input;
      if (input.grams !== undefined) patch.grams = input.grams;
      if (input.nutrients !== undefined) Object.assign(patch, nutrientColumns(input.nutrients));
      if (input.source !== undefined) patch.source = input.source;
      if (input.confidence !== undefined) patch.confidence = input.confidence;
      if (input.original_description !== undefined) {
        patch.originalDescription = input.original_description;
      }
      if (input.note !== undefined) patch.note = input.note;

      if (input.eaten_at !== undefined || input.timezone !== undefined) {
        if (input.timezone !== undefined && !isValidTimezone(input.timezone)) {
          throw new ToolError('VALIDATION', `invalid timezone: ${input.timezone}`);
        }
        const eatenAt = input.eaten_at !== undefined ? new Date(input.eaten_at) : row.eatenAt;
        const tz = input.timezone ?? row.timezone;
        if (input.eaten_at !== undefined) patch.eatenAt = eatenAt;
        if (input.timezone !== undefined) patch.timezone = input.timezone;
        patch.localDate = dateColumn(localDateOf(eatenAt, tz));
      }

      if (Object.keys(patch).length === 0) return { entry: toEntry(row) };

      const updated = await dietLogRepo.updateLog(ctx.userId, input.entry_id, patch);
      if (!updated) throw new ToolError('NOT_FOUND', 'diary entry not found');
      return { entry: toEntry(updated) };
    },
  },
  {
    name: 'delete_meal_entries',
    title: 'Delete diary entries',
    description:
      'Permanently delete one or more diary entries. Call when the user retracts a log or a ' +
      'duplicate was recorded. Unknown ids are returned in not_found instead of failing, so ' +
      'retries are safe.',
    inputSchema: deleteMealEntriesInput,
    outputSchema: {
      deleted_count: z.number().int(),
      not_found: z.array(z.string()),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    requiredScopes: [SCOPES.DIARY],
    handler: async (rawInput, ctx: AuthContext) => {
      const input = rawInput as Infer<typeof deleteMealEntriesInput>;
      const ids = [...new Set(input.entry_ids)];
      const { deletedCount, notFound } = await dietLogRepo.deleteLogs(ctx.userId, ids);
      return { deleted_count: deletedCount, not_found: notFound };
    },
  },
  {
    name: 'list_meals',
    title: 'List diary entries',
    description:
      'List raw diary entries — nutrient snapshots plus provenance — for a local-date range of at ' +
      'most 92 days, newest first. Call to review or reconcile what has been logged, or to find an ' +
      'entry to update/delete. For per-day totals use get_daily_summary instead.',
    inputSchema: listMealsInput,
    outputSchema: {
      items: z.array(zEntryOut),
      next_cursor: z.string().optional().describe('Present only when another page exists'),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    requiredScopes: [SCOPES.DIARY],
    handler: async (rawInput, ctx: AuthContext) => {
      const input = rawInput as Infer<typeof listMealsInput>;
      const range = parseDateRange(input.from, input.to, LIST_RANGE_MAX_DAYS);
      const foodId = input.food_id !== undefined ? parseFoodId(input.food_id) : undefined;

      let cursorKey: { eatenAt: Date; id: string } | undefined;
      if (input.cursor !== undefined) {
        const k = decodeCursor(input.cursor);
        if (k.length !== 2 || typeof k[0] !== 'string' || typeof k[1] !== 'string') {
          throw new ToolError('VALIDATION', 'invalid cursor');
        }
        const eatenAt = new Date(k[0]);
        if (Number.isNaN(eatenAt.getTime())) {
          throw new ToolError('VALIDATION', 'invalid cursor');
        }
        cursorKey = { eatenAt, id: k[1] };
      }

      const rows = await dietLogRepo.listLogs(ctx.userId, {
        from: range.from,
        to: range.to,
        mealType: input.meal_type,
        foodId,
        limit: input.limit + 1,
        cursorKey,
      });

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      const result: Record<string, unknown> = { items: items.map(toEntry) };
      if (hasMore) {
        const last = items[items.length - 1];
        result.next_cursor = encodeCursor([last.eatenAt.toISOString(), last.id]);
      }
      return result;
    },
  },
  {
    name: 'get_daily_summary',
    title: 'Daily intake sums',
    description:
      'Per-day and per-meal-type raw sums of the logged nutrient snapshots for a local-date range ' +
      'of at most 31 days. Returns plain aggregation only — no evaluation, no target or adequacy ' +
      'judgement, no advice; all analysis (goals, trends, recommendations) is the calling agent\'s ' +
      'job. Days without entries are omitted; an optional nutrient is null when no entry that day ' +
      'carried it.',
    inputSchema: getDailySummaryInput,
    outputSchema: {
      days: z.array(
        z.object({
          date: zDate,
          entry_count: z.number().int(),
          totals: zTotalsOut,
          by_meal_type: z.object({
            breakfast: zMealGroupOut.optional(),
            lunch: zMealGroupOut.optional(),
            dinner: zMealGroupOut.optional(),
            snack: zMealGroupOut.optional(),
          }),
        }),
      ),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    requiredScopes: [SCOPES.DIARY],
    handler: async (rawInput, ctx: AuthContext) => {
      const input = rawInput as Infer<typeof getDailySummaryInput>;
      const range = parseDateRange(input.from, input.to, SUMMARY_RANGE_MAX_DAYS);
      const { byDay, byDayMeal } = await dietLogRepo.dailySummary(ctx.userId, range);

      type Sums = (typeof byDay)[number]['_sum'];
      const toTotals = (sum: Sums) => ({
        energy_kcal: sum.energyKcal,
        protein_g: sum.proteinG,
        carb_g: sum.carbG,
        fat_g: sum.fatG,
        fiber_g: sum.fiberG,
        sugar_g: sum.sugarG,
        sat_fat_g: sum.satFatG,
        sodium_mg: sum.sodiumMg,
      });

      const days = byDay.map((d) => ({
        date: d.localDate.toISOString().slice(0, 10),
        entry_count: d._count._all,
        totals: toTotals(d._sum),
        by_meal_type: {} as Record<string, { entry_count: number; totals: ReturnType<typeof toTotals> }>,
      }));
      const byDate = new Map(days.map((d) => [d.date, d]));
      for (const g of byDayMeal) {
        const day = byDate.get(g.localDate.toISOString().slice(0, 10));
        if (!day) continue;
        day.by_meal_type[g.mealType] = { entry_count: g._count._all, totals: toTotals(g._sum) };
      }
      return { days };
    },
  },
];
