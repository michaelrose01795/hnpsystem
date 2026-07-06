// file location: src/config/workspace/manifest.js
//
// Workspace Navigation manifest — ASSEMBLY + SELECTORS.
//
// Every navigation surface is a pure projection of the department-first manifest
// in ./departments.js. This module holds one selector per consumer so no surface
// owns its own list. toSidebarSections() preserves the classic role-organised
// fallback, while the workspace-enabled sidebar, search, dashboards and topbar
// quick actions consume the newer department-first selectors.
//
// EDGE-SAFE: plain data + pure functions only (see ./departments.js header).

import {
  WORKSPACE_CONTEXT_NAV_SECTIONS,
  WORKSPACE_DASHBOARD_SHORTCUTS,
  WORKSPACE_DEPARTMENTS,
  WORKSPACE_NAV_SECTIONS,
  WORKSPACE_PAGE_TABS,
  WORKSPACE_QUICK_ACTIONS,
} from "./departments";
import { getReportingFlag } from "@/lib/reporting/config/flags";
import { ROLE_DEPARTMENT_MAP } from "@/lib/reporting/config/departments";
import { isWorkspaceNavEnabled } from "./flags";

export { isWorkspaceNavEnabled };
export {
  WORKSPACE_CONTEXT_NAV_SECTIONS,
  WORKSPACE_DASHBOARD_SHORTCUTS,
  WORKSPACE_DEPARTMENTS,
  WORKSPACE_NAV_SECTIONS,
  WORKSPACE_PAGE_TABS,
  WORKSPACE_QUICK_ACTIONS,
};

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

// ---------------------------------------------------------------------------
// WORKSPACE GROUP PERMISSION MODEL — the DEFAULT permission boundary (Phase 8).
//
// The Workspace Group (a page's section `department`) is the primary permission
// boundary. Assigning a workspace group to a role automatically grants that role
// every GROUP-WIDE page in the group — a page with NO `roles` of its own. This is
// the default: new group pages should be added WITHOUT a `roles` key so they
// inherit the group. A page MAY still carry its own `roles` as an INTENTIONAL
// EXCEPTION (an individual restriction — e.g. management/financial/developer
// pages — or a cross-group grant), which is honoured independently of the group,
// so cross-group grants (e.g. Sales seeing the Admin group's Website Manager)
// keep working.
//
// NOTE ON THE CLASSIC FALLBACK: pages in WORKSPACE_NAV_SECTIONS retain explicit
// per-role `roles` because those items double as the byte-identical classic
// sidebar (toSidebarSections → StaffSidebar when workspace_nav_enabled is off);
// their roles are load-bearing for rollback, not redundant. De-duplication via
// inheritance therefore applies to workspace-only sections
// (WORKSPACE_CONTEXT_NAV_SECTIONS) and every FUTURE group page.
//
// The authoritative per-group inventory (roles, pages, inherit vs override + the
// reason for each override) lives in
// docs/Workspace Navigation/workspace-group-permissions.md.
//
// GROUP_ROLE_INDEX maps a group key → the roles assigned to it:
//   • null            ⇒ assigned to EVERY authenticated user (General, Account —
//                        their department declares `roles: []`).
//   • Set<role>       ⇒ the explicit/derived roles that hold the group.
// A department with `roles: undefined` derives its assigned roles from the
// canonical ROLE_DEPARTMENT_MAP (so nav and reporting can never drift); a
// department key not present in that map (e.g. `reports`) derives an empty set,
// which is fine because those groups gate every page with explicit `roles`.
// ---------------------------------------------------------------------------
const GROUP_ROLE_INDEX = (() => {
  const index = new Map();
  for (const dept of WORKSPACE_DEPARTMENTS) {
    if (Array.isArray(dept.roles)) {
      // `[]` is the "assigned to all authenticated" sentinel; a non-empty array
      // is the explicit assignment (e.g. Developer → ["dev"]).
      index.set(dept.key, dept.roles.length === 0 ? null : normalizeRoleSet(dept.roles));
    } else {
      const derived = Object.entries(ROLE_DEPARTMENT_MAP)
        .filter(([, code]) => code === dept.key)
        .map(([role]) => role);
      index.set(dept.key, normalizeRoleSet(derived));
    }
  }
  return index;
})();

// Does the workspace group grant this role set? Group-wide pages inherit this.
function groupGrantsRole(departmentKey, roleSet) {
  if (!departmentKey || !GROUP_ROLE_INDEX.has(departmentKey)) return false;
  const groupRoles = GROUP_ROLE_INDEX.get(departmentKey);
  if (groupRoles === null) return true; // assigned to every authenticated user
  for (const role of roleSet) {
    if (groupRoles.has(role)) return true;
  }
  return false;
}

// getWorkspaceGroupRoles(departmentKey) — the roles ASSIGNED to a workspace
// group. Returns "*" when the group is open to every authenticated user, or a
// sorted role array otherwise. A role assigned a group can see every group-wide
// page in it (pages that carry no individual `roles` restriction).
export function getWorkspaceGroupRoles(departmentKey) {
  if (!GROUP_ROLE_INDEX.has(departmentKey)) return [];
  const groupRoles = GROUP_ROLE_INDEX.get(departmentKey);
  if (groupRoles === null) return "*";
  return Array.from(groupRoles).sort();
}

// Visibility check for a nav item.
//   • A page WITH `roles` is gated by those roles only (individual
//     restriction/grant) — independent of group assignment. This preserves every
//     existing per-page permission, including cross-group grants.
//   • A page WITHOUT `roles` is GROUP-WIDE: it inherits the group's assigned
//     roles (see GROUP_ROLE_INDEX). When no group context is supplied (page
//     tabs, quick actions), an un-roled item stays visible to all — matching the
//     legacy "empty roles ⇒ everyone" rule for those non-group surfaces.
function itemVisibleTo(item, roleSet, departmentKey = null) {
  if (item.roles && item.roles.length > 0) {
    return item.roles.some((required) => roleSet.has(String(required).toLowerCase()));
  }
  if (!departmentKey) return true;
  return groupGrantsRole(departmentKey, roleSet);
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

function enabledWorkspaceSectionsInOrder() {
  return [...WORKSPACE_NAV_SECTIONS, ...WORKSPACE_CONTEXT_NAV_SECTIONS]
    .filter(sectionFlagEnabled)
    .slice()
    .sort((a, b) => a.order - b.order);
}

// Strip query/hash to compare against Next.js pathnames.
function pathOf(href) {
  return String(href || "").split("?")[0].split("#")[0];
}

function routeMatchesPath(route, pathname) {
  const routePath = pathOf(route?.href);
  const currentPath = pathOf(pathname);
  if (!routePath || !currentPath) return false;
  if (route.match === "exact") return currentPath === routePath;
  return currentPath === routePath || currentPath.startsWith(`${routePath}/`);
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
// derived from the manifest. It intentionally includes the classic sidebar
// sections plus the manifest-owned topbar quick actions and workspace-only
// Accounts links that the classic shell still renders as fallback extras.
// ---------------------------------------------------------------------------
export function getAccessibleNavPaths(roles) {
  const roleSet = normalizeRoleSet(roles);
  const accessible = new Set();
  for (const section of enabledSectionsInOrder()) {
    for (const item of section.items || []) {
      if (!item.href) continue;
      if (itemVisibleTo(item, roleSet, section.department)) accessible.add(item.href);
    }
  }
  for (const action of WORKSPACE_QUICK_ACTIONS) {
    if (!action.href) continue;
    if (itemVisibleTo(action, roleSet)) accessible.add(action.href);
  }
  for (const section of WORKSPACE_CONTEXT_NAV_SECTIONS) {
    if (section.department !== "accounts") continue;
    if (!sectionFlagEnabled(section)) continue;
    for (const item of section.items || []) {
      if (!item.href) continue;
      if (itemVisibleTo(item, roleSet, section.department)) accessible.add(item.href);
    }
  }
  return accessible;
}

// ---------------------------------------------------------------------------
// DEPARTMENT-FIRST SELECTORS
//
// These selectors feed the flagged workspace rail/context path when
// workspace_nav_enabled is on. The classic fallback continues through
// toSidebarSections() above.
// ---------------------------------------------------------------------------

function workspaceSectionsForDepartment(departmentKey) {
  return enabledWorkspaceSectionsInOrder().filter((s) => s.department === departmentKey);
}

// getDepartmentsForRoles(roles) — the ordered list of departments the user can
// see (≥1 accessible item), for the Tier-1 Department Rail. Returns the
// department metadata objects from WORKSPACE_DEPARTMENTS. Callers split by
// `category` (general / departments / account) to render the rail groups.
export function getDepartmentsForRoles(roles) {
  const roleSet = normalizeRoleSet(roles);
  return WORKSPACE_DEPARTMENTS.filter((dept) => {
    if (dept.flag && !getReportingFlag(dept.flag)) return false;
    return workspaceSectionsForDepartment(dept.key).some((section) =>
      (section.items || []).some((item) => itemVisibleTo(item, roleSet, section.department))
    );
  })
    .slice()
    .sort((a, b) => a.order - b.order);
}

// getContextNav(departmentKey, roles) — the Tier-2 Context Sidebar for a
// department: the department's pages, DEDUPLICATED by href (so "Job Cards"
// appears once, not once per role section), role-filtered, in order. This is the
// department-first view that replaces the ad-hoc HrTabsBar / WorkshopTabsBar /
// PartsWorkspaceTabs in a later phase.
export function getContextNav(departmentKey, roles) {
  const roleSet = normalizeRoleSet(roles);
  const seen = new Map(); // href → item (first occurrence wins its label)
  for (const section of workspaceSectionsForDepartment(departmentKey)) {
    for (const item of section.items || []) {
      if (!item.href) continue;
      if (!itemVisibleTo(item, roleSet, section.department)) continue;
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
// getDepartmentWorkspaceNav(departmentKey, roles) — the Workspace GROUP view for
// one group. Returns a `dashboards` sub-section (the group's role-visible
// dashboards, keyed off WORKSPACE_DASHBOARD_SHORTCUTS by department) rendered as
// a titled "Dashboards" block at the top of the group, followed by `items` — the
// flat, deduplicated page list. The old single "Overview" entry is gone; the
// department home is reached through its Dashboards block instead. Page
// visibility follows the group permission model (itemVisibleTo): group-wide
// pages are granted by the group assignment, individually-roled pages and
// dashboards keep their own restriction.
export function getDepartmentWorkspaceNav(departmentKey, roles) {
  const department = WORKSPACE_DEPARTMENTS.find((dept) => dept.key === departmentKey) || null;
  const roleSet = normalizeRoleSet(roles);

  // Dashboards sub-section — the role-visible dashboards this group owns.
  const dashboards = [];
  const dashboardSeen = new Set();
  for (const shortcut of WORKSPACE_DASHBOARD_SHORTCUTS) {
    if (shortcut.department !== departmentKey) continue;
    if (!shortcut.href || dashboardSeen.has(shortcut.href)) continue;
    if (!itemVisibleTo(shortcut, roleSet)) continue;
    dashboardSeen.add(shortcut.href);
    dashboards.push({ label: shortcut.label, href: shortcut.href });
  }

  const seen = new Set();
  const items = [];
  for (const section of workspaceSectionsForDepartment(departmentKey)) {
    for (const item of section.items || []) {
      if (!item.href) continue;
      if (!itemVisibleTo(item, roleSet, section.department)) continue;
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      items.push({ label: item.label, href: item.href });
    }
  }

  return {
    department: departmentKey,
    label: department?.label || departmentKey,
    home: department?.home || null,
    icon: department?.icon || null,
    category: department?.category || null,
    dashboards,
    itemCount: items.length,
    items,
  };
}

export function getWorkspaceRail(roles) {
  return getDepartmentsForRoles(roles).map((department) => ({
    key: department.key,
    label: department.label,
    category: department.category,
    icon: department.icon,
    home: department.home || null,
  }));
}

// getWorkspaceGroups(roles) — the Tier-1 GROUP LIST for the Group Sidebar Flow
// (Phase 7). These are the clickable top-level groups a user first sees: the
// General group plus every department they can access, in manifest order.
// Selecting one replaces the whole sidebar with that group's context nav.
//
// The Account bucket (Profile / Logout) is intentionally excluded — it is NOT a
// navigable group; the sidebar renders it as its persistent bottom controls
// (clock in/out, logout, profile) regardless of which group is open.
export function getWorkspaceGroups(roles) {
  return getWorkspaceRail(roles).filter(
    (group) => group.category === "general" || group.category === "departments"
  );
}

export function getDashboardShortcutsForRoles(roles) {
  const roleSet = normalizeRoleSet(roles);
  return WORKSPACE_DASHBOARD_SHORTCUTS.filter((shortcut) =>
    itemVisibleTo(shortcut, roleSet)
  ).map((shortcut) => ({
    label: shortcut.label,
    href: shortcut.href,
    roles: shortcut.roles,
    description: shortcut.description,
  }));
}

const ROUTE_DEPARTMENT_INDEX = (() => {
  const index = new Map();
  for (const section of [...WORKSPACE_NAV_SECTIONS, ...WORKSPACE_CONTEXT_NAV_SECTIONS].sort((a, b) => a.order - b.order)) {
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
export function getActiveWorkspaceDepartment(pathname, roles) {
  const path = pathOf(pathname);
  if (!path) return null;
  const departments = getDepartmentsForRoles(roles).filter((dept) => dept.category === "departments");

  // The routes a group owns = its home + its dashboards + its pages. The home is
  // included explicitly so landing on /dashboard/<dept> always resolves to its
  // group even when the dashboard shortcut itself is gated to narrower roles.
  const deptNavPaths = departments.map((department) => {
    const nav = getDepartmentWorkspaceNav(department.key, roles);
    const paths = [];
    if (nav.home) paths.push(pathOf(nav.home));
    for (const dashboard of nav.dashboards) if (dashboard.href) paths.push(pathOf(dashboard.href));
    for (const item of nav.items) if (item.href) paths.push(pathOf(item.href));
    return { key: department.key, paths };
  });

  for (const { key, paths } of deptNavPaths) {
    if (paths.includes(path)) return key;
  }

  let best = null;
  let bestLen = -1;
  for (const { key, paths } of deptNavPaths) {
    for (const route of paths) {
      if ((path === route || path.startsWith(`${route}/`)) && route.length > bestLen) {
        best = key;
        bestLen = route.length;
      }
    }
  }

  return best;
}

export function isContextNavItemActive(item, pathname, pendingHref = null) {
  const itemPath = pathOf(item?.href);
  if (!itemPath) return false;
  const pendingPath = pathOf(pendingHref);
  if (pendingPath) return pendingPath === itemPath;
  const currentPath = pathOf(pathname);
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

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
  const path = pathOf(pathname);
  const departmentKey =
    getActiveWorkspaceDepartment(path, roles) ||
    getActiveDepartment(path);
  if (!departmentKey) return [];
  const dept = WORKSPACE_DEPARTMENTS.find((d) => d.key === departmentKey);
  const workspace = getDepartmentWorkspaceNav(departmentKey, roles);
  const navItems = [...(workspace.dashboards || []), ...workspace.items];
  const trail = [];
  if (dept) trail.push({ label: dept.label, href: dept.home || null });
  const exactMatch = navItems.find((item) => pathOf(item.href) === path);
  if (exactMatch && exactMatch.href !== dept?.home) {
    trail.push({ label: exactMatch.label, href: exactMatch.href });
    return trail;
  }
  let best = null;
  let bestLen = -1;
  for (const item of navItems) {
    const route = pathOf(item.href);
    if ((path === route || path.startsWith(`${route}/`)) && route.length > bestLen) {
      best = item;
      bestLen = route.length;
    }
  }
  if (best && best.href !== dept?.home) trail.push({ label: best.label, href: best.href });
  return trail;
}

export function getWorkspaceHeader(pathname, roles) {
  const departmentKey = getActiveWorkspaceDepartment(pathname, roles);
  if (!departmentKey) return null;
  const workspace = getDepartmentWorkspaceNav(departmentKey, roles);
  if (!workspace?.items?.length) return null;
  return {
    ...workspace,
    breadcrumbs: getBreadcrumbTrail(pathname, roles),
    quickActions: getQuickActions(roles, departmentKey),
  };
}

export function getWorkspaceShortcutItems(roles) {
  const seen = new Map();
  for (const item of [...getSearchItems(roles), ...getQuickActions(roles)]) {
    if (!item?.href || seen.has(item.href)) continue;
    seen.set(item.href, {
      label: item.label,
      href: item.href,
      department: item.department || getActiveDepartment(item.href),
    });
  }
  return Array.from(seen.values());
}

// getSearchItems(roles) — flat, deduplicated list of navigable pages for the
// Workspace Search / GlobalSearch, replacing the imperative addNavItem() calls.
export function getSearchItems(roles) {
  const roleSet = normalizeRoleSet(roles);
  const seen = new Map();
  for (const section of enabledWorkspaceSectionsInOrder()) {
    for (const item of section.items || []) {
      if (!item.href) continue;
      if (!itemVisibleTo(item, roleSet, section.department)) continue;
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

// getPageTabs(pathname, roles, options) - Tier-3 in-page tab links. The tab
// definitions live in the manifest so legacy tab bars can become thin wrappers.
export function getPageTabs(pathname, roles = [], options = {}) {
  const roleSet = normalizeRoleSet(roles);
  const group = WORKSPACE_PAGE_TABS.find((candidate) => {
    if (options.groupKey && candidate.key !== options.groupKey) return false;
    return (candidate.matchers || []).some((matcher) => routeMatchesPath(matcher, pathname));
  });
  if (!group) {
    return {
      key: options.groupKey || null,
      ariaLabel: "",
      items: [],
    };
  }

  return {
    key: group.key,
    ariaLabel: group.ariaLabel,
    items: (group.items || []).filter((item) => itemVisibleTo(item, roleSet)).map((item) => ({
      label: item.label,
      href: item.href,
      match: item.match || "prefix",
      className: item.className,
    })),
  };
}

export function isPageTabActive(tab, pathname) {
  return routeMatchesPath(tab, pathname);
}

// getQuickActions(roles, activeDepartment) - topbar/header quick-actions for a
// department. The workspace UI consumes this selector directly; routeAccess.js
// no longer owns navigation mirrors.
export function getQuickActions(roles, activeDepartment = null) {
  const roleSet = normalizeRoleSet(roles);
  const seen = new Set();
  return WORKSPACE_QUICK_ACTIONS.filter((action) => {
    if (!itemVisibleTo(action, roleSet)) return false;
    if (activeDepartment && Array.isArray(action.departments)) {
      return action.departments.includes(activeDepartment);
    }
    return true;
  }).reduce((items, action) => {
    if (!action.href || seen.has(action.href)) return items;
    seen.add(action.href);
    items.push({
      label: action.label,
      href: action.href,
    });
    return items;
  }, []);
}
