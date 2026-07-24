// Mark-and-sweep retirement. Only kind='full' runs may call this, and only
// after every batch has been upserted successfully: any active ETL food of
// the source not touched by this run (lastImportRunId differs) disappeared
// from the upstream dataset and is retired — never hard-deleted. User-created
// foods (createdByUserId set) are never swept.
import type { ResultSetHeader } from 'mysql2/promise';
import { pool } from './db';

export async function sweepRetired(sourceId: number, runId: bigint): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE food
        SET status = 'retired', updatedAt = NOW(3)
      WHERE sourceId = ?
        AND (lastImportRunId IS NULL OR lastImportRunId <> ?)
        AND status = 'active'
        AND createdByUserId IS NULL`,
    [sourceId, runId],
  );
  return result.affectedRows;
}
