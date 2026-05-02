---
name: strava-training-db
description: >-
  Query and interpret Strava-style training data stored in this project's Postgres
  (activities, streams). Use when the user asks about volume, trends, MCP tools,
  coaching from stored workouts, or schema of fitness tables.
---

# Strava-style training data (this repo)

## Tables (Postgres / Drizzle)

- **`activities`** — one row per workout (`sport`, `start_time` UTC, `distance_meters`, `duration_seconds`, power/HR summaries, elevation, etc.).
- **`activity_data_points`** — time series per activity (`activity_id` FK, `timestamp`, `lat`, `lng`, `heart_rate`, `power`, …). Large; always cap rows.

Drizzle column names in TypeScript are camelCase; **raw SQL and MCP tool JSON use snake_case** (`start_time`, `distance_meters`, …).

## MCP tools (when connected)

- `list_activities` — optional `sport`, `from`/`to` ISO range, `limit` (≤100).
- `get_training_stats` — aggregates; `groupBy`: `none` | `sport` | `week` | `month` (UTC buckets).
- `get_activity_detail` — `id` required; optional `includeDataPoints` + `dataPointsLimit` (≤500).

Prefer tools for **any numeric fact**; do not invent PRs, weekly mileage, or TSS.

## Coaching metrics

- **Volume**: sum `distance_meters` / `duration_seconds`, bucket `start_time` in UTC unless the user specifies a timezone.
- **TSS / load**: **not stored**. Offer duration × intensity cautiously, or NP-based heuristics only when power fields exist; label approximations clearly.

## Safety

- Use read-oriented queries; cap list sizes and stream samples.
- When exploring `activity_data_points`, avoid unbounded `SELECT *` without `LIMIT`.
