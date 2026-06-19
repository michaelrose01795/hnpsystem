# HNPSystem - Valeting Reporting Package Implementation (Phase 11)

> **Status:** Implemented. Phase 11 = the **sixth report package** built on the shared reporting
> foundation after Workshop, Parts, Accounts, Service Advisor and MOT. This phase builds **Valeting
> reporting only**. No Management, Paint, Workshop, Parts, Accounts, Service Advisor or MOT report package
> changes were made except one small shared query-builder extension required for paginated JSON-backed
> Valeting resolvers.

---

## 0. Executive Summary

Phase 11 ships the Valeting report package on the existing `/api/reports/*` platform:

1. `src/lib/reporting/kpiDefinitions/valeting.js` registers the Phase-3 Valeting KPI catalogue entries.
   Live R1 resolvers were added for `val.cars_washed`, `val.completion_rate` and `val.skip_rate`.
2. `src/pages/reports/valeting.js` and `src/components/reporting/valeting/` add the Valeting Overview,
   Operations, Valeter Activity, Vehicle Preparation and Reporting Utilities tabs.
3. Saved views, CSV exports, drill-downs, filters, permission scope and audit logging reuse the existing
   reporting APIs and UI components.
4. Queue and demand facets requested for Phase 11 are exposed as `val.cars_washed` resolver breakdown
   fields, not as invented KPI ids.

---

## 1. Valeting KPIs Implemented

Operational now:

| KPI | Formula | Notes |
|---|---|---|
| `val.cars_washed` | `COUNT(washState=complete)` | Uses `maintenance_info.valetChecklist.washState=complete`, with `wash_completed_by` as a legacy completion signal when checklist state is absent. |
| `val.completion_rate` | `COUNT(complete) / COUNT(complete + no_wash) * 100` | Uses complete and no-wash checklist decisions. |
| `val.skip_rate` | `COUNT(no_wash) / COUNT(complete + no_wash) * 100` | Uses `washState=no_wash` decisions. |

Operational facets surfaced from `val.cars_washed.breakdown`:

| Facet | Status |
|---|---|
| Vehicles awaiting valet | Operational now, point-in-time queue facet. |
| Vehicles in valet | Operational now, point-in-time active-work facet. |
| Vehicles completed | Operational now, same source as `val.cars_washed`. |
| Valet volume | Operational now, same source as `val.cars_washed`. |
| Service wash volume | Operational now as existing-data demand split. |
| Sales preparation valet volume | Operational now as existing-data demand split. |
| Courtesy vehicle valet volume | Operational now as existing-data demand split. |
| Valet throughput | Operational now as completed volume per selected-period day. |
| Valet queue size | Operational now as awaiting plus in-valet queue facet. |

---

## 2. Valeting KPIs Blocked

| KPI | Readiness | Blocker |
|---|---|---|
| `val.queue_time` | R2 | Needs `WASH_QUEUED` / `WASH_STARTED` accrual and `wash_status_history`. |
| `val.avg_wash_time` | R3 | Needs `wash_completed_at`; current schema has `wash_started_at` only. |
| `val.sla` | R3 | Needs `wash_completed_at` plus SLA target modelling. |
| `val.valeter_productivity` | R3 | Needs wash assignee and shift attribution; current data only has optional `wash_completed_by`. |

---

## 3. Remaining R2 Blockers

- `wash_status_history` table and emit wiring for queued, started, completed and skipped states.
- Forward accrual of `WASH_QUEUED`, `WASH_STARTED`, `WASH_COMPLETED`, `WASH_SKIPPED` and
  `WASH_STATUS_CHANGED` events.
- Backfill strategy if historical queue-time trend is required before forward accrual matures.

## 4. Remaining R3 Blockers

- `jobs.wash_completed_at` or a dedicated wash entity completion timestamp.
- Wash assignee separate from completer, plus shift/attendance context for productivity.
- Checklist sub-items for service wash, sales preparation and courtesy preparation as typed fields rather
  than text/JSON signal inference.
- Quality/rework flags for first-pass valet quality reporting.

---

## 5. Observations

**Data quality:** The old Valeting dashboard helper counted only a limited page of jobs and treated
`wash_started_at` as washed. The new package uses paginated reporting reads and completion state from the
Valeting checklist, with a documented fallback to `wash_completed_by`.

**Performance:** Scorecards batch through `/api/reports/kpi`. Valeting JSONB inspection uses a paginated
shared query-builder helper with the existing maximum row guard. Trends use the existing live fallback until
snapshots accrue.

**Attribution:** Completed-row drill-down exposes `wash_completed_by` where present. This supports completer
activity visibility, but not final valeter productivity because the documented wash assignee and shift model
does not exist yet.

---

## 6. Recommended Next Phase

Phase 12 should implement Valeting workflow modelling improvements:

1. Add `wash_completed_at`, wash assignee and typed wash status transitions.
2. Add `wash_status_history` and Valeting emitters for queued, started, completed, skipped and status-changed.
3. Backfill current checklist states where safe.
4. Replace the current demand-split inference with typed valet work categories.

After that, `val.queue_time`, `val.avg_wash_time`, `val.sla` and `val.valeter_productivity` can become
operational without changing the Valeting UI package structure.

---

## 7. Status at Completion

**Operational now:** `val.cars_washed`, `val.completion_rate`, `val.skip_rate`, vehicles awaiting valet,
vehicles in valet, vehicles completed, valet volume, service wash volume, sales preparation valet volume,
courtesy vehicle valet volume, valet throughput and valet queue size.

**Dependent on future reporting phases:** average valet duration, wash SLA, queue-time analytics and final
valeter productivity.

**Requires status-history accrual:** `val.queue_time`, queue dwell trend, state transition analysis and
status-history-backed throughput.

**Requires valeter attribution improvements:** `val.valeter_productivity`, reliable valeter-level trends,
ranking and shift-normalised activity.

**Requires valet workflow modelling improvements:** `val.avg_wash_time`, `val.sla`, typed demand categories,
quality/rework reporting and robust queue lifecycle analytics.

---

## 8. Validation

Run:

```bash
npm run validate:reporting
npm run check:report-events
npm run check:borders
```

Expected: Valeting adds no separate reporting system and no duplicated reporting APIs. Remaining blocked KPIs
stay declared until their documented data prerequisites exist.
