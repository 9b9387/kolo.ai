import { z } from 'zod';

const PLACEHOLDER_SECRETS = /^(change-me|dev-only-)/;

const envSchema = z
  .object({
    // mysql (default): discrete DB_* vars feed the mariadb adapter.
    // postgres: DATABASE_URL feeds the pg adapter (append ?sslmode=no-verify
    // for hosted providers like Supabase whose chain isn't in the trust store).
    DB_PROVIDER: z.enum(['mysql', 'postgres']).default('mysql'),
    DATABASE_URL: z.string().url().optional(),
    DB_HOST: z.string().min(1).optional(),
    DB_PORT: z.coerce.number().int().positive().default(3306),
    DB_USER: z.string().min(1).optional(),
    DB_PASSWORD: z.string().min(1).optional(),
    DB_NAME: z.string().min(1).optional(),
    // Fail fast on missing/placeholder auth config instead of booting with a
    // guessable session-signing secret (better-auth itself only warns).
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, 'BETTER_AUTH_SECRET must be at least 32 chars (openssl rand -base64 32)')
      .refine(
        // `next build` also runs with NODE_ENV=production — only the serving
        // process should refuse placeholder secrets.
        (s) =>
          process.env.NODE_ENV !== 'production' ||
          process.env.NEXT_PHASE === 'phase-production-build' ||
          !PLACEHOLDER_SECRETS.test(s),
        'BETTER_AUTH_SECRET is a placeholder — generate a real secret for production',
      ),
    BETTER_AUTH_URL: z.string().url(),
  })
  .superRefine((value, ctx) => {
    if (value.DB_PROVIDER === 'postgres') {
      if (!value.DATABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DATABASE_URL'],
          message: 'DATABASE_URL is required when DB_PROVIDER=postgres',
        });
      }
      return;
    }
    for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const) {
      if (!value[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when DB_PROVIDER=mysql`,
        });
      }
    }
  });

export const env = envSchema.parse({
  DB_PROVIDER: process.env.DB_PROVIDER,
  DATABASE_URL: process.env.DATABASE_URL,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
});
