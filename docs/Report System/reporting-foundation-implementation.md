# HNPSystem — Reporting Foundation Implementation (Phase 4)

> **Status:** Implemented. This phase builds the **shared reporting platform foundation only** — the
> infrastructure every future report package plugs into. **No** department report pages, KPI
> dashboards, or charts were built (deliberately out of scope).
> **Source of truth:** the four architecture documents in `docs/Report System/`
> (`reporting-readiness-audit.md`, `reporting-platform-architecture.md`,
> `reporting-data-collection-architecture.md`, `reporting-kpi-catalogue-architecture.md`).
> This phase = the docs' **P2 Foundations** + the three hard prerequisites
> (`dim_department`, `dim_actor`, status normalisation) + the snapshot/aggregation frameworks.

---

## 1. Implementation Summary

A complete, additive reporting fabric was built. It is **inert until switched on** (feature-flag
gated) and **degrades gracefully** when its tables are not yet applied — so it merges without
changing what any user currently sees, and without risk to operational write paths.

### What was built (every requested framework)

| Requested framework | Where | Notes |
|---|---|---|
| Reporting **framework** (engine) | `src/lib/reporting/engine.js` | The one read-side entry point the API calls. |
| Reporting **data layer** | `src/lib/database/reporting/*` | All Supabase access (events, history, snapshots, dims, views) — keeps DB ops out of pages/components per CLAUDE.md §5. |
| Reporting **service layer** | `engine.js` + `resolver.js` | Source selection (snapshot→live fallback) + scope + cache + provenance. |
| Reporting **permission layer** | `permissionScope.js` | Built entirely on `roles.js` (ADR-7). Self/department/cross-department/executive + sensitive gates. |
| Reporting **API layer** | `src/pages/api/reports/*` | `kpi, trend, table, drilldown, export, views, preferences, catalog` — all on the standard envelope. |
| Reporting **configuration layer** | `src/lib/reporting/config/*` | flags, departments, status maps, event catalogue, entities, navigation. |
| Reporting **navigation integration** | `config/navigation.js` | Role-gated `/reports` nav, shaped for `sidebarSections`. **Flagged, not wired** (see §3). |
| Reporting **audit integration** | `audit.js` | Reuses the existing hash-chained `audit_log` via `writeAuditLog` — `report.view` / `report.export`. |
| Reporting **export framework** | `export.js` + `api/reports/export.js` | CSV with active filters; audited; sensitive-gated. |
| Reporting **filter framework** | `filters.js` | The normalised filter object + presets + validation + hash. |
| Reporting **drill-down framework** | `drilldown.js` + `api/reports/drilldown.js` | Contributing records behind any number; permission-gated. |
| Reporting **KPI framework** | `kpiCatalog.js` + `kpiDefinitions/*` | `defineKpi` (22-field standard) + registry; seed R1 catalogue. |
| Reporting **snapshot framework** | `aggregation/runner.js` + `database/reporting/snapshots.js` | Immutable daily→yearly snapshots; ratio inputs stored, not ratios (ADR-16). |
| Reporting **aggregation framework** | `aggregation/runner.js` + `schedule.js` + cron | Idempotent daily compute + weekly→yearly rollups. |
| Reporting **caching framework** | `cache.js` | Short-TTL read cache (reuses `queryCache`) keyed by `(kpi, filterHash, scopeHash)`. |
| Reporting **provenance framework** | `provenance.js` | Source / as-of / formula-version / live-vs-snapshot on every figure (Principle 10). |

### Prioritised prerequisites (the order requested)

1. **Department dimension** — `config/departments.js` (`dim_department` canonical list + hierarchy + role→department map) and `001_dimensions.sql`. Trustworthy attribution path that bypasses the broken free-text `users.department` (D3).
2. **Actor attribution** — `config/`/`actor.js` + `database/reporting/dimActor.js` (canonical-id bridge resolving int `users.user_id` ↔ uuid `auth.users.id`, D4). Unresolved uuids return a **null** canonical id (per-user KPIs stay blocked, not guessed — Risk R2).
3. **Status normalisation** — `config/statusMaps.js` (collapses `authorized`/`authorised`, casing, legacy job statuses; per-entity status models for drift detection — R3).
4. **Reporting configuration framework** — `config/*` (flags + dims + maps + event catalogue + entities + nav).
5. **KPI framework** — `kpiCatalog.js` + seed R1 definitions across Workshop/VHC/Parts/Accounts.
6. **Snapshot framework** — snapshot pyramid tables + read/upsert data layer.
7. **Aggregation framework** — idempotent runner + cadence scheduler + 5 cron endpoints.
8. **Reporting APIs** — 8 endpoints on the standard envelope.
9. **Reporting permissions** — server-side scope + KPI-level + column (sensitive) gates.
10. **Reporting exports** — CSV framework + audited endpoint.

### Integration with existing systems (as required)

- **Role permissions** — `permissionScope.js` imports `roles.js` constants/`hasAnyRole`; APIs wrap the existing `withRoleGuard`; identity is the **NextAuth session** (ADR-8) — the `getUserFromRequest` stub is excluded.
- **Audit systems** — reuses the live hash-chained `audit_log` (`src/lib/audit/auditLog.js`) and `getAuditContext`; no parallel audit engine (ADR-2).
- **Activity systems** — `report_event` bridges are designed to ingest `job_activity_events` / `job_status_history` (the emit fan-out is built; wiring is flag-gated for a later phase).
- **Dashboard / department structure** — department dimension is built from `departmentDashboards.js` + `roleCategories`; navigation mirrors the `sidebarSections` shape.
- **Authentication** — `getServerSession(req,res,authOptions)`, `session.user.id` (canonical int), `session.user.roles`.

### Tooling

- `tools/scripts/check-report-events.js` + `npm run check:report-events` — emit-coverage lint (Phase-2 §13.5), mirroring `check-borders`. Validates every emitted `event_name` against the catalogue (hard fail) and flags status-writes lacking a paired emit (advisory; `--strict` to enforce). **Current run: passes; 5 advisory emit-gaps** in existing write paths surfaced for the later emit phase.
- `src/lib/database/schema/reporting/*.sql` — 5 idempotent, additive migrations + README.

### Verification performed

- `npm run check:report-events` → passes (event names valid; 5 advisories listed).
- ESLint over all new files → **0 errors, 0 warnings**.
- No operational table altered; no global protected file (`Sidebar`, `Layout`, `theme.css`, `globals.css`, `Card`, `Section`, context) modified.

---

## 2. Architecture Summary

```
            ┌──────────────────────────────────────────────────────────┐
   (future) │  REPORTING UI  (NOT built this phase — no pages/charts)   │
            └───────────────┬──────────────────────────────────────────┘
                            │ standard envelope { data, meta, scope, warnings }
            ┌───────────────▼──────────────────────────────────────────┐
            │  API   src/pages/api/reports/*   (withReportingAuth)       │
            │  kpi · trend · table · drilldown · export · views ·       │
            │  preferences · catalog        + access audit               │
            └───────────────┬──────────────────────────────────────────┘
            ┌───────────────▼──────────────────────────────────────────┐
            │  ENGINE  src/lib/reporting/engine.js  (pure read)         │
            │  permissionScope → cache → resolver/trend/drilldown →     │
            │  provenance ; catalogue gate ; envelope                    │
            └───┬───────────────────┬───────────────────┬──────────────┘
       snapshot │            live   │ fallback   config │ (dims, status maps,
      (fast path)│         (labelled)│                   │  event catalogue, flags)
            ┌────▼──────┐   ┌────────▼────────┐   ┌──────▼───────────────┐
            │ kpi_*     │   │ KPI resolvers   │   │ dim_department        │
            │ snapshots │   │ (queryBuilder)  │   │ dim_actor · statusMaps│
            └────▲──────┘   └────────┬────────┘   └──────────────────────┘
   aggregation  │ (cron, idempotent) │ live read of operational tables
            ┌───┴────────────────────┴──────────────────────────────────┐
            │  DATA LAYER  src/lib/database/reporting/*  (graceful-degrade)│
            │  reportEvent(emit fan-out) · statusHistory · snapshots ·    │
            │  dimDepartment · dimActor · savedViews · tableAvailability   │
            └───┬────────────────────────────────────────────────────────┘
            ┌───▼────────────────────────────────────────────────────────┐
            │  EVENT & HISTORY SPINE (SQL applied as a deploy step)       │
            │  report_event · *_status_history · audit_log (EXISTS)       │
            └───┬────────────────────────────────────────────────────────┘
            ┌───▼────────────────────────────────────────────────────────┐
            │  OPERATIONAL SYSTEM (unchanged system of record)            │
            └────────────────────────────────────────────────────────────┘
```

**Layering rules honoured:** UI → API → Engine → (snapshot | live) → Data layer → DB. The engine never
writes. Emit helpers are the only write into the spine, are non-blocking (ADR-18), and are flag-gated.

**Key design properties**

- **Additive & reversible** — every SQL statement is `CREATE … IF NOT EXISTS`; nothing operational is altered (ADR-9). Deleting `src/lib/reporting`, `src/lib/database/reporting`, `src/pages/api/reports`, the cron files, the SQL folder and the one package.json line fully removes the foundation.
- **Graceful degradation** — `tableAvailability.js` means every read returns empty + a labelled warning until its table is applied; nothing 500s.
- **Pluggable** — a new KPI is `registerKpi(defineKpi({…}))`; a new department is one row in `departments.js`; a new event is one row in `eventCatalogue.js`. No architectural change.
- **Trust-by-construction** — counts use exact `count:'exact'`, sums paginate the full column (no `.limit()` totals — fixes D8/G1); statuses normalise before grouping; figures carry provenance.

---

## 3. Reporting Foundation Status

| Area | Status | Notes |
|---|---|---|
| Engine / service / resolver | ✅ Built, lint-clean | Live-fallback path active; snapshot path ready. |
| Permission layer | ✅ Built | Self/department/cross-dept/executive + financial/PII sensitive gates. |
| API layer (8 endpoints) | ✅ Built | Standard envelope; access audited. |
| Configuration layer | ✅ Built | Departments, status maps, event catalogue, entities, flags, nav. |
| Department dimension | ✅ Built (config + SQL) | Live once `001_dimensions.sql` applied + `seedDepartments()`. |
| Actor attribution | ⚠️ Built, partial trust | Int ids canonical now; **uuid-keyed sources need `dim_actor` populated** before per-user KPIs (R2). |
| Status normalisation | ✅ Built | Maps + models in place; CHECK constraints deferred to P7. |
| KPI framework | ✅ Built | `defineKpi` + registry; **seed R1 set** (9 KPIs) registered. Full ~110 catalogue added incrementally. |
| Snapshot framework | ✅ Built | Tables + read/upsert; **inert until `004_kpi_snapshots.sql` applied**. |
| Aggregation framework | ✅ Built | Idempotent runner + 5 cron endpoints; writes once snapshot tables exist. |
| Caching / provenance / filter / drill-down / export | ✅ Built | All framework-complete. |
| Audit integration | ✅ Built | Reuses live `audit_log`. |
| Navigation integration | ⚠️ Built, **not wired** | `getReportingNavSection()` ready; wiring into `Sidebar` is a **flagged global change** (CLAUDE.md §7) + `reporting_nav_enabled` flag. Needs sign-off. |
| Emit fan-out into write paths | ⛔ Not wired (by design) | Helper built + flag-gated; instrumenting operational writes is the next phase (P4/P5 capture). |
| SQL migrations applied to Supabase | ⛔ Not applied | Design artifacts; apply as a deploy step to unlock capture/trends. |

**Feature-flag posture (`config/flags.js`):** `reporting_enabled` ON, `reporting_live_fallback_enabled` ON,
`reporting_access_audit_enabled` ON, `reporting_export_enabled` ON; `reporting_nav_enabled` **OFF**,
`reporting_emit_enabled` **OFF**.

---

## 4. Remaining Blockers Before **Workshop** Reporting

Workshop has the highest readiness (richest `jobs` data). To ship Workshop reports:

1. **Apply `001_dimensions.sql` + `002` + `004`** and `seedDepartments()` — unlocks department slicing and snapshots (without them, Workshop KPIs still work live but cannot trend).
2. **Actor bridge (D4)** for per-technician metrics — `wsh.tech_efficiency`, `wsh.tech_ranking`, jobs-per-tech need `dim_actor` populated so technician attribution is trustworthy (R2). Department-level Workshop KPIs (`wsh.jobs_completed/created`, throughput) are **ready now** (R1, seeded).
3. **Status-history for cycle-time/dwell** — `wsh.cycle_time`, `wsh.stage_dwell`, `wait_parts/customer/auth` need `job_status_history` (exists) plus the event spine live (emit wiring) — R2.
4. **Labour-source reconciliation (D5)** before `wsh.labour_recovery`/`tech_productivity` (three clocking models).
5. **(R3, not blocking core)** capacity/ramp model for utilisation; rework flag for rework rate.

**Net:** department-level Workshop reporting is unblocked once the SQL is applied; per-tech and cycle-time tiers need the actor bridge + live event spine.

---

## 5. Remaining Blockers Before **Parts** Reporting

1. **Apply the dimension + snapshot SQL** (as above). `prt.requests` and `prt.open_by_status` (seeded, R1, exact non-truncated counts) work live immediately after.
2. **`parts_job_items_status_history` (P4 priority 1)** — apply `003_status_history.sql` **and** wire the emit on the parts status-update helper. This is the single biggest Parts unlock: `prt.lead_time`, `prt.ageing`, `prt.cancelled`, `prt.unavailable`, `prt.pick_rate`, `prt.backorder_rate` (all R2).
3. **Actor bridge (D4)** — `parts_job_items.allocated_by` / `parts_stock_movements.performed_by` are **uuid**-keyed; `dim_actor` must be populated before any per-user Parts attribution (R2).
4. **`suppliers` master (R3)** — `prt.supplier_performance`, per-supplier `prt.fill_rate`, precise `prt.lead_time`.
5. **Parts-request model reconciliation (D6)** — `parts_requests` vs `parts_job_items` before request-funnel metrics are authoritative.

**Net:** open-pipeline/backlog Parts reporting is unblocked after the SQL; cycle-time/supplier tiers need parts status-history + emits + the actor bridge (+ `suppliers` for R3).

---

## 6. Remaining Blockers Before **Accounts** Reporting

1. **Apply the dimension + snapshot SQL.** `acc.revenue` and `acc.outstanding_invoices` (seeded, R1, financial-gated) work live immediately after.
2. **Financial permission confirmation** — the foundation gates these to Accounts + executives (`FINANCIAL_SENSITIVE_ROLES`). Confirm the role set matches policy before exposing £ figures.
3. **`invoice_status_history` (P4 priority 3)** + emits — required for `acc.dso`, `acc.invoice_ageing`, `acc.payment_conversion` (no `paid_at` today, only a `paid` bool) — R2.
4. **Denormalised-totals reconciliation (D12)** — `invoices` carries 7 total columns and `accounts.balance` is denormalised; prefer line-item recompute and flag the denormalised source in provenance before trusting revenue/AR.
5. **COGS on invoice lines (R3)** — blocks `acc.gross_profit`, `acc.net_profit`, and the executive `mgt.company_profitability`.

**Net:** revenue/AR snapshot reporting is unblocked after the SQL; DSO/ageing need invoice status-history + emits; profitability needs COGS (R3).

---

## 7. Recommended Next Phase

**Phase 5 — Capture go-live + Trustworthy current-state (docs' P4/P5 + P3).** In order:

1. **Apply the SQL migrations** (`001`–`005`) to Supabase and run `seedDepartments()`. *(Unlocks dimensions, the event spine, status-history tables, the snapshot pyramid, saved views — turning the built-but-inert frameworks live.)*
2. **Populate `dim_actor`** (the D4 bridge) — backfill int↔uuid mappings so per-user KPIs become trustworthy (lifts Risk R2). Then **fix `users.department` vocabulary (D3)** and constrain to `dim_department`.
3. **Wire the emit fan-out** into the highest-value write paths and flip `reporting_emit_enabled`: parts status → VHC item → invoice status (the §19 build order). Run `npm run check:report-events --strict` as the gate. This makes cycle-time/dwell/DSO possible.
4. **Schedule the aggregation crons** (daily, then weekly/monthly) so snapshots/trends accrue.
5. **Promote the seed catalogue to the full R1 set** (Phase-3 §16.2 order) — still **no department pages/dashboards**; just register the remaining R1 KPI definitions so they're available through the API.
6. **Sign-off + wire the `/reports` navigation** (flagged global Sidebar change) and flip `reporting_nav_enabled` — only when the UI phase begins.

After Phase 5, **Phase 6** is the first UI/report-package phase (embedded department scorecards, then the dedicated `/reports` area, charts, and exports) — which plugs into this foundation without any architectural redesign, exactly as intended.

---

*End of Phase 4. Foundation implemented; no department reports, KPI dashboards, or charts were built. SQL migrations are additive design artifacts pending a deploy step; all user-facing surfaces remain flag-gated OFF.*
