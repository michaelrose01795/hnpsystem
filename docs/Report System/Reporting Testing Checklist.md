# Reporting Testing Checklist

> Phase: 16.2
> Purpose: tick-box acceptance checklist for the Phase 16 / 16.1 reporting handover.
> Scope: testing only. Do not add KPIs, packages, architecture, UI redesigns or new report logic while running this checklist.

---

## 1. Preflight Commands

Run from `C:\Users\micha\hnpsystem`.

```powershell
git status --short
npm install
npm run validate:reporting
npm run check:report-events
npm run check:borders
npm run check:layers
npm run build
```

- [ ] `npm run validate:reporting` passes.
- [ ] `npm run build` passes and emits `/reports/workshop`, `/reports/parts`, `/reports/service`, `/reports/mot`, `/reports/valeting`, `/reports/paint`, `/reports/accounts`, `/reports/admin`, `/reports/overview`.
- [ ] `npm run check:report-events` passes. Current acceptable Phase 16.2 caveat: one advisory may remain at `src/lib/database/jobClocking.js:400`.
- [ ] `npm run check:borders` is green or formally waived as a pre-existing non-reporting issue.
- [ ] `npm run check:layers` is green or formally waived as a pre-existing non-reporting issue.
- [ ] If any command fails, stop browser acceptance and record command, error text, and suspected file.

---

## 2. Apply Reporting SQL

Apply the repo SQL before browser/database acceptance.

- [ ] Open Supabase SQL editor for the staging database.
- [ ] Open `src/lib/database/schema/addtodatabase.sql`.
- [ ] Paste and run the full file.
- [ ] If you hit `column "updated_at" of relation "dim_department" does not exist`, confirm the file includes:

```sql
ALTER TABLE public.dim_department
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
```

- [ ] Alternative: run `src/lib/database/schema/reporting/001_dimensions.sql` through `006_status_history_workflow.sql` in order. `000_all_reporting.sql` is the combined equivalent.

Confirm tables:

```sql
select
  to_regclass('public.dim_department') as dim_department,
  to_regclass('public.dim_actor') as dim_actor,
  to_regclass('public.dim_kpi') as dim_kpi,
  to_regclass('public.report_event') as report_event,
  to_regclass('public.parts_job_items_status_history') as parts_history,
  to_regclass('public.vhc_item_status_history') as vhc_history,
  to_regclass('public.invoice_status_history') as invoice_history,
  to_regclass('public.account_status_history') as account_history,
  to_regclass('public.appointment_status_history') as appointment_history,
  to_regclass('public.delivery_status_history') as delivery_history,
  to_regclass('public.mot_test_status_history') as mot_history,
  to_regclass('public.wash_status_history') as wash_history,
  to_regclass('public.paint_stage_history') as paint_history,
  to_regclass('public.kpi_daily_snapshot') as kpi_daily_snapshot,
  to_regclass('public.kpi_weekly_snapshot') as kpi_weekly_snapshot,
  to_regclass('public.kpi_monthly_snapshot') as kpi_monthly_snapshot,
  to_regclass('public.kpi_quarterly_snapshot') as kpi_quarterly_snapshot,
  to_regclass('public.kpi_yearly_snapshot') as kpi_yearly_snapshot,
  to_regclass('public.report_entity_state_snapshot') as entity_snapshot,
  to_regclass('public.report_aggregation_run') as aggregation_run,
  to_regclass('public.report_saved_view') as saved_view,
  to_regclass('public.report_user_preferences') as user_preferences;
```

- [ ] Every result returns `public.<table>`.
- [ ] If any value is null, re-run the relevant migration file and inspect the first SQL error.

Confirm department seed:

```sql
select code, name, kind, parent_code
from dim_department
order by code;
```

- [ ] Includes `workshop`, `parts`, `service`, `mot`, `valeting`, `paint`, `accounts`, `admin`, `management`, `aftersales`, `hr`, `system`.

---

## 3. Test Users

Start dev server:

```powershell
$env:ALLOW_DEV_AUTH='1'
npm run dev
```

Seed missing acceptance users in staging if needed:

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

Use these logins:

- [ ] `admin@test.local` / Admin Manager / user 1.
- [ ] `service@test.local` / Service / user 2.
- [ ] `workshop@test.local` / Workshop Manager / user 3.
- [ ] `tech@test.local` / Techs / user 4.
- [ ] `parts@test.local` / Parts Manager / user 5.
- [ ] `accounts-report@test.local` / Accounts / user 901.
- [ ] `owner-report@test.local` / Owner / user 902.
- [ ] `mot-report@test.local` / MOT Tester / user 903.
- [ ] `valeting-report@test.local` / Valet Service / user 904.
- [ ] `paint-report@test.local` / Painters / user 905.

If login fails:

```sql
select * from auth_login_attempts order by attempted_at desc limit 20;
```

- [ ] Confirm the user exists in `users`.
- [ ] Confirm `ALLOW_DEV_AUTH=1` if using the developer login panel.

---

## 4. Reports Links And Route Access

For each role, log in, land on `/newsfeed`, and check the sidebar Reports section.

| Report | User | Expected link | Direct route |
|---|---|---|---|
| Workshop | `workshop@test.local` | Workshop Reports | `/reports/workshop` |
| Parts | `parts@test.local` | Parts Reports | `/reports/parts` |
| Service Advisor | `service@test.local` | Service Advisor Reports | `/reports/service` |
| MOT | `mot-report@test.local` | MOT Reports | `/reports/mot` |
| Valeting | `valeting-report@test.local` | Valeting Reports | `/reports/valeting` |
| Paint | `paint-report@test.local` | Paint Reports | `/reports/paint` |
| Accounts | `accounts-report@test.local` | Accounts Reports | `/reports/accounts` |
| Admin | `admin@test.local` | Admin Reports | `/reports/admin` |
| Executive | `owner-report@test.local` | Executive Reports | `/reports/overview` |

- [ ] Link is visible in the sidebar/dashboard shell.
- [ ] Clicking the link opens the expected route.
- [ ] Typing the direct route does not redirect to `/newsfeed`.
- [ ] Page title matches the report package.

If a report link or page does not show:

- [ ] Check `src/config/navigation.js` contains the link and role list.
- [ ] Check the page-level `ProtectedRoute` role list in `src/pages/reports/<route>.js`.
- [ ] Check `src/lib/auth/pageAccess.js` and `canAccessPath('/reports/<route>', roles)`.
- [ ] Check `reporting_nav_enabled` and `reporting_enabled` in `src/lib/reporting/config/flags.js`.
- [ ] Check `/api/auth/session` in the browser to confirm the active roles.

---

## 5. Core API Checks

Run in browser DevTools Console while logged in.

- [ ] KPI:

```js
await fetch('/api/reports/kpi?id=wsh.jobs_completed&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

Expected: `success: true`, `data.kpiId === "wsh.jobs_completed"`, warnings array present.

- [ ] Batch KPI:

```js
await fetch('/api/reports/kpi?ids=wsh.jobs_completed,wsh.jobs_created,vhc.red_items&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

Expected: `data` is an array of 3 results.

- [ ] Trend:

```js
await fetch('/api/reports/trend?id=wsh.jobs_completed&range=last_30d&granularity=day', { credentials: 'include' }).then(r => r.json())
```

Expected: `data.series` is an array.

- [ ] Drill-down:

```js
await fetch('/api/reports/drilldown?id=wsh.jobs_completed&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

Expected: `data.rows` is an array and `data.entityType` is populated.

- [ ] Catalog:

```js
await fetch('/api/reports/catalog?department=workshop', { credentials: 'include' }).then(r => r.json())
```

Expected: catalog entries are filtered by reporting scope.

- [ ] Negative permission, Techs user:

```js
await fetch('/api/reports/kpi?id=prt.stock_value&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

Expected: `data.value` is null and warning includes `outside your reporting department scope`.

- [ ] Related-department control, Techs user:

```js
await fetch('/api/reports/kpi?id=prt.requests&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

Expected: allowed because `prt.requests` declares Workshop as a related department.

- [ ] Financial negative, Techs user:

```js
await fetch('/api/reports/kpi?id=acc.revenue&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

Expected: no revenue data; warning indicates not permitted.

If an API fails:

- [ ] Check server console for `[reporting] route error`.
- [ ] Check `/api/auth/session`.
- [ ] Check the KPI id in `src/lib/reporting/kpiDefinitions/`.
- [ ] Check resolver source tables exist in `schemaReference.sql` and the live database.

---

## 6. Shared UI Test For Every Report Page

Repeat for every package route.

- [ ] Open route.
- [ ] Set Date range to `Last 7 days`.
- [ ] Set Trend granularity to `Daily`.
- [ ] Type `test` into Search if the search field is present.
- [ ] Click every tab listed for the package.
- [ ] Click at least one `View records` or drill-down action.
- [ ] Confirm drill-down table opens or shows "No records for the selected period."
- [ ] Click `Export CSV`.
- [ ] Confirm a `.csv` download starts.
- [ ] Open `Reporting Utilities`.
- [ ] Save view named `Phase 16.2 <package>`.
- [ ] Change Date range to `Last 30 days`.
- [ ] Click the saved-view chip.
- [ ] Confirm Date range returns to `Last 7 days`.
- [ ] Delete the saved-view chip.
- [ ] Confirm no React error overlay appears.
- [ ] Confirm R2/R3 cards show blocked/caveat state rather than invented values.

Saved-view DB check:

```sql
select view_id, owner_user_id, scope, name, target_ref, filter, created_at, updated_at
from report_saved_view
where name ilike 'Phase 16.2%'
order by updated_at desc;
```

- [ ] Row appears after save.
- [ ] `target_ref` matches `reports:<package>`.
- [ ] Row disappears after delete.

Audit DB check:

```sql
select action, entity_type, entity_id, actor_user_id, occurred_at, diff
from audit_log
where entity_type = 'report'
order by occurred_at desc
limit 20;
```

- [ ] `report.view` rows appear after KPI/trend/drill-down/table requests.
- [ ] `report.export` rows appear after CSV export.
- [ ] `diff` includes filter and scope context.

Event DB check, only when `NEXT_PUBLIC_REPORTING_REPORTING_EMIT_ENABLED=true`:

```sql
select event_name, entity_type, entity_id, actor_user_id, owner_department, occurred_at, payload
from report_event
where event_name in ('REPORT_VIEWED', 'REPORT_EXPORTED')
order by occurred_at desc
limit 20;
```

- [ ] `REPORT_VIEWED` appears.
- [ ] `REPORT_EXPORTED` appears.

---

## 7. Package Page Checklist

### Workshop

- [ ] Login: `workshop@test.local`.
- [ ] Link: `Workshop Reports`.
- [ ] Route: `/reports/workshop`.
- [ ] Tabs: Overview, Operations, Technician Performance, VHC Performance, Reporting Utilities.
- [ ] KPI ids to see: `wsh.jobs_completed`, `wsh.jobs_created`, `wsh.jobs_per_day`, `wsh.throughput`, `wsh.sold_hours`, `wsh.labour_sales`, `wsh.tech_efficiency`, `wsh.jobs_per_tech`, `wsh.clocked_hours`, `wsh.mobile_activity`, `wsh.tech_ranking`, `vhc.completion_rate`, `vhc.red_items`, `vhc.authorisation_rate`, `vhc.upsell_revenue`.

### Parts

- [ ] Login: `parts@test.local`.
- [ ] Link: `Parts Reports`.
- [ ] Route: `/reports/parts`.
- [ ] Tabs: Overview, Parts Operations, Stock & Inventory, Supplier & Ordering, Reporting Utilities.
- [ ] KPI ids to see: `prt.requests`, `prt.ordered`, `prt.received`, `prt.fitted`, `prt.open_by_status`, `prt.revenue`, `prt.stock_value`, `prt.vhc_conversion`, `prt.stock_turn`, `prt.approved`, `prt.cancelled`, `prt.unavailable`, `prt.pick_rate`, `prt.ageing`, `prt.backorder_rate`, `prt.lead_time`, `prt.fill_rate`, `prt.supplier_performance`.

### Service Advisor

- [ ] Login: `service@test.local`.
- [ ] Link: `Service Advisor Reports`.
- [ ] Route: `/reports/service`.
- [ ] Tabs: Service Overview, Customer Communications, Appointment & Booking, VHC Performance, Reporting Utilities.
- [ ] KPI ids to see: `svc.booking_volume`, `svc.vhc_send_rate`, `svc.waiting_mix`, `svc.contact_rate`, `svc.response_time`, `svc.followup_completion`, `svc.appointment_conversion`, `svc.vhc_view_rate`, `svc.declined_value`, `svc.vhc_conversion`, `svc.authorised_value`, `vhc.authorisation_rate`, `vhc.upsell_revenue`, `vhc.completion_rate`, `vhc.red_items`.

### MOT

- [ ] Login: `mot-report@test.local`.
- [ ] Link: `MOT Reports`.
- [ ] Route: `/reports/mot`.
- [ ] Tabs: MOT Overview, MOT Operations, Tester Activity, Revenue & Conversion, Reporting Utilities.
- [ ] KPI ids to see: `mot.volume`, `mot.throughput`, `mot.pass_rate`, `mot.revenue`, `mot.due_pipeline`, `mot.tester_productivity`, `mot.first_time_pass`, `mot.retest_rate`, `mot.repair_conversion`, `mot.advisory_conversion`.

### Valeting

- [ ] Login: `valeting-report@test.local`.
- [ ] Link: `Valeting Reports`.
- [ ] Route: `/reports/valeting`.
- [ ] Tabs: Valeting Overview, Valeting Operations, Valeter Activity, Vehicle Preparation, Reporting Utilities.
- [ ] KPI ids and breakdowns to see: `val.cars_washed`, `val.completion_rate`, `val.skip_rate`, `val.queue_time`, `val.avg_wash_time`, `val.valeter_productivity`, `val.sla`, plus breakdown cards for awaiting valet, in valet, completed, queue size, throughput, service wash, sales prep, courtesy vehicle.

### Paint

- [ ] Login: `paint-report@test.local`.
- [ ] Link: `Paint Reports`.
- [ ] Route: `/reports/paint`.
- [ ] Tabs: Paint Overview, Paint Operations, Paint Workflow, Paint Workload, Reporting Utilities.
- [ ] KPI ids and breakdowns to see: `pnt.jobs_completed`, `pnt.queue`, `pnt.cycle_time`, `pnt.stage_duration`, `pnt.painter_productivity`, `pnt.rework_rate`, `pnt.bay_utilisation`, plus completed and queue breakdown cards.

### Accounts

- [ ] Login: `accounts-report@test.local` or `owner-report@test.local`.
- [ ] Link: `Accounts Reports`.
- [ ] Route: `/reports/accounts`.
- [ ] Tabs: Overview, Revenue & Invoicing, Payments & Receivables, Financial Operations, Reporting Utilities.
- [ ] KPI ids to see: `acc.revenue`, `acc.labour_revenue`, `acc.parts_revenue`, `acc.payments_received`, `acc.outstanding_invoices`, `acc.ar`, `acc.credit_exposure`, `acc.account_balances`, `acc.dso`, `acc.invoice_ageing`, `acc.payment_conversion`, `acc.profitability`, `acc.gross_profit`, `acc.net_profit`.

### Admin

- [ ] Login: `admin@test.local` or `owner-report@test.local`.
- [ ] Link: `Admin Reports`.
- [ ] Route: `/reports/admin`.
- [ ] Tabs: Admin Overview, User & Access, Audit & Compliance, Data Quality & System, Reporting Utilities.
- [ ] KPI ids and breakdowns to see: `adm.login_success_rate`, `adm.login_failures`, `adm.audit_activity`, `adm.compliance`, `adm.report_usage`, `adm.user_activity`, `adm.data_quality`, `adm.reporting_health`, `adm.role_changes`, plus login/audit/compliance/report-usage/data-quality breakdown cards.

### Executive

- [ ] Login: `owner-report@test.local`.
- [ ] Link: `Executive Reports`.
- [ ] Route: `/reports/overview`.
- [ ] Tabs: Executive Overview, Department Performance, Operational Performance, Revenue & Profitability, Capacity & Bottlenecks, Executive Trends, Executive Drill-down, Reporting Utilities.
- [ ] KPI ids and links to see: `mgt.company_revenue`, `mgt.upsell_contribution`, `mgt.site_recovery`, `mgt.growth`, `mgt.department_performance`, `mgt.forecast_inputs`, `mgt.company_profitability`, `mgt.cost_to_serve`, `mgt.capacity_utilisation`, `mgt.bottleneck`, `mgt.sla_attainment`, plus cross-department links to Workshop, Parts, Service Advisor, MOT, Valeting, Paint, Accounts and Admin reports.

---

## 8. Data Validation & Source Verification

Use this protocol for every KPI card, scorecard, chart, trend and table in every package.

- [ ] Open DevTools Network and filter `api/reports`.
- [ ] Click the page section being tested.
- [ ] Record every called endpoint: `/api/reports/kpi`, `/api/reports/trend`, `/api/reports/drilldown`, `/api/reports/table`, `/api/reports/export`, `/api/reports/views`.
- [ ] Confirm each request includes the expected `id` or `ids`, date range, granularity and department.
- [ ] Open the matching KPI definition in `src/lib/reporting/kpiDefinitions/<package>.js`.
- [ ] Confirm the displayed KPI id appears in the package config file under `src/components/reporting/<package>/*ReportConfig.js`.
- [ ] Confirm the value comes from `src/lib/reporting/engine.js` and `src/lib/reporting/resolver.js`, not from component-side maths.
- [ ] Confirm no report component contains hard-coded result values, mock arrays, placeholder totals, or sample rows.
- [ ] Confirm `meta.source`, `provenance`, warnings or caveat text clearly identify live, snapshot, live fallback, unavailable, R2 or R3 state.
- [ ] Confirm the API result equals the value rendered in the UI.
- [ ] For trends, confirm the chart series equals `/api/reports/trend` response buckets.
- [ ] For tables, confirm the visible rows equal `/api/reports/drilldown` or `/api/reports/table` response rows.
- [ ] For exports, open the downloaded CSV and confirm row count/columns match the drill-down rows.
- [ ] Change the date range from `Last 30 days` to `Last 7 days`; confirm all KPI/trend/table requests refetch and values change or remain justifiably equal.
- [ ] Make or identify a real operational data change in staging; refresh the report and confirm the affected live KPI updates.
- [ ] If snapshots are enabled, run aggregation and confirm snapshot-backed values update after the cron.

General source trace commands:

```powershell
rg -n "<kpi_id>" src/lib/reporting/kpiDefinitions src/components/reporting
rg -n "resolver:|drilldown:" src/lib/reporting/kpiDefinitions/<package>.js
```

API trace template:

```js
await fetch('/api/reports/kpi?id=<kpi_id>&range=last_30d', { credentials: 'include' }).then(r => r.json())
await fetch('/api/reports/trend?id=<kpi_id>&range=last_30d&granularity=day', { credentials: 'include' }).then(r => r.json())
await fetch('/api/reports/drilldown?id=<kpi_id>&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

If a value is incorrect, missing, unexpected or placeholder-like:

- [ ] Check source data exists for the selected date range.
- [ ] Check the resolver query columns against `src/lib/database/schema/schemaReference.sql`.
- [ ] Check the live table directly in Supabase with the same date range.
- [ ] Check the API response warning/provenance.
- [ ] Check role and department scope.
- [ ] Check snapshots: stale snapshots can differ from live fallback until aggregation runs.
- [ ] Check filters: date range, department, granularity and search.
- [ ] Check UI rendering: confirm API value is correct before blaming resolver logic.
- [ ] Reproduce with the exact route, user, KPI id, date range, API response and SQL query.
- [ ] Fix path: source data issue -> seed/create operational record; query bug -> resolver/queryBuilder; permission issue -> `permissionScope`/KPI permission metadata; snapshot issue -> aggregation runner/schema/cron; UI issue -> report component rendering.

### Workshop Source Verification

Source files: `src/lib/reporting/kpiDefinitions/workshop.js`, `src/lib/reporting/kpiDefinitions/vhc.js`, `src/components/reporting/workshop/workshopReportConfig.js`.

Primary sources: `jobs`, `job_requests`, `time_records`, `job_clocking`, `vhc_checks`.

- [ ] Validate `wsh.*` values against live job, labour and clocking records.
- [ ] Validate `vhc.*` cards against `vhc_checks` and related `jobs`.
- [ ] Update a staging job completion/VHC record and confirm the affected KPI changes after refresh or aggregation.

### Parts Source Verification

Source files: `src/lib/reporting/kpiDefinitions/parts.js`, `src/components/reporting/parts/partsReportConfig.js`.

Primary sources: `parts_job_items`, `parts_catalog`, `parts_goods_in`, `parts_goods_in_items`, `vhc_checks`, invoice-related tables where revenue is used.

- [ ] Validate request/order/received/fitted/open status counts against `parts_job_items`.
- [ ] Validate stock value against `parts_catalog.qty_in_stock * unit_cost`.
- [ ] Update a staging part status or stock quantity and confirm affected KPI changes.

### Service Advisor Source Verification

Source files: `src/lib/reporting/kpiDefinitions/service.js`, `src/lib/reporting/kpiDefinitions/vhc.js`, `src/components/reporting/service/serviceReportConfig.js`.

Primary sources: `appointments`, `jobs`, `vhc_send_history`, `vhc_checks`, customer communication tables where used.

- [ ] Validate booking and waiting mix against appointment/job records.
- [ ] Validate VHC send rate against VHC-required jobs and send history.
- [ ] Validate cross-listed `vhc.*` values are served by the VHC resolver, not duplicated in Service UI.

### MOT Source Verification

Source files: `src/lib/reporting/kpiDefinitions/mot.js`, `src/components/reporting/mot/motReportConfig.js`.

Primary sources: `jobs`, `vehicles`, invoice/invoice-line tables, interim MOT status fields.

- [ ] Validate MOT volume/pass rate/throughput against MOT-type jobs and completion statuses.
- [ ] Validate MOT due pipeline against vehicle MOT due dates.
- [ ] Validate MOT revenue against invoice-line source used by the resolver.

### Valeting Source Verification

Source files: `src/lib/reporting/kpiDefinitions/valeting.js`, `src/components/reporting/valeting/valetingReportConfig.js`.

Primary sources: `jobs` wash/valet fields, `wash_status_history` after emits are enabled.

- [ ] Validate cars washed/completion/skip rates against job wash state fields.
- [ ] Validate breakdown cards against the resolver breakdown object.
- [ ] Update a staging wash status and confirm affected KPI/breakdown changes.

### Paint Source Verification

Source files: `src/lib/reporting/kpiDefinitions/paint.js`, `src/components/reporting/paint/paintReportConfig.js`.

Primary sources: `jobs` paint/bodyshop indicators, completion/workshop timestamps, `paint_stage_history` after emits are enabled.

- [ ] Validate completed jobs, queue and cycle-time proxy against job records and timestamps.
- [ ] Validate breakdown cards against resolver breakdown.
- [ ] Update a staging paint/bodyshop job status and confirm affected KPI changes.

### Accounts Source Verification

Source files: `src/lib/reporting/kpiDefinitions/accounts.js`, `src/components/reporting/accounts/accountsReportConfig.js`.

Primary sources: `invoices`, invoice request/item tables, payments/transactions/account tables.

- [ ] Validate revenue/labour/parts totals against invoice totals for the same date range.
- [ ] Validate payments and receivables against payment/account balance records.
- [ ] Confirm non-financial roles cannot see financial KPIs.
- [ ] Create or identify a staging invoice/payment and confirm affected KPI changes.

### Admin Source Verification

Source files: `src/lib/reporting/kpiDefinitions/admin.js`, `src/components/reporting/admin/adminReportConfig.js`, `src/lib/reporting/dataQuality.js`.

Primary sources: `audit_log`, `auth_login_attempts`, `report_event`, `report_aggregation_run`, `jobs`.

- [ ] Validate login success/failure against `auth_login_attempts`.
- [ ] Validate audit/compliance/report usage against `audit_log`.
- [ ] Validate reporting health/data-quality against `/api/reports/data-quality`.
- [ ] Trigger a report view/export and confirm `adm.report_usage` changes after refresh.

### Executive Source Verification

Source files: `src/lib/reporting/kpiDefinitions/management.js`, `src/components/reporting/management/managementReportConfig.js`.

Primary sources: composed KPIs from Accounts, Workshop, Parts, Service, MOT, Valeting, Paint, VHC; snapshots for forecast/history where available.

- [ ] Confirm `mgt.*` composite resolvers call existing KPI resolvers instead of duplicating formulas.
- [ ] Validate company revenue against `acc.revenue`.
- [ ] Validate upsell contribution against `vhc.upsell_revenue / acc.revenue`.
- [ ] Validate department performance rows against the underlying department package KPIs.
- [ ] Confirm cross-department links open the relevant report pages for Owner.

---

## 9. Snapshot And Aggregation Checks

Run daily aggregation:

```powershell
$env:CRON_SECRET='local-reporting-test'
Invoke-WebRequest -Method POST `
  -Uri "http://localhost:3000/api/cron/aggregate-kpis-daily?day=2026-06-28" `
  -Headers @{ Authorization = "Bearer local-reporting-test" }
```

- [ ] Response has `success: true`.
- [ ] `cadence` is `daily`.
- [ ] `periodKey` is `2026-06-28`.
- [ ] `kpiCount` is greater than 0.
- [ ] `rowCount` is greater than 0 when source records exist.

Confirm rows:

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

- [ ] Snapshot rows exist.
- [ ] Ratio KPIs include numerator and denominator.
- [ ] Aggregation run row exists with `status='ok'` or a documented partial reason.

If no rows are written:

- [ ] Confirm `kpi_daily_snapshot` exists.
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` is configured.
- [ ] Confirm resolver source tables have records for `2026-06-28`.
- [ ] Check server logs for `[reporting] upsertSnapshots`.

---

## 10. Final Sign-Off

- [ ] SQL applied successfully.
- [ ] All report routes reachable by intended roles.
- [ ] Core API checks pass.
- [ ] Every package page/tabs/drill-down/export/saved view tested.
- [ ] Every displayed KPI/chart/table/trend traced to resolver/API/source table.
- [ ] No mock, sample, hard-coded or silent demo fallback data found.
- [ ] Live operational data change updates affected report values.
- [ ] `audit_log` records report views and exports.
- [ ] `report_event` records report views/exports when emits are enabled.
- [ ] `kpi_daily_snapshot` and `report_aggregation_run` update after aggregation.
- [ ] Any failures have exact reproduction steps, API response, SQL evidence, suspected cause and owner.

Production handover decision:

- [ ] Approve only if every required box above is ticked or explicitly waived with reason.
- [ ] Do not approve if any report silently displays placeholder/sample data, if department scope leaks, or if saved views/exports/audit cannot be verified against database rows.
