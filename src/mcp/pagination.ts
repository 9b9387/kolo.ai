import { ToolError } from './types';

type CursorKey = (string | number)[];

// Opaque keyset cursor: base64url({ v: 1, k: [<sort values…>, <id>] }).
export function encodeCursor(key: CursorKey): string {
  return Buffer.from(JSON.stringify({ v: 1, k: key })).toString('base64url');
}

export function decodeCursor(cursor: string): CursorKey {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (parsed?.v !== 1 || !Array.isArray(parsed.k)) throw new Error('bad shape');
    return parsed.k;
  } catch {
    throw new ToolError('VALIDATION', 'invalid cursor');
  }
}
