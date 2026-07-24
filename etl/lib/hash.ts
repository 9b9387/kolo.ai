// Content hashing for idempotent imports. contentHash(payload) must be stable
// across runs and machines, so objects are serialized with sorted keys and
// undefined values are skipped (matching JSON.stringify semantics).
import { createHash } from 'node:crypto';

/**
 * Deterministic JSON serialization: object keys sorted recursively (code-unit
 * order), undefined object values skipped, undefined array items become null.
 * NaN/Infinity serialize as null (same as JSON.stringify); bigint serializes
 * as its decimal string.
 */
export function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'number':
    case 'boolean':
    case 'string':
      return JSON.stringify(value);
    case 'bigint':
      return JSON.stringify(value.toString());
    case 'object':
      break;
    default:
      // undefined / function / symbol at the top level
      return 'null';
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => (item === undefined ? 'null' : stableStringify(item)));
    return `[${items.join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

/** sha1 hex (40 chars) of the stable serialization of a normalized payload. */
export function contentHash(payload: unknown): string {
  return createHash('sha1').update(stableStringify(payload), 'utf8').digest('hex');
}
