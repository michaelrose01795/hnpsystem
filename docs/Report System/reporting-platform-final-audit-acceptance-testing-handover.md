# HNPSystem - Reporting Platform Final Audit, Acceptance, Testing & Handover (Phase 16)

> Status: Final audit completed against the current codebase; Phase 16.1 final acceptance blocker fixes implemented.
> Scope: Audit, blocker fixes and handover only. No new report packages, KPIs, reporting architecture, shared UI redesign, or platform redesign were built.
> Date audited: 2026-06-29.
> Phase 16.1 updated: 2026-06-29.

---

## 1. Executive Verdict

The reporting implementation is substantial and compiles successfully. Phase 16.1 has now resolved the repository-level Critical and High acceptance blockers identified in the original Phase 16 audit.

The platform has the expected report pages, shared APIs, KPI catalogue, resolver engine, export path, saved-view path, aggregation framework, event catalogue, emit adapter layer, and shared UI components. The build confirms the reporting routes are emitted. Phase 16.1 adds the missing reporting SQL migrations, restores the combined database update path, fixes server-side department-scope enforcement, and exposes the Valeting, Admin and Executive report routes through navigation-derived access.

Overall score after Phase 16.1: **8.2 / 10**

Production readiness: **Repo-ready for staging handover, not unconditionally production-approved until the SQL is applied to the target database and the live browser/database acceptance steps below pass**. The former Critical and High blockers are fixed in the codebase. The remaining caveats are operational deployment checks and the pre-existing Medium UI guard failures (`check:borders`, `check:layers`) outside the reporting blocker scope.

---

## 1.1 Phase 16.1 Fix Summary

Fixed Critical and High blockers:

- **C1 fixed**: restored `src/lib/database/schema/reporting/000_all_reporting.sql` and `001_dimensions.sql` through `006_status_history_workflow.sql`.
- **C1 fixed**: added the same deployable reporting schema SQL to `src/lib/database/schema/addtodatabase.sql`.
- **C2 fixed**: updated `src/lib/reporting/engine.js` so every KPI request must pass both KPI permission and owning/related department scope, even when the caller omits the `department` query parameter.
- **C2 validated**: added a regression test proving a `Techs` user cannot request `prt.stock_value`, while still seeing workshop-scope metrics.
- **H1 fixed**: added sidebar/access entries for `/reports/valeting`, `/reports/admin`, and `/reports/overview` in `src/config/navigation.js`.
- **H2/H3 repo blocker fixed**: the restored schema now includes `report_event`, status-history tables, snapshot tables, `report_aggregation_run`, `report_saved_view`, and `report_user_preferences`.

SQL files restored or added:

- `src/lib/database/schema/reporting/000_all_reporting.sql`
- `src/lib/database/schema/reporting/001_dimensions.sql`
- `src/lib/database/schema/reporting/002_report_event.sql`
- `src/lib/database/schema/reporting/003_status_history.sql`
- `src/lib/database/schema/reporting/004_kpi_snapshots.sql`
- `src/lib/database/schema/reporting/005_saved_views.sql`
- `src/lib/database/schema/reporting/006_status_history_workflow.sql`
- `src/lib/database/schema/addtodatabase.sql`

Tables covered by the restored SQL:

- Dimensions: `dim_department`, `dim_actor`, `dim_kpi`
- Event spine: `report_event`
- Status histories: `parts_job_items_status_history`, `vhc_item_status_history`, `invoice_status_history`, `account_status_history`, `appointment_status_history`, `delivery_status_history`, `mot_test_status_history`, `wash_status_history`, `paint_stage_history`
- Snapshots/lineage: `kpi_daily_snapshot`, `kpi_weekly_snapshot`, `kpi_monthly_snapshot`, `kpi_quarterly_snapshot`, `kpi_yearly_snapshot`, `report_entity_state_snapshot`, `report_aggregation_run`
- User reporting state: `report_saved_view`, `report_user_preferences`

Phase 16.1 command results from `C:\Users\micha\hnpsystem`:

| Command | Result | Notes |
|---|---:|---|
| `npm run validate:reporting` | Passed | 44/44 tests passed, including migration contract and department-scope regression. |
| `npm run build` | Passed | Next.js compiled and emitted all reporting pages/APIs including Valeting, Admin and Executive routes. |
| `npm run check:report-events` | Passed with advisory | Existing advisory remains at `src/lib/database/jobClocking.js:400`; not part of Critical/High blocker scope. |
| `npm run check:borders` | Failed | Existing 33 global CSS border-law violations remain outside reporting Phase 16.1 scope. |
| `npm run check:layers` | Failed | Existing layer-sweep violations remain outside reporting Phase 16.1 scope. |

---

## 2. Documents Used

Every markdown document currently in `docs/Report System/` was used:

- `reporting-accounts-package-implementation.md`
- `reporting-activation-readiness.md`
- `reporting-admin-package-implementation.md`
- `reporting-data-collection-architecture.md`
- `reporting-foundation-implementation.md`
- `reporting-kpi-catalogue-architecture.md`
- `reporting-management-package-implementation.md`
- `reporting-maturity-report.md`
- `reporting-mot-package-implementation.md`
- `reporting-paint-package-implementation.md`
- `reporting-parts-package-implementation.md`
- `reporting-platform-architecture.md`
- `reporting-readiness-audit.md`
- `reporting-service-advisor-package-implementation.md`
- `reporting-valeting-package-implementation.md`
- `reporting-workshop-package-implementation.md`

The Phase 15 maturity report assessed the platform at **8.7 / 10** and "production-ready as a read system today." The original Phase 16 audit lowered that score because SQL files were missing and an API permission gap remained. Phase 16.1 fixes those repository-level blockers and raises the score to **8.2 / 10**, with final production approval dependent on applying the SQL to the target database and completing live acceptance checks.

---

## 3. Code Areas Audited

Primary reporting implementation reviewed:

- Report pages: `src/pages/reports/*.js`
- Report APIs: `src/pages/api/reports/*.js`
- Reporting engine: `src/lib/reporting/engine.js`, `resolver.js`, `trendBuilder.js`, `drilldown.js`, `queryBuilder.js`, `filters.js`, `export.js`, `audit.js`, `api.js`, `envelope.js`
- KPI catalogue: `src/lib/reporting/kpiDefinitions/*.js`, `kpiCatalog.js`
- Reporting config: `src/lib/reporting/config/*.js`
- Aggregation: `src/lib/reporting/aggregation/*.js`, `src/pages/api/cron/aggregate-kpis-*.js`
- Reporting database helpers: `src/lib/database/reporting/*.js`
- Shared UI: `src/components/reporting/**/*.js`, `src/hooks/reporting/useReporting.js`
- Auth and permissions: `src/lib/reporting/permissionScope.js`, `src/lib/auth/roleGuard.js`, `src/components/ProtectedRoute.js`, `src/lib/auth/pageAccess.js`
- Navigation and route access: `src/config/navigation.js`, `src/config/routeAccess.js`
- Schema references: `src/lib/database/schema/schemaReference.sql`, `src/lib/database/schema/reporting/README.md`
- Validation/guards: `src/lib/reporting/validation/reportingActivation.test.js`, `tools/scripts/check-report-events.js`, `tools/scripts/check-borders.js`, `tools/scripts/check-layers.js`

---

## 4. Acceptance Command Results

Run from `C:\Users\micha\hnpsystem`.

| Command | Result | Acceptance impact |
|---|---:|---|
| `npm run build` | Passed | Next.js compiles and emits `/reports/accounts`, `/reports/admin`, `/reports/mot`, `/reports/overview`, `/reports/paint`, `/reports/parts`, `/reports/service`, `/reports/valeting`, `/reports/workshop`, and all `/api/reports/*` routes. |
| `npm run validate:reporting` | Passed | 44/44 tests pass after restoring the reporting SQL migrations and adding the department-scope regression. |
| `npm run check:report-events` | Passed with advisory | Event names are valid. Advisory remains: `src/lib/database/jobClocking.js:400` status-mutating write without paired emit. |
| `npm run check:borders` | Failed | 33 pre-existing border-law violations in global CSS. Blocks clean UI acceptance. |
| `npm run check:layers` | Failed | Pre-existing layer-sweep violations outside reporting. Blocks clean UI acceptance. |

Previous validation failure fixed in Phase 16.1: `src/lib/database/schema/reporting/001_dimensions.sql` through `006_status_history_workflow.sql`, `000_all_reporting.sql`, and `src/lib/database/schema/addtodatabase.sql` are now present.

---

## 5. KPI Audit

Current catalogue count from `src/lib/reporting/kpiDefinitions/*.js`: **115 KPIs**.

| Package | KPIs | R1 | R2 | R3 | Resolvers |
|---|---:|---:|---:|---:|---:|
| Accounts | 14 | 8 | 4 | 2 | 8 |
| Admin | 9 | 4 | 5 | 0 | 8 |
| Management | 12 | 2 | 6 | 4 | 6 |
| MOT | 10 | 5 | 2 | 3 | 6 |
| Paint | 8 | 2 | 1 | 5 | 3 |
| Parts | 20 | 11 | 7 | 2 | 11 |
| Service | 12 | 3 | 7 | 2 | 3 |
| Valeting | 7 | 3 | 1 | 3 | 3 |
| VHC | 4 | 4 | 0 | 0 | 4 |
| Workshop | 19 | 11 | 6 | 2 | 11 |
| **Total** | **115** | **53** | **39** | **23** | **63** |

KPI verdict:

- R1 resolver coverage appears complete by static inspection: every R1 KPI has a resolver.
- R2/R3 blockers are generally declared honestly with no fabricated values.
- Several R2 proxy KPIs have resolvers, especially Admin and Management. This matches the later package docs.
- Static KPI/schema validation is accepted by `npm run validate:reporting`. Full runtime KPI validation still requires the live browser/database spot checks below after applying the SQL to the target Supabase database.

---

## 6. Package Audit

| Package | Route | Build status | Nav status | Acceptance |
|---|---|---|---|---|
| Workshop | `/reports/workshop` | Builds | Sidebar link exists | Provisionally accepted, subject to API permission fix and DB checks. |
| Parts | `/reports/parts` | Builds | Sidebar link exists | Provisionally accepted, subject to API permission fix and DB checks. |
| Service Advisor | `/reports/service` | Builds | Sidebar link exists | Provisionally accepted, subject to API permission fix and DB checks. |
| MOT | `/reports/mot` | Builds | Sidebar link exists | Provisionally accepted, subject to DB checks. |
| Paint | `/reports/paint` | Builds | Sidebar link exists | Provisionally accepted, subject to DB checks. |
| Accounts | `/reports/accounts` | Builds | Sidebar link exists | Provisionally accepted, subject to financial permission testing. |
| Valeting | `/reports/valeting` | Builds | Sidebar link exists after Phase 16.1 | Accepted, subject to live DB checks. |
| Admin | `/reports/admin` | Builds | Sidebar link exists after Phase 16.1 | Accepted, subject to live DB checks. |
| Management | `/reports/overview` | Builds | Sidebar link exists after Phase 16.1 | Accepted, subject to live DB checks. |

Important route-access detail: `_app.js` uses `canAccessPath(pathname, user?.roles)` and redirects inaccessible paths to `/newsfeed`. Since `canAccessPath` derives access from sidebar/topbar entries, Phase 16.1 fixed Valeting/Admin/Executive reachability by adding their report links to `src/config/navigation.js`.

---

## 7. Issues Ranked by Severity

### Critical

**C1 - Reporting SQL migrations are missing - Fixed in Phase 16.1**

- Fix: `src/lib/database/schema/reporting/000_all_reporting.sql` and `001` through `006` SQL files have been restored.
- Fix: `src/lib/database/schema/addtodatabase.sql` now contains the deployable reporting schema SQL.
- Evidence: `npm run validate:reporting` now passes 44/44 tests.
- Affected architecture: `dim_department`, `dim_actor`, `report_event`, status-history tables, snapshot tables, aggregation lineage, saved views, preferences.
- Pass condition: met at repo level. Live database acceptance still requires applying the SQL and confirming rows in the target database.

**C2 - API department-scope enforcement is incomplete - Fixed in Phase 16.1**

- Evidence: `src/lib/reporting/api.js` wraps endpoints with `allow = []`, meaning any authenticated user reaches the report API.
- Fix: `src/lib/reporting/engine.js` now rejects a KPI unless the caller can see the KPI's owning department or one of its declared `relatedDepartments`.
- Fix: `getVisibleCatalog` now applies the same department-scope rule.
- Evidence: `reportingActivation.test.js` now verifies a `Techs` user cannot request `prt.stock_value` without a department filter.
- Pass condition: met at repo level. Live browser/API test is still listed below.

### High

**H1 - Valeting, Admin, and Executive reporting pages are not exposed through navigation - Fixed in Phase 16.1**

- Fix: `src/config/navigation.js` now includes `Valeting Reports`, `Admin Reports`, and `Executive Reports`.
- Evidence: `npm run build` emits `/reports/valeting`, `/reports/admin`, and `/reports/overview`.
- Pass condition: met at repo level. Live browser role checks remain in the testing guide.

**H2 - Event, status-history, and snapshot acceptance is code-complete but not data-complete - Repo schema fixed in Phase 16.1**

- Evidence: `reporting_emit_enabled` defaults to false in `src/lib/reporting/config/flags.js`.
- Fix: event, status-history, snapshot and lineage tables are now present in repo migrations and `addtodatabase.sql`.
- Remaining deployment step: apply SQL to the target database, enable emits deliberately if event capture is being accepted, and schedule crons.
- Pass condition: apply migrations, seed departments/actors, enable emits deliberately, schedule crons, then confirm records accrue.

**H3 - Saved views and preferences cannot be accepted until reporting tables exist - Repo schema fixed in Phase 16.1**

- Fix: `report_saved_view` and `report_user_preferences` now exist in the restored SQL migrations and `addtodatabase.sql`.
- Remaining deployment step: apply SQL to the target database and test create/apply/delete through the browser.
- Pass condition: saving, applying, and deleting a saved view creates/updates/deletes rows in `report_saved_view`.

### Medium

**M1 - UI guard scripts fail**

- Evidence: `npm run check:borders` reports 33 border-law violations.
- Evidence: `npm run check:layers` reports legacy layer violations.
- Impact: Most failures appear pre-existing and not reporting-specific, but Phase 16 cannot certify shared UI compliance while global guards are red.
- Pass condition: both commands exit 0, or documented allowlists are deliberately updated for true functional primitives.

**M2 - One status-mutating write still lacks paired reporting emit coverage**

- Evidence: `npm run check:report-events` advisory: `src/lib/database/jobClocking.js:400`.
- Impact: payroll/clocking edits remain a known capture gap until emit wiring lands.
- Pass condition: `npm run check:report-events -- --strict` exits 0 once emit rollout is intended to be enforced.

**M3 - `/api/reports/data-quality` sends `source: "live"` outside the envelope provenance path**

- Evidence: `src/pages/api/reports/data-quality.js` calls `rctx.sendOk({ data: result, source: "live", warnings: ... })`; `buildEnvelope` does not consume `source` unless it is inside `provenance`.
- Impact: response `meta.source` can remain `"none"` even though data is live.
- Pass condition: the endpoint response meta accurately identifies source/provenance.

**M4 - Master schema reference is not enough for reporting acceptance**

- Evidence: `schemaReference.sql` includes `job_status_history` but not the reporting tables; the separate reporting schema folder currently lacks SQL files.
- Impact: future agents cannot verify reporting columns from `schemaReference.sql` alone.
- Pass condition: either restore reporting migrations and keep them referenced clearly, or update the master schema reference after migrations are applied.

### Low

**L1 - Some page copy describes implementation caveats inside the UI**

- Evidence: report pages include explanatory paragraphs about live/caveated metrics.
- Impact: Useful during rollout, but long operational copy can make the report UI feel like documentation rather than a tool.
- Pass condition: after acceptance, keep caveats in provenance/tooltips or docs and leave the page UI focused on action.

**L2 - Export is synchronous CSV only**

- Evidence: `src/lib/reporting/export.js` supports `csv`; PDF/async export remains later phase.
- Impact: Acceptable for current architecture, but large drill-down exports could need a job model later.
- Pass condition: no immediate action unless export size or PDF acceptance is required.

---

## 8. Production Readiness Checklist

Do not approve production handover until all of these are true:

1. `src/lib/database/schema/reporting/000_all_reporting.sql` and `001`-`006` migration files are present.
2. `npm run validate:reporting` passes.
3. Direct API permission tests prove department scope is enforced by KPI department, not only by page route.
4. Valeting, Admin, and Executive report pages are reachable by intended users.
5. Saved views can be created, applied, and deleted against real `report_saved_view` rows.
6. Exports write `audit_log` rows with `entity_type='report'` and `action='report.export'`.
7. View actions write `audit_log` rows with `entity_type='report'` and `action='report.view'`.
8. If event capture is enabled, report view/export also produce `REPORT_VIEWED` / `REPORT_EXPORTED` rows in `report_event`.
9. Aggregation cron endpoints write snapshot rows and `report_aggregation_run` rows.
10. `npm run check:borders` and `npm run check:layers` are green or intentionally waived.

---

## 9. Step-by-Step Testing Guide

### 9.1 Test preparation

Apply the restored reporting SQL before live database testing:

1. Open Supabase SQL editor for the target staging database.
2. Open `src/lib/database/schema/addtodatabase.sql` in this repo.
3. Paste the whole file into Supabase SQL editor.
4. Run it once. It is idempotent and uses `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and department `ON CONFLICT` seed upserts.
5. If you prefer numbered migrations, run `src/lib/database/schema/reporting/001_dimensions.sql` through `006_status_history_workflow.sql` in order. `000_all_reporting.sql` is the combined equivalent.

Run these commands from `C:\Users\micha\hnpsystem`:

```powershell
git status --short
npm install
npm run validate:reporting
npm run check:report-events
npm run check:borders
npm run check:layers
npm run build
```

Expected result for final acceptance:

- `validate:reporting`: pass.
- `check:report-events`: pass with no advisories when strict capture is required.
- `check:borders`: pass.
- `check:layers`: pass.
- `build`: pass.

Current result:

- `validate:reporting` passes 44/44 after Phase 16.1.
- `check:report-events` passes with one advisory.
- `check:borders` fails.
- `check:layers` fails.
- `build` passes.

If `npm install` fails:

- Confirm Node and npm versions.
- Delete only dependency artifacts if needed: `node_modules` and `package-lock.json` regeneration must be agreed before committing because this repo already has a lockfile.

If `build` fails:

- Fix build errors before browser testing. Do not trust UI testing on a non-buildable reporting platform.

If the SQL apply fails:

- Check the first failing statement in Supabase SQL editor.
- If a table already exists with incompatible columns, stop and inspect the existing live schema before altering it.
- If the error is an RLS/index duplicate, confirm the SQL was not partially edited; the repo scripts use idempotent names.

### 9.2 Database preflight

In Supabase SQL editor, run:

```sql
select
  to_regclass('public.dim_department') as dim_department,
  to_regclass('public.dim_actor') as dim_actor,
  to_regclass('public.report_event') as report_event,
  to_regclass('public.parts_job_items_status_history') as parts_history,
  to_regclass('public.vhc_item_status_history') as vhc_history,
  to_regclass('public.invoice_status_history') as invoice_history,
  to_regclass('public.mot_test_status_history') as mot_history,
  to_regclass('public.wash_status_history') as wash_history,
  to_regclass('public.paint_stage_history') as paint_history,
  to_regclass('public.kpi_daily_snapshot') as kpi_daily_snapshot,
  to_regclass('public.report_aggregation_run') as report_aggregation_run,
  to_regclass('public.report_saved_view') as report_saved_view,
  to_regclass('public.report_user_preferences') as report_user_preferences;
```

Expected:

- Every column returns a `public.<table>` value.

Current expected result after applying Phase 16.1 SQL:

- Every reporting-specific value returns a `public.<table>` value.

If this fails:

- Restore/apply the missing reporting SQL migrations before continuing with saved view, event, snapshot, or aggregation acceptance.

### 9.3 Test users and roles

Seeded local users from `supabase/seed/test-seed.sql`:

| User id | Email | Role | Use for |
|---:|---|---|---|
| 1 | `admin@test.local` | Admin Manager | Admin/management-style access checks, fallback broad access |
| 2 | `service@test.local` | Service | Service Advisor report |
| 3 | `workshop@test.local` | Workshop Manager | Workshop report |
| 4 | `tech@test.local` | Techs | Negative permission checks |
| 5 | `parts@test.local` | Parts Manager | Parts report |
| 7 | `mobile-tech@test.local` | Mobile Technician | Negative/mobile-scope checks |

The seed does not provide Accounts, Owner, MOT Tester, Valet Service, or Painters users. For full manual coverage, add temporary users in a test database only:

```sql
insert into users (user_id, first_name, last_name, email, role, password_hash)
values
  (901, 'Test', 'Accounts', 'accounts-report@test.local', 'Accounts', 'testpass123'),
  (902, 'Test', 'Owner', 'owner-report@test.local', 'Owner', 'testpass123'),
  (903, 'Test', 'MOT', 'mot-report@test.local', 'MOT Tester', 'testpass123'),
  (904, 'Test', 'Valet', 'valeting-report@test.local', 'Valet Service', 'testpass123'),
  (905, 'Test', 'Painter', 'paint-report@test.local', 'Painters', 'testpass123')
on conflict (user_id) do nothing;
```

How to log in:

1. Start dev server:

```powershell
$env:ALLOW_DEV_AUTH='1'
npm run dev
```

2. Open `http://localhost:3000/login`.
3. Use either the Developer Login panel or the email/password form.
4. For email/password, enter the email above and `testpass123`.
5. Confirm you land on `/newsfeed` and the sidebar reflects the user's role.

If login fails:

- Confirm `ALLOW_DEV_AUTH=1` for dev-login by user id.
- Confirm the user exists in Supabase `users`.
- Check `auth_login_attempts` for failure reason:

```sql
select * from auth_login_attempts order by attempted_at desc limit 20;
```

### 9.4 API contract tests

Use browser DevTools Console after logging in, or an API client that keeps the NextAuth cookies.

Test KPI endpoint:

```js
await fetch('/api/reports/kpi?id=wsh.jobs_completed&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

Expected:

- JSON has `success: true`.
- `data.kpiId` is `wsh.jobs_completed`.
- `meta.source` is `snapshot` or live fallback provenance.
- `warnings` is an array.

Test multiple KPI batching:

```js
await fetch('/api/reports/kpi?ids=wsh.jobs_completed,wsh.jobs_created,vhc.red_items&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

Expected:

- `data` is an array with 3 results.
- No client-side math is needed.

Test trend endpoint:

```js
await fetch('/api/reports/trend?id=wsh.jobs_completed&range=last_30d&granularity=day', { credentials: 'include' }).then(r => r.json())
```

Expected:

- `data.series` contains day buckets.
- If snapshots are absent, provenance should clearly say live fallback or unavailable.

Test drill-down endpoint:

```js
await fetch('/api/reports/drilldown?id=wsh.jobs_completed&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

Expected:

- `data.rows` is an array.
- `data.entityType` is populated.

Test catalog endpoint:

```js
await fetch('/api/reports/catalog?department=workshop', { credentials: 'include' }).then(r => r.json())
```

Expected after permission fix:

- A workshop-scoped user sees workshop catalog entries.
- A Techs user should not see unrelated department catalog metadata unless intentionally allowed.

If API tests fail:

- Check server console for `[reporting] route error`.
- Confirm user session at `/api/auth/session`.
- Confirm `reporting_enabled` has not been overridden false.

### 9.5 Permission tests

These are mandatory before production.

Positive test - Workshop Manager:

1. Login as user id 3 or `workshop@test.local`.
2. Open `/reports/workshop`.
3. Expected: page remains on `/reports/workshop`, KPI cards load.
4. In DevTools Console run:

```js
await fetch('/api/reports/kpi?id=wsh.jobs_completed&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

5. Expected: result is allowed.

Negative test - Techs user direct cross-department API:

1. Login as user id 4 or `tech@test.local`.
2. In DevTools Console run:

```js
await fetch('/api/reports/kpi?id=prt.stock_value&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

Expected for acceptance:

- Denied, null, or warning that the KPI is outside scope.

Phase 16.1 expected result:

- `success: true`, `data.value: null`, and warning includes `outside your reporting department scope`.

Related-department control test:

```js
await fetch('/api/reports/kpi?id=prt.requests&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

Expected:

- A workshop-scoped Techs user may see this KPI because `prt.requests` explicitly declares Workshop as a related department. This confirms the fix blocks unrelated departments without breaking approved cross-department report hand-offs.

Financial negative test:

1. Login as user id 4 (`Techs`).
2. Run:

```js
await fetch('/api/reports/kpi?id=acc.revenue&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

Expected:

- No revenue data. Warning says not permitted.

Financial positive test:

1. Login as user id 901 (`Accounts`) or 902 (`Owner`).
2. Open `/reports/accounts`.
3. Run:

```js
await fetch('/api/reports/kpi?id=acc.revenue&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

Expected:

- Revenue KPI resolves or clearly returns live fallback/unavailable due no source data.

If permission tests fail:

- Fix engine-level department scope first. Page-level `ProtectedRoute` is not enough.

### 9.6 Page and UI tests

For each reachable report page:

1. Login as an allowed role.
2. Open the route.
3. Confirm the page title and fixed department label.
4. Change Date range to `Last 7 days`.
5. Change Trend granularity to `Daily`.
6. Type `test` into Search.
7. Click each tab.
8. Click a `View records` button on a drillable KPI.
9. Confirm the drill-down section/table opens.
10. Click `Export CSV`.
11. Open the Reporting Utilities tab.
12. In Saved views, enter `Phase 16 smoke <package>`.
13. Click `Save current filter`.
14. Click the saved view chip.
15. Click delete (`x`) on the saved view chip.

Routes, roles, and key tabs:

| Route | Login role | Tabs to click |
|---|---|---|
| `/reports/workshop` | Workshop Manager user 3 | Overview, Operations, Technician Performance, VHC Performance, Reporting Utilities |
| `/reports/parts` | Parts Manager user 5 | Overview, Parts Operations, Stock & Inventory, Supplier & Ordering, Reporting Utilities |
| `/reports/service` | Service user 2 | Service Overview, Customer Communications, Appointment & Booking, VHC Performance, Reporting Utilities |
| `/reports/mot` | MOT Tester user 903 | MOT Overview, MOT Operations, Tester Activity, Revenue & Conversion, Reporting Utilities |
| `/reports/paint` | Painters user 905 | Paint Overview, Paint Operations, Paint Workflow, Paint Workload, Reporting Utilities |
| `/reports/accounts` | Accounts user 901 or Owner user 902 | Overview, Revenue & Invoicing, Payments & Receivables, Financial Operations, Reporting Utilities |
| `/reports/valeting` | Valet Service user 904 | Valeting Overview, Valeting Operations, Valeter Activity, Vehicle Preparation, Reporting Utilities |
| `/reports/admin` | Admin Manager user 1 or Owner user 902 | Admin Overview, User & Access, Audit & Compliance, Data Quality & System, Reporting Utilities |
| `/reports/overview` | Owner user 902 | Executive Overview, Department Performance, Operational Performance, Revenue & Profitability, Capacity & Bottlenecks, Executive Trends, Executive Drill-down, Reporting Utilities |

Expected:

- KPI cards render without React error overlays.
- R1 KPIs show numbers or 0 values with live fallback provenance.
- R2/R3 blocked KPIs show clear blocked/caveat state, not invented values.
- Trend charts show series or clearly unavailable snapshot state.
- Drill-down tables show rows or "No records for the selected period."
- CSV download starts for drillable KPIs.
- Saved view save/apply/delete works only if `report_saved_view` exists.

Current known failures:

- `/reports/valeting`, `/reports/admin`, and `/reports/overview` should no longer redirect after Phase 16.1 if the logged-in role is allowed.
- Saved views should work after applying `src/lib/database/schema/addtodatabase.sql` and configuring `SUPABASE_SERVICE_ROLE_KEY`.

If a report page redirects unexpectedly:

- Check whether its route exists in `src/config/navigation.js` or `DYNAMIC_DETAIL_EXTENDS`.
- Check the user's role against the page `ProtectedRoute`.
- Check `canAccessPath('/reports/...', roles)` logic.

If a KPI card stays blank:

- Open Network tab and inspect `/api/reports/kpi`.
- If response has `success:false`, fix API/server error.
- If response has `success:true` and `value:null`, read `warnings` and `meta`.
- If resolver error appears in server logs, inspect the KPI definition's source table/columns against the real DB schema.

### 9.7 Export and audit tests

1. Login as an allowed user for a report package.
2. Open a report page.
3. Click `View records` for a drillable KPI.
4. Click `Export CSV`.
5. Confirm a `.csv` file downloads.
6. In Supabase SQL editor, run:

```sql
select action, entity_type, entity_id, actor_user_id, occurred_at, diff
from audit_log
where entity_type = 'report'
order by occurred_at desc
limit 20;
```

Expected:

- A `report.view` row exists after opening KPI/trend/drill-down/table endpoints.
- A `report.export` row exists after export.
- `entity_id` references the report or KPI export id.
- `diff` includes filter/scope context.

If `reporting_emit_enabled=true` and `report_event` exists, also run:

```sql
select event_name, entity_type, entity_id, actor_user_id, owner_department, occurred_at, payload
from report_event
where event_name in ('REPORT_VIEWED', 'REPORT_EXPORTED')
order by occurred_at desc
limit 20;
```

Expected:

- Report view/export events are present.

If audit rows are missing:

- Confirm `reporting_access_audit_enabled` is true.
- Confirm `audit_log` exists and `writeAuditLog` is not failing.
- Check server logs for `[reporting] auditReportAccess failed`.

### 9.8 Saved view tests

1. Login as an allowed user.
2. Open a report page and go to `Reporting Utilities`.
3. Set Date range to `Last 7 days`.
4. Enter saved view name `Phase 16 saved view`.
5. Click `Save current filter`.
6. Confirm a saved-view chip appears.
7. Change Date range to `Last 30 days`.
8. Click the saved-view chip.
9. Confirm Date range returns to `Last 7 days`.
10. Click delete (`x`).
11. Confirm the chip disappears.

Confirm database:

```sql
select view_id, owner_user_id, scope, name, target_ref, filter, created_at, updated_at
from report_saved_view
where name ilike 'Phase 16%'
order by updated_at desc;
```

Expected:

- Row appears after save.
- `owner_user_id` is the logged-in user's canonical id.
- `target_ref` matches the package, for example `reports:workshop`.
- Row disappears after delete.

If save fails:

- If error says `table not applied`, apply reporting SQL migrations.
- If error says `no service client`, confirm `SUPABASE_SERVICE_ROLE_KEY` is available server-side.

### 9.9 Snapshot and aggregation tests

These only apply after the reporting SQL migrations exist.

Run daily aggregation locally:

```powershell
$env:CRON_SECRET='local-reporting-test'
```

Then send a POST request:

```powershell
Invoke-WebRequest -Method POST `
  -Uri "http://localhost:3000/api/cron/aggregate-kpis-daily?day=2026-06-28" `
  -Headers @{ Authorization = "Bearer local-reporting-test" }
```

Expected response:

- `success: true`
- `cadence: daily`
- `periodKey: 2026-06-28`
- `kpiCount` greater than 0
- `rowCount` greater than 0 if snapshot table exists and resolvers write

Confirm database:

```sql
select kpi_id, day, department, value, numerator, denominator, count, amount_gbp, formula_version, source, built_at
from kpi_daily_snapshot
where day = '2026-06-28'
order by kpi_id
limit 50;

select cadence, period_key, kpi_count, row_count, status, reason, finished_at
from report_aggregation_run
order by finished_at desc
limit 20;
```

Expected:

- Snapshot rows exist for implemented KPIs.
- Ratio KPIs include numerator and denominator where applicable.
- Aggregation run row exists with `status='ok'` or a documented partial reason.

If no rows are written:

- Confirm `kpi_daily_snapshot` exists.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` is configured.
- Confirm resolver source tables have data for the selected day.
- Check server logs for `[reporting] upsertSnapshots`.

### 9.10 Event and status-history tests

These only apply after reporting SQL migrations exist and `NEXT_PUBLIC_REPORTING_REPORTING_EMIT_ENABLED=true` is deliberately set.

Recommended low-risk event test:

1. Login as an allowed reporting user.
2. Open `/reports/workshop`.
3. Trigger a report view and export.
4. Query:

```sql
select event_name, entity_type, entity_id, owner_department, actor_user_id, occurred_at
from report_event
where event_name in ('REPORT_VIEWED', 'REPORT_EXPORTED')
order by occurred_at desc
limit 20;
```

Expected:

- `REPORT_VIEWED` and `REPORT_EXPORTED` appear.

Operational status-history tests should be done in staging only:

- Change a part status through the real Parts UI, then query `parts_job_items_status_history`.
- Change a VHC item status through the real VHC UI, then query `vhc_item_status_history`.
- Change an invoice status/payment through the real Accounts UI, then query `invoice_status_history`.

Example confirmation query:

```sql
select *
from parts_job_items_status_history
order by changed_at desc
limit 20;
```

Expected:

- `from_status` and `to_status` are canonical, not free-text variants.
- `changed_by` is populated when the actor is known.
- `department` matches the owning department.

If no history rows appear:

- Confirm `reporting_emit_enabled` is true.
- Confirm the relevant operational write path actually calls the emit adapter.
- Run `npm run check:report-events`.

### 9.11 Data-quality endpoint test

Login as Admin Manager or Owner, then run:

```js
await fetch('/api/reports/data-quality?range=last_30d', { credentials: 'include' }).then(r => r.json())
```

Expected:

- `success: true`
- `data.summary.total_monitors` is 7
- `data.indicators` includes missing ownership, missing attribution, invalid status transitions, invalid KPI inputs, snapshot failures, event failures, audit failures
- inactive monitors are labelled `inactive`, not falsely `ok`

Negative test:

1. Login as `Techs` user 4.
2. Run the same fetch.

Expected:

- 403 error envelope with message `Reporting data-quality is restricted to management scope`.

If the endpoint reports `meta.source: none`:

- This matches issue M3. The data can still be useful, but provenance should be corrected before final acceptance.

---

## 10. Handover Summary

What is ready:

- Reporting pages and APIs compile.
- KPI catalogue is broad and mostly aligned with the docs.
- R1 KPIs have resolvers by static inspection.
- Shared engine, filters, query helpers, trend builder, drill-down, exports, saved views, audit hook, data-quality monitor, and aggregation runner exist.
- The implementation generally reuses shared infrastructure rather than duplicating package logic.
- Reporting SQL migrations are restored in numbered and combined form.
- `addtodatabase.sql` now contains the reporting schema needed to update Supabase from the repo.
- Server-side KPI access now checks the KPI owning/related department against the caller's reporting scope.
- Valeting, Admin and Executive report routes are exposed through the navigation-derived access model.
- `npm run validate:reporting` and `npm run build` pass.

What is not ready:

- The restored SQL still needs to be applied to the target Supabase database before live saved-view, event, snapshot and aggregation records can be accepted.
- `reporting_emit_enabled` remains deliberately off by default; report events/status-history accrue only after it is explicitly enabled for acceptance.
- `npm run check:report-events` still has the existing job clocking advisory.
- `npm run check:borders` and `npm run check:layers` still fail on pre-existing non-reporting/global UI violations.

Final recommendation:

Phase 16.1 resolves the listed Critical and High blockers in the repository. The reporting platform is **approved for staging handover and production-readiness validation**, but **not unconditionally approved for production handover** until `addtodatabase.sql` has been applied to the target database and the saved-view, export/audit, event, snapshot and aggregation browser/database checks above pass with real rows observed.
