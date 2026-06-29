# Reporting Drill-Down Audit & Handover

**Date:** 2026-06-29
**Author:** Claude Code (audit pass)
**Purpose:** A complete audit of which reporting KPIs have a working drill-down (the "contributing records" table) and which do not, plus copy-ready proposals for the ones that can be wired now. This file is written so it can be handed to ChatGPT, which should turn it into a precise implementation prompt for Claude Code to execute.

---

## 1. Background — what this is and why it matters

HNPSystem has a reporting platform under `src/lib/reporting/` (engine) and `src/components/reporting/` (UI). Every department report (Workshop, MOT, Parts, Accounts, Service, Valeting, Paint, Admin, Management) is a thin consumer of the engine: **no KPI is calculated in a page or component** — screens reference KPIs by id and render whatever `/api/reports/*` returns.

### How a KPI is defined
Each KPI is declared once via `defineKpi({...})` in `src/lib/reporting/kpiDefinitions/<department>.js`. The two functions that matter here:

- **`resolver(ctx)`** — computes the *summary value* (the number on the card). A KPI with a resolver is "implemented"; without one it is "declared but not yet implemented".
- **`drilldown(ctx)`** — returns the *contributing rows* behind that number (the table you see when you open a KPI). Optional.

`ctx = { filter, scope }`. `filter.dateRange` carries `{ from, to }`.

### How drill-down runs
`src/lib/reporting/drilldown.js` → `resolveDrilldown(kpiId, ctx)`:
- if the KPI has no `drilldown` function it returns
  `warnings: ['KPI "<id>" has no drill-down defined yet']` and **zero rows**.
- if it has one, it runs it and returns the rows; the UI infers columns from the row keys (any shape works — no bespoke wiring).

### Why this audit exists now
The KPI cards were just made **fully clickable** (`src/components/reporting/KpiScorecardStrip.js` now passes `onDrilldown` to *every* card, and `KpiValueCard` opens the drill-down table on click). Result: a card whose KPI has a resolver (so it shows a real number and is therefore clickable) **but no drilldown** now opens an **empty table** with the message *"KPI … has no drill-down defined yet"*. This audit finds every such KPI so they can be given real contributing-record tables.

> Note: KPIs that are *declared only* (no resolver → value is `null`) are **not** clickable (`KpiValueCard` only activates when `value != null`), so they will not hit this empty-table path. They are listed below as **Blocked** for completeness but are **out of scope** for the immediate work.

### The query toolkit (use these — never raw Supabase in a KPI)
From `src/lib/reporting/queryBuilder.js`:
- `applyDateRange(q, dateColumn, filter)` — applies `filter.dateRange` to a column.
- `countRows(table, build)` — exact count.
- `sumColumn(table, col, build)` / `sumColumnFromSelect(...)` / `sumProduct(table, a, b, build)` — paginated, non-truncated sums.
- `groupCount(table, col, build)` — distribution `{ value -> count }`.
- `fetchRows(table, "colA,colB", build, { orderBy, ascending, limit })` — **the row fetcher for drill-downs** (bounded page, default limit 200).
- `fetchAllRows(...)` — full scan when app-side derivation is needed (JSONB etc).

**Golden rule for drilldowns:** a drilldown must return *the rows that sum/count to the value*. So it must mirror the resolver's table, date column, and filters exactly. If it doesn't mirror them, the table won't match the number on the card.

---

## 2. Classification

| Status | Meaning | Action |
|---|---|---|
| ✅ **Done** | resolver + drilldown both present | none |
| ⚠️ **Actionable** | resolver present, **drilldown missing** | **add a drilldown** (this is the work) |
| ⛔ **Blocked** | no resolver (declared R2/R3) | cannot drilldown until the metric itself is implemented (needs `*_status_history`, event spine, or a new entity). Out of scope. |

**Totals:** ~95 KPIs across 10 files. **19 are Actionable** (resolver, no drilldown). The rest are either Done or Blocked.

### Actionable summary (the 19)
| KPI | Dept | Difficulty | Why |
|---|---|---|---|
| `wsh.throughput` | Workshop | Easy | single table `jobs` |
| `wsh.clocked_hours` | Workshop | Easy | single table `time_records` |
| `wsh.labour_sales` | Workshop | Medium | mirrors sold-hours inputs (2 tables) |
| `wsh.tech_efficiency` | Workshop | Easy | single table `tech_efficiency_entries` |
| `wsh.jobs_per_tech` | Workshop | Easy | numerator rows from `jobs` |
| `wsh.sold_hours` | Workshop | Medium | two source tables (job_requests + vhc_checks) |
| `vhc.upsell_revenue` | VHC | Easy | single table `vhc_checks` |
| `vhc.authorisation_rate` | VHC | Easy (ratio) | single table, dual columns |
| `vhc.completion_rate` | VHC | Medium (ratio) | numerator vs denominator use different date cols |
| `prt.vhc_conversion` | Parts | Easy | single table `parts_job_items` |
| `prt.revenue` | Parts | Easy | fitted lines `parts_job_items` |
| `prt.margin` | Parts | Easy | fitted lines `parts_job_items` |
| `prt.profitability` | Parts | Easy | fitted lines `parts_job_items` |
| `prt.stock_turn` | Parts | Hard | composite ratio — delegate to `prt.fitted` |
| `mgt.upsell_contribution` | Management | Medium | composition — delegate drilldown |
| `mgt.site_recovery` | Management | Medium | composition — delegate drilldown |
| `mgt.department_performance` | Management | Hard | 14 underlying KPIs — needs UI routing |
| `mgt.growth` | Management | Hard | current vs prior-year windows |
| `mgt.forecast_inputs` | Management | Hard | multi-series — needs picker |

---

## 3. Full audit by department

Legend: **R**=resolver, **D**=drilldown. ✅ present · ❌ missing.

### Workshop — `src/lib/reporting/kpiDefinitions/workshop.js`
| KPI | R | D | Status | Notes |
|---|---|---|---|---|
| wsh.jobs_completed | ✅ | ✅ | Done | |
| wsh.jobs_created | ✅ | ✅ | Done | |
| wsh.jobs_per_day | ✅ | ✅ | Done | |
| **wsh.throughput** | ✅ | ❌ | **Actionable** | resolver counts created (`created_at`) and released (`completed_at not null`) on `jobs` |
| **wsh.sold_hours** | ✅ | ❌ | **Actionable** | Σ `job_requests.hours` (created_at) + Σ authorised `vhc_checks.labour_hours` (created_at) |
| **wsh.clocked_hours** | ✅ | ❌ | **Actionable** | Σ `time_records.hours_worked` (`date`) |
| **wsh.labour_sales** | ✅ | ❌ | **Actionable** | sold-hours × rate; show the sold-hours contributing lines |
| **wsh.tech_efficiency** | ✅ | ❌ | **Actionable** | Σ allocated ÷ Σ spent on `tech_efficiency_entries` (`date`) |
| wsh.tech_ranking | ✅ | ✅ | Done | |
| **wsh.jobs_per_tech** | ✅ | ❌ | **Actionable** | numerator = completed `jobs` (`completed_at`) |
| wsh.mobile_activity | ✅ | ✅ | Done | |
| wsh.cycle_time | ❌ | ❌ | Blocked | R2 — needs event spine + status-history |
| wsh.stage_dwell | ❌ | ❌ | Blocked | R2 — needs `job_status_history` accrual |
| wsh.labour_recovery | ❌ | ❌ | Blocked | R2 — clocking reconciliation (D5) |
| wsh.tech_productivity | ❌ | ❌ | Blocked | R2 — clocking reconciliation (D5) |
| wsh.utilisation | ❌ | ❌ | Blocked | R3 — no capacity model |
| wsh.profitability | ❌ | ❌ | Blocked | R2 — needs loaded labour cost |
| wsh.additional_work_recovery | ❌ | ❌ | Blocked | R2 — VHC→work linkage via event spine |
| wsh.rework_rate | ❌ | ❌ | Blocked | R3 — no rework flag |

### VHC — `src/lib/reporting/kpiDefinitions/vhc.js`
| KPI | R | D | Status | Notes |
|---|---|---|---|---|
| **vhc.completion_rate** | ✅ | ❌ | **Actionable** | num = `jobs` `vhc_completed_at not null` (`vhc_completed_at`); den = `jobs` `vhc_required=true` (`created_at`) — different date cols (ratio caveat) |
| vhc.red_items | ✅ | ✅ | Done | |
| **vhc.upsell_revenue** | ✅ | ❌ | **Actionable** | Σ `vhc_checks.authorized_total_gbp` (`created_at`) |
| **vhc.authorisation_rate** | ✅ | ❌ | **Actionable** | `vhc_checks` authorized vs declined totals (`created_at`) |

### Parts — `src/lib/reporting/kpiDefinitions/parts.js`
| KPI | R | D | Status | Notes |
|---|---|---|---|---|
| prt.requests | ✅ | ✅ | Done | |
| prt.open_by_status | ✅ | ✅ | Done | |
| prt.ordered | ✅ | ✅ | Done | |
| prt.received | ✅ | ✅ | Done | |
| prt.fitted | ✅ | ✅ | Done | |
| **prt.vhc_conversion** | ✅ | ❌ | **Actionable** | `parts_job_items` `vhc_item_id not null` + `authorised=true` (`created_at`) |
| prt.stock_value | ✅ | ✅ | Done | |
| **prt.stock_turn** | ✅ | ❌ | **Actionable (hard)** | composite ratio (COGS ÷ avg stock) — delegate to `prt.fitted` rows |
| **prt.revenue** | ✅ | ❌ | **Actionable** | fitted lines `parts_job_items` `status='fitted'` (`updated_at`) |
| **prt.margin** | ✅ | ❌ | **Actionable** | fitted lines incl. `unit_cost` |
| **prt.profitability** | ✅ | ❌ | **Actionable** | fitted lines incl. `unit_price` + `unit_cost` |
| prt.approved | ❌ | ❌ | Blocked | R2 — needs `parts_job_items_status_history` |
| prt.cancelled | ❌ | ❌ | Blocked | R2 — needs status-history (reason codes) |
| prt.unavailable | ❌ | ❌ | Blocked | R2 — needs status-history |
| prt.lead_time | ❌ | ❌ | Blocked | R2 — no per-line ordered_at; R3 supplier master |
| prt.ageing | ❌ | ❌ | Blocked | R2 — needs status_entered_at |
| prt.pick_rate | ❌ | ❌ | Blocked | R2 — needs →picked transition |
| prt.backorder_rate | ❌ | ❌ | Blocked | R2 — needs PART_ORDERED event anchor |
| prt.supplier_performance | ❌ | ❌ | Blocked | R3 — needs `suppliers` master |
| prt.fill_rate | ❌ | ❌ | Blocked | R3 — per-supplier needs suppliers master |

### Accounts — `src/lib/reporting/kpiDefinitions/accounts.js`
All R1 KPIs already have drilldowns. ✅✅ for: `acc.revenue`, `acc.labour_revenue`, `acc.parts_revenue`, `acc.outstanding_invoices`, `acc.ar`, `acc.payments_received`, `acc.account_balances`, `acc.credit_exposure`.
Blocked (no resolver): `acc.dso` (R2), `acc.invoice_ageing` (R2), `acc.payment_conversion` (R2), `acc.profitability` (R2), `acc.gross_profit` (R3), `acc.net_profit` (R3). **No actionable items.**

### Service — `src/lib/reporting/kpiDefinitions/service.js`
✅✅: `svc.booking_volume`, `svc.waiting_mix`, `svc.vhc_send_rate`.
Blocked (no resolver): `svc.appointment_conversion`, `svc.contact_rate`, `svc.response_time`, `svc.vhc_view_rate`, `svc.vhc_conversion`, `svc.authorised_value`, `svc.declined_value`, `svc.followup_completion`, `svc.csat`. **No actionable items.**

### MOT — `src/lib/reporting/kpiDefinitions/mot.js`
✅✅: `mot.volume`, `mot.pass_rate`, `mot.revenue`, `mot.throughput`, `mot.due_pipeline`, `mot.tester_productivity`.
Blocked (no resolver): `mot.first_time_pass` (R3), `mot.retest_rate` (R3), `mot.repair_conversion` (R2), `mot.advisory_conversion` (R3). **No actionable items.**

### Valeting — `src/lib/reporting/kpiDefinitions/valeting.js`
✅✅: `val.cars_washed`, `val.completion_rate`, `val.skip_rate`.
Blocked (no resolver): `val.avg_wash_time` (R3), `val.sla` (R3), `val.queue_time` (R2), `val.valeter_productivity` (R3). **No actionable items.**

### Paint — `src/lib/reporting/kpiDefinitions/paint.js`
✅✅: `pnt.jobs_completed`, `pnt.queue`, `pnt.cycle_time`.
Blocked (no resolver): `pnt.stage_duration` (R3), `pnt.bay_utilisation` (R3), `pnt.painter_productivity` (R3), `pnt.rework_rate` (R3), `pnt.material_usage` (R3). **No actionable items.**

### Admin — `src/lib/reporting/kpiDefinitions/admin.js`
✅✅: `adm.login_success_rate`, `adm.login_failures`, `adm.audit_activity`, `adm.compliance`, `adm.report_usage`, `adm.user_activity`, `adm.data_quality`, `adm.reporting_health`.
Blocked (no resolver): `adm.role_changes` (R2 — role changes unlogged). **No actionable items.**

### Management — `src/lib/reporting/kpiDefinitions/management.js`
Management KPIs are **compositions** of other KPIs (via `runKpi` / `runDrilldown`), not direct table queries. Their drilldowns should **delegate** to an underlying KPI's drilldown (`company_revenue` already does this: `runDrilldown("acc.revenue", ctx)`).
| KPI | R | D | Status | Delegate to |
|---|---|---|---|---|
| mgt.company_revenue | ✅ | ✅ | Done | acc.revenue |
| **mgt.upsell_contribution** | ✅ | ❌ | **Actionable** | `vhc.upsell_revenue` |
| **mgt.site_recovery** | ✅ | ❌ | **Actionable** | `wsh.sold_hours` (after that drilldown lands) |
| **mgt.department_performance** | ✅ | ❌ | **Actionable (hard)** | per-department primary KPI — needs UI routing |
| **mgt.growth** | ✅ | ❌ | **Actionable (hard)** | `acc.revenue` current + prior-year window |
| **mgt.forecast_inputs** | ✅ | ❌ | **Actionable (hard)** | series picker → underlying KPI |
| mgt.bottleneck | ❌ | ❌ | Blocked | R2 — needs status-history + backlog snapshots |
| mgt.sla_attainment | ❌ | ❌ | Blocked | R2 — needs stage-duration + SLA model |
| mgt.company_profitability | ❌ | ❌ | Blocked | R3 — needs COGS |
| mgt.capacity_utilisation | ❌ | ❌ | Blocked | R3 — needs capacity model |
| mgt.cost_to_serve | ❌ | ❌ | Blocked | R3 — needs opex model |
| mgt.customer_satisfaction | ❌ | ❌ | Blocked | R3 — needs survey integration |

---

## 4. Proposed drilldowns (copy-ready)

> Verify every column against `src/lib/database/schema/schemaReference.sql` before committing. Columns below are taken from the existing resolvers (so they are referenced already), but the *display* selects add a few human-friendly columns that must be confirmed to exist.

### Workshop
```js
// wsh.throughput — show the "created" side (the headline numerator)
drilldown: async ({ filter }) =>
  fetchRows("jobs", "id,job_number,status,created_at,completed_at,assigned_to",
    (q) => applyDateRange(q, "created_at", filter), { orderBy: "created_at" }),

// wsh.clocked_hours
drilldown: async ({ filter }) =>
  fetchRows("time_records", "id,user_id,date,hours_worked",
    (q) => applyDateRange(q, "date", filter), { orderBy: "date" }),

// wsh.tech_efficiency
drilldown: async ({ filter }) =>
  fetchRows("tech_efficiency_entries", "user_id,allocated_hours,hours_spent,date",
    (q) => applyDateRange(q, "date", filter), { orderBy: "date" }),

// wsh.jobs_per_tech — numerator (completed jobs)
drilldown: async ({ filter }) =>
  fetchRows("jobs", "id,job_number,status,completed_at,assigned_to",
    (q) => applyDateRange(q.not("completed_at", "is", null), "completed_at", filter),
    { orderBy: "completed_at" }),

// wsh.sold_hours — request hours (primary contributor). NEEDS CARE: the value
// also includes authorised VHC labour_hours; either show only requests (and note
// it) or return a merged shape. Recommended first pass: request lines.
drilldown: async ({ filter }) =>
  fetchRows("job_requests", "id,job_id,hours,created_at",
    (q) => applyDateRange(q, "created_at", filter), { orderBy: "created_at" }),

// wsh.labour_sales — same contributing lines as sold_hours (value = hours × rate)
drilldown: async ({ filter }) =>
  fetchRows("job_requests", "id,job_id,hours,created_at",
    (q) => applyDateRange(q, "created_at", filter), { orderBy: "created_at" }),
```

### VHC
```js
// vhc.upsell_revenue
drilldown: async ({ filter }) =>
  fetchRows("vhc_checks", "vhc_id,job_id,section,authorized_total_gbp,created_at",
    (q) => applyDateRange(q, "created_at", filter), { orderBy: "created_at" }),

// vhc.authorisation_rate — both sides on one row set (ratio caveat)
drilldown: async ({ filter }) =>
  fetchRows("vhc_checks", "vhc_id,job_id,section,authorized_total_gbp,declined_total_gbp,created_at",
    (q) => applyDateRange(q, "created_at", filter), { orderBy: "created_at" }),

// vhc.completion_rate — numerator (completed). NEEDS CARE: denominator uses a
// different date column (created_at on vhc_required jobs); a single table can't
// show both cleanly. Recommended first pass: completed jobs.
drilldown: async ({ filter }) =>
  fetchRows("jobs", "id,job_number,vhc_required,vhc_completed_at",
    (q) => applyDateRange(q.not("vhc_completed_at", "is", null), "vhc_completed_at", filter),
    { orderBy: "vhc_completed_at" }),
```

### Parts
```js
// prt.vhc_conversion
drilldown: async ({ filter }) =>
  fetchRows("parts_job_items", "id,job_id,part_id,vhc_item_id,status,quantity_requested,authorised,created_at",
    (q) => applyDateRange(q.not("vhc_item_id", "is", null).eq("authorised", true), "created_at", filter),
    { orderBy: "created_at" }),

// prt.revenue / prt.margin / prt.profitability — all driven by fitted lines.
// Use the widest select so one drilldown serves all three (or define per-KPI).
drilldown: async ({ filter }) =>
  fetchRows("parts_job_items", "id,job_id,part_id,status,quantity_fitted,unit_price,unit_cost,updated_at",
    (q) => applyDateRange(q.eq("status", "fitted"), "updated_at", filter),
    { orderBy: "updated_at" }),

// prt.stock_turn — HARD. Composite (COGS ÷ avg stock). No single row set sums to
// the ratio. Recommended: delegate to prt.fitted's contributing lines, OR omit a
// drilldown and instead leave it as the one acceptable "no drilldown" case with a
// note. Decide with product owner.
```

### Management (delegation pattern — mirrors `mgt.company_revenue`)
```js
// mgt.upsell_contribution
drilldown: async (ctx) => runDrilldown("vhc.upsell_revenue", ctx),

// mgt.site_recovery (after wsh.sold_hours drilldown is added)
drilldown: async (ctx) => runDrilldown("wsh.sold_hours", ctx),

// mgt.growth — current window only on first pass (prior-year needs UI toggle)
drilldown: async (ctx) => runDrilldown("acc.revenue", ctx),

// mgt.department_performance and mgt.forecast_inputs are composites over many
// KPIs — they need a UI selector to choose which underlying series to drill into.
// Defer these two until the UI supports a sub-selector; do NOT fake a single table.
```

---

## 5. Implementation rules (must follow)

1. **Mirror the resolver.** Same table(s), same date column passed to `applyDateRange`, same filters (`.eq/.not/.in`). The rows must be the ones that produce the number.
2. **Use `fetchRows`** (or `fetchAllRows` only when app-side derivation is unavoidable). Never call Supabase directly inside a KPI definition.
3. **Verify columns** against `src/lib/database/schema/schemaReference.sql`. Do not invent column names. If a display column doesn't exist, drop it — the UI infers columns from whatever the rows contain.
4. **Order by the date column** used (descending by default reads best, but match existing Done drilldowns which use `{ orderBy: "<dateCol>" }`).
5. **Ratio KPIs** (numerator/denominator with different filters or date columns): a single drilldown can only show one side. Default to the **numerator** ("contributing records") and add a one-line code comment noting the denominator is computed separately. Do not try to merge incompatible row sets.
6. **Management compositions**: delegate via `runDrilldown("<underlying.id>", ctx)`. Do **not** query tables directly in a composition KPI.
7. **Blocked KPIs**: do nothing. They have no resolver, no value, and are not clickable. Adding a drilldown to a KPI with no value is pointless and would mislead.
8. **No UI changes required** for the easy/medium items — `ReportDrilldownTable` already renders any row shape. Only `mgt.department_performance`, `mgt.growth` (prior-year), and `mgt.forecast_inputs` need a UI sub-selector; treat those as a separate, later task.
9. **Test approach**: after adding each drilldown, open the KPI card on its report page, confirm the table shows rows and that the row count is sensible vs the headline number (counts should match; sums should reconcile when you total the relevant column).

---

## 6. Suggested batching for the implementation prompt

- **Batch A (easy, single-table, no caveats)** — do first, lowest risk:
  `wsh.throughput`, `wsh.clocked_hours`, `wsh.tech_efficiency`, `wsh.jobs_per_tech`, `vhc.upsell_revenue`, `prt.vhc_conversion`, `prt.revenue`, `prt.margin`, `prt.profitability`.
- **Batch B (ratio / two-source — needs the numerator-only note)**:
  `vhc.authorisation_rate`, `vhc.completion_rate`, `wsh.sold_hours`, `wsh.labour_sales`.
- **Batch C (management delegation — one-liners)**:
  `mgt.upsell_contribution`, `mgt.site_recovery` (depends on Batch B sold_hours), `mgt.growth` (current window only).
- **Batch D (hard — defer / needs UI sub-selector or product decision)**:
  `prt.stock_turn`, `mgt.department_performance`, `mgt.forecast_inputs`.

---

## 7. What ChatGPT should produce from this file

Turn this audit into a Claude Code implementation prompt that:

1. States the goal: **add real drill-downs to the Actionable KPIs so every clickable card opens a table with real contributing records**, eliminating the "no drill-down defined yet" message.
2. Tells Claude Code to work **batch by batch** (A → B → C; leave D as a noted follow-up), committing/checking after each batch.
3. For each KPI, instructs Claude Code to:
   - open the relevant `src/lib/reporting/kpiDefinitions/<dept>.js`,
   - read the existing `resolver` to confirm the exact table/date-column/filters,
   - verify the proposed `drilldown` columns against `src/lib/database/schema/schemaReference.sql`,
   - add a `drilldown` that mirrors the resolver (use the snippets in §4 as the starting point, adjusting columns to the real schema),
   - follow the rules in §5 (especially the ratio numerator-only convention and the management delegation pattern).
4. Reminds Claude Code **not** to touch Blocked KPIs and **not** to change the engine, the API, or the UI for Batches A–C (the table renders any row shape already).
5. Asks Claude Code to verify each batch by loading the report page and confirming rows appear and reconcile with the headline number.
6. Notes the constraints from `CLAUDE.md`: KPI logic lives in `src/lib/reporting/`, never in pages/components; use the `queryBuilder` helpers; never guess schema.

### Useful constants for the prompt
- Engine dir: `src/lib/reporting/`
- KPI definitions: `src/lib/reporting/kpiDefinitions/{workshop,vhc,parts,management}.js` (the four files with Actionable items)
- Drill-down runner: `src/lib/reporting/drilldown.js`
- Query helpers: `src/lib/reporting/queryBuilder.js`
- Schema: `src/lib/database/schema/schemaReference.sql`
- Drill-down table UI (no change needed): `src/components/reporting/ReportDrilldownTable.js`
- Actionable count: **19 KPIs** across **4 files** (Workshop 6, VHC 3, Parts 5, Management 5).
```
