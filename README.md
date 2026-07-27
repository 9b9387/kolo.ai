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

Next.js (App Router) · Prisma 7 (MySQL 8.4, mariadb driver adapter) ·
better-auth · mcp-handler (stateless Streamable HTTP) · shadcn/ui

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
