// file location: src/lib/reporting/drilldown.js
//
// DRILL-DOWN framework (Phase-1 §9.8). Every summary value is drillable to the
// contributing records. A KPI carries a `drilldown` descriptor/function; this
// module runs it within the caller's scope and returns the rows that sum to the
// number, with the source-entity link so the UI can deep-link (job card, invoice,
// part line). A drill-down can itself nest (department → tech → job).

import { getKpi } from "./kpiCatalog";
import { scopeSatisfiesKpiPermission } from "./permissionScope";

// Run a KPI's drill-down. `ctx` = { filter, scope }. Returns
// { ok, rows, entityType, warnings } — never throws.
export async function resolveDrilldown(kpiId, ctx = {}) {
  const kpi = getKpi(kpiId);
  if (!kpi) return { ok: false, rows: [], warnings: [`unknown KPI "${kpiId}"`] };

  // Permission gate (same as the KPI itself — you can only drill what you can see).
  if (!scopeSatisfiesKpiPermission(ctx.scope, kpi.permission)) {
    return { ok: false, rows: [], warnings: ["not permitted to drill into this KPI"] };
  }

  if (typeof kpi.drilldown !== "function") {
    return {
      ok: false,
      rows: [],
      warnings: [`KPI "${kpiId}" has no drill-down defined yet`],
    };
  }

  try {
    const rows = (await kpi.drilldown(ctx)) || [];
    return {
      ok: true,
      rows,
      entityType: deriveEntityType(kpi),
      count: rows.length,
      warnings: [],
    };
  } catch (err) {
    console.warn(`[reporting] drilldown for ${kpiId} threw:`, err?.message || err);
    return { ok: false, rows: [], warnings: [`drilldown error: ${err?.message || "unknown"}`] };
  }
}

// Best-effort entity type for row-link rendering, from the KPI's first source table.
function deriveEntityType(kpi) {
  const t = (kpi.sourceTables || [])[0] || "";
  if (t === "jobs") return "job";
  if (t === "invoices") return "invoice";
  if (t === "parts_job_items") return "part_line";
  if (t === "vhc_checks") return "vhc_item";
  if (t === "appointments") return "appointment";
  return t || "record";
}

export default resolveDrilldown;
