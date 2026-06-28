# HNPSystem — Management & Executive Reporting Package Implementation (Phase 14)

> **Status:** Implemented. Phase 14 = the **ninth and flagship report package** built on the shared
> reporting foundation after Workshop, Parts, Accounts, Service Advisor, MOT, Valeting, Paint and Admin.
> This phase builds **Management & Executive reporting only**. It creates **no new reporting infrastructure**;
> it consumes the existing shared platform and **composes the department packages already implemented**.
> Workshop, Parts, Accounts, Service Advisor, MOT, Valeting, Paint and Admin reporting were **not modified**,
> except for promoting one breakdown-card component to the shared folder for reuse and registering the new
> `mgt.*` KPI definitions + the executive Reports route (which the navigation config already reserved).

---

## 0. Executive Summary

Phase 14 ships the Management & Executive report package on the existing `/api/reports/*` platform. The
package is an **orchestration layer**: every executive number is **composed from an already-implemented
department KPI's own resolver** — never recalculated — so there is exactly one canonical formula per metric
(Principle 2 / ADR-4).

1. `src/lib/reporting/kpiDefinitions/management.js` registers the Phase-3 §14 Management KPI catalogue
   entries (`mgt.*`). Live composition resolvers were added for the buildable set — `mgt.company_revenue`
   (R1), `mgt.upsell_contribution` (R1), `mgt.site_recovery` (R2), `mgt.department_performance` (R2),
   `mgt.growth` (R2) and `mgt.forecast_inputs` (R2). The genuinely-blocked metrics (`mgt.bottleneck`,
   `mgt.sla_attainment`, `mgt.company_profitability`, `mgt.capacity_utilisation`, `mgt.cost_to_serve`,
   `mgt.customer_satisfaction`) are **declared** (catalogue entry, no resolver) with their exact blocker.
2. `src/pages/reports/overview.js` and `src/components/reporting/management/` add the eight executive
   sections: Executive Overview, Department Performance, Operational Performance, Revenue & Profitability,
   Capacity & Bottlenecks, Executive Trends, Executive Drill-down and Reporting Utilities.
3. Saved views, CSV exports, filters, drill-downs, permission scope, trends and audit logging reuse the
   existing reporting APIs, hooks and UI components — **no separate executive reporting system** was created.
4. Every `mgt.*` KPI carries `MGT_REPORT_PERMISSION` (= `EXECUTIVE_ROLES`), so the engine's per-KPI
   permission gate restricts the data to Dealer Principal / Owner, Directors and Senior Management.
   Operational department managers (workshop / parts / service managers) are **excluded** — they keep their
   department reporting packages unless explicitly granted an executive role.

The package consumes the shared platform end-to-end: KPI framework (`kpiCatalog`/`defineKpi`), reporting APIs
(`/api/reports/kpi|trend|drilldown|export|views`), reporting hooks (`useReporting`), permission framework
(`permissionScope`), snapshot/trend framework (`resolver`/`trendBuilder`), drill-down framework (`drilldown`),
export framework (`export`), saved-views framework (`savedViews`) and the reporting UI framework
(`KpiScorecardStrip`, `KpiPanel`, `KpiValueCard`, `KpiTrendChart`, `KpiBreakdownCards`, `ReportDrilldownTable`,
`ReportFilterBar`, `SavedViewsBar`, `ReportSection`, `ProvenanceFooter`).

### Files added
| File | Purpose |
|---|---|
| `src/lib/reporting/kpiDefinitions/management.js` | The 12 `mgt.*` KPI definitions (composition resolvers + declared). |
| `src/components/reporting/KpiBreakdownCards.js` | Shared breakdown-card component (promoted from per-package copies). |
| `src/components/reporting/management/managementReportConfig.js` | Layout metadata only — no maths. |
| `src/components/reporting/management/ExecutiveTrendCard.js` | One trend-card wrapper reused by Overview + Trends. |
| `src/components/reporting/management/ExecutiveOverviewTab.js` | Company scorecard + daily/weekly/monthly/YTD. |
| `src/components/reporting/management/DepartmentPerformanceTab.js` | Cross-department comparison + trends. |
| `src/components/reporting/management/OperationalPerformanceTab.js` | Existing operational KPIs combined. |
| `src/components/reporting/management/RevenueProfitabilityTab.js` | Revenue aggregation + flagged profitability. |
| `src/components/reporting/management/CapacityBottlenecksTab.js` | Workload/queue proxies + flagged capacity. |
| `src/components/reporting/management/ExecutiveTrendsTab.js` | Daily/weekly/monthly/yearly composite trends. |
| `src/components/reporting/management/ExecutiveDrilldownTab.js` | Navigation into department packages + drill explorer. |
| `src/components/reporting/management/ManagementUtilitiesTab.js` | Saved views, exports, drill-downs. |
| `src/pages/reports/overview.js` | The executive page (executive-gated, `/reports/overview`). |

### Files changed (minimal, additive)
- `src/lib/reporting/kpiDefinitions/index.js` — registers `...managementKpis` after the department sets.

---

## 1. Executive Reporting Implementation Summary

The Management package adds **no aggregation, snapshot, event, permission, export, saved-view, drill-down or
KPI infrastructure**. It is a pure read composition on top of the eight department packages:

- **KPIs** are composed by calling `getKpi(id).resolver(ctx)` for each underlying department metric — the
  department formula runs verbatim, so the executive figure can never diverge from the department figure.
- **Trends** reuse `useKpiTrend` → `/api/reports/trend` → the shared `trendBuilder` (per-bucket live
  recompute until snapshots accrue).
- **Drill-downs** reuse `useDrilldown` → `/api/reports/drilldown` → the shared `drilldown` framework. Where a
  composite carries a drill-down (e.g. `mgt.company_revenue`) it delegates to the underlying department KPI's
  own drill-down (`acc.revenue`), so no drill-down logic is duplicated.
- **Cross-department drill-down** is delivered as navigation links into the **existing** department report
  pages (`/reports/workshop`, `/reports/parts`, …). No department report page is recreated.
- **Exports / saved views / filters** reuse `buildExportUrl`, `SavedViewsBar` and `ReportFilterBar` exactly
  as every other package does.

All eight requested sections are delivered as tabs on a single executive page.

---

## 2. Executive KPIs Implemented

All formulas are taken **verbatim** from the KPI Catalogue (§14). No formula, calculation or KPI id was
invented; composites read the existing department KPIs through their own resolvers.

### Operational now (R1 — composed inputs all live today)

| KPI | Readiness | Formula (catalogue §14) | Composed from |
|---|---|---|---|
| `mgt.company_revenue` | R1 | `Σ acc.revenue` (company total) | `acc.revenue` + `acc.labour_revenue` + `acc.parts_revenue` |
| `mgt.upsell_contribution` | R1 | `vhc.upsell_revenue ÷ acc.revenue × 100` | `vhc.upsell_revenue` ÷ `acc.revenue` |

### Operational now with documented caveat (R2 — composes R1 inputs, clearly flagged)

| KPI | Readiness | Implemented as | Flag |
|---|---|---|---|
| `mgt.site_recovery` | R2 | `Σ wsh.sold_hours ÷ Σ wsh.clocked_hours × 100` (site-wide) | Trustworthy once the two clocking systems are reconciled (debt D5). Both inputs compute today. |
| `mgt.department_performance` | R2 | Per-department headline KPIs (throughput + quality) composed side-by-side for comparison | The single **normalised index / ranking** needs the `dim_kpi` weighting model + `TARGET_SET` targets; the composed per-department **values** are live. |
| `mgt.growth` | R2 | `(this period − same period last year) ÷ last year × 100` for revenue + throughput | Prior-year window is empty until ≥13 months of history accrue — resolves to `null` rather than a fabricated figure. |
| `mgt.forecast_inputs` | R2 | Curated current-period inputs (revenue, throughput, bookings, site recovery) | These are the forecast **inputs**, not a forecast; the forecast-ready ≥13m daily series needs the snapshot spine. |

### Operational facets surfaced from resolver breakdowns (not new KPI ids)

| Facet | Source breakdown |
|---|---|
| Company revenue split | `mgt.company_revenue.breakdown.{total_revenue,labour_revenue,parts_revenue,invoices}` |
| Upsell contribution | `mgt.upsell_contribution.breakdown.{upsell_revenue,total_revenue,contribution_pct}` |
| Site recovery | `mgt.site_recovery.breakdown.{sold_hours,clocked_hours,recovery_pct}` |
| Department comparison table | `mgt.department_performance.breakdown.departments[]` (per-dept primary/quality KPI values + health) |
| YoY growth | `mgt.growth.breakdown.{current_revenue,prior_year_revenue,revenue_growth_pct,current_throughput,prior_year_throughput,throughput_growth_pct}` |
| Forecast inputs | `mgt.forecast_inputs.breakdown.{revenue,throughput,bookings,site_recovery_pct,series_available}` |

The **Operational Performance**, **Revenue & Profitability** and **Capacity & Bottlenecks** sections combine
the existing department KPIs directly (no new `mgt.*` ids) — Workshop efficiency/utilisation/productivity,
labour & parts revenue, invoice performance, customer authorisation, VHC/MOT performance, valeting & paint
throughput, open WIP, open parts by status (incl. waiting-for-authorisation), outstanding invoices and the
valet/paint queues. Each card reads its department's canonical KPI; nothing is recomputed.

---

## 3. Executive KPIs Blocked

Declared (catalogue entry, **no resolver**) so the UI lists the metric and its exact blocker rather than
inventing a number:

| KPI | Readiness | Blocker |
|---|---|---|
| `mgt.bottleneck` | R2 | Ranking stages by dwell needs the `*_status_history` tables + backlog entity-state snapshots (none accrue yet; emits gated). Workload **proxies** (open WIP, open parts by status, outstanding invoices, valet/paint queues) are shown today. |
| `mgt.sla_attainment` | R2 | Needs both a stage-duration source (`*_status_history`) **and** an SLA/target model (`TARGET_SET` events). Neither exists; no thresholds are invented. |
| `mgt.company_profitability` | R3 | Needs COGS on invoice lines (`acc.gross_profit` is R3). Parts GP (`prt.profitability`) is live, labour GP (`wsh.profitability`) is R2 — a partial labour+parts GP becomes assemblable later; the company figure needs profitability modelling. |
| `mgt.capacity_utilisation` | R3 | Clocked hours are live (`wsh.clocked_hours`) but there is no capacity / available-hours model (no ramp/bay/shift entity) for the denominator. |
| `mgt.cost_to_serve` | R3 | Jobs-completed is live (`wsh.jobs_completed`) but total cost needs a cost/opex model (`acc.net_profit` is R3, likely an accounting-system integration). |
| `mgt.customer_satisfaction` | R3 | No CSAT/NPS capture exists (same blocker as `svc.csat`); needs a survey integration. |

---

## 4. Cross-Department KPIs Implemented

The cross-department story is delivered three ways, all reusing shared infrastructure:

1. **Composed cross-department composites** — `mgt.company_revenue` (Accounts), `mgt.upsell_contribution`
   (VHC + Accounts), `mgt.site_recovery` (Workshop hours), `mgt.growth` (Accounts + Workshop),
   `mgt.forecast_inputs` (Accounts + Workshop + Service) and `mgt.department_performance` (all seven
   operational departments).
2. **Cross-department comparison table** — `mgt.department_performance.breakdown.departments[]` lays every
   operational department's headline throughput + quality KPI side-by-side (composed from each department
   package's own resolver), with a per-department reporting-health indicator.
3. **Cross-department drill-down navigation** — the Executive Drill-down tab links straight into the existing
   `/reports/{workshop,parts,service,mot,valeting,paint,accounts,admin}` pages. The department report pages
   are **reused, not duplicated**.

---

## 5. Remaining R2 Blockers

- **Status-history spine (`*_status_history`).** Unblocks the true dwell-ranked `mgt.bottleneck` and (with a
  target model) `mgt.sla_attainment`; also firms up `mgt.site_recovery` once the clocking sources reconcile
  (D5).
- **Targets / SLA model (`TARGET_SET` events + `dim_kpi` weights).** Unblocks the normalised
  `mgt.department_performance` **index** and ranking, and `mgt.sla_attainment`.
- **≥13 months of history + snapshot accrual.** Populates the prior-year window for `mgt.growth` and the
  forecast-ready series behind `mgt.forecast_inputs` (moving both off live recompute onto snapshots).

## 6. Remaining R3 Blockers

- **COGS on invoice lines (profitability modelling).** `mgt.company_profitability` (and `acc.gross_profit` /
  `acc.net_profit`).
- **Capacity / available-hours model (ramp/bay/shift entity).** `mgt.capacity_utilisation` (and
  `wsh.utilisation`).
- **Cost / opex model (likely an accounting-system integration).** `mgt.cost_to_serve`.
- **CSAT/NPS capture (survey integration).** `mgt.customer_satisfaction` (and `svc.csat`).

---

## 7. Observations

**Data quality.** The executive figures are only as good as the department sources, and the package surfaces
that honestly: company revenue inherits the denormalised invoice-total caveat (D12); site recovery inherits
the dual clocking-source caveat (D5); the per-department split of revenue waits on the department dimension
(D3). Each is documented in the KPI `futureNotes` and the section subtitles rather than hidden. No executive
metric fabricates a value — blocked KPIs are declared and rendered as "Not yet captured".

**Reporting performance.** The package adds no new queries — each composite fans out to existing department
resolvers via `Promise.all`, so a composite costs the sum of its (already-bounded) department reads. The
heaviest is `mgt.department_performance` (14 department-resolver reads, run concurrently); the rest read 1–5.
Scorecards batch through a single `/api/reports/kpi?ids=` call; trends use the shared live fallback until
snapshots accrue. `mgt.growth` issues two windows (current + prior-year) per metric. The shared read cache
(`cache.js`, keyed by kpiId/filter/scope) absorbs dashboard refresh storms across all of it.

**Aggregation.** No new aggregation jobs were added. The composites are computed on read by orchestrating
department resolvers; once the nightly `kpi_daily_snapshot` job accrues, the same `mgt.*` ids become
snapshot-backed automatically through the resolver's snapshot fast-path — no package change required. Ratio
composites already expose numerator/denominator separately so weekly/monthly rollups stay correct (not
averages-of-averages).

**Executive permissions.** Defence in depth: the page is gated by `ProtectedRoute` to `EXECUTIVE_ROLES`, and
**independently** every `mgt.*` KPI carries `MGT_REPORT_PERMISSION` so the engine refuses the data
server-side even if the page were reached. Executives resolve to the `EXECUTIVE` scope level (auto-pass) and
carry the financial-sensitive flag, so the composed financial inputs (`acc.*`) resolve for them. Cross-
department managers (`CROSS_DEPARTMENT` level) are deliberately **not** admitted — they keep their department
packages unless granted an executive role. Every view/export is itself written to `audit_log` via the shared
reporting audit backbone (the same signal `adm.report_usage` reports on), so executive reporting is
self-auditing.

---

## 8. Recommended Next Phase

Phase 15 should focus on the capture that lights up the declared executive KPIs, in dependency order:

1. **Switch on `reporting_emit_enabled` + accrue the status-history spine.** Unblocks `mgt.bottleneck`
   (dwell-ranked) and the department-dimension revenue split behind `mgt.company_revenue`.
2. **Stand up the `TARGET_SET` / `dim_kpi` weighting model.** Unblocks the normalised
   `mgt.department_performance` index + ranking and `mgt.sla_attainment`.
3. **Begin daily snapshot accrual.** Moves `mgt.growth` and `mgt.forecast_inputs` from live recompute onto
   snapshot-backed series and populates the prior-year window once ≥13 months exist.
4. **Profitability modelling (COGS on invoice lines).** Unblocks `mgt.company_profitability` and the Accounts
   GP family it composes.

---

## 9. Status at Completion

**Which executive KPIs are fully operational (R1, live today):**
`mgt.company_revenue`, `mgt.upsell_contribution` — plus all the breakdown facets in §2 (revenue split, upsell
contribution). The Operational, Revenue and Capacity sections are also fully live where they compose existing
R1 department KPIs (workshop efficiency, labour/parts/MOT revenue, customer authorisation, VHC/MOT
performance, valeting/paint throughput, open WIP, open parts by status incl. waiting-for-authorisation,
outstanding invoices, valet/paint queues, parts margin).

**Operational now with a documented caveat (R2, composing R1 inputs):**
`mgt.site_recovery` (clocking reconciliation D5), `mgt.department_performance` (composed values live; index
declared), `mgt.growth` (prior-year window null until history accrues), `mgt.forecast_inputs` (inputs live;
forecast-ready series pending snapshots).

**Which executive KPIs depend on future reporting phases:**
`mgt.department_performance` (normalised index/ranking), `mgt.growth` (snapshot-backed YoY),
`mgt.forecast_inputs` (forecast-ready series), the per-department revenue split of `mgt.company_revenue`.

**Which executive KPIs require event-spine / status-history maturity:**
`mgt.bottleneck` (status-history dwell + backlog snapshots), `mgt.sla_attainment` (status-history +
SLA/target model). The department-dimension revenue split also needs the event spine to stamp owner
department.

**Which executive KPIs require profitability modelling:**
`mgt.company_profitability` (COGS / gross profit), `mgt.cost_to_serve` (full cost/opex model).

**Which executive KPIs require additional operational entities / integrations:**
`mgt.capacity_utilisation` (capacity / ramp / bay / shift entity), `mgt.cost_to_serve` (opex / accounting
integration), `mgt.customer_satisfaction` (CSAT/NPS survey integration).

---

## 10. Validation

Run:

```bash
npm run validate:reporting
npm run check:report-events
npm run check:borders
npm run build
```

Observed during implementation:

- `npm run validate:reporting` passed: **36/36** (R1 KPIs — incl. `mgt.company_revenue` and
  `mgt.upsell_contribution` — all carry resolvers; every `mgt.*` `sourceEvents` references a real catalogue
  event; every `mgt.*` sits in the real `management` department).
- `npm run check:report-events` passed with the single pre-existing `jobClocking.js` advisory (unchanged by
  this phase) — no new event-name violations.
- `npm run check:borders` reports only the pre-existing global-stylesheet violations in `src/styles/*`; **no
  Phase 14 file introduced a border violation**.
- `npm run build` compiled successfully; `/reports/overview` is emitted as a static route alongside the other
  eight report packages.
