// USDA FoodData Central dataset release configuration.
//
// FDC publishes new dataset releases twice a year (April and October); to
// upgrade, check https://fdc.nal.usda.gov/download-datasets for the new
// single-data-type CSV zip file names and update the entries below (verify
// the inner CSV table names have not changed — see TABLES_* lists).
//
// URLs verified 2026-07-24 against https://fdc.nal.usda.gov/download-datasets:
//   - SR Legacy is frozen: April 2018 is its final release, it will not change.
//   - Foundation Foods current release: April 2026 (2026-04-30).
//   - FNDDS "Survey" foods current release: October 2024 (FNDDS 2021-2023);
//     it was NOT refreshed in the April 2026 cycle.
// The zips are served from https://fdc.nal.usda.gov/fdc-datasets/<zipName>
// (HTTP 200, Content-Type: application/zip, spot-checked sizes below).
// sha256 checksums are informational only — USDA does not publish official
// checksums and has been known to re-upload files in place, so we do not
// hard-pin them in downloadFile():
//   sr_legacy    b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0 (6,074,592 B)
//   foundation   d6d4f41dcd19a46abcdd67775379cb6f0292ff08daa7e0680fdd0982830bf57b (3,825,517 B)
//   survey_fndds 5ccc25ec2777a8982fbb61378a42f415316173eb11e48c9a8ba4cb19f5a4f29c (3,325,692 B)
import path from 'node:path';

export const USDA_DOWNLOAD_BASE = 'https://fdc.nal.usda.gov/fdc-datasets';

/** Local cache root: etl/.cache/usda (zips plus extracted per-release dirs). */
export const USDA_CACHE_DIR = path.resolve(__dirname, '..', '.cache', 'usda');

export type UsdaDatasetKey = 'sr_legacy' | 'foundation' | 'survey_fndds';

/** Tables every package needs. */
const TABLES_COMMON = [
  'food.csv',
  'nutrient.csv',
  'food_nutrient.csv',
  'food_portion.csv',
  'measure_unit.csv',
] as const;

export interface UsdaDatasetConfig {
  readonly key: UsdaDatasetKey;
  /** Value of food.csv data_type identifying this dataset's food rows. */
  readonly fdcDataType: string;
  /** Release tag (from the zip file name); part of ImportRun.datasetVersion. */
  readonly version: string;
  readonly zipName: string;
  readonly url: string;
  /** CSV basenames to extract from the zip (all live under one top dir). */
  readonly tables: readonly string[];
}

export const USDA_DATASETS: Record<UsdaDatasetKey, UsdaDatasetConfig> = {
  sr_legacy: {
    key: 'sr_legacy',
    fdcDataType: 'sr_legacy_food',
    version: '2018-04',
    zipName: 'FoodData_Central_sr_legacy_food_csv_2018-04.zip',
    url: `${USDA_DOWNLOAD_BASE}/FoodData_Central_sr_legacy_food_csv_2018-04.zip`,
    tables: [...TABLES_COMMON, 'food_category.csv'],
  },
  foundation: {
    key: 'foundation',
    fdcDataType: 'foundation_food',
    version: '2026-04-30',
    zipName: 'FoodData_Central_foundation_food_csv_2026-04-30.zip',
    url: `${USDA_DOWNLOAD_BASE}/FoodData_Central_foundation_food_csv_2026-04-30.zip`,
    tables: [...TABLES_COMMON, 'food_category.csv'],
  },
  survey_fndds: {
    key: 'survey_fndds',
    fdcDataType: 'survey_fndds_food',
    version: '2024-10-31',
    zipName: 'FoodData_Central_survey_food_csv_2024-10-31.zip',
    // The survey package has no food_category.csv — FNDDS categories come
    // from survey_fndds_food.wweia_category_number → wweia_food_category.
    url: `${USDA_DOWNLOAD_BASE}/FoodData_Central_survey_food_csv_2024-10-31.zip`,
    tables: [...TABLES_COMMON, 'survey_fndds_food.csv', 'wweia_food_category.csv'],
  },
};

export const ALL_DATASET_KEYS = Object.keys(USDA_DATASETS) as UsdaDatasetKey[];

/** ImportRun.datasetVersion for a selection of datasets (VarChar(128)). */
export function usdaDatasetVersion(keys: readonly UsdaDatasetKey[]): string {
  return keys.map((key) => `${key}:${USDA_DATASETS[key].version}`).join(' ');
}
