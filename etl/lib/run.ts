// ImportRun lifecycle. One row per pipeline execution:
//   beginRun  → INSERT status='running' (refuses if a run for the same source
//               is already 'running', unless force marks the zombie failed)
//   finishRun → status='success' + finishedAt + stats JSON
//   failRun   → status='failed'  + finishedAt + error note
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from './db';

export type RunKind = 'full' | 'partial' | 'manual';

export interface RunStats {
  read: number;
  inserted: number;
  updated: number;
  skipped: number;
  rejected: number;
  retired: number;
}

export async function beginRun(
  sourceCode: string,
  kind: RunKind,
  datasetVersion: string,
  opts: { force?: boolean } = {},
): Promise<bigint> {
  const [running] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM import_run WHERE sourceCode = ? AND status = 'running'`,
    [sourceCode],
  );
  if (running.length > 0) {
    const ids = running.map((row) => String(row.id)).join(', ');
    if (!opts.force) {
      throw new Error(
        `import_run ${ids} for source "${sourceCode}" is still status='running'. ` +
          `If it is a crashed leftover, re-run with --force to mark it failed and start over.`,
      );
    }
    await pool.query(
      `UPDATE import_run
          SET status = 'failed',
              finishedAt = NOW(3),
              notes = CONCAT(COALESCE(notes, ''), ?)
        WHERE sourceCode = ? AND status = 'running'`,
      [`[force] zombie run marked failed by a new ${kind} run\n`, sourceCode],
    );
  }
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO import_run (sourceCode, kind, datasetVersion, status)
     VALUES (?, ?, ?, 'running')`,
    [sourceCode, kind, datasetVersion],
  );
  return BigInt(result.insertId);
}

export async function finishRun(runId: bigint, stats: RunStats): Promise<void> {
  await pool.query(
    `UPDATE import_run
        SET status = 'success', finishedAt = NOW(3), stats = ?
      WHERE id = ?`,
    [JSON.stringify(stats), runId],
  );
}

export async function failRun(
  runId: bigint,
  error: unknown,
  stats?: Partial<RunStats>,
): Promise<void> {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  await pool.query(
    `UPDATE import_run
        SET status = 'failed',
            finishedAt = NOW(3),
            stats = ?,
            notes = CONCAT(COALESCE(notes, ''), ?)
      WHERE id = ?`,
    [stats ? JSON.stringify(stats) : null, `${message}\n`, runId],
  );
}
