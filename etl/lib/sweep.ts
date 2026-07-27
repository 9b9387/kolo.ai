// Mark-and-sweep retirement. Only kind='full' runs may call this, and only
// after every batch has been upserted successfully: any active ETL food of
// the source not touched by this run (lastImportRunId differs) disappeared
// from the upstream dataset and is retired — never hard-deleted. User-created
// foods (createdByUserId set) are never swept.
import { db, q, NOW } from './db';

export async function sweepRetired(sourceId: number, runId: bigint): Promise<number> {
  const result = await db.execute(
    `UPDATE food
        SET status = 'retired', ${q('updatedAt')} = ${NOW}
      WHERE ${q('sourceId')} = ?
        AND (${q('lastImportRunId')} IS NULL OR ${q('lastImportRunId')} <> ?)
        AND status = 'active'
        AND ${q('createdByUserId')} IS NULL`,
    [sourceId, runId],
  );
  return result.affected;
}
