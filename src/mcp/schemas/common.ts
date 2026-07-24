import { z } from 'zod';

export const zDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('Local calendar date, YYYY-MM-DD');

export const zDateTime = z
  .string()
  .datetime({ offset: true })
  .describe('ISO 8601 with timezone offset, e.g. 2026-07-24T12:30:00+08:00');

export const zTimezone = z
  .string()
  .max(64)
  .describe('IANA timezone, e.g. Asia/Shanghai');

export const zLimit = z.number().int().min(1).max(100).default(20);
export const zCursor = z.string().max(500).describe('nextCursor from the previous page');
export const zId = z.string().min(1).max(64);

export const zMealType = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export const zLogSource = z.enum(['photo', 'text', 'barcode', 'manual', 'import']);
export const zFoodSource = z.enum(['usda_fdc', 'off', 'cfct', 'custom']);
export const zFoodDataType = z.enum([
  'foundation',
  'sr_legacy',
  'survey_fndds',
  'branded',
  'off',
  'off_api',
  'cfct',
  'custom',
]);

// Closed set at the MCP boundary; the DB column stays an open string.
// Units are part of the type's meaning — there is no separate unit field.
export const zMetricType = z.enum([
  'weight', //          kg
  'body_fat_pct', //    %
  'waist_cm',
  'hip_cm',
  'chest_cm',
  'arm_cm',
  'thigh_cm',
  'muscle_mass_kg',
  'visceral_fat', //    device level
]);

export const METRIC_RANGES: Record<z.infer<typeof zMetricType>, [number, number]> = {
  weight: [20, 400],
  body_fat_pct: [1, 75],
  waist_cm: [30, 300],
  hip_cm: [30, 300],
  chest_cm: [30, 300],
  arm_cm: [10, 100],
  thigh_cm: [20, 150],
  muscle_mass_kg: [10, 150],
  visceral_fat: [1, 60],
};

// FDA 9 ∪ GB 7718-2025, plus free-form "other:<text>".
export const ALLERGEN_SLUGS = [
  'milk',
  'eggs',
  'fish',
  'crustacean_shellfish',
  'tree_nuts',
  'peanuts',
  'wheat',
  'gluten_cereals',
  'soybeans',
  'sesame',
] as const;

export const zAllergen = z
  .string()
  .max(64)
  .refine(
    (v) => (ALLERGEN_SLUGS as readonly string[]).includes(v) || /^other:.{1,50}$/.test(v),
    { message: `allergen must be one of ${ALLERGEN_SLUGS.join('|')} or "other:<text>"` },
  );

// Nutrient snapshot for diet logs: actual intake, NOT per-100g.
export const zNutrients = z.object({
  energy_kcal: z.number().min(0).max(30000),
  protein_g: z.number().min(0).max(3000),
  carb_g: z.number().min(0).max(3000),
  fat_g: z.number().min(0).max(3000),
  fiber_g: z.number().min(0).max(1000).optional(),
  sugar_g: z.number().min(0).max(3000).optional(),
  sat_fat_g: z.number().min(0).max(1000).optional(),
  sodium_mg: z.number().min(0).max(100000).optional(),
});

// Per-100g nutrient input for create_food (agent-created private foods).
export const zPer100gNutrients = z.object({
  energy_kcal: z.number().min(0).max(900),
  protein_g: z.number().min(0).max(100),
  fat_g: z.number().min(0).max(100),
  carb_g: z.number().min(0).max(100),
  fiber_g: z.number().min(0).max(100).optional(),
  sugars_g: z.number().min(0).max(100).optional(),
  sat_fat_g: z.number().min(0).max(100).optional(),
  sodium_mg: z.number().min(0).max(40000).optional(),
  potassium_mg: z.number().min(0).max(20000).optional(),
  calcium_mg: z.number().min(0).max(10000).optional(),
  iron_mg: z.number().min(0).max(1000).optional(),
  cholesterol_mg: z.number().min(0).max(10000).optional(),
});
