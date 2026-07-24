// Canonical nutrient mapping — the single source of truth linking the
// food_nutrients columns (unit baked into the name, always per 100 g edible
// portion) to the identifiers used by each upstream dataset:
//   - fdcIds:  USDA FoodData Central nutrient ids, in priority order.
//   - off:     Open Food Facts nutriments key (per-100g value lives under
//              `${off}_100g`, the per-value unit under `${off}_unit`).
//   - cfct:    column name in the CFCT (China Food Composition Table) intake
//              template.
// A `null` mapping means the dataset does not provide that nutrient (or we
// deliberately do not capture it). Missing values stay NULL — never 0.

export type TargetUnit = 'g' | 'mg' | 'ug' | 'kcal';

export interface NutrientSpec {
  /** Unit baked into the food_nutrients column name. */
  readonly unit: TargetUnit;
  /** USDA FDC nutrient ids in priority order (first present wins). */
  readonly fdcIds: readonly number[];
  /** FDC id carrying the same quantity in kJ (energy only). */
  readonly fdcKjId?: number;
  /** Open Food Facts nutriments base key, or null when not captured. */
  readonly off: string | null;
  /** OFF key whose value is in kJ (energy only). */
  readonly offKjKey?: string;
  /** CFCT template column name, or null when CFCT has no such column. */
  readonly cfct: string | null;
}

export const NUTRIENTS = {
  // Macros & energy -------------------------------------------------------
  energyKcal: {
    unit: 'kcal',
    // 1008 Energy (kcal) → 2047 Energy, Atwater general → 2048 Atwater
    // specific → 1062 Energy (kJ) ÷ 4.184 as the last resort.
    fdcIds: [1008, 2047, 2048],
    fdcKjId: 1062,
    off: 'energy-kcal',
    offKjKey: 'energy',
    cfct: 'energy_kcal',
  },
  proteinG: { unit: 'g', fdcIds: [1003], off: 'proteins', cfct: 'protein_g' },
  fatG: { unit: 'g', fdcIds: [1004], off: 'fat', cfct: 'fat_g' },
  carbG: { unit: 'g', fdcIds: [1005], off: 'carbohydrates', cfct: 'carbohydrate_g' },
  fiberG: { unit: 'g', fdcIds: [1079], off: 'fiber', cfct: 'fiber_g' },
  sugarsG: { unit: 'g', fdcIds: [2000], off: 'sugars', cfct: null },
  waterG: { unit: 'g', fdcIds: [1051], off: null, cfct: 'water_g' },
  // OFF reports alcohol as % vol, not g/100g — not captured in phase 1.
  alcoholG: { unit: 'g', fdcIds: [1018], off: null, cfct: null },
  cholesterolMg: { unit: 'mg', fdcIds: [1253], off: 'cholesterol', cfct: 'cholesterol_mg' },

  // Fat breakdown ----------------------------------------------------------
  satFatG: { unit: 'g', fdcIds: [1258], off: 'saturated-fat', cfct: null },
  mufaG: { unit: 'g', fdcIds: [1292], off: 'monounsaturated-fat', cfct: null },
  pufaG: { unit: 'g', fdcIds: [1293], off: 'polyunsaturated-fat', cfct: null },
  transFatG: { unit: 'g', fdcIds: [1257], off: 'trans-fat', cfct: null },

  // Minerals ---------------------------------------------------------------
  // OFF fallback: when `sodium` is absent use `salt` ÷ 2.5 (see
  // saltToSodiumMg) — handled at the pipeline layer.
  sodiumMg: { unit: 'mg', fdcIds: [1093], off: 'sodium', cfct: 'na_mg' },
  calciumMg: { unit: 'mg', fdcIds: [1087], off: 'calcium', cfct: 'ca_mg' },
  ironMg: { unit: 'mg', fdcIds: [1089], off: 'iron', cfct: 'fe_mg' },
  potassiumMg: { unit: 'mg', fdcIds: [1092], off: 'potassium', cfct: 'k_mg' },
  magnesiumMg: { unit: 'mg', fdcIds: [1090], off: 'magnesium', cfct: 'mg_mg' },
  phosphorusMg: { unit: 'mg', fdcIds: [1091], off: 'phosphorus', cfct: 'p_mg' },
  zincMg: { unit: 'mg', fdcIds: [1095], off: 'zinc', cfct: 'zn_mg' },
  copperMg: { unit: 'mg', fdcIds: [1098], off: 'copper', cfct: 'cu_mg' },
  manganeseMg: { unit: 'mg', fdcIds: [1101], off: 'manganese', cfct: 'mn_mg' },
  seleniumUg: { unit: 'ug', fdcIds: [1103], off: 'selenium', cfct: 'se_ug' },

  // Vitamins ---------------------------------------------------------------
  vitAUgRae: { unit: 'ug', fdcIds: [1106], off: 'vitamin-a', cfct: 'vit_a_ug_rae' },
  caroteneUg: { unit: 'ug', fdcIds: [1107], off: null, cfct: 'carotene_ug' },
  retinolUg: { unit: 'ug', fdcIds: [1105], off: null, cfct: 'retinol_ug' },
  vitCMg: { unit: 'mg', fdcIds: [1162], off: 'vitamin-c', cfct: 'vit_c_mg' },
  vitDUg: { unit: 'ug', fdcIds: [1114], off: 'vitamin-d', cfct: null }, // D2 + D3
  vitEMg: { unit: 'mg', fdcIds: [1109], off: 'vitamin-e', cfct: 'vit_e_mg' }, // alpha-TE
  vitKUg: { unit: 'ug', fdcIds: [1185], off: 'vitamin-k', cfct: null },
  thiaminMg: { unit: 'mg', fdcIds: [1165], off: 'vitamin-b1', cfct: 'thiamin_mg' },
  riboflavinMg: { unit: 'mg', fdcIds: [1166], off: 'vitamin-b2', cfct: 'riboflavin_mg' },
  niacinMg: { unit: 'mg', fdcIds: [1167], off: 'vitamin-pp', cfct: 'niacin_mg' },
  pantothenicMg: { unit: 'mg', fdcIds: [1170], off: 'pantothenic-acid', cfct: null },
  vitB6Mg: { unit: 'mg', fdcIds: [1175], off: 'vitamin-b6', cfct: null },
  folateUg: { unit: 'ug', fdcIds: [1177], off: 'vitamin-b9', cfct: null }, // folate, total
  vitB12Ug: { unit: 'ug', fdcIds: [1178], off: 'vitamin-b12', cfct: null },

  // Other ------------------------------------------------------------------
  cholineMg: { unit: 'mg', fdcIds: [1180], off: 'choline', cfct: null },
  caffeineMg: { unit: 'mg', fdcIds: [1057], off: 'caffeine', cfct: null },
} as const satisfies Record<string, NutrientSpec>;

/** A food_nutrients numeric column name. */
export type NutrientColumn = keyof typeof NUTRIENTS;

/** All nutrient columns in declaration order (stable for SQL generation). */
export const NUTRIENT_COLUMNS = Object.keys(NUTRIENTS) as NutrientColumn[];

/**
 * The 12 core nutrients whose non-NULL ratio defines food.completeness
 * (Decimal(3,2)).
 */
export const COMPLETENESS_COLUMNS: readonly NutrientColumn[] = [
  'energyKcal',
  'proteinG',
  'fatG',
  'carbG',
  'fiberG',
  'sugarsG',
  'sodiumMg',
  'calciumMg',
  'ironMg',
  'potassiumMg',
  'vitCMg',
  'cholesterolMg',
];

/** Every FDC nutrient id the USDA pipeline should keep (incl. kJ energy). */
export const FDC_ID_WHITELIST: Set<number> = new Set(
  Object.values(NUTRIENTS).flatMap((spec: NutrientSpec) => [
    ...spec.fdcIds,
    ...(spec.fdcKjId !== undefined ? [spec.fdcKjId] : []),
  ]),
);

const KJ_PER_KCAL = 4.184;

/** Round to 3 decimals — matches the Decimal(9,3) column precision. */
export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Thermochemical kJ → kcal, rounded to 3 decimals. */
export function kjToKcal(kj: number): number {
  return round3(kj / KJ_PER_KCAL);
}

/**
 * OFF fallback when only `salt_100g` (g) is present:
 * sodium(mg) = salt(g) ÷ 2.5 × 1000.
 */
export function saltToSodiumMg(saltG: number): number {
  return round3((saltG / 2.5) * 1000);
}

/**
 * Pick the energy value (kcal) from an FDC nutrientId → amount map.
 * Priority: 1008 (Energy kcal) → 2047 (Atwater general) → 2048 (Atwater
 * specific) → 1062 (Energy kJ) converted at 4.184 kJ/kcal.
 */
export function resolveFdcEnergy(nutrientMap: Map<number, number>): number | null {
  for (const id of NUTRIENTS.energyKcal.fdcIds) {
    const kcal = nutrientMap.get(id);
    if (kcal !== undefined) return kcal;
  }
  const kj = nutrientMap.get(NUTRIENTS.energyKcal.fdcKjId);
  if (kj !== undefined) return kjToKcal(kj);
  return null;
}

// Mass factors expressed in micrograms so every ratio between two units is an
// exact integer one way (avoids float dust like 1e-6/1e-3).
const UG_PER_UNIT: Record<string, number> = {
  kg: 1_000_000_000,
  g: 1_000_000,
  mg: 1_000,
  ug: 1,
};

function normalizeUnit(unit: string): string {
  const lower = unit.trim().toLowerCase().replace(/[µμ]/g, 'u');
  return lower === 'mcg' ? 'ug' : lower;
}

/**
 * Convert an OFF nutriments value from its row-level unit to the canonical
 * column unit. Returns null when the unit cannot be converted (unknown unit,
 * IU, or an energy/mass mismatch). A missing/empty unit means the value is
 * assumed to already be in the target unit. Negative values pass through —
 * rejecting them is the caller's job.
 */
export function offUnitConvert(
  value: number,
  unit: string | undefined,
  targetUnit: TargetUnit,
): number | null {
  if (!Number.isFinite(value)) return null;
  if (unit === undefined || unit.trim() === '') return value;
  const from = normalizeUnit(unit);
  // IU depends on the compound (vitamin A vs D vs E) — never captured.
  if (from === 'iu') return null;

  if (targetUnit === 'kcal') {
    if (from === 'kcal') return value;
    if (from === 'kj') return kjToKcal(value);
    return null;
  }

  const fromUg = UG_PER_UNIT[from];
  const toUg = UG_PER_UNIT[targetUnit];
  if (fromUg === undefined || toUg === undefined) return null;
  // One of the two ratios is an exact integer; prefer it for precision.
  return fromUg >= toUg ? value * (fromUg / toUg) : value / (toUg / fromUg);
}
