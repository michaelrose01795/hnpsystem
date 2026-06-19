// file location: src/components/reporting/paint/paintReportConfig.js
//
// Presentation grouping for the Paint report package (Phase 12). This file is
// layout metadata only; values, drill-downs, exports and saved views are served
// by the shared reporting platform.

export const PAINT_DEPARTMENT = { code: "paint", label: "Paint / Bodyshop" };
export const PAINT_VIEW_TARGET = "reports:paint";

const K = (id, label, unit, format, readiness, hasDrilldown, description, futureNotes = "") => ({
  id,
  label,
  unit,
  format,
  readiness,
  hasDrilldown,
  description,
  futureNotes,
});

export const OVERVIEW_SCORECARD = [
  K("pnt.jobs_completed", "Paint Jobs Completed", "count", "0,0", "R1", true, "Completed Paint/bodyshop jobs."),
  K("pnt.queue", "Paint Queue", "count", "0,0", "R1", true, "Paint jobs not completed."),
  K("pnt.cycle_time", "Paint Cycle Time", "hours", "0.0", "R2", true, "Whole-job cycle-time proxy."),
  K("pnt.stage_duration", "Stage Duration", "duration", "0.0", "R3", false, "Paint stage dwell."),
  K("pnt.painter_productivity", "Painter Productivity", "count", "0.0", "R3", false, "Jobs/hours per painter."),
  K("pnt.rework_rate", "Paint Rework Rate", "percent", "0.0%", "R3", false, "Rework / completed."),
];

export const OPERATIONS_KPIS = [
  K("pnt.jobs_completed", "Paint Job Volume", "count", "0,0", "R1", true, "Completed Paint/bodyshop job volume."),
  K("pnt.queue", "Paint Queue", "count", "0,0", "R1", true, "Current Paint/bodyshop queue."),
  K("pnt.cycle_time", "Cycle-Time Proxy", "hours", "0.0", "R2", true, "Mean completed_at - workshop_started_at."),
];

export const WORKFLOW_READINESS = [
  K("pnt.cycle_time", "Cycle-Time Proxy", "hours", "0.0", "R2", true, "Whole-job cycle-time proxy.", "Improves with job_status_history accrual and paint stage modelling."),
  K("pnt.stage_duration", "Stage Duration", "duration", "0.0", "R3", false, "Dwell per prep/spray/dry/buff/ready stage.", "Needs paint_stage_history."),
  K("pnt.bay_utilisation", "Bay Utilisation", "percent", "0.0%", "R3", false, "Bay occupied / available.", "Needs bay entity and occupied-time capture."),
  K("pnt.rework_rate", "Paint Rework Rate", "percent", "0.0%", "R3", false, "Rework / completed.", "Needs rework/defect flag and reason capture."),
];

export const WORKLOAD_KPIS = [
  K("pnt.queue", "Paint Workload", "count", "0,0", "R1", true, "Current open Paint/bodyshop workload."),
  K("pnt.jobs_completed", "Bodyshop Job Volume", "count", "0,0", "R1", true, "Completed bodyshop volume and identified demand facets."),
  K("pnt.painter_productivity", "Painter Productivity", "count", "0.0", "R3", false, "Jobs/hours per painter.", "Needs painter assignment and stage clocking."),
];

export const ALL_EXPORTABLE = [
  K("pnt.jobs_completed", "Paint Jobs Completed", "count", "0,0", "R1", true, ""),
  K("pnt.queue", "Paint Queue", "count", "0,0", "R1", true, ""),
  K("pnt.cycle_time", "Paint Cycle-Time Proxy", "hours", "0.0", "R2", true, ""),
].filter((k, i, arr) => k.hasDrilldown && arr.findIndex((x) => x.id === k.id) === i);

export const COMPLETED_BREAKDOWN_CARDS = [
  { key: "paint_jobs_identified", label: "Paint Jobs Identified", unit: "count", format: "0,0" },
  { key: "paint_jobs_completed", label: "Paint Jobs Completed", unit: "count", format: "0,0" },
  { key: "paint_throughput_per_day", label: "Paint Throughput", unit: "count", format: "0.0" },
  { key: "bodyshop_job_volume", label: "Bodyshop Job Volume", unit: "count", format: "0,0" },
  { key: "paint_cycle_time_proxy_hours", label: "Cycle-Time Proxy", unit: "hours", format: "0.0" },
  { key: "cycle_time_sample_size", label: "Cycle-Time Sample", unit: "count", format: "0,0" },
];

export const QUEUE_BREAKDOWN_CARDS = [
  { key: "paint_queue", label: "Paint Queue", unit: "count", format: "0,0" },
  { key: "paint_workload", label: "Paint Workload", unit: "count", format: "0,0" },
  { key: "open_started_jobs", label: "Open Started Jobs", unit: "count", format: "0,0" },
  { key: "open_not_started_jobs", label: "Open Not Started Jobs", unit: "count", format: "0,0" },
  { key: "attributed_jobs", label: "Attributed Jobs", unit: "count", format: "0,0" },
  { key: "unattributed_jobs", label: "Unattributed Jobs", unit: "count", format: "0,0" },
  { key: "bodyshop_job_demand", label: "Bodyshop Job Demand", unit: "count", format: "0,0" },
];

export const PAINT_TABS = [
  { value: "overview", label: "Paint Overview" },
  { value: "operations", label: "Paint Operations" },
  { value: "workflow", label: "Paint Workflow" },
  { value: "workload", label: "Paint Workload" },
  { value: "utilities", label: "Reporting Utilities" },
];
