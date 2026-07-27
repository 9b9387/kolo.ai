import { PrismaClient } from '@/generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '@/lib/env';

// The generated client is provider-specific: switching DB_PROVIDER requires
// re-running `prisma generate` (prisma.config.ts picks the schema flavor).

function createAdapter() {
  if (env.DB_PROVIDER === 'postgres') {
    return new PrismaPg({
      connectionString: env.DATABASE_URL,
      max: 10,
    });
  }
  return new PrismaMariaDb({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: 10,
    // MySQL 8.4 defaults to caching_sha2_password; without TLS the driver must
    // fetch the server RSA key to send credentials. Safe on localhost/private nets.
    allowPublicKeyRetrieval: true,
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: createAdapter() });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
