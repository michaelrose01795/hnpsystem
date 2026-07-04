// file location: src/lib/reporting/config/navigation.js
//
// ⚠️ RETIRED (Workspace Navigation Phase 0).
//
// This module WAS the "ready-to-plug, NOT wired in" reporting sidebar
// (`getReportingNavSection` / `REPORTING_AREAS`) — duplicate navigation source
// #6 in docs/Workspace Navigation/workspace-navigation-design-spec.md §3.5. It
// was never imported by the live app.
//
// The single source of truth for the /reports navigation is now the `reports`
// department in the Workspace Navigation manifest
// (src/config/workspace/departments.js), gated by the same
// `reporting_nav_enabled` flag and surfaced through toSidebarSections(). Keeping
// this file as an inert re-export removes the duplicate definition without
// breaking any stray import.
//
// Do not add navigation data here. Edit the manifest instead —
// docs/Workspace Navigation/workspace-navigation-manifest-guide.md.

// Intentionally empty. The reporting nav now lives in the Workspace manifest.
export {};
