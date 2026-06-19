// file location: src/components/reporting/valeting/valetingReportConfig.js
//
// Presentation grouping for the Valeting report package (Phase 11). This file
// contains layout metadata only; values, drill-downs, exports and saved views
// are served by the shared reporting platform.

export const VALETING_DEPARTMENT = { code: "valeting", label: "Valeting" };
export const VALETING_VIEW_TARGET = "reports:valeting";

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
  K("val.cars_washed", "Cars Washed", "count", "0,0", "R1", true, "Vehicles with washState=complete."),
  K("val.completion_rate", "Wash Completion Rate", "percent", "0.0%", "R1", true, "Completed / complete plus no-wash decisions."),
  K("val.skip_rate", "No-Wash / Skip Rate", "percent", "0.0%", "R1", true, "No-wash decisions / complete plus no-wash decisions."),
  K("val.queue_time", "Queue Time", "duration", "0.0", "R2", false, "Mean queued-to-started time."),
  K("val.avg_wash_time", "Average Wash Time", "duration", "0.0", "R3", false, "Mean started-to-completed time."),
  K("val.valeter_productivity", "Valeter Productivity", "count", "0.0", "R3", false, "Washes per valeter per shift."),
];

export const OPERATIONS_KPIS = [
  K("val.cars_washed", "Valet Volume", "count", "0,0", "R1", true, "Completed valet volume in the selected period."),
  K("val.completion_rate", "Completion Rate", "percent", "0.0%", "R1", true, "Completed washes as a share of wash decisions."),
  K("val.skip_rate", "Skip Rate", "percent", "0.0%", "R1", true, "No-wash decisions as a share of wash decisions."),
];

export const OPERATIONS_READINESS = [
  K("val.queue_time", "Queue Time", "duration", "0.0", "R2", false, "Mean wash_started - queued.", "Needs WASH_QUEUED/WASH_STARTED accrual and wash_status_history."),
  K("val.avg_wash_time", "Average Valet Duration", "duration", "0.0", "R3", false, "Mean wash_completed_at - wash_started_at.", "Needs wash_completed_at."),
  K("val.sla", "Wash SLA Attainment", "percent", "0.0%", "R3", false, "Washes inside SLA / washes.", "Needs wash_completed_at and SLA targets."),
];

export const VALETER_KPIS = [
  K("val.valeter_productivity", "Valeter Productivity", "count", "0.0", "R3", false, "Washes per valeter per shift.", "Needs wash assignee and shift attribution."),
];

export const PREPARATION_KPIS = [
  K("val.cars_washed", "Valet Volume", "count", "0,0", "R1", true, "Completed valet demand split by existing job/checklist signals."),
];

export const ALL_EXPORTABLE = [
  K("val.cars_washed", "Cars Washed", "count", "0,0", "R1", true, ""),
  K("val.completion_rate", "Wash Completion Decisions", "percent", "0.0%", "R1", true, ""),
  K("val.skip_rate", "No-Wash Decisions", "percent", "0.0%", "R1", true, ""),
].filter((k, i, arr) => k.hasDrilldown && arr.findIndex((x) => x.id === k.id) === i);

export const BREAKDOWN_CARDS = [
  { key: "vehicles_awaiting_valet", label: "Vehicles Awaiting Valet", unit: "count", format: "0,0" },
  { key: "vehicles_in_valet", label: "Vehicles In Valet", unit: "count", format: "0,0" },
  { key: "vehicles_completed", label: "Vehicles Completed", unit: "count", format: "0,0" },
  { key: "valet_queue_size", label: "Valet Queue Size", unit: "count", format: "0,0" },
  { key: "valet_throughput_per_day", label: "Valet Throughput", unit: "count", format: "0.0" },
  { key: "service_wash_volume", label: "Service Wash Volume", unit: "count", format: "0,0" },
  { key: "sales_preparation_valet_volume", label: "Sales Prep Valet Volume", unit: "count", format: "0,0" },
  { key: "courtesy_vehicle_valet_volume", label: "Courtesy Vehicle Valet Volume", unit: "count", format: "0,0" },
];

export const VALETING_TABS = [
  { value: "overview", label: "Valeting Overview" },
  { value: "operations", label: "Valeting Operations" },
  { value: "valeters", label: "Valeter Activity" },
  { value: "preparation", label: "Vehicle Preparation" },
  { value: "utilities", label: "Reporting Utilities" },
];
