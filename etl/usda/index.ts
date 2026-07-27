// USDA FoodData Central import pipeline (SR Legacy + Foundation + FNDDS).
//
//   npx tsx etl/usda/index.ts [--types=sr_legacy,foundation,survey_fndds]
//                             [--force] [--skip-download]
//
//   --types          comma list of datasets to import (default: all three).
//                    Importing all three runs as kind='full' and finishes
//                    with mark-and-sweep; a subset runs as kind='partial'
//                    and never sweeps (sweeping on a subset would retire
//                    every food of the unselected datasets).
//   --force          mark a leftover status='running' import_run as failed
//                    and start anyway.
//   --skip-download  never hit the network; use the cached zips/extracted
//                    CSVs under etl/.cache/usda (fails if absent).
import path from 'node:path';
import { access } from 'node:fs/promises';
import type { NormalizedFood } from '../lib/batch';
import { upsertFoods } from '../lib/batch';
import { readCsvAll, streamCsv } from '../lib/csv';
import { closePool, db } from '../lib/db';
import { downloadFile } from '../lib/download';
import { beginRun, failRun, finishRun, type RunStats } from '../lib/run';
import { sweepRetired } from '../lib/sweep';
import {
  ALL_DATASET_KEYS,
  USDA_CACHE_DIR,
  USDA_DATASETS,
  usdaDatasetVersion,
  type UsdaDatasetKey,
} from './config';
import { extractTables } from './parse';
import {
  addNutrientAmount,
  addPortion,
  buildNutrientIdResolver,
  draftFromFoodRow,
  finalizeFood,
  validateNutrientDictionary,
  type FoodDraft,
} from './normalize';

interface CliOptions {
  types: UsdaDatasetKey[];
  force: boolean;
  skipDownload: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { types: [...ALL_DATASET_KEYS], force: false, skipDownload: false };
  for (const arg of argv) {
    if (arg === '--force') opts.force = true;
    else if (arg === '--skip-download') opts.skipDownload = true;
    else if (arg.startsWith('--types=')) {
      const keys = arg
        .slice('--types='.length)
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
      if (keys.length === 0) throw new Error('--types= needs at least one dataset key');
      for (const key of keys) {
        if (!(key in USDA_DATASETS)) {
          throw new Error(`Unknown dataset "${key}" (valid: ${ALL_DATASET_KEYS.join(', ')})`);
        }
      }
      opts.types = [...new Set(keys)] as UsdaDatasetKey[];
    } else {
      throw new Error(
        `Unknown argument "${arg}". Usage: tsx etl/usda/index.ts ` +
          `[--types=sr_legacy,foundation,survey_fndds] [--force] [--skip-download]`,
      );
    }
  }
  return opts;
}

interface DatasetResult {
  rows: NormalizedFood[];
  read: number;
  rejected: number;
  portionsDropped: number;
}

async function loadDataset(key: UsdaDatasetKey, skipDownload: boolean): Promise<DatasetResult> {
  const config = USDA_DATASETS[key];
  const zipPath = path.join(USDA_CACHE_DIR, 'zips', config.zipName);
  const extractDir = path.join(USDA_CACHE_DIR, config.zipName.replace(/\.zip$/, ''));

  if (skipDownload) {
    await access(zipPath).catch(() => {
      throw new Error(`--skip-download: cached zip missing at ${zipPath}`);
    });
  } else {
    const result = await downloadFile(config.url, zipPath);
    console.log(
      `[${key}] ${result.skipped ? 'cache hit' : 'downloaded'} ${config.zipName} ` +
        `(${(result.bytes / 1024 / 1024).toFixed(1)} MB)`,
    );
  }

  const files = await extractTables(zipPath, extractDir, config.tables);
  const filePath = (table: string): string => {
    const found = files.get(table);
    if (!found) throw new Error(`table ${table} not extracted for ${key}`);
    return found;
  };

  // Fail fast if the package's nutrient dictionary drifts from our mapping.
  const nutrientRows = await readCsvAll(filePath('nutrient.csv'));
  validateNutrientDictionary(nutrientRows, `${key} ${config.version}`);
  // FNDDS food_nutrient.csv references nutrients by legacy nutrient_nbr —
  // the resolver accepts both namespaces (see buildNutrientIdResolver).
  const nutrientIdResolver = buildNutrientIdResolver(nutrientRows);

  const measureUnitNames = new Map<string, string>();
  for (const row of await readCsvAll(filePath('measure_unit.csv'))) {
    if (row.id && row.name) measureUnitNames.set(row.id.trim(), row.name.trim());
  }

  // Category lookup: SR/Foundation use food_category.csv; FNDDS categories
  // come from WWEIA (survey packages ship no food_category.csv).
  const categoryById = new Map<string, string>();
  const foodCodeByFdcId = new Map<string, string>();
  const wweiaByFdcId = new Map<string, string>();
  if (key === 'survey_fndds') {
    for (const row of await readCsvAll(filePath('wweia_food_category.csv'))) {
      const num = (row.wweia_food_category ?? '').trim();
      const desc = (row.wweia_food_category_description ?? '').trim();
      if (num && desc) categoryById.set(num, desc);
    }
    for (const row of await readCsvAll(filePath('survey_fndds_food.csv'))) {
      const fdcId = (row.fdc_id ?? '').trim();
      if (!fdcId) continue;
      if (row.food_code?.trim()) foodCodeByFdcId.set(fdcId, row.food_code.trim());
      if (row.wweia_category_number?.trim()) wweiaByFdcId.set(fdcId, row.wweia_category_number.trim());
    }
  } else {
    for (const row of await readCsvAll(filePath('food_category.csv'))) {
      const id = (row.id ?? '').trim();
      const desc = (row.description ?? '').trim();
      if (id && desc) categoryById.set(id, desc);
    }
  }

  // food.csv → drafts (filters out the sub-sample/acquisition rows the
  // Foundation package mixes into food.csv).
  const drafts = new Map<string, FoodDraft>();
  let read = 0;
  let rejected = 0;
  await streamCsv(filePath('food.csv'), (row) => {
    const result = draftFromFoodRow(row, config.fdcDataType);
    if (result === null) return;
    read += 1;
    if ('rejected' in result) rejected += 1;
    else drafts.set(result.draft.fdcId, result.draft);
  });

  // food_nutrient.csv is the big one (up to ~36 MB) — stream it and keep
  // only whitelisted nutrient ids of foods we actually import.
  await streamCsv(filePath('food_nutrient.csv'), (row) => {
    const draft = drafts.get((row.fdc_id ?? '').trim());
    if (draft) addNutrientAmount(draft, row, nutrientIdResolver);
  });

  let portionsDropped = 0;
  const portionCtx = { measureUnitNames, isFndds: key === 'survey_fndds' };
  await streamCsv(filePath('food_portion.csv'), (row) => {
    const draft = drafts.get((row.fdc_id ?? '').trim());
    if (draft && !addPortion(draft, row, portionCtx)) portionsDropped += 1;
  });

  const rows: NormalizedFood[] = [];
  for (const draft of drafts.values()) {
    const categoryKey =
      key === 'survey_fndds'
        ? (wweiaByFdcId.get(draft.fdcId) ?? draft.foodCategoryId)
        : draft.foodCategoryId;
    rows.push(
      finalizeFood(draft, {
        datasetKey: key,
        fdcDataType: config.fdcDataType,
        category: categoryById.get(categoryKey) ?? null,
        foodCode: foodCodeByFdcId.get(draft.fdcId),
      }),
    );
  }
  console.log(
    `[${key}] read=${read} normalized=${rows.length} rejected=${rejected} ` +
      `portionsDropped=${portionsDropped}`,
  );
  return { rows, read, rejected, portionsDropped };
}

async function usdaSourceId(): Promise<number> {
  const rows = await db.query<{ id: unknown }>(`SELECT id FROM data_source WHERE code = 'usda_fdc'`);
  if (rows.length === 0) {
    throw new Error(`data_source 'usda_fdc' not found — run \`npm run db:seed\` first`);
  }
  return Number(rows[0].id);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const kind = opts.types.length === ALL_DATASET_KEYS.length ? 'full' : 'partial';
  const datasetVersion = usdaDatasetVersion(opts.types);
  console.log(`USDA FDC import: types=${opts.types.join(',')} kind=${kind} (${datasetVersion})`);

  // Parse/normalize everything before opening a run so a bad package never
  // leaves a half-written run behind.
  const results: DatasetResult[] = [];
  for (const key of opts.types) results.push(await loadDataset(key, opts.skipDownload));
  const allRows = results.flatMap((result) => result.rows);
  const read = results.reduce((sum, result) => sum + result.read, 0);
  const rejected = results.reduce((sum, result) => sum + result.rejected, 0);

  const sourceId = await usdaSourceId();
  const runId = await beginRun('usda_fdc', kind, datasetVersion, { force: opts.force });
  console.log(`import_run ${runId} started (${kind})`);
  try {
    const counts = await upsertFoods(runId, sourceId, allRows, { verified: true });
    const retired = kind === 'full' ? await sweepRetired(sourceId, runId) : 0;
    const stats: RunStats = { read, ...counts, rejected, retired };
    await finishRun(runId, stats);
    console.log(`import_run ${runId} success: ${JSON.stringify(stats)}`);
  } catch (error) {
    await failRun(runId, error, { read, rejected });
    throw error;
  }
}

main()
  .then(() => closePool())
  .catch(async (error) => {
    console.error(error);
    await closePool().catch(() => {});
    process.exit(1);
  });
