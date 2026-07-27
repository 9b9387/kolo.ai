// Bulk idempotent food upsert. Contract:
//   - Idempotency key: (sourceId, sourceKey) unique constraint on food.
//   - contentHash = sha1(stable serialization of the NormalizedFood row);
//     unchanged hash → only lastImportRunId is touched (counted as skipped).
//   - Changed/new rows: food upsert → food_nutrients upsert (1:1 on foodId) →
//     food_portion DELETE + INSERT. Each batch (≤500 rows) is one
//     transaction. Upsert syntax is dialect-specific: MySQL
//     `ON DUPLICATE KEY UPDATE … AS new`, Postgres `ON CONFLICT … DO UPDATE
//     SET … = EXCLUDED.…`.
import { buildSearchText } from '../../src/lib/search-text';
import { db, provider, q, NOW, type SqlClient } from './db';
import { contentHash } from './hash';
import { COMPLETENESS_COLUMNS, NUTRIENT_COLUMNS, type NutrientColumn } from './nutrients';

export interface NormalizedPortion {
  description: string;
  gramWeight: number;
  sourcePortionId?: string;
  seq: number;
}

export interface NormalizedFood {
  sourceKey: string;
  dataType: string;
  name: string;
  nameEn?: string | null;
  nameZh?: string | null;
  /** "|"-separated synonyms. */
  aliases?: string | null;
  brand?: string | null;
  category?: string | null;
  barcode?: string | null;
  ediblePct?: number | null;
  /** Per-100g edible portion; missing = absent key, never 0. */
  nutrients: Partial<Record<NutrientColumn, number>>;
  /** Column names whose source value was a trace marker (stored as 0). */
  traceFlags?: string[];
  /** Long-tail nutrients, keys carry units, e.g. {"18:2 n-6_g": 1.2}. */
  extras?: Record<string, number>;
  portions?: NormalizedPortion[];
  sourceMeta?: Record<string, unknown>;
}

export interface UpsertCounts {
  inserted: number;
  updated: number;
  skipped: number;
}

const BATCH_SIZE = 500;

const FOOD_COLUMNS = [
  'sourceId',
  'sourceKey',
  'dataType',
  'name',
  'nameEn',
  'nameZh',
  'aliases',
  'brand',
  'category',
  'barcode',
  'ediblePct',
  'searchText',
  'completeness',
  'verified',
  'status',
  'contentHash',
  'lastImportRunId',
  'sourceMeta',
  'updatedAt',
] as const;

// Everything that gets rewritten when the content hash changed.
const FOOD_UPDATE_COLUMNS = FOOD_COLUMNS.filter(
  (column) => !['sourceId', 'sourceKey', 'status', 'updatedAt'].includes(column),
);

function computeCompleteness(nutrients: NormalizedFood['nutrients']): number {
  let present = 0;
  for (const column of COMPLETENESS_COLUMNS) {
    const value = nutrients[column];
    if (value !== undefined && value !== null && Number.isFinite(value)) present += 1;
  }
  return Math.round((present / COMPLETENESS_COLUMNS.length) * 100) / 100;
}

function nutrientValue(row: NormalizedFood, column: NutrientColumn): number | null {
  const value = row.nutrients[column];
  return value !== undefined && value !== null && Number.isFinite(value) ? value : null;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

/**
 * Upsert normalized foods for one source. `verified` applies to every row of
 * the call (usda_fdc / cfct / off official dumps all import as verified).
 * Returns counts: inserted (new sourceKey), updated (hash changed), skipped
 * (hash identical — only lastImportRunId touched).
 */
export async function upsertFoods(
  runId: bigint,
  sourceId: number,
  rows: NormalizedFood[],
  opts: { verified?: boolean } = {},
): Promise<UpsertCounts> {
  const verified = opts.verified ?? true;
  const totals: UpsertCounts = { inserted: 0, updated: 0, skipped: 0 };
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    const counts = await upsertBatch(runId, sourceId, batch, verified);
    totals.inserted += counts.inserted;
    totals.updated += counts.updated;
    totals.skipped += counts.skipped;
  }
  return totals;
}

async function upsertBatch(
  runId: bigint,
  sourceId: number,
  batch: NormalizedFood[],
  verified: boolean,
): Promise<UpsertCounts> {
  const counts: UpsertCounts = { inserted: 0, updated: 0, skipped: 0 };

  // Dedupe within the batch (last row wins) so a single multi-row INSERT
  // never touches the same unique key twice.
  const byKey = new Map<string, { row: NormalizedFood; hash: string }>();
  for (const row of batch) {
    if (byKey.has(row.sourceKey)) counts.skipped += 1;
    byKey.set(row.sourceKey, { row, hash: contentHash(row) });
  }
  if (byKey.size === 0) return counts;

  return db.withTransaction(async (tx) => {
    const keys = [...byKey.keys()];
    const existingRows = await tx.query<{ id: unknown; sourceKey: unknown; contentHash: unknown }>(
      `SELECT id, ${q('sourceKey')} AS ${q('sourceKey')}, ${q('contentHash')} AS ${q('contentHash')}
         FROM food
        WHERE ${q('sourceId')} = ? AND ${q('sourceKey')} IN (${placeholders(keys.length)})`,
      [sourceId, ...keys],
    );
    const existing = new Map<string, { id: string; contentHash: string | null }>(
      existingRows.map((row) => [
        String(row.sourceKey),
        { id: String(row.id), contentHash: row.contentHash === null ? null : String(row.contentHash) },
      ]),
    );

    const untouchedIds: string[] = [];
    const dirty: { row: NormalizedFood; hash: string }[] = [];
    for (const entry of byKey.values()) {
      const found = existing.get(entry.row.sourceKey);
      if (found && found.contentHash === entry.hash) {
        untouchedIds.push(found.id);
        counts.skipped += 1;
      } else {
        dirty.push(entry);
        if (found) counts.updated += 1;
        else counts.inserted += 1;
      }
    }

    // Light touch: content identical — just claim the row for this run so
    // mark-and-sweep keeps it, and revive it if a past sweep retired it.
    if (untouchedIds.length > 0) {
      await tx.execute(
        `UPDATE food SET ${q('lastImportRunId')} = ?, status = 'active'
          WHERE id IN (${placeholders(untouchedIds.length)})`,
        [runId, ...untouchedIds],
      );
    }

    if (dirty.length > 0) {
      await upsertFoodRows(tx, runId, sourceId, dirty, verified);

      const dirtyKeys = dirty.map((entry) => entry.row.sourceKey);
      const idRows = await tx.query<{ id: unknown; sourceKey: unknown }>(
        `SELECT id, ${q('sourceKey')} AS ${q('sourceKey')}
           FROM food
          WHERE ${q('sourceId')} = ? AND ${q('sourceKey')} IN (${placeholders(dirtyKeys.length)})`,
        [sourceId, ...dirtyKeys],
      );
      const idByKey = new Map<string, string>(
        idRows.map((row) => [String(row.sourceKey), String(row.id)]),
      );
      const withIds = dirty.map((entry) => {
        const id = idByKey.get(entry.row.sourceKey);
        if (!id) throw new Error(`food id not found after upsert for sourceKey=${entry.row.sourceKey}`);
        return { row: entry.row, foodId: id };
      });

      await upsertNutrientRows(tx, withIds);
      await replacePortionRows(tx, withIds);
    }

    return counts;
  });
}

async function upsertFoodRows(
  tx: SqlClient,
  runId: bigint,
  sourceId: number,
  dirty: { row: NormalizedFood; hash: string }[],
  verified: boolean,
): Promise<void> {
  const tuple = `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ${NOW})`;
  const params: unknown[] = [];
  for (const { row, hash } of dirty) {
    params.push(
      sourceId,
      row.sourceKey,
      row.dataType,
      row.name,
      row.nameEn ?? null,
      row.nameZh ?? null,
      row.aliases ?? null,
      row.brand ?? null,
      row.category ?? null,
      row.barcode ?? null,
      row.ediblePct ?? null,
      buildSearchText({
        name: row.name,
        nameZh: row.nameZh,
        nameEn: row.nameEn,
        aliases: row.aliases,
        brand: row.brand,
      }),
      computeCompleteness(row.nutrients),
      verified,
      hash,
      runId,
      row.sourceMeta ? JSON.stringify(row.sourceMeta) : null,
    );
  }
  const columnList = FOOD_COLUMNS.map((column) => q(column)).join(', ');
  const values = dirty.map(() => tuple).join(', ');
  const sql =
    provider === 'postgres'
      ? `INSERT INTO food (${columnList}) VALUES ${values}
         ON CONFLICT (${q('sourceId')}, ${q('sourceKey')}) DO UPDATE SET
           ${FOOD_UPDATE_COLUMNS.map((column) => `${q(column)} = EXCLUDED.${q(column)}`).join(', ')},
           status = 'active', ${q('updatedAt')} = ${NOW}`
      : `INSERT INTO food (${columnList}) VALUES ${values} AS new
         ON DUPLICATE KEY UPDATE
           ${FOOD_UPDATE_COLUMNS.map((column) => `${column} = new.${column}`).join(', ')},
           status = 'active', updatedAt = ${NOW}`;
  await tx.execute(sql, params);
}

async function upsertNutrientRows(
  tx: SqlClient,
  withIds: { row: NormalizedFood; foodId: string }[],
): Promise<void> {
  const columns = ['foodId', ...NUTRIENT_COLUMNS, 'traceFlags', 'extras'];
  const tuple = `(${placeholders(columns.length)})`;
  const params: unknown[] = [];
  for (const { row, foodId } of withIds) {
    params.push(foodId);
    for (const column of NUTRIENT_COLUMNS) params.push(nutrientValue(row, column));
    params.push(row.traceFlags && row.traceFlags.length > 0 ? JSON.stringify(row.traceFlags) : null);
    params.push(row.extras && Object.keys(row.extras).length > 0 ? JSON.stringify(row.extras) : null);
  }
  const columnList = columns.map((column) => q(column)).join(', ');
  const values = withIds.map(() => tuple).join(', ');
  const updateColumns = [...NUTRIENT_COLUMNS, 'traceFlags', 'extras'];
  const sql =
    provider === 'postgres'
      ? `INSERT INTO food_nutrients (${columnList}) VALUES ${values}
         ON CONFLICT (${q('foodId')}) DO UPDATE SET
           ${updateColumns.map((column) => `${q(column)} = EXCLUDED.${q(column)}`).join(', ')}`
      : `INSERT INTO food_nutrients (${columnList}) VALUES ${values} AS new
         ON DUPLICATE KEY UPDATE ${updateColumns.map((column) => `${column} = new.${column}`).join(', ')}`;
  await tx.execute(sql, params);
}

async function replacePortionRows(
  tx: SqlClient,
  withIds: { row: NormalizedFood; foodId: string }[],
): Promise<void> {
  await tx.execute(
    `DELETE FROM food_portion WHERE ${q('foodId')} IN (${placeholders(withIds.length)})`,
    withIds.map((entry) => entry.foodId),
  );
  const params: unknown[] = [];
  let tupleCount = 0;
  for (const { row, foodId } of withIds) {
    for (const portion of row.portions ?? []) {
      params.push(foodId, portion.seq, portion.description, portion.gramWeight, portion.sourcePortionId ?? null);
      tupleCount += 1;
    }
  }
  if (tupleCount === 0) return;
  await tx.execute(
    `INSERT INTO food_portion (${q('foodId')}, seq, description, ${q('gramWeight')}, ${q('sourcePortionId')})
     VALUES ${Array.from({ length: tupleCount }, () => '(?, ?, ?, ?, ?)').join(', ')}`,
    params,
  );
}
