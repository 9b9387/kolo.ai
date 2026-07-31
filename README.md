# Kolo

[![Live demo](https://img.shields.io/badge/demo-kolo.biubiu.cool-6aa84f?logo=vercel&logoColor=white)](https://kolo.biubiu.cool)
[![Migrate production](https://github.com/9b9387/kolo.ai/actions/workflows/migrate-production.yml/badge.svg)](https://github.com/9b9387/kolo.ai/actions/workflows/migrate-production.yml)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![Prisma 7](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-Streamable_HTTP-4A154B?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io)
[![Deployed on Vercel](https://img.shields.io/badge/Vercel-deployed-000000?logo=vercel&logoColor=white)](https://vercel.com)
[![Supabase Postgres](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Kolo is a headless nutrition-data backend for AI agents. It stores clean food
nutrition data and user records, and exposes everything through an MCP
(Model Context Protocol) server. **Kolo never analyzes or estimates** — photo
recognition, BMR/TDEE math, and dietary analysis are the calling agent's job.
Kolo provides base data and structured storage, nothing else.

**Try it live**: <https://kolo.biubiu.cool> — sign up, then point any
MCP-capable agent at `https://kolo.biubiu.cool/mcp`. OAuth-capable clients
(Claude, Hermes, OpenClaw, …) authorize with a browser sign-in; headless
clients use a personal access token from the Tokens page.

## What it does

1. **Food nutrition database** — cleaned and imported from USDA FoodData
   Central, Open Food Facts (barcode lookups), and the China Food Composition
   Tables (user-supplied data via CSV template).
2. **User data over MCP** — profile (inputs for metabolic calculations),
   goals, dietary preferences, body metrics, and structured diet logs written
   back by the user's own agent.
3. **Auth** — OAuth 2.1 for MCP clients (discovery + dynamic client
   registration + PKCE; a browser sign-in completes authorization, and
   OAuth grants are managed on the Connected apps page), plus personal
   access tokens (PAT) for headless clients, issued on the Tokens page.

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

## Self-hosting (local / on-prem, Docker)

The `docker compose` stack runs the whole app — the production Next.js image
(`Dockerfile`, standalone output) plus MySQL 8.4 — on one machine. This is the
self-contained deployment; the `## Development` flow above is for editing code
with `npm run dev`.

```bash
cp .env.example .env
```

Set these in `.env` (the compose file injects `DB_HOST`, `DB_PORT` and
`DATABASE_URL` for the `mysql` service automatically — leave those out):

```ini
DB_PROVIDER=mysql
DB_USER=kolo
DB_PASSWORD=kolo_dev        # must match docker-compose.yml
DB_NAME=kolo
BETTER_AUTH_SECRET=         # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
```

Then build, start, and apply migrations (a one-off container on the compose
network — the running `web` image does not migrate on boot):

```bash
docker compose up -d --build                       # web on :3000, mysql on :3307
docker compose run --rm web npx prisma migrate deploy
```

The app is now at <http://localhost:3000>; the MCP endpoint is
`http://localhost:3000/mcp`. For a real host, set `BETTER_AUTH_URL` to the
public HTTPS URL, put a TLS-terminating reverse proxy in front (OAuth
discovery advertises whatever `BETTER_AUTH_URL` says — it must match the URL
clients connect to), and use a strong `DB_PASSWORD`.

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
