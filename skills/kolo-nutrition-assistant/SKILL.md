---
name: kolo-nutrition-assistant
description: >
  Use the Kolo MCP server (nutrition memory) well. Trigger whenever the user
  talks about food, meals, diet, weight, body metrics, workouts, calories,
  macros or nutrition goals AND a "kolo" MCP server is connected (tools like
  get_overview, log_meal, search_foods) — or the user asks to connect or set
  up Kolo. Kolo only stores and serves data — every calculation, estimate
  and judgment is YOUR job as the agent.
---

# Working with Kolo

Kolo is the user's nutrition memory: profile, goals, preferences, body
metrics, diet and exercise logs, plus a food-composition database. It is
deliberately dumb — it never analyzes, never estimates, never advises.
You do the thinking; Kolo remembers the numbers.

## Division of labor (the one rule)

| Kolo does | You do |
|---|---|
| Store profile, goals, preferences | Compute BMR/TDEE, calorie & macro targets |
| Store meal/exercise records verbatim | Estimate portions and nutrients from photos/text |
| Serve per-100g food data + official reference values (NRV/DRI) | Convert to actual intake, judge adequacy, spot trends, give advice |
| Sum raw daily totals | Compare against targets, explain, recommend |

Never present Kolo's raw sums as advice, and never store your opinions in
Kolo — write facts and computed targets only.

## Connecting (when Kolo isn't attached yet)

- Endpoint: `https://<host>/mcp` — MCP Streamable HTTP, stateless.
- Clients with MCP OAuth support (Claude, Hermes, OpenClaw, …): add the
  endpoint URL and a browser sign-in completes authorization — new users
  can register on that same page. No token to handle.
- Headless clients without OAuth: the user creates a personal access token
  on the web dashboard (`/tokens`) and configures
  `Authorization: Bearer kolo_pat_…`.
- If you can edit your host's MCP config yourself, you may set this up for
  the user — but never echo a token back into the chat.

## Session start

Call `get_overview` before any personalized work. It returns profile,
the latest value of every body metric, the active goal and all dietary
preferences in one call.

- `profile` is `null` → onboard: ask for sex, birth date, height, activity
  level and timezone, then `update_profile`. Set `timezone` early — meal and
  metric dates derive from it. Ask which nutrient reference standard fits
  (`cn_nrv` 中国 NRV / `us_dri` US DRI) and store it as
  `nutrient_ref_standard`. Then ask current weight (and body fat % if known)
  and store it via `log_body_metrics` — the profile has no weight field, and
  the metabolic math below needs it. Finish by proposing a goal, not just
  offering one: ask what they're after (lose / maintain / gain, and how
  fast), run the metabolic math below, and present concrete numbers — daily
  calories, protein/carb/fat targets — with a one-line explanation of how
  you got them. Only call `set_goal` after the user confirms or adjusts the
  proposal; never set a goal they haven't seen.
- Respect `preferences` (diet type, religious restrictions, allergens with
  severity, likes/dislikes) in every suggestion you make.

## Metabolic math (yours, not Kolo's)

Inputs come from `get_overview`: sex (use `calc_as` when sex is `other`),
birth date, height, latest `weight` / `body_fat_pct`, activity level.
Compute BMR with Mifflin-St Jeor (or Katch-McArdle when body fat % exists),
multiply by the activity factor (sedentary 1.2 · lightly_active 1.375 ·
moderately_active 1.55 · very_active 1.725 · extra_active 1.9, or
`custom_activity_factor`). Derive calorie/macro targets from the goal type
and rate, then persist them with `set_goal` — include your formula and
deficit in `rationale`. Recompute when weight moves materially.

## Logging meals

1. Identify foods from the photo/description yourself.
2. Look up data before guessing: `search_foods` with a keyword — Chinese
   names hit the 中国食物成分表 and user-created foods; USDA data is
   English, so translate ("鸡胸肉" → "chicken breast"). Packaged product
   with a barcode → pass `barcode`; a local miss automatically queries
   Open Food Facts and caches the result.
3. `get_food` returns per-100g values and household portions
   (`gram_weight`) — scale to the actual amount eaten.
4. `log_meal` accepts up to 30 entries. Two forms per entry:
   - linked: `food_id` + `grams` (description auto-snapshots the name);
   - free-form: `description` only, for dishes not worth a lookup.
   Both REQUIRE the `nutrients` snapshot (energy_kcal, protein_g, carb_g,
   fat_g at minimum) as ACTUAL INTAKE, not per-100g. Set `source`
   (photo/text/barcode/manual), your `confidence` (0–1), and
   `original_description` with what you actually saw — it is the audit
   trail.
5. The user eats the same homemade dish repeatedly → `create_food` once
   (per-100g basis, private to the user), then link it in later logs.
6. Timezone: entries fall back to `profile.timezone`; pass `timezone`
   explicitly when the user is travelling.

Corrections: `update_meal_entry` for fixes, `delete_meal_entries` for
removals — confirm with the user before deleting.

## Exercise, body metrics

- Workouts: estimate energy burned yourself (MET tables, device screenshots,
  duration × intensity) and store via `log_exercise` (≤20 entries; category,
  intensity, duration_min, distance_km, extra_metrics like avg_hr_bpm).
- Measurements: `log_body_metrics` (≤20). One value per metric type per
  local day — a same-day re-log overwrites (`replaced: true`). Units are
  fixed by the type: weight=kg, body_fat_pct=%, circumferences=cm.

## Reviewing progress

- `get_daily_summary` (≤31 days): per-day intake totals, per-meal breakdown
  and exercise sums. Days with only exercise have `totals: null`.
- `get_body_metric_trend` (≤366 days, bucket day/week/month): raw series +
  per-bucket avg/min/max/first/last. Weight talk should use weekly averages —
  daily fluctuation is noise. Compare bucket deltas against the goal's
  `weekly_rate_kg` yourself.
- `get_nutrient_references` (no args once the profile is set): official
  NRV/DRI values matched to the user's standard, sex and age. Read the
  per-value `note`s — some values are upper-limit style (fat, sodium), DRI
  distinguishes RDA from AI, and units matter (µg RE vs µg RAE).

## Conventions and pitfalls

- Read `references/tools.md` for the full 21-tool reference.
- All list tools paginate: pass `cursor` from `next_cursor` until absent.
- Errors arrive as `{"error":{"code","message"}}` — VALIDATION messages say
  exactly what to fix (e.g. missing timezone → call `update_profile` first);
  NOT_FOUND may mean the record belongs to another account.
- Food values are per 100 g edible portion; missing nutrient = unknown,
  never zero. Energy is kcal everywhere.
- `search_foods` results carry a `source`; `get_food` includes license
  attribution — mention "data from Open Food Facts" (ODbL) when you display
  OFF-sourced data.
- Keep the user's token secret; never echo it into chat or logs.
