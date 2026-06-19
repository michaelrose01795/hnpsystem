// file location: src/components/reporting/workshop/workshopReportConfig.js
//
// Presentation grouping for the Workshop report package: which catalogue KPIs
// appear in which tab, and the display metadata (unit/format/readiness/drilldown)
// that mirrors the KPI definitions in src/lib/reporting/kpiDefinitions/. This is
// LAYOUT ONLY — every value, formula and calculation still comes from the engine
// via /api/reports/*. The ids here are the contract; nothing is recomputed.

export const WORKSHOP_DEPARTMENT = { code: "workshop", label: "Workshop" };
export const WORKSHOP_VIEW_TARGET = "reports:workshop";

// Each descriptor: { id, label, unit, format, readiness, hasDrilldown, description }
const K = (id, label, unit, format, readiness, hasDrilldown, description) => ({
  id,
  label,
  unit,
  format,
  readiness,
  hasDrilldown,
  description,
});

// --- Operational headline KPIs (the Overview scorecard) --------------------
export const OVERVIEW_SCORECARD = [
  K("wsh.jobs_completed", "Jobs Completed", "count", "0,0", "R1", true, "Jobs whose work completed in the period."),
  K("wsh.jobs_created", "Jobs Created", "count", "0,0", "R1", true, "New job cards opened in the period."),
  K("wsh.jobs_per_day", "Jobs / Day", "count", "0.0", "R1", true, "Mean jobs completed per day."),
  K("wsh.throughput", "Throughput (net WIP)", "count", "0,0", "R1", false, "Created − released flow balance."),
  K("wsh.sold_hours", "Sold Hours", "hours", "0,0.0", "R1", false, "Labour hours sold/authorised."),
  K("wsh.labour_sales", "Labour Sales", "currency", "£0,0.00", "R1", false, "£ value of labour sold."),
  K("wsh.tech_efficiency", "Technician Efficiency", "percent", "0.0%", "R1", false, "Allocated ÷ clocked hours."),
  K("vhc.completion_rate", "VHC Completion", "percent", "0.0%", "R1", false, "VHC-required jobs completed."),
];

// --- Tab 2: Operations -----------------------------------------------------
export const OPERATIONS_KPIS = [
  K("wsh.jobs_completed", "Jobs Completed", "count", "0,0", "R1", true, "Throughput / daily output."),
  K("wsh.jobs_created", "Jobs Created", "count", "0,0", "R1", true, "Intake volume / demand."),
  K("wsh.jobs_per_day", "Jobs per Day", "count", "0.0", "R1", true, "Daily output rate, trended."),
  K("wsh.throughput", "Workshop Throughput", "count", "0,0", "R1", false, "Released vs created; net WIP change."),
];
export const OPERATIONS_WORKLOAD = [
  K("wsh.jobs_per_tech", "Jobs per Technician", "count", "0.0", "R1", false, "Completed ÷ active technicians."),
  K("wsh.sold_hours", "Sold Hours", "hours", "0,0.0", "R1", false, "Σ requested + authorised VHC labour hours."),
  K("wsh.clocked_hours", "Clocked Hours", "hours", "0,0.0", "R1", false, "Σ time_records hours worked (net breaks)."),
];

// --- Tab 3: Technician Performance ----------------------------------------
export const TECHNICIAN_KPIS = [
  K("wsh.tech_efficiency", "Technician Efficiency", "percent", "0.0%", "R1", false, "Allocated ÷ clocked × 100."),
  K("wsh.jobs_per_tech", "Jobs per Technician", "count", "0.0", "R1", false, "Per-head completed output."),
  K("wsh.labour_sales", "Labour Sales", "currency", "£0,0.00", "R1", false, "£ labour generated."),
  K("wsh.mobile_activity", "Mobile Activity", "count", "0,0", "R1", true, "Mobile jobs + outcome split."),
];
export const TECHNICIAN_RANKING = K(
  "wsh.tech_ranking",
  "Technician Ranking",
  "count",
  "0,0",
  "R1",
  true,
  "Technicians ranked by efficiency over the period."
);
// "Productivity readiness indicators" — declared metrics that light up in a later
// phase; shown so the gap is explicit, not hidden.
export const TECHNICIAN_READINESS = [
  K("wsh.tech_productivity", "Technician Productivity", "percent", "0.0%", "R2", false, "Productive ÷ attended hours."),
  K("wsh.labour_recovery", "Labour Recovery", "percent", "0.0%", "R2", false, "Sold ÷ clocked hours × 100."),
  K("wsh.utilisation", "Utilisation", "percent", "0.0%", "R3", false, "Clocked ÷ available capacity hours."),
];

// --- Tab 4: VHC Performance (VHC KPIs are owned by the workshop department) -
export const VHC_KPIS = [
  K("vhc.completion_rate", "VHC Completion Rate", "percent", "0.0%", "R1", false, "Completed ÷ required VHC jobs."),
  K("vhc.red_items", "Red Items Found", "count", "0,0", "R1", true, "Safety-critical findings volume."),
  K("vhc.authorisation_rate", "Authorisation Rate", "percent", "0.0%", "R1", false, "Authorised ÷ identified value."),
  K("vhc.upsell_revenue", "Upsell Revenue", "currency", "£0,0.00", "R1", false, "Σ authorised VHC work (£)."),
];

// --- Tab 5: Reporting Utilities — every drillable/exportable Workshop KPI --
export const ALL_EXPORTABLE = [
  ...OVERVIEW_SCORECARD,
  TECHNICIAN_RANKING,
  K("vhc.red_items", "Red Items Found", "count", "0,0", "R1", true, ""),
  K("wsh.mobile_activity", "Mobile Activity", "count", "0,0", "R1", true, ""),
].filter((k, i, arr) => k.hasDrilldown && arr.findIndex((x) => x.id === k.id) === i);

export const WORKSHOP_TABS = [
  { value: "overview", label: "Overview" },
  { value: "operations", label: "Operations" },
  { value: "technician", label: "Technician Performance" },
  { value: "vhc", label: "VHC Performance" },
  { value: "utilities", label: "Reporting Utilities" },
];
