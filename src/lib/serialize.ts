import { Prisma } from '@/generated/prisma/client';

// Every MCP tool result passes through here before JSON serialization.
// BigInt (food ids) → string, Prisma.Decimal → number, Date → ISO string.
export function serialize<T>(value: T): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serialize(v)]),
    );
  }
  return value;
}
