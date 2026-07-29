import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { mcp } from 'better-auth/plugins';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { ALL_SCOPES } from '@/lib/auth/scopes';

// OIDC standard scopes + Kolo tool scopes. Kolo's 'profile' scope
// intentionally shares the OIDC 'profile' name — renaming would migrate
// stored PAT scopes and the agent skill for no gain.
const MCP_SCOPES = [...new Set(['openid', 'profile', 'email', 'offline_access', ...ALL_SCOPES])];

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
  // Phase 2: OAuth 2.1 authorization server for MCP clients. Provides
  // authorize/token/DCR (/api/auth/mcp/register) endpoints; discovery is
  // re-exported at /.well-known/oauth-authorization-server. Unauthenticated
  // authorize requests redirect to loginPage with the OAuth query attached;
  // the sign-in/sign-up pages navigate back to the authorize endpoint.
  plugins: [
    mcp({
      loginPage: '/sign-in',
      // Must match the MCP URL clients connect to character-for-character
      // (RFC 8707), and the `resource` in oauth-protected-resource.
      resource: `${env.BETTER_AUTH_URL.replace(/\/$/, '')}/mcp`,
      oidcConfig: {
        loginPage: '/sign-in',
        // What the authorization server accepts.
        scopes: MCP_SCOPES,
        // Feeds scopes_supported in the protected-resource metadata builder.
        metadata: { scopes_supported: MCP_SCOPES },
      },
      // What /.well-known/oauth-authorization-server advertises. The AS
      // metadata builder spreads a top-level `metadata` key that MCPOptions
      // doesn't declare (better-auth 1.6.25) — the spread below bypasses the
      // excess-property check on purpose.
      ...{ metadata: { scopes_supported: MCP_SCOPES } },
    }),
  ],
});
