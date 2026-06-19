// file location: src/lib/reporting/kpiDefinitions/paint.js
//
// Paint / Bodyshop KPI definitions (Phase-3 section 11, promoted for the
// Phase-12 Paint report package). Paint has no dedicated domain model today, so
// R1 values are limited to catalogue-approved coarse job signals. Stage, bay,
// material, rework and true painter-productivity metrics remain declared until
// the paint stage model lands.

import { defineKpi } from "../kpiCatalog";
import { fetchAllRows } from "../queryBuilder";

const JOB_COLUMNS =
  "id,job_number,customer,vehicle_reg,vehicle_make_model,type,status,job_division,job_categories,requests,maintenance_info,created_at,checked_in_at,workshop_started_at,completed_at,assigned_to,completion_status,updated_at";

const round1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);

function toDate(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function inRange(value, filter) {
  const d = toDate(value);
  if (!d) return false;
  const from = toDate(filter?.dateRange?.from);
  const to = toDate(filter?.dateRange?.to);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function rangeDays(filter) {
  const from = toDate(filter?.dateRange?.from);
  const to = toDate(filter?.dateRange?.to);
  if (!from || !to) return 1;
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
}

function textBlob(row) {
  return [
    row?.type,
    row?.status,
    row?.job_division,
    ...(Array.isArray(row?.job_categories) ? row.job_categories : []),
    JSON.stringify(row?.requests || {}),
    JSON.stringify(row?.maintenance_info || {}),
  ]
    .join(" ")
    .toLowerCase();
}

function isPaintJob(row) {
  const text = textBlob(row);
  return text.includes("paint") || text.includes("bodyshop") || text.includes("body shop");
}

function isCompleted(row) {
  return Boolean(row?.completed_at);
}

function isOpenPaintJob(row) {
  if (isCompleted(row)) return false;
  const status = String(row?.status || "").toLowerCase().trim();
  if (!status) return true;
  if (["completed", "complete", "released", "cancelled", "cancelled/closed", "closed", "archived"].includes(status)) {
    return false;
  }
  return true;
}

function cycleHours(row) {
  const started = toDate(row?.workshop_started_at);
  const completed = toDate(row?.completed_at);
  if (!started || !completed || completed <= started) return null;
  return (completed.getTime() - started.getTime()) / 3600000;
}

function normaliseRow(row) {
  const hours = cycleHours(row);
  return {
    id: row.id,
    job_number: row.job_number,
    customer: row.customer,
    vehicle_reg: row.vehicle_reg,
    vehicle_make_model: row.vehicle_make_model,
    type: row.type,
    status: row.status,
    job_division: row.job_division,
    job_categories: Array.isArray(row.job_categories) ? row.job_categories.join(", ") : row.job_categories,
    created_at: row.created_at,
    checked_in_at: row.checked_in_at,
    workshop_started_at: row.workshop_started_at,
    completed_at: row.completed_at,
    assigned_to: row.assigned_to,
    cycle_time_hours: hours == null ? null : round1(hours),
  };
}

async function loadPaintRows() {
  const rows = await fetchAllRows(
    "jobs",
    JOB_COLUMNS,
    (q) => q,
    { orderBy: "created_at", ascending: false }
  );
  return rows.filter(isPaintJob);
}

async function aggregatePaint(filter) {
  const rows = await loadPaintRows();
  const identified = rows.filter((row) => inRange(row.created_at || row.checked_in_at, filter));
  const completed = rows.filter((row) => isCompleted(row) && inRange(row.completed_at, filter));
  const queue = rows.filter(isOpenPaintJob);
  const startedOpen = queue.filter((row) => Boolean(row.workshop_started_at));
  const notStartedOpen = queue.filter((row) => !row.workshop_started_at);
  const bodyshopJobs = rows.filter((row) => textBlob(row).includes("bodyshop") || textBlob(row).includes("body shop"));
  const cycleRows = completed
    .map((row) => ({ row, hours: cycleHours(row) }))
    .filter((item) => item.hours != null);

  const byStatus = queue.reduce((acc, row) => {
    const key = row.status == null || row.status === "" ? "unstatused" : String(row.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const byAssignee = queue.reduce((acc, row) => {
    const key = row.assigned_to == null ? "unattributed" : String(row.assigned_to);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const cycleTotal = cycleRows.reduce((sum, item) => sum + item.hours, 0);

  return {
    rows,
    identified,
    completed,
    queue,
    startedOpen,
    notStartedOpen,
    bodyshopJobs,
    cycleRows,
    byStatus,
    byAssignee,
    days: rangeDays(filter),
    meanCycleHours: cycleRows.length > 0 ? round1(cycleTotal / cycleRows.length) : null,
  };
}

export const paintKpis = [
  defineKpi({
    id: "pnt.jobs_completed",
    label: "Paint Jobs Completed",
    department: "paint",
    relatedDepartments: ["workshop", "valeting"],
    description: "Paint/bodyshop jobs completed in the selected period.",
    purpose: "Headline Paint throughput and completed-work volume.",
    formula: "COUNT(jobs type~paint / category bodyshop, completed)",
    sourceTables: ["jobs"],
    sourceEvents: ["PAINT_COMPLETED"],
    tier: "operational",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    format: "0,0",
    targetType: "higher_is_better",
    futureNotes:
      "Coarse R1 signal from jobs.type / job_categories / job text because no paint entity exists. Replaces any truncated bodyshop helper count.",
    drilldown: async ({ filter }) => {
      const out = await aggregatePaint(filter);
      return out.completed.map(normaliseRow);
    },
    resolver: async ({ filter }) => {
      const out = await aggregatePaint(filter);
      return {
        value: out.completed.length,
        count: out.completed.length,
        breakdown: {
          paint_jobs_completed: out.completed.length,
          paint_jobs_identified: out.identified.length,
          paint_throughput_per_day: round1(out.completed.length / out.days),
          bodyshop_job_volume: out.bodyshopJobs.filter((row) => inRange(row.created_at || row.checked_in_at, filter)).length,
          paint_cycle_time_proxy_hours: out.meanCycleHours,
          cycle_time_sample_size: out.cycleRows.length,
        },
      };
    },
  }),

  defineKpi({
    id: "pnt.queue",
    label: "Paint Queue",
    department: "paint",
    relatedDepartments: ["workshop", "service"],
    description: "Paint/bodyshop jobs not completed.",
    purpose: "Current Paint queue and workload visibility.",
    formula: "COUNT(paint jobs not completed)",
    sourceTables: ["jobs"],
    sourceEvents: ["PAINT_JOB_IDENTIFIED"],
    snapshotSource: "report_entity_state_snapshot",
    tier: "operational",
    readiness: "R1",
    aggregation: "point_in_time",
    unit: "count",
    format: "0,0",
    targetType: "informational",
    futureNotes:
      "Point-in-time queue from existing job signals only. Stage queue precision requires the paint stage model.",
    drilldown: async ({ filter }) => {
      const out = await aggregatePaint(filter);
      return out.queue.map(normaliseRow);
    },
    resolver: async ({ filter }) => {
      const out = await aggregatePaint(filter);
      return {
        value: out.queue.length,
        count: out.queue.length,
        breakdown: {
          paint_queue: out.queue.length,
          paint_workload: out.queue.length,
          paint_jobs_identified: out.identified.length,
          bodyshop_job_demand: out.bodyshopJobs.length,
          open_started_jobs: out.startedOpen.length,
          open_not_started_jobs: out.notStartedOpen.length,
          attributed_jobs: Object.keys(out.byAssignee).filter((k) => k !== "unattributed").length,
          unattributed_jobs: out.byAssignee.unattributed || 0,
          status_mix: out.byStatus,
          assignment_mix: out.byAssignee,
        },
      };
    },
  }),

  defineKpi({
    id: "pnt.cycle_time",
    label: "Paint Cycle Time",
    department: "paint",
    relatedDepartments: ["workshop"],
    description: "Mean elapsed time from workshop start to completion for completed Paint jobs.",
    purpose: "Whole-job Paint cycle-time proxy until the paint stage model exists.",
    formula: "mean(completed_at - workshop_started_at) for paint jobs",
    numerator: "SUM(completed_at - workshop_started_at)",
    denominator: "COUNT(completed paint jobs with both timestamps)",
    sourceTables: ["jobs"],
    sourceHistories: ["job_status_history"],
    sourceEvents: ["PAINT_COMPLETED", "JOB_STARTED"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "duration",
    unit: "hours",
    format: "0.0",
    targetType: "lower_is_better",
    futureNotes:
      "R2 proxy from existing job milestones. Stage-accurate cycle-time requires paint_stage_history; historical robustness improves as job_status_history accrues.",
    drilldown: async ({ filter }) => {
      const out = await aggregatePaint(filter);
      return out.cycleRows.map((item) => normaliseRow(item.row));
    },
    resolver: async ({ filter }) => {
      const out = await aggregatePaint(filter);
      return {
        value: out.meanCycleHours,
        numerator: out.cycleRows.reduce((sum, item) => sum + item.hours, 0),
        denominator: out.cycleRows.length,
        count: out.cycleRows.length,
        breakdown: {
          mean_cycle_time_hours: out.meanCycleHours,
          sample_size: out.cycleRows.length,
          completed_paint_jobs: out.completed.length,
        },
      };
    },
  }),

  defineKpi({
    id: "pnt.stage_duration",
    label: "Paint Stage Duration",
    department: "paint",
    description: "Dwell per Paint stage (prep, spray, dry, buff, ready).",
    formula: "dwell per stage (prep/spray/dry/buff/ready)",
    sourceTables: ["paint_stage_history"],
    sourceEvents: ["PAINT_STAGE_CHANGED"],
    tier: "tactical",
    readiness: "R3",
    aggregation: "duration",
    unit: "duration",
    format: "0.0",
    targetType: "lower_is_better",
    futureNotes: "R3 - blocked because no paint stage model or paint_stage_history exists.",
  }),
  defineKpi({
    id: "pnt.bay_utilisation",
    label: "Bay Utilisation",
    department: "paint",
    description: "Paint bay occupied time against available time.",
    formula: "bay occupied / available",
    sourceTables: ["paint_stage_history"],
    sourceEvents: ["PAINT_STAGE_CHANGED"],
    tier: "tactical",
    readiness: "R3",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "band",
    futureNotes: "R3 - no bay entity or occupied-time capture exists.",
  }),
  defineKpi({
    id: "pnt.painter_productivity",
    label: "Painter Productivity",
    department: "paint",
    description: "Jobs/hours per painter.",
    formula: "jobs/hours per painter",
    sourceTables: ["paint_stage_history"],
    sourceEvents: ["PAINT_PAINTER_ASSIGNED", "PAINT_COMPLETED"],
    tier: "tactical",
    readiness: "R3",
    aggregation: "ratio",
    unit: "count",
    format: "0.0",
    targetType: "higher_is_better",
    futureNotes:
      "R3 - no painter assignment, paint-stage clocking or shift exposure model exists. Existing jobs.assigned_to is exposed in drill-down rows only.",
  }),
  defineKpi({
    id: "pnt.rework_rate",
    label: "Paint Rework Rate",
    department: "paint",
    description: "Share of Paint jobs requiring rework.",
    formula: "rework / completed",
    sourceTables: ["jobs"],
    tier: "strategic",
    readiness: "R3",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "lower_is_better",
    futureNotes: "R3 - no paint rework/defect flag or reason capture exists.",
  }),
  defineKpi({
    id: "pnt.material_usage",
    label: "Material Usage / Cost",
    department: "paint",
    relatedDepartments: ["parts", "accounts"],
    description: "Paint code/material consumed per job.",
    formula: "SUM(material cost per job)",
    sourceTables: ["paint_material_usage"],
    sourceEvents: ["PAINT_MATERIAL_USED"],
    tier: "tactical",
    readiness: "R3",
    aggregation: "sum",
    unit: "currency",
    format: "GBP 0,0.00",
    targetType: "lower_is_better",
    futureNotes: "R3 - no paint code/material capture exists.",
  }),
];

export default paintKpis;
