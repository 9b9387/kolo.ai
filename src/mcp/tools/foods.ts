import { z } from 'zod';
import { SCOPES } from '@/lib/auth/scopes';
import { searchFoods, getFood, createCustomFood } from '@/lib/repos/food';
import { ToolError, type AnyToolDef } from '../types';
import { encodeCursor, decodeCursor } from '../pagination';
import { zCursor, zId, zFoodSource, zFoodDataType, zPer100gNutrients } from '../schemas/common';

// Search pages are capped lower than the global zLimit: fulltext + join rows
// are wide and agents rarely need more than a screenful of candidates.
const zSearchLimit = z.number().int().min(1).max(50).default(20);

// DB column → snake_case output key (unit suffix is part of the name).
const NUTRIENT_COLUMNS = [
  ['energyKcal', 'energy_kcal'],
  ['proteinG', 'protein_g'],
  ['fatG', 'fat_g'],
  ['carbG', 'carb_g'],
  ['fiberG', 'fiber_g'],
  ['sugarsG', 'sugars_g'],
  ['waterG', 'water_g'],
  ['alcoholG', 'alcohol_g'],
  ['cholesterolMg', 'cholesterol_mg'],
  ['satFatG', 'sat_fat_g'],
  ['mufaG', 'mufa_g'],
  ['pufaG', 'pufa_g'],
  ['transFatG', 'trans_fat_g'],
  ['sodiumMg', 'sodium_mg'],
  ['calciumMg', 'calcium_mg'],
  ['ironMg', 'iron_mg'],
  ['potassiumMg', 'potassium_mg'],
  ['magnesiumMg', 'magnesium_mg'],
  ['phosphorusMg', 'phosphorus_mg'],
  ['zincMg', 'zinc_mg'],
  ['copperMg', 'copper_mg'],
  ['manganeseMg', 'manganese_mg'],
  ['seleniumUg', 'selenium_ug'],
  ['vitAUgRae', 'vit_a_ug_rae'],
  ['caroteneUg', 'carotene_ug'],
  ['retinolUg', 'retinol_ug'],
  ['vitCMg', 'vit_c_mg'],
  ['vitDUg', 'vit_d_ug'],
  ['vitEMg', 'vit_e_mg'],
  ['vitKUg', 'vit_k_ug'],
  ['thiaminMg', 'thiamin_mg'],
  ['riboflavinMg', 'riboflavin_mg'],
  ['niacinMg', 'niacin_mg'],
  ['pantothenicMg', 'pantothenic_mg'],
  ['vitB6Mg', 'vit_b6_mg'],
  ['folateUg', 'folate_ug'],
  ['vitB12Ug', 'vit_b12_ug'],
  ['cholineMg', 'choline_mg'],
  ['caffeineMg', 'caffeine_mg'],
] as const;

const zFoodDetail = z.object({
  food_id: z.string(),
  name: z.string(),
  name_zh: z.string().nullable(),
  name_en: z.string().nullable(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  barcode: z.string().nullable(),
  source: z.object({
    code: z.string(),
    name: z.string(),
    license: z.string(),
    attribution: z.string(),
    url: z.string().nullable(),
  }),
  data_type: zFoodDataType,
  status: z.enum(['active', 'retired']),
  verified: z.boolean(),
  edible_pct: z.number().nullable(),
  per_100g: z
    .record(z.number())
    .describe(
      'Per 100 g edible portion; only nutrients with data are present. Keys carry units, e.g. energy_kcal, protein_g, vit_b12_ug.',
    ),
  extras: z.unknown().describe('Long-tail nutrients as {key_with_unit: value}, or null'),
  trace_flags: z.unknown().describe('Nutrient keys recorded as trace amounts, or null'),
  portions: z.array(
    z.object({
      portion_id: z.string(),
      description: z.string(),
      gram_weight: z.number(),
    }),
  ),
  created_at: z.string(),
});

type FoodDetail = NonNullable<Awaited<ReturnType<typeof getFood>>>;

function toFoodDetail(food: FoodDetail): Record<string, unknown> {
  const per100g: Record<string, unknown> = {};
  if (food.nutrients) {
    for (const [column, key] of NUTRIENT_COLUMNS) {
      const value = food.nutrients[column];
      if (value !== null) per100g[key] = value;
    }
  }
  return {
    food_id: food.id,
    name: food.name,
    name_zh: food.nameZh,
    name_en: food.nameEn,
    brand: food.brand,
    category: food.category,
    barcode: food.barcode,
    source: {
      code: food.source.code,
      name: food.source.name,
      license: food.source.license,
      attribution: food.source.attributionText,
      url: food.source.attributionUrl,
    },
    data_type: food.dataType,
    status: food.status,
    verified: food.verified,
    edible_pct: food.ediblePct,
    per_100g: per100g,
    extras: food.nutrients?.extras ?? null,
    trace_flags: food.nutrients?.traceFlags ?? null,
    portions: food.portions.map((p) => ({
      portion_id: p.id,
      description: p.description,
      gram_weight: p.gramWeight,
    })),
    created_at: food.createdAt,
  };
}

function parseFoodId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new ToolError('VALIDATION', 'food_id must be a numeric string');
  }
}

export const foodTools: AnyToolDef[] = [
  {
    name: 'search_foods',
    title: 'Search foods',
    description:
      'Search the food library by keyword or by barcode — provide exactly one of query/barcode. ' +
      'Call this to find a food and its per-100g macros before logging a meal or fetching full details with get_food. ' +
      'Chinese keywords mainly match the China Food Composition Tables (source cfct); USDA and Open Food Facts entries are English-language data, ' +
      'so translate the keyword to English and search again when Chinese yields nothing (and vice versa). ' +
      'For packaged products, look up by the barcode parameter.',
    inputSchema: {
      query: z.string().min(1).max(100).optional().describe('Keyword(s); mutually exclusive with barcode'),
      barcode: z.string().min(6).max(20).optional().describe('Exact product barcode (EAN/UPC); mutually exclusive with query'),
      source: zFoodSource.optional().describe('Restrict to one data source'),
      data_type: zFoodDataType.optional(),
      limit: zSearchLimit,
      cursor: zCursor.optional(),
    },
    outputSchema: {
      items: z.array(
        z.object({
          food_id: z.string(),
          name: z.string(),
          name_zh: z.string().nullable(),
          name_en: z.string().nullable(),
          brand: z.string().nullable(),
          barcode: z.string().nullable(),
          source: zFoodSource,
          data_type: zFoodDataType,
          verified: z.boolean(),
          per_100g: z.object({
            energy_kcal: z.number().nullable(),
            protein_g: z.number().nullable(),
            carb_g: z.number().nullable(),
            fat_g: z.number().nullable(),
          }),
          has_portions: z.boolean(),
        }),
      ),
      next_cursor: z.string().optional(),
    },
    // TODO(M3): on a barcode miss, fall back to the Open Food Facts API and
    // cache the hit — openWorldHint is already true for that future behavior.
    annotations: { readOnlyHint: true, openWorldHint: true },
    requiredScopes: [SCOPES.FOOD],
    handler: async (input, ctx) => {
      const hasQuery = input.query !== undefined;
      const hasBarcode = input.barcode !== undefined;
      if (hasQuery === hasBarcode) {
        throw new ToolError('VALIDATION', 'provide exactly one of "query" or "barcode"');
      }

      // Offset-style cursor: keyset gains little under fulltext relevance order.
      let offset = 0;
      if (input.cursor) {
        const [decoded] = decodeCursor(input.cursor);
        if (typeof decoded !== 'number' || !Number.isInteger(decoded) || decoded < 0) {
          throw new ToolError('VALIDATION', 'invalid cursor');
        }
        offset = decoded;
      }

      const { rows, hasMore } = await searchFoods(ctx.userId, {
        query: input.query,
        barcode: input.barcode,
        sourceCode: input.source,
        dataType: input.data_type,
        limit: input.limit,
        offset,
      });

      return {
        items: rows.map((r) => ({
          food_id: r.id,
          name: r.name,
          name_zh: r.nameZh,
          name_en: r.nameEn,
          brand: r.brand,
          barcode: r.barcode,
          source: r.sourceCode,
          data_type: r.dataType,
          verified: r.verified,
          per_100g: {
            energy_kcal: r.energyKcal,
            protein_g: r.proteinG,
            carb_g: r.carbG,
            fat_g: r.fatG,
          },
          has_portions: r.hasPortions,
        })),
        ...(hasMore ? { next_cursor: encodeCursor([offset + input.limit]) } : {}),
      };
    },
  },
  {
    name: 'get_food',
    title: 'Get food details',
    description:
      'Fetch one food by id with every recorded per-100g nutrient, portion sizes with gram weights, and source attribution. ' +
      'Call after search_foods when full nutrient data is needed, e.g. to compute the intake snapshot for a diet log entry. ' +
      'A retired status means the entry was removed upstream but is kept readable for existing logs.',
    inputSchema: {
      food_id: zId.describe('Food id from search_foods or a diet log entry'),
    },
    outputSchema: {
      food: zFoodDetail,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    requiredScopes: [SCOPES.FOOD],
    handler: async (input, ctx) => {
      const food = await getFood(ctx.userId, parseFoodId(input.food_id));
      if (!food) throw new ToolError('NOT_FOUND', 'food not found');
      return { food: toFoodDetail(food) };
    },
  },
  {
    name: 'create_food',
    title: 'Create custom food',
    description:
      'Create a custom food entry, private to the current user. ' +
      'Only call this after search_foods (including translated keywords and barcode) finds no match in any of the three data sources — never duplicate library foods. ' +
      'Nutrient values are per 100 g edible portion.',
    inputSchema: {
      name: z.string().min(1).max(255).describe('Display name'),
      name_zh: z.string().max(255).optional(),
      name_en: z.string().max(255).optional(),
      brand: z.string().max(255).optional(),
      aliases: z.array(z.string().max(100)).max(20).optional().describe('Synonyms to improve keyword search'),
      category: z.string().max(100).optional(),
      per_100g: zPer100gNutrients.describe('Nutrients per 100 g edible portion'),
      portions: z
        .array(
          z.object({
            description: z.string().min(1).max(255).describe('e.g. "1 cup, diced" / "1碗"'),
            gram_weight: z.number().positive().max(10000),
          }),
        )
        .max(10)
        .optional(),
    },
    outputSchema: {
      food: zFoodDetail,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    requiredScopes: [SCOPES.FOOD],
    handler: async (input, ctx) => {
      const p = input.per_100g;
      const food = await createCustomFood(ctx.userId, {
        name: input.name,
        nameZh: input.name_zh,
        nameEn: input.name_en,
        brand: input.brand,
        category: input.category,
        aliases: input.aliases,
        per100g: {
          energyKcal: p.energy_kcal,
          proteinG: p.protein_g,
          fatG: p.fat_g,
          carbG: p.carb_g,
          fiberG: p.fiber_g,
          sugarsG: p.sugars_g,
          satFatG: p.sat_fat_g,
          sodiumMg: p.sodium_mg,
          potassiumMg: p.potassium_mg,
          calciumMg: p.calcium_mg,
          ironMg: p.iron_mg,
          cholesterolMg: p.cholesterol_mg,
        },
        portions: input.portions?.map((x: { description: string; gram_weight: number }) => ({
          description: x.description,
          gramWeight: x.gram_weight,
        })),
      });
      return { food: toFoodDetail(food) };
    },
  },
];
