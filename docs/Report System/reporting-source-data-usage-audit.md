# Reporting Source Data Usage Audit

> Phase: 16.2 source-data audit
> Date: 2026-06-29
> Scope: audit only. No KPIs, report packages, architecture, UI redesigns or report logic were added.

---

## 1. Verdict

No reporting package was found importing presentation mock data, demo rows, sample arrays, hard-coded totals or local Supabase data queries. The normal reporting path is:

`report page/component -> reporting hook -> /api/reports/* -> reporting engine -> KPI resolver -> database helper/source table`.

The main source-data risks are not fake data, but misleading fallback display states:

- Breakdown cards display `0` when a resolver response omits a breakdown key.
- Trend charts can show "No trend data" when snapshots are missing and live per-bucket fallback is unavailable for the selected range.
- R2/R3 KPIs without resolvers are correctly blocked/unavailable, but users can still read the card as an empty metric unless warnings/provenance are checked.
- Admin data-quality endpoint returns live data but sends `source: "live"` outside the standard provenance object, so response metadata can understate the live source.

Overall source-data status: **mostly real API/engine/resolver data, with several UI/provenance fallback states that must be tested carefully before production sign-off.**

---

## 2. Audit Method

Reviewed reporting-only code paths:

- `src/pages/reports/*.js`
- `src/pages/api/reports/*.js`
- `src/components/reporting/**/*.js`
- `src/hooks/reporting/useReporting.js`
- `src/lib/reporting/**/*.js`
- `src/lib/reporting/kpiDefinitions/*.js`
- `src/lib/database/schema/schemaReference.sql`

Searches run:

```powershell
rg -n "mock|demo|sample|placeholder|hard-coded|hardcoded|dummy|fallback|rows\s*=\s*\[|const\s+\w+\s*=\s*\[|\?\?\s*0|\|\|\s*0|reduce\(|Math\.|fetch\('/api/reports|/api/reports" src/components/reporting src/hooks/reporting src/pages/reports src/pages/api/reports src/lib/reporting
rg -n "mockData|features/presentation|DEMO-|demo-|sample|placeholder" src/components/reporting src/pages/reports src/lib/reporting src/pages/api/reports
rg -n "KpiBreakdownCards|AdminBreakdownCards|ValetingBreakdownCards|PaintBreakdownCards|KpiScorecardStrip|KpiPanel|ReportDrilldownTable|useKpiValues|useKpiTrend|useDrilldown" src/components/reporting src/pages/reports
rg -n "reporting|dim_department|report_event|kpi_daily_snapshot|report_saved_view|jobs|invoices|parts_job_items|vhc_checks|auth_login_attempts|audit_log" src/lib/database/schema/schemaReference.sql
```

Important limitation: this audit verifies the code source path statically. It does not claim that current production/staging rows are numerically correct until the API and SQL checks in each package section are run against the live Supabase database.

---

## 3. Shared Component Findings

| Area | File | Data path | Finding | Fix required | Test |
|---|---|---|---|---|---|
| KPI scorecards | `src/components/reporting/KpiScorecardStrip.js` | `useKpiValues -> /api/reports/kpi` | Real API data. Static `kpis` arrays are descriptor metadata only. | None for mock data. | Network tab must show `/api/reports/kpi?ids=...`; rendered values must match response `data[].value`. |
| KPI panels | `src/components/reporting/KpiPanel.js` | `useKpiValues`, `useKpiTrend`, `ReportDrilldownTable` | Real API data. No local KPI math. | None for mock data. | Check `/api/reports/kpi`, `/api/reports/trend`, `/api/reports/drilldown` for the selected KPI. |
| KPI cards | `src/components/reporting/KpiValueCard.js` | Receives API result only | Real render-only component. Shows `Not yet captured` for declared KPIs with no resolver warning. | None for mock data. | Confirm value equals API value and unavailable KPIs have warning/provenance. |
| Trends | `src/components/reporting/KpiTrendChart.js` | Receives `/api/reports/trend` series | Real API series. It only scales SVG pixels. `Number(p.value) || 0` affects chart positioning only after null points are filtered out. | None for mock data. | Compare visible points to `/api/reports/trend` `data.series`. |
| Drill-down tables | `src/components/reporting/ReportDrilldownTable.js` | `useDrilldown -> /api/reports/drilldown`; export via `/api/reports/export` | Real API rows. Empty state is not mock data. | None for mock data. | Compare visible rows and CSV rows to drill-down response. |
| Generic breakdown cards | `src/components/reporting/KpiBreakdownCards.js` | `useKpiValues([kpiId])`, then `result.breakdown` | Real API source, but missing breakdown keys silently render as `0`. | Change missing key handling to unavailable/null with warning, or ensure every resolver always returns every configured key. | Temporarily inspect API response; if `breakdown` lacks a displayed key, the UI must not present that as a confident zero. |
| Admin breakdown cards | `src/components/reporting/admin/AdminBreakdownCards.js` | `useKpiValues([kpiId])`, then `result.breakdown` | Same silent `0` fallback risk. | Same as above. | Use `adm.audit_activity`, `adm.compliance`, `adm.data_quality` and compare every card key to API `breakdown`. |
| Valeting breakdown cards | `src/components/reporting/valeting/ValetingBreakdownCards.js` | `useKpiValues(["val.cars_washed"])`, then `result.breakdown` | Same silent `0` fallback risk. | Same as above. | Use `val.cars_washed`; compare `BREAKDOWN_CARDS` keys to API `breakdown`. |
| Paint breakdown cards | `src/components/reporting/paint/PaintBreakdownCards.js` | `useKpiValues(["pnt.jobs_completed" or "pnt.queue"])`, then `result.breakdown` | Same silent `0` fallback risk. | Same as above. | Use `pnt.jobs_completed` and `pnt.queue`; compare card keys to API `breakdown`. |
| Saved views | `src/components/reporting/SavedViewsBar.js`, `src/hooks/reporting/useReporting.js` | `/api/reports/views` | Real saved-view API/database path, not local storage or sample views. | None for mock data. | Save and delete a view, then query `report_saved_view`. |
| Data quality endpoint | `src/pages/api/reports/data-quality.js` | `runDataQualityMonitors` | Live monitor data, but provenance is not passed through the standard `provenance` object. | Return `provenance: { source: "live", ... }` or equivalent envelope-compatible source. | Response `meta.source` should say live, not `none`. |

---

## 4. Package-by-Package Source Audit

### Workshop

| Section | File | KPI id | Source table(s) | Resolver path | Issue found | Fix required | How to test live correctness |
|---|---|---|---|---|---|---|---|
| Overview scorecards, operations, technician cards | `src/components/reporting/workshop/*.js`, `workshopReportConfig.js` | `wsh.jobs_completed`, `wsh.jobs_created`, `wsh.jobs_per_day`, `wsh.throughput`, `wsh.sold_hours`, `wsh.clocked_hours`, `wsh.labour_sales`, `wsh.tech_efficiency`, `wsh.tech_ranking`, `wsh.jobs_per_tech`, `wsh.mobile_activity` | `jobs`, `job_requests`, `vhc_checks`, `job_clocking`, `time_records`, `tech_efficiency_entries`, `tech_efficiency_targets`, `company_settings` | `src/lib/reporting/kpiDefinitions/workshop.js -> resolver -> engine.js -> resolver.js` | Real resolver/API data. No mock rows found. Some values can be null or zero if live job/clocking data is absent. | No mock-data fix. Verify source rows exist before treating zeros as operational truth. | Login Workshop Manager. Fetch `/api/reports/kpi?ids=wsh.jobs_completed,wsh.clocked_hours,wsh.tech_efficiency&range=last_30d`. Compare to filtered `jobs`, `job_clocking` and `time_records` rows in Supabase. |
| Workshop VHC section | `src/components/reporting/workshop/WorkshopVhcTab.js` | `vhc.completion_rate`, `vhc.red_items`, `vhc.authorisation_rate`, `vhc.upsell_revenue` | `jobs`, `vhc_checks` | `src/lib/reporting/kpiDefinitions/vhc.js` | Real shared VHC resolver, not duplicated in Workshop UI. | None. | Fetch each `vhc.*` KPI and compare counts/totals to `vhc_checks` for the same range. |
| Readiness cards | `WorkshopTechnicianTab.js`, `WorkshopOperationsTab.js` | `wsh.cycle_time`, `wsh.stage_dwell`, `wsh.labour_recovery`, `wsh.tech_productivity`, `wsh.utilisation`, `wsh.profitability`, `wsh.additional_work_recovery`, `wsh.rework_rate` | Declared source tables in `workshop.js` where available | Catalogue declarations, some without resolver | Correctly blocked/caveated. Not mock data. | Do not force values. Add resolver only in a future scoped phase with validated source model. | API should return `value:null` with declared/not implemented warning where no resolver exists. |

### Parts

| Section | File | KPI id | Source table(s) | Resolver path | Issue found | Fix required | How to test live correctness |
|---|---|---|---|---|---|---|---|
| Overview and operations | `src/components/reporting/parts/*.js`, `partsReportConfig.js` | `prt.requests`, `prt.ordered`, `prt.received`, `prt.fitted`, `prt.open_by_status` | `parts_job_items`, `parts_catalog`, `job_requests`, `parts_requests` | `src/lib/reporting/kpiDefinitions/parts.js` | Real resolver/API data. `prt.open_by_status` returns a breakdown object used by Executive capacity cards. | No mock-data fix. Watch breakdown zero fallback if used through `KpiBreakdownCards`. | Login Parts Manager. Fetch `/api/reports/kpi?ids=prt.requests,prt.open_by_status&range=last_30d`; compare to `parts_job_items.status` counts. |
| Stock and financial parts cards | `PartsStockTab.js`, `PartsSupplierTab.js` | `prt.stock_value`, `prt.vhc_conversion`, `prt.stock_turn`, `prt.revenue`, `prt.margin`, `prt.profitability` | `parts_catalog`, `parts_job_items`, `parts_stock_movements`, `invoices`, `parts_order_cards`, `vhc_checks` | `src/lib/reporting/kpiDefinitions/parts.js` | Real resolver/API data. Financial/stock values can look low if stock cost or invoice linkage is missing. | Confirm source rows and cost fields before treating zero as true. | Fetch `prt.stock_value`; compare to sum of `parts_catalog` stock quantity times unit cost fields used by resolver. |
| Readiness/supplier cards | `partsReportConfig.js` tabs | `prt.approved`, `prt.cancelled`, `prt.unavailable`, `prt.pick_rate`, `prt.ageing`, `prt.backorder_rate`, `prt.lead_time`, `prt.fill_rate`, `prt.supplier_performance` | `parts_job_items`, `parts_delivery_items`, `parts_deliveries` | Declared in `parts.js`, some without resolver | Correctly blocked/caveated where resolver is absent. Not demo data. | Future resolver work only after source lifecycle fields are validated. | API should return unavailable warning for unresolved KPIs; resolved R2 proxy values must match source rows. |

### Service Advisor

| Section | File | KPI id | Source table(s) | Resolver path | Issue found | Fix required | How to test live correctness |
|---|---|---|---|---|---|---|---|
| Overview and booking | `src/components/reporting/service/*.js`, `serviceReportConfig.js` | `svc.booking_volume`, `svc.waiting_mix`, `svc.vhc_send_rate` | `appointments`, `job_booking_requests`, `job_customer_statuses`, `jobs`, `vhc_send_history` | `src/lib/reporting/kpiDefinitions/service.js` | Real resolver/API data. No local arrays or UI calculations found. | None. | Login Service. Fetch `/api/reports/kpi?ids=svc.booking_volume,svc.vhc_send_rate&range=last_30d`; compare to `appointments`, `job_booking_requests`, `jobs`, `vhc_send_history`. |
| VHC performance | `ServiceVhcTab.js` | `vhc.completion_rate`, `vhc.red_items`, `vhc.authorisation_rate`, `vhc.upsell_revenue` | `jobs`, `vhc_checks` | `src/lib/reporting/kpiDefinitions/vhc.js` | Correct shared VHC resolver. No duplicate Service-side source. | None. | Compare Service page VHC values with Workshop VHC API values for same filter. |
| Communications/readiness | `ServiceCommunicationsTab.js`, `ServiceBookingTab.js` | `svc.contact_rate`, `svc.response_time`, `svc.followup_completion`, `svc.appointment_conversion`, `svc.vhc_view_rate`, `svc.vhc_conversion`, `svc.authorised_value`, `svc.declined_value` | `jobs`, `vhc_send_history`, `vhc_checks`, `job_share_links`, `vhc_declinations`, `message_thread_members` | `service.js` declarations | Some are declared R2/R3 and may be unavailable. Not mock data. | Only implement after source events/communications model is complete. | API warning/provenance must explain unavailable state; no populated UI value should appear without resolver output. |

### MOT

| Section | File | KPI id | Source table(s) | Resolver path | Issue found | Fix required | How to test live correctness |
|---|---|---|---|---|---|---|---|
| Overview and operations | `src/components/reporting/mot/*.js`, `motReportConfig.js` | `mot.volume`, `mot.throughput`, `mot.pass_rate`, `mot.revenue`, `mot.due_pipeline` | `jobs`, `vehicles`, `customers`, `invoices`, `invoice_items` | `src/lib/reporting/kpiDefinitions/mot.js` | Real resolver/API data. Current MOT values depend on interim MOT status/typing fields in jobs/vehicles. | None for mock data; confirm MOT source columns are populated consistently. | Login MOT Tester. Fetch `/api/reports/kpi?ids=mot.volume,mot.pass_rate,mot.due_pipeline&range=last_30d`; compare to MOT-type `jobs` and `vehicles.mot_expiry`. |
| Tester and conversion readiness | `MotTesterActivityTab.js`, `MotRevenueConversionTab.js` | `mot.tester_productivity`, `mot.first_time_pass`, `mot.retest_rate`, `mot.repair_conversion`, `mot.advisory_conversion` | `job_clocking`, `mot_tests`, `jobs`, `job_requests`, `vhc_checks`, `mot_advisories` | `mot.js` | `mot.tester_productivity` has a resolver; several R3 metrics are declared pending dedicated MOT test/advisory tables. Not mock. | Future source-model work for R3 metrics. | Resolved KPI values must match `job_clocking`; R3 KPIs must show unavailable/declared warnings. |

### Valeting

| Section | File | KPI id | Source table(s) | Resolver path | Issue found | Fix required | How to test live correctness |
|---|---|---|---|---|---|---|---|
| Overview and operations | `src/components/reporting/valeting/*.js`, `valetingReportConfig.js` | `val.cars_washed`, `val.completion_rate`, `val.skip_rate` | `jobs` | `src/lib/reporting/kpiDefinitions/valeting.js` | Real resolver/API data. No mock rows found. | None for KPI values. | Login Valet Service. Fetch `/api/reports/kpi?ids=val.cars_washed,val.completion_rate,val.skip_rate&range=last_30d`; compare to wash/valet fields on `jobs`. |
| Breakdown cards | `src/components/reporting/valeting/ValetingBreakdownCards.js` | `val.cars_washed.breakdown.*` | `jobs` | `valeting.js -> val.cars_washed resolver breakdown` | API-backed, but missing breakdown keys render as `0`. This can make missing source/capture look like a true zero. | Prefer null/unavailable for absent keys or guarantee resolver returns all `BREAKDOWN_CARDS` keys. | Fetch `val.cars_washed`; compare every `BREAKDOWN_CARDS` key to `data.breakdown`. If absent, UI must not show confident zero. |
| Readiness cards | `ValetingOperationsTab.js`, `ValeterActivityTab.js`, `VehiclePreparationTab.js` | `val.queue_time`, `val.avg_wash_time`, `val.valeter_productivity`, `val.sla` | `jobs`, future/derived wash history | `valeting.js` | Several are R2/R3 blocked due missing reliable timing/productivity capture. Not demo data. | Future resolver/source-capture work only. | API must show null/unavailable warnings for blocked metrics. |

### Paint

| Section | File | KPI id | Source table(s) | Resolver path | Issue found | Fix required | How to test live correctness |
|---|---|---|---|---|---|---|---|
| Overview and operations | `src/components/reporting/paint/*.js`, `paintReportConfig.js` | `pnt.jobs_completed`, `pnt.queue`, `pnt.cycle_time` | `jobs` | `src/lib/reporting/kpiDefinitions/paint.js` | Real resolver/API data. Paint uses job-derived proxy fields and sample-size breakdowns, not mock rows. | None for mock data; make proxy provenance clear. | Login Painters. Fetch `/api/reports/kpi?ids=pnt.jobs_completed,pnt.queue,pnt.cycle_time&range=last_30d`; compare to paint/bodyshop `jobs` rows and timestamps used by resolver. |
| Breakdown cards | `src/components/reporting/paint/PaintBreakdownCards.js` | `pnt.jobs_completed.breakdown.*`, `pnt.queue.breakdown.*` | `jobs` | `paint.js -> pnt.jobs_completed / pnt.queue resolver breakdown` | API-backed, but missing breakdown keys render as `0`. | Prefer unavailable/null for absent keys or guarantee resolver returns every configured breakdown key. | Fetch `pnt.jobs_completed` and `pnt.queue`; compare `COMPLETED_BREAKDOWN_CARDS` and `QUEUE_BREAKDOWN_CARDS` keys to `data.breakdown`. |
| Workload/readiness | `PaintWorkflowTab.js`, `PaintWorkloadTab.js` | `pnt.stage_duration`, `pnt.painter_productivity`, `pnt.rework_rate`, `pnt.bay_utilisation` | `jobs`, `paint_stage_history` after emits | `paint.js` declarations | R2/R3 metrics depend on stage history/capacity capture. Correctly caveated, not mock. | Future event/history resolver work only. | API should show null/unavailable warnings until `paint_stage_history` is populated and resolver exists. |

### Accounts

| Section | File | KPI id | Source table(s) | Resolver path | Issue found | Fix required | How to test live correctness |
|---|---|---|---|---|---|---|---|
| Overview, revenue, receivables | `src/components/reporting/accounts/*.js`, `accountsReportConfig.js` | `acc.revenue`, `acc.labour_revenue`, `acc.parts_revenue`, `acc.payments_received`, `acc.outstanding_invoices`, `acc.ar`, `acc.credit_exposure`, `acc.account_balances` | `invoices`, `invoice_payments`, `accounts` | `src/lib/reporting/kpiDefinitions/accounts.js` | Real resolver/API data and financial permission-gated. No local financial calculations in UI. | None for mock data. | Login Accounts/Owner. Fetch `/api/reports/kpi?ids=acc.revenue,acc.payments_received,acc.ar&range=last_30d`; compare to invoice/payment/account rows. Login Techs and confirm denied/null. |
| Financial operations/readiness | `AccountsOperationsTab.js` | `acc.dso`, `acc.invoice_ageing`, `acc.payment_conversion`, `acc.profitability`, `acc.gross_profit`, `acc.net_profit` | `invoices`, `invoice_payments`, `invoice_items` | Declared in `accounts.js`, some without resolver | Correctly blocked/caveated for R2/R3. Not mock. | Future finance model/resolver work only. | API must not fabricate values; null/unavailable warnings are expected until implemented. |

### Admin

| Section | File | KPI id | Source table(s) | Resolver path | Issue found | Fix required | How to test live correctness |
|---|---|---|---|---|---|---|---|
| Access/login | `src/components/reporting/admin/*.js`, `adminReportConfig.js` | `adm.login_success_rate`, `adm.login_failures` | `auth_login_attempts`, `audit_log` | `src/lib/reporting/kpiDefinitions/admin.js` | Real resolver/API data. Breakdown card zero fallback risk applies. | Fix breakdown missing-key display or guarantee resolver breakdown keys. | Login Admin. Fetch `/api/reports/kpi?ids=adm.login_success_rate,adm.login_failures&range=last_30d`; compare to `auth_login_attempts`. |
| Audit/compliance/report usage | `AdminAuditTab.js` | `adm.audit_activity`, `adm.compliance`, `adm.report_usage` | `audit_log`, `job_activity_events` | `admin.js` | Real resolver/API data. `adm.report_usage` depends on report audit rows being written. It can show low/zero if report auditing has not occurred. | Ensure `reporting_access_audit_enabled` is on and report API calls write `audit_log`. | Trigger report view/export; query `audit_log where entity_type='report'`; refresh `adm.report_usage`. |
| Data quality/system | `AdminQualityTab.js`, `data-quality.js` | `adm.data_quality`, `adm.reporting_health` | `audit_log`, `auth_login_attempts`, `jobs`, `report_event`, `report_aggregation_run` | `admin.js`, `src/lib/reporting/dataQuality.js`, `/api/reports/data-quality` | Live data, but `/api/reports/data-quality` provenance can report `meta.source: none` because source is not placed inside envelope provenance. Monitors may be inactive until events/snapshots accrue. | Fix endpoint provenance. Treat inactive monitors as capture status, not healthy zeros. | Fetch `/api/reports/data-quality`; confirm indicators and warnings. Query `report_event` and `report_aggregation_run` before trusting health values. |
| Role changes | `adminReportConfig.js` | `adm.role_changes` | `audit_log` | Declared in `admin.js` without resolver | Correctly blocked due audit-logging gap. Not mock. | Future audit event model/resolver work. | API should return null/unavailable warning. |

### Executive

| Section | File | KPI id | Source table(s) | Resolver path | Issue found | Fix required | How to test live correctness |
|---|---|---|---|---|---|---|---|
| Executive overview | `src/components/reporting/management/*.js`, `managementReportConfig.js` | `mgt.company_revenue`, `mgt.upsell_contribution`, `mgt.site_recovery`, `mgt.growth` | `invoices`, `vhc_checks`, `jobs`, `job_requests`, `time_records`, `job_clocking` | `src/lib/reporting/kpiDefinitions/management.js`, often composed via existing KPI resolvers | Real resolver/API data. Management composites reuse existing KPI resolvers rather than UI math. Missing underlying department data can make composite values null/zero. | None for mock data; validate underlying KPI first. | Login Owner. Compare `mgt.company_revenue` to `acc.revenue`; compare `mgt.upsell_contribution` numerator/denominator to `vhc.upsell_revenue` and `acc.revenue`. |
| Department performance | `DepartmentPerformanceTab.js` | `mgt.department_performance` | `kpi_daily_snapshot` and underlying department KPI outputs | `management.js` | Correct but snapshot-dependent. Can be misleading if snapshot table has not been built. | Run aggregation cron and confirm snapshot rows before accepting. | Query `kpi_daily_snapshot`; fetch `mgt.department_performance`; compare returned rows to snapshot-backed KPI values. |
| Capacity/bottlenecks | `CapacityBottlenecksTab.js` | `mgt.capacity_utilisation`, `mgt.bottleneck`, `mgt.sla_attainment`, plus `prt.open_by_status`, `val.cars_washed`, `pnt.queue` breakdowns | `job_clocking`, `time_records`, `report_event`, `parts_job_items`, `jobs` | `management.js`, `parts.js`, `valeting.js`, `paint.js` | R3/R2 capacity metrics are blocked/caveated. Breakdown cards are API-backed but inherit the silent `0` fallback risk. | Fix breakdown missing-key display. Enable events/snapshots before accepting event-based metrics. | Fetch each KPI directly; compare breakdown keys to API response; query `report_event` for event-backed metrics. |
| Revenue/profitability | `RevenueProfitabilityTab.js` | `mgt.company_profitability`, `mgt.cost_to_serve`, `mgt.forecast_inputs`, `acc.*`, `mgt.growth.breakdown.*` | `invoices`, `invoice_items`, `jobs`, `kpi_daily_snapshot` | `management.js`, `accounts.js` | Correctly blocked/caveated where finance/cost model or snapshots are missing. No mock data. | Future finance/cost resolver work; run aggregation for forecast inputs. | Confirm blocked KPIs return null/unavailable. For `mgt.growth`, compare to current/prior `acc.revenue` and `wsh.jobs_completed`. |

---

## 5. Incorrect, Mock or Fallback Source Classification

| Classification | Result |
|---|---|
| Mock/demo imports inside reporting | **None found.** Presentation mock data exists under `src/features/presentation/mockData`, but reporting code does not import it. |
| Hard-coded KPI totals or sample rows in reporting UI | **None found.** Static arrays in `*ReportConfig.js` are labels, KPI ids, tab descriptors and export lists only. |
| UI-only KPI calculations | **None found for KPI values.** Components render values from API hooks. Chart components only scale points visually. |
| Engine fallback to live data | **Expected and labelled.** `resolver.js` reads snapshots first, then live resolver if `reporting_live_fallback_enabled` is true. |
| Trend fallback | **Expected and labelled.** `trendBuilder.js` uses snapshots/rollups, then live day buckets for small daily ranges, otherwise unavailable scaffold. |
| Silent fallback issue | **Found.** Breakdown components use `breakdown[key] ?? 0`; absent keys can appear as true zero. |
| Provenance issue | **Found.** `/api/reports/data-quality` returns live monitor output but does not pass source through standard provenance. |
| Wrong source | **No confirmed wrong source in static audit.** Executive composites intentionally reuse underlying department KPI resolvers. Service VHC intentionally reuses `vhc.js`. |
| Correct but misleading due missing live data | **Found.** R2/R3 declared KPIs, event-backed monitors, snapshot-backed executive KPIs and breakdown absent-key zeros can mislead unless warnings/provenance are checked. |
| Blocked by permissions | **Expected.** Accounts financial KPIs and cross-department KPIs are server-side gated by `engine.js`. |

---

## 6. Live Verification Steps

Use this flow for every row in the package tables.

1. Login as the package role.
2. Open the report route.
3. Open DevTools Network and filter `api/reports`.
4. Click the section/card/table/trend.
5. Record the called endpoint and KPI id.
6. In DevTools Console, fetch the KPI directly:

```js
await fetch('/api/reports/kpi?id=<kpi_id>&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

7. For trends:

```js
await fetch('/api/reports/trend?id=<kpi_id>&range=last_30d&granularity=day', { credentials: 'include' }).then(r => r.json())
```

8. For drill-down:

```js
await fetch('/api/reports/drilldown?id=<kpi_id>&range=last_30d', { credentials: 'include' }).then(r => r.json())
```

9. Confirm the UI value equals the API value.
10. Confirm the API value equals the live source table rows for the same date range.
11. Confirm `warnings` and `meta/provenance` explain snapshot/live/unavailable states.
12. If a value is wrong, classify the cause:

- Missing source rows: create/find live operational data for the selected date range.
- Resolver/query issue: inspect `src/lib/reporting/kpiDefinitions/<package>.js`.
- Snapshot issue: run aggregation and query `kpi_daily_snapshot`.
- Permission issue: inspect `src/lib/reporting/engine.js` and `permissionScope.js`.
- Filter issue: compare `range`, `from`, `to`, `department`, `granularity`, `search`.
- UI issue: API value is correct but render is wrong; inspect the reporting component.
- Breakdown issue: API `breakdown` lacks a key that UI renders as `0`.

Useful database checks:

```sql
select action, entity_type, entity_id, actor_user_id, occurred_at, diff
from audit_log
where entity_type = 'report'
order by occurred_at desc
limit 20;
```

```sql
select event_name, entity_type, entity_id, actor_user_id, owner_department, occurred_at, payload
from report_event
where event_name in ('REPORT_VIEWED', 'REPORT_EXPORTED')
order by occurred_at desc
limit 20;
```

```sql
select kpi_id, day, department, value, numerator, denominator, count, amount_gbp, formula_version, source, built_at
from kpi_daily_snapshot
order by built_at desc
limit 50;
```

```sql
select view_id, owner_user_id, scope, name, target_ref, filter, created_at, updated_at
from report_saved_view
order by updated_at desc
limit 20;
```

---

## 7. Required Fixes Before Source-Data Sign-Off

| Priority | Fix | Files |
|---|---|---|
| High | Stop rendering absent breakdown keys as confirmed `0`; show unavailable/null with warning or guarantee resolvers return every configured breakdown key. | `src/components/reporting/KpiBreakdownCards.js`, `src/components/reporting/admin/AdminBreakdownCards.js`, `src/components/reporting/valeting/ValetingBreakdownCards.js`, `src/components/reporting/paint/PaintBreakdownCards.js` |
| Medium | Put data-quality endpoint source inside standard reporting provenance so `meta.source` reflects live monitor data. | `src/pages/api/reports/data-quality.js` |
| Medium | Confirm event-backed and snapshot-backed sections are tested only after `report_event`, status-history tables, snapshots and aggregation runs contain real rows. | Supabase reporting schema and cron endpoints |
| Low | Keep static package config arrays documented as layout/KPI contracts so future maintainers do not mistake descriptors for mock data. | `src/components/reporting/**/**ReportConfig.js` |

---

## 8. Handover Decision

The reporting system does **not** appear to use mock/demo/sample/hard-coded local data for report values. Most displayed sections are correctly wired to the reporting API, engine, KPI definitions and live database resolvers.

Do not fully sign off source-data correctness until:

- The silent breakdown `0` fallback is fixed or every resolver is proven to emit all configured breakdown keys.
- `/api/reports/data-quality` provenance is corrected.
- Live acceptance confirms every displayed value matches its source table rows for the selected filters.
- Snapshot-backed Executive sections are tested after aggregation has produced snapshot rows.
- Event-backed Admin/Executive health sections are tested after events and report audit rows are accruing.

