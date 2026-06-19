# HNPSystem - MOT Reporting Package Implementation (Phase 10)

> **Status:** Implemented. Phase 10 = the **fifth report package** built on the shared reporting
> foundation after Workshop, Parts, Accounts and Service Advisor. This phase builds **MOT reporting only**.
> No Management, Valeting or Paint reports were built. Workshop, Parts, Accounts and Service Advisor
> reporting were not changed except for one tiny shared query-builder extension required by MOT revenue.
> **Source of truth:** all reporting docs in `docs/Report System/`, including the completed Phase 9 Service
> Advisor package document. **Rule honoured:** every KPI id and formula comes from KPI Catalogue §9
> (`mot.*`). No UI calculation, no dashboard-helper reuse, and no separate reporting system.

---

## 0. Executive Summary

Phase 10 ships the **MOT report package** end-to-end on the existing `/api/reports/*` platform. It adds:

1. **MOT KPI catalogue promotion** in `src/lib/reporting/kpiDefinitions/mot.js`.
   Operational now: `mot.volume`, `mot.pass_rate` (R1* with the documented unreliability caveat),
   `mot.revenue`, `mot.throughput`, `mot.due_pipeline`, plus a clocking-based interim resolver for
   `mot.tester_productivity` because the readiness audit says tester labour is reportable now.
2. **MOT UI package** in `src/pages/reports/mot.js` and `src/components/reporting/mot/`, reusing shared
   scorecards, KPI panels, trend charts, drill-down tables, filters, exports and saved views.
3. **Navigation and permissions** via the existing flag-gated Reports section. Page visibility is derived
   from `ROLE_DEPARTMENT_MAP` for MOT, Service, Workshop, Management and Admin roles; API permission scope
   still enforces access server-side.
4. **Audit and export** via the existing framework. MOT report views, drill-downs and CSV exports flow
   through the audited reporting APIs, so `report.view` / `report.export` logging is reused unchanged.

---

## 1. What Was Built

### 1.1 KPI Definitions

| KPI | Status | Detail |
|---|---|---|
| `mot.volume` | Operational | `COUNT(jobs type='MOT' in period)`, dated by `checked_in_at` per catalogue proxy. |
| `mot.pass_rate` | Operational with caveat | `COUNT(pass) ÷ COUNT(results) × 100`; uses mutually-exclusive `completion_status` buckets to avoid overlapping `ILIKE`, but remains R1* unreliable until `mot_tests.result`. |
| `mot.revenue` | Operational | `Σ MOT line value on invoices`; sums MOT invoice items by parent `invoice_date`. |
| `mot.throughput` | Operational | Tests/day trend from MOT job volume. |
| `mot.due_pipeline` | Operational | Vehicles with `mot_due` in the next 30 days. |
| `mot.tester_productivity` | Interim R2 resolver | Tests per tester and mean duration from `job_clocking.work_type='mot'`; reliable attribution improves with `mot_tests.tester_id`. |
| `mot.first_time_pass`, `mot.retest_rate`, `mot.repair_conversion`, `mot.advisory_conversion` | Declared | Catalogue entries only; no invented formulas. |

### 1.2 Shared Infrastructure Extension

Added `sumColumnFromSelect()` to `src/lib/reporting/queryBuilder.js` so a resolver can sum a base-table
column while filtering through an embedded parent select. MOT revenue needs this to sum `invoice_items.total`
for MOT lines while applying the reporting date range to `invoices.invoice_date`.

### 1.3 MOT Report UI

Tabs implemented:

| Tab | Contents |
|---|---|
| MOT Overview | Department scorecard; daily, weekly and monthly summaries for volume and revenue. |
| MOT Operations | MOT volume, pass/fail analysis, throughput monitoring, MOT-due pipeline, outcome drill-downs. |
| Tester Activity | Tester workload/activity and tester-level drill-down from MOT clocking. |
| MOT Revenue & Conversion | MOT revenue, revenue trend, declared repair/advisory conversion readiness indicators. |
| Reporting Utilities | Saved views, audited CSV exports, filters via the global filter bar, drill-down explorer. |

---

## 2. MOT KPIs Implemented

Operational now:

| KPI | Formula | Notes |
|---|---|---|
| `mot.volume` | `COUNT(jobs type='MOT' in period)` | Uses `checked_in_at` as the documented R1 proxy date. |
| `mot.pass_rate` | `COUNT(pass) ÷ COUNT(results) × 100` | Also exposes completed/pass/fail/retest counts in `breakdown`; caveated until `mot_tests`. |
| `mot.revenue` | `Σ MOT line value on invoices` | Uses MOT invoice-line descriptions, filtered by invoice date. |
| `mot.throughput` | `tests/day trend` | Same source as volume, re-bucketed by the engine. |
| `mot.due_pipeline` | `COUNT(vehicles mot_due within N days)` | N = 30 days, point-in-time reminder pipeline. |
| `mot.tester_productivity` | `tests per tester per period; mean test duration` | Clocking-based interim from `job_clocking.work_type='mot'`. |

---

## 3. MOT KPIs Blocked

| KPI | Readiness | Blocker |
|---|---|---|
| `mot.first_time_pass` | R3 | Needs `mot_tests.retest_of` to know first attempt vs retest. |
| `mot.retest_rate` | R3 | Needs `mot_tests` and retest linkage. |
| `mot.repair_conversion` | R2 | Needs event-spine linkage from MOT outcome to authorised repair work. |
| `mot.advisory_conversion` | R3 | Needs advisory capture (`mot_advisories`). |

---

## 4. Remaining Blockers

**R2 blockers**

- MOT result events (`MOT_RESULT_RECORDED`) and status/history accrual for outcome-to-repair conversion.
- Stronger tester attribution from `MOT_STARTED` / `MOT_RESULT_RECORDED` event pairs.
- Actor bridge consistency for per-tester attribution.

**R3 blockers**

- `mot_tests` entity with `result`, `tester_id`, `test_date`, `mileage` and `retest_of`.
- `mot_advisories` rows with severity/defect codes and converted-work linkage.
- Typed invoice-line categories would remove the remaining MOT revenue description match.

---

## 5. Observations

**Data quality:** The package does not use the old MOT dashboard helper. Pass/fail/retest uses a
mutually-exclusive normalisation bucket, not overlapping `ILIKE`, but the source is still
`jobs.completion_status`, so it is labelled R1* and not treated as a final test-result model.

**Performance:** Scorecards batch KPI values through one API call. Trends use the existing live fallback
until snapshots are applied. MOT resolvers are cheap exact counts, a grouped outcome count, one invoice-line
sum and one bounded clocking aggregation.

**Attribution:** Tester-level drill-down is supported where current data allows it: MOT clocking rows have
`user_id`. Per-test signed attribution remains blocked until `mot_tests.tester_id`.

---

## 6. Recommended Next Phase

Phase 11 should either:

1. Add the `mot_tests` + `mot_advisories` entities and result emitters, then replace the MOT result proxy
   with trustworthy `mot_tests.result`; or
2. Build the next operational package (Valeting or Paint) while leaving MOT declared metrics blocked.

Once `mot_tests` lands, the next MOT resolver pass can unlock reliable pass rate, first-time pass,
retest rate, tester productivity, advisory conversion and richer DVLA/history reporting without changing
the MOT UI structure.

---

## 7. Status at Completion

**Operational now:** MOT volume, completed/result-count facet via `mot.pass_rate`, passed, failed and
retest-labelled outcome facets via `mot.pass_rate.breakdown`, MOT throughput, MOT revenue, MOT-due
pipeline, and clocking-based tester activity.

**Dependent on future phases:** first-time pass, reliable retest rate, repair conversion, advisory
conversion, reliable per-tester pass/performance.

**Requires status-history accrual:** `mot.repair_conversion` and any outcome-to-repair transition latency.

**Requires tester attribution improvements:** reliable `mot.tester_productivity` and any per-tester pass
rate/performance view need `mot_tests.tester_id` plus actor bridge/event stamping.

**Requires MOT outcome modelling improvements:** reliable pass/fail/retest, first-time pass and retest
rate need `mot_tests.result` plus constrained result values and retest linkage.

---

## 8. Validation

Run:

```bash
npm run validate:reporting
npm run check:report-events
npm run check:borders
```

Expected: MOT adds no separate reporting system and no duplicated UI. Any remaining border-check failures
should be pre-existing debt unless this phase is explicitly listed.
