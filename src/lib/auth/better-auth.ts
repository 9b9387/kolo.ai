import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: env.DB_PROVIDER === 'postgres' ? 'postgresql' : 'mysql',
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  // Always on (better-auth only enables it when NODE_ENV=production).
  // In-memory storage is per-instance: switch to database storage before
  // any multi-instance/serverless deployment. Before opening sign-up to
  // the public internet, also add email verification or a captcha plugin.
  rateLimit: {
    enabled: true,
  },
  // Phase 2 (OAuth 2.1 for hosted connectors): add the oauth-provider plugin
  // here; verify-mcp-token.ts is the only other file that needs changes.
});
