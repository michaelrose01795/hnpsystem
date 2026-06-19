# HNPSystem - Paint Reporting Package Implementation (Phase 12)

> **Status:** Implemented. Phase 12 = the **seventh report package** built on the shared reporting
> foundation after Workshop, Parts, Accounts, Service Advisor, MOT and Valeting. This phase builds
> **Paint reporting only**. No Management reports were built. Workshop, Parts, Accounts, Service Advisor,
> MOT and Valeting reporting were not modified except for the shared KPI registry and Reports navigation
> extension required to expose the Paint package.

---

## 0. Executive Summary

Phase 12 ships the Paint report package on the existing `/api/reports/*` platform:

1. `src/lib/reporting/kpiDefinitions/paint.js` registers the Phase-3 Paint KPI catalogue entries.
   Live resolvers were added for `pnt.jobs_completed`, `pnt.queue` and the existing-data
   `pnt.cycle_time` proxy.
2. `src/pages/reports/paint.js` and `src/components/reporting/paint/` add Paint Overview, Paint
   Operations, Paint Workflow, Paint Workload and Reporting Utilities tabs.
3. Saved views, CSV exports, filters, drill-downs, permission scope and audit logging reuse the existing
   reporting APIs and UI components.
4. Paint jobs identified, throughput, workload and bodyshop demand are exposed as resolver breakdown
   facets, not invented KPI ids.

---

## 1. Paint KPIs Implemented

Operational now:

| KPI | Readiness | Formula | Notes |
|---|---|---|---|
| `pnt.jobs_completed` | R1 | `COUNT(jobs type~paint / category bodyshop, completed)` | Uses existing `jobs` type/category/text signals and `completed_at`. |
| `pnt.queue` | R1 | `COUNT(paint jobs not completed)` | Point-in-time Paint/bodyshop queue from existing job signals. |
| `pnt.cycle_time` | R2 proxy | `mean(completed_at - workshop_started_at) for paint jobs` | Implemented only where both existing job timestamps are present; stage-accurate cycle-time remains blocked. |

Operational facets surfaced from resolver breakdowns:

| Facet | Source |
|---|---|
| Paint jobs identified | `pnt.jobs_completed.breakdown.paint_jobs_identified` and `pnt.queue.breakdown.paint_jobs_identified` |
| Paint jobs completed | `pnt.jobs_completed` |
| Paint queue | `pnt.queue` |
| Paint throughput | `pnt.jobs_completed.breakdown.paint_throughput_per_day` |
| Paint workload | `pnt.queue.breakdown.paint_workload` |
| Bodyshop job volume / demand | `pnt.jobs_completed.breakdown.bodyshop_job_volume` and `pnt.queue.breakdown.bodyshop_job_demand` |
| Paint job drill-downs | `pnt.jobs_completed` and `pnt.cycle_time` drill-downs |
| Paint queue drill-downs | `pnt.queue` drill-down |

---

## 2. Paint KPIs Blocked

| KPI | Readiness | Blocker |
|---|---|---|
| `pnt.stage_duration` | R3 | Needs `paint_stage_history` with prep/spray/dry/buff/ready transitions. |
| `pnt.bay_utilisation` | R3 | Needs a paint bay entity and occupied/available-time capture. |
| `pnt.painter_productivity` | R3 | Needs painter assignment, stage clocking and shift/available-hour exposure. |
| `pnt.rework_rate` | R3 | Needs paint rework/defect flag and reason capture. |
| `pnt.material_usage` | R3 | Needs paint code/material usage capture and material cost model. |

---

## 3. Remaining R2 Blockers

- `job_status_history` accrual for robust historical whole-job cycle-time and released/completed transition
  timing.
- Forward accrual of coarse Paint lifecycle events (`PAINT_JOB_IDENTIFIED`, `PAINT_COMPLETED`) if Paint
  trend provenance is to move from live fallback to event-backed snapshots.
- Backfill strategy for historic Paint identification if old job category/type values need normalising.

## 4. Remaining R3 Blockers

- Dedicated Paint stage model: stage timestamp, painter id, bay id, paint code/material context.
- Paint bay/capacity model for utilisation.
- Painter assignment and shift/attendance exposure for productivity.
- Rework/defect/comeback flag with reason.
- Paint material usage and cost capture, with Parts/Accounts reconciliation where needed.

---

## 5. Observations

**Data quality:** Paint remains the lowest-readiness department. Existing data can identify coarse
Paint/bodyshop jobs from `jobs.type`, `job_categories`, `job_division`, request text and maintenance JSON,
but there is no authoritative Paint entity. The UI labels the current figures as coarse and keeps unsupported
stage metrics blocked.

**Performance:** The package uses the shared reporting engine. Paint resolvers use paginated
`fetchAllRows` because existing Paint identification depends on generic job/category/JSON signals. Scorecards
batch through `/api/reports/kpi`; trends use existing live fallback until snapshots accrue.

**Attribution:** Drill-down rows expose `assigned_to` where present. That supports job-level inspection only;
it is not treated as painter productivity because the documented painter assignment and shift model does not
exist.

---

## 6. Recommended Next Phase

Phase 13 should implement Paint workflow modelling:

1. Add a Paint stage entity/history table for identified, prep, spray, dry, buff, ready and completed.
2. Capture `painter_id`, `bay_id`, stage timestamps and Paint material usage.
3. Emit `PAINT_STAGE_CHANGED`, `PAINT_PAINTER_ASSIGNED`, `PAINT_MATERIAL_USED` and `PAINT_COMPLETED`.
4. Add rework/defect reason capture.
5. Backfill safe historic Paint jobs into the new model only where the source signal is trustworthy.

---

## 7. Status at Completion

**Operational now:** `pnt.jobs_completed`, `pnt.queue`, Paint jobs identified, Paint jobs completed, Paint
queue, Paint throughput, Paint workload, bodyshop job volume, Paint job drill-downs and Paint queue
drill-downs.

**Dependent on future reporting phases:** `pnt.stage_duration`, `pnt.bay_utilisation`,
`pnt.painter_productivity`, `pnt.rework_rate`, `pnt.material_usage` and stage-accurate cycle-time.

**Requires status-history accrual:** `pnt.cycle_time` robustness, status-transition-backed trend provenance,
and any future Paint dwell metrics that depend on job/paint transition history.

**Requires painter attribution improvements:** `pnt.painter_productivity`, painter-level ranking,
shift-normalised workload and reliable painter drill-downs.

**Requires paint workflow modelling improvements:** `pnt.stage_duration`, `pnt.bay_utilisation`,
stage queue visibility, blocked workflow KPIs and Paint SLA/bottleneck reporting.

**Requires paint stage modelling:** prep/spray/dry/buff/ready duration, bay utilisation, painter productivity,
material usage by stage and rework attribution.

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

- `npm run validate:reporting` passed: 36/36.
- `npm run check:report-events` passed with the existing `jobClocking.js` advisory.
- `npm run build` passed after rerunning outside the sandbox because the first attempt hit Windows `EPERM`
  writing `.next/trace-build`.
- `npm run check:borders` failed on pre-existing global stylesheet violations in `src/styles/*`; no Paint
  package files introduced new border violations.
