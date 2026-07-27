// CFCT importer — loads a docs/cfct-template.csv-shaped file into food /
// food_nutrients under data_source code 'cfct'.
//
//   tsx etl/cfct/index.ts --file <path> [--label "标准版第6版"] [--replace-all] [--force]
//
// Behavior:
//   - the whole file is read and validated first (these files are a few
//     thousand rows at most); any error aborts before anything is written
//     (all-or-nothing) and every problem is reported as "line: column: reason";
//   - duplicate food_code values within the file are errors;
//   - --replace-all runs as kind='full' and mark-and-sweep retires cfct foods
//     missing from the file; the default is kind='manual' (no sweep);
//   - --force marks a zombie status='running' import_run as failed first.
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { upsertFoods, type NormalizedFood } from '../lib/batch';
import { readCsvAll } from '../lib/csv';
import { closePool, db } from '../lib/db';
import { beginRun, failRun, finishRun, type RunStats } from '../lib/run';
import { sweepRetired } from '../lib/sweep';
import { CFCT_HEADER, cfctRowSchema, type CfctParsedRow } from './template';

interface CliArgs {
  file: string;
  label?: string;
  replaceAll: boolean;
  force: boolean;
}

const USAGE =
  'Usage: tsx etl/cfct/index.ts --file <path> [--label "标准版第6版"] [--replace-all] [--force]';

function parseArgs(argv: string[]): CliArgs {
  let file: string | undefined;
  let label: string | undefined;
  let replaceAll = false;
  let force = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--file':
        file = argv[++i];
        break;
      case '--label':
        label = argv[++i];
        break;
      case '--replace-all':
        replaceAll = true;
        break;
      case '--force':
        force = true;
        break;
      default:
        throw new Error(`Unknown argument "${arg}".\n${USAGE}`);
    }
  }
  if (!file) throw new Error(`--file is required.\n${USAGE}`);
  return { file, label, replaceAll, force };
}

/** The header must match CFCT_HEADER exactly (order-insensitive). */
function validateHeader(actualColumns: string[]): string[] {
  const errors: string[] = [];
  const expected = new Set<string>(CFCT_HEADER);
  const actual = new Set(actualColumns);
  for (const column of CFCT_HEADER) {
    if (!actual.has(column)) errors.push(`1: ${column}: missing header column`);
  }
  for (const column of actualColumns) {
    if (!expected.has(column)) errors.push(`1: ${column}: unknown header column (typo?)`);
  }
  return errors;
}

function toNormalizedFood(row: CfctParsedRow): NormalizedFood {
  return {
    sourceKey: row.foodCode,
    dataType: 'cfct',
    name: row.foodName,
    nameZh: row.foodName,
    nameEn: row.foodNameEn,
    category: row.category,
    ediblePct: row.ediblePct,
    nutrients: row.nutrients,
    traceFlags: row.traceFlags.length > 0 ? row.traceFlags : undefined,
    extras: row.ashG !== null ? { ash_g: row.ashG } : undefined,
    sourceMeta: row.remark !== null ? { remark: row.remark } : undefined,
  };
}

async function getCfctSourceId(): Promise<number> {
  const rows = await db.query<{ id: unknown }>(`SELECT id FROM data_source WHERE code = 'cfct'`);
  if (rows.length === 0) {
    throw new Error(`data_source code='cfct' not found — run \`npm run db:seed\` first.`);
  }
  return Number(rows[0].id);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const sha12 = createHash('sha256').update(readFileSync(args.file)).digest('hex').slice(0, 12);
  const rows = await readCsvAll(args.file);
  if (rows.length === 0) {
    throw new Error('no data rows found (empty file or header-only file)');
  }

  const errors = validateHeader(Object.keys(rows[0]));
  const parsed: CfctParsedRow[] = [];
  if (errors.length === 0) {
    const seenCodes = new Map<string, number>();
    rows.forEach((row, index) => {
      const line = index + 2; // line 1 is the header
      const result = cfctRowSchema.safeParse(row);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push(`${line}: ${issue.path.join('.') || '(row)'}: ${issue.message}`);
        }
        return;
      }
      const firstLine = seenCodes.get(result.data.foodCode);
      if (firstLine !== undefined) {
        errors.push(
          `${line}: food_code: duplicate food_code ${result.data.foodCode} (first seen on line ${firstLine})`,
        );
        return;
      }
      seenCodes.set(result.data.foodCode, line);
      parsed.push(result.data);
    });
  }
  if (errors.length > 0) {
    console.error(`Validation failed — ${errors.length} error(s), nothing was written:`);
    for (const error of errors) console.error(`  ${error}`);
    process.exitCode = 1;
    return;
  }

  const foods = parsed.map(toNormalizedFood);
  const sourceId = await getCfctSourceId();
  const kind = args.replaceAll ? 'full' : 'manual';
  const datasetVersion = `${args.label ?? basename(args.file)} sha256:${sha12}`.slice(0, 128);

  const runId = await beginRun('cfct', kind, datasetVersion, { force: args.force });
  console.log(`import_run ${runId} started (kind=${kind}, datasetVersion="${datasetVersion}")`);
  try {
    const counts = await upsertFoods(runId, sourceId, foods);
    const retired = args.replaceAll ? await sweepRetired(sourceId, runId) : 0;
    const stats: RunStats = { read: rows.length, ...counts, rejected: 0, retired };
    await finishRun(runId, stats);
    console.log(`import_run ${runId} success: ${JSON.stringify(stats)}`);
  } catch (error) {
    await failRun(runId, error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => closePool());
