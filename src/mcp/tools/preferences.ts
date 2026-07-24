import { z } from 'zod';
import { SCOPES } from '@/lib/auth/scopes';
import { zAllergen } from '@/mcp/schemas/common';
import { ToolError, type AnyToolDef, type ToolDef } from '@/mcp/types';
import {
  getPreferences,
  replacePreferences,
  type PreferencesPatch,
  type PreferencesSnapshot,
} from '@/lib/repos/preference';

const zDietType = z.enum([
  'omnivore',
  'flexitarian',
  'pescatarian',
  'vegetarian',
  'lacto_ovo_vegetarian',
  'lacto_vegetarian',
  'ovo_vegetarian',
  'vegan',
]);

const zReligiousDiet = z.enum(['halal', 'kosher', 'hindu_no_beef', 'buddhist']);
const zAllergenSeverity = z.enum(['allergy', 'intolerance', 'avoid']);
const zTagKind = z.enum(['like', 'dislike', 'avoid_ingredient', 'cuisine', 'texture', 'other']);

export const zPreferencesOutput = z.object({
  diet_type: zDietType.nullable(),
  religious_diets: z.array(z.string()),
  note: z.string().nullable(),
  allergens: z.array(
    z.object({
      allergen: z.string(),
      severity: zAllergenSeverity,
      note: z.string().nullable(),
    }),
  ),
  tags: z.array(
    z.object({
      kind: zTagKind,
      label: z.string(),
      note: z.string().nullable(),
    }),
  ),
});

// DB snapshot (camelCase) → MCP boundary shape (snake_case).
export function toPreferencesOutput(snap: PreferencesSnapshot) {
  const dp = snap.dietaryPreference;
  return {
    diet_type: dp?.dietType ?? null,
    religious_diets: Array.isArray(dp?.religiousDiets) ? (dp.religiousDiets as string[]) : [],
    note: dp?.note ?? null,
    allergens: snap.allergens.map((a) => ({
      allergen: a.allergen,
      severity: a.severity,
      note: a.note,
    })),
    tags: snap.tags.map((t) => ({
      kind: t.kind,
      label: t.label,
      note: t.note,
    })),
  };
}

const updatePreferencesInput = {
  diet_type: zDietType
    .nullable()
    .optional()
    .describe('Base diet pattern. null clears it. Omit to leave unchanged.'),
  religious_diets: z
    .array(zReligiousDiet)
    .max(4)
    .optional()
    .describe('Religious dietary rules. Replaces the whole list; [] clears it.'),
  allergens: z
    .array(
      z.object({
        allergen: zAllergen,
        severity: z.enum(['allergy', 'intolerance', 'avoid']).default('allergy'),
        note: z.string().max(200).optional(),
      }),
    )
    .max(20)
    .optional()
    .describe('Allergens to avoid. Replaces the whole list; [] clears it.'),
  tags: z
    .array(
      z.object({
        kind: zTagKind,
        label: z.string().min(1).max(100),
        note: z.string().max(200).optional(),
      }),
    )
    .max(100)
    .optional()
    .describe(
      'Free-form preference tags (likes/dislikes/cuisines...). Replaces the whole list; [] clears it.',
    ),
};

const updatePreferences: ToolDef<typeof updatePreferencesInput> = {
  name: 'update_preferences',
  title: 'Update dietary preferences',
  description:
    'Call when the user states or changes dietary preferences: diet type, religious dietary ' +
    'rules, allergens/intolerances, or food likes/dislikes. Field-level replacement semantics: ' +
    'each field you provide fully REPLACES the stored value for that field (arrays replace the ' +
    'whole set; pass [] to clear), and any field you omit is left untouched. To edit an existing ' +
    'list, first read the current preferences (e.g. via get_overview), merge your change locally, ' +
    'then submit the complete list here. Returns the full preferences after the update.',
  inputSchema: updatePreferencesInput,
  outputSchema: {
    preferences: zPreferencesOutput,
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true, // provided arrays overwrite the previously stored set
    idempotentHint: true,
    openWorldHint: false,
  },
  requiredScopes: [SCOPES.PROFILE],
  handler: async (input, ctx) => {
    const patch: PreferencesPatch = {};

    if (input.diet_type !== undefined) patch.dietType = input.diet_type;
    if (input.religious_diets !== undefined) patch.religiousDiets = input.religious_diets;

    if (input.allergens !== undefined) {
      const seen = new Set<string>();
      for (const a of input.allergens) {
        if (seen.has(a.allergen)) {
          throw new ToolError('VALIDATION', `duplicate allergen in request: ${a.allergen}`);
        }
        seen.add(a.allergen);
      }
      patch.allergens = input.allergens.map((a) => ({
        allergen: a.allergen,
        severity: a.severity,
        note: a.note,
      }));
    }

    if (input.tags !== undefined) {
      const seen = new Set<string>();
      for (const t of input.tags) {
        const key = `${t.kind} ${t.label}`;
        if (seen.has(key)) {
          throw new ToolError('VALIDATION', `duplicate tag in request: ${t.kind}/${t.label}`);
        }
        seen.add(key);
      }
      patch.tags = input.tags.map((t) => ({ kind: t.kind, label: t.label, note: t.note }));
    }

    const snapshot =
      Object.keys(patch).length > 0
        ? await replacePreferences(ctx.userId, patch)
        : await getPreferences(ctx.userId); // nothing provided: no-op, return current state

    return { preferences: toPreferencesOutput(snapshot) };
  },
};

export const preferenceTools: AnyToolDef[] = [updatePreferences];
