# HNPSystem — Reporting Platform Architecture (Phase 1 Design)

> **Status:** Design only. No code, reports, or database migrations have been created.
> **Document type:** Master architectural source of truth for the HNPSystem reporting platform.
> **Audience:** Future implementation phases and future AI/engineering sessions.
> **Companion document:** [`docs/reporting-readiness-audit.md`](reporting-readiness-audit.md) — the factual audit this design is built on. Read it first; every design decision here traces back to a finding there.

---

## 0. How to use this document

This is the **single source of truth** for the reporting platform. It is intentionally long so that later phases can be executed without re-designing.

- **Naming convention for proposed objects:** anything prefixed `report_*`, `*_status_history`, `kpi_*`, or marked _(proposed)_ does **not exist yet** — it is a design target. Anything in backticks without _(proposed)_ already exists in the repo (verified in the audit).
- **Stack constraints (must be respected):** Next.js Pages Router, React, Supabase (PostgreSQL), NextAuth.js, Tailwind v4 + CSS custom properties. Path alias `@/` → `src/`. DB access only via `src/lib/database/*` helpers (never raw Supabase in pages/components). UI surfaces must use `LayerSurface` / `LayerTheme` (see `CLAUDE.md` §3).
- **Change discipline:** any change touching `theme.css`, `globals.css`, `Layout.js`, `Sidebar.js`, `Section.js`, `Card.js`, or `context/*` is a **global change** and must be flagged before implementation (CLAUDE.md §7).

### Table of contents
1. Executive Summary
2. Reporting Vision
3. Reporting Platform Goals
4. Reporting Principles
5. Reporting Maturity Roadmap
6. Current-State Architecture
7. Target-State Architecture
8. Reusable Inventory — Keep / Extend / Replace / Deprecate
9. Cross-Cutting Architecture (Engine, Data Flow, Permissions, API, UI, Dashboard, KPI, Drill-down, Export, Filtering, Caching, Performance, Security, Audit, Event, Snapshot, Aggregation, Rollup, Retention)
10. Standard Reporting Model
11. Event-Driven Reporting Strategy
12. Status-History Strategy
13. KPI Strategy (Operational / Management / Executive)
14. Reporting Permission Model
15. Reporting Navigation Model
16. Department Architecture (Workshop, Parts, Service Advisors, MOT, Valeting, Paint, Accounts, Admin, Management)
17. Implementation Roadmap
18. Architecture Decisions (ADRs)
19. Risks
20. Technical Debt Discovered
21. Data-Model Issues Requiring Remediation
22. Recommended Implementation Sequence
23. Success Criteria for Phase 1 Completion

---

## 1. Executive Summary

HNPSystem already holds a large amount of report-worthy operational data, but it has **no reporting platform** — only nine live-recompute role dashboards, one mature analytics module (`efficiency.js`), and one well-designed but under-used audit table (`audit_log`). The audit identified five structural blockers: (1) no status-history except for jobs, (2) no database reporting layer (no views/rollups/snapshots/triggers), (3) no first-class department dimension, (4) no unified audit/event log, and (5) fragmented/duplicated models plus dual user identity.

This document designs a reporting platform that is **event-sourced where it matters, snapshot-driven for trends, and read-model-first for the UI**. The strategy is deliberately incremental and additive: it reuses the existing `audit_log`, `job_status_history`, `job_activity_events`, the role/permission system (`roles.js` / `withRoleGuard` / `ProtectedRoute`), the dashboard helper pattern (`src/lib/database/dashboard/*`), and the `LayerSurface`/`LayerTheme` design system — and layers a thin, consistent reporting fabric on top rather than rewriting subsystems.

The platform is delivered in five maturity stages (M0→M4), from "fix the numbers we already show" to "executive cross-department analytics with historical trends and exports." The core enablers, in dependency order, are: a **unified event spine**, a **generic status-history pattern**, a **department dimension**, and a **KPI snapshot/rollup layer**. Everything else (APIs, UI, exports, saved views) builds on those four foundations.

**Phase 1 (this document) produces the architecture only.** Implementation begins at Phase 2.

---

## 2. Reporting Vision

> _"Every department head, manager, and director can answer any reasonable operational or commercial question about the business from a single, consistent, trustworthy reporting surface — with numbers that match across screens, history they can trend, and detail they can drill into down to the individual record."_

Concretely the platform must let a user move fluidly along three axes:

- **Altitude:** Executive KPI → Management metric → Operational metric → individual record (drill-down) without leaving the reporting fabric.
- **Time:** any metric viewable as a point-in-time value, a trend over an arbitrary date range, and a historical comparison (this period vs last).
- **Scope:** company-wide → department → team → individual → single entity, governed by the user's role.

The reporting platform is a **read-side concern**. It never becomes the system of record; it observes the operational system through events, status-history, and snapshots, and presents derived read models.

---

## 3. Reporting Platform Goals

| # | Goal | Success signal |
|---|---|---|
| G1 | **Trustworthy numbers** | The same KPI shows the same value on every screen; no `.limit()` truncation or overlapping-`ILIKE` counts in any reported figure. |
| G2 | **Historical trends** | Any KPI can be trended over an arbitrary date range, not just hardcoded "today/7 days". |
| G3 | **Department-aligned** | Every operational record can be attributed to a department; every department has an owned dashboard + drill-downs. |
| G4 | **Drill-down everywhere** | Every summary number is clickable down to the contributing records. |
| G5 | **Role-correct** | Reporting visibility integrates with the existing role system; users see only what their role permits. |
| G6 | **Event-sourced where it matters** | Cycle-time, dwell-time, and SLA metrics are derived from durable status-history/events, not reconstructed heuristically. |
| G7 | **Exportable** | Any table/report can be exported (CSV first, PDF later) with the active filters applied. |
| G8 | **Performant at scale** | Dashboards read pre-aggregated rollups, not live full-table scans; sub-second summary loads. |
| G9 | **Additive, low-risk** | Built by extending existing tables/helpers/components; minimal disruption to operational write paths. |
| G10 | **Auditable & secure** | Report access is itself auditable; sensitive (pay/financial/PII) data is permission-gated. |

---

## 4. Reporting Principles

1. **Read/write separation.** Reporting never mutates operational state. It consumes events, history, and snapshots and produces read models.
2. **Single source of truth per metric.** Each KPI has exactly one canonical definition (formula + source query) registered in a KPI catalog. No screen re-implements a metric.
3. **Event the truth, snapshot the trend, cache the read.** Durable events/history capture _what happened_; nightly snapshots/rollups capture _trends_; short-TTL caches serve _the UI_.
4. **Additive over destructive.** Prefer new tables/columns/helpers over rewrites. Existing operational write paths change as little as possible.
5. **Reuse the design system.** All reporting UI uses `LayerSurface`/`LayerTheme`, existing tokens, and existing role guards. No new card primitives, no new colour tokens.
6. **Department is a dimension, not a guess.** Attribution flows through a normalised department key, never free-text inference.
7. **Permission by role, enforced server-side.** The client never decides data visibility; `withRoleGuard` + row-level scoping decide it.
8. **Definitions are versioned.** KPI formulas, status maps, and snapshot logic are versioned so historical numbers remain explainable.
9. **Graceful degradation.** A missing rollup falls back to a (clearly-labelled) live computation; a missing source table yields an empty, non-erroring panel.
10. **Numbers carry provenance.** Every reported figure can state its source, as-of timestamp, and whether it is live or snapshotted.

---

## 5. Reporting Maturity Roadmap

| Stage | Name | Theme | Key deliverables |
|---|---|---|---|
| **M0** | _Current_ | Live-recompute dashboards | 9 role dashboards, `efficiency.js`, `/api/accounts`. Numbers sometimes wrong (truncation/overlap). |
| **M1** | **Trustworthy current-state** | Fix and standardise what exists | KPI catalog v1; correct the truncated/fuzzy helpers; standard reporting components; reporting API envelope; reporting permission layer. No new history yet. |
| **M2** | **Event & history spine** | Capture durable change | Unified `report_event` spine (built on `audit_log`/`job_activity_events`); generic `*_status_history` pattern for parts, VHC item, invoice, account, appointment, delivery. Cycle-time/dwell-time become possible. |
| **M3** | **Trends & rollups** | Historical analytics | `kpi_daily_snapshot` + rollup tables; scheduled aggregation (extend the cron pattern); date-range trends; department dimension live; saved views/filters. |
| **M4** | **Executive & cross-department** | Strategic reporting | Executive KPI suite; cross-department analytics; missing domain entities (`suppliers`, `mot_tests`, warranty claim tables, paint stage model); export (CSV→PDF); drill-down everywhere. |

Each stage is independently valuable and shippable. M1 raises trust without new infrastructure; M2/M3 add the durable foundations; M4 completes the enterprise picture.

---

## 6. Current-State Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  PAGES (Next.js Pages Router)                                     │
│  src/pages/dashboard/{role}/index.js  (9 role dashboards)         │
│  src/pages/{tracking,nextjobs,clocking,...}                       │
└───────────────┬─────────────────────────────────────────────────┘
                │ direct import (no API layer for most dashboards)
┌───────────────▼─────────────────────────────────────────────────┐
│  DASHBOARD HELPERS  src/lib/database/dashboard/*.js               │
│  admin.js accounts.js managers.js mot.js painting.js parts.js     │
│  service.js valeting.js workshop.js  +  utils.js (runQuery,       │
│  buildSevenDaySeries, severityFromText)                           │
│  efficiency.js  (mature analytics; allocated ÷ actual)            │
└───────────────┬─────────────────────────────────────────────────┘
                │ ad-hoc Supabase queries (live recompute every load)
┌───────────────▼─────────────────────────────────────────────────┐
│  SUPABASE (PostgreSQL)  ~80 base tables, 0 views, 0 rollups,      │
│  0 triggers, 1 unversioned RPC (get_job_timeline)                │
│  Durable history: job_status_history only                        │
│  Audit: audit_log (hash-chained, GDPR/login), job_activity_events │
│  Notifications: role-broadcast, read flag never updated           │
└─────────────────────────────────────────────────────────────────┘
```

**Characteristics (from the audit):**
- Reporting is **live-recompute** on each page load; no persistence of computed metrics.
- **No API tier** for most dashboards — pages import helpers directly. A few aggregation endpoints exist (`/api/accounts`, `/api/parts/summary`, `/api/hr/*`, `/api/customers/bookings/calendar`).
- **Data-quality defects** baked into helpers: `.limit(40)` truncated "totals", overlapping MOT `ILIKE` counts, Service RAG defaulting to amber, Admin mock branch + magic-number fallbacks.
- **Permissions inconsistent** — 7 of 9 dashboard pages lack a `ProtectedRoute` gate.
- **Realtime** used operationally (`StatusSidebar` subscribes to 11 tables) but not for analytics.

---

## 7. Target-State Architecture

```
                         ┌────────────────────────────────────────┐
                         │  REPORTING UI (read-side)               │
                         │  /reports/* + embedded dashboard panels │
                         │  Standard components: SummaryCard,       │
                         │  TrendChart, ReportTable, DrillDownDrawer│
                         │  (all on LayerSurface/LayerTheme)        │
                         └──────────────┬─────────────────────────┘
                                        │ fetch (envelope: data+meta+provenance)
                         ┌──────────────▼─────────────────────────┐
                         │  REPORTING API  src/pages/api/reports/* │
                         │  withRoleGuard + reporting scope filter │
                         │  /reports/kpi /reports/trend            │
                         │  /reports/table /reports/drilldown      │
                         │  /reports/export /reports/views         │
                         └──────────────┬─────────────────────────┘
                                        │
                         ┌──────────────▼─────────────────────────┐
                         │  REPORTING ENGINE  src/lib/reporting/*  │
                         │  kpiCatalog · queryBuilder · resolver   │
                         │  cache · permissionScope · provenance   │
                         └───┬───────────────┬──────────────┬──────┘
                  read model │        rollups │     fallback │ live
            ┌────────────────▼──┐ ┌───────────▼────┐ ┌───────▼─────────┐
            │ kpi_daily_snapshot│ │ report rollups │ │ existing helpers│
            │ (proposed)        │ │ (proposed)     │ │ dashboard/*.js  │
            └────────▲──────────┘ └───────▲────────┘ └───────▲─────────┘
                     │ nightly aggregation │                  │ live read
            ┌────────┴─────────────────────┴──────────────────┴────────┐
            │  EVENT & HISTORY SPINE                                     │
            │  report_event (proposed, fed by audit_log +               │
            │  job_activity_events) · *_status_history (proposed,       │
            │  generic) · job_status_history (existing)                 │
            └────────────────────────▲──────────────────────────────────┘
                                     │ emitted by operational write paths
            ┌────────────────────────┴──────────────────────────────────┐
            │  OPERATIONAL SYSTEM (unchanged system of record)          │
            │  ~80 base tables + dept dimension + new domain entities   │
            └───────────────────────────────────────────────────────────┘
```

**Layering rules:**
- The **UI** only ever talks to the **Reporting API** — never directly to helpers or Supabase.
- The **Reporting API** only ever talks to the **Reporting Engine**.
- The **Engine** chooses its source per request: snapshot/rollup (fast path) → live helper (fallback, labelled) — and always attaches provenance.
- The **Event & History spine** is written by operational code via thin emit helpers; the reporting side only reads it.

---

## 8. Reusable Inventory — Keep / Extend / Replace / Deprecate

### 8.1 Existing reusable data sources
| Source | Reuse verdict | Notes |
|---|---|---|
| `jobs` (lifecycle + ~20 milestone timestamps + actors) | **Keep** | The richest reportable entity; foundation of workshop/service/MOT/valet/paint reporting. |
| `job_status_history` | **Keep + extend** | The model template for the generic status-history pattern (M2). |
| `audit_log` (hash-chained) | **Keep + extend** | Becomes the compliance/financial audit feed into `report_event`. |
| `job_activity_events` | **Keep + extend** | Granular per-job action log; second feed into `report_event`. |
| `efficiency.js` | **Keep + wrap** | Mature analytics; wrap as a KPI-catalog provider rather than rewrite. |
| `account_transactions`, `invoices`, `invoice_payments` | **Keep** | Complete; basis of accounts KPIs. |
| `job_clocking`, `time_records`, `tech_efficiency_*` | **Keep + reconcile** | Canonicalise one as the labour source (see debt D5). |
| `vhc_checks`, `vhc_send_history`, `vhc_declinations` | **Keep + extend** | Add VHC item status-history (M2). |
| `parts_job_items`, `parts_stock_movements` | **Keep + extend** | Add parts status-history (M2); `parts_stock_movements` already a ledger. |

### 8.2 Existing reusable tables
Keep as canonical read sources: `jobs`, `job_requests`, `vhc_checks`, `parts_job_items`, `parts_catalog`, `parts_stock_movements`, `invoices`/`invoice_items`/`invoice_payments`, `accounts`/`account_transactions`, `job_clocking`, `time_records`, `tech_efficiency_entries`/`tech_efficiency_targets`, `payslips`, `hr_*`, `notifications`, `message_threads`/`message_thread_members`, `tracking_*`, `deliveries`/`delivery_stops`, `appointments`.

### 8.3 Existing reusable audit systems
- **`audit_log`** — hash-chained, tamper-evident, redacting, with `actor_user_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `diff`, `reason`, `ip_address`, `user_agent`, `request_id`. **This is the single best asset for the event spine.** Extend its usage (not its schema) to cover role changes, clocking edits, invoices/payments, deletes.
- **`job_status_history`** — genuine from→to transition log; the reference design for all status-history.
- **`job_activity_events`** — granular per-job activity feed.

### 8.4 Existing reusable event systems
- `notifications` table (role-broadcast, `job_number`/`target_role`/`created_at`) — reusable as an **operational event source** (when jobs hit key states), but needs per-user recipient rows for read-rate analytics.
- `notifyJobStatusChange.js` — existing status→notification emitter; the natural hook point to **also** emit a `report_event`.
- Cron pattern (`/api/cron/auto-clockout`, `overtime-recurring`, Bearer `CRON_SECRET`) — reuse for **scheduled aggregation**.
- Supabase realtime subscriptions (used by `StatusSidebar`) — reuse for live-updating reporting panels where desired.

### 8.5 Existing reusable APIs
| API | Reuse |
|---|---|
| `/api/accounts` (view=reports) | **Extend** — already computes AR/exposure/time-windowed balances; fold into reporting API as the accounts provider. |
| `/api/parts/summary` | **Extend** — exact open-parts counts by status; reuse as parts KPI provider. |
| `/api/hr/dashboard\|attendance\|operations` | **Extend** — HR KPI snapshots; remove mock fallbacks. |
| `/api/customers/bookings/calendar` | **Keep** — capacity RAG provider for service. |
| `/api/status/snapshot\|getHistory` | **Keep** — job timeline providers for drill-down. |
| `/api/cron/*` | **Extend** — add aggregation cron jobs alongside. |

### 8.6 Existing reusable dashboard components
| Component | Reuse |
|---|---|
| `LayerSurface` / `LayerTheme` / `Section` / `Card` | **Keep** — mandatory surface primitives for all reporting UI. |
| `DashboardPrimitives.js` (`MetricPill`, `formatCurrency`) | **Extend** — basis for `SummaryCard`. |
| `dashboard/utils.js` (`buildSevenDaySeries`, `runQuery`) | **Extend** — generalise `buildSevenDaySeries` into an arbitrary-range trend builder. |
| `StatusTimeline` / `JobTimeline` / `SmartSummaryBlock` | **Keep** — reuse for timeline drill-downs. |
| `ProtectedRoute` / `withRoleGuard` / `roles.js` | **Keep** — the permission backbone. |
| `usePolling`, `useJobsList` (SWR) | **Keep** — client refresh patterns for live panels. |

### 8.7 Keep / Extend / Replace / Deprecate summary
- **Keep unchanged:** `audit_log` schema, `job_status_history` schema, role system (`roles.js`, `roleGuard.js`, `ProtectedRoute`), design-system primitives, the cron+CRON_SECRET pattern, Supabase client/helper architecture.
- **Extend:** dashboard helpers (wrap behind KPI catalog), `efficiency.js`, `DashboardPrimitives`, `buildSevenDaySeries`, `audit_log` _usage_, notification emitters (also emit report events), aggregation APIs.
- **Replace:** the **direct page→helper coupling** (pages must go through the reporting API); the **fuzzy/truncated helper internals** (`.limit()` totals, overlapping MOT `ILIKE`, Service RAG default-amber) with correct counted queries; the **JSON-collapsed messaging read path** for analytics (parallel per-message analytics rows).
- **Deprecate:** `prisma/schema.prisma` (dead/stale — delete or quarantine), the Admin dashboard **mock/presentation branch** for real reporting, `DashboardClocking.js` (orphan) and `TechDashboard.js` (hardcoded `"Your Tech Name"`, broken), reliance on `getUserFromRequest.js` stub for any reporting attribution.

---

## 9. Cross-Cutting Architecture

### 9.1 Reporting Engine Architecture
`src/lib/reporting/` _(proposed)_ — the brain. Modules:
- **`kpiCatalog.js`** — the registry of every KPI: `{ id, label, department, tier, unit, format, sourceType: 'rollup'|'snapshot'|'live', resolver, formulaVersion, permission }`. Single definition per metric (Principle 2).
- **`resolver.js`** — given a KPI id + filter context, picks the source (rollup → snapshot → live fallback) and returns `{ value, asOf, provenance }`.
- **`queryBuilder.js`** — builds parameterised Supabase queries from a normalised filter object (date range, department, team, entity). Centralises correct counting (no `.limit()` for totals).
- **`trendBuilder.js`** — generalises `buildSevenDaySeries` to arbitrary ranges/granularity (day/week/month) reading from `kpi_daily_snapshot`.
- **`permissionScope.js`** — derives the row/column scope a user may see from their roles (see §9.3).
- **`cache.js`** — short-TTL read cache keyed by `(kpiId, filterHash, scopeHash)`.
- **`provenance.js`** — attaches source/as-of/live-vs-snapshot to every result (Principle 10).

The engine is **pure read**. It never writes. It is the only thing the reporting API calls.

### 9.2 Reporting Data-Flow Architecture
Two flows:

**Write-time (operational → durable):**
```
operational write (e.g. parts status change)
  → existing helper performs the update
  → helper calls emitStatusChange(entity, from, to, actor)   [thin, additive]
        → INSERT *_status_history row
        → INSERT report_event row (normalised)
  → (status→notification path also emits report_event)
```

**Aggregation-time (durable → read model):**
```
nightly cron (/api/cron/aggregate-kpis)
  → read events/history/base tables for the day
  → UPSERT kpi_daily_snapshot (one row per kpi × department × day)
  → UPSERT rollup tables (weekly/monthly)
```

**Read-time (read model → UI):**
```
UI panel → /api/reports/kpi?id=...&range=...&dept=...
  → withRoleGuard + permissionScope
  → engine.resolver → rollup/snapshot (or live fallback)
  → envelope { data, meta:{asOf,source,formulaVersion}, scope }
  → SummaryCard renders value + provenance tooltip
```

### 9.3 Reporting Permissions Architecture
Integrates with the existing role system (`roles.js`, `hasAnyRole`, `withRoleGuard`, `ProtectedRoute`). Three layers:
1. **Route gate** — `withRoleGuard({ allow: [...] })` on every `/api/reports/*` endpoint; `ProtectedRoute` on every `/reports/*` page.
2. **Scope filter** — `permissionScope.js` maps roles → visible scope:
   - **Operational role** (e.g. Techs, Parts, Valet) → own records / own department only.
   - **Department manager** (Service/Workshop/Parts/Accounts Manager) → their department, all members.
   - **Management** (`MANAGER_SCOPED_ROLES`, General Manager, Owner) → all departments.
   - **HR/Finance sensitive data** (pay, payslips, disciplinary) → `HR_CORE_ROLES` / Accounts only, regardless of department.
3. **Column gate** — sensitive columns (NI number, salary, home address) are stripped unless the role is in the sensitive allow-list.

A **reporting permission matrix** (KPI/report id × role → allow) lives in the KPI catalog (`permission` field) so visibility is declarative and auditable. (See §14 for the full model.)

### 9.4 Reporting API Architecture
`src/pages/api/reports/*` _(proposed)_. Standard envelope for **all** endpoints:
```json
{
  "data": { ... },
  "meta": { "asOf": "ISO", "source": "rollup|snapshot|live", "formulaVersion": "v1", "rangeApplied": {...} },
  "scope": { "departments": [...], "level": "self|department|all" },
  "warnings": [ "served from live fallback — rollup missing" ]
}
```
Endpoints:
- `GET /api/reports/kpi` — one or many KPI point values for a filter context.
- `GET /api/reports/trend` — time series for a KPI over a range/granularity.
- `GET /api/reports/table` — paginated tabular report (sortable, filterable).
- `GET /api/reports/drilldown` — contributing records for a KPI/cell.
- `GET /api/reports/timeline` — entity event timeline (reuses `/api/status/*`).
- `POST /api/reports/export` — async export job (CSV→PDF) with active filters.
- `GET/POST/PUT/DELETE /api/reports/views` — saved views/filters CRUD.
- `GET/PUT /api/reports/preferences` — per-user reporting preferences.

All endpoints accept a **normalised filter object** (date range, department, team, entity, status) so filtering is uniform (§9.9). All are date-range parameterised (no hardcoded windows).

### 9.5 Reporting UI Architecture
`src/components/reporting/*` _(proposed)_, all rendered on `LayerSurface`/`LayerTheme`, using existing tokens (no new colour tokens, no new card primitives). Component set = the Standard Reporting Model (§10): `SummaryCard`, `TrendChart`, `ReportTable`, `DrillDownDrawer`, `TimelinePanel`, `FilterBar`, `SavedViewMenu`, `ExportButton`. Two consumption modes:
- **Embedded** — individual panels dropped into existing role dashboards (M1).
- **Dedicated** — a `/reports` area with full report pages (M3/M4).

Responsive by default (desktop/tablet/mobile per CLAUDE.md §3.6); mobile uses stacked cards + collapsible filters.

### 9.6 Reporting Dashboard Architecture
A **dashboard** = an ordered collection of reporting panels for an audience. Three dashboard classes:
- **Operational dashboards** (per department, M1) — "what's happening now / today", live or short-TTL.
- **Management dashboards** (per department + cross-department, M3) — trends, targets, SLA attainment.
- **Executive dashboard** (M4) — company-wide KPI suite, cross-department comparison.

Dashboards are **composed from the KPI catalog**, not hand-coded per metric. A dashboard definition is `{ id, audience, panels: [{ kpiId|reportId, viz, size }] }`. The existing nine role dashboards are progressively re-pointed at this composition model.

### 9.7 Reporting KPI Architecture
Every KPI is a catalog entry (§9.1). Anatomy:
```
{
  id: 'workshop.labour_recovery_rate',
  label: 'Labour Recovery Rate',
  department: 'workshop',
  tier: 'management',                 // operational | management | executive
  unit: 'percent',
  format: '0.0%',
  sourceType: 'rollup',
  resolver: resolveLabourRecovery,    // pure fn(filter, scope) → value
  formulaVersion: 'v1',
  definition: 'sold hours ÷ clocked hours over range',
  dependsOn: ['job_requests.hours','job_clocking'],   // provenance
  permission: ['Workshop Manager','MANAGER_SCOPED_ROLES'],
  drilldown: 'workshop.labour_recovery.records'
}
```
KPIs reference **one canonical formula**; screens reference KPIs by id. Formula changes bump `formulaVersion` so historical snapshots remain explainable (Principle 8). Full KPI strategy in §13.

### 9.8 Reporting Drill-Down Architecture
Every summary value is **drillable**. A drill-down descriptor on each KPI points to a `report.table`/`report.records` query that returns the contributing rows. Pattern:
- Click a `SummaryCard` → opens `DrillDownDrawer` → calls `/api/reports/drilldown?kpi=...&filter=...` → returns the records that sum to the number, with row-level links to the source entity (job card, invoice, part line).
- A drill-down can itself contain a further drill-down (e.g. department total → technician → individual job).
- Timeline drill-downs reuse `/api/status/*` + `StatusTimeline`/`JobTimeline`.

### 9.9 Reporting Filtering Architecture
A single **normalised filter object** used by every endpoint and component:
```
{ dateRange:{from,to,preset?}, granularity:'day|week|month',
  department?, team?, user?, status?, entityType?, search?, compareTo? }
```
- `FilterBar` is the one UI for it; filters are URL-encoded (shareable) and feed saved views.
- `compareTo` enables period-over-period comparison.
- The engine validates filters against each KPI's allowed dimensions.

### 9.10 Reporting Caching Architecture
Three cache tiers:
1. **Read cache** (`cache.js`, in-process/short TTL ~30–60s) keyed by `(kpiId, filterHash, scopeHash)` — absorbs dashboard refresh storms. Mirrors the existing `queryCache.js` pattern.
2. **Snapshot/rollup tables** — the durable "cache" of historical aggregates (effectively infinite TTL, rebuilt by cron).
3. **Client SWR** (`useJobsList` pattern) — focus/interval revalidation with dedupe.
Invalidation: read cache is TTL-only; rollups are append/upsert by the nightly job; a manual "recompute" admin action can force a rollup rebuild for a date range.

### 9.11 Reporting Performance Architecture
- **Dashboards read rollups/snapshots, never full scans** (G8). Live fallback is the exception and is labelled.
- Counting uses exact count queries (`head:true, count:'exact'`), never `.limit()` as a total.
- Indexing plan _(design)_: every `*_status_history` and `report_event` table indexed on `(entity_type, entity_id, changed_at)` and `(occurred_at)`; `kpi_daily_snapshot` indexed on `(kpi_id, department, day)`.
- Heavy aggregation runs off-peak via cron; the read path stays O(rows-in-range-of-rollup).
- Pagination + server-side sort for all tables; export runs as an async job, not inline.

### 9.12 Reporting Security Architecture
- **Server-side enforcement only** — `withRoleGuard` + `permissionScope` decide data; the client never filters for security.
- **Sensitive-data gating** — pay/PII/financial columns stripped unless role-permitted (§9.3).
- **No reliance on the auth stub** — `getUserFromRequest.js` returns `{role:'Admin'}` unconditionally and must **not** be the identity source for reporting; use the NextAuth session (`getServerSession`). Dev role-bypass cookies must be disabled in production reporting paths.
- **Report access is itself audited** (§9.13).
- Exports of sensitive data require an explicit permission and are logged.

### 9.13 Reporting Audit Architecture
- **Report access logging** — every report/export request writes a row to `audit_log` (`action='report.view'|'report.export'`, `entity_type='report'`, `entity_id=reportId`, `actor_*`, filter in `diff`). Reuses the existing hash-chained table.
- **Operational audit coverage extension** — route the currently-unlogged high-value writes (role changes, clocking edits, invoices/payments, deletes) through `audit_log` so audit reports are complete (audit findings 7, 15, 16).
- This makes "who viewed/exported what, and who changed what" both reportable.

### 9.14 Reporting Event Architecture
The **event spine** = `report_event` _(proposed)_, a normalised append-only stream fed from existing systems (full strategy in §11). Schema _(design)_:
```
report_event(
  event_id bigserial,
  occurred_at timestamptz default now(),
  domain text,            -- workshop|parts|vhc|accounts|...
  entity_type text,
  entity_id text,
  event_type text,        -- status_changed|created|completed|...
  from_state text, to_state text,
  actor_user_id int,      -- canonical user id (see debt D4)
  actor_role text,
  department text,        -- denormalised at write time (the dept dimension)
  payload jsonb,
  source text             -- 'audit_log'|'job_activity_events'|'emit'
)
```
Fed by: (a) thin `emit*` helpers added to operational write paths, (b) a backfill/forward bridge from `audit_log` and `job_activity_events`, (c) the existing status→notification emitter. The reporting side reads only this stream + history tables.

### 9.15 Reporting Snapshot Architecture
`kpi_daily_snapshot` _(proposed)_ — one row per `(kpi_id, department, day)` holding the computed value + counts, written nightly. Purpose: make any KPI trendable over arbitrary ranges without re-scanning operational tables (G2). Snapshots are **immutable once written** except by an explicit recompute. Entity-state snapshots (e.g. open-parts-by-status at day's end) are also captured where point-in-time backlog matters.

### 9.16 Reporting Aggregation Architecture
- **Aggregation jobs** run as cron endpoints (extend `/api/cron/*`, Bearer `CRON_SECRET`). One job per domain or one orchestrator, scheduled off-peak.
- Each job reads the day's events/history/base rows, computes each KPI via its catalog resolver, and upserts `kpi_daily_snapshot`.
- Aggregation is **idempotent** (re-running a day overwrites that day's rows) so recompute is safe.
- Late-arriving events are handled by recomputing the affected day(s).

### 9.17 Reporting Rollup Architecture
- **Daily → weekly → monthly** rollups derived from `kpi_daily_snapshot` (`report_kpi_weekly`, `report_kpi_monthly` _(proposed)_).
- Rollups store both sums and the inputs needed for ratio KPIs (store numerator+denominator separately so weekly/monthly ratios are correct, not averages-of-averages).
- Rollups are the default read source for management/executive trends.

### 9.18 Reporting Retention Architecture
| Data class | Retention | Rationale |
|---|---|---|
| `report_event` (raw events) | 24 months hot, then archive | Enough for YoY; archive cold beyond. |
| `*_status_history` | Indefinite (operational truth) | Small, high-value; needed for any historical cycle-time. |
| `kpi_daily_snapshot` | Indefinite | Compact; the trend backbone. |
| Weekly/monthly rollups | Indefinite | Tiny. |
| Read cache | 30–60s TTL | Ephemeral. |
| Report-access audit (`audit_log`) | Per existing GDPR/audit retention policy | Compliance-governed. |
| Export files | Short-lived (e.g. 7 days), then purged | Avoid stale sensitive exports. |
Archival uses a cold table or object storage; PII in archived events follows the existing GDPR retention rules already enforced via `audit_log`.

---

## 10. Standard Reporting Model

A fixed vocabulary of report building blocks. Every report is assembled from these; nothing bespoke per metric.

| Block | Component | Source | Behaviour |
|---|---|---|---|
| **Summary card** | `SummaryCard` | `/reports/kpi` | Single value + delta vs compare period + provenance tooltip; clickable → drill-down. |
| **Trend** | `TrendChart` | `/reports/trend` | Line/bar over date range; day/week/month granularity; compare-to overlay. |
| **Table** | `ReportTable` | `/reports/table` | Paginated, server-sorted, filterable; row → entity link; export. |
| **Drill-down record** | `DrillDownDrawer` | `/reports/drilldown` | Contributing rows behind a number; nested drill allowed. |
| **Timeline view** | `TimelinePanel` | `/reports/timeline` (`/api/status/*`) | Entity event history (status/events) reusing `StatusTimeline`. |
| **Export** | `ExportButton` | `/reports/export` | CSV (M1/M3) → PDF (M4); applies active filters; logged. |
| **Saved filter** | `FilterBar` + `SavedViewMenu` | `/reports/views` | Named filter object, personal or shared. |
| **Saved view** | `SavedViewMenu` | `/reports/views` | A dashboard/report + its filter + layout, recallable. |
| **User preferences** | (settings) | `/reports/preferences` | Default department, default range, default dashboard, units, density. |

**Proposed persistence (design only):**
- `report_saved_view(view_id, owner_user_id, scope:'personal|shared', name, target_ref, filter jsonb, layout jsonb, created_at, updated_at)`
- `report_user_preferences(user_id, default_department, default_range, default_dashboard, density, units, updated_at)`

These reuse the established personal-preferences pattern already present (`user_personal_widgets`, `usePersonalDashboard`).

---

## 11. Event-Driven Reporting Strategy

**Principle:** reuse existing audit/activity systems before inventing new ones.

### Sources already emitting truth
- `audit_log` — compliance/login/PII/financial-ish events (hash-chained, with diff).
- `job_activity_events` — granular per-job actions (VHC decisions, file ops, parts links, checksheets).
- `job_status_history` — job status transitions.
- `notifyJobStatusChange.js` — job state → notification.
- Ledgers: `parts_stock_movements`, `account_transactions`, `invoice_payments`.

### Strategy
1. **Define `report_event`** as the normalised reporting stream (§9.14) — the one shape the reporting side reads.
2. **Bridge existing sources into it** rather than re-instrumenting everything: a forward bridge maps new `audit_log` / `job_activity_events` / `job_status_history` rows into `report_event` (denormalising the department + canonical actor). This means M2 gets immediate event coverage for everything those systems already log.
3. **Add thin `emit*` helpers** only where coverage is missing (parts status, VHC item status, invoice/payment lifecycle, clocking edits, deletes) — these write both the relevant `*_status_history` row **and** a `report_event`. They are added inside existing DB helpers so operational code calls one line.
4. **Backfill** historical `report_event` rows from existing `job_status_history` / `audit_log` / `account_transactions` where feasible, so trends have history from day one.
5. **Department stamped at write time** — every event carries the producing department (the dimension), resolved from the actor or entity, so department reporting needs no later inference.

This yields a single, queryable, department-tagged event stream that powers cycle-time, throughput, activity-volume, and audit reporting — built mostly on systems that already exist.

---

## 12. Status-History Strategy

**Goal:** make every reportable entity's state changes durable, so dwell-time / time-in-stage / ageing / SLA become possible (audit findings 2, 3, 5, 8, 11).

**Template:** `job_status_history` (already correct) is the reference. Generic pattern for each entity:
```
<entity>_status_history (proposed)
  history_id bigserial,
  entity_id  <type>,          -- FK to the entity
  from_status text,
  to_status   text,
  changed_by  int,            -- canonical user id (not free text — see debt D4)
  reason      text,
  changed_at  timestamptz default now(),
  department  text            -- denormalised dimension
```

**Rollout priority (M2), by reporting value:**
1. `parts_job_items_status_history` — unlocks parts cycle-time (ordered→ready→fitted), backlog ageing.
2. `vhc_item_status_history` — unlocks per-item VHC stage timing + re-authorisation audit (the VHC workflow is currently derived-on-read and never persisted).
3. `invoice_status_history` — Draft→Sent→Paid latency, AR ageing by transition.
4. `account_status_history` — freeze/close events with reason.
5. `appointment_status_history` and delivery status history — booking funnel + delivery SLA.

**Write mechanism:** the `emit*` helpers in §11.3, called from existing DB helpers at the point of each status update. **No DB triggers** (the codebase has none and maintains history in app code — keep that convention for consistency and testability), but every status-mutating helper MUST call the emit helper. A lint/check (mirroring `check:borders`) can enforce "status update without emit" over time.

**Derived-state caveat:** the VHC workflow status is computed by `vhcStatusEngine.js`. To get history, persist the **decision-level** transitions (the inputs the engine reads), not the derived projection — so history stays meaningful even if the projection logic evolves.

---

## 13. KPI Strategy

Three tiers, each a layer of the catalog. Lower tiers feed higher tiers.

### 13.1 Operational KPIs (today / now; operational roles + managers)
Real-time or short-TTL, single-department, action-oriented.
- Workshop: jobs in progress, checked-in today, completed today, technician availability, jobs-in-queue, outstanding VHCs.
- Parts: open parts by status, parts on order, pre-picked count, delayed orders, goods-in pending.
- Service: appointments today, waiting/loan/collection mix, VHCs awaiting approval, capacity RAG.
- MOT: tests today, pass/fail/retest (corrected), MOT-due pipeline.
- Valeting: cars waiting wash, washed today, in queue.
- Accounts: invoices raised/paid today, outstanding balances.

### 13.2 Management KPIs (trends / targets / SLA; department managers + management)
Period-based, target-relative, require history (M2/M3).
- Workshop: **labour recovery rate** (sold÷clocked), technician efficiency vs target, stage cycle-times, additional-work recovery rate, rework rate _(needs rework flag)_.
- Parts: supplier lead time & fill rate _(needs supplier entity)_, parts cycle-time, stock turn, VHC→parts conversion.
- Service: VHC conversion rate, upsell £ per advisor, send→decision latency, comms responsiveness.
- MOT: first-time pass rate _(needs retest linkage)_, per-tester pass rate, throughput trend.
- Accounts: AR ageing, DSO, revenue trend by account type, credit exposure, margin _(needs COGS)_.
- HR: attendance rate, training compliance, absence trend, overtime spend.

### 13.3 Executive KPIs (cross-department / strategic; management/owner)
Composite, company-wide, period-over-period (M4).
- Revenue by department & trend; gross margin by department.
- Total throughput (jobs/week) and capacity utilisation.
- Hours sold vs hours available vs hours clocked (whole-site recovery).
- VHC-driven upsell contribution to revenue.
- Customer responsiveness / NPS proxy from comms + outcomes.
- Cost-to-serve and department efficiency comparison.

**KPI governance:** every KPI has one catalog entry, one formula, a `formulaVersion`, an owning department, a permission set, and a drill-down target. New KPIs are added to the catalog, never inlined into a screen.

---

## 14. Reporting Permission Model

Built entirely on the existing role system; no parallel permission store for identity.

### 14.1 Visibility levels
| Level | Roles (from `roles.js` / `departmentDashboards.js`) | Sees |
|---|---|---|
| **Self** | operational roles (Techs, Parts, Valet Service, MOT Tester, Painters) | own records + own-department operational KPIs |
| **Department** | Service/Workshop/Parts/Accounts Managers, After-Sales | full department: members, trends, drill-downs |
| **Cross-department** | `MANAGER_SCOPED_ROLES`, General Manager | multiple/all departments |
| **Executive** | Owner, Admin Manager, Directors | everything incl. executive tier |
| **Sensitive (orthogonal)** | `HR_CORE_ROLES` (pay/PII), Accounts (financial detail) | pay, payslips, NI, disciplinary, full financial detail — regardless of department level |

### 14.2 Enforcement
- **Page:** `ProtectedRoute allowedRoles={...}` on every `/reports/*` page (fix: the 7 current dashboards missing guards).
- **API:** `withRoleGuard({ allow })` on every `/api/reports/*` route.
- **Scope:** `permissionScope.js` injects a mandatory WHERE (department/user) into every query based on the session's roles.
- **KPI-level:** each catalog entry's `permission` array gates whether the KPI is even offered to a role.
- **Column-level:** sensitive columns stripped server-side unless role-permitted.

### 14.3 Identity correctness
Reporting attribution MUST use the NextAuth session, **not** `getUserFromRequest.js` (stub returns Admin). The dual user-identity issue (int `users.user_id` vs uuid `auth.users.id`) is resolved by a canonical-id bridge (debt D4) before per-user reporting is trusted.

---

## 15. Reporting Navigation Model

Reporting appears in **two complementary places**:

### 15.1 Embedded (in existing dashboards) — M1 onward
Each role dashboard (`src/pages/dashboard/{role}`) gains a **standardised reporting strip** built from `SummaryCard`/`TrendChart` panels sourced from the KPI catalog. This replaces today's bespoke, sometimes-wrong inline numbers with catalog-backed, drillable panels — minimal disruption, immediate trust improvement.

### 15.2 Dedicated reporting area — M3 onward
A new top-level **Reports** section (added to `Sidebar.js` — a flagged global change) with:
```
/reports
  /reports/overview                 (executive summary; exec roles)
  /reports/workshop                 (dept dashboards + drill-downs)
  /reports/parts
  /reports/service
  /reports/mot
  /reports/valeting
  /reports/paint
  /reports/accounts
  /reports/hr                       (sensitive-gated)
  /reports/audit                    (who-did-what; manager/exec)
  /reports/views/:id                (a saved view)
```
- Sidebar surfaces only the report areas the user's role permits (driven by `permissionScope`).
- Within an area: department summary → trend → table → drill-down → entity timeline (the altitude axis, §2).
- Saved views and a global `FilterBar` persist across the area.

### 15.3 Entry points
- From any operational screen, a "View in reports" affordance deep-links to the relevant report with entity filter pre-applied.
- From a `SummaryCard`, click → drill-down drawer (in place) or "open full report" (to `/reports/...`).

---

## 16. Department Architecture

For each department: **ownership**, **KPIs**, **reporting requirements**, **summary dashboard**, **drill-down reports**, **future roadmap**. Departments per `departmentDashboards.js` (the canonical role→department map).

### 16.1 Workshop
- **Ownership:** `jobs` (`assigned_to`, `workshop_started_by`), `job_clocking`, `time_records`, `tech_efficiency_*`, `job_writeups`. Roles: Workshop Manager, Workshop Controller, Techs.
- **KPIs:** jobs in progress; completed/day; throughput/week; stage cycle-times; technician efficiency (allocated÷actual); **labour recovery rate** (sold÷clocked, M2); additional-work recovery; rework rate _(needs flag)_.
- **Reporting requirements:** per-technician and per-team productivity; utilisation vs capacity; time-in-stage; outstanding-VHC workload.
- **Summary dashboard:** WIP, completed-today, technician availability, efficiency-vs-target, throughput trend.
- **Drill-downs:** technician → their jobs → single job timeline; stage cycle-time → jobs breaching target; recovery → jobs where clocked≫sold.
- **Future roadmap:** idle-time tracking, capacity/available-hours model, rework/comeback flag, skills-based allocation analytics.

### 16.2 Parts
- **Ownership:** `parts_job_items` (`allocated_by`), `parts_requests`, `parts_stock_movements`, `parts_deliveries`, goods-in, consumables. Roles: Parts Manager, Parts, Parts Driver.
- **KPIs:** open parts by status; on-order count; pre-picked; delayed orders; parts spend; stock valuation; VHC→parts conversion; **parts cycle-time** & **supplier lead time/fill rate** (M2/M4 — needs history + supplier entity).
- **Reporting requirements:** dwell-time by status; supplier performance; stock turn; goods-in accuracy; returns/credit.
- **Summary dashboard:** open pipeline by status (corrected counts), on-order value, delayed orders, goods-in pending, reorder list.
- **Drill-downs:** status bucket → the part lines → source job/VHC; supplier → its deliveries → variance; backlog → ageing lines.
- **Future roadmap:** `suppliers` master + supplier_id FKs, per-line PO timestamps, reconcile `parts_requests` vs `parts_job_items`, link counter orders to revenue, returns reason codes.

### 16.3 Service Advisors
- **Ownership:** `jobs` bookings/check-in (`booked_by`, `checked_in_by`), `appointments`, `vhc_send_history`, customer statuses, messaging. Roles: Service Manager, Service.
- **KPIs:** appointments/day; capacity RAG; waiting/loan/collection mix; VHC send→decision latency; **VHC conversion rate**; **upsell £ per advisor**; comms responsiveness.
- **Reporting requirements:** advisor-level attribution; customer-communication backlog/responsiveness; conversion funnel.
- **Summary dashboard:** appointments today, waiting mix, VHCs awaiting approval, conversion this week.
- **Drill-downs:** advisor → their jobs/VHCs; awaiting-approval → the VHCs → customer thread; conversion → authorised vs declined items.
- **Future roadmap:** per-message analytics (un-collapse messaging), first-response-time SLA, advisor scorecards.

### 16.4 MOT
- **Ownership:** MOT-as-job (`jobs.type='MOT'`), `job_clocking.work_type='mot'`, MOT Tester role. **No MOT entity today.**
- **KPIs:** tests/day; pass/fail/retest (corrected, non-overlapping); MOT-due pipeline; tester labour; **first-time pass rate** & **per-tester pass rate** (M4 — needs `mot_tests`).
- **Reporting requirements:** reliable result attribution; advisory/defect analytics; retest linkage.
- **Summary dashboard:** tests today, pass/fail/retest, MOT-due-soon list.
- **Drill-downs:** result bucket → the MOT jobs; tester → their tests; due-soon → vehicles → customers.
- **Future roadmap:** **`mot_tests`** entity (result, tester_id, test_date, mileage, advisories, `retest_of`), advisory/defect rows, DVLA MOT-history ingestion.

### 16.5 Valeting
- **Ownership:** `jobs.wash_started_at` / `wash_completed_by` + `valetChecklist` JSONB; ETA signals derived. Roles: Valet Service.
- **KPIs:** cars waiting wash; washed/day; in queue; **wash duration & SLA** (needs completion timestamp); per-valet productivity.
- **Reporting requirements:** wash throughput, duration, assignee productivity, rework/quality.
- **Summary dashboard:** waiting, washed today, queue depth, queue trend.
- **Drill-downs:** queue → the cars → job; completer → their washes.
- **Future roadmap:** add **`wash_completed_at`** + wash assignee + checklist sub-items + quality/rework flag (the single highest-value valet fix).

### 16.6 Paint / Bodyshop
- **Ownership:** **no domain model** — bodyshop jobs inferred from `jobs.type ILIKE '%paint%' OR job_categories @> {bodyshop}`. Roles: Painters.
- **KPIs (today, weak):** paint job count, queue, days-in-queue, weekly completions.
- **KPIs (future):** stage progression (prep/spray/dry/buff), bay utilisation, painter productivity, first-pass quality, paint SLA, material usage.
- **Reporting requirements:** a real paint stage model is prerequisite to almost all meaningful KPIs.
- **Summary dashboard (interim):** count + simple queue (clearly labelled as limited).
- **Drill-downs:** queue → the bodyshop jobs.
- **Future roadmap:** **paint stage entity** (stage timestamps, painter_id, bay, paint code/material), then full craft analytics. _Least reportable; needs the most net-new modelling._

### 16.7 Accounts
- **Ownership:** `invoices`/items/payments, `accounts`, `account_transactions`, `company_accounts`, `payment_links/plans`, `payslips`. Roles: Accounts Manager, Accounts. **No staff-owner column on invoices** (attribution gap).
- **KPIs:** invoices raised/paid; outstanding balances; revenue by month/account-type; payment-status mix; credit exposure (≥80%); AR ageing/DSO; **gross margin** (M4 — needs COGS).
- **Reporting requirements:** AR ageing buckets, partial-payment balances, margin, audit trail on financial actions.
- **Summary dashboard:** AR/overdue, revenue this period, exposure, payment-status mix (extends existing `/api/accounts`).
- **Drill-downs:** overdue → the invoices → customer/account → transactions; account → ledger.
- **Future roadmap:** COGS on invoice lines, AR ageing buckets, **invoice/payment audit trail** (currently unlogged), freeze/cancel reasons, GL mapping, dunning.

### 16.8 Admin
- **Ownership:** `users`, system settings, news, cross-cutting config. Roles: Admin, Admin Manager.
- **KPIs:** user/account activity, system usage, report-access metrics, data-quality monitors (e.g. records missing department, unmapped statuses).
- **Reporting requirements:** report-access audit, data-quality dashboards, configuration oversight.
- **Summary dashboard:** active users, report usage, data-quality alerts. _(Replace the current mock/presentation branch.)_
- **Drill-downs:** report-access log; records failing data-quality checks.
- **Future roadmap:** data-quality monitoring suite, KPI-catalog admin, access-review reporting.

### 16.9 Management
- **Ownership:** cross-department oversight; consumes all departments. Roles: `MANAGER_SCOPED_ROLES`, General Manager, Owner, Directors.
- **KPIs:** executive suite (§13.3) — revenue/margin by department, throughput, site-wide recovery/utilisation, VHC upsell contribution, department efficiency comparison, SLA attainment.
- **Reporting requirements:** cross-department comparison; period-over-period; targets; exception/escalation visibility.
- **Summary dashboard:** executive overview — top KPIs across all departments with trend + target.
- **Drill-downs:** company KPI → department → team → individual → entity (the full altitude chain).
- **Future roadmap:** target/SLA framework, forecasting, board-level export packs (PDF), cost-to-serve.

---

## 17. Implementation Roadmap

Phases are dependency-ordered. Phase 1 = **this document** (design). Implementation starts at Phase 2.

| Phase | Name | Depends on | Delivers | Prereqs |
|---|---|---|---|---|
| **P1** | _Architecture (this doc)_ | audit | This master design | — |
| **P2** | Reporting foundations | P1 | Reporting engine skeleton (`src/lib/reporting/*`), KPI catalog v1, reporting API envelope, `permissionScope`, standard UI components (`SummaryCard`/`TrendChart`/`ReportTable`), report-access audit. | Agree KPI catalog v1; design-system sign-off. |
| **P3** | Trustworthy current-state (M1) | P2 | Re-point the 9 dashboards' numbers through the catalog; fix truncated/fuzzy helpers; add missing `ProtectedRoute` guards; embedded reporting strips. | Correct-counting queries verified. |
| **P4** | Event & history spine (M2) | P2 | `report_event`, bridge from `audit_log`/`job_activity_events`, generic `*_status_history` for parts→VHC→invoice→account→appointment→delivery, `emit*` helpers in DB helpers, backfill. | Canonical user-id bridge (D4); status-emit lint. |
| **P5** | Department dimension (M3a) | P4 | `departments` lookup, constrained `users.department` backfilled, department stamped on `report_event` + new history. | Resolve dept-vocabulary bug (D3). |
| **P6** | Snapshots, rollups & trends (M3b) | P4, P5 | `kpi_daily_snapshot`, weekly/monthly rollups, aggregation cron, date-range trends, saved views/filters, user prefs. | Aggregation idempotency tests. |
| **P7** | Missing domain entities (M4a) | P4 | `suppliers`, `mot_tests`(+advisories), deploy warranty claim tables, paint stage model, valet completion timestamp. | Per-entity mini-designs. |
| **P8** | Executive & exports (M4b) | P5, P6, P7 | Executive dashboard, cross-department analytics, drill-down everywhere, CSV→PDF export. | Exec KPI sign-off. |
| **P9** | Hardening & governance | P3–P8 | Data-quality monitors, status-emit enforcement check, performance tuning, retention/archival jobs, KPI-catalog admin. | — |

**Critical path:** P2 → P4 → (P5, P6) → P8. P3 is a quick parallel win after P2. P7 unblocks the low-readiness departments (MOT/Paint/Warranty) and can run in parallel once P4 exists.

**Build-order rationale:** foundations (engine + catalog) first so nothing is hand-coded; then durable capture (events/history) before trends (you cannot trend what you never recorded); department dimension before cross-department analytics; missing entities before their KPIs; executive/export last because they compose everything below.

---

## 18. Architecture Decisions (ADRs)

- **ADR-1: Read/write separation; reporting is a read-side fabric.** Operational tables stay the system of record. _Why:_ minimises risk to live workflows; aligns with Principle 1.
- **ADR-2: Reuse `audit_log` as the event backbone, don't build a new audit engine.** It is already hash-chained, redacting, and well-designed. _Why:_ avoids duplicate audit systems; closes coverage gaps by usage, not rewrite.
- **ADR-3: App-emitted history, no DB triggers.** Maintain `*_status_history` via emit helpers in DB helpers, matching the existing convention (the codebase has zero triggers). _Why:_ testability, consistency, version-control of logic; enforce via a lint check like `check:borders`.
- **ADR-4: KPI catalog as single source of metric truth.** Every metric defined once; screens reference by id. _Why:_ kills the "same number, different value" problem (G1).
- **ADR-5: Snapshot+rollup for trends; live only as labelled fallback.** _Why:_ performance (G8) and consistency; avoids `.limit()`/scan pitfalls.
- **ADR-6: Department is a stored dimension stamped at event-write time.** _Why:_ eliminates fragile post-hoc inference; the only reliable path to department reporting given no operational dept columns today.
- **ADR-7: Permissions via existing role system + server-side scope.** No parallel identity/permission store. _Why:_ one source of access truth; reuses `roles.js`/`withRoleGuard`/`ProtectedRoute`.
- **ADR-8: NextAuth session is the reporting identity; `getUserFromRequest.js` is excluded.** _Why:_ the stub returns Admin unconditionally — unsafe for attribution.
- **ADR-9: Additive schema changes only; deprecate Prisma.** New tables/columns; never destructive migrations on operational tables in the reporting workstream. _Why:_ Principle 4; Prisma is dead/stale.
- **ADR-10: Versioned KPI formulas and snapshot logic.** _Why:_ historical numbers must remain explainable when definitions evolve.

---

## 19. Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | **Emit helpers missed on some write paths** → incomplete history | Silent gaps in cycle-time/audit | Status-emit lint check (ADR-3); code review gate; backfill where possible. |
| R2 | **Dual user identity** (int vs uuid) corrupts per-user attribution | Wrong "who did it" | Canonical-id bridge (D4) before per-user KPIs are trusted; block those KPIs until resolved. |
| R3 | **Free-text statuses drift** (`authorized`/`authorised`, casing/typos) | Fragmented GROUP BY | Normalise via status-map layer in the engine; CHECK constraints during P7. |
| R4 | **Department vocabulary mismatch** (`roleCategories` vs real depts) | Mis-attributed reporting | Fix in P5 before any department rollup; backfill with the canonical map. |
| R5 | **Auth stub / dev bypass leaks into reporting** | Security/attribution failure | ADR-8; disable bypass in prod reporting; audit access. |
| R6 | **Aggregation cost / late events** | Wrong or slow trends | Idempotent recompute; off-peak scheduling; affected-day reprocessing. |
| R7 | **Scope creep into rewriting operational subsystems** | Delays, instability | Strict additive principle (ADR-9); reporting never refactors write paths beyond adding emits. |
| R8 | **Denormalised totals disagree with line items** (invoices/accounts.balance) | Financial reports mismatch | Report from line items where possible; flag denormalised sources in provenance. |
| R9 | **Messaging analytics blocked by JSON-collapsed storage** | No comms KPIs | Parallel per-message analytics rows (P7), don't unpick operational storage. |
| R10 | **Schema drift** (audit/HR tables absent from `schemaReference.sql`) | Tooling misses tables | Reconcile schema ref + add migrations in P9; treat live DB as truth meanwhile. |

---

## 20. Technical Debt Discovered (from the audit)

| ID | Debt | Where | Reporting impact |
|---|---|---|---|
| D1 | Dead Prisma schema (7 stale models) | `prisma/schema.prisma` | Misleads tooling; deprecate. |
| D2 | Schema reference stale (8+ live tables absent: `audit_log`, `activity_logs`, `job_activity_events`, `auth_login_attempts`, `website_activity`, `payslips`, …) | `schemaReference.sql` | Reporting built off the doc misses audit data. |
| D3 | Department field populated with wrong vocabulary (`Retail/Sales/...` vs real depts) | `AdminUserForm.js`, `users.department` | Blocks department reporting until fixed. |
| D4 | Dual user identity (int `users.user_id` vs uuid `auth.users.id`) | `parts_catalog`, `parts_job_items.allocated_by`, `parts_stock_movements.performed_by` | Fractures per-user attribution. |
| D5 | Three overlapping clocking models with differing duration formulas | `time_records`, `job_clocking`, `tech_efficiency_entries` | Labour KPIs need a canonical source. |
| D6 | Two parts-request models | `parts_requests` vs `parts_job_items` | Reconciliation needed for parts reporting. |
| D7 | Multiple delivery table families | `deliveries`/`delivery_stops`, `parts_delivery_jobs`, `parts_deliveries`/runs | Pick canonical before delivery reports. |
| D8 | Fuzzy/truncated dashboard helpers | `.limit(40)` totals, MOT overlapping `ILIKE`, Service default-amber, Admin mock | Wrong numbers today; fix in P3. |
| D9 | Auth stub returns Admin unconditionally | `getUserFromRequest.js` | Unsafe attribution; exclude from reporting. |
| D10 | Notifications: `read` never updated; role-broadcast, no recipient rows | `notifications` | No read/delivery analytics. |
| D11 | Messaging collapsed into JSON per thread | `messages.metadata._conversation` | No per-message analytics. |
| D12 | Denormalised totals without triggers | `invoices` (7 totals), `accounts.balance` | Possible mismatch with line items. |
| D13 | Unversioned RPC | `get_job_timeline` (not in repo) | Canonical timeline logic not source-controlled. |
| D14 | Orphan/broken dashboard components | `DashboardClocking.js`, `TechDashboard.js` (`"Your Tech Name"`) | Deprecate. |

---

## 21. Data-Model Issues Requiring Future Remediation

1. **Introduce a `departments` lookup + constrain `users.department`** (enum of the 9 real departments) and backfill with the canonical role→department map. (D3)
2. **Canonical user identity bridge** — a single id space (or a mapping view) reconciling int `users.user_id` and uuid `auth.users.id`. (D4)
3. **CHECK-constrain free-text statuses** — `jobs.status`, `job_requests.status`, `invoices.payment_status`, HR statuses, MOT `completion_status`; collapse `authorized`/`authorised`. (R3)
4. **Add missing domain entities** — `suppliers`, `mot_tests`(+advisories), deploy `warranty_claims`/`warranty_requests`, a paint stage model, and a valet `wash_completed_at` (+assignee). (P7)
5. **Reconcile duplicated models** — pick canonical for clocking (D5), parts requests (D6), deliveries (D7); the others become views/aliases.
6. **FK-ify actor columns** — replace free-text `changed_by`/`approved_by`/`created_by` with canonical user FKs (or a resolved actor view). (D4)
7. **Trigger or app-maintained integrity for denormalised totals** — or report from line items and flag the denormalised columns. (D12)
8. **Reconcile `schemaReference.sql`** with the live DB and add migrations for the audit/HR tables. (D2)
9. **Per-user notification recipients + read/delivered timestamps**, and **per-message analytics rows** for messaging. (D10, D11)
10. **Source-control `get_job_timeline`** (and any other live-only DB logic). (D13)

> All remediation is **additive and reporting-driven**; none requires destructive changes to operational write paths. Sequence them as prerequisites to the phases that need them (see §17).

---

## 22. Recommended Implementation Sequence

1. **Agree KPI catalog v1** (the metric contract) and get design-system sign-off for the standard components. _(blocks everything)_
2. **P2 — Reporting foundations:** engine skeleton, catalog, API envelope, `permissionScope`, `SummaryCard`/`TrendChart`/`ReportTable`, report-access audit.
3. **P3 — Trustworthy current-state:** re-point existing dashboards through the catalog, fix D8 helpers, add `ProtectedRoute` guards. _(fast trust win)_
4. **D4 canonical-id bridge** + **D3 department fix** _(prerequisites for durable, attributed history)_.
5. **P4 — Event & history spine:** `report_event` + bridge + generic `*_status_history` (parts→VHC→invoice→account→appointment→delivery) + emit helpers + backfill.
6. **P5 — Department dimension** live across events/history.
7. **P6 — Snapshots/rollups/trends** + saved views/filters/prefs.
8. **P7 — Missing domain entities** (suppliers, mot_tests, warranty tables, paint stages, valet timestamp) — unblocks low-readiness departments; parallelisable after P4.
9. **P8 — Executive dashboard + cross-department analytics + export.**
10. **P9 — Hardening:** data-quality monitors, status-emit enforcement check, retention/archival, performance tuning, schema-ref reconciliation (D2).

---

## 23. Success Criteria for Phase 1 Completion

Phase 1 (this design) is complete when:

- [x] A single master architecture document exists in the repo (`docs/reporting-platform-architecture.md`) and is the agreed source of truth.
- [x] The design is **traceable to the audit** — every major decision references a concrete finding in `reporting-readiness-audit.md`.
- [x] **All requested architecture sections are defined** (engine, data-flow, permissions, API, UI, dashboard, KPI, drill-down, export, filtering, caching, performance, security, audit, event, snapshot, aggregation, rollup, retention).
- [x] **All nine departments** have ownership, KPIs, reporting requirements, summary dashboard, drill-downs, and a future roadmap.
- [x] The **reuse inventory** (data sources, tables, audit systems, event systems, APIs, components) is catalogued with keep/extend/replace/deprecate verdicts.
- [x] A **standard reporting model** (cards, trends, tables, drill-downs, timelines, exports, saved filters/views, preferences) is specified.
- [x] **Event-driven, status-history, KPI, permission, and navigation** strategies are each fully designed.
- [x] A **phased implementation roadmap** with dependencies, prerequisites, and build order is defined.
- [x] **Architecture decisions, risks, technical debt, data-model remediation, recommended sequence, and Phase-1 success criteria** are recorded.
- [x] **No code, reports, or migrations were created** — design only.

**Definition of "ready for Phase 2":** stakeholders ratify the KPI catalog v1 scope and the §17 roadmap; the design-system owner signs off the standard reporting components; the four foundational enablers (event spine, status-history pattern, department dimension, snapshot/rollup layer) are accepted as the build backbone.

---

*End of Phase 1 architecture. No code, reports, or database migrations have been created. Implementation begins at Phase 2.*
