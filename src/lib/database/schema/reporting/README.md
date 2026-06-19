# Reporting schema — design migrations (Phase 4 foundation)

These SQL files are the **additive, idempotent** schema for the reporting platform
foundation. They implement the proposed objects from the architecture docs in
`docs/Report System/`:

- `reporting-platform-architecture.md` (Phase 1) — read-side fabric, §9 schemas.
- `reporting-data-collection-architecture.md` (Phase 2) — event spine, status
  history, dimensions, snapshots (§3, §6, §7, §8, §9, §10).
- `reporting-kpi-catalogue-architecture.md` (Phase 3) — KPI definitions.

## Principles (from the docs)

- **Additive only.** Every statement is `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX
  IF NOT EXISTS`. Nothing here alters or drops an operational table (ADR-9, Principle 4).
- **No DB triggers.** History/events are app-emitted via `src/lib/database/reporting/*`
  helpers (ADR-3 / ADR-21). These files create tables only.
- **Graceful degradation.** The application data layer checks table existence before
  querying (`tableAvailability.js`); if a table here is not yet applied, reporting
  returns empty, non-erroring results (Principle 9). So applying these migrations is
  a deploy step that **unlocks** capability — the app does not break without them.

## RLS — mandatory on every table

**Every table created by these migrations MUST have Row Level Security enabled.**
Each migration file ends with an `ALTER TABLE … ENABLE ROW LEVEL SECURITY;` block
covering every table it creates (001–005 already do).

- These tables are **server-only**: written and read exclusively via the
  service-role client (`supabaseService`) in `src/lib/database/reporting/*`. The
  service role **bypasses RLS**, so enabling RLS does not affect reporting.
- Enabling RLS with **no policy** is intentional: it makes the table
  **deny-by-default** for the anon/authenticated keys, so a reporting table can
  never be read or written from the browser.
- `ENABLE ROW LEVEL SECURITY` is **idempotent** — re-running a migration is safe.
- If a future table genuinely needs client (anon-key) access, add it deliberately
  with an explicit, scoped `CREATE POLICY` — never by leaving RLS off.

**Rule for every new migration in this folder (006+):** the file is not complete
until it ends with an `ENABLE ROW LEVEL SECURITY` statement for each table it
creates. No reporting table ships with RLS disabled.

## Files (apply in order)

> **Shortcut:** `000_all_reporting.sql` is the full schema (001–005) in one
> ready-to-run script, ordered so every FK resolves. Paste it into the Supabase
> SQL editor and run it once instead of applying the five files individually. It
> is additive + idempotent (safe to re-run) and mirrors the per-section files
> below exactly.

| File | Creates | Doc ref |
|---|---|---|
| `001_dimensions.sql` | `dim_department`, `dim_actor`, `dim_kpi` | P2 §7, §8.4, §14.3 |
| `002_report_event.sql` | `report_event` (the event spine) + indexes | P2 §3.1 |
| `003_status_history.sql` | per-entity `*_status_history` tables | P2 §6 |
| `004_kpi_snapshots.sql` | `kpi_daily/weekly/monthly/quarterly/yearly_snapshot` + entity-state snapshots | P2 §9, §10 |
| `005_saved_views.sql` | `report_saved_view`, `report_user_preferences` | P1 §10 |

## How to apply

These are not auto-run. Apply them to Supabase via the SQL editor / migration
tooling when the team is ready to turn on the corresponding capability:

- Dimensions + `report_event` + status-history → unlocks event/history capture (P4).
- Snapshots → unlocks trend/aggregation (P6).
- Saved views → unlocks saved filters/preferences (P6).

After applying, seed `dim_department` from `src/lib/reporting/config/departments.js`
(or call the seeding helper in `src/lib/database/reporting/dimDepartment.js`).

## Not included here (later phases, per the docs)

- CHECK constraints collapsing free-text statuses (P7) — reporting normalises in
  app code via `statusMaps.js` until then.
- Missing domain entities: `suppliers`, `mot_tests`(+advisories), paint stage model,
  `wash_completed_at`, `warranty_claims` (P7 / TD-E).
- Cold-archive tables for `report_event` retention (P9 / §12).
