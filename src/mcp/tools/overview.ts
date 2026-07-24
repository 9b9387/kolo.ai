import { z } from 'zod';
import { SCOPES } from '@/lib/auth/scopes';
import { getProfile } from '@/lib/repos/profile';
import { getActiveGoal } from '@/lib/repos/goal';
import { getPreferences } from '@/lib/repos/preference';
import { latestPerType } from '@/lib/repos/body-metric';
import type { AnyToolDef, AuthContext } from '../types';
import { zMetricType } from '../schemas/common';
import { profileOutput, toProfileOutput } from './profile';
import { goalOutput, toGoalOutput } from './goals';
import { zPreferencesOutput, toPreferencesOutput } from './preferences';

// One call that assembles everything an agent needs before doing any
// personalized math: profile, freshest value of every body metric, the
// active goal and all dietary preferences.

const latestMetricOutput = z.object({
  metric_type: zMetricType,
  value: z.number(),
  measured_at: z.string(),
  measured_date: z.string(),
});

export const overviewTools: AnyToolDef[] = [
  {
    name: 'get_overview',
    title: 'Get user overview',
    description:
      "Fetch the user's complete background in one call: profile (sex, birth date, height, " +
      'activity level, timezone), the latest value of every recorded body metric (weight, ' +
      'body fat %, …), the currently active goal and all dietary preferences/allergens. ' +
      'Call this first before computing BMR/TDEE, planning meals, or any personalized ' +
      'analysis — the raw inputs live here, the math is yours.',
    inputSchema: {},
    outputSchema: {
      profile: profileOutput.nullable().describe('null until update_profile is first called'),
      latest_metrics: z.array(latestMetricOutput),
      active_goal: goalOutput.nullable(),
      preferences: zPreferencesOutput,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    requiredScopes: [SCOPES.PROFILE],
    handler: async (_input: Record<string, unknown>, ctx: AuthContext) => {
      const [profile, metrics, activeGoal, preferences] = await Promise.all([
        getProfile(ctx.userId),
        latestPerType(ctx.userId),
        getActiveGoal(ctx.userId),
        getPreferences(ctx.userId),
      ]);
      return {
        profile: profile ? toProfileOutput(profile) : null,
        latest_metrics: metrics.map((m) => ({
          metric_type: m.metricType,
          value: m.value,
          measured_at: m.measuredAt,
          measured_date: m.measuredDate,
        })),
        active_goal: activeGoal ? toGoalOutput(activeGoal) : null,
        preferences: toPreferencesOutput(preferences),
      };
    },
  },
];
