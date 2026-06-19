// file location: src/lib/reporting/kpiDefinitions/mot.js
//
// MOT KPI definitions (Phase-3 §9, promoted for the Phase-10 MOT report package).
// Every formula here is taken from the KPI catalogue; UI screens reference these
// ids only and never calculate MOT figures themselves.
//
// R1 metrics that are trust-computable from existing operational tables carry a
// resolver. R2/R3 metrics are either declared (no resolver) or, for
// mot.tester_productivity, computed as an explicitly caveated clocking-based
// interim because the readiness audit says tester labour is reportable now while
// the catalogue notes reliable test attribution improves with mot_tests.

import { defineKpi } from "../kpiCatalog";
import { applyDateRange, countRows, fetchRows, groupCount, sumColumnFromSelect } from "../queryBuilder";
import { normaliseStatus } from "../config/statusMaps";

const MOT_LINE_PATTERN = "%mot%";

const round1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
const pct1 = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

function rangeDays(filter) {
  const from = filter?.dateRange?.from ? new Date(filter.dateRange.from) : null;
  const to = filter?.dateRange?.to ? new Date(filter.dateRange.to) : null;
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 1;
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
}

function motJobQuery(q) {
  return q.eq("type", "MOT");
}

function classifyMotResult(raw) {
  const normalised = normaliseStatus("mot_result", raw);
  if (["pass", "fail", "retest", "aborted", "cancelled"].includes(normalised)) return normalised;
  const text = String(raw || "").toLowerCase();
  if (text.includes("retest") || text.includes("re-test")) return "retest";
  if (text.includes("fail")) return "fail";
  if (text.includes("pass")) return "pass";
  return normalised || "unknown";
}

async function motOutcomeDistribution(filter) {
  const raw = await groupCount("jobs", "completion_status", (q) =>
    applyDateRange(motJobQuery(q).not("completion_status", "is", null), "completed_at", filter)
  );
  const breakdown = {};
  for (const [status, count] of Object.entries(raw)) {
    if (status === "(null)") continue;
    const bucket = classifyMotResult(status);
    breakdown[bucket] = (breakdown[bucket] || 0) + count;
  }
  return breakdown;
}

async function aggregateTesterProductivity(filter) {
  const rows = await fetchRows(
    "job_clocking",
    "id,user_id,job_id,job_number,clock_in,clock_out,work_type",
    (q) => applyDateRange(q.eq("work_type", "mot"), "clock_in", filter),
    { limit: 5000, orderBy: "clock_in", ascending: true }
  );
  const byTester = new Map();
  let closedRows = 0;
  let durationHours = 0;

  for (const row of rows) {
    const tester = row.user_id;
    if (tester == null) continue;
    const cur = byTester.get(tester) || { user_id: tester, tests: 0, completed_clockings: 0, hours: 0 };
    cur.tests += 1;
    const start = row.clock_in ? new Date(row.clock_in) : null;
    const end = row.clock_out ? new Date(row.clock_out) : null;
    if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      const hours = (end.getTime() - start.getTime()) / 3600000;
      cur.hours += hours;
      cur.completed_clockings += 1;
      durationHours += hours;
      closedRows += 1;
    }
    byTester.set(tester, cur);
  }

  const testers = Array.from(byTester.values())
    .map((t) => ({
      ...t,
      hours: round1(t.hours) || 0,
      mean_test_duration_hours: t.completed_clockings > 0 ? round1(t.hours / t.completed_clockings) : null,
    }))
    .sort((a, b) => b.tests - a.tests);

  return {
    clockings: rows.length,
    testerCount: testers.length,
    testsPerTester: testers.length > 0 ? round1(rows.length / testers.length) : null,
    meanDurationHours: closedRows > 0 ? round1(durationHours / closedRows) : null,
    testers,
  };
}

function nextMotDueWindow() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  end.setHours(23, 59, 59, 999);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export const motKpis = [
  defineKpi({
    id: "mot.volume",
    label: "MOT Volume",
    department: "mot",
    relatedDepartments: ["service", "workshop"],
    description: "MOT jobs checked in during the selected period.",
    purpose: "Headline MOT lane demand and completed-test proxy.",
    formula: "COUNT(jobs type='MOT' in period)",
    sourceTables: ["jobs"],
    sourceEvents: ["MOT_BOOKED"],
    tier: "operational",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    format: "0,0",
    targetType: "higher_is_better",
    example: "9/day (use checked_in_at as proxy date - flag imprecision)",
    futureNotes:
      "Uses jobs.type='MOT' dated by checked_in_at, the catalogue's R1 proxy date. A real mot_tests.test_date replaces this when the MOT entity lands.",
    drilldown: async ({ filter }) =>
      fetchRows(
        "jobs",
        "id,job_number,vehicle_reg,vehicle_make_model,type,status,completion_status,checked_in_at,completed_at,assigned_to",
        (q) => applyDateRange(motJobQuery(q), "checked_in_at", filter),
        { orderBy: "checked_in_at" }
      ),
    resolver: async ({ filter }) => {
      const count = await countRows("jobs", (q) => applyDateRange(motJobQuery(q), "checked_in_at", filter));
      return { value: count, count };
    },
  }),

  defineKpi({
    id: "mot.pass_rate",
    label: "Pass Rate",
    department: "mot",
    relatedDepartments: ["service", "workshop"],
    description: "Share of recorded MOT outcomes that are passes.",
    purpose: "Outcome quality signal for the MOT lane.",
    formula: "COUNT(pass) ÷ COUNT(results) × 100",
    numerator: "COUNT(pass)",
    denominator: "COUNT(results)",
    sourceTables: ["jobs"],
    sourceEvents: ["MOT_RESULT_RECORDED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    example: "7 ÷ 9 = 78%",
    futureNotes:
      "R1* from jobs.completion_status, using a mutually-exclusive status bucket to avoid the old overlapping ILIKE double-count. Still labelled unreliable until mot_tests.result exists and result statuses are constrained.",
    drilldown: async ({ filter }) =>
      fetchRows(
        "jobs",
        "id,job_number,vehicle_reg,completion_status,checked_in_at,completed_at,assigned_to",
        (q) => applyDateRange(motJobQuery(q).not("completion_status", "is", null), "completed_at", filter),
        { orderBy: "completed_at" }
      ),
    resolver: async ({ filter }) => {
      const breakdown = await motOutcomeDistribution(filter);
      const passed = breakdown.pass || 0;
      const results = Object.values(breakdown).reduce((a, b) => a + b, 0);
      return {
        value: pct1(passed, results),
        numerator: passed,
        denominator: results,
        count: results,
        breakdown: { completed: results, passed, failed: breakdown.fail || 0, retests: breakdown.retest || 0, ...breakdown },
      };
    },
  }),

  defineKpi({
    id: "mot.revenue",
    label: "MOT Revenue",
    department: "mot",
    relatedDepartments: ["accounts"],
    description: "Value of MOT invoice lines raised in the selected period.",
    purpose: "Commercial MOT lane output.",
    formula: "Σ MOT line value on invoices",
    sourceTables: ["invoices", "invoice_items", "jobs"],
    sourceEvents: ["INVOICE_CREATED", "MOT_CERTIFICATE_ISSUED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    futureNotes:
      "Uses invoice_items whose description identifies an MOT line, filtered by parent invoice_date. A typed invoice-line category would make this exact without description matching.",
    drilldown: async ({ filter }) =>
      fetchRows(
        "invoice_items",
        "id,invoice_id,description,quantity,unit_price,total,invoices!inner(invoice_number,invoice_date,job_number)",
        (q) => applyDateRange(q.ilike("description", MOT_LINE_PATTERN), "invoices.invoice_date", filter),
        { orderBy: "id" }
      ),
    resolver: async ({ filter }) => {
      const { sum, count } = await sumColumnFromSelect(
        "invoice_items",
        "total",
        "total,invoices!inner(invoice_date)",
        (q) => applyDateRange(q.ilike("description", MOT_LINE_PATTERN), "invoices.invoice_date", filter)
      );
      const value = Math.round((sum || 0) * 100) / 100;
      return { value, amountGbp: value, count, breakdown: { mot_invoice_lines: count, revenue: value } };
    },
  }),

  defineKpi({
    id: "mot.throughput",
    label: "MOT Throughput",
    department: "mot",
    description: "MOT tests per day across the selected period.",
    purpose: "MOT lane throughput trend.",
    formula: "tests/day trend",
    sourceTables: ["jobs"],
    sourceEvents: ["MOT_BOOKED", "MOT_RESULT_RECORDED"],
    tier: "operational",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    format: "0.0",
    targetType: "higher_is_better",
    futureNotes:
      "Uses checked_in_at as the R1 date proxy, per the catalogue note. The true test date arrives with mot_tests.",
    drilldown: async ({ filter }) =>
      fetchRows(
        "jobs",
        "id,job_number,vehicle_reg,completion_status,checked_in_at,completed_at,assigned_to",
        (q) => applyDateRange(motJobQuery(q), "checked_in_at", filter),
        { orderBy: "checked_in_at" }
      ),
    resolver: async ({ filter }) => {
      const tests = await countRows("jobs", (q) => applyDateRange(motJobQuery(q), "checked_in_at", filter));
      const days = rangeDays(filter);
      return { value: round1(tests / days), numerator: tests, denominator: days, count: tests };
    },
  }),

  defineKpi({
    id: "mot.due_pipeline",
    label: "MOT-Due Pipeline",
    department: "mot",
    relatedDepartments: ["service"],
    description: "Vehicles with an MOT due in the next 30 days.",
    purpose: "Reminder and booking-demand pipeline.",
    formula: "COUNT(vehicles mot_due within N days)",
    sourceTables: ["vehicles", "customers"],
    snapshotSource: "report_entity_state_snapshot",
    tier: "operational",
    readiness: "R1",
    aggregation: "point_in_time",
    unit: "count",
    format: "0,0",
    targetType: "informational",
    futureNotes:
      "Point-in-time reminder driver using N=30 days. It intentionally ignores the report date range; saved filters still apply to the rest of the MOT package.",
    drilldown: async () => {
      const { from, to } = nextMotDueWindow();
      return fetchRows(
        "vehicles",
        "vehicle_id,reg_number,registration,make,model,make_model,customer_id,mot_due",
        (q) => q.gte("mot_due", from).lte("mot_due", to),
        { orderBy: "mot_due", ascending: true }
      );
    },
    resolver: async () => {
      const { from, to } = nextMotDueWindow();
      const count = await countRows("vehicles", (q) => q.gte("mot_due", from).lte("mot_due", to));
      return { value: count, count, breakdown: { window_days: 30, from, to } };
    },
  }),

  defineKpi({
    id: "mot.tester_productivity",
    label: "Tester Productivity",
    department: "mot",
    description: "Tests per tester per period, with mean test duration from MOT clocking.",
    purpose: "Tester workload and activity visibility.",
    formula: "tests per tester per period; mean test duration",
    sourceTables: ["job_clocking"],
    sourceEvents: ["MOT_STARTED", "MOT_RESULT_RECORDED"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "ratio",
    unit: "count",
    format: "0.0",
    targetType: "higher_is_better",
    futureNotes:
      "Clocking-based interim from job_clocking.work_type='mot'. Reliable tester attribution improves with mot_tests.tester_id and the MOT_STARTED/MOT_RESULT_RECORDED event pair.",
    drilldown: async ({ filter }) => aggregateTesterProductivity(filter).then((out) => out.testers),
    resolver: async ({ filter }) => {
      const out = await aggregateTesterProductivity(filter);
      return {
        value: out.testsPerTester,
        numerator: out.clockings,
        denominator: out.testerCount,
        count: out.clockings,
        breakdown: {
          mot_clockings: out.clockings,
          testers: out.testerCount,
          mean_test_duration_hours: out.meanDurationHours,
          tester_activity: out.testers,
        },
      };
    },
  }),

  defineKpi({
    id: "mot.first_time_pass",
    label: "First-Time Pass Rate",
    department: "mot",
    description: "Share of tests passed on first attempt.",
    formula: "COUNT(passed first attempt) ÷ COUNT(tests) × 100",
    sourceTables: ["mot_tests"],
    tier: "tactical",
    readiness: "R3",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    futureNotes: "R3 - no retest-to-original linkage; needs mot_tests.retest_of.",
  }),
  defineKpi({
    id: "mot.retest_rate",
    label: "Retest Rate",
    department: "mot",
    description: "Share of MOTs that are retests.",
    formula: "COUNT(retests) ÷ COUNT(tests) × 100",
    sourceTables: ["mot_tests"],
    sourceEvents: ["MOT_RETEST_LINKED"],
    tier: "tactical",
    readiness: "R3",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "lower_is_better",
    futureNotes: "R3 - requires mot_tests with retest_of linkage; completion_status text cannot identify first vs retest safely.",
  }),
  defineKpi({
    id: "mot.repair_conversion",
    label: "MOT→Repair Conversion",
    department: "mot",
    relatedDepartments: ["workshop", "vhc"],
    description: "Share of MOT jobs that generate repair work.",
    formula: "COUNT(MOT jobs generating repair work) ÷ COUNT(MOT jobs) × 100",
    sourceTables: ["jobs", "job_requests", "vhc_checks"],
    sourceEvents: ["VHC_AUTHORISED"],
    tier: "strategic",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    futureNotes: "R2 - needs event-spine linkage from MOT outcome to authorised repair work; current job overlay loses the conversion path.",
  }),
  defineKpi({
    id: "mot.advisory_conversion",
    label: "Advisory Conversion",
    department: "mot",
    relatedDepartments: ["service", "workshop"],
    description: "Share of MOT advisories converted to booked work.",
    formula: "COUNT(advisories converted to booked work) ÷ COUNT(advisories) × 100",
    sourceTables: ["mot_advisories"],
    sourceEvents: ["MOT_ADVISORY_ADDED"],
    tier: "strategic",
    readiness: "R3",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    futureNotes: "R3 - no advisory capture exists; needs mot_advisories before advisory analytics can be measured.",
  }),
];

export default motKpis;
