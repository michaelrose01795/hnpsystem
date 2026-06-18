// file location: src/lib/reporting/resolver.js
//
// RESOLVER (Phase-1 §9.1 / ADR-5). Given a KPI id + context (filter, scope), it
// picks the source per request — rollup/snapshot (fast path) → live helper
// (labelled fallback) — and returns the value with provenance attached
// (Principle 10). The engine is the only caller.
//
// Source order:
//   1. snapshot/rollup for the requested period (if a matching row exists) — fast,
//      consistent, the default for trends/history (G8).
//   2. live fallback: run the KPI's `resolver` against operational tables, clearly
//      labelled `live:true` in provenance (Principle 9).
//   3. none: the KPI has no resolver yet → empty value, labelled unavailable.

import { readSnapshots } from "@/lib/database/reporting/snapshots";
import { getReportingFlag } from "./config/flags";
import { buildProvenance, liveFallbackProvenance, unavailableProvenance } from "./provenance";

const pad2 = (n) => String(n).padStart(2, "0");

// The snapshot "day" key for a point KPI is the end of the requested range.
function snapshotDayFor(filter) {
  const to = filter?.dateRange?.to ? new Date(filter.dateRange.to) : new Date();
  return `${to.getFullYear()}-${pad2(to.getMonth() + 1)}-${pad2(to.getDate())}`;
}

// Resolve a single KPI point value for a filter context.
// Returns { value, numerator, denominator, count, amountGbp, breakdown?, provenance }.
export async function resolveKpiValue(kpi, ctx = {}) {
  const { filter, scope } = ctx;
  const department = filter?.department || "all";

  // 1. Snapshot fast path — only for a single-day "as of" request where a daily
  //    snapshot is the natural source. (Range aggregation across many days is the
  //    trend path; point KPIs read the end-of-range snapshot if present.)
  try {
    const day = snapshotDayFor(filter);
    const rows = await readSnapshots("daily", { kpiId: kpi.id, department, from: day, to: day });
    if (rows.length > 0) {
      const r = rows[0];
      return {
        value: r.value != null ? Number(r.value) : null,
        numerator: r.numerator != null ? Number(r.numerator) : null,
        denominator: r.denominator != null ? Number(r.denominator) : null,
        count: r.count != null ? Number(r.count) : null,
        amountGbp: r.amount_gbp != null ? Number(r.amount_gbp) : null,
        provenance: buildProvenance({
          source: "snapshot",
          asOf: r.built_at,
          formulaVersion: r.formula_version || kpi.formulaVersion,
          dependsOn: kpi.dependsOn,
        }),
      };
    }
  } catch {
    /* snapshot read failed — fall through to live */
  }

  // 2. Live fallback — run the KPI's own resolver against operational tables.
  if (typeof kpi.resolver === "function") {
    if (!getReportingFlag("reporting_live_fallback_enabled")) {
      return {
        value: null,
        provenance: unavailableProvenance("live fallback disabled and no snapshot available"),
      };
    }
    try {
      const out = (await kpi.resolver({ filter, scope })) || {};
      return {
        value: out.value ?? null,
        numerator: out.numerator ?? null,
        denominator: out.denominator ?? null,
        count: out.count ?? null,
        amountGbp: out.amountGbp ?? null,
        breakdown: out.breakdown ?? null,
        provenance: liveFallbackProvenance({
          formulaVersion: kpi.formulaVersion,
          dependsOn: kpi.dependsOn,
          reason: "served from live recompute — no snapshot for this period yet",
        }),
      };
    } catch (err) {
      console.warn(`[reporting] live resolver for ${kpi.id} threw:`, err?.message || err);
      return { value: null, provenance: unavailableProvenance(`resolver error: ${err?.message || "unknown"}`) };
    }
  }

  // 3. Declared-but-not-implemented KPI (catalogue entry without a resolver yet).
  return {
    value: null,
    provenance: unavailableProvenance(`KPI "${kpi.id}" is declared but not yet implemented (readiness ${kpi.readiness})`),
  };
}

export default resolveKpiValue;
