// MySQL connection pool for the ETL scripts. Reads the same DB_* variables as
// the Next.js app (src/lib/env.ts) but talks to mysql2 directly — Prisma is
// too slow for bulk multi-row upserts.
import 'dotenv/config';
import mysql from 'mysql2/promise';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name} (see .env)`);
  }
  return value;
}

export const pool: mysql.Pool = mysql.createPool({
  host: requireEnv('DB_HOST'),
  port: Number(process.env.DB_PORT ?? 3306),
  user: requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_NAME'),
  connectionLimit: 4,
  supportBigNumbers: true,
});

export async function closePool(): Promise<void> {
  await pool.end();
}
