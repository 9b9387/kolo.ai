import { z } from 'zod';
import { SCOPES } from '@/lib/auth/scopes';
import { dateColumn, isValidTimezone } from '@/lib/dates';
import { upsertProfile } from '@/lib/repos/profile';
import { ToolError, type AnyToolDef, type AuthContext } from '../types';
import { zDate, zTimezone } from '../schemas/common';

const zSex = z.enum(['male', 'female', 'other']);
const zCalcAs = z.enum(['male', 'female', 'average']);
const zActivityLevel = z.enum([
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'extra_active',
]);

const updateProfileInput = {
  sex: zSex.optional(),
  calc_as: zCalcAs
    .nullable()
    .optional()
    .describe('BMR formula basis the agent should use when sex=other; null clears it'),
  birth_date: zDate.optional(),
  height_cm: z.number().min(50).max(280).optional(),
  activity_level: zActivityLevel
    .optional()
    .describe(
      'Five levels map to factors 1.2 / 1.375 / 1.55 / 1.725 / 1.9 — the calling agent applies the multiplication itself, Kolo never computes',
    ),
  custom_activity_factor: z
    .number()
    .min(1)
    .max(2.5)
    .nullable()
    .optional()
    .describe('Overrides the activity_level factor when the agent derived a bespoke one; null clears it'),
  timezone: zTimezone.optional(),
  nutrient_ref_standard: z
    .enum(['cn_nrv', 'us_dri'])
    .nullable()
    .optional()
    .describe(
      'Preferred nutrient reference standard for get_nutrient_references: cn_nrv (中国 GB 28050 营养素参考值) or us_dri (US DRI); null clears it',
    ),
  note: z.string().max(2000).nullable().optional(),
};

export const profileOutput = z.object({
  sex: zSex.nullable(),
  calc_as: zCalcAs.nullable(),
  birth_date: z.string().nullable().describe('Stored calendar date, serialized as UTC-midnight ISO'),
  height_cm: z.number().nullable(),
  activity_level: zActivityLevel.nullable(),
  custom_activity_factor: z.number().nullable(),
  timezone: z.string().nullable(),
  nutrient_ref_standard: z.enum(['cn_nrv', 'us_dri']).nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

type UpdateProfileInput = z.objectOutputType<typeof updateProfileInput, z.ZodTypeAny>;
type ProfileRow = Awaited<ReturnType<typeof upsertProfile>>;

export function toProfileOutput(p: ProfileRow) {
  return {
    sex: p.sex,
    calc_as: p.calcAs,
    birth_date: p.birthDate,
    height_cm: p.heightCm,
    activity_level: p.activityLevel,
    custom_activity_factor: p.customActivityFactor,
    timezone: p.timezone,
    nutrient_ref_standard: p.nutrientRefStandard,
    note: p.note,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export const profileTools: AnyToolDef[] = [
  {
    name: 'update_profile',
    title: 'Update user profile',
    description:
      'Create or update the user profile. Call when the user shares or changes basic body facts: sex, birth date, height, activity level, timezone, or a free-form note. Only the provided fields are changed; pass null to clear a nullable field. Kolo only stores these inputs — BMR/TDEE math is the calling agent\'s job.',
    inputSchema: updateProfileInput,
    outputSchema: { profile: profileOutput },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    requiredScopes: [SCOPES.PROFILE],
    handler: async (input: UpdateProfileInput, ctx: AuthContext) => {
      if (input.timezone !== undefined && !isValidTimezone(input.timezone)) {
        throw new ToolError('VALIDATION', `invalid timezone: ${input.timezone}`);
      }
      const profile = await upsertProfile(ctx.userId, {
        sex: input.sex,
        calcAs: input.calc_as,
        birthDate: input.birth_date !== undefined ? dateColumn(input.birth_date) : undefined,
        heightCm: input.height_cm,
        activityLevel: input.activity_level,
        customActivityFactor: input.custom_activity_factor,
        timezone: input.timezone,
        nutrientRefStandard: input.nutrient_ref_standard,
        note: input.note,
      });
      return { profile: toProfileOutput(profile) };
    },
  },
];
