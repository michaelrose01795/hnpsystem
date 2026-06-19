# HNPSystem — Parts Reporting Package Implementation (Phase 7)

> **Status:** Implemented. Phase 7 = the **second report package** built on the shared reporting
> foundation (Phase 4), activation/hardening (Phase 5) and the Workshop package (Phase 6). This phase
> builds **Parts reporting only** — no Accounts, Management, MOT, Valeting or Paint screens were built
> (deliberately out of scope). Workshop reporting was not modified except for one shared-infrastructure
> extension (`queryBuilder.sumProduct`) and the addition of a second link in the existing Reports nav
> section.
> **Source of truth:** the four architecture docs in `docs/Report System/`
> (`reporting-readiness-audit.md`, `reporting-platform-architecture.md`,
> `reporting-data-collection-architecture.md`, `reporting-kpi-catalogue-architecture.md`) + the Phase-4
> (`reporting-foundation-implementation.md`), Phase-5 (`reporting-activation-readiness.md`) and Phase-6
> (`reporting-workshop-package-implementation.md`) summaries.
> **Rule honoured:** every figure, formula, trend, drill-down and permission decision comes from the
> existing engine/APIs. **No KPI is calculated in the UI; no formula was invented** — all calculations
> originate from KPI Catalogue §6 (`prt.*`).

---

## 0. Executive Summary

Phase 7 ships the **Parts report package** end-to-end on the shared platform, making Parts the **second
fully integrated reporting package** after Workshop. It is built **entirely from thin clients of
`/api/reports/*`** and reuses the Phase-6 shared components (`src/components/reporting/*`), hooks
(`src/hooks/reporting/useReporting.js`) and the engine unchanged. It does three things:

1. **Promotes the Parts KPI catalogue.** The seed set (2 Parts KPIs) is expanded to the full Phase-3 §6
   Parts catalogue. **Eleven R1 metrics now have working resolvers**; **nine R2/R3 metrics are
   *declared*** (catalogue entry, no resolver) so they surface honestly with their exact blocker rather
   than being silently omitted. Every resolver routes through the sanctioned `queryBuilder` (exact
   counts, paginated sums, paginated product-sums) — no `.limit()` totals, no invented maths.
2. **Builds the Parts UI** — summary scorecards, KPI panels, daily/weekly/monthly trends, drill-down
   tables, filtering, audited CSV exports and saved views — using the **same reusable reporting
   components** the Workshop package introduced. No duplicate UI, no duplicate KPI cards, no duplicate
   drill-down implementation was created. Layout grouping lives in `partsReportConfig.js`; the engine
   remains the single source of every value and formula.
3. **Wires the Parts report into the existing `/reports` area** (no new system): a second link in the
   already-signed-off, flag-gated **Reports** sidebar section, reachable for Parts/management/admin
   roles, with the API enforcing per-KPI permission, department scope and audit server-side.

**Net result:** Parts department-level reporting is **operational and trustworthy today** (live-correct,
exact, provenance-labelled): requests, ordering, receiving, fitting, the open pipeline, stock value,
stock turnover, revenue, margin, profitability and VHC→parts conversion. The cycle-time/dwell,
approval/cancellation/unavailable, lead-time, pick-rate, backorder, fill-rate and supplier-performance
tiers remain blocked on the documented R2/R3 prerequisites (parts status-history accrual, the suppliers
master).

---

## 1. What Was Built

### 1.1 KPI definitions (catalogue promotion — `src/lib/reporting/kpiDefinitions/parts.js`)

| Change | Detail |
|---|---|
| Expanded 2 → 20 Parts KPIs | 11 R1 resolvers (incl. the 2 seed KPIs, retained) + 9 declared R2/R3. |
| Every definition states the **verbatim catalogue formula** (KPI Catalogue §6) | sources, tier, readiness, unit, target type and (where applicable) a `drilldown`. Resolvers route through `queryBuilder` only. |

### 1.2 Shared reporting infrastructure (one additive extension — reused by all packages)

| File | Change |
|---|---|
| `src/lib/reporting/queryBuilder.js` | Added **`sumProduct(table, colA, colB, build)`** — a paginated, non-truncated sum of the *product* of two columns (e.g. `Σ unit_price × quantity_fitted`, `Σ qty_in_stock × unit_cost`). Workshop never needed it (labour sales is a scalar × a config rate); every Parts value/margin/stock KPI does. It lives in the shared builder, so any future package reuses it. It preserves the "no `.limit()` total" guarantee (same pagination as `sumColumn`). |

No other shared component, hook, API or the engine was modified. The Workshop package, its KPIs and its
UI are untouched.

### 1.3 Shared reporting UI — reused unchanged (no duplication)

The Parts package consumes the Phase-6 components verbatim: `ReportFilterBar`, `KpiValueCard` /
`KpiScorecardStrip`, `KpiTrendChart`, `KpiPanel`, `ReportDrilldownTable`, `SavedViewsBar`,
`ProvenanceFooter`, `ReportSection`, and all of `useReporting.js`
(`useReportFilter`/`useKpiValues`/`useKpiTrend`/`useDrilldown`/`useSavedViews`/`buildExportUrl`).
**No Supabase, no KPI maths, no duplicated reporting logic in the Parts client.**

### 1.4 Parts pages (`src/pages/reports/parts.js` + `src/components/reporting/parts/`)

| Section (tab) | Contents | KPIs |
|---|---|---|
| **Overview** | Department scorecard + daily/weekly/monthly performance summary | requests, ordered, received, fitted, open pipeline, revenue, stock value, VHC→parts |
| **Parts Operations** | Requests, ordering, receiving, fitting (panels + trend + drill), pipeline monitoring (open-by-status drill), operations readiness indicators | requests, ordered, received, fitted, open_by_status; declared approved/cancelled/unavailable/pick_rate |
| **Stock & Inventory** | Stock value, stock movement (turnover), inventory status & availability (open-by-status), readiness indicators | stock_value (drill), stock_turn; declared ageing/backorder_rate |
| **Supplier & Ordering** | Ordering performance, delivery monitoring (supported by existing data), supplier-performance readiness | ordered, received; declared lead_time/fill_rate/supplier_performance |
| **Reporting Utilities** | Saved views, exports, filters, drill-down explorer | every drillable Parts KPI |

`partsReportConfig.js` holds the **layout grouping only** (which KPI ids appear where); the engine
remains the single source of every value and formula.

### 1.5 Navigation, access & permissions (reused wiring)

| File | Change |
|---|---|
| `src/config/navigation.js` | Added a **Parts Reports** link (`/reports/parts`) to the existing flag-gated Reports section, beside Workshop. Visible roles are *derived from the canonical `ROLE_DEPARTMENT_MAP`* (parts + management/admin), never hardcoded. Workshop link unchanged. |
| `src/config/routeAccess.js` | **No change** — `/reports` is already a `PROTECTED_PREFIXES` entry (Phase 6); `/reports/parts` inherits it. |
| `src/pages/reports/parts.js` | Wraps in `ProtectedRoute` with the same parts/management/admin role-derived set. |

The `reporting_nav_enabled` flag was already ON (Phase 6) — Phase 7 added no flag changes. **All data
permissions remain server-side**: `withReportingAuth` → `permissionScope` (department/scope) + per-KPI
permission gate. Parts financial KPIs (margin, profitability, stock turnover, supplier performance) are
gated to `["MANAGER_SCOPED_ROLES", "parts manager"]` — note the explicit `parts manager` because the
shared `MANAGER_SCOPED_ROLES` constant does **not** include it, so the Parts Manager would otherwise be
locked out of their own department's commercial figures.

### 1.6 Audit

Report **view** and **export** are audited by the existing framework with **zero new code**:
`auditReportAccess` (gated by `reporting_access_audit_enabled`, **ON**) writes a hash-chained
`audit_log` row (`report.view` / `report.export`) and mirrors a `REPORT_VIEWED` / `REPORT_EXPORTED`
event on every `/api/reports/{kpi,drilldown,export}` call the Parts UI makes.

---

## 2. Parts KPIs Implemented (operational now)

"Operational" = has a resolver, computes trust-correctly today (live), and is wired into the UI with
permissions, drill-down (where defined) and provenance.

| KPI | Tier | Formula (from KPI Catalogue §6) | Notes |
|---|---|---|---|
| `prt.requests` | operational | COUNT(parts_job_items created in period) | Exact count. Drill-down. |
| `prt.open_by_status` | operational | COUNT(parts_job_items) grouped by status (excl. terminal) | Point-in-time; full status-normalised distribution (fixes the D8 `.limit()` example). Drill-down. |
| `prt.ordered` | operational | COUNT(status→on_order) / Σ on-order value | Counts `parts_delivery_items` created in period; on-order value = Σ qty_ordered × unit_cost. Drill-down. |
| `prt.received` | operational | COUNT/Σqty received | `parts_stock_movements` (movement_type='delivery') as the dated receipt event. Drill-down. |
| `prt.fitted` | tactical | COUNT(status→fitted) / Σ quantity_fitted | Status='fitted' dated by `updated_at` (proxy, flagged). Drill-down. |
| `prt.vhc_conversion` | tactical | COUNT(part lines from authorised VHC) ÷ COUNT(authorised VHC items) × 100 | Lines÷items per catalogue (can exceed 100%); uses `parts_job_items.authorised` + `vhc_item_id`. |
| `prt.stock_value` | strategic | Σ qty_in_stock × unit_cost (point-in-time) | `parts_catalog`; `sumProduct`. Drill-down (by line, below-reorder). |
| `prt.stock_turn` | strategic | COGS over period ÷ average stock value | COGS = Σ unit_cost × qty_fitted; avg-stock proxied by current stock value (flagged). Manager-gated. |
| `prt.revenue` | tactical | Σ unit_price × qty_fitted (+ counter sales) | Fitted job-line revenue; counter sales not yet linked (flagged). |
| `prt.margin` | strategic | (Σ unit_price − Σ unit_cost) ÷ Σ unit_price × 100 on fitted lines | Ratio inputs stored separately. Manager-gated. |
| `prt.profitability` | strategic | parts_revenue − parts_cost | Same fitted-value source as revenue/margin. Manager-gated. |

**11 Parts KPIs operational.** Every brief concept maps onto a catalogue KPI (no invented metric):

| Brief concept | Catalogue KPI(s) |
|---|---|
| Parts requests | `prt.requests` |
| Parts ordered | `prt.ordered` |
| Parts received | `prt.received` |
| Parts fitted | `prt.fitted` |
| Open parts by status / Parts backlog / Parts pipeline | `prt.open_by_status` (live) + `prt.ageing` (declared dwell) |
| Parts value / Parts revenue | `prt.revenue`, on-order value in `prt.ordered` |
| Parts margin | `prt.margin` |
| Stock value | `prt.stock_value` |
| Stock movement | `prt.stock_turn` (consumes `parts_stock_movements`) |
| Parts cancelled / Parts unavailable / Parts approved | declared `prt.cancelled` / `prt.unavailable` / `prt.approved` (R2) |

---

## 3. Parts KPIs Still Blocked (declared, no resolver yet)

Registered in the catalogue (so they appear in the UI / `/api/reports/catalog` with their exact
blocker) but intentionally **no resolver** — the engine reports them as "declared, readiness Rn". They
light up in a later phase once the prerequisite lands.

| KPI | Tier | Readiness | Blocker |
|---|---|---|---|
| `prt.approved` | operational | R2 | Approval transition + latency need `parts_job_items_status_history`. |
| `prt.cancelled` | tactical | R2 | →cancelled/→removed transition (with reason) needs parts status-history. |
| `prt.unavailable` | tactical | R2 | →unavailable transition needs parts status-history. |
| `prt.lead_time` | tactical | R2 | No per-line `ordered_at`; needs status-history transitions (supplier-level needs R3). |
| `prt.ageing` | tactical | R2 | `status_entered_at` dwell needs parts status-history. |
| `prt.pick_rate` | tactical | R2 | →picked transition (by zone) needs parts status-history. |
| `prt.backorder_rate` | tactical | R2 | `parts_delivery_items.status='backorder'` exists, but a trustworthy rate needs the PART_ORDERED event spine to anchor the denominator. |
| `prt.fill_rate` | tactical | R3 | Aggregate is R2; per-supplier needs the `suppliers` master. |
| `prt.supplier_performance` | strategic | R3 | Free-text supplier; needs a `suppliers` master with FKs (biggest Parts R3 unlock). |

---

## 4. Remaining R2 / R3 Blockers

### 4.1 R2 — need applied SQL + accrued history + event anchoring
- **Parts status-history accrual** (apply `003_status_history.sql`, flip `reporting_emit_enabled`,
  schedule crons) → unblocks `prt.approved`, `prt.cancelled`, `prt.unavailable`, `prt.lead_time`,
  `prt.ageing`, `prt.pick_rate`, and makes `prt.fitted`/`prt.ordered` precise (real transition
  timestamps replace the `updated_at`/`created_at` proxies — no UI change). `parts` is **P4 priority 1**
  in the status-history rollout (entities.js), so it is the first to land.
- **Order/receive event anchoring** (`PART_ORDERED`) → makes `prt.backorder_rate` trustworthy and
  enables the aggregate (all-supplier) fill rate.
- **No snapshots yet** (aggregation cron unscheduled) → point values and trends are served by labelled
  **live fallback**, not snapshots. Correct, but recomputed per request. `prt.stock_turn`'s
  average-stock denominator switches from the current point-in-time proxy to a true period average once
  daily stock snapshots accrue — no formula change.

### 4.2 R3 — need missing domain entities / new modelling
- **`suppliers` master entity** (+ `supplier_id` FKs on `parts_deliveries` / `parts_catalog` /
  `parts_delivery_items`) → `prt.supplier_performance`, per-supplier `prt.fill_rate`, and supplier-level
  `prt.lead_time`. Supplier is free-text today, so no supplier-level breakdown is fabricated.

---

## 5. Data-Quality Observations

- **Trust-by-construction holds.** No `.limit()` total, no overlapping `ILIKE`, no fuzzy inference
  anywhere in the package. Counts are `head:true,count:'exact'`; value sums use the paginated
  `sumProduct`/`sumColumn`; the open-by-status distribution is full and status-normalised (the canonical
  cure for the audit's `.limit()`-truncated "open parts" example).
- **Fitting/sale timing is a documented proxy (D-class debt).** `prt.fitted`, `prt.revenue`,
  `prt.margin`, `prt.profitability` and `prt.stock_turn`'s COGS scope fitted lines by `updated_at`
  because `parts_job_items` has no `fitted_at`. This is the exact analogue of the Workshop package's
  documented "released uses `completed_at`" proxy and is flagged in every dependent KPI's `futureNotes`;
  it becomes a true PART_FITTED timestamp once parts status-history accrues. Flagged, not silent.
- **`prt.ordered` / `prt.received` use the delivery + movement ledgers.** An order line
  (`parts_delivery_items` created) is the "ordered" event; a `delivery` stock movement is the "received"
  event. These are dated, real events — not point-in-time status snapshots.
- **`prt.stock_turn` average stock is approximated by current stock value** until daily stock snapshots
  exist. The formula (COGS ÷ average stock value) is unchanged; only the denominator's source upgrades.
- **`prt.vhc_conversion` denominator is all authorised VHC items**, not "authorised VHC items *needing
  parts*" — there is no clean needs-parts signal on the VHC item today. Flagged; the numerator uses the
  real `parts_job_items.authorised` + `vhc_item_id` link.
- **Department attribution rides on role (D3).** As Phases 5–6 — the free-text `users.department` column
  is not yet constrained to `dim_department`; Parts attribution is resolved from role.
- **Dual user identity (D4) does not block any implemented Parts KPI.** None of the 11 R1 resolvers
  attribute to an actor; `parts_job_items.allocated_by` (a uuid → `auth.users`) and
  `parts_stock_movements.performed_by` are not used as reporting keys yet (see §9).

---

## 6. Reporting Performance Observations

- **One round-trip per scorecard.** The scorecard strip requests all its KPIs in a single
  `/api/reports/kpi?ids=…` call; the engine resolves them concurrently. Trend and drill-down are lazy
  (only the open panel/section fetches).
- **Live-fallback cost.** With no snapshots applied yet, every value is a **live recompute** against
  operational tables (labelled `live` in provenance). Counts are exact (cheap); value sums and the
  product-sums (`sumProduct`) paginate `parts_job_items` / `parts_delivery_items` / `parts_catalog`.
  Once `004_kpi_snapshots.sql` is applied and the daily cron runs, point values and trends switch to the
  snapshot fast-path automatically — **no UI change**.
- **`sumProduct` paginates in 1,000-row pages** with the same `MAX_SUM_ROWS` guard as `sumColumn`, so a
  large fitted-line or catalogue table is summed in full, never truncated, and warns rather than
  silently capping.
- **Trend rendering is scoped to flow/currency KPIs and percentage ratios** (where the engine's
  `combineRows` recombination is correct). Plain ratios (`prt.stock_turn`, `prt.vhc_conversion`) and the
  point-in-time `prt.open_by_status` are shown as card values / distributions, not mis-scaled lines — a
  UI choice, not a data change. The Overview trends `prt.fitted` and `prt.revenue` across daily/weekly/
  monthly.

---

## 7. Operational vs Future — exact status at completion

**Operational now (live, trustworthy, in the Parts UI):**
`prt.requests`, `prt.open_by_status`, `prt.ordered`, `prt.received`, `prt.fitted`, `prt.vhc_conversion`,
`prt.stock_value`, `prt.stock_turn` *(avg-stock proxy)*, `prt.revenue` *(fitted-line)*, `prt.margin`,
`prt.profitability`.

**Dependent on future reporting phases (declared, not yet computing):**

| Requirement | Parts KPIs waiting on it |
|---|---|
| **Status-history accrual** (parts is P4 priority 1) | `prt.approved`, `prt.cancelled`, `prt.unavailable`, `prt.lead_time`, `prt.ageing`, `prt.pick_rate` (R2) — and precision upgrades for `prt.fitted`/`prt.ordered`. |
| **Event-spine anchoring** (`PART_ORDERED`) | `prt.backorder_rate` (R2); aggregate `prt.fill_rate` (R2). |
| **Supplier modelling** (`suppliers` master) | `prt.supplier_performance` (R3), per-supplier `prt.fill_rate` (R3), supplier-level `prt.lead_time` (R3). |
| **Actor-attribution remediation** (D4 int↔uuid bridge) | none of the implemented KPIs are blocked; required before per-operator Parts metrics (e.g. picker/allocator productivity, `parts_job_items.allocated_by`, `parts_stock_movements.performed_by`) can be trusted — a future expansion, not a current blocker. |

---

## 8. Recommended Next Phase

**Phase 8 — Capture go-live for Parts, then the next package.** In order:

1. **Apply the SQL** (`000_all_reporting.sql`), run `seedDepartments()`, flip `reporting_emit_enabled`
   ON, and **schedule the aggregation crons** — this starts `parts_job_items_status_history` accruing
   (P4 priority 1) and turns on snapshots (fast-path + trends), unblocking the R2 Parts tiers
   (approval/cancellation/unavailable/lead-time/ageing/pick-rate) with no UI change.
2. **Model the `suppliers` master** (+ `supplier_id` FKs) to unblock `prt.supplier_performance`,
   per-supplier `prt.fill_rate` and supplier-level `prt.lead_time` (R3 — the biggest Parts unlock).
3. **Backfill `dim_actor`** (int↔uuid) so per-operator Parts attribution (picker/allocator/goods-in
   productivity) becomes trustworthy; constrain `users.department` (D3).
4. **Build the next department package** on the now twice-proven shared components — **Service Advisors**
   or **Accounts** are the natural follow-ons, reusing `src/components/reporting/*`,
   `src/hooks/reporting/*` and the engine unchanged.

After the SQL/crons land, the declared Parts R2 metrics become computable by adding resolvers to the
existing catalogue entries — **no UI or architectural change required**, exactly as the foundation
intended.

---

## 9. How to Re-run the Validation

```bash
npm run validate:reporting     # 36 runtime contract checks (green; R1-must-have-resolver now covers Parts)
npm run check:report-events    # emit-name validity + emit-coverage advisories
npm run check:borders          # layer/border law (pre-existing staffglobal.css debt aside)
```

The Parts package added **no** new failing checks: `validate:reporting` is 36/36 (every Parts R1 KPI has
a resolver; every `sourceEvent` is a real catalogue event; every declared `sourceHistory` is a real
entity history table), `check:report-events` still passes with the single pre-existing `jobClocking.js`
advisory, and the new UI introduces **no** border-law violations (surfaces use `LayerSurface`/
`LayerTheme`; the only borders are ghost-button rings via `--ghostbutton-ring`).

---

*End of Phase 7. The Parts report package is live on the shared reporting platform — the second fully
integrated package after Workshop. No Accounts, Management, MOT, Valeting or Paint reports were built;
Workshop reporting was unchanged except the shared `queryBuilder.sumProduct` extension and a second
Reports nav link. 11 Parts KPIs are operational; 9 remain declared and dependent on the documented
R2/R3 prerequisites.*
