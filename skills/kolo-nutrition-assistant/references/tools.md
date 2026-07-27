# Kolo MCP tool reference (21 tools)

All inputs/outputs use snake_case. Ids are strings. Dates are `YYYY-MM-DD`
(user-local); instants are ISO 8601 with offset. Paginated tools take
`limit` (default 20) + `cursor` and return `items` + optional `next_cursor`.

## Overview & profile — scope `profile`

| Tool | Purpose |
|---|---|
| `get_overview` | Everything at once: profile, latest value per body metric, active goal, preferences. Call first. |
| `update_profile` | Partial update: sex, calc_as (BMR basis when sex=other), birth_date, height_cm, activity_level (sedentary/lightly_active/moderately_active/very_active/extra_active), custom_activity_factor, timezone (IANA), nutrient_ref_standard (cn_nrv/us_dri), note. Only the nullable fields accept null to clear: calc_as, custom_activity_factor, nutrient_ref_standard, note — the rest reject null. |

## Goals — scope `profile`

| Tool | Purpose |
|---|---|
| `set_goal` | Without `goal_id`: creates a goal (goal_type required: fat_loss/muscle_gain/maintenance/recomposition/performance/health) and archives the previous active one. With `goal_id`: updates — use to write back daily_calorie_target, protein/carb/fat/fiber targets, water_target_ml and your `rationale`. |
| `list_goals` | History, newest first. `include_ended` for archived goals. |

## Preferences — scope `profile`

| Tool | Purpose |
|---|---|
| `update_preferences` | Field-wise full replacement: diet_type (omnivore…vegan), religious_diets[] (closed enum: halal/kosher/hindu_no_beef/buddhist), allergens[] ({allergen, severity: allergy/intolerance/avoid, note}; slugs like milk/peanuts/…, or `other:<text>`), tags[] ({kind: like/dislike/avoid_ingredient/cuisine/texture/other, label}). Provide a field → it replaces the stored set; omit → unchanged; `[]` clears. |

## Body metrics — scope `profile`

| Tool | Purpose |
|---|---|
| `log_body_metrics` | Batch ≤20 of {metric_type, value, measured_at?, source?, note?}. Types (unit fixed): weight(kg), body_fat_pct(%), waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, muscle_mass_kg(kg), visceral_fat(level). ⚠ source enum differs from the log tools: manual/smart_scale/agent only (default agent) — photo/device are invalid here. One row per type per local day; re-log overwrites. |
| `list_body_metrics` | Filter metric_types/from/to; `latest_only: true` → newest per type. |
| `get_body_metric_trend` | One metric over ≤366 days. `bucket`: day/week(ISO, default)/month. Returns raw `points` + `buckets` with avg/min/max/first/last/count. |

## Foods — scope `food`

| Tool | Purpose |
|---|---|
| `search_foods` | `query` (keyword) OR `barcode` — exactly one. Optional source (usda_fdc/off/cfct/custom) and data_type filters, limit ≤50. Chinese hits 中国食物成分表 + custom foods; translate to English for USDA. Barcode miss → live Open Food Facts lookup, cached 30 days. |
| `get_food` | Full record by food_id: per-100g nutrients (missing = unknown), long-tail extras, household portions with gram_weight, source + license attribution, status (retired stays readable). |
| `create_food` | Private custom food: name (+name_zh/name_en/brand/aliases), per_100g (energy_kcal, protein_g, fat_g, carb_g required), optional portions [{description, gram_weight}]. For recurring homemade dishes. |

## Diet logs — scope `diary`

| Tool | Purpose |
|---|---|
| `log_meal` | Batch ≤30. Each entry: eaten_at (+ timezone unless profile has one), meal_type (breakfast/lunch/dinner/snack), then `food_id` and/or `description`, amount fields (amount_input/unit_input/grams), REQUIRED `nutrients` snapshot as actual intake — exact keys: energy_kcal, protein_g, carb_g, fat_g (required) + fiber_g, sugar_g, sat_fat_g, sodium_mg (optional; note sodium is in mg). Unknown keys are silently dropped, so spelling matters. Also: source (photo/text/barcode/manual/import), confidence, original_description, note. |
| `update_meal_entry` | Partial fix by entry_id; nutrients replace wholesale; date re-derives if eaten_at/timezone change. |
| `delete_meal_entries` | Batch ≤50 by id; unknown ids come back in `not_found`. |
| `list_meals` | localDate range ≤92 days, optional meal_type/food_id filters. |
| `get_daily_summary` | Range ≤31 days: per-day totals + by_meal_type + exercise sums {entry_count, energy_kcal, duration_min}. Raw sums only. |

## Exercise — scope `diary`

| Tool | Purpose |
|---|---|
| `log_exercise` | Batch ≤20: started_at (+timezone fallback), activity, category (cardio/strength/flexibility/sports/daily_activity/other), intensity (low/moderate/high), duration_min, distance_km, REQUIRED energy_kcal (your estimate), extra_metrics (numeric, keys carry units), source (photo/text/device/manual/import), confidence, original_description. |
| `update_exercise_entry` | Partial fix by entry_id. Unlike update_meal_entry it has no source/original_description fields — those are set at log time only. |
| `delete_exercise_entries` | Batch ≤50; `not_found` reported. |
| `list_exercises` | localDate range ≤92 days, optional category filter. |

## References — scope `profile`

| Tool | Purpose |
|---|---|
| `get_nutrient_references` | Official table: cn_nrv (single adult table) or us_dri (RDA/AI + upper_limit by sex × age group). Defaults derive from the profile; override with standard, sex (male/female) and age_group (exact enum: "19-30", "31-50", "51-70", "71+"). Values carry kind (NRV/RDA/AI), units and provenance notes — read them before judging adequacy. |
