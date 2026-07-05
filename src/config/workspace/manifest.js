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
      if (itemVisibleTo(item, roleSet)) accessible.add(item.href);
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
      if (itemVisibleTo(item, roleSet)) accessible.add(item.href);
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

function buildContextGroups(department, roles) {
  const roleSet = normalizeRoleSet(roles);
  const seen = new Set();
  const groups = [];

  if (department?.home && department.category === "departments") {
    seen.add(department.home);
    groups.push({
      key: `${department.key}-overview`,
      label: "Workspace",
      collapsible: false,
      defaultOpen: true,
      items: [{ label: "Overview", href: department.home }],
    });
  }

  for (const section of workspaceSectionsForDepartment(department?.key)) {
    const items = [];
    for (const item of section.items || []) {
      if (!item.href) continue;
      if (!itemVisibleTo(item, roleSet)) continue;
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      items.push({ label: item.label, href: item.href });
    }
    if (items.length > 0) {
      groups.push({
        key: section.key || `${section.department}-${section.label}`,
        label: section.label,
        collapsible: items.length > 4 || groups.length > 1,
        defaultOpen: true,
        items,
      });
    }
  }

  return groups;
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
// PartsWorkspaceTabs in a later phase.
export function getContextNav(departmentKey, roles) {
  const roleSet = normalizeRoleSet(roles);
  const seen = new Map(); // href → item (first occurrence wins its label)
  for (const section of workspaceSectionsForDepartment(departmentKey)) {
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
export function getDepartmentWorkspaceNav(departmentKey, roles) {
  const department = WORKSPACE_DEPARTMENTS.find((dept) => dept.key === departmentKey) || null;
  const context = getContextNav(departmentKey, roles);
  const groups = buildContextGroups(department, roles);
  const items = groups.flatMap((group) => group.items || []);

  return {
    department: departmentKey,
    label: department?.label || context.department,
    home: department?.home || null,
    icon: department?.icon || null,
    category: department?.category || null,
    itemCount: items.length,
    groups,
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

  for (const department of departments) {
    const nav = getDepartmentWorkspaceNav(department.key, roles);
    if (nav.items.some((item) => pathOf(item.href) === path)) return department.key;
  }

  let best = null;
  let bestLen = -1;
  for (const department of departments) {
    const nav = getDepartmentWorkspaceNav(department.key, roles);
    for (const item of nav.items) {
      const route = pathOf(item.href);
      if ((path === route || path.startsWith(`${route}/`)) && route.length > bestLen) {
        best = department.key;
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
  const trail = [];
  if (dept) trail.push({ label: dept.label, href: dept.home || null });
  const exactMatch = workspace.items.find((item) => pathOf(item.href) === path);
  if (exactMatch && exactMatch.href !== dept?.home) {
    trail.push({ label: exactMatch.label, href: exactMatch.href });
    return trail;
  }
  let best = null;
  let bestLen = -1;
  for (const item of workspace.items) {
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
