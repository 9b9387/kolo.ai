import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/lib/db';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'mysql' }),
  emailAndPassword: {
    enabled: true,
  },
  // Phase 2 (OAuth 2.1 for hosted connectors): add the oauth-provider plugin
  // here; verify-mcp-token.ts is the only other file that needs changes.
});
