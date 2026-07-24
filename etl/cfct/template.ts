// CFCT (China Food Composition Table) intake template: the row schema and the
// cell-parsing rules, codified once so the importer (index.ts) and the
// converter (from-sanotsu.ts) agree on what a valid row is. The CSV header in
// docs/cfct-template.csv is generated from CFCT_HEADER below.
//
// Cell conventions (mirroring how the printed book annotates values):
//   - '' / '—' / '–' / '-' / '－'  → null   (unmeasured — never 0)
//   - 'Tr' / 'tr'                  → 0, and the target column is recorded in
//                                    traceFlags (trace amount, stored as 0)
//   - everything else must be a plain ASCII non-negative decimal: in-line
//     units ("12g"), thousands separators ("1,234") and full-width digits
//     ("１２") are hard errors, never silently cleaned.
//
// Cross-field rules:
//   - food_code must match /^\d{6}$/ and food_name must be non-empty;
//   - protein_g / fat_g / carbohydrate_g are required (0 is a valid measured
//     value; blank means unmeasured and is rejected);
//   - at least one of energy_kcal / energy_kj is required; when both are
//     present they must agree within 5% of kcal × 4.184; when only one is
//     present the kcal value is derived from kJ (only kcal is persisted);
//   - edible_pct defaults to 100 and must lie in (0, 100].
import { z } from 'zod';
import { kjToKcal, NUTRIENTS, round3, type NutrientColumn } from '../lib/nutrients';

/** Column order of docs/cfct-template.csv — the single source of truth. */
export const CFCT_HEADER = [
  'food_code',
  'food_name',
  'food_name_en',
  'category',
  'edible_pct',
  'water_g',
  'energy_kcal',
  'energy_kj',
  'protein_g',
  'fat_g',
  'carbohydrate_g',
  'fiber_g',
  'cholesterol_mg',
  'ash_g',
  'vit_a_ug_rae',
  'carotene_ug',
  'retinol_ug',
  'thiamin_mg',
  'riboflavin_mg',
  'niacin_mg',
  'vit_c_mg',
  'vit_e_mg',
  'ca_mg',
  'p_mg',
  'k_mg',
  'na_mg',
  'mg_mg',
  'fe_mg',
  'zn_mg',
  'se_ug',
  'cu_mg',
  'mn_mg',
  'remark',
] as const;

export type CfctColumn = (typeof CFCT_HEADER)[number];

/**
 * CSV template column → food_nutrients column, derived from the canonical
 * nutrient table (every NUTRIENTS entry with a non-null `cfct` mapping).
 */
export const CFCT_NUTRIENT_MAP: ReadonlyMap<string, NutrientColumn> = new Map(
  (Object.entries(NUTRIENTS) as [NutrientColumn, { cfct: string | null }][]).flatMap(
    ([column, spec]) => (spec.cfct !== null ? [[spec.cfct, column] as const] : []),
  ),
);

/** Markers the printed table uses for "not measured". */
const NULL_MARKERS = new Set(['', '—', '–', '-', '－']);

const KJ_PER_KCAL = 4.184;
const ENERGY_TOLERANCE = 0.05;

interface NumericCell {
  value: number | null;
  trace: boolean;
}

function fail(ctx: z.RefinementCtx, message: string): typeof z.NEVER {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  return z.NEVER;
}

/** One numeric template cell — see the cell conventions at the top. */
function numericCell() {
  return z
    .string()
    .default('')
    .transform((raw, ctx): NumericCell => {
      const s = raw.trim();
      if (NULL_MARKERS.has(s)) return { value: null, trace: false };
      if (/^tr$/i.test(s)) return { value: 0, trace: true };
      if (/[０-９．－％]/.test(s)) {
        return fail(ctx, `full-width characters are not allowed — use ASCII digits (got "${s}")`);
      }
      if (/[,，]/.test(s)) {
        return fail(ctx, `thousands separators are not allowed — write the plain number (got "${s}")`);
      }
      if (/^\d+(\.\d+)?$/.test(s)) return { value: Number(s), trace: false };
      if (/^\d[\d.]*\s*\S+$/.test(s)) {
        return fail(ctx, `in-line units are not allowed — write the bare number (got "${s}")`);
      }
      return fail(ctx, `not a valid non-negative number (got "${s}")`);
    });
}

/** Optional free-text cell; blank collapses to null. */
const textCell = z
  .string()
  .default('')
  .transform((s) => {
    const t = s.trim();
    return t === '' ? null : t;
  });

/** Parsed, validated template row — units follow the column names. */
export interface CfctParsedRow {
  foodCode: string;
  foodName: string;
  foodNameEn: string | null;
  category: string | null;
  ediblePct: number;
  /** food_nutrients columns; energyKcal is derived from kJ when needed. */
  nutrients: Partial<Record<NutrientColumn, number>>;
  /** Columns whose source cell was 'Tr' (stored as 0); 'ash_g' for ash. */
  traceFlags: string[];
  /** Ash (g/100g) — goes to food_nutrients.extras, not a dedicated column. */
  ashG: number | null;
  /** Free-text remark — goes to food.sourceMeta. */
  remark: string | null;
}

export const cfctRowSchema = z
  .object({
    food_code: z
      .string()
      .default('')
      .transform((s) => s.trim())
      .refine((s) => /^\d{6}$/.test(s), 'food_code must be exactly 6 ASCII digits'),
    food_name: z
      .string()
      .default('')
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, 'food_name is required'),
    food_name_en: textCell,
    category: textCell,
    remark: textCell,
    edible_pct: numericCell(),
    water_g: numericCell(),
    energy_kcal: numericCell(),
    energy_kj: numericCell(),
    protein_g: numericCell(),
    fat_g: numericCell(),
    carbohydrate_g: numericCell(),
    fiber_g: numericCell(),
    cholesterol_mg: numericCell(),
    ash_g: numericCell(),
    vit_a_ug_rae: numericCell(),
    carotene_ug: numericCell(),
    retinol_ug: numericCell(),
    thiamin_mg: numericCell(),
    riboflavin_mg: numericCell(),
    niacin_mg: numericCell(),
    vit_c_mg: numericCell(),
    vit_e_mg: numericCell(),
    ca_mg: numericCell(),
    p_mg: numericCell(),
    k_mg: numericCell(),
    na_mg: numericCell(),
    mg_mg: numericCell(),
    fe_mg: numericCell(),
    zn_mg: numericCell(),
    se_ug: numericCell(),
    cu_mg: numericCell(),
    mn_mg: numericCell(),
  })
  .superRefine((row, ctx) => {
    // The three macros are mandatory: a measured zero must be written as 0,
    // a blank/'—' cell means unmeasured and cannot be imported.
    for (const column of ['protein_g', 'fat_g', 'carbohydrate_g'] as const) {
      if (row[column].value === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [column],
          message: 'required — write 0 for a measured zero; blank/— means unmeasured',
        });
      }
    }

    const kcal = row.energy_kcal.value;
    const kj = row.energy_kj.value;
    if (kcal === null && kj === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['energy_kcal'],
        message: 'at least one of energy_kcal / energy_kj is required',
      });
    } else if (kcal !== null && kj !== null) {
      const expectedKj = kcal * KJ_PER_KCAL;
      const mismatch = kj === 0 ? kcal !== 0 : Math.abs(kj - expectedKj) / kj > ENERGY_TOLERANCE;
      if (mismatch) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['energy_kj'],
          message:
            `energy_kj (${kj}) disagrees with energy_kcal (${kcal}) by more than 5% ` +
            `(expected ≈ ${round3(expectedKj)} kJ)`,
        });
      }
    }

    const edible = row.edible_pct.value;
    if (edible !== null && (edible <= 0 || edible > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['edible_pct'],
        message: `edible_pct must be in (0, 100] (got ${edible})`,
      });
    }
  })
  .transform((row): CfctParsedRow => {
    // All CFCT_NUTRIENT_MAP keys are numericCell() fields of this object; the
    // cast only widens the index type for the dynamic lookup below.
    const cells = row as unknown as Record<string, NumericCell>;
    const nutrients: Partial<Record<NutrientColumn, number>> = {};
    const traceFlags: string[] = [];
    for (const [csvColumn, column] of CFCT_NUTRIENT_MAP) {
      const cell = cells[csvColumn];
      if (cell === undefined || cell.value === null) continue;
      nutrients[column] = cell.value;
      if (cell.trace) traceFlags.push(column);
    }
    // Only kJ on the sheet → derive kcal (the only persisted energy column).
    if (nutrients.energyKcal === undefined && row.energy_kj.value !== null) {
      nutrients.energyKcal = kjToKcal(row.energy_kj.value);
      if (row.energy_kj.trace) traceFlags.push('energyKcal');
    }
    if (row.ash_g.trace) traceFlags.push('ash_g');
    return {
      foodCode: row.food_code,
      foodName: row.food_name,
      foodNameEn: row.food_name_en,
      category: row.category,
      ediblePct: row.edible_pct.value ?? 100,
      nutrients,
      traceFlags,
      ashG: row.ash_g.value,
      remark: row.remark,
    };
  });
