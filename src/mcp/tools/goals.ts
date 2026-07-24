import { z } from 'zod';
import { SCOPES } from '@/lib/auth/scopes';
import { dateColumn } from '@/lib/dates';
import { createGoal, listGoals, updateGoal, type GoalWriteData } from '@/lib/repos/goal';
import { decodeCursor, encodeCursor } from '../pagination';
import { ToolError, type AnyToolDef, type AuthContext } from '../types';
import { zCursor, zDate, zId, zLimit } from '../schemas/common';

const zGoalType = z.enum([
  'fat_loss',
  'muscle_gain',
  'maintenance',
  'recomposition',
  'performance',
  'health',
]);

const setGoalInput = {
  goal_id: zId
    .optional()
    .describe(
      'Omit to create a new goal (archives the current active one); provide to update that existing goal',
    ),
  goal_type: zGoalType.optional().describe('Required when creating a new goal'),
  target_weight_kg: z.number().min(20).max(400).nullable().optional(),
  weekly_rate_kg: z
    .number()
    .min(-1.5)
    .max(1.5)
    .nullable()
    .optional()
    .describe('Negative = weight loss'),
  target_date: zDate.nullable().optional(),
  daily_calorie_target: z.number().int().min(0).max(10000).nullable().optional(),
  protein_target_g: z.number().min(0).max(1000).nullable().optional(),
  carb_target_g: z.number().min(0).max(2000).nullable().optional(),
  fat_target_g: z.number().min(0).max(1000).nullable().optional(),
  fiber_target_g: z.number().min(0).max(200).nullable().optional(),
  water_target_ml: z.number().int().min(0).max(20000).nullable().optional(),
  rationale: z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .describe("The agent's calculation basis, e.g. formula used and daily deficit"),
};

const listGoalsInput = {
  include_ended: z.boolean().default(false).describe('Also return archived/ended goals'),
  limit: zLimit,
  cursor: zCursor.optional(),
};

export const goalOutput = z.object({
  id: z.string(),
  goal_type: zGoalType,
  target_weight_kg: z.number().nullable(),
  weekly_rate_kg: z.number().nullable(),
  target_date: z.string().nullable().describe('Stored calendar date, serialized as UTC-midnight ISO'),
  daily_calorie_target: z.number().nullable(),
  protein_target_g: z.number().nullable(),
  carb_target_g: z.number().nullable(),
  fat_target_g: z.number().nullable(),
  fiber_target_g: z.number().nullable(),
  water_target_ml: z.number().nullable(),
  rationale: z.string().nullable(),
  is_active: z.boolean(),
  started_at: z.string(),
  ended_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

type SetGoalInput = z.objectOutputType<typeof setGoalInput, z.ZodTypeAny>;
type ListGoalsInput = z.objectOutputType<typeof listGoalsInput, z.ZodTypeAny>;
type GoalRow = Awaited<ReturnType<typeof createGoal>>;

export function toGoalOutput(g: GoalRow) {
  return {
    id: g.id,
    goal_type: g.goalType,
    target_weight_kg: g.targetWeightKg,
    weekly_rate_kg: g.weeklyRateKg,
    target_date: g.targetDate,
    daily_calorie_target: g.dailyCalorieTarget,
    protein_target_g: g.proteinTargetG,
    carb_target_g: g.carbTargetG,
    fat_target_g: g.fatTargetG,
    fiber_target_g: g.fiberTargetG,
    water_target_ml: g.waterTargetMl,
    rationale: g.rationale,
    is_active: g.isActive,
    started_at: g.startedAt,
    ended_at: g.endedAt,
    created_at: g.createdAt,
    updated_at: g.updatedAt,
  };
}

export const goalTools: AnyToolDef[] = [
  {
    name: 'set_goal',
    title: 'Create or update a goal',
    description:
      'Create a new goal or update an existing one. Call without goal_id when the user states a new objective (goal_type required; the previous active goal is archived automatically). Call with goal_id to write back agent-computed targets (calories/macros/water) or adjust an existing goal. Kolo stores targets verbatim — all calculations are the calling agent\'s job.',
    inputSchema: setGoalInput,
    outputSchema: { goal: goalOutput },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    requiredScopes: [SCOPES.PROFILE],
    handler: async (input: SetGoalInput, ctx: AuthContext) => {
      const data: GoalWriteData = {
        targetWeightKg: input.target_weight_kg,
        weeklyRateKg: input.weekly_rate_kg,
        targetDate:
          input.target_date === undefined
            ? undefined
            : input.target_date === null
              ? null
              : dateColumn(input.target_date),
        dailyCalorieTarget: input.daily_calorie_target,
        proteinTargetG: input.protein_target_g,
        carbTargetG: input.carb_target_g,
        fatTargetG: input.fat_target_g,
        fiberTargetG: input.fiber_target_g,
        waterTargetMl: input.water_target_ml,
        rationale: input.rationale,
      };

      if (input.goal_id === undefined) {
        if (input.goal_type === undefined) {
          throw new ToolError('VALIDATION', 'goal_type is required when creating a new goal');
        }
        const goal = await createGoal(ctx.userId, { ...data, goalType: input.goal_type });
        return { goal: toGoalOutput(goal) };
      }

      const goal = await updateGoal(ctx.userId, input.goal_id, {
        ...data,
        goalType: input.goal_type,
      });
      if (!goal) throw new ToolError('NOT_FOUND', 'goal not found');
      return { goal: toGoalOutput(goal) };
    },
  },
  {
    name: 'list_goals',
    title: 'List goals',
    description:
      'List the user\'s goals, newest first. Call when you need the current targets (default returns only the active goal) or, with include_ended=true, the full goal history.',
    inputSchema: listGoalsInput,
    outputSchema: {
      items: z.array(goalOutput),
      next_cursor: z.string().optional(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    requiredScopes: [SCOPES.PROFILE],
    // Param stays untyped: ListGoalsInput has required keys (zod defaults), which
    // ToolDef<any>'s contravariant handler param cannot satisfy; cast instead.
    handler: async (rawInput, ctx: AuthContext) => {
      const input = rawInput as ListGoalsInput;
      let cursorKey: [string, string] | undefined;
      if (input.cursor !== undefined) {
        const key = decodeCursor(input.cursor);
        const [startedAt, id] = key;
        if (
          key.length !== 2 ||
          typeof startedAt !== 'string' ||
          typeof id !== 'string' ||
          Number.isNaN(Date.parse(startedAt))
        ) {
          throw new ToolError('VALIDATION', 'invalid cursor');
        }
        cursorKey = [startedAt, id];
      }

      const rows = await listGoals(ctx.userId, {
        includeEnded: input.include_ended,
        limit: input.limit + 1,
        cursorKey,
      });
      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;

      const result: Record<string, unknown> = { items: items.map(toGoalOutput) };
      if (hasMore) {
        const last = items[items.length - 1];
        result.next_cursor = encodeCursor([last.startedAt.toISOString(), last.id]);
      }
      return result;
    },
  },
];
