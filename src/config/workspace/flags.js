// file location: src/config/workspace/flags.js
//
// Workspace Navigation feature flags. Mirrors the reporting-flag pattern
// (src/lib/reporting/config/flags.js): a default map of booleans, each
// overridable at build time via a NEXT_PUBLIC_WORKSPACE_<KEY> environment
// variable.
//
// EDGE-SAFE: this module is (transitively) reachable from src/proxy.js via the
// nav config → keep it to plain data + process.env reads only. No React, no
// Node-only APIs, no Supabase.
//
// The Workspace Navigation programme ships every USER-VISIBLE surface DISABLED
// by default so the foundation (the manifest + selectors) can merge without
// changing what any user sees. Phase 0 (this phase) introduces the manifest and
// derives today's sidebar from it byte-for-byte; the department-first RAIL, the
// Context Sidebar, breadcrumbs, quick-preview fly-outs, etc. all light up in
// later phases behind these flags. Turning a flag off is the instant rollback:
// the manifest still feeds the classic role-organised sidebar.

const WORKSPACE_FLAGS = {
  // Master switch for the new department-first navigation surfaces (Tier-1
  // Department Rail / grouped single-rail, Tier-2 Context Sidebar, breadcrumbs,
  // role→home resolver, quick-preview fly-outs). OFF by default — Phase 0 is a
  // pure, invisible refactor, so nothing reads this yet except future phases.
  workspace_nav_enabled: false,
};

// Read a single workspace flag. Env override wins, then the default map.
export function getWorkspaceFlag(key) {
  const envKey = `NEXT_PUBLIC_WORKSPACE_${String(key).toUpperCase()}`;
  const envValue = process.env[envKey];
  if (envValue === "true") return true;
  if (envValue === "false") return false;
  return WORKSPACE_FLAGS[key] ?? false;
}

export function getAllWorkspaceFlags() {
  return Object.keys(WORKSPACE_FLAGS).reduce((acc, key) => {
    acc[key] = getWorkspaceFlag(key);
    return acc;
  }, {});
}

// Convenience gate for the department-first navigation surfaces. Future phases
// (rail, context sidebar, breadcrumbs) branch on this; Phase 0 does not, because
// toSidebarSections() reproduces the classic sidebar regardless of the flag.
export function isWorkspaceNavEnabled() {
  return getWorkspaceFlag("workspace_nav_enabled");
}

export default WORKSPACE_FLAGS;
