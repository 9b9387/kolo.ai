// Dialect-aware SQL client for the ETL scripts. Reads the same env variables
// as the Next.js app (src/lib/env.ts) but talks to the drivers directly —
// Prisma is too slow for bulk multi-row upserts.
//
// DB_PROVIDER=mysql (default): mysql2 pool from discrete DB_* vars.
// DB_PROVIDER=postgres: pg pool from DATABASE_URL.
//
// Write SQL with `?` placeholders (converted to $n for Postgres — never put a
// literal `?` inside SQL strings) and quote camelCase identifiers with q().
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { Pool as PgPool } from 'pg';

export type DbProvider = 'mysql' | 'postgres';

export const provider: DbProvider =
  process.env.DB_PROVIDER === 'postgres' ? 'postgres' : 'mysql';

/** Quote an identifier for the active dialect (PG folds unquoted to lower). */
export function q(ident: string): string {
  return provider === 'postgres' ? `"${ident}"` : ident;
}

/** Current-timestamp SQL expression for the active dialect. */
export const NOW = provider === 'postgres' ? 'now()' : 'NOW(3)';

export interface ExecuteResult {
  affected: number;
  /** MySQL auto-increment id of the first inserted row; null on Postgres (use RETURNING). */
  insertId: bigint | null;
}

export interface SqlClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<ExecuteResult>;
}

export interface Db extends SqlClient {
  withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T>;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name} (see .env)`);
  }
  return value;
}

function toPgPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function createMysqlDb(): Db & { end(): Promise<void> } {
  const pool = mysql.createPool({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 3306),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    connectionLimit: 4,
    supportBigNumbers: true,
  });
  const wrap = (runner: Pick<mysql.Pool, 'query'>): SqlClient => ({
    async query<T>(sql: string, params: unknown[] = []) {
      const [rows] = await runner.query(sql, params);
      return rows as T[];
    },
    async execute(sql: string, params: unknown[] = []) {
      const [result] = await runner.query<mysql.ResultSetHeader>(sql, params);
      return {
        affected: result.affectedRows,
        insertId: result.insertId ? BigInt(result.insertId) : null,
      };
    },
  });
  return {
    ...wrap(pool),
    async withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const result = await fn(wrap(conn));
        await conn.commit();
        return result;
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    },
    end: () => pool.end(),
  };
}

function createPostgresDb(): Db & { end(): Promise<void> } {
  const pool = new PgPool({ connectionString: requireEnv('DATABASE_URL'), max: 4 });
  const wrap = (runner: {
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
  }): SqlClient => ({
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await runner.query(toPgPlaceholders(sql), params);
      return result.rows as T[];
    },
    async execute(sql: string, params: unknown[] = []) {
      const result = await runner.query(toPgPlaceholders(sql), params);
      return { affected: result.rowCount ?? 0, insertId: null };
    },
  });
  return {
    ...wrap(pool),
    async withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(wrap(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    end: () => pool.end(),
  };
}

const backend = provider === 'postgres' ? createPostgresDb() : createMysqlDb();

export const db: Db = backend;

export async function closePool(): Promise<void> {
  await backend.end();
}
