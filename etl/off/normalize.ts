// Open Food Facts API v2 `product` object → NormalizedFood.
//
// Shared by the ETL pipeline and the Next.js runtime barcode fallback
// (src/lib/off-api.ts). This module must stay pure: it may only depend on
// etl/lib/nutrients.ts and type-only imports — never mysql2/db or any I/O —
// so src/ can import it by relative path without dragging ETL runtime deps
// into the app bundle.
//
// OFF nutriments semantics (verified against the live v2 API, 2026-07):
//   - `<key>_100g` is the per-100g value in the unit given by `<key>_unit`
//     (e.g. caffeine_100g=0.032 with caffeine_unit="g" → 32 mg).
//   - `energy_100g` / `energy-kj_100g` are served in kJ with their own
//     `_unit`; `energy-kcal_100g` is in kcal.
import type { NormalizedFood, NormalizedPortion } from '../lib/batch';
import {
  NUTRIENTS,
  NUTRIENT_COLUMNS,
  type NutrientColumn,
  type TargetUnit,
  offUnitConvert,
  round3,
  saltToSodiumMg,
} from '../lib/nutrients';

/** Relative kcal-vs-kJ disagreement above which Atwater arbitration kicks in. */
const ENERGY_CONFLICT_TOLERANCE = 0.05;

/** Core bounds — violating any of these rejects the whole product (null). */
const MACRO_MAX_G = 100; // protein / fat / carb per 100 g
const ENERGY_MAX_KCAL = 900; // pure fat is ~900 kcal/100 g

// Physiological plausibility caps per 100 g, in the column's unit. These are
// generous order-of-magnitude sanity bounds (aligned with zPer100gNutrients
// where it defines one), not tight validation — a violated secondary value is
// dropped to NULL, never rejects the product.
const SECONDARY_CAPS: Partial<Record<NutrientColumn, number>> = {
  fiberG: 100,
  sugarsG: 100,
  satFatG: 100,
  mufaG: 100,
  pufaG: 100,
  transFatG: 100,
  cholesterolMg: 10000,
  sodiumMg: 40000, // pure salt is 40 g sodium / 100 g
  calciumMg: 10000,
  ironMg: 1000,
  potassiumMg: 20000,
  magnesiumMg: 5000,
  phosphorusMg: 10000,
  zincMg: 1000,
  copperMg: 100,
  manganeseMg: 100,
  seleniumUg: 10000,
  vitAUgRae: 100000,
  vitCMg: 10000,
  vitDUg: 1000,
  vitEMg: 1000,
  vitKUg: 10000,
  thiaminMg: 500,
  riboflavinMg: 500,
  niacinMg: 1000,
  pantothenicMg: 500,
  vitB6Mg: 500,
  folateUg: 50000,
  vitB12Ug: 5000,
  cholineMg: 5000,
  caffeineMg: 20000, // instant coffee powder is ~3000 mg/100 g; guarana higher
};

type Nutriments = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** OFF serves most numbers as numbers, but some legacy fields as strings. */
function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Read `<baseKey>_100g` + `<baseKey>_unit` and convert to the target column
 * unit. `defaultUnit` covers keys whose implied unit is not the column unit
 * (the kJ energy keys); everywhere else a missing unit means "already in the
 * column unit" (offUnitConvert's contract).
 */
function readNutriment(
  nutriments: Nutriments,
  baseKey: string,
  target: TargetUnit,
  defaultUnit?: string,
): number | null {
  const value = asFiniteNumber(nutriments[`${baseKey}_100g`]);
  if (value === null) return null;
  const unitRaw = nutriments[`${baseKey}_unit`];
  const unit = typeof unitRaw === 'string' && unitRaw.trim() !== '' ? unitRaw : defaultUnit;
  return offUnitConvert(value, unit, target);
}

/**
 * Resolve energy in kcal. When the kcal and kJ keys coexist and disagree by
 * more than 5%, recompute via Atwater (4·protein + 9·fat + 4·carb) and keep
 * whichever candidate is closer; without full macros the dedicated kcal key
 * wins.
 */
function resolveEnergyKcal(
  nutriments: Nutriments,
  macros: { protein: number | null; fat: number | null; carb: number | null },
): number | null {
  const kcal = readNutriment(nutriments, NUTRIENTS.energyKcal.off as string, 'kcal', 'kcal');
  // `energy-kj` is the explicit kJ pair; `energy` (offKjKey) is the legacy
  // alias the server also fills — both default to kJ when the unit is absent.
  const kjAsKcal =
    readNutriment(nutriments, 'energy-kj', 'kcal', 'kJ') ??
    readNutriment(nutriments, NUTRIENTS.energyKcal.offKjKey as string, 'kcal', 'kJ');

  if (kcal === null || kjAsKcal === null) return kcal ?? kjAsKcal;

  const scale = Math.max(Math.abs(kcal), Math.abs(kjAsKcal));
  if (scale === 0 || Math.abs(kcal - kjAsKcal) / scale <= ENERGY_CONFLICT_TOLERANCE) {
    return kcal;
  }
  const { protein, fat, carb } = macros;
  if (protein === null || fat === null || carb === null) return kcal;
  const atwater = 4 * protein + 9 * fat + 4 * carb;
  return Math.abs(kcal - atwater) <= Math.abs(kjAsKcal - atwater) ? kcal : kjAsKcal;
}

function buildPortions(product: Record<string, unknown>): NormalizedPortion[] {
  const quantity = asFiniteNumber(product['serving_quantity']);
  if (quantity === null || quantity <= 0 || quantity > 10000) return [];
  // Only a gram-denominated serving becomes a portion: an absent unit means
  // grams in OFF's normalized field; "ml" and friends would need a density
  // estimate, which Kolo never does.
  const unitRaw = product['serving_quantity_unit'];
  if (typeof unitRaw === 'string' && unitRaw.trim() !== '') {
    const unit = unitRaw.trim().toLowerCase();
    if (unit !== 'g' && unit !== 'gram' && unit !== 'grams') return [];
  }
  const description = asString(product['serving_size']) ?? `${quantity} g`;
  return [
    {
      seq: 0,
      description: truncate(description, 255),
      gramWeight: Math.round(quantity * 100) / 100,
    },
  ];
}

/**
 * Normalize one OFF API v2 `product` object. Returns null when the product is
 * unusable as a whole: no name, no barcode, or a core value (macro out of
 * [0, 100] g, energy outside (0, 900] kcal) fails validation. Secondary
 * values that fail their own bounds are dropped to NULL individually.
 */
export function normalizeOffProduct(
  product: unknown,
  fallbackBarcode?: string,
): NormalizedFood | null {
  if (product === null || typeof product !== 'object' || Array.isArray(product)) return null;
  const p = product as Record<string, unknown>;

  const code = asString(p['code']) ?? asString(fallbackBarcode);
  if (code === null) return null;

  const productName = asString(p['product_name']);
  const nameEn = asString(p['product_name_en']);
  const name = productName ?? nameEn;
  if (name === null) return null;
  const nameZh = asString(p['product_name_zh']);

  const brandsRaw = asString(p['brands']);
  const brand = brandsRaw === null ? null : asString(brandsRaw.split(',')[0]);

  let category: string | null = null;
  const categoriesTags = p['categories_tags'];
  if (Array.isArray(categoriesTags) && categoriesTags.length > 0) {
    const last = asString(categoriesTags[categoriesTags.length - 1]);
    if (last !== null) category = last.startsWith('en:') ? last.slice(3) : last;
  }

  const nutrimentsRaw = p['nutriments'];
  const nutriments: Nutriments =
    nutrimentsRaw !== null && typeof nutrimentsRaw === 'object' && !Array.isArray(nutrimentsRaw)
      ? (nutrimentsRaw as Nutriments)
      : {};

  // --- Core values: any violation rejects the whole product. ---------------
  const protein = readNutriment(nutriments, NUTRIENTS.proteinG.off as string, 'g');
  const fat = readNutriment(nutriments, NUTRIENTS.fatG.off as string, 'g');
  const carb = readNutriment(nutriments, NUTRIENTS.carbG.off as string, 'g');
  for (const macro of [protein, fat, carb]) {
    if (macro !== null && (macro < 0 || macro > MACRO_MAX_G)) return null;
  }
  const energy = resolveEnergyKcal(nutriments, { protein, fat, carb });
  // 0 kcal is legitimate (water, zero-sugar drinks) — only negative or
  // impossible densities reject the product.
  if (energy !== null && (energy < 0 || energy > ENERGY_MAX_KCAL)) return null;

  const nutrients: Partial<Record<NutrientColumn, number>> = {};
  if (energy !== null) nutrients.energyKcal = round3(energy);
  if (protein !== null) nutrients.proteinG = round3(protein);
  if (fat !== null) nutrients.fatG = round3(fat);
  if (carb !== null) nutrients.carbG = round3(carb);

  // --- Secondary values: violations drop the field, never the product. -----
  for (const column of NUTRIENT_COLUMNS) {
    if (column in nutrients || column === 'energyKcal') continue;
    const spec = NUTRIENTS[column];
    if (spec.off === null) continue;
    const value = readNutriment(nutriments, spec.off, spec.unit);
    if (value === null) continue;
    const cap = SECONDARY_CAPS[column];
    if (value < 0 || (cap !== undefined && value > cap)) continue;
    nutrients[column] = round3(value);
  }

  // OFF fallback: sodium from salt (÷ 2.5) only when sodium itself is absent.
  if (nutrients.sodiumMg === undefined) {
    const saltG = readNutriment(nutriments, 'salt', 'g');
    if (saltG !== null && saltG >= 0) {
      const sodiumMg = saltToSodiumMg(saltG);
      if (sodiumMg <= (SECONDARY_CAPS.sodiumMg as number)) nutrients.sodiumMg = sodiumMg;
    }
  }

  // Cross-field consistency (5% slack for label rounding).
  if (
    nutrients.sugarsG !== undefined &&
    nutrients.carbG !== undefined &&
    nutrients.sugarsG > nutrients.carbG * 1.05
  ) {
    delete nutrients.sugarsG;
  }
  if (
    nutrients.satFatG !== undefined &&
    nutrients.fatG !== undefined &&
    nutrients.satFatG > nutrients.fatG * 1.05
  ) {
    delete nutrients.satFatG;
  }

  return {
    sourceKey: code,
    dataType: 'off_api',
    name: truncate(name, 512),
    nameEn: nameEn === null ? null : truncate(nameEn, 512),
    nameZh: nameZh === null ? null : truncate(nameZh, 512),
    brand: brand === null ? null : truncate(brand, 255),
    category: category === null ? null : truncate(category, 255),
    barcode: truncate(code, 32),
    nutrients,
    portions: buildPortions(p),
  };
}
