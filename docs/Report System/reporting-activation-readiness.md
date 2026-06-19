# HNPSystem — Reporting Activation & Readiness (Phase 5)

> **Status:** Implemented. Phase 5 = **activation, validation and hardening** of the reporting
> foundation built in Phase 4. **No** report pages, dashboards, charts, scorecards, visualisations or
> department report screens were built — deliberately out of scope.
> **This document is the master reference for Reporting Activation & Readiness.**
> **Source of truth:** the four architecture docs in `docs/Report System/`
> (`reporting-readiness-audit.md`, `reporting-platform-architecture.md`,
> `reporting-data-collection-architecture.md`, `reporting-kpi-catalogue-architecture.md`) +
> the Phase-4 summary (`reporting-foundation-implementation.md`).
> **Objective:** make the reporting platform operationally trustworthy and ready for the first
> report-package implementation.

---

## 0. Executive Summary

Phase 4 delivered a complete-but-inert reporting fabric (engine, data layer, APIs, config, KPI
framework, snapshot/aggregation framework, emit fan-out) plus five additive SQL migrations as design
artifacts. Phase 5 **switches the foundation from "built" to "live-ready and validated"**:

1. **Schema restored & hardened.** The five migrations had been deleted from the working tree; they
   are restored, every table now **enables Row-Level Security** (deny-by-default, as the README
   mandates), and a single combined **`000_all_reporting.sql`** is provided for one-shot apply.
2. **The event spine and status-history capture are wired into the four highest-value lifecycles**
   (Job, VHC, Parts, Invoice) through thin, non-blocking, flag-gated emit adapters. Capture is
   inert until `reporting_emit_enabled` is flipped — so this changes nothing a user sees today, and
   carries zero risk to operational write paths (ADR-18 / R10).
3. **A runtime validation harness** (`npm run validate:reporting`, 36 contract checks) asserts every
   Phase-5 invariant — infrastructure, department dimension, actor bridge, event ownership, status
   models, data-trust normalisation, snapshot contract, R1 KPI readiness, audit & permissions. It is
   green, and it **caught a real ownership defect** (a non-department `vhc` in `related_departments`)
   which is now fixed.
4. **Data trust is established by construction**: every reporting figure flows through `queryBuilder`
   (exact counts, paginated full sums, status-normalised grouping) — no `.limit()` totals, no
   overlapping `ILIKE`, no fragmented `GROUP BY` anywhere in the reporting framework.

**Net result:** department-level **Workshop**, **Parts (open-pipeline)**, **VHC** and **Accounts
(revenue/AR)** report packages are **ready to build now**. Per-technician, cycle-time/DSO and supplier
tiers remain blocked on the documented R2/R3 prerequisites (actor backfill, applied SQL + accrued
history, missing domain entities).

---

## 1. What Was Activated

| Area | Activation | Where |
|---|---|---|
| **Reporting schema (5 migrations)** | Restored from history; **RLS enabled on all 20 tables**; combined **`000_all_reporting.sql`** added (FK-safe 001→005, additive + idempotent). | `src/lib/database/schema/reporting/000–005*.sql` |
| **Event spine — Job lifecycle** | `JOB_STATUS_CHANGED` emitted at the existing `job_status_history` write point (event only — history already written operationally). | `src/lib/database/jobs.js` (`updateJob`) |
| **Event spine — VHC lifecycle** | `VHC_CREATED`, `VHC_AUTHORISED` / `VHC_DECLINED`, `VHC_ITEM_STATUS_CHANGED`, `VHC_SENT` emitted at create / approval / send / declination. | `src/lib/database/vhc.js` |
| **Event spine — Parts lifecycle** | `PART_*` (named milestone per target status, else `PART_STATUS_CHANGED`) on every parts status transition. | `src/pages/api/parts/job-items/[id].js` |
| **Event spine — Invoice lifecycle** | `INVOICE_CREATED`, `INVOICE_PAID`, `PAYMENT_RECEIVED`, `TRANSACTION_POSTED` on create / payment / ledger post. | `src/pages/api/invoices/create.js`, `…/payments/simulate.js` |
| **Status-history capture** | Parts / VHC-item / Invoice transitions now also write their `*_status_history` row via the emit fan-out. | `src/lib/database/reporting/emitters.js` → `statusHistory.js` |
| **Emit adapters** | New thin, centralised lifecycle emit layer (one line per call-site, correct event/entity/history/owner). | `src/lib/database/reporting/emitters.js` (new) |
| **Department dimension** | Canonical `dim_department` model + role→department attribution confirmed live and seedable. | `src/lib/reporting/config/departments.js`, `dimDepartment.js` |
| **Actor bridge** | `dim_actor` resolver confirmed: int = canonical today, uuid blocked-not-guessed (R2). | `src/lib/reporting/actor.js`, `dimActor.js` |
| **Validation harness** | `npm run validate:reporting` (36 runtime contract checks). | `src/lib/reporting/validation/reportingActivation.test.js` (new) |
| **Emit-coverage lint** | Extended to recognise the new `emit<Name>` adapters; Job/VHC paths now pass. | `tools/scripts/check-report-events.js` |

**Feature-flag posture (unchanged, correct for activation):** `reporting_enabled` **ON**,
`reporting_live_fallback_enabled` **ON**, `reporting_access_audit_enabled` **ON**,
`reporting_export_enabled` **ON**, `reporting_emit_enabled` **OFF** (capture stays inert until the SQL
is applied and go-live is signed off), `reporting_nav_enabled` **OFF** (UI phase only).

> **Go-live switch:** apply `000_all_reporting.sql`, run `seedDepartments()`, then set
> `NEXT_PUBLIC_REPORTING_REPORTING_EMIT_ENABLED=true`. Until then every emit adapter is a no-op and
> every reader degrades to empty, non-erroring envelopes.

---

## 2. What Was Validated

All validations are encoded as a **green, repeatable** suite (`npm run validate:reporting`, 36/36) so
they are not one-off assertions — they re-run in CI and on every change. Coverage:

| § | Validation | Result |
|---|---|---|
| 1 | Migrations exist; **every** `CREATE TABLE` is `IF NOT EXISTS` (idempotent); **RLS on all 20 tables**; combined 000 mirrors the per-section tables exactly; flag posture correct. | ✅ |
| 2 | `dim_department` complete & self-consistent (hierarchy resolves to a root); a producing department resolves for every operational role; operational dept preferred over `management` for multi-role users. | ✅ |
| 3 | Actor bridge: canonical int from session; system/customer actors honest (no fake ids); **unresolved auth uuid → null canonical id (R2 block, not a guess)**; int id canonical today. | ✅ |
| 4 | Every catalogue event has a valid category, an `owner_department` ∈ `dim_department`, and `related_departments ⊆ dim_department`; the four lifecycles' key events all catalogued; parts status→named-event map valid; spine has idempotency index. | ✅ |
| 5 | Every reportable entity's `*_status_history` table is created by a migration (or pre-exists); the four prioritised entities registered; pending entities ordered by reporting priority (parts first). | ✅ |
| 6 | Status normalisation collapses `authorized/authorised`, legacy/cased job statuses; **idempotent** on canonical values; out-of-model values flagged for drift (not dropped). | ✅ |
| 7 | Every snapshot cadence maps to a created table with a `formula_version` conflict key; entity-state + lineage tables exist; snapshots store ratio **inputs** (num/den/count), not just the ratio. | ✅ |
| 8 | The seed **R1** catalogue is registered and **every R1 KPI is implemented**; every KPI's `sourceEvents`/`sourceHistories` reference real catalogue/entities; each KPI sits in a real department. | ✅ |
| 9 | All financial/security events are in the audit-required set; **financial KPIs gated to Accounts/execs** (a technician is refused `acc.revenue`); operational scope confined to own department; executives see all. | ✅ |

**Also validated (manual + lint):**
- `npm run check:report-events` → passes; **1** advisory emit gap remains (`jobClocking.js` clocking
  edits — out of the four prioritised lifecycles; see §4 / R-list).
- ESLint over every touched file → **0 errors** (pre-existing warnings only).
- Graceful degradation: `tableAvailability.js` probes each table once and returns empty + warning
  when absent; every read helper and emit adapter short-circuits safely → confirmed by code path and
  by the harness loading the catalogue with **no database**.

---

## 3. What Was Fixed

1. **Deleted schema restored + hardened.** The five migrations were missing from the working tree.
   Restored verbatim from history, then **RLS `ENABLE` blocks appended to every table** (the README
   mandated them; they had been lost), and the combined **`000_all_reporting.sql`** created.
2. **Event-ownership data defect.** `PART_REQUESTED` listed `vhc` in `related_departments`, but `vhc`
   is a cross-cutting **domain**, not a `dim_department` code — a §13.1 ownership-validation breach
   that would corrupt "all events touching department X" queries. Corrected to `["workshop"]` (the
   producing department of a VHC-raised part). *Caught by the new harness.*
3. **Emit-coverage lint blind spot.** The lint only recognised `emitReportEvent`/`writeStatusHistory`
   as "paired emits"; the new lifecycle adapters (`emitJobStatusChanged`, …) were invisible. Extended
   the matcher to any `emit<Name>(` adapter so the Job and VHC paths are correctly counted as wired.
4. **Unit tests could not load DB-touching modules without creds.** `vitest.config.js` now forces the
   in-memory Supabase stub **only when credentials are absent**, so `validate:reporting` runs on a
   fresh clone / CI without a database (real-cred environments are unaffected).
5. **Actor attribution hardened at the source.** Emit adapters resolve actors through `toIntOrNull` —
   free-text/name actors become `null` (unattributed) rather than being coerced into a wrong id,
   preserving the R2 "block, don't guess" guarantee.

---

## 4. Event Coverage Summary

Capture is wired (flag-gated) into the **four highest-value lifecycles**; the rest of the catalogue
remains declared-but-unwired (later phases / missing entities).

| Lifecycle | Events emitted | Status-history written | Call-site |
|---|---|---|---|
| **Job** | `JOB_STATUS_CHANGED` | `job_status_history` (operational, pre-existing) | `jobs.js updateJob` |
| **VHC** | `VHC_CREATED`, `VHC_AUTHORISED`, `VHC_DECLINED`, `VHC_ITEM_STATUS_CHANGED`, `VHC_SENT` | `vhc_item_status_history` (create + decision + transition) | `vhc.js` |
| **Parts** | `PART_ORDERED/ALLOCATED/PRE_PICKED/PICKED/FITTED/CANCELLED/REMOVED/UNAVAILABLE` or `PART_STATUS_CHANGED` | `parts_job_items_status_history` | `api/parts/job-items/[id].js` |
| **Invoice / Accounts** | `INVOICE_CREATED`, `INVOICE_PAID`, `PAYMENT_RECEIVED`, `TRANSACTION_POSTED` | `invoice_status_history` (create + paid) | `api/invoices/create.js`, `…/payments/simulate.js` |

**Design properties of the wiring:**
- **One event per transition** — a named milestone where the status maps (so `PART_FITTED` KPIs have a
  stable name), otherwise the generic `<ENTITY>_STATUS_CHANGED`; both carry `from_state`/`to_state`.
  Avoids double-counting the same transition.
- **Non-blocking & flag-gated** — every adapter routes through `emitReportEvent`, which short-circuits
  when `reporting_emit_enabled` is OFF and swallows all errors; the operational transaction is never
  slowed or failed (ADR-18 / R10). Calls are `await`-ed so capture completes in a serverless freeze.
- **Audit fan-out** — `INVOICE_*`, `PAYMENT_RECEIVED`, `TRANSACTION_POSTED` are audit-required, so the
  emit also writes the hash-chained `audit_log` row (financial plane) when capture is on.

**Not yet emitting (known gaps):**
- `CLOCKING_EDITED` (payroll-integrity audit) — `jobClocking.js`; the one remaining lint advisory.
- `JOB_CREATED` / `JOB_ASSIGNED` — adapters exist (`emitJobCreated`, …) but the create/assign call-
  sites are not yet wired (status-change capture is the priority; intake volume is derivable from
  `JOB_STATUS_CHANGED`/base tables meanwhile).
- All MOT / Paint / Valeting / Appointment / Delivery events — blocked on missing domain entities
  (TD-E) or lower priority.

---

## 5. Status-History Coverage Summary

| Entity | History table | In schema | Capture wired | Notes |
|---|---|---|---|---|
| Job | `job_status_history` | pre-exists | ✅ (operational) | Reference template; reporting reads it directly. |
| Part line | `parts_job_items_status_history` | ✅ (003) | ✅ | P4 priority 1 — unlocks dwell/cycle-time/ageing once SQL applied + emits on. |
| VHC item | `vhc_item_status_history` | ✅ (003) | ✅ | Decision-level transitions (create / authorise / decline / move). |
| Invoice | `invoice_status_history` | ✅ (003) | ✅ | Draft→Paid latency / AR ageing once accrued. |
| Account | `account_status_history` | ✅ (003) | ⛔ not wired | Credit-control freeze/close — later. |
| Appointment | `appointment_status_history` | ✅ (003) | ⛔ not wired | Booking funnel — later. |
| Delivery | `delivery_status_history` | ✅ (003) | ⛔ not wired | Reconcile duplicate delivery families first (D7). |
| MOT / Paint / Valeting | — | ⛔ (omitted) | ⛔ | Require missing domain entities (TD-E / P7). |

History **accrues only forward** from go-live; historical cycle-time needs either a backfill
(`source='backfill'`) or forward accrual. The tables are immutable, app-emitted, no triggers (ADR-21).

---

## 6. Attribution Coverage Summary (+ remaining gaps)

**Department attribution — trustworthy now.** Resolved from the actor's **role** via the
`ROLE_DEPARTMENT_MAP` (the only reliable signal until `users.department` is fixed, D3) and otherwise
from the event-name default (`owner_department`). Every catalogue event resolves to a real
`dim_department` code (validated). Operational department is preferred over the catch-all
`management` for multi-role users.

**Actor attribution — int canonical today; uuid blocked (R2).**

| Source of "who" | Identity | Status |
|---|---|---|
| `jobs.assigned_to`, `status_updated_by`, session `user.id` | int `users.user_id` | ✅ **Trustworthy** (canonical space today) |
| Technician on a job (`assigned_to`) | int | ✅ Trustworthy → per-tech volume buildable |
| Advisor (`booked_by`/`checked_in_by`, session) | int | ✅ Trustworthy where an int id is present |
| `parts_job_items.allocated_by`, `parts_stock_movements.performed_by`, `parts_catalog` | **uuid** `auth.users.id` | ⛔ **Blocked (R2)** — `dim_actor` must be populated before per-user Parts attribution; emit stores `actor_auth_uuid`, canonical id stays `null` |
| `account_transactions.created_by`, VHC `sent_by`/`declined_by`/`approved_by`, `job_status_history.changed_by` | **free-text** (names / `SYSTEM_*` / "customer") | ⚠️ **Partial** — emit captures only numeric ids; names → unattributed (not guessed). Needs `dim_actor` name→id resolution or upstream switch to ids |
| Invoice creator | — (no staff-owner column on `invoices`) | ⚠️ **Forward-only** — captured via emit `actor_user_id` from session going forward; historical invoices have no owner |
| Customer-authorised VHC | `actor_kind='customer'`, no user id | ✅ By design (owner_department = service desk, §5.4) |

**Remaining attribution gaps (the explicit list requested):**
1. **uuid-keyed Parts actors** (`allocated_by`, `performed_by`) — blocked until `dim_actor` is
   backfilled with int↔uuid mappings (R2). *Highest-value attribution unlock.*
2. **Free-text actor columns** (`account_transactions.created_by`, VHC `sent_by`/`declined_by`,
   `job_status_history.changed_by`) — resolve names→canonical id via `dim_actor`, or switch the
   upstream writes to pass numeric ids.
3. **No staff-owner column on `invoices`** — per-advisor invoice attribution is forward-only (from
   emit) until an owner column or invoice-creation audit backfill exists.
4. **`users.department` wrong vocabulary (D3)** — department attribution rides on role, not the free-
   text department column; constrain + backfill `users.department` to `dim_department` codes to make
   the entity-intrinsic attribution path (§7.5 step 1) trustworthy.
5. **Clocking edits unattributed** (`CLOCKING_EDITED` not emitted) — payroll-integrity audit gap.

---

## 7. KPI Readiness Summary

**Seed catalogue: 9 KPIs, all R1, all implemented (have resolvers).**

| KPI | Dept | Tier | Source / calc readiness | Permission | Drill-down |
|---|---|---|---|---|---|
| `wsh.jobs_completed` | workshop | operational | ✅ exact count (replaces the `.limit()` D8 bug) | any | ✅ |
| `wsh.jobs_created` | workshop | operational | ✅ exact count | any | – |
| `vhc.red_items` | workshop | operational | ✅ severity count (real `severity`, not text-RAG) | any | ✅ |
| `vhc.upsell_revenue` | workshop | tactical | ✅ paginated sum | any | – |
| `vhc.authorisation_rate` | workshop | tactical | ✅ ratio (num/den stored separately) | any | – |
| `prt.requests` | parts | operational | ✅ exact count | any | – |
| `prt.open_by_status` | parts | operational | ✅ full, status-normalised distribution (point-in-time) | any | ✅ |
| `acc.revenue` | accounts | executive | ✅ paginated sum (⚠ denormalised total — D12, flag in provenance) | **financial** | – |
| `acc.outstanding_invoices` | accounts | operational | ✅ exact count (Sent/Overdue) | **financial** | ✅ |

For every R1 KPI the harness validates: **source availability** (tables/events exist), **calculation
readiness** (resolver present, uses the sanctioned `queryBuilder`), **permission readiness** (real
permission tokens; financial KPIs gated), and **drill-down readiness** (drilldown is a function where
declared). **Reporting readiness** (snapshot vs live) is satisfied by the resolver/live-fallback path
today and upgrades to snapshot-served automatically once the aggregation cron accrues rows.

The full ~110-KPI catalogue (Phase-3 §16) is added the same way — `registerKpi(defineKpi({…}))` — as
the R2/R3 prerequisites land. No architectural change is needed to grow it.

---

## 8. Reporting Trust Assessment

**Trustworthy by construction.** Every reported figure in the reporting framework flows through
`queryBuilder`:
- **Counts** use `head:true, count:'exact'` — never `.limit()` as a total (fixes D8/G1).
- **Sums** paginate the full column past the 1000-row PostgREST cap (no hidden truncation), with a
  `MAX_SUM_ROWS` guard that **warns** rather than silently capping.
- **Distributions** (`groupCount`) paginate fully and **status-normalise** before grouping, so
  `authorized/authorised`, casing and legacy values cannot fragment a `GROUP BY` (R3).
- **Ratios** store numerator + denominator separately (ADR-16) so rollups are correct, never an
  average-of-averages.
- **Provenance** is attached to every result (source / as-of / formula-version / live-vs-snapshot).

Confirmed: **no `.limit()` total, no overlapping `ILIKE` count, no default-amber RAG** anywhere in the
reporting framework. The status-interpretation inconsistency is removed at the single normalisation
chokepoint; duplicate-counting risk is removed by **one `owner_department` per event** (related
departments are read-only) and by deterministic `event_uuid` dedupe on the spine.

**Residual trust caveats (documented, not silent):**
- `acc.revenue` sums the denormalised `invoices.grand_total` (D12) — flagged in the KPI's
  `futureNotes`; prefer line-item recompute when the 7 totals disagree, and label the denormalised
  source in provenance.
- The **legacy dashboard helpers** (`src/lib/database/dashboard/*`) still carry the original D8 defects
  (truncation, MOT `ILIKE`, default-amber). They are **out of Phase-5 scope** — they are replaced
  screen-by-screen when report packages route through the catalogue (Phase 6). Until then, any number
  shown by a legacy dashboard is not a reporting-framework number and is not covered by this trust
  assessment.

---

## 9. What Remains Blocked

### 9.1 Remaining **R2** blockers (need applied SQL + accrued history + actor backfill)
- **`dim_actor` not yet populated** → per-user / per-technician / per-advisor / per-parts-operator KPIs
  blocked for uuid- and name-keyed sources (R2). *Unblocks: `wsh.tech_efficiency`, `wsh.tech_ranking`,
  `wsh.jobs_per_tech`, per-operator Parts metrics, advisor scorecards.*
- **Status-history not yet accrued** (SQL unapplied / emits OFF) → cycle-time, dwell-time, stage timing
  blocked. *Unblocks: `wsh.cycle_time`/`stage_dwell`, `prt.lead_time`/`ageing`/`pick_rate`/`backorder`,
  `acc.dso`/`invoice_ageing`/`payment_conversion`, VHC send→decision latency.*
- **No snapshots yet** (aggregation cron not scheduled) → arbitrary-range trends served by labelled
  live fallback, not snapshot. *Unblocks: all trend/period-over-period views once the cron runs.*
- **`users.department` (D3)** un-fixed → entity-intrinsic department attribution rides on role only.
- **Labour-source reconciliation (D5)** → `wsh.labour_recovery` / `tech_productivity` (three clocking
  models) need a canonical labour source.

### 9.2 Remaining **R3** blockers (need missing domain entities / new modelling)
- **`suppliers` master** → `prt.supplier_performance`, per-supplier `prt.fill_rate`, precise lead time.
- **`mot_tests` (+advisories, retest linkage)** → first-time pass rate, per-tester pass rate.
- **Paint stage model** → paint stage cycle-time, bay utilisation, painter productivity.
- **Valet `wash_completed_at` (+assignee)** → wash duration/SLA, per-valet productivity.
- **COGS on invoice lines** → `acc.gross_profit`/`net_profit`, executive `mgt.company_profitability`.
- **`warranty_claims` / `warranty_status_history`** → warranty cycle-time / approval / reimbursement.
- **Parts-request (D6) & delivery (D7) model reconciliation** → authoritative request-funnel /
  delivery-SLA reporting.

---

## 10. Snapshot & Aggregation Validation

- **Snapshot creation / cadence:** every cadence (`daily→weekly→monthly→quarterly→yearly`) maps to a
  created table with the correct `formula_version` conflict key (validated). The daily runner computes
  from each implemented KPI's resolver; rollups recombine num/den from the level below.
- **Aggregation / rebuild / recalculation:** the runner is **idempotent** (UPSERT on the conflict key →
  re-running a period overwrites it), **incremental** (one period, bounded), and records lineage in
  `report_aggregation_run` + a `SNAPSHOT_BUILT` event. Recompute under a new `formula_version` retains
  old-version rows (ADR-17). Late data → recompute the affected day.
- **Trend-generation readiness:** ratio KPIs store inputs (not averages-of-averages); point-in-time
  KPIs carry the last value; flow KPIs sum — so trends will be correct the moment snapshots accrue.
- **Historical preservation:** snapshots are immutable, compact, kept indefinitely; raw events archive
  at 24 months but snapshots remain self-contained and reconstructable.
- **Live behaviour today:** all of the above is **inert until `004_kpi_snapshots.sql` is applied and the
  aggregation crons are scheduled**; until then the resolver serves a labelled live fallback. The
  contract (cadence↔table↔conflict-key, ratio inputs present) is validated statically now.

---

## 11. Reporting Audit Validation

- **Report-access logging:** every `/api/reports/*` view/export writes a hash-chained `audit_log` row
  (`report.view`/`report.export`) via `auditReportAccess` (gated by `reporting_access_audit_enabled`,
  **ON**), and mirrors a `REPORT_VIEWED`/`REPORT_EXPORTED` event for usage analytics.
- **Export audit & sensitive controls:** the CSV export endpoint is audited and **sensitive-gated**;
  financial KPIs (`acc.*`) require `FINANCIAL_SENSITIVE_ROLES` — validated that a technician is refused
  `acc.revenue` and an Accounts user is granted it.
- **Reporting security / permissions:** server-side only — `withReportingAuth` composes the existing
  `withRoleGuard` (route gate) with `permissionScope` (row/department scope) and the per-KPI
  permission gate. Operational scope is confined to its own department; executives see all (validated).
  Identity is the NextAuth session, never the `getUserFromRequest` stub (ADR-8).
- **Audit-required coverage:** all financial/security events (`INVOICE_*`, `PAYMENT_RECEIVED`,
  `TRANSACTION_POSTED`, `ROLE_CHANGED`, `RECORD_DELETED`, `REPORT_*`, …) are in the audit-required set,
  so their emit fans out to `audit_log` (validated). The financial events in the wired Invoice
  lifecycle therefore become auditable the moment capture is enabled.

---

## 12. Report Packages Ready for Implementation

> "Ready" = sources exist, the framework computes them trust-correctly today (live), permissions and
> drill-down are in place. Trends/cycle-time tiers within each package still need the SQL applied +
> emits on + snapshots accruing.

| Package | Ready now (department-level, live-correct) | Needs (for the deeper tiers) |
|---|---|---|
| **Workshop** | jobs completed/created, throughput volume — exact, non-truncated | `dim_actor` (per-tech), status-history accrual (cycle-time), D5 (labour recovery) |
| **Parts (open pipeline)** | open-by-status distribution, requests — exact, status-normalised | parts status-history accrual (dwell/lead-time), `dim_actor` (per-operator), `suppliers` (R3) |
| **VHC** | red items, upsell £, authorisation rate — real severity, correct ratio | send→decision latency (history + emits), per-advisor (`dim_actor`/name resolution) |
| **Accounts (revenue / AR)** | revenue, outstanding invoices — financial-gated, paginated sums | DSO/ageing (invoice status-history accrual), COGS for margin (R3), D12 reconciliation |

**Recommended first package: Workshop** (richest, most R1, fewest blockers), then **Parts open-pipeline**
and **VHC**, then **Accounts revenue/AR** once the financial role set is confirmed against policy.

---

## 13. Recommended Next Phase

**Phase 6 — Go-live capture + first report package (Workshop).** In order:

1. **Apply `000_all_reporting.sql`** to Supabase and run `seedDepartments()`.
2. **Flip `reporting_emit_enabled` ON** and run `npm run check:report-events` as the gate; confirm
   `report_event` + `*_status_history` rows accrue from the four wired lifecycles.
3. **Backfill `dim_actor`** (int↔uuid + name→id) to lift the R2 per-user block; then constrain/backfill
   `users.department` (D3).
4. **Schedule the aggregation crons** (daily → weekly/monthly) so snapshots/trends accrue.
5. **Promote the R1 catalogue** to the full Workshop R1 set (still no pages — definitions only).
6. **Build the first report package** (Workshop) on the existing engine/API — embedded scorecard
   panels first, then the dedicated area — flipping `reporting_nav_enabled` only when the UI phase
   begins (a flagged global Sidebar change requiring sign-off).

After Phase 6, extend capture to the remaining lifecycles (clocking edits, account/appointment/
delivery) and unblock the R3 packages by deploying the missing domain entities (suppliers, mot_tests,
paint stages, wash timestamp, warranty).

---

## 14. How to Re-run the Validation

```bash
npm run validate:reporting     # 36 runtime contract checks (no DB needed)
npm run check:report-events    # emit-name validity + emit-coverage advisories
```

`validate:reporting` is the canonical readiness gate — green means the foundation's
infrastructure / department / actor / event / status / data-trust / snapshot / KPI / audit contracts
all hold. Re-run it after any reporting change.

---

*End of Phase 5. Activation, validation and hardening complete. No report pages, dashboards, charts,
scorecards or department report screens were built. The reporting platform is operationally
trustworthy and ready for the first report package (Workshop), with R2/R3 blockers and the exact
go-live switch documented above.*
