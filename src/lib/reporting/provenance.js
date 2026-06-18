// file location: src/lib/reporting/provenance.js
//
// PROVENANCE framework (Phase-1 §9.7 / Principle 10 / ADR-5).
//
// Every reported figure carries its source, as-of timestamp, formula version, and
// whether it is live or snapshotted — so a number can always explain itself.
// The SummaryCard's ⓘ tooltip (a later UI phase) renders this verbatim.

export const SOURCE_TYPES = Object.freeze(["rollup", "snapshot", "live", "base", "none"]);

// Build a provenance object. `live:true` flags a (clearly-labelled) live-fallback
// computation served because a snapshot/rollup was missing (Principle 9 / G8).
export function buildProvenance({
  source = "none",
  asOf = null,
  formulaVersion = "v1",
  live = false,
  dependsOn = null,
  warnings = [],
} = {}) {
  return {
    source: SOURCE_TYPES.includes(source) ? source : "none",
    asOf: asOf || new Date().toISOString(),
    formulaVersion,
    live: Boolean(live),
    dependsOn: Array.isArray(dependsOn) ? dependsOn : null,
    warnings: Array.isArray(warnings) ? warnings : [],
  };
}

// Convenience: provenance for a live-fallback result (rollup/snapshot missing).
export function liveFallbackProvenance({ formulaVersion = "v1", dependsOn = null, reason } = {}) {
  return buildProvenance({
    source: "live",
    live: true,
    formulaVersion,
    dependsOn,
    warnings: [reason || "served from live fallback — snapshot/rollup missing"],
  });
}

// Convenience: provenance for an empty result because a required source table is
// not yet applied (graceful degradation).
export function unavailableProvenance(reason = "reporting source not available yet") {
  return buildProvenance({ source: "none", live: false, warnings: [reason] });
}

export default buildProvenance;
