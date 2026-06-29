// file location: src/lib/reporting/engine.js
//
// THE REPORTING ENGINE (Phase-1 §9.1). The single thing the reporting API calls.
// Pure read. It ties together: catalogue → permission scope → cache → resolver /
// trendBuilder / drilldown → provenance. It NEVER writes operational state.
//
// Every method enforces the per-KPI permission gate (Phase-1 §14) and injects the
// caller's scope, returning a structured result { ...data, provenance, scope,
// warnings }. The API layer wraps that in the standard envelope.

import "./kpiDefinitions"; // side-effect: registers the seed catalogue
import { getKpi, getKpisForScope } from "./kpiCatalog";
import { scopeSatisfiesKpiPermission, canSeeDepartment, scopeWarnings } from "./permissionScope";
import { withReportingCache } from "./cache";
import { resolveKpiValue } from "./resolver";
import { buildTrend } from "./trendBuilder";
import { resolveDrilldown } from "./drilldown";
import { unavailableProvenance } from "./provenance";

function kpiDepartments(kpi) {
  return Array.from(new Set([kpi?.department, ...(kpi?.relatedDepartments || [])].filter(Boolean)));
}

function canSeeKpiDepartment(scope, kpi) {
  return kpiDepartments(kpi).some((department) => canSeeDepartment(scope, department));
}

// Guard: can this scope see this KPI at all (KPI-level permission + dept scope)?
function gate(kpi, scope, filter) {
  if (!kpi) return { ok: false, warnings: ["unknown KPI"] };
  if (!scopeSatisfiesKpiPermission(scope, kpi.permission)) {
    return { ok: false, warnings: [`not permitted to view "${kpi.id}"`] };
  }
  if (!canSeeKpiDepartment(scope, kpi)) {
    return { ok: false, warnings: [`"${kpi.id}" is outside your reporting department scope`] };
  }
  const warnings = [];
  // If a department filter is requested outside scope, narrow + warn.
  if (filter?.department) warnings.push(...scopeWarnings(scope, filter.department));
  // Force the department filter to one the scope can see (defence in depth).
  let scopedFilter = filter;
  if (filter?.department && !canSeeDepartment(scope, filter.department)) {
    scopedFilter = { ...filter, department: null };
  }
  return { ok: true, warnings, scopedFilter };
}

// Resolve a single KPI point value for the caller.
export async function getKpiValue(kpiId, ctx = {}) {
  const { scope, filter } = ctx;
  const kpi = getKpi(kpiId);
  const g = gate(kpi, scope, filter);
  if (!g.ok) {
    return { kpiId, value: null, provenance: unavailableProvenance(g.warnings[0]), scope, warnings: g.warnings };
  }
  const effectiveCtx = { filter: g.scopedFilter, scope };
  const result = await withReportingCache("kpi", { kpiId, filter: g.scopedFilter, scope }, () =>
    resolveKpiValue(kpi, effectiveCtx)
  );
  return {
    kpiId,
    label: kpi.label,
    unit: kpi.unit,
    format: kpi.format,
    targetType: kpi.targetType,
    ...result,
    scope,
    warnings: g.warnings,
  };
}

// Resolve many KPIs (e.g. a scorecard strip). Runs concurrently.
export async function getKpiValues(kpiIds = [], ctx = {}) {
  const results = await Promise.all(kpiIds.map((id) => getKpiValue(id, ctx)));
  return results;
}

// Build a trend series for a KPI.
export async function getTrend(kpiId, ctx = {}) {
  const { scope, filter } = ctx;
  const kpi = getKpi(kpiId);
  const g = gate(kpi, scope, filter);
  if (!g.ok) {
    return { kpiId, series: [], provenance: unavailableProvenance(g.warnings[0]), scope, warnings: g.warnings };
  }
  const effectiveCtx = { filter: g.scopedFilter, scope };
  const liveResolver =
    typeof kpi.resolver === "function"
      ? async (bucketKey) => {
          // Per-bucket live recompute: narrow the filter to that single day.
          const dayFilter = { ...g.scopedFilter, dateRange: { from: `${bucketKey}T00:00:00.000Z`, to: `${bucketKey}T23:59:59.999Z`, preset: null } };
          const out = (await kpi.resolver({ filter: dayFilter, scope })) || {};
          return { value: out.value ?? null, numerator: out.numerator ?? null, denominator: out.denominator ?? null, count: out.count ?? null, amountGbp: out.amountGbp ?? null };
        }
      : null;
  const result = await withReportingCache("trend", { kpiId, filter: g.scopedFilter, scope }, () =>
    buildTrend(kpi, { ...effectiveCtx, liveResolver })
  );
  return { kpiId, label: kpi.label, aggregation: kpi.aggregation, ...result, scope, warnings: g.warnings };
}

// Drill-down: the contributing records behind a KPI value.
export async function getDrilldown(kpiId, ctx = {}) {
  const { scope, filter } = ctx;
  const kpi = getKpi(kpiId);
  const g = gate(kpi, scope, filter);
  if (!g.ok) return { kpiId, rows: [], warnings: g.warnings, scope };
  const out = await resolveDrilldown(kpiId, { filter: g.scopedFilter, scope });
  return { kpiId, ...out, scope, warnings: [...g.warnings, ...(out.warnings || [])] };
}

// The catalogue a scope is allowed to see (for menus, scorecard composition).
export function getVisibleCatalog(scope, filter = {}) {
  return getKpisForScope(scope, filter).filter((k) => canSeeKpiDepartment(scope, k)).map((k) => ({
    id: k.id,
    label: k.label,
    department: k.department,
    tier: k.tier,
    readiness: k.readiness,
    unit: k.unit,
    format: k.format,
    targetType: k.targetType,
    implemented: typeof k.resolver === "function",
    hasDrilldown: typeof k.drilldown === "function",
  }));
}

const engine = {
  getKpiValue,
  getKpiValues,
  getTrend,
  getDrilldown,
  getVisibleCatalog,
};
export default engine;
