// ImportRun lifecycle. One row per pipeline execution:
//   beginRun  → INSERT status='running' (refuses if a run for the same source
//               is already 'running', unless force marks the zombie failed)
//   finishRun → status='success' + finishedAt + stats JSON
//   failRun   → status='failed'  + finishedAt + error note
import { db, provider, q, NOW } from './db';

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
  const running = await db.query<{ id: unknown }>(
    `SELECT id FROM import_run WHERE ${q('sourceCode')} = ? AND status = 'running'`,
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
    await db.execute(
      `UPDATE import_run
          SET status = 'failed',
              ${q('finishedAt')} = ${NOW},
              notes = CONCAT(COALESCE(notes, ''), ?)
        WHERE ${q('sourceCode')} = ? AND status = 'running'`,
      [`[force] zombie run marked failed by a new ${kind} run\n`, sourceCode],
    );
  }

  const insertSql = `INSERT INTO import_run (${q('sourceCode')}, kind, ${q('datasetVersion')}, status)
     VALUES (?, ?, ?, 'running')`;
  if (provider === 'postgres') {
    const rows = await db.query<{ id: unknown }>(`${insertSql} RETURNING id`, [
      sourceCode,
      kind,
      datasetVersion,
    ]);
    return BigInt(String(rows[0].id));
  }
  const result = await db.execute(insertSql, [sourceCode, kind, datasetVersion]);
  if (result.insertId === null) throw new Error('import_run insert returned no id');
  return result.insertId;
}

export async function finishRun(runId: bigint, stats: RunStats): Promise<void> {
  await db.execute(
    `UPDATE import_run
        SET status = 'success', ${q('finishedAt')} = ${NOW}, stats = ?
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
  await db.execute(
    `UPDATE import_run
        SET status = 'failed',
            ${q('finishedAt')} = ${NOW},
            stats = ?,
            notes = CONCAT(COALESCE(notes, ''), ?)
      WHERE id = ?`,
    [stats ? JSON.stringify(stats) : null, `${message}\n`, runId],
  );
}
