// Local-only converter: turns the JSON files of the GitHub repository
// Sanotsu/china-food-composition-data (OCR / vision-LLM transcriptions of the
// printed《中国食物成分表 标准版 第6版》) into the Kolo CFCT intake CSV
// (docs/cfct-template.csv layout). It writes a CSV — it never touches the DB.
//
// IMPORTANT — the converted output is for private, local use only:
//   * the underlying book content is NOT redistributable (data_source 'cfct'
//     is seeded with redistributable=false) — do not publish or share the
//     generated CSV or import it into a shared/public instance;
//   * the repo data was produced by OCR / vision-LLM transcription and
//     contains recognition errors — before importing, sample 5-10% of the
//     rows of each category and check them against the printed book.
//
// Usage:
//   tsx etl/cfct/from-sanotsu.ts --dir <local-clone-path> --out my-cfct.csv
//
// Source format (verified 2026-07-24 against raw.githubusercontent.com,
// json_data_vision_251206_Qwen2-5-VL-72B-Instruct/merged_乳类及其制品-奶油.json):
// each file is a JSON array of flat objects whose values are all strings,
// '—' marking unmeasured and 'Tr' marking trace amounts:
//   { "foodCode": "105001", "foodName": "奶油", "edible": "100",
//     "water": "0.7", "energyKCal": "879", "energyKJ": "3616",
//     "protein": "0.7", "fat": "97.0", "CHO": "0.9", "dietaryFiber": "0.0",
//     "cholesterol": "209", "ash": "0.7", "vitaminA": "297",
//     "carotene": "Tr", "retinol": "297", "thiamin": "Tr",
//     "riboflavin": "0.01", "niacin": "0.00", "vitaminC": "Tr",
//     "vitaminETotal": "1.99", "vitaminE1": "1.17", "vitaminE2": "—",
//     "vitaminE3": "—", "Ca": "14", "P": "11", "K": "226", "Na": "268.0",
//     "Mg": "2", "Fe": "1.0", "Zn": "0.09", "Se": "0.70", "Cu": "0.42",
//     "Mn": "Tr", "remark": "青海" }
// vitaminE1/E2/E3 (tocopherol fractions) are dropped — the template only
// carries total vitamin E. The category column is derived from the file name
// ("merged_乳类及其制品-奶油.json" → "乳类及其制品-奶油").
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { CFCT_HEADER, cfctRowSchema } from './template';

/** Preferred JSON directories inside the clone, best transcription first. */
const DATA_DIR_CANDIDATES = [
  'json_data_vision_251206_Qwen2-5-VL-72B-Instruct',
  'json_data_vision',
  'json_data',
];

/** Template column → Sanotsu JSON key (category/food_name_en are synthetic). */
const FIELD_MAP: ReadonlyArray<readonly [string, string]> = [
  ['food_code', 'foodCode'],
  ['food_name', 'foodName'],
  ['edible_pct', 'edible'],
  ['water_g', 'water'],
  ['energy_kcal', 'energyKCal'],
  ['energy_kj', 'energyKJ'],
  ['protein_g', 'protein'],
  ['fat_g', 'fat'],
  ['carbohydrate_g', 'CHO'],
  ['fiber_g', 'dietaryFiber'],
  ['cholesterol_mg', 'cholesterol'],
  ['ash_g', 'ash'],
  ['vit_a_ug_rae', 'vitaminA'],
  ['carotene_ug', 'carotene'],
  ['retinol_ug', 'retinol'],
  ['thiamin_mg', 'thiamin'],
  ['riboflavin_mg', 'riboflavin'],
  ['niacin_mg', 'niacin'],
  ['vit_c_mg', 'vitaminC'],
  ['vit_e_mg', 'vitaminETotal'],
  ['ca_mg', 'Ca'],
  ['p_mg', 'P'],
  ['k_mg', 'K'],
  ['na_mg', 'Na'],
  ['mg_mg', 'Mg'],
  ['fe_mg', 'Fe'],
  ['zn_mg', 'Zn'],
  ['se_ug', 'Se'],
  ['cu_mg', 'Cu'],
  ['mn_mg', 'Mn'],
  ['remark', 'remark'],
];

/** Markers meaning "unmeasured" — emitted as an empty template cell. */
const NULL_MARKERS = new Set(['', '—', '–', '-', '－']);

const USAGE = 'Usage: tsx etl/cfct/from-sanotsu.ts --dir <local-clone-path> --out my-cfct.csv';

interface CliArgs {
  dir: string;
  out: string;
}

function parseArgs(argv: string[]): CliArgs {
  let dir: string | undefined;
  let out: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--dir':
        dir = argv[++i];
        break;
      case '--out':
        out = argv[++i];
        break;
      default:
        throw new Error(`Unknown argument "${arg}".\n${USAGE}`);
    }
  }
  if (!dir || !out) throw new Error(`--dir and --out are both required.\n${USAGE}`);
  return { dir, out };
}

function listJsonFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => join(dir, name));
}

/** --dir may be the repo clone root or a JSON directory directly. */
function resolveDataDir(dir: string): string {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`--dir "${dir}" is not a directory`);
  }
  if (listJsonFiles(dir).length > 0) return dir;
  for (const candidate of DATA_DIR_CANDIDATES) {
    const nested = join(dir, candidate);
    if (existsSync(nested) && listJsonFiles(nested).length > 0) return nested;
  }
  throw new Error(
    `no .json files found in "${dir}" or in any of its known data sub-directories ` +
      `(${DATA_DIR_CANDIDATES.join(', ')})`,
  );
}

/** "merged_乳类及其制品-奶油.json" → "乳类及其制品-奶油". */
function categoryFromFileName(filePath: string): string {
  return basename(filePath, '.json').replace(/^merged_/, '');
}

function normalizeCell(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim();
  return NULL_MARKERS.has(s) ? '' : s;
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const dataDir = resolveDataDir(args.dir);
  const files = listJsonFiles(dataDir);
  console.log(`Reading ${files.length} JSON file(s) from ${dataDir}`);

  const records: Record<string, string>[] = [];
  const skipped: string[] = [];
  const seenCodes = new Map<string, string>(); // foodCode → file first seen in
  let read = 0;

  for (const file of files) {
    const fileName = basename(file);
    const parsedJson: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(parsedJson)) {
      skipped.push(`${fileName}: not a JSON array — file skipped`);
      continue;
    }
    const category = categoryFromFileName(file);
    for (const item of parsedJson) {
      read += 1;
      const source = (item ?? {}) as Record<string, unknown>;
      const record: Record<string, string> = { food_name_en: '', category };
      for (const [templateColumn, sanotsuKey] of FIELD_MAP) {
        record[templateColumn] = normalizeCell(source[sanotsuKey]);
      }
      const label = `${fileName} foodCode=${record.food_code || '?'} (${record.food_name || '?'})`;

      // Reuse the importer's row schema so the emitted CSV imports cleanly.
      const result = cfctRowSchema.safeParse(record);
      if (!result.success) {
        const reasons = result.error.issues
          .map((issue) => `${issue.path.join('.') || '(row)'}: ${issue.message}`)
          .join('; ');
        skipped.push(`${label}: ${reasons}`);
        continue;
      }
      const firstFile = seenCodes.get(result.data.foodCode);
      if (firstFile !== undefined) {
        skipped.push(`${label}: duplicate food_code (first seen in ${firstFile})`);
        continue;
      }
      seenCodes.set(result.data.foodCode, fileName);
      records.push(record);
    }
  }

  records.sort((a, b) => a.food_code.localeCompare(b.food_code));
  const lines = [CFCT_HEADER.join(',')];
  for (const record of records) {
    lines.push(CFCT_HEADER.map((column) => csvEscape(record[column] ?? '')).join(','));
  }
  // UTF-8 BOM so spreadsheet apps detect the encoding.
  writeFileSync(args.out, '\uFEFF' + lines.join('\n') + '\n', 'utf8');

  console.log(`Read ${read} row(s); wrote ${records.length} row(s) to ${args.out}`);
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} row(s) that would not pass template validation:`);
    for (const entry of skipped) console.log(`  - ${entry}`);
    console.log('Fix them from the printed book and add them to the CSV manually if needed.');
  }
  console.log('');
  console.log('注意 / NOTICE:');
  console.log('  * 转换产物仅限本地自用，不可分发（cfct 数据源 redistributable=false）。');
  console.log('  * 源数据来自 OCR/视觉大模型识别，存在识别错误：导入前请按类别抽样 5-10% 对照');
  console.log('    《中国食物成分表》原书校验，再运行 tsx etl/cfct/index.ts --file <csv>。');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
