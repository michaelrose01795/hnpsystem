// file location: src/lib/sidebarAccess.js
// Pure helpers for the versioned, database-backed per-user sidebar snapshot.

import {
  getAccessibleNavPaths,
  getAllSidebarItems,
  getDepartmentWorkspaceNav,
  getLegacySidebarHrefs,
  getKnownSidebarHrefs,
  getWorkspaceGroups,
  getWorkspaceGroupRoles,
  WORKSPACE_MODULES,
} from "@/config/workspace/manifest";

export const SIDEBAR_ACCESS_VERSION = 3;

const managedGroups = () =>
  getAllSidebarItems().filter(
    (group) => group.category === "general" || group.category === "departments"
  );

export function getSidebarAccessGroup(groupKey) {
  return managedGroups().find((group) => group.department === groupKey) || null;
}

export function getRoleDefaultSidebarAccess(role) {
  const roles = role ? [role] : [];
  const known = getKnownSidebarHrefs();
  const groups = getWorkspaceGroups(roles);
  const items = new Set(
    [...getAccessibleNavPaths(roles)].filter((href) => known.has(href))
  );
  for (const group of groups) {
    const nav = getDepartmentWorkspaceNav(group.key, roles);
    [...(nav.dashboards || []), ...(nav.items || [])].forEach((item) => {
      if (known.has(item.href)) items.add(item.href);
    });
  }
  return {
    items: [...items],
    groups: groups.map((group) => group.key),
    itemOrder: {},
    moduleOrder: {},
  };
}

export function normalizeSidebarAccess(raw) {
  if (raw === undefined) return undefined;
  if (raw === null) return null;

  let value = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "null") return null;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }

  if (!value || !Array.isArray(value.items)) return undefined;
  const knownHrefs = getKnownSidebarHrefs();
  const knownGroupKeys = new Set(managedGroups().map((group) => group.department));
  const items = [...new Set(value.items.filter((href) => knownHrefs.has(href)))];

  if (!Array.isArray(value.groups)) {
    return { items };
  }

  const groups = [...new Set(value.groups.filter((key) => knownGroupKeys.has(key)))];
  const itemOrder = {};
  const moduleOrder = {};
  for (const group of managedGroups()) {
    const stored = value.itemOrder?.[group.department];
    if (!Array.isArray(stored)) continue;
    const groupHrefs = new Set(group.items.map((item) => item.href));
    const order = [...new Set(stored.filter((href) => groupHrefs.has(href)))];
    if (order.length > 0) itemOrder[group.department] = order;
    const validModuleKeys = new Set((WORKSPACE_MODULES[group.department] || []).map((module) => module.key));
    const storedModules = value.moduleOrder?.[group.department];
    if (Array.isArray(storedModules)) {
      const order = [...new Set(storedModules.filter((key) => validModuleKeys.has(key)))];
      if (order.length > 0) moduleOrder[group.department] = order;
    }
  }

  return { version: SIDEBAR_ACCESS_VERSION, items, groups, itemOrder, moduleOrder };
}

export function materializeSidebarAccess(role, currentValue) {
  const normalized = normalizeSidebarAccess(currentValue);
  if (normalized && Array.isArray(normalized.groups)) return normalized;

  const defaults = getRoleDefaultSidebarAccess(role);
  const legacyUniverse = getLegacySidebarHrefs();
  const migratedItems = new Set(normalized?.items || defaults.items);
  if (normalized) {
    defaults.items.forEach((href) => {
      if (!legacyUniverse.has(href)) migratedItems.add(href);
    });
  }
  return {
    version: SIDEBAR_ACCESS_VERSION,
    items: [...migratedItems],
    groups: defaults.groups,
    itemOrder: {},
    moduleOrder: {},
  };
}

export function applySidebarGroupChange({
  role,
  currentValue,
  groupKey,
  enabled,
  itemOrder,
}) {
  const group = getSidebarAccessGroup(groupKey);
  if (!group) throw new Error(`Unknown sidebar group: ${groupKey}`);

  const snapshot = materializeSidebarAccess(role, currentValue);
  const items = new Set(snapshot.items);
  const groups = new Set(snapshot.groups);
  const groupHrefs = group.items.map((item) => item.href);

  if (enabled) {
    groups.add(groupKey);
    groupHrefs.forEach((href) => items.add(href));
  } else {
    groups.delete(groupKey);
    groupHrefs.forEach((href) => items.delete(href));
  }

  const nextOrder = { ...snapshot.itemOrder };
  if (enabled && Array.isArray(itemOrder)) {
    const valid = new Set(groupHrefs);
    nextOrder[groupKey] = [
      ...new Set([...itemOrder.filter((href) => valid.has(href)), ...groupHrefs]),
    ];
  } else if (!enabled) {
    delete nextOrder[groupKey];
  }

  return normalizeSidebarAccess({
    version: SIDEBAR_ACCESS_VERSION,
    items: [...items],
    groups: [...groups],
    itemOrder: nextOrder,
  });
}

export function applySidebarGroupUserSelection({
  role,
  currentValue,
  groupKey,
  enabled,
  selectedItemHrefs,
  itemOrder,
}) {
  const group = getSidebarAccessGroup(groupKey);
  if (!group) throw new Error(`Unknown sidebar group: ${groupKey}`);
  const snapshot = applySidebarGroupChange({
    role,
    currentValue,
    groupKey,
    enabled,
    itemOrder,
  });
  if (!enabled) return snapshot;

  const allowed = new Set(
    Array.isArray(selectedItemHrefs) ? selectedItemHrefs : group.items.map((item) => item.href)
  );
  const groupHrefs = new Set(group.items.map((item) => item.href));
  return normalizeSidebarAccess({
    ...snapshot,
    items: snapshot.items.filter((href) => !groupHrefs.has(href) || allowed.has(href)),
  });
}

export function isSidebarGroupEnabled(role, value, groupKey) {
  const normalized = normalizeSidebarAccess(value);
  if (normalized && Array.isArray(normalized.groups)) {
    return normalized.groups.includes(groupKey);
  }
  const assignedRoles = getWorkspaceGroupRoles(groupKey);
  if (assignedRoles === "*") return true;
  const normalizedRole = String(role || "").toLowerCase().trim();
  if (assignedRoles.some((assignedRole) => assignedRole === normalizedRole)) return true;
  return getRoleDefaultSidebarAccess(role).groups.includes(groupKey);
}
