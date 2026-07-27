import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// DB_PROVIDER=mysql (default) | postgres — selects the schema flavor and the
// per-engine migration history. After switching, re-run `prisma generate`.
const provider = process.env.DB_PROVIDER === 'postgres' ? 'postgres' : 'mysql';

export default defineConfig({
  schema: provider === 'postgres' ? 'prisma/schema.postgres.prisma' : 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: provider === 'postgres' ? 'prisma/migrations-postgres' : 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
