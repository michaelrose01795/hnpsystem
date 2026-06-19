# HNPSystem — Workshop Reporting Package Implementation (Phase 6)

> **Status:** Implemented. Phase 6 = the **first report package** built on the reporting foundation
> (Phase 4) and activation/hardening (Phase 5). This phase builds **Workshop reporting only** — no
> Parts, Accounts, Management, MOT, Valeting or Paint screens were built (deliberately out of scope).
> **Source of truth:** the four architecture docs in `docs/Report System/`
> (`reporting-readiness-audit.md`, `reporting-platform-architecture.md`,
> `reporting-data-collection-architecture.md`, `reporting-kpi-catalogue-architecture.md`) + the
> Phase-4 (`reporting-foundation-implementation.md`) and Phase-5
> (`reporting-activation-readiness.md`) summaries.
> **Rule honoured:** every figure, formula, trend, drill-down and permission decision comes from the
> existing engine/APIs. **No KPI is calculated in the UI; no formula was invented** — all calculations
> originate from the KPI catalogue.

---

## 0. Executive Summary

Phase 6 ships the **Workshop report package** end-to-end on the shared platform: a dashboard with five
sections (Overview, Operations, Technician Performance, VHC Performance, Reporting Utilities), built
entirely from thin clients of `/api/reports/*`. It does three things:

1. **Promotes the Workshop KPI catalogue.** The seed set (2 Workshop + 3 VHC KPIs) is expanded to the
   full Phase-3 §5 / §8 Workshop catalogue. **Twelve R1 metrics now have working resolvers**; **eight
   R2/R3 metrics are *declared*** (catalogue entry, no resolver) so they surface honestly with their
   exact blocker rather than being silently omitted. Every resolver uses the sanctioned `queryBuilder`
   (exact counts, paginated sums) — no `.limit()` totals.
2. **Builds the Workshop UI** — summary scorecards, KPI panels, daily/weekly/monthly trends,
   drill-down tables, filtering, audited CSV exports and saved views — as **reusable reporting
   components** (`src/components/reporting/*`) that any future department package reuses unchanged.
3. **Wires the `/reports` area in** (signed-off global change): the flag-gated **Reports** sidebar
   section, the edge/page access guard, and the `reporting_nav_enabled` flip — making the package
   reachable for Workshop/Service/management roles while the API enforces per-KPI permission, scope and
   audit server-side.

**Net result:** Workshop department-level reporting is **operational and trustworthy today**
(live-correct, exact, provenance-labelled). Per-technician efficiency/ranking is operational from the
canonical int-keyed `tech_efficiency_entries`. Cycle-time/dwell, labour-recovery, productivity and
utilisation tiers remain blocked on the documented R2/R3 prerequisites (event-spine accrual, clocking
reconciliation D5, capacity model).

---

## 1. What Was Built

### 1.1 KPI definitions (catalogue promotion — `src/lib/reporting/kpiDefinitions/`)

| File | Change |
|---|---|
| `workshop.js` | Expanded from 2 → 18 Workshop KPIs (10 new R1 resolvers + 8 declared R2/R3). |
| `vhc.js` | Added `vhc.completion_rate` (R1) alongside the existing `vhc.red_items`, `vhc.authorisation_rate`, `vhc.upsell_revenue` (all owned by the **workshop** department per the catalogue). |

Every definition states the **verbatim catalogue formula**, sources, tier, readiness, unit, target
type and (where applicable) a `drilldown`. Resolvers route through `queryBuilder` only.

### 1.2 Shared reporting UI (`src/components/reporting/` — reused by all future packages)

| Component | Role |
|---|---|
| `ReportFilterBar` | Date-range preset, trend granularity, search; pins department. Emits a normalised-filter patch. |
| `KpiValueCard` / `KpiScorecardStrip` | Summary cards + responsive scorecard strip (one `/api/reports/kpi?ids=` call). |
| `KpiTrendChart` | Dependency-free SVG area/line trend from `/api/reports/trend`. |
| `KpiPanel` | Value + trend + inline drill-down toggle for a single KPI. |
| `ReportDrilldownTable` | Contributing records from `/api/reports/drilldown` + audited CSV via `/api/reports/export`. |
| `SavedViewsBar` | List / save / delete saved filter sets via `/api/reports/views`. |
| `ProvenanceFooter` | Source / as-of / live-vs-snapshot / formula-version + warnings on every figure. |
| `ReportSection` | Titled `LayerTheme` section (keeps the surface/theme alternation + borderless layer law). |

Data access is centralised in **`src/hooks/reporting/useReporting.js`** (`useReportFilter`,
`useKpiValues`, `useKpiTrend`, `useDrilldown`, `useSavedViews`, `buildExportUrl`) — thin `fetch`
wrappers over the standard envelope. **No Supabase, no KPI maths, no duplicated reporting logic in the
client.** Value formatting (and only formatting) lives in `src/utils/reporting/formatKpiValue.js`.

### 1.3 Workshop pages (`src/pages/reports/workshop.js` + `src/components/reporting/workshop/`)

| Section (tab) | Contents | KPIs |
|---|---|---|
| **Overview** | Department scorecard + daily/weekly/monthly performance summary | jobs completed/created, jobs/day, throughput, sold hours, labour sales, tech efficiency, VHC completion |
| **Operations** | Job volume, job flow, throughput, workload monitoring | jobs completed/created (panels + trend + drill), throughput, jobs/tech, sold vs clocked hours |
| **Technician Performance** | Efficiency, ranking, activity, productivity readiness indicators | tech efficiency, jobs/tech, labour sales, mobile activity, ranking table; declared tech-productivity / labour-recovery / utilisation |
| **VHC Performance** | Completion, red items, authorisation, upsell | vhc.completion_rate, vhc.red_items (drill), vhc.authorisation_rate, vhc.upsell_revenue |
| **Reporting Utilities** | Saved views, exports, drill-down explorer | every drillable Workshop/VHC KPI |

`workshopReportConfig.js` holds the **layout grouping only** (which KPI ids appear where); the engine
remains the single source of every value and formula.

### 1.4 Navigation, access & permissions (signed-off global wiring)

| File | Change |
|---|---|
| `src/lib/reporting/config/flags.js` | `reporting_nav_enabled` → **ON** (Phase-6 sign-off). |
| `src/config/navigation.js` | Flag-gated **Reports** sidebar section with a **Workshop Reports** link. Visible roles are *derived from the canonical `ROLE_DEPARTMENT_MAP`* (workshop + service + management/admin), never hardcoded. |
| `src/config/routeAccess.js` | `/reports` added to `PROTECTED_PREFIXES` (requires an authenticated session at the edge). |
| `src/lib/reporting/validation/reportingActivation.test.js` | The flag-posture assertion updated to the Phase-6 posture (nav ON). |

The `PageAccessGuard` reads `sidebarSections`, so adding the Reports section is what makes
`/reports/workshop` reachable for permitted roles. The page also wraps in `ProtectedRoute` with the
same role-derived set. **All data permissions remain server-side**: `withReportingAuth` →
`permissionScope` (department/scope) + per-KPI permission gate; financial/PII gates unchanged.

### 1.5 Audit

Report **view** and **export** are audited by the existing framework with **zero new code**:
`auditReportAccess` (gated by `reporting_access_audit_enabled`, **ON**) writes a hash-chained
`audit_log` row (`report.view` / `report.export`) and mirrors a `REPORT_VIEWED` / `REPORT_EXPORTED`
event on every `/api/reports/{kpi,drilldown,export}` call the Workshop UI makes.

---

## 2. Workshop KPIs Implemented (operational now)

"Operational" = has a resolver, computes trust-correctly today (live), and is wired into the UI with
permissions, drill-down (where defined) and provenance.

| KPI | Tier | Formula (from catalogue) | Notes |
|---|---|---|---|
| `wsh.jobs_completed` | operational | COUNT(jobs.completed_at in period) | Exact count (fixes D8 truncation). Drill-down. |
| `wsh.jobs_created` | operational | COUNT(jobs.created_at in period) | Drill-down. |
| `wsh.jobs_per_day` | operational | COUNT(jobs completed) per day | Headline = mean/day; trend = daily counts. Drill-down. |
| `wsh.throughput` | tactical | created vs released; net WIP = created − released | 'Released' uses `completed_at` until the released status-transition accrues. |
| `wsh.sold_hours` | tactical | Σ job_requests.hours (+ Σ authorised vhc_checks.labour_hours) | Paginated sums. |
| `wsh.clocked_hours` | operational | Σ time_records.hours_worked (net breaks) | time_records model; **D5 caveat** (see §5). |
| `wsh.labour_sales` | tactical | Σ sold_hours × default_labour_rate | Reads `company_settings.default_labour_rate`; null + flagged if unset. |
| `wsh.tech_efficiency` | tactical | Σ allocated_hours ÷ Σ hours_spent × 100 | From int-keyed `tech_efficiency_entries`. Manager-gated. Catalogue R1*. |
| `wsh.tech_ranking` | tactical | per-tech efficiency, ranked desc | Drill-down/export table. Manager-gated. Ranks by int `user_id`. |
| `wsh.jobs_per_tech` | tactical | COUNT(completed) ÷ COUNT(active technicians) | Active = distinct `job_clocking.user_id` in range. |
| `wsh.mobile_activity` | tactical | COUNT(jobs service_mode='mobile') by mobile_outcome | Outcome distribution + drill-down. |
| `vhc.completion_rate` | tactical | COUNT(VHC completed) ÷ COUNT(vhc_required) × 100 | New in Phase 6. |
| `vhc.red_items` | operational | COUNT(vhc_checks.severity='red') | Real severity (no default-amber). Drill-down. |
| `vhc.authorisation_rate` | tactical | Σ authorized ÷ Σ(authorized+declined) × 100 | Ratio inputs stored separately. |
| `vhc.upsell_revenue` | tactical | Σ vhc_checks.authorized_total_gbp | Paginated sum. |

**15 Workshop-package KPIs operational** (11 `wsh.*` + 4 `vhc.*` owned by workshop). Every metric the
brief named is covered: jobs completed, jobs created, jobs per day, throughput, sold hours, clocked
hours, labour sales, technician efficiency, technician ranking, mobile technician activity, VHC
completion rate, red items found, authorisation rate, upsell revenue.

---

## 3. Workshop KPIs Still Blocked (declared, no resolver yet)

These are **registered in the catalogue** (so they appear in the UI/`/api/reports/catalog` with their
exact blocker) but intentionally have **no resolver** — the engine reports them as "declared, readiness
Rn". They light up in a later phase once the prerequisite lands.

| KPI | Tier | Readiness | Blocker |
|---|---|---|---|
| `wsh.cycle_time` | tactical | R2 | Robust check-in→release timing needs the event spine live + `job_status_history` accrual. |
| `wsh.stage_dwell` | tactical | R2 | Per-status dwell needs `job_status_history` accrual (emits ON). |
| `wsh.labour_recovery` | tactical | R2 | sold ÷ clocked join needs the clocking-source reconciliation (D5). |
| `wsh.tech_productivity` | tactical | R2 | Productive ÷ attended hours needs the two clocking systems reconciled (D5). |
| `wsh.additional_work_recovery` | tactical | R2 | Authorise→additional-work-started linkage via the event spine. |
| `wsh.profitability` | strategic | R2 | Loaded labour cost (`users.hourly_rate`) joined to clocked hours. |
| `wsh.utilisation` | tactical | R3 | No capacity / available-hours model (no ramp/bay/shift entity). |
| `wsh.rework_rate` | strategic | R3 | No rework/comeback flag on jobs. |

---

## 4. Remaining R2 / R3 Blockers (unchanged from Phase 5, restated for Workshop)

### 4.1 R2 — need applied SQL + accrued history + actor backfill
- **Status-history accrual** (apply `003_status_history.sql`, flip `reporting_emit_enabled`, schedule
  crons) → unblocks `wsh.cycle_time`, `wsh.stage_dwell`, the wait-time family.
- **Clocking-source reconciliation (D5)** → unblocks `wsh.labour_recovery`, `wsh.tech_productivity`,
  and makes `wsh.clocked_hours` canonical (today it is the `time_records` model only).
- **`dim_actor` backfill (int↔uuid + name→id)** → firms up per-technician attribution and the
  §3.7 ranking standard (name resolution). *Note:* the Phase-6 per-tech metrics already work because
  `tech_efficiency_entries.user_id` is the **canonical int** — `dim_actor` upgrades naming/joins, it is
  not a hard block for the implemented tech KPIs.
- **`users.department` vocabulary (D3)** → department attribution still rides on role, not the
  free-text column.
- **No snapshots yet** (aggregation cron unscheduled) → trends are served by labelled **live
  fallback**, not snapshots. Correct, but recomputed per request.

### 4.2 R3 — need missing domain entities / new modelling
- **Capacity / ramp / shift model** → `wsh.utilisation`, `wsh.capacity`, `wsh.ramp_utilisation`.
- **Rework/comeback flag on jobs** → `wsh.rework_rate`.
- **Loaded labour cost (users.hourly_rate)** → `wsh.profitability` (and executive department profit).

---

## 5. Reporting Performance Observations

- **One round-trip per scorecard.** The scorecard strip requests all its KPIs in a single
  `/api/reports/kpi?ids=…` call; the engine resolves them concurrently (`Promise.all`). Trend and
  drill-down are lazy (only the open panel/section fetches).
- **Live-fallback cost.** With no snapshots applied yet, every value is a **live recompute** against
  operational tables (labelled `live` in provenance). Counts are `head:true,count:'exact'` (cheap);
  sums and the tech-ranking aggregation paginate. Once `004_kpi_snapshots.sql` is applied and the
  daily cron runs, point values and trends switch to the snapshot fast-path automatically — **no UI
  change**.
- **Trend recompute.** Per-bucket trends recompute the resolver once per bucket via the engine's
  `liveResolver`; for wide ranges at daily granularity this is N small queries. The short-TTL
  reporting cache (`withReportingCache`, keyed by kpi+filter+scope) absorbs repeat views; snapshots
  remove the recompute entirely at go-live.
- **Ratio trends.** The UI only renders trends for flow/currency KPIs and percentage ratios (where
  `trendBuilder`'s ratio×100 is correct). Plain ratios (`jobs_per_tech`, `throughput`) are shown as
  card values, not trended, to avoid mis-scaled series — a deliberate UI choice, not a data change.

---

## 6. Reporting Data-Quality Observations

- **Trust-by-construction holds.** No `.limit()` total, no overlapping `ILIKE`, no default-amber RAG
  anywhere in the package — VHC severity uses the real `severity` column; counts are exact; sums
  paginate.
- **`wsh.clocked_hours` is the `time_records` model only (D5).** `job_clocking` is a second labour
  source; the two are not reconciled, so clocked-hours (and anything derived from it) carries a
  provenance/`futureNotes` caveat until D5 is resolved. Flagged, not silent.
- **`wsh.labour_sales` depends on a config rate.** It multiplies sold hours by
  `company_settings.default_labour_rate`; if the setting is absent the KPI returns `null` (not a
  fabricated £). Cross-check against invoiced `invoices.labour_total` belongs to the Accounts package
  (D12).
- **`throughput` 'released' is a proxy.** Until the `JOB_STATUS_CHANGED(→released)` transition accrues
  in `job_status_history`, 'released' uses `completed_at`. Documented in the KPI's `futureNotes`.
- **Technician identity is the int `user_id`.** The ranking table shows `user_id` (+ metrics); human
  names await `dim_actor` name resolution. No attribution is *guessed*.
- **Department attribution rides on role (D3).** As Phase 5 — the free-text `users.department` column
  is not yet constrained to `dim_department`.

---

## 7. Operational vs Future — exact status at completion

**Operational now (live, trustworthy, in the Workshop UI):**
`wsh.jobs_completed`, `wsh.jobs_created`, `wsh.jobs_per_day`, `wsh.throughput`, `wsh.sold_hours`,
`wsh.clocked_hours` *(D5 caveat)*, `wsh.labour_sales` *(rate-dependent)*, `wsh.tech_efficiency`,
`wsh.tech_ranking`, `wsh.jobs_per_tech`, `wsh.mobile_activity`, `vhc.completion_rate`,
`vhc.red_items`, `vhc.authorisation_rate`, `vhc.upsell_revenue`.

**Dependent on future reporting phases (declared, not yet computing):**
`wsh.cycle_time` (R2), `wsh.stage_dwell` (R2), `wsh.labour_recovery` (R2), `wsh.tech_productivity`
(R2), `wsh.additional_work_recovery` (R2), `wsh.profitability` (R2), `wsh.utilisation` (R3),
`wsh.rework_rate` (R3).

---

## 8. Recommended Next Phase

**Phase 7 — Capture go-live + Workshop depth, then the next package.** In order:

1. **Apply the SQL** (`000_all_reporting.sql`), run `seedDepartments()`, flip
   `reporting_emit_enabled` ON, and **schedule the aggregation crons** — this turns on snapshots
   (fast-path + trends) and starts `job_status_history` accruing, unblocking the R2 cycle-time/dwell
   Workshop tiers with no UI change.
2. **Resolve the clocking reconciliation (D5)** to make `wsh.clocked_hours` canonical and unblock
   `wsh.labour_recovery` / `wsh.tech_productivity`.
3. **Backfill `dim_actor`** for technician name resolution and the §3.7 ranking standard; constrain
   `users.department` (D3).
4. **Build the next department package** on the now-proven shared components — **Parts (open
   pipeline)** is the recommended follow-on (R1, exact, status-normalised), reusing
   `src/components/reporting/*` and `src/hooks/reporting/*` unchanged.

After the SQL/crons land, the declared Workshop R2 metrics become computable by adding resolvers to
the existing catalogue entries — **no UI or architectural change required**, exactly as the foundation
intended.

---

## 9. How to Re-run the Validation

```bash
npm run validate:reporting     # 36 runtime contract checks (now green with nav ON)
npm run check:report-events    # emit-name validity + emit-coverage advisories
npm run check:borders          # layer/border law (pre-existing staffglobal.css debt aside)
```

The Workshop package added **no** new failing checks: `validate:reporting` is 36/36 (the flag-posture
assertion was updated to the signed-off Phase-6 posture), `check:report-events` still passes with the
single pre-existing `jobClocking.js` advisory, and the new UI introduces **no** border-law violations
(surfaces use `LayerSurface`/`LayerTheme`; the only borders are form inputs via `--input-ring`).

---

*End of Phase 6. The Workshop report package is live on the shared reporting platform. No Parts,
Accounts, Management, MOT, Valeting or Paint reports were built. 15 Workshop KPIs are operational; 8
remain declared and dependent on the documented R2/R3 prerequisites.*
