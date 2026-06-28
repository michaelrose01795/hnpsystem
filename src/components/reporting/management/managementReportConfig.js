// file location: src/components/reporting/management/managementReportConfig.js
//
// Presentation grouping for the Management & Executive report package (Phase 14 —
// the ninth, flagship package on the shared reporting platform). This file is
// LAYOUT METADATA ONLY. Every value, trend, drill-down, export and saved view is
// served by the shared reporting platform (/api/reports/*); no KPI maths lives
// here. Executive scorecards reference the new mgt.* composites; the Operational,
// Revenue and Capacity tabs reference EXISTING department KPI ids directly so the
// executive view orchestrates the department packages rather than re-implementing
// them (no duplicate KPI cards, no duplicate calculations).

export const MGT_DEPARTMENT = { code: "management", label: "Management & Executive" };
export const MGT_VIEW_TARGET = "reports:overview";

// Card descriptor used by KpiScorecardStrip / KpiPanel.
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

// ---- 1. Executive Overview — company scorecard ---------------------------
export const EXECUTIVE_SCORECARD = [
  K("mgt.company_revenue", "Company Revenue", "currency", "£0,0.00", "R1", true, "Whole-company invoiced revenue."),
  K("mgt.upsell_contribution", "Upsell Contribution", "percent", "0.0%", "R1", false, "VHC upsell as a share of revenue."),
  K("mgt.site_recovery", "Site Labour Recovery", "percent", "0.0%", "R2", false, "Site sold hours ÷ clocked hours.", "Composes wsh.sold_hours ÷ wsh.clocked_hours; clocking reconciliation (D5) caveat."),
  K("mgt.growth", "Growth (YoY)", "percent", "0.0%", "R2", false, "Year-on-year revenue change.", "Needs ≥13 months of history; prior-year window null until then."),
  K("mgt.department_performance", "Departments Reporting", "count", "0,0", "R2", false, "Operational departments with live KPIs.", "Normalised index needs dim_kpi weights + targets."),
  K("mgt.forecast_inputs", "Forecast Inputs Ready", "count", "0,0", "R2", false, "Curated forecasting input series available.", "Forecast-ready history needs the snapshot spine."),
];

export const COMPANY_REVENUE_CARDS = [
  { key: "total_revenue", label: "Total Revenue", unit: "currency", format: "£0,0.00" },
  { key: "labour_revenue", label: "Labour Revenue", unit: "currency", format: "£0,0.00" },
  { key: "parts_revenue", label: "Parts Revenue", unit: "currency", format: "£0,0.00" },
  { key: "invoices", label: "Invoices Raised", unit: "count", format: "0,0" },
];

// ---- 2. Department Performance ------------------------------------------
export const DEPARTMENT_PERFORMANCE_KPI = "mgt.department_performance";

// ---- 3. Operational Performance — composed from existing department KPIs --
export const OPERATIONAL_KPIS = [
  K("wsh.tech_efficiency", "Workshop Efficiency", "percent", "0.0%", "R1", false, "Allocated ÷ clocked hours."),
  K("wsh.sold_hours", "Workshop Sold Hours", "hours", "0,0.0", "R1", false, "Labour hours sold/authorised."),
  K("wsh.utilisation", "Workshop Utilisation", "percent", "0.0%", "R3", false, "Clocked ÷ available capacity.", "Needs a capacity / available-hours model."),
  K("wsh.tech_productivity", "Technician Productivity", "percent", "0.0%", "R2", false, "Productive ÷ attended hours.", "Needs the two clocking systems reconciled (D5)."),
  K("acc.labour_revenue", "Labour Revenue", "currency", "£0,0.00", "R1", true, "Invoiced labour value."),
  K("acc.parts_revenue", "Parts Revenue", "currency", "£0,0.00", "R1", true, "Invoiced parts value."),
  K("acc.outstanding_invoices", "Invoice Performance", "count", "0,0", "R1", true, "Unpaid invoice pipeline (count + value)."),
  K("vhc.authorisation_rate", "Customer Authorisation", "percent", "0.0%", "R1", false, "Authorised ÷ identified VHC value."),
  K("vhc.completion_rate", "VHC Performance", "percent", "0.0%", "R1", false, "VHC completed ÷ required."),
  K("mot.pass_rate", "MOT Performance", "percent", "0.0%", "R1", false, "MOT pass rate."),
  K("val.cars_washed", "Valeting Throughput", "count", "0,0", "R1", false, "Vehicles valeted in period."),
  K("pnt.jobs_completed", "Paint Throughput", "count", "0,0", "R1", false, "Paint/bodyshop jobs completed."),
];

// ---- 4. Revenue & Profitability -----------------------------------------
export const REVENUE_KPIS = [
  K("mgt.company_revenue", "Company Revenue", "currency", "£0,0.00", "R1", true, "Whole-company invoiced revenue."),
  K("acc.labour_revenue", "Labour Contribution", "currency", "£0,0.00", "R1", true, "Invoiced labour value."),
  K("acc.parts_revenue", "Parts Contribution", "currency", "£0,0.00", "R1", true, "Invoiced parts value."),
  K("mot.revenue", "MOT Contribution", "currency", "£0,0.00", "R1", true, "MOT invoice line value."),
  K("vhc.upsell_revenue", "VHC Upsell Value", "currency", "£0,0.00", "R1", false, "Authorised VHC upsell value."),
  K("mgt.upsell_contribution", "Upsell Contribution %", "percent", "0.0%", "R1", false, "Upsell ÷ revenue."),
];

export const PROFITABILITY_BLOCKED_KPIS = [
  K("mgt.company_profitability", "Company Profitability", "currency", "£0,0.00", "R3", false, "Σ department gross profit.", "Blocked: needs COGS on invoice lines (profitability modelling)."),
  K("mgt.cost_to_serve", "Cost to Serve", "currency", "£0,0.00", "R3", false, "Total cost ÷ jobs completed.", "Blocked: needs a full cost / opex model."),
  K("prt.margin", "Parts Margin", "percent", "0.0%", "R1", false, "Gross margin on fitted parts (live today)."),
];

export const REVENUE_GROWTH_CARDS = [
  { key: "current_revenue", label: "Current Revenue", unit: "currency", format: "£0,0.00" },
  { key: "prior_year_revenue", label: "Prior-Year Revenue", unit: "currency", format: "£0,0.00" },
  { key: "revenue_growth_pct", label: "Revenue Growth", unit: "percent", format: "0.0%" },
  { key: "current_throughput", label: "Current Throughput", unit: "count", format: "0,0" },
  { key: "prior_year_throughput", label: "Prior-Year Throughput", unit: "count", format: "0,0" },
  { key: "throughput_growth_pct", label: "Throughput Growth", unit: "percent", format: "0.0%" },
];

// ---- 5. Capacity & Bottlenecks — composed workload proxies ----------------
export const CAPACITY_KPIS = [
  K("wsh.throughput", "Open Job Volume / WIP", "count", "0,0", "R1", false, "Created vs released (net WIP change)."),
  K("prt.open_by_status", "Waiting for Parts", "count", "0,0", "R1", true, "Open part lines by status."),
  K("acc.outstanding_invoices", "Outstanding Invoices", "count", "0,0", "R1", true, "Unpaid invoice pipeline."),
  K("val.cars_washed", "Valeting Queue", "count", "0,0", "R1", false, "Valet throughput + queue facets."),
  K("pnt.queue", "Paint Queue", "count", "0,0", "R1", true, "Paint/bodyshop jobs not completed."),
  K("mgt.capacity_utilisation", "Capacity Utilisation", "percent", "0.0%", "R3", false, "Clocked ÷ available hours.", "Blocked: needs a capacity model."),
  K("mgt.bottleneck", "Bottleneck Detection", "count", "0,0", "R2", false, "Stage with largest dwell / backlog.", "Blocked: needs *_status_history dwell + backlog snapshots."),
  K("mgt.sla_attainment", "SLA Attainment", "percent", "0.0%", "R2", false, "Stages within SLA.", "Blocked: needs status-history + an SLA/target model."),
];

// Workload-queue facets exposed by existing department KPI breakdowns. The
// per-wait-state queues (waiting for customer / authorisation) need status-history
// and stay declared via mgt.bottleneck.
// Canonical part-status keys (statusMaps.js STATUS_MODELS.part). These cover the
// buildable wait-states — including "waiting for authorisation" — from the open
// parts pipeline; per-stage dwell/queue length needs status-history (mgt.bottleneck).
export const PARTS_WORKLOAD_CARDS = [
  { key: "waiting_authorisation", label: "Waiting Authorisation", unit: "count", format: "0,0" },
  { key: "awaiting_stock", label: "Awaiting Stock", unit: "count", format: "0,0" },
  { key: "on_order", label: "On Order", unit: "count", format: "0,0" },
  { key: "allocated", label: "Allocated", unit: "count", format: "0,0" },
  { key: "pre_picked", label: "Pre-Picked", unit: "count", format: "0,0" },
];

export const VALET_QUEUE_CARDS = [
  { key: "vehicles_awaiting_valet", label: "Awaiting Valet", unit: "count", format: "0,0" },
  { key: "vehicles_in_valet", label: "In Valet", unit: "count", format: "0,0" },
  { key: "valet_queue_size", label: "Valet Queue", unit: "count", format: "0,0" },
  { key: "vehicles_completed", label: "Completed", unit: "count", format: "0,0" },
];

export const PAINT_QUEUE_CARDS = [
  { key: "paint_queue", label: "Paint Queue", unit: "count", format: "0,0" },
  { key: "open_started_jobs", label: "In Progress", unit: "count", format: "0,0" },
  { key: "open_not_started_jobs", label: "Not Started", unit: "count", format: "0,0" },
  { key: "paint_workload", label: "Total Workload", unit: "count", format: "0,0" },
];

// ---- 6. Executive Trends -------------------------------------------------
export const TREND_KPIS = [
  K("mgt.company_revenue", "Company Revenue", "currency", "£0,0.00", "R1", false, ""),
  K("mgt.upsell_contribution", "Upsell Contribution", "percent", "0.0%", "R1", false, ""),
  K("mgt.site_recovery", "Site Recovery", "percent", "0.0%", "R2", false, ""),
  K("wsh.jobs_completed", "Throughput (Jobs Completed)", "count", "0,0", "R1", false, ""),
];

export const TREND_GRANULARITIES = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

// ---- 7. Executive Drill-down — navigate into department packages ----------
// Reuses the existing department report pages (no duplication); these are the
// shared platform's own report routes, surfaced only to executive scope.
export const CROSS_DEPARTMENT_LINKS = [
  { label: "Workshop reports", href: "/reports/workshop", description: "Throughput, labour, technician efficiency, VHC." },
  { label: "Parts reports", href: "/reports/parts", description: "Open pipeline, ordering, stock, margin." },
  { label: "Service Advisor reports", href: "/reports/service", description: "Bookings, VHC send rate, customer mix." },
  { label: "MOT reports", href: "/reports/mot", description: "Volume, pass rate, tester activity, revenue." },
  { label: "Valeting reports", href: "/reports/valeting", description: "Throughput, completion, vehicle prep." },
  { label: "Paint reports", href: "/reports/paint", description: "Completions, queue, workflow, workload." },
  { label: "Accounts reports", href: "/reports/accounts", description: "Revenue, receivables, payments, exposure." },
  { label: "Admin reports", href: "/reports/admin", description: "Access, audit, compliance, data quality." },
];

// ---- 8. Reporting Utilities — drillable / exportable mgt composites --------
export const ALL_EXPORTABLE = [
  K("mgt.company_revenue", "Company Revenue", "currency", "£0,0.00", "R1", true, ""),
  K("mgt.upsell_contribution", "Upsell Contribution", "percent", "0.0%", "R1", false, ""),
  K("mgt.site_recovery", "Site Labour Recovery", "percent", "0.0%", "R2", false, ""),
  K("mgt.department_performance", "Department Performance", "count", "0,0", "R2", false, ""),
  K("mgt.growth", "Growth (YoY)", "percent", "0.0%", "R2", false, ""),
  K("mgt.forecast_inputs", "Forecast Inputs", "count", "0,0", "R2", false, ""),
];

export const MGT_TABS = [
  { value: "overview", label: "Executive Overview" },
  { value: "departments", label: "Department Performance" },
  { value: "operational", label: "Operational Performance" },
  { value: "revenue", label: "Revenue & Profitability" },
  { value: "capacity", label: "Capacity & Bottlenecks" },
  { value: "trends", label: "Executive Trends" },
  { value: "drilldown", label: "Executive Drill-down" },
  { value: "utilities", label: "Reporting Utilities" },
];
