// file location: src/lib/reporting/kpiDefinitions/valeting.js
//
// Valeting KPI definitions (Phase-3 section 10, promoted for the Phase-11
// Valeting report package). Values are resolved through the shared reporting
// engine only; R2/R3 entries are declared honestly until the documented wash
// status-history and wash_completed_at/assignee model lands.

import { defineKpi } from "../kpiCatalog";
import { fetchAllRows } from "../queryBuilder";

const JOB_COLUMNS =
  "id,job_number,customer,vehicle_reg,vehicle_make_model,type,status,job_division,job_categories,requests,maintenance_info,checked_in_at,wash_started_at,wash_completed_by,completed_at,completion_status,updated_at";

const round1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
const pct1 = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

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

function checklist(row) {
  return row?.maintenance_info?.valetChecklist || {};
}

function washState(row) {
  const c = checklist(row);
  if (c.washState === "complete" || c.washState === "no_wash") return c.washState;
  if (c.wash === true || row?.wash_completed_by != null) return "complete";
  return "blank";
}

function washDecisionAt(row) {
  const c = checklist(row);
  return c.updatedAt || row?.wash_started_at || row?.completed_at || row?.updated_at || null;
}

function completedAt(row) {
  const c = checklist(row);
  return c.updatedAt || row?.wash_started_at || row?.completed_at || row?.updated_at || null;
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

function demandBucket(row) {
  const text = textBlob(row);
  if (text.includes("courtesy")) return "courtesy_vehicle";
  if (text.includes("sales") || text.includes("prep") || text.includes("preparation")) return "sales_preparation";
  if (text.includes("wash") || text.includes("service")) return "service_wash";
  return "general_valet";
}

function requiresValet(row) {
  const c = checklist(row);
  if (c.washState === "no_wash") return true;
  if (c.washState === "complete" || c.wash === true || row?.wash_completed_by != null) return true;
  if (row?.maintenance_info?.washRequired === true) return true;
  const text = textBlob(row);
  return text.includes("wash") || text.includes("valet") || text.includes("clean") || Boolean(row?.wash_started_at);
}

function normaliseRow(row) {
  const state = washState(row);
  const bucket = demandBucket(row);
  return {
    id: row.id,
    job_number: row.job_number,
    customer: row.customer,
    vehicle_reg: row.vehicle_reg,
    vehicle_make_model: row.vehicle_make_model,
    type: row.type,
    status: row.status,
    job_division: row.job_division,
    demand_bucket: bucket,
    checked_in_at: row.checked_in_at,
    wash_started_at: row.wash_started_at,
    wash_completed_by: row.wash_completed_by,
    wash_state: state,
    wash_updated_at: checklist(row).updatedAt || null,
    completed_at: row.completed_at,
  };
}

async function loadValetRows() {
  return fetchAllRows(
    "jobs",
    JOB_COLUMNS,
    (q) => q,
    { orderBy: "checked_in_at", ascending: false }
  );
}

async function aggregateValeting(filter) {
  const rows = await loadValetRows();
  const required = rows.filter(requiresValet);
  const completed = required.filter((row) => washState(row) === "complete" && inRange(completedAt(row), filter));
  const skipped = required.filter((row) => washState(row) === "no_wash" && inRange(washDecisionAt(row), filter));
  const decisions = completed.length + skipped.length;
  const pointInTime = required.filter((row) => washState(row) === "blank");
  const awaiting = pointInTime.filter((row) => row.checked_in_at && !row.wash_started_at);
  const inValet = pointInTime.filter((row) => Boolean(row.wash_started_at));

  const byDemand = completed.reduce((acc, row) => {
    const key = demandBucket(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const byCompleter = completed.reduce((acc, row) => {
    const key = row.wash_completed_by == null ? "unattributed" : String(row.wash_completed_by);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    rows,
    required,
    completed,
    skipped,
    decisions,
    awaiting,
    inValet,
    byDemand,
    byCompleter,
    days: rangeDays(filter),
  };
}

export const valetingKpis = [
  defineKpi({
    id: "val.cars_washed",
    label: "Cars Washed",
    department: "valeting",
    relatedDepartments: ["service", "workshop"],
    description: "Vehicles with the valet checklist marked complete in the selected period.",
    purpose: "Headline Valeting throughput and completion volume.",
    formula: "COUNT(washState=complete)",
    sourceTables: ["jobs"],
    sourceEvents: ["WASH_COMPLETED"],
    tier: "operational",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    format: "0,0",
    targetType: "higher_is_better",
    example: "15/day",
    futureNotes:
      "Uses valetChecklist.washState=complete, with wash_completed_by as a legacy completion signal where the checklist is absent. wash_completed_at is still required for duration/SLA.",
    drilldown: async ({ filter }) => {
      const out = await aggregateValeting(filter);
      return out.completed.map(normaliseRow);
    },
    resolver: async ({ filter }) => {
      const out = await aggregateValeting(filter);
      return {
        value: out.completed.length,
        count: out.completed.length,
        breakdown: {
          vehicles_completed: out.completed.length,
          valet_volume: out.completed.length,
          valet_throughput_per_day: round1(out.completed.length / out.days),
          vehicles_awaiting_valet: out.awaiting.length,
          vehicles_in_valet: out.inValet.length,
          valet_queue_size: out.awaiting.length + out.inValet.length,
          service_wash_volume: out.byDemand.service_wash || 0,
          sales_preparation_valet_volume: out.byDemand.sales_preparation || 0,
          courtesy_vehicle_valet_volume: out.byDemand.courtesy_vehicle || 0,
          general_valet_volume: out.byDemand.general_valet || 0,
          attributed_completers: Object.keys(out.byCompleter).filter((k) => k !== "unattributed").length,
          unattributed_completions: out.byCompleter.unattributed || 0,
        },
      };
    },
  }),

  defineKpi({
    id: "val.completion_rate",
    label: "Wash Completion Rate",
    department: "valeting",
    relatedDepartments: ["service"],
    description: "Share of completed or skipped wash decisions that completed.",
    purpose: "Shows how often requested Valeting work ends in a completed wash rather than no-wash.",
    formula: "COUNT(complete) / COUNT(complete + no_wash) * 100",
    numerator: "COUNT(complete)",
    denominator: "COUNT(complete + no_wash)",
    sourceTables: ["jobs"],
    sourceEvents: ["WASH_COMPLETED", "WASH_SKIPPED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    drilldown: async ({ filter }) => {
      const out = await aggregateValeting(filter);
      return [...out.completed, ...out.skipped].map(normaliseRow);
    },
    resolver: async ({ filter }) => {
      const out = await aggregateValeting(filter);
      return {
        value: pct1(out.completed.length, out.decisions),
        numerator: out.completed.length,
        denominator: out.decisions,
        count: out.decisions,
        breakdown: {
          completed: out.completed.length,
          no_wash: out.skipped.length,
          decisions: out.decisions,
        },
      };
    },
  }),

  defineKpi({
    id: "val.skip_rate",
    label: "No-Wash / Skip Rate",
    department: "valeting",
    relatedDepartments: ["service"],
    description: "Share of completed or skipped wash decisions marked no-wash.",
    purpose: "Highlights skipped Valeting work and no-wash demand.",
    formula: "COUNT(no_wash) / COUNT(complete + no_wash) * 100",
    numerator: "COUNT(no_wash)",
    denominator: "COUNT(complete + no_wash)",
    sourceTables: ["jobs"],
    sourceEvents: ["WASH_SKIPPED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "lower_is_better",
    drilldown: async ({ filter }) => {
      const out = await aggregateValeting(filter);
      return out.skipped.map(normaliseRow);
    },
    resolver: async ({ filter }) => {
      const out = await aggregateValeting(filter);
      return {
        value: pct1(out.skipped.length, out.decisions),
        numerator: out.skipped.length,
        denominator: out.decisions,
        count: out.decisions,
        breakdown: {
          no_wash: out.skipped.length,
          completed: out.completed.length,
          decisions: out.decisions,
        },
      };
    },
  }),

  defineKpi({
    id: "val.avg_wash_time",
    label: "Average Wash Time",
    department: "valeting",
    description: "Mean elapsed time from wash start to wash completion.",
    formula: "mean(wash_completed_at - wash_started_at)",
    sourceTables: ["jobs"],
    sourceEvents: ["WASH_STARTED", "WASH_COMPLETED"],
    tier: "tactical",
    readiness: "R3",
    aggregation: "duration",
    unit: "duration",
    format: "0.0",
    targetType: "lower_is_better",
    futureNotes: "R3 - blocked because jobs has wash_started_at but no wash_completed_at.",
  }),
  defineKpi({
    id: "val.sla",
    label: "Wash SLA Attainment",
    department: "valeting",
    description: "Share of washes completed inside the configured SLA.",
    formula: "COUNT(washes within SLA minutes) / COUNT(washes) * 100",
    sourceTables: ["jobs"],
    sourceEvents: ["WASH_COMPLETED"],
    tier: "tactical",
    readiness: "R3",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    futureNotes: "R3 - needs wash_completed_at plus an SLA target.",
  }),
  defineKpi({
    id: "val.queue_time",
    label: "Queue Time",
    department: "valeting",
    description: "Mean elapsed time from wash queued to wash started.",
    formula: "mean(wash_started - queued)",
    sourceEvents: ["WASH_QUEUED", "WASH_STARTED"],
    sourceHistories: [],
    tier: "tactical",
    readiness: "R2",
    aggregation: "duration",
    unit: "duration",
    format: "0.0",
    targetType: "lower_is_better",
    futureNotes: "R2 - needs WASH_QUEUED/WASH_STARTED accrual and wash_status_history.",
  }),
  defineKpi({
    id: "val.valeter_productivity",
    label: "Valeter Productivity",
    department: "valeting",
    description: "Washes per valeter per shift.",
    formula: "washes per valeter per shift",
    sourceTables: ["jobs"],
    sourceEvents: ["WASH_COMPLETED"],
    tier: "tactical",
    readiness: "R3",
    aggregation: "ratio",
    unit: "count",
    format: "0.0",
    targetType: "higher_is_better",
    futureNotes: "R3 - needs wash assignee/shift attribution. Current data only has an optional completer id.",
  }),
];

export default valetingKpis;
