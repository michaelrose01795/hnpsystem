// file location: src/lib/reporting/kpiDefinitions/management.js
//
// Management / Executive KPI definitions (Phase-3 §14, promoted for the Phase-14
// Management & Executive report package — the NINTH and flagship package on the
// shared reporting foundation after Workshop, Parts, Accounts, Service Advisor,
// MOT, Valeting, Paint and Admin).
//
// THE MANAGEMENT PACKAGE OWNS NO OPERATIONAL EVENTS. Every formula here is taken
// VERBATIM from the KPI catalogue (docs/Report System/
// reporting-kpi-catalogue-architecture.md §14) and is COMPOSED from the already-
// implemented department KPIs — never recalculated. The resolvers call the
// existing catalogue resolvers (getKpi(id).resolver) so there is exactly ONE
// canonical formula per metric (Principle 2 / ADR-4): mgt.company_revenue reuses
// acc.revenue, mgt.upsell_contribution reuses vhc.upsell_revenue ÷ acc.revenue,
// mgt.site_recovery reuses wsh.sold_hours ÷ wsh.clocked_hours, and so on. No new
// reporting infrastructure, no duplicated KPI maths, no invented numbers.
//
// Readiness gating (Phase-3 §0.3 — the catalogue tag is the authority):
//   - R1 = every composed input is an R1 metric that computes today → resolver.
//   - R2 = composes R1 inputs but the catalogue flags a trust caveat (clocking
//          reconciliation D5, ≥13m history for YoY, dim_kpi weighting / TARGET_SET
//          targets, status-history dwell) → resolver where the composition is
//          honestly buildable now (site recovery, department comparison, growth,
//          forecast inputs); DECLARED where the dwell/SLA model genuinely does not
//          exist yet (bottleneck, sla_attainment).
//   - R3 = blocked by a missing input (COGS / capacity model / opex / CSAT) →
//          DECLARED (catalogue entry, no resolver) so the UI lists the metric and
//          its exact blocker rather than inventing a figure.
//
// PERMISSION: executive reporting exposes whole-company commercial signal. Every
// mgt KPI carries MGT_REPORT_PERMISSION (= EXECUTIVE_ROLES), so the engine's
// per-KPI permission gate (Phase-1 §14) restricts it to Dealer Principal / Owner,
// Directors and Senior Management. Operational department managers (workshop /
// parts / service managers etc.) are intentionally excluded — they keep their
// department reporting packages unless explicitly granted an executive role.
// Executives auto-pass the engine gate (EXECUTIVE scope level) AND carry the
// financial-sensitive flag, so composed financial inputs (acc.*) resolve for them.

import { defineKpi } from "../kpiCatalog";
import { getKpi } from "../kpiCatalog";
import { EXECUTIVE_ROLES } from "../permissionScope";

// ---------------------------------------------------------------------------
// Permission: executive-only. EXECUTIVE_ROLES already resolve to the EXECUTIVE
// scope level (so they auto-pass scopeSatisfiesKpiPermission), but listing them
// explicitly keeps the gate declarative and refuses cross-department managers who
// only reach CROSS_DEPARTMENT level.
// ---------------------------------------------------------------------------
export const MGT_REPORT_PERMISSION = Object.freeze([...EXECUTIVE_ROLES]);

// ---------------------------------------------------------------------------
// Composition helpers — the ONLY way this package reads a metric. They run an
// existing department KPI's own resolver / drilldown within the caller's context,
// so the department formula is reused verbatim and nothing is recomputed here.
// Returns null/[] (never throws) so one missing input degrades a composite
// gracefully rather than erroring the whole executive dashboard (Principle 9).
// ---------------------------------------------------------------------------
async function runKpi(id, ctx) {
  const kpi = getKpi(id);
  if (!kpi || typeof kpi.resolver !== "function") return null;
  try {
    return (await kpi.resolver(ctx)) || null;
  } catch (err) {
    console.warn(`[reporting] mgt compose: ${id} resolver failed:`, err?.message || err);
    return null;
  }
}

async function runDrilldown(id, ctx) {
  const kpi = getKpi(id);
  if (!kpi || typeof kpi.drilldown !== "function") return [];
  try {
    return (await kpi.drilldown(ctx)) || [];
  } catch (err) {
    console.warn(`[reporting] mgt compose: ${id} drilldown failed:`, err?.message || err);
    return [];
  }
}

const round1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
const round2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : null);
const growthPct = (cur, prior) => (prior > 0 ? Math.round(((cur - prior) / prior) * 1000) / 10 : null);
const ratioPct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

// Shift an ISO timestamp back N years (for YoY windows). Normal app-code Date use.
function shiftYears(iso, years) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString();
}

// Per-department headline composition for the Department Performance Index. Each
// department contributes TWO existing R1/R2 KPIs (a throughput / volume metric and
// a quality / efficiency metric) read through their own resolvers — no new maths.
const DEPARTMENT_HEADLINES = [
  { code: "workshop", label: "Workshop", primary: "wsh.jobs_completed", quality: "wsh.tech_efficiency" },
  { code: "parts", label: "Parts", primary: "prt.fitted", quality: "prt.margin" },
  { code: "service", label: "Service Advisors", primary: "svc.booking_volume", quality: "svc.vhc_send_rate" },
  { code: "mot", label: "MOT", primary: "mot.volume", quality: "mot.pass_rate" },
  { code: "valeting", label: "Valeting", primary: "val.cars_washed", quality: "val.completion_rate" },
  { code: "paint", label: "Paint / Bodyshop", primary: "pnt.jobs_completed", quality: "pnt.cycle_time" },
  { code: "accounts", label: "Accounts", primary: "acc.revenue", quality: "acc.outstanding_invoices" },
];

export const managementKpis = [
  // =========================================================================
  // COMPANY REVENUE — EXECUTIVE · R1. Σ acc.revenue (company total). Per-
  // department split needs the department dimension (R2) and is flagged, not
  // invented; the total is fully live by composing the Accounts revenue KPIs.
  // =========================================================================
  defineKpi({
    id: "mgt.company_revenue",
    label: "Company Revenue",
    department: "management",
    relatedDepartments: ["accounts", "workshop", "parts", "service"],
    description: "Whole-company invoiced revenue in the period, with the labour / parts split.",
    purpose: "Headline commercial output of the business.",
    formula: "Σ acc.revenue (grouped by owner_department where the dimension exists)",
    sourceTables: ["invoices"],
    sourceEvents: ["INVOICE_CREATED", "INVOICE_ISSUED"],
    dependsOn: ["acc.revenue", "acc.labour_revenue", "acc.parts_revenue"],
    tier: "executive",
    readiness: "R1",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    permission: MGT_REPORT_PERMISSION,
    example: "£300k/month",
    futureNotes:
      "Composes acc.revenue (total), acc.labour_revenue and acc.parts_revenue verbatim. The per-OWNER-DEPARTMENT revenue split (workshop vs parts vs service contribution) needs the department dimension stamped on invoice/revenue events (R2); the company total and the labour/parts breakdown are fully live today.",
    drilldown: async (ctx) => runDrilldown("acc.revenue", ctx),
    resolver: async (ctx) => {
      const [rev, labour, parts] = await Promise.all([
        runKpi("acc.revenue", ctx),
        runKpi("acc.labour_revenue", ctx),
        runKpi("acc.parts_revenue", ctx),
      ]);
      const total = rev?.amountGbp ?? rev?.value ?? null;
      return {
        value: total,
        amountGbp: total,
        count: rev?.count ?? null,
        breakdown: {
          total_revenue: total,
          invoices: rev?.count ?? null,
          labour_revenue: labour?.amountGbp ?? null,
          parts_revenue: parts?.amountGbp ?? null,
          department_split_available: false,
        },
      };
    },
  }),

  // =========================================================================
  // VHC UPSELL CONTRIBUTION — STRATEGIC · R1. vhc.upsell_revenue ÷ acc.revenue.
  // Both inputs are R1; the contribution % is fully live today.
  // =========================================================================
  defineKpi({
    id: "mgt.upsell_contribution",
    label: "VHC Upsell Contribution",
    department: "management",
    relatedDepartments: ["workshop", "service", "accounts"],
    description: "Authorised VHC upsell value as a share of company revenue.",
    purpose: "How much of the top line is driven by inspection-led upsell.",
    formula: "vhc.upsell_revenue ÷ acc.revenue × 100",
    numerator: "Σ vhc_checks.authorized_total_gbp",
    denominator: "Σ invoices.grand_total",
    sourceTables: ["vhc_checks", "invoices"],
    sourceEvents: ["VHC_AUTHORISED", "INVOICE_CREATED"],
    dependsOn: ["vhc.upsell_revenue", "acc.revenue"],
    tier: "strategic",
    readiness: "R1",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    permission: MGT_REPORT_PERMISSION,
    example: "£45k ÷ £300k = 15%",
    futureNotes:
      "Composes vhc.upsell_revenue (authorised VHC value, R1) over acc.revenue (R1). No advisor-level attribution is implied — that stays in the Service package (R2, advisor stamp on VHC_SENT).",
    resolver: async (ctx) => {
      const [upsell, rev] = await Promise.all([
        runKpi("vhc.upsell_revenue", ctx),
        runKpi("acc.revenue", ctx),
      ]);
      const upsellGbp = upsell?.amountGbp ?? upsell?.value ?? 0;
      const revGbp = rev?.amountGbp ?? rev?.value ?? 0;
      const value = ratioPct(upsellGbp, revGbp);
      return {
        value,
        numerator: round2(upsellGbp),
        denominator: round2(revGbp),
        breakdown: {
          upsell_revenue: round2(upsellGbp),
          total_revenue: round2(revGbp),
          contribution_pct: value,
        },
      };
    },
  }),

  // =========================================================================
  // SITE LABOUR RECOVERY — EXECUTIVE · R2. Whole-site Σ sold_hours ÷ Σ
  // clocked_hours — the site-wide version of wsh.labour_recovery, composed from
  // the two R1 hour KPIs. R2 because the catalogue flags the clocking-source
  // reconciliation (D5) before the ratio is fully trustworthy.
  // =========================================================================
  defineKpi({
    id: "mgt.site_recovery",
    label: "Site Labour Recovery",
    department: "management",
    relatedDepartments: ["workshop"],
    description: "Whole-site sold hours recovered against hours clocked.",
    purpose: "Site-wide labour productivity / recovery health.",
    formula: "Σ sold_hours ÷ Σ clocked_hours × 100 (site-wide)",
    numerator: "wsh.sold_hours",
    denominator: "wsh.clocked_hours",
    sourceTables: ["job_requests", "vhc_checks", "time_records", "job_clocking"],
    sourceEvents: ["CLOCK_OFF", "JOB_COMPLETED", "VHC_AUTHORISED"],
    dependsOn: ["wsh.sold_hours", "wsh.clocked_hours"],
    tier: "executive",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "band",
    permission: MGT_REPORT_PERMISSION,
    example: "Σ 320 sold ÷ Σ 300 clocked = 106.7%",
    futureNotes:
      "Composes wsh.sold_hours (R1) and wsh.clocked_hours (R1). R2 per the catalogue: the two clocking systems (job_clocking vs time_records, debt D5) must be reconciled before the site recovery ratio is fully trustworthy. Both inputs compute today, so the figure is live (clearly labelled).",
    resolver: async (ctx) => {
      const [sold, clocked] = await Promise.all([
        runKpi("wsh.sold_hours", ctx),
        runKpi("wsh.clocked_hours", ctx),
      ]);
      const soldH = sold?.value ?? 0;
      const clockedH = clocked?.value ?? 0;
      const value = ratioPct(soldH, clockedH);
      return {
        value,
        numerator: round1(soldH),
        denominator: round1(clockedH),
        breakdown: {
          sold_hours: round1(soldH),
          clocked_hours: round1(clockedH),
          recovery_pct: value,
        },
      };
    },
  }),

  // =========================================================================
  // DEPARTMENT PERFORMANCE INDEX — EXECUTIVE · R2. Cross-department comparison
  // composed from each department's existing headline KPIs. The single NORMALISED
  // index score needs the dim_kpi weighting model + TARGET_SET targets (declared);
  // the per-department composed KPI VALUES (the comparison table the executives
  // actually read) are live today.
  // =========================================================================
  defineKpi({
    id: "mgt.department_performance",
    label: "Department Performance Index",
    department: "management",
    relatedDepartments: ["workshop", "parts", "service", "mot", "valeting", "paint", "accounts"],
    description: "Side-by-side comparison of every operational department's headline KPIs.",
    purpose: "Cross-department ranking / comparison for executive oversight.",
    formula: "weighted, normalised blend of each department's tactical KPIs (weights in dim_kpi)",
    sourceTables: ["kpi_daily_snapshot"],
    sourceEvents: ["SNAPSHOT_BUILT"],
    dependsOn: DEPARTMENT_HEADLINES.flatMap((d) => [d.primary, d.quality]),
    tier: "executive",
    readiness: "R2",
    aggregation: "distinct",
    unit: "count",
    format: "0,0",
    targetType: "informational",
    permission: MGT_REPORT_PERMISSION,
    futureNotes:
      "Composes each department's existing headline KPIs (throughput + quality) verbatim through their own resolvers — no new department maths. R2: the single NORMALISED performance INDEX score (and a true cross-department ranking) needs the dim_kpi weighting model and TARGET_SET targets, which are declared; until then the per-department composed KPI values are surfaced for direct comparison rather than collapsing them into an invented weighted score.",
    resolver: async (ctx) => {
      const departments = await Promise.all(
        DEPARTMENT_HEADLINES.map(async (d) => {
          const [primary, quality] = await Promise.all([
            runKpi(d.primary, ctx),
            runKpi(d.quality, ctx),
          ]);
          const primaryValue = primary?.amountGbp ?? primary?.value ?? null;
          const qualityValue = quality?.value ?? null;
          return {
            department: d.code,
            label: d.label,
            primary_kpi: d.primary,
            primary_value: primaryValue,
            quality_kpi: d.quality,
            quality_value: qualityValue,
            reporting: primaryValue != null || qualityValue != null,
          };
        })
      );
      const covered = departments.filter((r) => r.reporting).length;
      return {
        value: covered,
        count: covered,
        breakdown: {
          departments_reporting: covered,
          departments_total: departments.length,
          index_available: false,
          departments,
        },
      };
    },
  }),

  // =========================================================================
  // GROWTH (YoY) — EXECUTIVE · R2. (this − same period last year) ÷ last year.
  // Composes acc.revenue + wsh.jobs_completed for the current and prior-year
  // windows. R2: meaningful YoY needs ≥13 months of history — until the data
  // spans a year the prior-year window is empty and the value is null (not faked).
  // =========================================================================
  defineKpi({
    id: "mgt.growth",
    label: "Growth (YoY)",
    department: "management",
    relatedDepartments: ["accounts", "workshop"],
    description: "Year-on-year change in revenue and throughput.",
    purpose: "Strategic growth direction of the business.",
    formula: "(this_period − same_period_last_year) ÷ last_year × 100",
    sourceTables: ["invoices", "jobs"],
    sourceEvents: ["SNAPSHOT_BUILT", "INVOICE_CREATED"],
    dependsOn: ["acc.revenue", "wsh.jobs_completed"],
    tier: "executive",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    permission: MGT_REPORT_PERMISSION,
    example: "(£330k − £300k) ÷ £300k = +10%",
    futureNotes:
      "Composes acc.revenue and wsh.jobs_completed for the selected window and the same window one year earlier (the literal YoY formula). R2: needs ≥13 months of operational history for the prior-year window to be populated — until then prior-year is empty and growth resolves to null rather than a fabricated figure. Snapshot-backed YoY (yearly rollups) firms this up further.",
    resolver: async (ctx) => {
      const { filter } = ctx;
      const dr = filter?.dateRange || {};
      const priorFrom = dr.from ? shiftYears(dr.from, 1) : null;
      const priorTo = dr.to ? shiftYears(dr.to, 1) : null;
      const priorCtx =
        priorFrom && priorTo
          ? { ...ctx, filter: { ...filter, dateRange: { from: priorFrom, to: priorTo, preset: null } } }
          : null;

      const [curRev, curJobs] = await Promise.all([
        runKpi("acc.revenue", ctx),
        runKpi("wsh.jobs_completed", ctx),
      ]);
      const [priorRev, priorJobs] = priorCtx
        ? await Promise.all([runKpi("acc.revenue", priorCtx), runKpi("wsh.jobs_completed", priorCtx)])
        : [null, null];

      const cR = curRev?.amountGbp ?? curRev?.value ?? 0;
      const pR = priorRev?.amountGbp ?? priorRev?.value ?? 0;
      const cJ = curJobs?.value ?? 0;
      const pJ = priorJobs?.value ?? 0;
      const revenueGrowth = growthPct(cR, pR);

      return {
        value: revenueGrowth,
        numerator: round2(cR - pR),
        denominator: round2(pR),
        breakdown: {
          current_revenue: round2(cR),
          prior_year_revenue: round2(pR),
          revenue_growth_pct: revenueGrowth,
          current_throughput: cJ,
          prior_year_throughput: pJ,
          throughput_growth_pct: growthPct(cJ, pJ),
          prior_year_data_available: pR > 0 || pJ > 0,
        },
      };
    },
  }),

  // =========================================================================
  // FORECASTING INPUTS — STRATEGIC · R2. The curated input series (revenue,
  // throughput, bookings, site recovery) ready for forecasting — NOT a forecast.
  // Live now as current-period values; the forecast-ready ≥13m daily series needs
  // the snapshot spine to accrue.
  // =========================================================================
  defineKpi({
    id: "mgt.forecast_inputs",
    label: "Forecasting Inputs",
    department: "management",
    relatedDepartments: ["accounts", "workshop", "service"],
    description: "Curated executive input series (revenue, throughput, bookings, recovery) for forecasting.",
    purpose: "The forecast-ready inputs, not the forecast itself.",
    formula: "curated time-series of revenue / throughput / bookings / recovery",
    sourceTables: ["kpi_daily_snapshot"],
    sourceEvents: ["SNAPSHOT_BUILT"],
    dependsOn: ["acc.revenue", "wsh.jobs_completed", "svc.booking_volume", "wsh.sold_hours", "wsh.clocked_hours"],
    tier: "strategic",
    readiness: "R2",
    aggregation: "distinct",
    unit: "count",
    format: "0,0",
    targetType: "informational",
    permission: MGT_REPORT_PERMISSION,
    futureNotes:
      "Composes the current-period values of acc.revenue, wsh.jobs_completed, svc.booking_volume and site recovery (wsh.sold_hours ÷ wsh.clocked_hours). R2: forecasting needs ≥13 months of daily snapshots — this KPI surfaces the curated inputs today; the forecast-ready historical series lands once the snapshot spine accrues.",
    resolver: async (ctx) => {
      const [rev, jobs, bookings, sold, clocked] = await Promise.all([
        runKpi("acc.revenue", ctx),
        runKpi("wsh.jobs_completed", ctx),
        runKpi("svc.booking_volume", ctx),
        runKpi("wsh.sold_hours", ctx),
        runKpi("wsh.clocked_hours", ctx),
      ]);
      const recovery = ratioPct(sold?.value ?? 0, clocked?.value ?? 0);
      const inputs = {
        revenue: rev?.amountGbp ?? null,
        throughput: jobs?.value ?? null,
        bookings: bookings?.value ?? null,
        site_recovery_pct: recovery,
      };
      const available = Object.values(inputs).filter((v) => v != null).length;
      return {
        value: available,
        count: available,
        breakdown: {
          series_available: available,
          series_total: Object.keys(inputs).length,
          ...inputs,
        },
      };
    },
  }),

  // =========================================================================
  // DECLARED — R2 (no resolver). These need a model the platform does not yet
  // capture (durable stage dwell / SLA targets). The engine reports them as
  // "declared, readiness R2" so the UI lists the metric and its exact blocker.
  // =========================================================================
  defineKpi({
    id: "mgt.bottleneck",
    label: "Bottleneck Detection",
    department: "management",
    relatedDepartments: ["workshop", "parts", "valeting", "paint"],
    description: "The stage with the largest dwell / backlog growth across job, parts, VHC and paint flows.",
    formula: "rank stages by stage_dwell + backlog trend across job/parts/VHC/paint",
    sourceTables: ["report_event"],
    sourceEvents: ["JOB_STATUS_CHANGED", "PART_STATUS_CHANGED", "VHC_ITEM_STATUS_CHANGED", "PAINT_STAGE_CHANGED"],
    tier: "strategic",
    readiness: "R2",
    aggregation: "distinct",
    unit: "count",
    format: "0,0",
    targetType: "informational",
    permission: MGT_REPORT_PERMISSION,
    futureNotes:
      "R2 — DECLARED. Ranking stages by dwell needs the *_status_history tables + backlog entity-state snapshots (none accrue yet; emits are gated). The Capacity & Bottlenecks tab surfaces the buildable workload proxies today (open WIP, open parts by status, outstanding invoices, valet/paint queues); the true dwell-ranked bottleneck lights up once status-history accrues.",
  }),
  defineKpi({
    id: "mgt.sla_attainment",
    label: "SLA Attainment",
    department: "management",
    relatedDepartments: ["workshop", "parts", "service"],
    description: "Share of stages completed within their SLA target.",
    formula: "COUNT(stages within SLA) ÷ COUNT(stages) × 100",
    sourceTables: ["report_event"],
    sourceEvents: ["JOB_STATUS_CHANGED", "TARGET_SET"],
    tier: "strategic",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    permission: MGT_REPORT_PERMISSION,
    futureNotes:
      "R2 — DECLARED. Needs both a stage-duration source (*_status_history) and an SLA/target model (TARGET_SET events). Neither exists yet, so no SLA attainment can be measured without inventing thresholds.",
  }),

  // =========================================================================
  // DECLARED — R3 (no resolver). Blocked by a missing input the catalogue marks
  // R3: COGS / capacity model / opex / CSAT capture. No proxy is invented.
  // =========================================================================
  defineKpi({
    id: "mgt.company_profitability",
    label: "Company Profitability",
    department: "management",
    relatedDepartments: ["accounts", "workshop", "parts"],
    description: "Whole-company gross profit (Σ department gross profit).",
    formula: "Σ department gross_profit",
    sourceTables: ["invoices", "invoice_items"],
    sourceEvents: ["INVOICE_CREATED"],
    dependsOn: ["acc.gross_profit", "wsh.profitability", "prt.profitability"],
    tier: "executive",
    readiness: "R3",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    permission: MGT_REPORT_PERMISSION,
    futureNotes:
      "R3 — DECLARED. Full company GP needs COGS on invoice lines (acc.gross_profit is R3). Parts GP (prt.profitability) is live and labour GP (wsh.profitability) is R2; a partial labour+parts GP can be assembled once wsh.profitability lands, but the company figure requires profitability modelling (COGS). No GP is invented here.",
  }),
  defineKpi({
    id: "mgt.capacity_utilisation",
    label: "Capacity Utilisation",
    department: "management",
    relatedDepartments: ["workshop"],
    description: "Site clocked hours against site available capacity hours.",
    formula: "site clocked_hours ÷ site available_hours",
    sourceTables: ["job_clocking", "time_records"],
    sourceEvents: ["CLOCK_OFF"],
    dependsOn: ["wsh.clocked_hours", "wsh.capacity"],
    tier: "executive",
    readiness: "R3",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "band",
    permission: MGT_REPORT_PERMISSION,
    futureNotes:
      "R3 — DECLARED. Clocked hours are live (wsh.clocked_hours) but there is no capacity / available-hours model (no ramp/bay/shift entity), so utilisation cannot be computed without inventing a denominator.",
  }),
  defineKpi({
    id: "mgt.cost_to_serve",
    label: "Cost to Serve",
    department: "management",
    relatedDepartments: ["accounts", "workshop"],
    description: "Total cost per job completed.",
    formula: "total cost ÷ jobs completed",
    sourceTables: ["invoices", "jobs"],
    sourceEvents: ["JOB_COMPLETED", "INVOICE_CREATED"],
    dependsOn: ["acc.net_profit", "wsh.jobs_completed"],
    tier: "executive",
    readiness: "R3",
    aggregation: "ratio",
    unit: "currency",
    format: "£0,0.00",
    targetType: "lower_is_better",
    permission: MGT_REPORT_PERMISSION,
    futureNotes:
      "R3 — DECLARED. Jobs-completed is live (wsh.jobs_completed) but total cost needs a full cost / opex model (acc.net_profit is R3, likely an accounting-system integration). No cost figure is invented.",
  }),
  defineKpi({
    id: "mgt.customer_satisfaction",
    label: "Customer Satisfaction",
    department: "management",
    relatedDepartments: ["service"],
    description: "Company customer satisfaction / NPS.",
    formula: "mean(survey score) / NPS",
    sourceTables: [],
    tier: "strategic",
    readiness: "R3",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    permission: MGT_REPORT_PERMISSION,
    futureNotes:
      "R3 — DECLARED. No CSAT/NPS capture exists (needs a survey integration); the same blocker as svc.csat. An interim response-time + conversion proxy becomes possible once those Service R2 inputs land.",
  }),
];

export default managementKpis;
