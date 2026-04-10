// file location: src/config/navLinks.js
// ⚠️ DEPRECATED — DO NOT IMPORT.
//
// The live navigation source of truth is `src/config/navigation.js`
// (consumed by `src/components/Sidebar.js` and `src/components/Layout.js`).
//
// This file used to expose `navLinksByRole`, a per-role flat link map that
// pre-dated the section-based navigation defined in `navigation.js`. As of
// 2026-04-10 a full grep of the repo confirms zero importers of this module
// (`navLinksByRole`, `@/config/navLinks`) — the only references that remain
// are in generated structure dumps (`src-structure.txt`, `project-structure.txt`).
//
// The file is kept (not deleted) so that any unknown dynamic require still
// resolves to a defined module instead of crashing the bundle. The export is
// intentionally empty: any future caller will get an empty role map and a
// console warning rather than silently relying on stale role→route data.
//
// To remove permanently: confirm no dynamic `require("@/config/navLinks")`
// usage in a production deploy log, then delete this file in a follow-up PR.

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  // Surface accidental imports during dev only — never in prod bundles.
  // eslint-disable-next-line no-console
  console.warn(
    "[deprecated] @/config/navLinks is no longer the navigation source. " +
      "Import sidebarSections from @/config/navigation instead."
  );
}

// Empty stub — preserves the named export shape so legacy callers don't crash.
export const navLinksByRole = {};

export default navLinksByRole;
