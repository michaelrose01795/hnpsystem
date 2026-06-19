// file location: src/components/reporting/mot/motReportConfig.js
//
// Presentation grouping for the MOT report package (Phase 10). This file holds
// layout metadata only: every value, formula, trend, drill-down and export still
// comes from the reporting engine via /api/reports/*.

export const MOT_DEPARTMENT = { code: "mot", label: "MOT" };
export const MOT_VIEW_TARGET = "reports:mot";

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
  K("mot.volume", "MOT Volume", "count", "0,0", "R1", true, "MOT jobs checked in during the selected period."),
  K("mot.throughput", "MOT Throughput", "count", "0.0", "R1", true, "Tests per day across the selected period."),
  K("mot.pass_rate", "Pass Rate", "percent", "0.0%", "R1", true, "Passes as a share of recorded outcomes; breakdown includes completed/pass/fail/retest."),
  K("mot.revenue", "MOT Revenue", "currency", "£0,0.00", "R1", true, "MOT invoice-line value."),
  K("mot.due_pipeline", "MOT-Due Pipeline", "count", "0,0", "R1", true, "Vehicles with MOT due in the next 30 days."),
  K("mot.tester_productivity", "Tester Productivity", "count", "0.0", "R2", true, "Clocking-based tests per tester interim."),
];

export const OPERATIONS_KPIS = [
  K("mot.volume", "MOT Volume", "count", "0,0", "R1", true, "MOT jobs by checked-in date."),
  K("mot.pass_rate", "Pass / Fail Analysis", "percent", "0.0%", "R1", true, "Pass rate with mutually-exclusive pass/fail/retest breakdown."),
  K("mot.throughput", "Throughput Monitoring", "count", "0.0", "R1", true, "Tests per day trend."),
  K("mot.due_pipeline", "MOT-Due Pipeline", "count", "0,0", "R1", true, "Future reminder pipeline."),
];

export const OPERATIONS_READINESS = [
  K("mot.first_time_pass", "First-Time Pass", "percent", "0.0%", "R3", false, "Passed first attempt ÷ tests.", "Needs mot_tests.retest_of."),
  K("mot.retest_rate", "Retest Rate", "percent", "0.0%", "R3", false, "Retests ÷ tests.", "Needs mot_tests.retest_of."),
];

export const TESTER_KPIS = [
  K("mot.tester_productivity", "Tester Workload", "count", "0.0", "R2", true, "Tests per tester per period; mean duration in breakdown.", "Reliable attribution improves with mot_tests.tester_id."),
];

export const REVENUE_KPIS = [
  K("mot.revenue", "MOT Revenue", "currency", "£0,0.00", "R1", true, "MOT invoice-line value."),
];

export const CONVERSION_READINESS = [
  K("mot.repair_conversion", "Repair Conversion", "percent", "0.0%", "R2", false, "MOT jobs generating repair work ÷ MOT jobs.", "Needs event-spine linkage to authorised repair work."),
  K("mot.advisory_conversion", "Advisory Conversion", "percent", "0.0%", "R3", false, "Advisories converted to booked work ÷ advisories.", "Needs mot_advisories."),
];

export const ALL_EXPORTABLE = [
  K("mot.volume", "MOT Volume", "count", "0,0", "R1", true, ""),
  K("mot.pass_rate", "Pass / Fail Outcomes", "percent", "0.0%", "R1", true, ""),
  K("mot.throughput", "MOT Throughput", "count", "0.0", "R1", true, ""),
  K("mot.due_pipeline", "MOT-Due Pipeline", "count", "0,0", "R1", true, ""),
  K("mot.revenue", "MOT Revenue", "currency", "£0,0.00", "R1", true, ""),
  K("mot.tester_productivity", "Tester Activity", "count", "0.0", "R2", true, ""),
].filter((k, i, arr) => k.hasDrilldown && arr.findIndex((x) => x.id === k.id) === i);

export const MOT_TABS = [
  { value: "overview", label: "MOT Overview" },
  { value: "operations", label: "MOT Operations" },
  { value: "testers", label: "Tester Activity" },
  { value: "revenue", label: "Revenue & Conversion" },
  { value: "utilities", label: "Reporting Utilities" },
];
