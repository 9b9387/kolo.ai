import { z } from 'zod';
import { SCOPES } from '@/lib/auth/scopes';
import { getProfile } from '@/lib/repos/profile';
import {
  CN_NRV,
  US_DRI,
  driAgeGroup,
  type DriAgeGroup,
  type DriSex,
} from '@/lib/nutrient-references';
import { ToolError, type AnyToolDef, type AuthContext } from '../types';

// Official nutrient reference tables (中国 NRV / US DRI) served as plain
// data. Kolo hands the agent the yardstick; measuring is the agent's job.

const zStandard = z.enum(['cn_nrv', 'us_dri']);
const zDriSex = z.enum(['male', 'female']);
const zDriAgeGroup = z.enum(['19-30', '31-50', '51-70', '71+']);

const referenceValueOutput = z.object({
  nutrient: z.string().describe('Canonical Kolo nutrient key, e.g. proteinG, vitDUg'),
  unit: z.string(),
  value: z.number().nullable(),
  kind: z.enum(['NRV', 'RDA', 'AI']),
  upper_limit: z.number().optional().describe('Tolerable upper intake level where established'),
  note: z.string().optional(),
});

function ageFromBirthDate(birthDate: Date): number {
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

export const referenceTools: AnyToolDef[] = [
  {
    name: 'get_nutrient_references',
    title: 'Get official nutrient reference values',
    description:
      'Fetch an official nutrient reference table for the user: 中国 NRV (GB 28050 label ' +
      'reference values, single adult table) or US DRI (RDA/AI + upper limits by sex and ' +
      'age group). Defaults come from the profile: standard from nutrient_ref_standard, ' +
      'and for us_dri the sex/age group are derived from profile sex (calc_as for ' +
      'non-binary users) and birth date. Call before evaluating intake adequacy — the ' +
      'reference numbers come from here, the evaluation is yours. Mind the caveats field ' +
      '(NRV is a labeling reference, not an individual requirement; unit bases like ' +
      'µg RE vs µg RAE are noted per value).',
    inputSchema: {
      standard: zStandard
        .optional()
        .describe('Omit to use the profile nutrient_ref_standard'),
      sex: zDriSex.optional().describe('us_dri only; omit to derive from the profile'),
      age_group: zDriAgeGroup
        .optional()
        .describe('us_dri only; omit to derive from the profile birth date'),
    },
    outputSchema: {
      standard: zStandard,
      basis: z.object({
        sex: zDriSex.nullable(),
        age_group: zDriAgeGroup.nullable(),
        derived_from_profile: z.boolean(),
      }),
      source: z.object({
        name: z.string(),
        citation: z.string(),
        urls: z.array(z.string()),
      }),
      caveats: z.array(z.string()),
      values: z.array(referenceValueOutput),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    requiredScopes: [SCOPES.PROFILE],
    handler: async (rawInput, ctx: AuthContext) => {
      const input = rawInput as {
        standard?: 'cn_nrv' | 'us_dri';
        sex?: DriSex;
        age_group?: DriAgeGroup;
      };
      const profile = input.standard && input.sex && input.age_group ? null : await getProfile(ctx.userId);

      const standard = input.standard ?? profile?.nutrientRefStandard;
      if (standard !== 'cn_nrv' && standard !== 'us_dri') {
        throw new ToolError(
          'VALIDATION',
          'no reference standard: pass standard=cn_nrv|us_dri or set it on the profile via update_profile (nutrient_ref_standard)',
        );
      }

      if (standard === 'cn_nrv') {
        return {
          standard,
          basis: { sex: null, age_group: null, derived_from_profile: input.standard === undefined },
          source: CN_NRV.source,
          caveats: CN_NRV.caveats,
          values: CN_NRV.values,
        };
      }

      // us_dri: resolve sex and age group, preferring explicit input.
      let sex: DriSex | undefined = input.sex;
      let derived = input.standard === undefined;
      if (!sex) {
        const profileSex = profile?.sex === 'other' ? profile?.calcAs : profile?.sex;
        if (profileSex === 'male' || profileSex === 'female') {
          sex = profileSex;
          derived = true;
        } else {
          throw new ToolError(
            'VALIDATION',
            'us_dri needs a sex basis: pass sex=male|female (profile sex is unset, or "other" without a male/female calc_as)',
          );
        }
      }

      let ageGroup: DriAgeGroup | undefined = input.age_group;
      if (!ageGroup) {
        if (!profile?.birthDate) {
          throw new ToolError(
            'VALIDATION',
            'us_dri needs an age basis: pass age_group or set birth_date on the profile',
          );
        }
        const age = ageFromBirthDate(profile.birthDate);
        if (age < 19) {
          throw new ToolError(
            'VALIDATION',
            `adult DRI tables only (19+); profile age is ${age} — pass age_group explicitly if intended`,
          );
        }
        ageGroup = driAgeGroup(age);
        derived = true;
      }

      const group = US_DRI.groups.find((g) => g.sex === sex && g.age_group === ageGroup);
      if (!group) throw new ToolError('INTERNAL', `missing DRI group ${sex}/${ageGroup}`);

      return {
        standard,
        basis: { sex, age_group: ageGroup, derived_from_profile: derived },
        source: US_DRI.source,
        caveats: US_DRI.caveats,
        values: group.values,
      };
    },
  },
];
