// Row-level normalization for the USDA FDC pipeline: raw CSV rows → the
// NormalizedFood shape consumed by etl/lib/batch.ts. Pure logic — no I/O.
//
// CSV shapes handled (verified against the 2018-04/2026-04-30/2024-10-31
// packages, all three share the same core table columns):
//   food.csv          fdc_id, data_type, description, food_category_id, publication_date
//   nutrient.csv      id, name, unit_name, nutrient_nbr, rank
//   food_nutrient.csv id, fdc_id, nutrient_id, amount, ...
//   food_portion.csv  id, fdc_id, seq_num, amount, measure_unit_id,
//                     portion_description, modifier, gram_weight, ...
import type { NormalizedFood, NormalizedPortion } from '../lib/batch';
import type { CsvRow } from '../lib/csv';
import {
  FDC_ID_WHITELIST,
  NUTRIENTS,
  NUTRIENT_COLUMNS,
  resolveFdcEnergy,
  round3,
  type NutrientColumn,
  type NutrientSpec,
} from '../lib/nutrients';
import type { UsdaDatasetKey } from './config';

// ---------------------------------------------------------------------------
// nutrient.csv dictionary validation (fail fast before touching food data)
// ---------------------------------------------------------------------------

/** Expected nutrient.csv unit_name (uppercased) for every whitelisted id. */
function expectedUnits(): Map<number, string> {
  const expected = new Map<number, string>();
  for (const column of NUTRIENT_COLUMNS) {
    // Widen from the `as const` literal shape so fdcKjId is visible.
    const spec: NutrientSpec = NUTRIENTS[column];
    for (const id of spec.fdcIds) expected.set(id, spec.unit.toUpperCase());
    if (spec.fdcKjId !== undefined) expected.set(spec.fdcKjId, 'KJ');
  }
  return expected;
}

/**
 * Verify that every whitelisted FDC nutrient id exists in the package's
 * nutrient.csv with the unit our canonical columns assume (FDC units match
 * the canonical column units 1:1, so amounts are taken without conversion —
 * this check is what makes that safe). Throws on any mismatch.
 */
export function validateNutrientDictionary(rows: CsvRow[], datasetLabel: string): void {
  const unitById = new Map<number, string>();
  for (const row of rows) {
    const id = Number(row.id);
    if (Number.isFinite(id)) unitById.set(id, (row.unit_name ?? '').trim().toUpperCase());
  }
  const problems: string[] = [];
  for (const [id, expected] of expectedUnits()) {
    const actual = unitById.get(id);
    if (actual === undefined) problems.push(`id ${id} missing`);
    else if (actual !== expected) problems.push(`id ${id} unit ${actual} (expected ${expected})`);
  }
  if (problems.length > 0) {
    throw new Error(`nutrient.csv validation failed for ${datasetLabel}: ${problems.join('; ')}`);
  }
  if (FDC_ID_WHITELIST.size !== expectedUnits().size) {
    // Sanity: the whitelist and the expected-unit map must cover the same ids.
    throw new Error('FDC_ID_WHITELIST out of sync with NUTRIENTS specs');
  }
}

// ---------------------------------------------------------------------------
// Draft assembly (index.ts streams rows into these)
// ---------------------------------------------------------------------------

export interface FoodDraft {
  fdcId: string;
  description: string;
  foodCategoryId: string;
  publicationDate: string;
  /** nutrientId → per-100g amount (whitelisted ids only, last row wins). */
  nutrientAmounts: Map<number, number>;
  portions: NormalizedPortion[];
}

/**
 * Build a draft from a food.csv row, or null when the row is not this
 * dataset's food type (Foundation packages mix in sub_sample/market rows) or
 * lacks an id/description (counted as rejected by the caller).
 */
export function draftFromFoodRow(
  row: CsvRow,
  fdcDataType: string,
): { draft: FoodDraft } | { rejected: true } | null {
  if ((row.data_type ?? '').trim() !== fdcDataType) return null;
  const fdcId = (row.fdc_id ?? '').trim();
  const description = (row.description ?? '').trim();
  if (!fdcId || !description) return { rejected: true };
  return {
    draft: {
      fdcId,
      description,
      foodCategoryId: (row.food_category_id ?? '').trim(),
      publicationDate: (row.publication_date ?? '').trim(),
      nutrientAmounts: new Map(),
      portions: [],
    },
  };
}

/**
 * Map raw food_nutrient.nutrient_id tokens to canonical FDC nutrient ids.
 * Quirk (verified in the 2024-10-31 survey package): FNDDS food_nutrient.csv
 * stores legacy *nutrient numbers* (nutrient.csv nutrient_nbr, e.g. 301 for
 * Calcium) in its nutrient_id column, while SR Legacy / Foundation store the
 * real FDC ids (e.g. 1087). Real ids are all >= 1002 and nutrient_nbr values
 * of our whitelist are all < 1000, so mapping both namespaces at once is
 * collision-free; exact ids still win by being inserted last.
 */
export function buildNutrientIdResolver(nutrientRows: CsvRow[]): Map<string, number> {
  const resolver = new Map<string, number>();
  for (const row of nutrientRows) {
    const id = Number((row.id ?? '').trim());
    if (!FDC_ID_WHITELIST.has(id)) continue;
    const nbr = (row.nutrient_nbr ?? '').trim();
    if (nbr) resolver.set(nbr, id);
  }
  for (const id of FDC_ID_WHITELIST) resolver.set(String(id), id);
  return resolver;
}

/** Fold a food_nutrient.csv row into its draft (whitelist filter inside). */
export function addNutrientAmount(
  draft: FoodDraft,
  row: CsvRow,
  resolver: Map<string, number>,
): void {
  const nutrientId = resolver.get((row.nutrient_id ?? '').trim());
  if (nutrientId === undefined) return;
  const raw = (row.amount ?? '').trim();
  if (raw === '') return; // missing amount stays NULL, never 0
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return;
  draft.nutrientAmounts.set(nutrientId, amount);
}

export interface PortionContext {
  /** measure_unit.csv id → name (excluding the 9999 "undetermined" row). */
  measureUnitNames: Map<string, string>;
  /** FNDDS puts the full portion text in portion_description, not modifier. */
  isFndds: boolean;
}

/**
 * Fold a food_portion.csv row into its draft. Returns false when dropped
 * (gram_weight <= 0, e.g. FNDDS "Quantity not specified" rows).
 *
 * measure_unit_id = 9999 means "undetermined": the human-readable unit text
 * then lives in `modifier` for SR Legacy ("cup, diced") but in
 * `portion_description` for FNDDS ("1 cup" — already includes the amount,
 * and the amount column is empty). Foundation rows use real measure_unit
 * ids with `modifier` as a qualifier ("raw").
 */
export function addPortion(draft: FoodDraft, row: CsvRow, ctx: PortionContext): boolean {
  const gramWeight = Number((row.gram_weight ?? '').trim());
  if (!Number.isFinite(gramWeight) || gramWeight <= 0) return false;

  const measureUnitId = (row.measure_unit_id ?? '').trim();
  const modifier = (row.modifier ?? '').trim();
  const amountRaw = (row.amount ?? '').trim();
  const amountNum = Number(amountRaw);
  const amountText = amountRaw !== '' && Number.isFinite(amountNum) ? String(amountNum) : '';

  let unitText: string;
  let qualifier = '';
  const unitName = measureUnitId === '' ? undefined : ctx.measureUnitNames.get(measureUnitId);
  if (unitName === undefined || measureUnitId === '9999') {
    unitText = ctx.isFndds ? (row.portion_description ?? '').trim() : modifier;
  } else {
    unitText = unitName;
    qualifier = modifier;
  }

  const description = [amountText, unitText || 'portion', qualifier]
    .filter(Boolean)
    .join(' ')
    .slice(0, 255);

  const seqRaw = Number((row.seq_num ?? '').trim());
  const seq = Number.isFinite(seqRaw) && seqRaw > 0 ? seqRaw : draft.portions.length + 1;

  draft.portions.push({
    description,
    gramWeight,
    seq,
    sourcePortionId: (row.id ?? '').trim() || undefined,
  });
  return true;
}

// ---------------------------------------------------------------------------
// Finalization
// ---------------------------------------------------------------------------

export interface FinalizeOptions {
  datasetKey: UsdaDatasetKey;
  /** food.csv data_type value, stored in sourceMeta.fdcDataType. */
  fdcDataType: string;
  /** Resolved category description (food_category / WWEIA), or null. */
  category: string | null;
  /** FNDDS 8-digit food code, when known. */
  foodCode?: string;
}

/**
 * Turn a fully-fed draft into a NormalizedFood. Energy goes through
 * resolveFdcEnergy (1008 → 2047 → 2048 → 1062 kJ / 4.184 — Foundation foods
 * have no 1008, only the Atwater ids, so the fallback chain is mandatory);
 * all other columns take the first present id of their spec, unconverted
 * (units validated against nutrient.csv upfront). Values are rounded to the
 * Decimal(9,3) column precision so contentHash matches what the DB stores.
 */
export function finalizeFood(draft: FoodDraft, opts: FinalizeOptions): NormalizedFood {
  const nutrients: Partial<Record<NutrientColumn, number>> = {};
  const energy = resolveFdcEnergy(draft.nutrientAmounts);
  if (energy !== null) nutrients.energyKcal = round3(energy);
  for (const column of NUTRIENT_COLUMNS) {
    if (column === 'energyKcal') continue;
    for (const id of NUTRIENTS[column].fdcIds) {
      const amount = draft.nutrientAmounts.get(id);
      if (amount !== undefined) {
        nutrients[column] = round3(amount);
        break;
      }
    }
  }

  const portions = [...draft.portions].sort(
    (a, b) => a.seq - b.seq || (a.sourcePortionId ?? '').localeCompare(b.sourcePortionId ?? ''),
  );

  // The single-data-type CSV packages carry no scientific_name column
  // (unlike the JSON/API shape), so sourceMeta.scientificName is omitted.
  const sourceMeta: Record<string, unknown> = { fdcDataType: opts.fdcDataType };
  if (draft.publicationDate) sourceMeta.publicationDate = draft.publicationDate;
  if (opts.foodCode) sourceMeta.foodCode = opts.foodCode;

  return {
    sourceKey: draft.fdcId,
    dataType: opts.datasetKey,
    // name IS the English description; nameEn stays null to avoid doubling
    // every token in searchText (buildSearchText concatenates both).
    name: draft.description.slice(0, 512),
    category: opts.category ? opts.category.slice(0, 255) : null,
    nutrients,
    portions,
    sourceMeta,
  };
}
