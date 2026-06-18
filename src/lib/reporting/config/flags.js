// file location: src/lib/reporting/config/flags.js
//
// Reporting platform feature flags. Mirrors the existing tracker-flag pattern
// (src/config/trackerFlags.js): a default map of booleans, each overridable at
// build time via a NEXT_PUBLIC_REPORTING_<KEY> environment variable.
//
// The reporting foundation ships DISABLED-by-default for anything user-facing
// (navigation, live fallback) so it can be merged without changing what users
// see until a later phase explicitly turns it on. Backend/data-collection
// pieces are inert until called, so they need no flag.

const REPORTING_FLAGS = {
  // Master switch. When false the reporting APIs still respond but the engine
  // serves only empty, non-erroring envelopes (graceful degradation).
  reporting_enabled: true,
  // Surface the /reports navigation in the sidebar. OFF until the dedicated
  // reporting area (a flagged global Sidebar change) is signed off.
  reporting_nav_enabled: false,
  // Allow the resolver to fall back to a live recompute when a snapshot/rollup
  // is missing. Labelled in provenance when it happens (Principle 9 / G8).
  reporting_live_fallback_enabled: true,
  // Write report.view / report.export rows into audit_log for every request.
  reporting_access_audit_enabled: true,
  // Allow the emit fan-out (report_event + status history) to run from
  // operational write paths. OFF by default — wiring emits into write paths is
  // a later phase; until then the emit helpers are inert no-ops.
  reporting_emit_enabled: false,
  // Enable CSV export endpoint.
  reporting_export_enabled: true,
};

// Read a single reporting flag. Env override wins, then the default map.
export function getReportingFlag(key) {
  const envKey = `NEXT_PUBLIC_REPORTING_${String(key).toUpperCase()}`;
  const envValue = process.env[envKey];
  if (envValue === "true") return true;
  if (envValue === "false") return false;
  return REPORTING_FLAGS[key] ?? false;
}

export function getAllReportingFlags() {
  return Object.keys(REPORTING_FLAGS).reduce((acc, key) => {
    acc[key] = getReportingFlag(key);
    return acc;
  }, {});
}

export default REPORTING_FLAGS;
