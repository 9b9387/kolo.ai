import { createHash, randomBytes } from 'node:crypto';

export const PAT_PREFIX = 'kolo_pat_';

export function hashPat(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// 256-bit entropy; only the SHA-256 hex ever touches the database, so a
// plain (indexable, O(1)-lookup) hash is sufficient — no salt needed for
// high-entropy random tokens.
export function generatePat() {
  const token = PAT_PREFIX + randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashPat(token),
    lastFour: token.slice(-4),
  };
}
