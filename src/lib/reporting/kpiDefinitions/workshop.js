// file location: src/lib/reporting/kpiDefinitions/workshop.js
//
// Workshop KPI definitions (Phase-3 §5, promoted for the Phase-6 Workshop report
// package). Every formula here is taken VERBATIM from the KPI catalogue
// (docs/Report System/reporting-kpi-catalogue-architecture.md §5) — no metric is
// invented. R1 metrics that can be computed trust-correctly today carry a
// `resolver`; R2/R3 metrics are DECLARED (catalogue entry, no resolver) so they
// surface in the catalogue/UI as "declared, not yet implemented" with their exact
// blocker, rather than being silently omitted.
//
// All counting/summing goes through queryBuilder (exact counts, paginated sums —
// never `.limit()` as a total) so the numbers cannot regress to the D8 truncation
// bug the audit found.

import { defineKpi } from "../kpiCatalog";
import { applyDateRange, countRows, sumColumn, groupCount, fetchRows } from "../queryBuilder";
import { supabase } from "@/lib/database/supabaseClient";

// ---------------------------------------------------------------------------
// Shared helpers (kept faithful to the catalogue formulas).
// ---------------------------------------------------------------------------

// Whole days spanned by the filter's date range (min 1). Used by per-day means.
function rangeDays(filter) {
  const from = filter?.dateRange?.from ? new Date(filter.dateRange.from) : null;
  const to = filter?.dateRange?.to ? new Date(filter.dateRange.to) : null;
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 1;
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
}

// wsh.sold_hours formula: Σ job_requests.hours (+ Σ authorised vhc_checks.labour_hours).
async function sumSoldHours(filter) {
  const [requests, vhc] = await Promise.all([
    sumColumn("job_requests", "hours", (q) => applyDateRange(q, "created_at", filter)),
    sumColumn("vhc_checks", "labour_hours", (q) =>
      applyDateRange(q.in("approval_status", ["authorized", "authorised"]), "created_at", filter)
    ),
  ]);
  const requestHours = requests.sum || 0;
  const vhcHours = vhc.sum || 0;
  return { soldHours: requestHours + vhcHours, requestHours, vhcHours };
}

// company_settings.default_labour_rate (used by wsh.labour_sales). Returns null
// when unset so the KPI reports "unavailable" rather than a fabricated number.
async function getLabourRate() {
  try {
    const { data, error } = await supabase
      .from("company_settings")
      .select("setting_value")
      .eq("setting_key", "default_labour_rate")
      .maybeSingle();
    if (error) return null;
    const rate = Number(data?.setting_value);
    return Number.isFinite(rate) ? rate : null;
  } catch {
    return null;
  }
}

// wsh.tech_ranking / wsh.tech_efficiency per-tech aggregation from the
// (int-keyed, canonical) tech_efficiency_entries table.
async function aggregateTechRanking(filter) {
  const rows = await fetchRows(
    "tech_efficiency_entries",
    "user_id,allocated_hours,hours_spent,date",
    (q) => applyDateRange(q, "date", filter),
    { limit: 5000, orderBy: "date", ascending: true }
  );
  const byUser = new Map();
  for (const r of rows) {
    const u = r.user_id;
    if (u == null) continue;
    const cur = byUser.get(u) || { user_id: u, allocated_hours: 0, hours_spent: 0, jobs: 0 };
    cur.allocated_hours += Number(r.allocated_hours) || 0;
    cur.hours_spent += Number(r.hours_spent) || 0;
    cur.jobs += 1;
    byUser.set(u, cur);
  }
  return Array.from(byUser.values())
    .map((u) => ({
      ...u,
      allocated_hours: Math.round(u.allocated_hours * 100) / 100,
      hours_spent: Math.round(u.hours_spent * 100) / 100,
      efficiency: u.hours_spent > 0 ? Math.round((u.allocated_hours / u.hours_spent) * 1000) / 10 : null,
    }))
    .filter((u) => u.hours_spent > 0)
    .sort((a, b) => (b.efficiency ?? -1) - (a.efficiency ?? -1))
    .map((u, i) => ({ rank: i + 1, ...u }));
}

export const workshopKpis = [
  // ===== OPERATIONAL — job volume / throughput (R1, buildable now) ==========
  defineKpi({
    id: "wsh.jobs_completed",
    label: "Jobs Completed",
    department: "workshop",
    description: "Jobs whose work completed in the period.",
    purpose: "Throughput / daily output.",
    formula: "COUNT(jobs where completed_at in period)",
    sourceTables: ["jobs"],
    sourceEvents: ["JOB_COMPLETED"],
    sourceHistories: ["job_status_history"],
    tier: "operational",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    targetType: "higher_is_better",
    example: "18 today",
    futureNotes: "Replaces the .limit()-truncated dashboard count (D8).",
    drilldown: async ({ filter }) =>
      fetchRows(
        "jobs",
        "id,job_number,customer,vehicle_reg,vehicle_make_model,type,status,checked_in_at,completed_at,assigned_to",
        (q) => applyDateRange(q.not("completed_at", "is", null), "completed_at", filter),
        { orderBy: "completed_at" }
      ),
    resolver: async ({ filter }) => {
      const count = await countRows("jobs", (q) =>
        applyDateRange(q.not("completed_at", "is", null), "completed_at", filter)
      );
      return { value: count, count };
    },
  }),

  defineKpi({
    id: "wsh.jobs_created",
    label: "Jobs Created",
    department: "workshop",
    relatedDepartments: ["service"],
    description: "New job cards opened in the period.",
    purpose: "Intake volume / demand.",
    formula: "COUNT(jobs where created_at in period)",
    sourceTables: ["jobs"],
    sourceEvents: ["JOB_CREATED"],
    tier: "operational",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    targetType: "informational",
    drilldown: async ({ filter }) =>
      fetchRows(
        "jobs",
        "id,job_number,customer,vehicle_reg,vehicle_make_model,type,status,created_at,assigned_to",
        (q) => applyDateRange(q, "created_at", filter),
        { orderBy: "created_at" }
      ),
    resolver: async ({ filter }) => {
      const count = await countRows("jobs", (q) => applyDateRange(q, "created_at", filter));
      return { value: count, count };
    },
  }),

  defineKpi({
    id: "wsh.jobs_per_day",
    label: "Jobs per Day",
    department: "workshop",
    description: "Mean jobs completed per day across the period (trended daily).",
    purpose: "Daily output rate / capacity sense-check.",
    formula: "COUNT(jobs completed) per day",
    sourceTables: ["jobs"],
    sourceEvents: ["JOB_COMPLETED"],
    tier: "operational",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    format: "0.0",
    targetType: "higher_is_better",
    example: "14-day mean 16.4/day",
    futureNotes: "Forecast-ready once 13 months of history accrues.",
    drilldown: async ({ filter }) =>
      fetchRows(
        "jobs",
        "id,job_number,customer,vehicle_reg,vehicle_make_model,type,status,checked_in_at,completed_at,assigned_to",
        (q) => applyDateRange(q.not("completed_at", "is", null), "completed_at", filter),
        { orderBy: "completed_at" }
      ),
    resolver: async ({ filter }) => {
      const count = await countRows("jobs", (q) =>
        applyDateRange(q.not("completed_at", "is", null), "completed_at", filter)
      );
      const days = rangeDays(filter);
      const value = Math.round((count / days) * 10) / 10;
      return { value, numerator: count, denominator: days, count };
    },
  }),

  defineKpi({
    id: "wsh.throughput",
    label: "Workshop Throughput",
    department: "workshop",
    description: "Jobs released vs jobs created (flow balance / net WIP change).",
    purpose: "Is the workshop keeping pace with intake?",
    formula: "COUNT(JOB released) vs COUNT(JOB created); net WIP change = created − released",
    numerator: "COUNT(jobs created in period)",
    denominator: "COUNT(jobs released in period)",
    sourceTables: ["jobs"],
    sourceEvents: ["JOB_CREATED", "JOB_STATUS_CHANGED"],
    sourceHistories: ["job_status_history"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    targetType: "band",
    example: "17 released vs 19 created → WIP +2",
    futureNotes:
      "'Released' uses completed_at as the release milestone until JOB_STATUS_CHANGED(→released) status-history accrues (then switch to the released transition).",
    // Net-WIP KPI: drill-down shows the "created" side (the numerator) — jobs
    // created in the period. "Released" is counted separately, so the row count
    // reconciles with `numerator` (created), not the net figure.
    drilldown: async ({ filter }) =>
      fetchRows(
        "jobs",
        "id,job_number,status,created_at,completed_at,assigned_to",
        (q) => applyDateRange(q, "created_at", filter),
        { orderBy: "created_at" }
      ),
    resolver: async ({ filter }) => {
      const [created, released] = await Promise.all([
        countRows("jobs", (q) => applyDateRange(q, "created_at", filter)),
        countRows("jobs", (q) => applyDateRange(q.not("completed_at", "is", null), "completed_at", filter)),
      ]);
      return {
        value: created - released,
        numerator: created,
        denominator: released,
        count: created,
        breakdown: { created, released, net_wip_change: created - released },
      };
    },
  }),

  // ===== TACTICAL — labour hours / £ (R1) ===================================
  defineKpi({
    id: "wsh.sold_hours",
    label: "Sold Hours",
    department: "workshop",
    description: "Total labour hours sold (estimated/authorised) over the period.",
    purpose: "The revenue/productivity denominator; basis of recovery & profitability.",
    formula: "Σ job_requests.hours (+ Σ authorised vhc_checks.labour_hours)",
    sourceTables: ["job_requests", "vhc_checks", "jobs"],
    sourceEvents: ["JOB_CREATED", "VHC_AUTHORISED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "sum",
    unit: "hours",
    format: "0,0.0",
    targetType: "higher_is_better",
    example: "12 jobs × 2.1h + 8 authorised VHC × 0.6h = 30.0 sold h/day",
    relatedReports: ["wsh.labour_recovery", "wsh.labour_sales", "wsh.profitability"],
    // Drill-down shows the job-request labour lines — the primary sold-hours
    // contributor (Σ job_requests.hours). Authorised VHC labour_hours are summed
    // into the value separately, so totalling `hours` reconciles with the
    // request-hours portion of the breakdown, not the full sold-hours value.
    drilldown: async ({ filter }) =>
      fetchRows(
        "job_requests",
        "request_id,job_id,description,hours,created_at",
        (q) => applyDateRange(q, "created_at", filter),
        { orderBy: "created_at" }
      ),
    resolver: async ({ filter }) => {
      const { soldHours, requestHours, vhcHours } = await sumSoldHours(filter);
      return {
        value: Math.round(soldHours * 10) / 10,
        count: null,
        breakdown: { request_hours: requestHours, authorised_vhc_hours: vhcHours },
      };
    },
  }),

  defineKpi({
    id: "wsh.clocked_hours",
    label: "Clocked Hours",
    department: "workshop",
    description: "Actual labour hours clocked by technicians.",
    purpose: "Real labour cost & utilisation base.",
    formula: "Σ (clock_out − clock_in − breaks) over time_records",
    sourceTables: ["job_clocking", "time_records"],
    sourceEvents: ["CLOCK_ON", "CLOCK_OFF"],
    tier: "operational",
    readiness: "R1",
    aggregation: "sum",
    unit: "hours",
    format: "0,0.0",
    targetType: "informational",
    example: "6 techs × ~7.5 clocked h = 45 h/day",
    futureNotes:
      "Sums the reconciled time_records.hours_worked (net of breaks). job_clocking is a second labour model — reconcile the two (debt D5) before treating this as the single canonical labour figure.",
    // Drill-down shows the time_records rows whose hours_worked sum to the value.
    drilldown: async ({ filter }) =>
      fetchRows(
        "time_records",
        "id,user_id,job_number,date,hours_worked",
        (q) => applyDateRange(q, "date", filter),
        { orderBy: "date" }
      ),
    resolver: async ({ filter }) => {
      const { sum } = await sumColumn("time_records", "hours_worked", (q) =>
        applyDateRange(q, "date", filter)
      );
      return { value: Math.round(sum * 10) / 10, count: null };
    },
  }),

  defineKpi({
    id: "wsh.labour_sales",
    label: "Labour Sales (£)",
    department: "workshop",
    relatedDepartments: ["accounts"],
    description: "£ value of labour sold in the period.",
    purpose: "Commercial output of the workshop.",
    formula: "Σ sold_hours × labour_rate (company_settings.default_labour_rate)",
    sourceTables: ["job_requests", "vhc_checks", "company_settings"],
    sourceEvents: ["INVOICE_CREATED"],
    dependsOn: ["wsh.sold_hours"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    example: "30h × £95 = £2,850/day",
    relatedReports: ["acc.labour_revenue"],
    futureNotes:
      "Estimate based on sold-hours × the default labour rate; cross-check against invoiced invoices.labour_total when the Accounts package lands (D12).",
    // Labour sales = sold hours × labour rate. The contributing records are the
    // same job-request labour lines that drive sold hours (the rate is a config
    // scalar, not a per-row value).
    drilldown: async ({ filter }) =>
      fetchRows(
        "job_requests",
        "request_id,job_id,description,hours,created_at",
        (q) => applyDateRange(q, "created_at", filter),
        { orderBy: "created_at" }
      ),
    resolver: async ({ filter }) => {
      const [{ soldHours }, rate] = await Promise.all([sumSoldHours(filter), getLabourRate()]);
      if (rate == null) {
        return { value: null, amountGbp: null, breakdown: { sold_hours: soldHours, labour_rate: null } };
      }
      const value = Math.round(soldHours * rate * 100) / 100;
      return { value, amountGbp: value, breakdown: { sold_hours: soldHours, labour_rate: rate } };
    },
  }),

  // ===== TACTICAL — technician performance (R1 via tech_efficiency_entries) =
  defineKpi({
    id: "wsh.tech_efficiency",
    label: "Technician Efficiency",
    department: "workshop",
    description: "Allocated (sold) hours ÷ actual clocked hours, across the workshop.",
    purpose: "Core workshop productivity measure.",
    formula: "Σ allocated_hours ÷ Σ actual_hours × 100",
    numerator: "Σ tech_efficiency_entries.allocated_hours",
    denominator: "Σ tech_efficiency_entries.hours_spent",
    sourceTables: ["tech_efficiency_entries", "tech_efficiency_targets", "job_clocking"],
    sourceEvents: ["CLOCK_OFF", "JOB_COMPLETED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "band",
    example: "Allocated 33h ÷ actual 30h = 110%",
    permission: ["MANAGER_SCOPED_ROLES"],
    futureNotes:
      "R1 today from the int-keyed (canonical) tech_efficiency_entries. Catalogue R1*: allocated-hours reliability improves at R2 once allocated hours auto-pull from job_requests.hours rather than manual entry.",
    // Ratio KPI: drill-down shows the per-entry allocated/spent rows that feed the
    // Σ allocated ÷ Σ spent ratio.
    drilldown: async ({ filter }) =>
      fetchRows(
        "tech_efficiency_entries",
        "id,user_id,job_number,allocated_hours,hours_spent,date",
        (q) => applyDateRange(q, "date", filter),
        { orderBy: "date" }
      ),
    resolver: async ({ filter }) => {
      const [allocated, spent] = await Promise.all([
        sumColumn("tech_efficiency_entries", "allocated_hours", (q) => applyDateRange(q, "date", filter)),
        sumColumn("tech_efficiency_entries", "hours_spent", (q) => applyDateRange(q, "date", filter)),
      ]);
      const num = allocated.sum || 0;
      const den = spent.sum || 0;
      const value = den > 0 ? Math.round((num / den) * 1000) / 10 : null;
      return { value, numerator: num, denominator: den };
    },
  }),

  defineKpi({
    id: "wsh.tech_ranking",
    label: "Technician Ranking",
    department: "workshop",
    description: "Technicians ranked by efficiency (allocated ÷ clocked) over the period.",
    purpose: "Coaching / recognition; surfaces the spread of productivity.",
    formula: "Per technician: Σ allocated_hours ÷ Σ hours_spent × 100, ranked desc",
    sourceTables: ["tech_efficiency_entries", "job_clocking", "jobs"],
    sourceEvents: ["CLOCK_OFF", "JOB_COMPLETED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "distinct",
    unit: "count",
    targetType: "higher_is_better",
    permission: ["MANAGER_SCOPED_ROLES"],
    futureNotes:
      "Ranks by int user_id (canonical). Name resolution + the §3.7 standard (min 5 jobs, normalise per available hour) firm up at R2 with dim_actor name bridging.",
    drilldown: async ({ filter }) => aggregateTechRanking(filter),
    resolver: async ({ filter }) => {
      const ranking = await aggregateTechRanking(filter);
      return { value: ranking.length, count: ranking.length, breakdown: { ranking } };
    },
  }),

  defineKpi({
    id: "wsh.jobs_per_tech",
    label: "Jobs per Technician",
    department: "workshop",
    description: "Completed jobs ÷ active technicians (techs with ≥1 clocking) in the period.",
    purpose: "Per-head output; ranking input.",
    formula: "COUNT(jobs completed) ÷ COUNT(active technicians)",
    numerator: "COUNT(jobs completed)",
    denominator: "COUNT(distinct job_clocking.user_id in period)",
    sourceTables: ["jobs", "job_clocking"],
    sourceEvents: ["JOB_COMPLETED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "ratio",
    unit: "count",
    format: "0.0",
    targetType: "higher_is_better",
    example: "18 ÷ 6 = 3.0",
    // Ratio KPI: drill-down shows the NUMERATOR — jobs completed in the period.
    // The denominator (distinct active technicians from job_clocking) is computed
    // separately, so the row count reconciles with `numerator`, not the ratio.
    drilldown: async ({ filter }) =>
      fetchRows(
        "jobs",
        "id,job_number,status,completed_at,assigned_to",
        (q) => applyDateRange(q.not("completed_at", "is", null), "completed_at", filter),
        { orderBy: "completed_at" }
      ),
    resolver: async ({ filter }) => {
      const [completed, techMap] = await Promise.all([
        countRows("jobs", (q) => applyDateRange(q.not("completed_at", "is", null), "completed_at", filter)),
        groupCount("job_clocking", "user_id", (q) => applyDateRange(q, "clock_in", filter)),
      ]);
      const activeTechs = Object.keys(techMap).filter((k) => k !== "(null)").length;
      const value = activeTechs > 0 ? Math.round((completed / activeTechs) * 10) / 10 : null;
      return { value, numerator: completed, denominator: activeTechs };
    },
  }),

  defineKpi({
    id: "wsh.mobile_activity",
    label: "Mobile Technician Activity",
    department: "workshop",
    relatedDepartments: ["service"],
    description: "Mobile job volume and outcome split in the period.",
    purpose: "Mobile-service throughput and redirect (failed-onsite) rate.",
    formula: "COUNT(jobs service_mode='mobile') by mobile_outcome",
    sourceTables: ["jobs"],
    sourceEvents: ["JOB_REDIRECTED_FROM_MOBILE"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    targetType: "informational",
    example: "22 mobile, 3 redirected = 86% completed onsite",
    drilldown: async ({ filter }) =>
      fetchRows(
        "jobs",
        "id,job_number,customer,vehicle_reg,vehicle_make_model,status,service_mode,mobile_outcome,mobile_completed_at,redirected_from_mobile_at,created_at,assigned_to",
        (q) => applyDateRange(q.eq("service_mode", "mobile"), "created_at", filter),
        { orderBy: "created_at" }
      ),
    resolver: async ({ filter }) => {
      const outcomes = await groupCount("jobs", "mobile_outcome", (q) =>
        applyDateRange(q.eq("service_mode", "mobile"), "created_at", filter)
      );
      const total = Object.values(outcomes).reduce((a, b) => a + b, 0);
      return { value: total, count: total, breakdown: outcomes };
    },
  }),

  // ===== DECLARED — not yet implemented (R2/R3 blockers documented) =========
  // These carry NO resolver: the engine reports them as "declared, readiness Rn"
  // so the UI/ catalogue lists the metric and its exact blocker honestly.
  defineKpi({
    id: "wsh.cycle_time",
    label: "Workshop Cycle Time",
    department: "workshop",
    description: "Elapsed time check-in → release (median preferred).",
    formula: "mean/median(released_at − checked_in_at)",
    sourceTables: ["jobs"],
    sourceHistories: ["job_status_history"],
    sourceEvents: ["JOB_CHECKED_IN", "JOB_STATUS_CHANGED"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "duration",
    unit: "duration",
    targetType: "lower_is_better",
    futureNotes: "R2 — needs the event spine live (emits on) + status-history accrual for robust time-in-stage.",
  }),
  defineKpi({
    id: "wsh.stage_dwell",
    label: "Time-in-Stage",
    department: "workshop",
    description: "Dwell time in each main job status.",
    formula: "Per transition: next_changed_at − changed_at, averaged per status",
    sourceHistories: ["job_status_history"],
    sourceEvents: ["JOB_STATUS_CHANGED"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "duration",
    unit: "duration",
    targetType: "lower_is_better",
    futureNotes: "R2 — needs job_status_history accrual (emits on).",
  }),
  defineKpi({
    id: "wsh.labour_recovery",
    label: "Labour Recovery Rate",
    department: "workshop",
    description: "Sold hours recovered against hours worked.",
    formula: "Σ sold_hours ÷ Σ clocked_hours × 100",
    numerator: "wsh.sold_hours",
    denominator: "wsh.clocked_hours",
    dependsOn: ["wsh.sold_hours", "wsh.clocked_hours"],
    sourceTables: ["job_requests", "job_clocking"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "band",
    futureNotes:
      "R2 — both inputs exist but are never joined; needs the clocking-source reconciliation (D5) before this ratio is trustworthy.",
  }),
  defineKpi({
    id: "wsh.tech_productivity",
    label: "Technician Productivity",
    department: "workshop",
    description: "Clocked (productive) hours ÷ attended hours.",
    formula: "Σ job_clocking hours ÷ Σ time_records attended hours × 100",
    sourceTables: ["job_clocking", "time_records"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    permission: ["MANAGER_SCOPED_ROLES"],
    futureNotes: "R2 — requires the two clocking systems reconciled (D5).",
  }),
  defineKpi({
    id: "wsh.utilisation",
    label: "Technician/Ramp Utilisation",
    department: "workshop",
    description: "Clocked hours ÷ available capacity hours.",
    formula: "Σ clocked_hours ÷ Σ available_hours × 100",
    dependsOn: ["wsh.clocked_hours", "wsh.capacity"],
    tier: "tactical",
    readiness: "R3",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "band",
    futureNotes: "R3 — no capacity/available-hours model exists (no ramp/bay/shift entity).",
  }),
  defineKpi({
    id: "wsh.profitability",
    label: "Workshop Profitability",
    department: "workshop",
    description: "Labour gross profit (labour revenue − labour cost).",
    formula: "labour_revenue − labour_cost (cost = clocked_hours × loaded_rate)",
    dependsOn: ["wsh.labour_sales", "wsh.clocked_hours"],
    tier: "strategic",
    readiness: "R2",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    permission: ["MANAGER_SCOPED_ROLES"],
    futureNotes: "R2 — needs loaded labour cost (users.hourly_rate) joined to clocked hours.",
  }),
  defineKpi({
    id: "wsh.additional_work_recovery",
    label: "Additional-Work Recovery",
    department: "workshop",
    description: "% jobs where authorised VHC work was actually carried out.",
    formula: "COUNT(jobs with additional_work_started) ÷ COUNT(jobs with authorised VHC) × 100",
    sourceTables: ["jobs"],
    sourceEvents: ["VHC_AUTHORISED"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    futureNotes: "R2 — needs the VHC authorise→additional-work-started linkage validated via the event spine.",
  }),
  defineKpi({
    id: "wsh.rework_rate",
    label: "Rework / Comeback Rate",
    department: "workshop",
    description: "% jobs returning for the same fault / reopened for quality.",
    formula: "COUNT(rework jobs) ÷ COUNT(completed) × 100",
    tier: "strategic",
    readiness: "R3",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "lower_is_better",
    futureNotes: "R3 — no rework/comeback flag exists; needs a flag + reason on jobs.",
  }),
];

export default workshopKpis;
