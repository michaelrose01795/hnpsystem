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
  DEVELOPER_GROUP_LOCK,
  WORKSPACE_CONTEXT_NAV_SECTIONS,
  WORKSPACE_DASHBOARD_SHORTCUTS,
  WORKSPACE_DEPARTMENTS,
  WORKSPACE_NAV_SECTIONS,
  WORKSPACE_MODULES,
  WORKSPACE_PAGE_TABS,
  WORKSPACE_QUICK_ACTIONS,
} from "./departments";
import { getReportingFlag } from "@/lib/reporting/config/flags";
import { ROLE_DEPARTMENT_MAP } from "@/lib/reporting/config/departments";
import { DYNAMIC_DETAIL_EXTENDS } from "@/config/routeAccess";
import { isWorkspaceNavEnabled } from "./flags";
import {
  ROLE_WORKSPACE_DEFAULTS,
  WORKSPACE_ROLE_DEFAULT_NAMES,
  getConfiguredRoleDefault,
  normalizeWorkspaceRole,
} from "./roleDefaults";

export { isWorkspaceNavEnabled };
export {
  ROLE_WORKSPACE_DEFAULTS,
  WORKSPACE_ROLE_DEFAULT_NAMES,
  getConfiguredRoleDefault,
  normalizeWorkspaceRole,
};
export {
  DEVELOPER_GROUP_LOCK,
  WORKSPACE_CONTEXT_NAV_SECTIONS,
  WORKSPACE_DASHBOARD_SHORTCUTS,
  WORKSPACE_DEPARTMENTS,
  WORKSPACE_NAV_SECTIONS,
  WORKSPACE_MODULES,
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
  // 🔒 DEVELOPER SIDEBAR LOCK — self-heal. The dev role must ALWAYS be able to
  // land on the Developer Platform route, so the guaranteed button is never a
  // dead link. Strictly dev-only (never widens /dev to any other role).
  if (roleSet.has("dev")) accessible.add(DEVELOPER_GROUP_LOCK.navItem.href);
  return accessible;
}

// ---------------------------------------------------------------------------
// PER-USER SIDEBAR ACCESS (override layer)
//
// By default access is 100% role-derived (getAccessibleNavPaths above). An
// admin can override this per user with an explicit SNAPSHOT — the exact set of
// sidebar item hrefs that user is allowed. The snapshot governs only the
// classic-sidebar item universe (getKnownSidebarHrefs); paths outside it
// (topbar quick actions, accounts-context extras, dynamic detail pages) keep
// their role-derived / always-allowed behaviour and are never over-blocked.
//
// Shape: { items: string[] }. A null/absent snapshot ⇒ role-derived fallback,
// so every existing user is unaffected until an admin edits them.
// ---------------------------------------------------------------------------

// The account-category items that must ALWAYS stay available (Profile). Logout
// carries an `action` and no href, so it never appears here. These are invariant
// — a snapshot can never remove them.
// Original { items } snapshots only governed the classic sidebar. Keep this
// universe separate so legacy rows do not unexpectedly lose dashboards or
// workspace-only pages when they are read by the version-2 implementation.
export function getLegacySidebarHrefs() {
  const set = new Set();
  for (const section of enabledSectionsInOrder()) {
    if (section.department === DEVELOPER_GROUP_LOCK.key) continue;
    for (const item of section.items || []) {
      if (item.href) set.add(item.href);
    }
  }
  return set;
}

// The full set of hrefs the per-user editor can toggle — every classic sidebar
// item (WORKSPACE_NAV_SECTIONS) EXCEPT the synthetic Developer group. This is the
// exact universe getAllSidebarItems() exposes, so the snapshot and the editor
// never drift. The developer route is out of scope here — it is guaranteed for
// the dev role by DEVELOPER_GROUP_LOCK and gated by its own ProtectedRoute.
export function getKnownSidebarHrefs() {
  return new Set(
    getAllSidebarItems().flatMap((group) =>
      group.items.map((item) => item.href).filter(Boolean)
    )
  );
}

// getAllSidebarItems() — grouped, de-duplicated list of every toggleable sidebar
// item, for the HR per-employee editor. Grouped by department (section), first
// occurrence of an href wins its group/label. The synthetic Developer group is
// excluded (its `dev` role is never assignable to a real employee).
export function getAllSidebarItems() {
  const groups = [];
  for (const department of WORKSPACE_DEPARTMENTS.slice().sort((a, b) => a.order - b.order)) {
    if (department.key === DEVELOPER_GROUP_LOCK.key) continue;
    const seen = new Set();
    const items = [];

    for (const dashboard of WORKSPACE_DASHBOARD_SHORTCUTS) {
      if (dashboard.department !== department.key || !dashboard.href || seen.has(dashboard.href)) continue;
      seen.add(dashboard.href);
      items.push({ label: dashboard.label, href: dashboard.href, kind: "dashboard" });
    }

    for (const section of workspaceSectionsForDepartment(department.key)) {
      for (const item of section.items || []) {
        if (!item.href || seen.has(item.href)) continue;
        seen.add(item.href);
        items.push({ label: item.label, href: item.href, kind: "page" });
      }
    }

    if (items.length > 0) {
      groups.push({
        department: department.key,
        label: department.label,
        category: department.category,
        items,
      });
    }
  }
  return groups;
}

// Flat catalogue used by role defaults and the developer layout editor. It is
// still assembled from the canonical manifest, so a role layout can only point
// at an existing staff Page or dashboard shortcut. Orphan dashboards such as
// Paint are included even when their department is not a selectable legacy
// Group.
export function getWorkspacePageCatalog() {
  const seen = new Set();
  const items = [];
  for (const dashboard of WORKSPACE_DASHBOARD_SHORTCUTS) {
    if (!dashboard.href || seen.has(dashboard.href)) continue;
    seen.add(dashboard.href);
    items.push({
      label: dashboard.label,
      href: dashboard.href,
      kind: "dashboard",
      department: dashboard.department || null,
      roles: dashboard.roles || [],
    });
  }
  for (const section of enabledWorkspaceSectionsInOrder()) {
    for (const item of section.items || []) {
      if (!item.href || seen.has(item.href)) continue;
      seen.add(item.href);
      items.push({
        label: item.label,
        href: item.href,
        kind: "page",
        department: section.department || null,
        roles: item.roles || [],
      });
    }
  }
  return items;
}

function roleDefaultModules(roles) {
  const roleList = Array.from(normalizeRoleSet(roles));
  const moduleMap = new Map();
  for (const role of roleList.length > 0 ? roleList : [""]) {
    for (const configuredModule of getConfiguredRoleDefault(role)) {
      const existing = moduleMap.get(configuredModule.key);
      if (!existing) {
        moduleMap.set(configuredModule.key, {
          key: configuredModule.key,
          label: configuredModule.label,
          hrefs: [...configuredModule.hrefs],
        });
        continue;
      }
      for (const href of configuredModule.hrefs) {
        if (!existing.hrefs.includes(href)) existing.hrefs.push(href);
      }
    }
  }
  return Array.from(moduleMap.values());
}

function resolveStoredRoleModules(sidebarAccess) {
  if (!Array.isArray(sidebarAccess?.modules)) return null;
  return sidebarAccess.modules.map((storedModule) => ({
    key: String(storedModule?.key || "").trim(),
    label: String(storedModule?.label || "").trim(),
    hrefs: Array.isArray(storedModule?.items)
      ? storedModule.items
      : Array.isArray(storedModule?.hrefs)
      ? storedModule.hrefs
      : [],
  }));
}

// Role-first Workspace Navigation. Defaults are explicitly authored per staff
// role; a stored module layout replaces only presentation. Existing v1-v3
// group/item snapshots remain valid and are projected over the role default,
// with previously granted extra Pages retained in an Additional Tools module.
export function getRoleWorkspaceModules(roles, sidebarAccess = null) {
  const catalog = getWorkspacePageCatalog();
  const byHref = new Map(catalog.map((item) => [item.href, item]));
  const roleSet = normalizeRoleSet(roles);
  const roleAccessible = getAccessibleNavPaths(roles);
  const storedModules = resolveStoredRoleModules(sidebarAccess);
  const sourceModules = storedModules || roleDefaultModules(roles);
  const legacySnapshot = !storedModules && Array.isArray(sidebarAccess?.items)
    ? new Set(sidebarAccess.items)
    : null;
  const used = new Set();
  const modules = [];

  for (const sourceModule of sourceModules) {
    if (!sourceModule.key || !sourceModule.label) continue;
    const items = [];
    for (const href of sourceModule.hrefs || []) {
      const item = byHref.get(href);
      if (!item || used.has(href)) continue;
      if (legacySnapshot && !legacySnapshot.has(href)) continue;
      if (!storedModules) {
        const isDashboard = item.kind === "dashboard";
        const visible = isDashboard
          ? itemVisibleTo(item, roleSet)
          : roleAccessible.has(href);
        if (!visible) continue;
      }
      used.add(href);
      items.push({
        label: item.label,
        href: item.href,
        kind: item.kind,
        department: item.department,
      });
    }
    if (items.length > 0) {
      modules.push({ key: sourceModule.key, label: sourceModule.label, items });
    }
  }

  if (legacySnapshot) {
    const extraItems = catalog
      .filter((item) => legacySnapshot.has(item.href) && !used.has(item.href))
      .map((item) => ({
        label: item.label,
        href: item.href,
        kind: item.kind,
        department: item.department,
      }));
    if (extraItems.length > 0) {
      modules.push({ key: "additional-tools", label: "Additional Tools", items: extraItems });
    }
  }

  return modules;
}

export function getRoleDefaultWorkspaceModules(role) {
  return getRoleWorkspaceModules(role ? [role] : []);
}

function matchesDynamicRoute(pattern, pathname) {
  const patternParts = pathOf(pattern).split("/").filter(Boolean);
  const pathParts = pathOf(pathname).split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) =>
    /^\[[^\]]+\]$/.test(part) || part === pathParts[index]
  );
}

export function getActiveRoleWorkspaceModule(pathname, roles, sidebarAccess = null, pendingHref = null) {
  const target = pathOf(pendingHref) || pathOf(pathname);
  if (!target) return null;
  const modules = getRoleWorkspaceModules(roles, sidebarAccess);
  for (const navigationModule of modules) {
    if (navigationModule.items.some((item) => isContextNavItemActive(item, target))) {
      return navigationModule.key;
    }
  }
  for (const [pattern, parentHrefs] of Object.entries(DYNAMIC_DETAIL_EXTENDS)) {
    if (!matchesDynamicRoute(pattern, target)) continue;
    const owner = modules.find((navigationModule) =>
      navigationModule.items.some((item) => parentHrefs.includes(pathOf(item.href)))
    );
    if (owner) return owner.key;
  }
  return null;
}

// resolveAccessiblePaths(roles, sidebarAccess) — the authoritative landable-path
// set once the per-user override is applied. This is what pageAccess.js and the
// sidebar consume. When no snapshot exists it is byte-for-byte
// getAccessibleNavPaths(roles).
export function resolveAccessiblePaths(roles, sidebarAccess) {
  const roleBased = getAccessibleNavPaths(roles);
  void sidebarAccess;
  return roleBased;
  // Paths OUTSIDE the editor universe keep their role-derived access (quick
  // actions, accounts-context extras, etc.) — the snapshot never touches them.
  // WITHIN the editor universe the snapshot is authoritative.
  // 🔒 Invariants a snapshot can never strip: account essentials (Profile) and
  // the developer platform route for the dev role.
}

function applyStoredItemOrder(items, departmentKey, sidebarAccess) {
  const stored = sidebarAccess?.itemOrder?.[departmentKey];
  if (!Array.isArray(stored) || stored.length === 0) return items;
  const positions = new Map(stored.map((href, index) => [href, index]));
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aPosition = positions.has(a.item.href) ? positions.get(a.item.href) : Number.MAX_SAFE_INTEGER;
      const bPosition = positions.has(b.item.href) ? positions.get(b.item.href) : Number.MAX_SAFE_INTEGER;
      return aPosition - bPosition || a.index - b.index;
    })
    .map(({ item }) => item);
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
export function getDepartmentWorkspaceNav(departmentKey, roles, sidebarAccess = null) {
  const department = WORKSPACE_DEPARTMENTS.find((dept) => dept.key === departmentKey) || null;
  const roleSet = normalizeRoleSet(roles);
  const hasManagedSnapshot = Boolean(
    sidebarAccess && Array.isArray(sidebarAccess.items) && Array.isArray(sidebarAccess.groups)
  );
  const snapshotItems = hasManagedSnapshot ? new Set(sidebarAccess.items) : null;

  // Dashboards sub-section — the role-visible dashboards this group owns.
  const dashboards = [];
  const dashboardSeen = new Set();
  for (const shortcut of WORKSPACE_DASHBOARD_SHORTCUTS) {
    if (shortcut.department !== departmentKey) continue;
    if (!shortcut.href || dashboardSeen.has(shortcut.href)) continue;
    if (hasManagedSnapshot ? !snapshotItems.has(shortcut.href) : !itemVisibleTo(shortcut, roleSet)) continue;
    dashboardSeen.add(shortcut.href);
    dashboards.push({ label: shortcut.label, href: shortcut.href });
  }

  const seen = new Set();
  const items = [];
  for (const section of workspaceSectionsForDepartment(departmentKey)) {
    for (const item of section.items || []) {
      if (!item.href) continue;
      if (hasManagedSnapshot ? !snapshotItems.has(item.href) : !itemVisibleTo(item, roleSet, section.department)) continue;
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      items.push({ label: item.label, href: item.href });
    }
  }

  // 🔒 DEVELOPER SIDEBAR LOCK — self-heal. Inside the Developer group the dev
  // role must ALWAYS get the Developer Platform button; re-inject it from
  // DEVELOPER_GROUP_LOCK if a manifest edit ever removed the developer nav item.
  if (departmentKey === DEVELOPER_GROUP_LOCK.key && roleSet.has("dev")) {
    const { navItem } = DEVELOPER_GROUP_LOCK;
    if (!seen.has(navItem.href)) {
      seen.add(navItem.href);
      items.push({ label: navItem.label, href: navItem.href });
    }
  }

  return {
    department: departmentKey,
    label:
      department?.label ||
      (departmentKey === DEVELOPER_GROUP_LOCK.key ? DEVELOPER_GROUP_LOCK.label : departmentKey),
    home: department?.home || null,
    icon: department?.icon || null,
    category: department?.category || null,
    dashboards: applyStoredItemOrder(dashboards, departmentKey, sidebarAccess),
    itemCount: items.length,
    items: applyStoredItemOrder(items, departmentKey, sidebarAccess),
  };
}

// Phase 9: Modules are an organisational projection of a group's already
// authorised Pages. They never add permissions and unmatched legacy pages stay
// visible in a final "Pages" module during migration.
export function getWorkspaceModules(departmentKey, roles, sidebarAccess = null) {
  const nav = getDepartmentWorkspaceNav(departmentKey, roles, sidebarAccess);
  const remaining = new Map((nav.items || []).map((item) => [item.href, item]));
  const modules = (WORKSPACE_MODULES[departmentKey] || []).map((navigationModule) => {
    const items = (navigationModule.hrefs || []).map((href) => remaining.get(href)).filter(Boolean);
    items.forEach((item) => remaining.delete(item.href));
    return { key: navigationModule.key, label: navigationModule.label, items };
  }).filter((navigationModule) => navigationModule.items.length > 0);
  if (remaining.size > 0) modules.push({ key: "pages", label: "Pages", items: Array.from(remaining.values()) });
  return modules;
}

export function getActiveWorkspaceModule(departmentKey, pathname, roles, sidebarAccess = null, pendingHref = null) {
  const target = pathOf(pendingHref) || pathOf(pathname);
  if (!target) return null;
  for (const navigationModule of getWorkspaceModules(departmentKey, roles, sidebarAccess)) {
    if (navigationModule.items.some((item) => isContextNavItemActive(item, target))) return navigationModule.key;
  }
  return null;
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
export function getWorkspaceGroups(roles, sidebarAccess = null) {
  const hasManagedSnapshot = Boolean(sidebarAccess && Array.isArray(sidebarAccess.groups));
  const selectedGroups = hasManagedSnapshot ? new Set(sidebarAccess.groups) : null;
  const roleSet = normalizeRoleSet(roles);
  const groups = (hasManagedSnapshot ? WORKSPACE_DEPARTMENTS : getWorkspaceRail(roles)).filter(
    (group) => group.category === "general" || group.category === "departments"
  ).filter((group) => group.key !== DEVELOPER_GROUP_LOCK.key || roleSet.has("dev"))
    .filter((group) => !selectedGroups || selectedGroups.has(group.key))
    .map((group) => ({
      key: group.key,
      label: group.label,
      category: group.category,
      icon: group.icon,
      home: group.home || null,
    }));
  // 🔒 DEVELOPER SIDEBAR LOCK — self-heal. The dev role must ALWAYS get the
  // Developer group button. If a manifest edit ever drops the developer
  // department, re-inject it from DEVELOPER_GROUP_LOCK so the dev sidebar can
  // never lose its entry. Strictly dev-only, preserving the /dev gating.
  if (roleSet.has("dev") && !groups.some((group) => group.key === DEVELOPER_GROUP_LOCK.key)) {
    groups.push({
      key: DEVELOPER_GROUP_LOCK.key,
      label: DEVELOPER_GROUP_LOCK.label,
      category: DEVELOPER_GROUP_LOCK.category,
      icon: DEVELOPER_GROUP_LOCK.icon,
      home: DEVELOPER_GROUP_LOCK.home,
    });
  }
  return groups;
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
export function getActiveWorkspaceDepartment(pathname, roles, sidebarAccess = null) {
  const path = pathOf(pathname);
  if (!path) return null;
  const allowedGroupKeys = new Set(
    getWorkspaceGroups(roles, sidebarAccess).map((group) => group.key)
  );
  const departments = WORKSPACE_DEPARTMENTS.filter(
    (dept) => dept.category === "departments" && allowedGroupKeys.has(dept.key)
  );

  // The routes a group owns = its home + its dashboards + its pages. The home is
  // included explicitly so landing on /dashboard/<dept> always resolves to its
  // group even when the dashboard shortcut itself is gated to narrower roles.
  const deptNavPaths = departments.map((department) => {
    const nav = getDepartmentWorkspaceNav(department.key, roles, sidebarAccess);
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
  const preferredDepartmentCodes = Array.from(normalizeRoleSet(roles))
    .map((role) => ROLE_DEPARTMENT_MAP[role])
    .filter(Boolean);
  for (const code of preferredDepartmentCodes) {
    const department = WORKSPACE_DEPARTMENTS.find(
      (dept) => dept.key === code && dept.category === "departments" && dept.home
    );
    if (department) return department.home;
  }
  const departments = getDepartmentsForRoles(roles).filter(
    (dept) => dept.category === "departments" && dept.home
  );
  return departments.length > 0 ? departments[0].home : "/newsfeed";
}

// getBreadcrumbTrail(pathname, roles) — Department › Page trail for the current
// route. The entity segment (job number, customer name, …) is not in the
// manifest and is appended by the page in a later phase.
export function getBreadcrumbTrail(pathname, roles, sidebarAccess = null) {
  const path = pathOf(pathname);
  const roleModules = getRoleWorkspaceModules(roles, sidebarAccess);
  const activeModuleKey = getActiveRoleWorkspaceModule(path, roles, sidebarAccess);
  const activeModule = roleModules.find((candidate) => candidate.key === activeModuleKey);
  if (activeModule) {
    const exact = activeModule.items.find((item) => pathOf(item.href) === path);
    let owner = exact || null;
    if (!owner) {
      for (const [pattern, parents] of Object.entries(DYNAMIC_DETAIL_EXTENDS)) {
        if (!matchesDynamicRoute(pattern, path)) continue;
        owner = activeModule.items.find((item) => parents.includes(pathOf(item.href))) || null;
        if (owner) break;
      }
    }
    if (!owner) {
      owner = activeModule.items.find((item) => isContextNavItemActive(item, path)) || null;
    }
    return [
      { label: activeModule.label, href: null },
      ...(owner ? [{ label: owner.label, href: owner.href }] : []),
    ];
  }
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

export function getWorkspaceShortcutItems(roles, sidebarAccess = null) {
  const seen = new Map();
  for (const item of [...getSearchItems(roles, sidebarAccess), ...getQuickActions(roles)]) {
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
export function getSearchItems(roles, sidebarAccess = null) {
  return getRoleWorkspaceModules(roles, sidebarAccess).flatMap((navigationModule) =>
    navigationModule.items.map((item) => ({
      label: item.label,
      href: item.href,
      department: navigationModule.label,
      module: navigationModule.key,
    }))
  );
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
