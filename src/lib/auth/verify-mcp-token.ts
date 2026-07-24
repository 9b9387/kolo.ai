import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { prisma } from '@/lib/db';
import { hashPat, PAT_PREFIX } from '@/lib/auth/pat';

const LAST_USED_THROTTLE_MS = 5 * 60_000;

// The single auth cut-point for the MCP endpoint. Phase 2 adds an OAuth
// branch below (better-auth oauth-provider access tokens); both branches
// normalize to the same AuthInfo shape so tools and repos never change.
export async function verifyMcpToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  if (bearerToken.startsWith(PAT_PREFIX)) return verifyPat(bearerToken);
  // Phase 2: return verifyOAuthToken(_req, bearerToken);
  return undefined;
}

async function verifyPat(token: string): Promise<AuthInfo | undefined> {
  const pat = await prisma.personalAccessToken.findUnique({
    where: { tokenHash: hashPat(token) },
  });
  if (!pat || pat.revokedAt) return undefined;
  if (pat.expiresAt && pat.expiresAt < new Date()) return undefined;

  if (!pat.lastUsedAt || Date.now() - pat.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    // Fire-and-forget; a failed timestamp update must not fail the request.
    prisma.personalAccessToken
      .update({ where: { id: pat.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }

  return {
    token,
    clientId: pat.userId,
    scopes: pat.scopes as string[],
    expiresAt: pat.expiresAt ? Math.floor(pat.expiresAt.getTime() / 1000) : undefined,
    extra: { userId: pat.userId, authMethod: 'pat', tokenId: pat.id },
  };
}
