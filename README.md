# Kolo

Kolo is a headless nutrition-data backend for AI agents. It stores clean food
nutrition data and user records, and exposes everything through an MCP
(Model Context Protocol) server. **Kolo never analyzes or estimates** — photo
recognition, BMR/TDEE math, and dietary analysis are the calling agent's job.
Kolo provides base data and structured storage, nothing else.

## What it does

1. **Food nutrition database** — cleaned and imported from USDA FoodData
   Central, Open Food Facts (barcode lookups), and the China Food Composition
   Tables (user-supplied data via CSV template).
2. **User data over MCP** — profile (inputs for metabolic calculations),
   goals, dietary preferences, body metrics, and structured diet logs written
   back by the user's own agent.
3. **Auth** — the web UI only handles sign-up/sign-in and issuing personal
   access tokens (PAT) that authorize agents against the MCP endpoint.
   OAuth 2.1 for hosted connectors (claude.ai) is planned as phase 2.

## Stack

Next.js (App Router) · Prisma 7 (MySQL **or** PostgreSQL, driver adapters) ·
better-auth · mcp-handler (stateless Streamable HTTP) · shadcn/ui

## Choosing a database engine

Kolo runs on MySQL 8.4 (default) or PostgreSQL 15+ (e.g. Supabase), selected
by `DB_PROVIDER` in `.env`:

| | mysql (default) | postgres |
|---|---|---|
| Runtime config | `DB_HOST/PORT/USER/PASSWORD/NAME` | `DATABASE_URL` |
| Prisma schema | `prisma/schema.prisma` (canonical) | `prisma/schema.postgres.prisma` (generated — edit the canonical file, then `npm run db:gen-pg-schema`) |
| Migrations | `prisma/migrations/` | `prisma/migrations-postgres/` |
| Chinese/English food search | FULLTEXT ngram index | pg_trgm GIN index |

After switching `DB_PROVIDER`, re-run `npx prisma generate` (the generated
client is engine-specific), then `npx prisma migrate deploy`.

For Supabase use the **session pooler** URL (direct connections are
IPv6-only): `postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=no-verify`.
Schema changes must be applied to both engines: generate the MySQL migration
with `prisma migrate dev`, regenerate the PG schema, and produce the PG
migration with `prisma migrate diff` into `prisma/migrations-postgres/`.

## Development

```bash
cp .env.example .env
docker compose up -d        # MySQL 8.4 on localhost:3307 (ngram parser enabled)
npm install                 # postinstall runs prisma generate
npm run db:migrate          # apply migrations
npm run db:check            # verify DB connectivity
npm run dev                 # http://localhost:3000
```

MCP endpoint: `POST /mcp` with `Authorization: Bearer kolo_pat_...`

```bash
claude mcp add --transport http kolo http://localhost:3000/mcp \
  --header "Authorization: Bearer <your token>"
```

## Teaching your agent to use Kolo

`skills/kolo-nutrition-assistant/` is an agent skill for the *consumer* side:
it teaches any skill-capable agent (Claude Code, etc.) the Kolo workflow —
overview first, how to log meals and workouts, which math is the agent's
job, and the full 21-tool reference. Install it into your agent with:

```bash
npx skills add 9b9387/kolo.ai
```

Then connect the MCP server with a token from the Tokens page.

## Deploying (Vercel + Supabase)

The production deployment runs on Vercel with Supabase Postgres:

1. `vercel link`, then set production env vars: `DB_PROVIDER=postgres`,
   `DATABASE_URL` (use the Supabase **transaction pooler**, port 6543, with
   `?sslmode=no-verify` — serverless functions need pooled connections),
   `BETTER_AUTH_SECRET` (real secret), `BETTER_AUTH_URL` (the production URL).
2. Migrations apply automatically: pushing a change under
   `prisma/migrations-postgres/` to main triggers
   `.github/workflows/migrate-production.yml` (`prisma migrate deploy`).
   One-time setup: add the `PRODUCTION_DATABASE_URL` repo secret — the
   Supabase **session pooler** URL (port 5432, `?sslmode=no-verify`); the
   transaction pooler does not support migrate. Manual fallback from any
   machine:
   `DB_PROVIDER=postgres DATABASE_URL=<session-pooler-url> npx prisma migrate deploy`.
3. `vercel deploy --prod`. The build's postinstall generates the
   Postgres-flavored Prisma client from the env vars.

ETL imports run from a developer machine against the same `DATABASE_URL` —
they are not part of the deployment.

## Importing food data

```bash
npm run etl:usda                 # USDA FDC: SR Legacy + Foundation + FNDDS (~13.7k foods)
npm run etl:cfct -- --file my-cfct.csv --label "标准版第6版"
```

- USDA downloads the official CSV packages into `etl/.cache/` (release
  URLs live in `etl/usda/config.ts`; FDC publishes updates in April and
  October — re-run after bumping the version there).
- 中国食物成分表 has no public dataset: fill `docs/cfct-template.csv` with
  your own legally obtained data (rules in `docs/cfct-template.md`), then
  import it. `etl/cfct/from-sanotsu.ts` can convert the community OCR repo
  for strictly local use — spot-check against the book and never
  redistribute the output.
- Open Food Facts is queried live per barcode (rate-limited, cached 30
  days as `dataType='off_api'`) — no bulk import in phase 1.
- Imports are idempotent (`(sourceId, sourceKey)` + content hash): re-runs
  skip unchanged rows, full runs retire rows the source dropped.

## Data sources & licensing

See `NOTICE.md` (added with the ETL milestone) for attribution. Sources are
kept strictly isolated per record — no cross-source merging — to honor each
dataset's license (USDA: public domain; Open Food Facts: ODbL; China Food
Composition Tables: user-provided, not redistributable).
