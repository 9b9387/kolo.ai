// Bulk idempotent food upsert. Contract:
//   - Idempotency key: (sourceId, sourceKey) unique constraint on food.
//   - contentHash = sha1(stable serialization of the NormalizedFood row);
//     unchanged hash → only lastImportRunId is touched (counted as skipped).
//   - Changed/new rows: food ODKU → food_nutrients ODKU (1:1 on foodId) →
//     food_portion DELETE + INSERT. Each batch (≤500 rows) is one
//     transaction.
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { buildSearchText } from '../../src/lib/search-text';
import { pool } from './db';
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

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const keys = [...byKey.keys()];
    const [existingRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, sourceKey, contentHash FROM food WHERE sourceId = ? AND sourceKey IN (?)`,
      [sourceId, keys],
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
      await conn.query(
        `UPDATE food SET lastImportRunId = ?, status = 'active' WHERE id IN (?)`,
        [runId, untouchedIds],
      );
    }

    if (dirty.length > 0) {
      await upsertFoodRows(conn, runId, sourceId, dirty, verified);

      const dirtyKeys = dirty.map((entry) => entry.row.sourceKey);
      const [idRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, sourceKey FROM food WHERE sourceId = ? AND sourceKey IN (?)`,
        [sourceId, dirtyKeys],
      );
      const idByKey = new Map<string, string>(
        idRows.map((row) => [String(row.sourceKey), String(row.id)]),
      );
      const withIds = dirty.map((entry) => {
        const id = idByKey.get(entry.row.sourceKey);
        if (!id) throw new Error(`food id not found after upsert for sourceKey=${entry.row.sourceKey}`);
        return { row: entry.row, foodId: id };
      });

      await upsertNutrientRows(conn, withIds);
      await replacePortionRows(conn, withIds);
    }

    await conn.commit();
    return counts;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function upsertFoodRows(
  conn: PoolConnection,
  runId: bigint,
  sourceId: number,
  dirty: { row: NormalizedFood; hash: string }[],
  verified: boolean,
): Promise<void> {
  const tuple = `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, NOW(3))`;
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
      verified ? 1 : 0,
      hash,
      runId,
      row.sourceMeta ? JSON.stringify(row.sourceMeta) : null,
    );
  }
  await conn.query<ResultSetHeader>(
    `INSERT INTO food
       (sourceId, sourceKey, dataType, name, nameEn, nameZh, aliases, brand,
        category, barcode, ediblePct, searchText, completeness, verified,
        status, contentHash, lastImportRunId, sourceMeta, updatedAt)
     VALUES ${dirty.map(() => tuple).join(', ')} AS new
     ON DUPLICATE KEY UPDATE
       dataType = new.dataType, name = new.name, nameEn = new.nameEn,
       nameZh = new.nameZh, aliases = new.aliases, brand = new.brand,
       category = new.category, barcode = new.barcode,
       ediblePct = new.ediblePct, searchText = new.searchText,
       completeness = new.completeness, verified = new.verified,
       status = 'active', contentHash = new.contentHash,
       lastImportRunId = new.lastImportRunId, sourceMeta = new.sourceMeta,
       updatedAt = NOW(3)`,
    params,
  );
}

async function upsertNutrientRows(
  conn: PoolConnection,
  withIds: { row: NormalizedFood; foodId: string }[],
): Promise<void> {
  const columns = ['foodId', ...NUTRIENT_COLUMNS, 'traceFlags', 'extras'];
  const tuple = `(${columns.map(() => '?').join(', ')})`;
  const params: unknown[] = [];
  for (const { row, foodId } of withIds) {
    params.push(foodId);
    for (const column of NUTRIENT_COLUMNS) params.push(nutrientValue(row, column));
    params.push(row.traceFlags && row.traceFlags.length > 0 ? JSON.stringify(row.traceFlags) : null);
    params.push(row.extras && Object.keys(row.extras).length > 0 ? JSON.stringify(row.extras) : null);
  }
  const updateList = [...NUTRIENT_COLUMNS, 'traceFlags', 'extras']
    .map((column) => `${column} = new.${column}`)
    .join(', ');
  await conn.query<ResultSetHeader>(
    `INSERT INTO food_nutrients (${columns.join(', ')})
     VALUES ${withIds.map(() => tuple).join(', ')} AS new
     ON DUPLICATE KEY UPDATE ${updateList}`,
    params,
  );
}

async function replacePortionRows(
  conn: PoolConnection,
  withIds: { row: NormalizedFood; foodId: string }[],
): Promise<void> {
  await conn.query(`DELETE FROM food_portion WHERE foodId IN (?)`, [
    withIds.map((entry) => entry.foodId),
  ]);
  const params: unknown[] = [];
  let tupleCount = 0;
  for (const { row, foodId } of withIds) {
    for (const portion of row.portions ?? []) {
      params.push(foodId, portion.seq, portion.description, portion.gramWeight, portion.sourcePortionId ?? null);
      tupleCount += 1;
    }
  }
  if (tupleCount === 0) return;
  await conn.query<ResultSetHeader>(
    `INSERT INTO food_portion (foodId, seq, description, gramWeight, sourcePortionId)
     VALUES ${Array.from({ length: tupleCount }, () => '(?, ?, ?, ?, ?)').join(', ')}`,
    params,
  );
}
