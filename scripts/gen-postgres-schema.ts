import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Derives prisma/schema.postgres.prisma from the canonical MySQL schema.
// Single source of truth: edit schema.prisma, then `npm run db:gen-pg-schema`.
// Transforms:
//   1. datasource provider mysql → postgresql
//   2. drop the fullTextIndex preview flag (MySQL-only)
//   3. @@fulltext(...) → GIN trigram index (pg_trgm; the CREATE EXTENSION
//      lives in the hand-written Postgres migration)
//   4. strip MySQL-only (length: N) index arguments

const root = join(import.meta.dirname, '..');
const source = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');

const HEADER = `// GENERATED FILE — do not edit. Derived from schema.prisma by
// scripts/gen-postgres-schema.ts (npm run db:gen-pg-schema).

`;

let out = source
  .replace('provider = "mysql"', 'provider = "postgresql"')
  .replace(/^\s*previewFeatures = \["fullTextIndex"\]\n/m, '')
  .replace(
    /^\s*@@fulltext\(\[searchText\], map: "ft_food_search"\)\n/m,
    '  @@index([searchText(ops: raw("gin_trgm_ops"))], type: Gin, map: "ft_food_search")\n',
  )
  .replace(/\(length: \d+\)/g, '');

out = HEADER + out;

writeFileSync(join(root, 'prisma', 'schema.postgres.prisma'), out);

// Fail loudly if a MySQL-only construct slipped through the transform
// (structural patterns only — comments may mention them).
const MYSQL_ONLY: [string, RegExp][] = [
  ['@@fulltext attribute', /^\s*@@fulltext\(/m],
  ['length-prefixed index arg', /\(length: \d+\)/],
  ['mysql provider', /provider = "mysql"/],
  ['fullTextIndex preview', /previewFeatures.*fullTextIndex/],
];
for (const [name, pattern] of MYSQL_ONLY) {
  if (pattern.test(out)) {
    console.error(`gen-postgres-schema: untransformed ${name} — extend the script`);
    process.exit(1);
  }
}
console.log('prisma/schema.postgres.prisma written.');
