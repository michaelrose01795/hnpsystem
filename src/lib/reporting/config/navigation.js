// file location: src/lib/reporting/config/navigation.js
//
// Reporting NAVIGATION integration (Phase-1 §15.2). Defines the dedicated /reports
// area and produces sidebar sections in the EXACT shape src/config/navigation.js
// uses ({ label, category, items:[{ label, href, roles }] }), so it can plug into
// the existing StaffSidebar without that component changing how it renders.
//
// ⚠️ GLOBAL CHANGE — NOT WIRED IN. Per CLAUDE.md §7, Sidebar.js / the sidebar nav
// config are protected global surfaces. This module is the READY-TO-PLUG nav data
// + a role-gated selector, but it is deliberately NOT imported into the live
// sidebar. Wiring it in is a flagged change requiring sign-off (and is gated by
// the `reporting_nav_enabled` flag so it stays invisible until then).
//
// To wire it later (after sign-off): in src/config/navigation.js (or StaffSidebar),
// spread getReportingNavSection(userRoles) into sidebarSections when the flag is on.

import { getReportingFlag } from "./flags";
import { resolveScope, canSeeDepartment, SCOPE_LEVELS } from "../permissionScope";

// The /reports route map (Phase-1 §15.2). `dept` ties a link to a department so
// the sidebar surfaces only the areas a role's scope permits; `level` gates
// management/executive-only areas.
export const REPORTING_AREAS = Object.freeze([
  { label: "Overview", href: "/reports/overview", level: "executive" },
  { label: "Workshop", href: "/reports/workshop", dept: "workshop" },
  { label: "Parts", href: "/reports/parts", dept: "parts" },
  { label: "Service", href: "/reports/service", dept: "service" },
  { label: "MOT", href: "/reports/mot", dept: "mot" },
  { label: "Valeting", href: "/reports/valeting", dept: "valeting" },
  { label: "Paint", href: "/reports/paint", dept: "paint" },
  { label: "Accounts", href: "/reports/accounts", dept: "accounts", sensitive: "financial" },
  // Admin reporting exposes login/audit/security/compliance signal — gated to
  // Admin-manager / Management / Executive scope (executive level) so operational
  // department managers don't surface it. The engine enforces the same per-KPI gate.
  { label: "Admin", href: "/reports/admin", level: "executive" },
  { label: "HR", href: "/reports/hr", dept: "hr", sensitive: "pii" },
  { label: "Audit", href: "/reports/audit", level: "cross-department" },
]);

// Build the reporting sidebar SECTION for a set of roles, gated by scope. Returns
// null when reporting nav is disabled or the user can see nothing — so a caller
// can safely `[...base, ...(section ? [section] : [])]`.
export function getReportingNavSection(roles = []) {
  if (!getReportingFlag("reporting_nav_enabled")) return null;

  const scope = resolveScope(roles);
  const isExecutive = scope.level === SCOPE_LEVELS.EXECUTIVE;
  const isCrossDept = isExecutive || scope.level === SCOPE_LEVELS.CROSS_DEPARTMENT;

  const items = REPORTING_AREAS.filter((area) => {
    if (area.level === "executive" && !isExecutive) return false;
    if (area.level === "cross-department" && !isCrossDept) return false;
    if (area.sensitive === "financial" && !scope.sensitive.financial) return false;
    if (area.sensitive === "pii" && !scope.sensitive.pii) return false;
    if (area.dept && !canSeeDepartment(scope, area.dept)) return false;
    return true;
  }).map((area) => ({
    label: area.label,
    href: area.href,
    // Empty roles array → StaffSidebar shows it; scope already filtered above.
    roles: [],
  }));

  if (items.length === 0) return null;

  return {
    label: "Reports",
    category: "departments",
    items,
  };
}

export default getReportingNavSection;
