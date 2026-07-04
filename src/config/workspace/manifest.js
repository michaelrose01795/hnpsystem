// file location: src/config/workspace/manifest.js
//
// Workspace Navigation manifest — ASSEMBLY + SELECTORS.
//
// Every navigation surface is a pure projection of the department-first manifest
// in ./departments.js. This module holds one selector per consumer so no surface
// owns its own list. Phase 0 wires exactly one of them — toSidebarSections() —
// into the live app (via src/config/navigation.js) and reproduces today's
// sidebar byte-for-byte. The rest are implemented now so later phases (Department
// Rail, Context Sidebar, Breadcrumbs, Workspace Search, role→home) can consume
// them WITHOUT another navigation refactor.
//
// EDGE-SAFE: plain data + pure functions only (see ./departments.js header).

import {
  WORKSPACE_DEPARTMENTS,
  WORKSPACE_NAV_SECTIONS,
} from "./departments";
import { getReportingFlag } from "@/lib/reporting/config/flags";
import { isWorkspaceNavEnabled } from "./flags";

export { isWorkspaceNavEnabled };
export { WORKSPACE_DEPARTMENTS, WORKSPACE_NAV_SECTIONS };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Lowercase-normalise a role list (the manifest works in lowercase internally,
// exactly like StaffSidebar/pageAccess). Reconciles the two case conventions in
// the codebase (lowercase role constants vs UPPER-CASE ProtectedRoute/client).
function normalizeRoleSet(roles) {
  return new Set(
    (Array.isArray(roles) ? roles : [roles])
      .filter(Boolean)
      .map((role) => String(role).toLowerCase().trim())
  );
}

// Visibility check — mirrors StaffSidebar.hasAccess() / pageAccess.hasMatchingRole:
// empty/absent roles ⇒ visible to every authenticated user; otherwise a
// case-insensitive membership test against the user's role set.
function itemVisibleTo(item, roleSet) {
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.some((required) => roleSet.has(String(required).toLowerCase()));
}

// Is a section's feature flag satisfied? Section flags currently live in the
// reporting flag namespace (the only flag used on a section today —
// `reporting_nav_enabled`). A null/absent flag is always on.
function sectionFlagEnabled(section) {
  if (!section.flag) return true;
  return getReportingFlag(section.flag);
}

// The flag-gated, order-sorted section list — the canonical ordering every
// consumer shares. Sections whose flag is off are dropped entirely (matching the
// legacy behaviour where the Reports section simply wasn't present).
function enabledSectionsInOrder() {
  return WORKSPACE_NAV_SECTIONS.filter(sectionFlagEnabled)
    .slice()
    .sort((a, b) => a.order - b.order);
}

// Strip query/hash to compare against Next.js pathnames.
function pathOf(href) {
  return String(href || "").split("?")[0].split("#")[0];
}

// ---------------------------------------------------------------------------
// PRIMARY SELECTOR (wired in Phase 0)
//
// toSidebarSections() — reproduces src/config/navigation.js `sidebarSections`
// BYTE-FOR-BYTE: the same sections, in the same order, with the same item
// objects and the same reporting-flag gating. This is what keeps the classic
// role-organised sidebar looking and behaving identically after Phase 0.
// Locked by manifest.test.js.
// ---------------------------------------------------------------------------
export function toSidebarSections() {
  return enabledSectionsInOrder().map((section) => ({
    label: section.label,
    category: section.category,
    items: section.items,
  }));
}

// ---------------------------------------------------------------------------
// PERMISSION SELECTOR
//
// getAccessibleNavPaths(roles) — the set of hrefs a user may land on directly,
// derived from the manifest. Equivalent to the sidebar walk in
// src/lib/auth/pageAccess.js (which currently walks the derived sidebarSections);
// provided here so Phase 1 can point pageAccess.js straight at the manifest with
// a proven-identical result. TOPBAR_LINKS / ACCOUNTS_NAV_LINKS stay in
// routeAccess.js until Phase 2 folds them in.
// ---------------------------------------------------------------------------
export function getAccessibleNavPaths(roles) {
  const roleSet = normalizeRoleSet(roles);
  const accessible = new Set();
  for (const section of enabledSectionsInOrder()) {
    for (const item of section.items || []) {
      if (!item.href) continue;
      if (itemVisibleTo(item, roleSet)) accessible.add(item.href);
    }
  }
  return accessible;
}

// ---------------------------------------------------------------------------
// DEPARTMENT-FIRST SELECTORS (consumed by later phases — not yet UI-wired)
// ---------------------------------------------------------------------------

// Sections belonging to a department, flag-gated and in order.
function sectionsForDepartment(departmentKey) {
  return enabledSectionsInOrder().filter((s) => s.department === departmentKey);
}

// getDepartmentsForRoles(roles) — the ordered list of departments the user can
// see (≥1 accessible item), for the Tier-1 Department Rail. Returns the
// department metadata objects from WORKSPACE_DEPARTMENTS. Callers split by
// `category` (general / departments / account) to render the rail groups.
export function getDepartmentsForRoles(roles) {
  const roleSet = normalizeRoleSet(roles);
  return WORKSPACE_DEPARTMENTS.filter((dept) => {
    if (dept.flag && !getReportingFlag(dept.flag)) return false;
    return sectionsForDepartment(dept.key).some((section) =>
      (section.items || []).some((item) => itemVisibleTo(item, roleSet))
    );
  })
    .slice()
    .sort((a, b) => a.order - b.order);
}

// getContextNav(departmentKey, roles) — the Tier-2 Context Sidebar for a
// department: the department's pages, DEDUPLICATED by href (so "Job Cards"
// appears once, not once per role section), role-filtered, in order. This is the
// department-first view that replaces the ad-hoc HrTabsBar / WorkshopTabsBar /
// PartsWorkspaceTabs in Phase 4.
export function getContextNav(departmentKey, roles) {
  const roleSet = normalizeRoleSet(roles);
  const seen = new Map(); // href → item (first occurrence wins its label)
  for (const section of sectionsForDepartment(departmentKey)) {
    for (const item of section.items || []) {
      if (!item.href) continue;
      if (!itemVisibleTo(item, roleSet)) continue;
      if (!seen.has(item.href)) {
        seen.set(item.href, { label: item.label, href: item.href });
      }
    }
  }
  return {
    department: departmentKey,
    items: Array.from(seen.values()),
  };
}

// Route → department index (primary department for a path). Built once from the
// ordered sections so it is deterministic; the lowest-order section that lists a
// path owns it. Department is NOT inferable from the URL (flat routes), so this
// explicit index is the source of truth for getActiveDepartment/breadcrumbs.
const ROUTE_DEPARTMENT_INDEX = (() => {
  const index = new Map();
  for (const section of WORKSPACE_NAV_SECTIONS.slice().sort((a, b) => a.order - b.order)) {
    for (const item of section.items || []) {
      const key = pathOf(item.href);
      if (key && !index.has(key)) index.set(key, section.department);
    }
  }
  return index;
})();

// getActiveDepartment(pathname) — which department's context to show for a route.
// Exact match first, then longest matching path prefix (so detail routes like
// /clocking/[slug] resolve to their list page's department).
export function getActiveDepartment(pathname) {
  const path = pathOf(pathname);
  if (!path) return null;
  if (ROUTE_DEPARTMENT_INDEX.has(path)) return ROUTE_DEPARTMENT_INDEX.get(path);
  let best = null;
  let bestLen = -1;
  for (const [route, dept] of ROUTE_DEPARTMENT_INDEX.entries()) {
    if ((path === route || path.startsWith(`${route}/`)) && route.length > bestLen) {
      best = dept;
      bestLen = route.length;
    }
  }
  return best;
}

// resolveHome(roles) — the landing route for a user: the home of their
// highest-priority accessible department (by order), falling back to /newsfeed.
// Skips the pseudo-departments (general/account) which have no real home.
export function resolveHome(roles) {
  const departments = getDepartmentsForRoles(roles).filter(
    (dept) => dept.category === "departments" && dept.home
  );
  return departments.length > 0 ? departments[0].home : "/newsfeed";
}

// getBreadcrumbTrail(pathname, roles) — Department › Page trail for the current
// route. The entity segment (job number, customer name, …) is not in the
// manifest and is appended by the page in a later phase.
export function getBreadcrumbTrail(pathname, roles) {
  const roleSet = normalizeRoleSet(roles);
  const path = pathOf(pathname);
  const departmentKey = getActiveDepartment(path);
  if (!departmentKey) return [];
  const dept = WORKSPACE_DEPARTMENTS.find((d) => d.key === departmentKey);
  const trail = [];
  if (dept) trail.push({ label: dept.label, href: dept.home || null });
  for (const section of sectionsForDepartment(departmentKey)) {
    const match = (section.items || []).find(
      (item) => pathOf(item.href) === path && itemVisibleTo(item, roleSet)
    );
    if (match) {
      trail.push({ label: match.label, href: match.href });
      break;
    }
  }
  return trail;
}

// getSearchItems(roles) — flat, deduplicated list of navigable pages for the
// Workspace Search / GlobalSearch, replacing the imperative addNavItem() calls.
export function getSearchItems(roles) {
  const roleSet = normalizeRoleSet(roles);
  const seen = new Map();
  for (const section of enabledSectionsInOrder()) {
    for (const item of section.items || []) {
      if (!item.href) continue;
      if (!itemVisibleTo(item, roleSet)) continue;
      if (!seen.has(item.href)) {
        seen.set(item.href, {
          label: item.label,
          href: item.href,
          department: section.department,
        });
      }
    }
  }
  return Array.from(seen.values());
}

// getPageTabs(pathname) — Tier-3 in-page tabs for a route. No pageTabs data is
// modelled in the manifest yet (reporting/job-card tabs are folded in a later
// phase); returns [] so callers can adopt it now without a follow-up refactor.
export function getPageTabs(/* pathname */) {
  return [];
}

// getQuickActions(roles, activeDepartment) — topbar quick-actions for a
// department. The topbar action links still live in routeAccess.js /
// StaffTopbar.js until Phase 2 folds them in; returns [] until then.
export function getQuickActions(/* roles, activeDepartment */) {
  return [];
}
