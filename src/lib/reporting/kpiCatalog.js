// file location: src/lib/reporting/kpiCatalog.js
//
// PRIORITY 5 — KPI framework (Phase-1 §9.7, Phase-3 §0). The registry of every
// KPI: ONE canonical definition per metric (Principle 2 / ADR-4). Screens
// reference KPIs by id; no screen re-implements a metric.
//
// `defineKpi` enforces the Phase-3 §0.1 "KPI Definition Standard" (the 22 fields)
// by filling defaults, so each definition states only what is distinctive. The
// registry is populated by src/lib/reporting/kpiDefinitions/* (the seed R1 set)
// and is the plug-in point for every future report package — adding a metric is
// `registerKpi(defineKpi({...}))`, never editing a screen.

import { isDepartmentCode } from "./config/departments";
import { scopeSatisfiesKpiPermission } from "./permissionScope";

export const KPI_TIERS = Object.freeze(["operational", "tactical", "strategic", "executive"]);
export const KPI_READINESS = Object.freeze(["R1", "R2", "R3"]);
export const KPI_AGGREGATIONS = Object.freeze(["sum", "ratio", "point_in_time", "duration", "distinct"]);
export const KPI_TARGET_TYPES = Object.freeze(["higher_is_better", "lower_is_better", "band", "informational"]);
export const KPI_SOURCE_TYPES = Object.freeze(["rollup", "snapshot", "live"]);

// Build a complete KPI catalogue entry from a partial definition, applying the
// Phase-3 §0.1 defaults. Throws on the few hard-required fields so a malformed
// definition fails fast at registration rather than at query time.
export function defineKpi(def = {}) {
  if (!def.id) throw new Error("defineKpi: `id` is required");
  if (!def.department || !isDepartmentCode(def.department)) {
    throw new Error(`defineKpi(${def.id}): valid \`department\` is required`);
  }
  if (typeof def.resolver !== "function") {
    // A resolver is what makes a KPI computable. Definitions without one are
    // "declared but not yet implemented" — allowed, but flagged.
    // (Useful so the full ~110-KPI catalogue can be declared incrementally.)
  }
  return Object.freeze({
    // Identity
    id: def.id,
    label: def.label || def.id,
    department: def.department,
    relatedDepartments: def.relatedDepartments || [],
    // Definition
    description: def.description || "",
    purpose: def.purpose || "",
    formula: def.formula || "",
    numerator: def.numerator || null,
    denominator: def.denominator || null,
    // Sources
    sourceTables: def.sourceTables || [],
    sourceEvents: def.sourceEvents || [],
    sourceHistories: def.sourceHistories || [],
    snapshotSource: def.snapshotSource || "kpi_daily_snapshot",
    dependsOn: def.dependsOn || [],
    // Computation
    calcFrequency: def.calcFrequency || "daily",
    aggregation: KPI_AGGREGATIONS.includes(def.aggregation) ? def.aggregation : "sum",
    trend: def.trend || { default: "line" },
    unit: def.unit || "count",
    format: def.format || "0,0",
    sourceType: KPI_SOURCE_TYPES.includes(def.sourceType) ? def.sourceType : "live",
    formulaVersion: def.formulaVersion || "v1",
    // Classification
    tier: KPI_TIERS.includes(def.tier) ? def.tier : "operational",
    classification: def.classification || (def.tier ? def.tier.toUpperCase() : "OPERATIONAL"),
    readiness: KPI_READINESS.includes(def.readiness) ? def.readiness : "R1",
    targetType: KPI_TARGET_TYPES.includes(def.targetType) ? def.targetType : "informational",
    // Access + drill
    permission: def.permission || [], // [] = any authenticated reporting user
    drilldown: def.drilldown || null, // descriptor consumed by drilldown.js
    // Docs
    example: def.example || "",
    relatedReports: def.relatedReports || [],
    futureNotes: def.futureNotes || "",
    // The pure computation: async (ctx) => { value, numerator, denominator, count, amountGbp }
    resolver: typeof def.resolver === "function" ? def.resolver : null,
  });
}

// ---- The registry -------------------------------------------------------
const registry = new Map();

export function registerKpi(entry) {
  const kpi = entry && entry.resolver !== undefined ? entry : defineKpi(entry);
  if (registry.has(kpi.id)) {
    console.warn(`[reporting] KPI "${kpi.id}" re-registered — overwriting`);
  }
  registry.set(kpi.id, kpi);
  return kpi;
}

export function registerKpis(entries = []) {
  entries.forEach(registerKpi);
}

export function getKpi(id) {
  return registry.get(id) || null;
}

export function hasKpi(id) {
  return registry.has(id);
}

// List KPIs, optionally filtered by department / tier / readiness / implemented.
export function listKpis({ department, tier, readiness, implemented } = {}) {
  let items = Array.from(registry.values());
  if (department) items = items.filter((k) => k.department === department);
  if (tier) items = items.filter((k) => k.tier === tier);
  if (readiness) items = items.filter((k) => k.readiness === readiness);
  if (implemented === true) items = items.filter((k) => typeof k.resolver === "function");
  if (implemented === false) items = items.filter((k) => typeof k.resolver !== "function");
  return items;
}

export function getKpisForDepartment(department) {
  return listKpis({ department });
}

// KPIs a given permission scope is allowed to see (Phase-1 §14 KPI-level gate).
export function getKpisForScope(scope, filter = {}) {
  return listKpis(filter).filter((k) => scopeSatisfiesKpiPermission(scope, k.permission));
}

export function catalogSize() {
  return registry.size;
}

// Test / hot-reload support.
export function clearCatalog() {
  registry.clear();
}

export default registry;
