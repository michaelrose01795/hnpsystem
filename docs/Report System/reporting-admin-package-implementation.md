# HNPSystem — Admin Reporting Package Implementation (Phase 13)

> **Status:** Implemented. Phase 13 = the **eighth report package** built on the shared reporting
> foundation after Workshop, Parts, Accounts, Service Advisor, MOT, Valeting and Paint. This phase builds
> **Admin reporting only**. No Management reports were built. Workshop, Parts, Accounts, Service Advisor,
> MOT, Valeting and Paint reporting were not modified except for the shared KPI registry and Reports
> navigation extension required to expose the Admin package.

---

## 0. Executive Summary

Phase 13 ships the Admin report package on the existing `/api/reports/*` platform, with security, audit and
compliance information tightly permission-gated:

1. `src/lib/reporting/kpiDefinitions/admin.js` registers the Phase-3 §13 Admin KPI catalogue entries
   (`adm.*`). Live resolvers were added for the R1 set (`adm.login_success_rate`, `adm.login_failures`,
   `adm.audit_activity`, `adm.compliance`) plus audit-backed proxy resolvers for the R2 ids that already
   have a usable signal today (`adm.report_usage`, `adm.user_activity`, `adm.data_quality`).
   `adm.role_changes` is **declared** (no resolver) because role writes are unlogged.
2. `src/pages/reports/admin.js` and `src/components/reporting/admin/` add Admin Overview, User & Access,
   Audit & Compliance, Data Quality & System, and Reporting Utilities tabs.
3. Saved views, CSV exports, filters, drill-downs, permission scope and audit logging reuse the existing
   reporting APIs, hooks and UI components — **no separate admin reporting system** was created.
4. Every Admin KPI carries `ADMIN_REPORT_PERMISSION`, so the engine's per-KPI permission gate restricts the
   data to Admin-manager / Management / Executive scope. Operational department users — including operational
   admin/reception staff and operational department managers — never see it.

The package consumes the shared platform end-to-end: KPI framework (`kpiCatalog`/`defineKpi`), reporting APIs
(`/api/reports/kpi|trend|drilldown|export|views`), reporting hooks (`useReporting`), permission framework
(`permissionScope`), snapshot/trend framework (`resolver`/`trendBuilder`), drill-down framework (`drilldown`),
export framework (`export`), saved-views framework (`savedViews`) and the reporting UI framework
(`KpiScorecardStrip`, `KpiPanel`, `KpiValueCard`, `KpiTrendChart`, `ReportDrilldownTable`, `ReportFilterBar`,
`SavedViewsBar`, `ReportSection`, `ProvenanceFooter`).

---

## 1. Admin KPIs Implemented

All formulas are taken **verbatim** from the KPI Catalogue (§13). No formula, calculation or KPI id was invented;
sub-signals (security events, sensitive actions, system activity, validation issues) are surfaced as resolver
**breakdown facets** of the catalogue KPIs, never as new KPI ids.

### Operational now (R1 — sources exist today)

| KPI | Readiness | Formula (catalogue §13) | Source |
|---|---|---|---|
| `adm.login_success_rate` | R1 | `COUNT(login success) ÷ COUNT(attempts) × 100` | `auth_login_attempts` |
| `adm.login_failures` | R1 | `COUNT(login failures)` by reason/user/IP | `auth_login_attempts` |
| `adm.audit_activity` | R1 | `COUNT(audit_log rows)` by plane/action | `audit_log` |
| `adm.compliance` | R1 | consent coverage, SAR turnaround, retention adherence (audited event counts) | `audit_log` (GDPR actions) |

### Operational now via audit-backed proxy (R2 catalogue id, live signal today, clearly flagged)

| KPI | Readiness | Implemented as | Flag |
|---|---|---|---|
| `adm.report_usage` | R2 | `COUNT(audit_log where entity_type='report')` — `report.view`/`report.export` rows written by the shared reporting audit backbone | Per-report breakdown sharpens with the `REPORT_VIEWED/EXPORTED` event spine. |
| `adm.user_activity` | R2 | distinct `audit_log.actor_user_id` + distinct authenticated `auth_login_attempts.user_id` | True "active users emitting events" needs the `report_event` spine. |
| `adm.data_quality` | R2 | live defect monitors: audit rows missing actor, login attempts missing user, out-of-model job status drift | Snapshot drift + department-ownership coverage stay declared until their monitors land. |

### Operational facets surfaced from resolver breakdowns (not new KPI ids)

| Facet | Source breakdown |
|---|---|
| User activity | `adm.user_activity.breakdown.{active_users,audited_actors,authenticated_users,audit_events}` |
| Login success rate / failures | `adm.login_success_rate.breakdown.*` / `adm.login_failures.breakdown.{total_failures,by_reason,distinct_failed_accounts,distinct_failed_ips}` |
| Security activity | `adm.audit_activity.breakdown.security_actions` |
| Sensitive action activity | `adm.audit_activity.breakdown.sensitive_actions` |
| Compliance metrics | `adm.compliance.breakdown.{consent_events,sar_requests,data_exports,retention_runs}` |
| Report access / export activity | `adm.report_usage.breakdown.{report_views,report_exports,distinct_users,distinct_reports}` |
| Reporting usage activity | `adm.audit_activity.breakdown.report_actions` + `adm.report_usage` |
| System / reporting validation issues | `adm.data_quality.breakdown.{missing_attribution,unresolved_actor_logins,status_drift,missing_department_ownership,status_drift_detail}` |
| Audit activity | `adm.audit_activity.breakdown.{audit_events,by_action,by_plane,distinct_actions}` |

---

## 2. Admin KPIs Blocked

| KPI | Readiness | Blocker |
|---|---|---|
| `adm.role_changes` | R2 | Role changes are **unlogged** (readiness-audit finding 15). Needs the `ROLE_CHANGED` event + a role-change `audit_log` action. **Declared** (no resolver) — no number is invented. |

Partial/declared facets inside otherwise-live KPIs:

| Facet | Readiness | Blocker |
|---|---|---|
| `adm.user_activity` full active-user set | R2 | Needs `report_event` distinct-actor accrual (proxy live today from audit + logins). |
| `adm.report_usage` per-report/department breakdown | R2 | Needs the `REPORT_VIEWED/EXPORTED` event spine (count + view/export split live today from `audit_log`). |
| `adm.data_quality` snapshot drift | R2 | Needs daily snapshot accrual + the data-quality monitor service (Phase-2 §13.3). |
| `adm.data_quality` department-ownership coverage | R2 | Reads `report_event.owner_department`; 0 until the event spine accrues. |
| `adm.compliance` rate forms (consent %, SAR turnaround days, retention adherence %) | R2 | Needs a request→fulfilment pairing and a population denominator; event counts are the trustworthy R1 view today. |

---

## 3. Remaining R2 Blockers

- **Event spine accrual (`report_event`).** Switching on `reporting_emit_enabled` unlocks: true `adm.user_activity`
  (distinct actors emitting events), richer `adm.report_usage` (per-report/per-department), and
  `adm.data_quality` department-ownership coverage.
- **Audit-logging closure.** `adm.role_changes` needs role writes to emit `ROLE_CHANGED` and fan out a
  role-change `audit_log` row. Same gap covers clocking edits and record deletes (readiness-audit finding 15).
- **Data-quality monitor service (Phase-2 §13.3).** Replaces the package's live point-checks with continuous
  monitors and adds snapshot-drift detection.
- **Daily snapshot accrual.** Moves Admin trend provenance from live fallback to snapshot-backed series, and
  enables forecast-readiness for login/audit/compliance volumes.

## 4. Remaining R3 Blockers

Admin has **no R3 catalogue KPIs** — every `adm.*` metric is R1 or R2. The only entity-level dependencies are the
cross-cutting ones the catalogue already tracks (the actor bridge `dim_actor` for richer per-user attribution),
not net-new Admin entities.

---

## 5. Observations

**Data quality.** `audit_log` is the strongest asset: hash-chained, tamper-evident, and already carrying
login, password, GDPR (consent/SAR/export/retention) and report-access actions. `auth_login_attempts` gives
trustworthy R1 login security. The leading defect is **missing attribution** (audit rows / login attempts with
no resolved actor) — surfaced directly by `adm.data_quality`. Role-change and clocking-edit gaps remain the
biggest honesty gap and are reported as blocked rather than proxied.

**Reporting performance.** The package uses the shared engine only. Login-attempt and report-access resolvers
do one bounded `fetchAllRows` scan per request and derive every facet in app code (the same one-scan pattern
the Paint resolver uses); these are modest, admin-owned tables. Bulk audit-activity uses paginated, single-column
`groupCount`/exact `countRows` so it stays cheap even as `audit_log` grows. Scorecards batch through
`/api/reports/kpi`; trends use the existing live fallback until snapshots accrue.

**Permissions & security.** Defence in depth: the page is gated by `ProtectedRoute` to Admin-manager /
Management / Executive roles, and **independently** every KPI carries `ADMIN_REPORT_PERMISSION` so the engine
refuses the data server-side even if the page were reached. Operational department managers (workshop/parts/
service) are intentionally excluded from the sensitive audit/security/compliance KPIs. Drill-downs deliberately
omit the `audit_log` hash chain and `diff` payload (which may carry sensitive before/after values) — only actor,
action, plane and timestamp are exposed.

**Audit.** Admin reporting is itself self-auditing: every view/export already writes a `report.view`/
`report.export` row to `audit_log` via the shared reporting audit backbone, which is exactly the signal
`adm.report_usage` reports on.

---

## 6. Recommended Next Phase

Phase 14 should implement the **Management (executive) reporting package** (`mgt.*`) — the ninth package —
composing the department KPIs now in place (company revenue, upsell contribution, site recovery, department
performance index), and in parallel:

1. Switch on `reporting_emit_enabled` so the `report_event` spine begins accruing — upgrading `adm.user_activity`,
   `adm.report_usage` and `adm.data_quality` from proxy to event-backed.
2. Emit `ROLE_CHANGED` (and a role-change `audit_log` action) to unblock `adm.role_changes`.
3. Stand up the data-quality monitor service (Phase-2 §13.3) for continuous drift detection + snapshot-drift.

---

## 7. Status at Completion

**Operational now:** `adm.login_success_rate`, `adm.login_failures`, `adm.audit_activity`, `adm.compliance`
(R1, fully live); `adm.report_usage`, `adm.user_activity`, `adm.data_quality` (R2, live audit-backed proxies);
plus all the breakdown facets in §1 (user activity, login success rate, login failures, security activity,
sensitive action activity, report access, export activity, reporting usage activity, compliance metrics,
audit activity, data-quality / validation issues).

**Dependent on future reporting phases (event-spine accrual):** full `adm.user_activity` active-user set,
per-report/per-department `adm.report_usage`, `adm.data_quality` department-ownership coverage.

**Requires event-spine accrual:** `adm.user_activity` (distinct actors emitting events), richer
`adm.report_usage` provenance, snapshot-backed Admin trends.

**Requires audit-logging improvements:** `adm.role_changes` (currently declared/unlogged); reliable
sensitive-action coverage for clocking edits and record deletes.

**Requires data-quality monitor improvements:** `adm.data_quality` snapshot drift and continuous monitoring
(the live point-checks for missing attribution, unresolved actor and status drift are operational now).

**Requires security-modelling improvements:** per-user audit attribution sharpens with the `dim_actor` bridge;
richer security analytics (geo/velocity on `adm.login_failures`) await dedicated security capture — none of which
blocks the R1 security view shipped here.

---

## 8. Validation

Run:

```bash
npm run validate:reporting
npm run check:report-events
npm run check:borders
npm run build
```

Observed during implementation:

- `npm run validate:reporting` passed: **36/36** (R1 KPIs all carry resolvers; every Admin `sourceEvents`
  references a real catalogue event; no Admin KPI declares a non-existent history table).
- `npm run check:report-events` passed with the existing `jobClocking.js` advisory (unchanged by this phase).
- `npm run check:borders` exits 0; the only violations reported are pre-existing global-stylesheet ones in
  `src/styles/*` — no Admin package file introduced a border violation.
- `npm run build` passed; `/reports/admin` is emitted as a static route alongside the other seven packages.
