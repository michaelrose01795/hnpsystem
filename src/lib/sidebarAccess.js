// file location: src/lib/sidebarAccess.js
// Pure helpers for the versioned, database-backed per-user sidebar layout.

import {
  WORKSPACE_MODULES,
  getAccessibleNavPaths,
  getAllSidebarItems,
  getDepartmentWorkspaceNav,
  getKnownSidebarHrefs,
  getLegacySidebarHrefs,
  getRoleDefaultWorkspaceModules,
  getRoleWorkspaceModules,
  getSidebarModuleCatalog,
  getWorkspaceGroupRoles,
  getWorkspaceGroups,
  getWorkspacePageCatalog,
  normalizeWorkspaceRole,
} from "@/config/workspace/manifest";

export const SIDEBAR_ACCESS_VERSION = 5;

const managedGroups = () =>
  getAllSidebarItems().filter(
    (group) => group.category === "general" || group.category === "departments"
  );

const slugifyKey = (value, fallback = "module") => {
  const slug = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
};

function normaliseModules(rawModules) {
  if (!Array.isArray(rawModules)) return null;
  const catalogHrefs = new Set(getWorkspacePageCatalog().map((item) => item.href));
  const seenKeys = new Map();
  const seenHrefs = new Set();
  return rawModules.reduce((modules, rawModule, index) => {
    const baseKey = slugifyKey(rawModule?.key || rawModule?.label, `module-${index + 1}`);
    const count = seenKeys.get(baseKey) || 0;
    seenKeys.set(baseKey, count + 1);
    const key = count > 0 ? `${baseKey}-${count + 1}` : baseKey;
    const label = String(rawModule?.label || key.replace(/-/g, " ")).trim();
    const rawItems = Array.isArray(rawModule?.items)
      ? rawModule.items
      : Array.isArray(rawModule?.hrefs)
      ? rawModule.hrefs
      : [];
    const items = [];
    for (const rawHref of rawItems) {
      const href = String(rawHref || "").trim();
      if (!catalogHrefs.has(href) || seenHrefs.has(href)) continue;
      seenHrefs.add(href);
      items.push(href);
    }
    if (!label || items.length === 0) return modules;
    modules.push({ key, label, items });
    return modules;
  }, []);
}

function flattenModuleItems(modules) {
  return [...new Set((modules || []).flatMap((module) => module.items || []))];
}

// Refresh assigned standard bundles from the current Developer Platform module
// library. Custom modules remain untouched. Earlier assigned modules retain a
// duplicated route when two standard bundles offer it, matching the editor's
// existing first-owner/no-duplicates rule.
export function syncAssignedStandardModules(modules) {
  if (!Array.isArray(modules)) return [];

  const standardByKey = new Map(
    getSidebarModuleCatalog().map((module) => [module.key, module])
  );
  const knownHrefs = new Set(getWorkspacePageCatalog().map((item) => item.href));
  const usedHrefs = new Set();

  return modules.reduce((synced, module) => {
    const key = String(module?.key || "").trim();
    if (!key) return synced;

    const standard = standardByKey.get(key);
    const sourceItems = standard
      ? standard.items.map((item) => item.href)
      : Array.isArray(module?.items)
      ? module.items.map((item) => typeof item === "string" ? item : item?.href)
      : [];
    const items = sourceItems.filter((href) => {
      if (!knownHrefs.has(href) || usedHrefs.has(href)) return false;
      usedHrefs.add(href);
      return true;
    });
    if (items.length === 0) return synced;

    synced.push({
      key,
      label: standard?.label || String(module?.label || key).trim(),
      items,
    });
    return synced;
  }, []);
}

export function getSidebarAccessGroup(groupKey) {
  return managedGroups().find((group) => group.department === groupKey) || null;
}

export function getRoleDefaultSidebarAccess(role) {
  const roles = role ? [role] : [];
  const known = getKnownSidebarHrefs();
  const groups = getWorkspaceGroups(roles);
  const defaultModules = getRoleDefaultWorkspaceModules(role);
  const items = new Set(flattenModuleItems(defaultModules).filter((href) => known.has(href)));
  const roleAccessible = getAccessibleNavPaths(roles);
  for (const href of roleAccessible) {
    if (known.has(href)) items.add(href);
  }
  for (const group of groups) {
    const nav = getDepartmentWorkspaceNav(group.key, roles);
    [...(nav.dashboards || []), ...(nav.items || [])].forEach((item) => {
      if (known.has(item.href)) items.add(item.href);
    });
  }
  return {
    version: SIDEBAR_ACCESS_VERSION,
    sourceRole: normalizeWorkspaceRole(role),
    items: [...items],
    groups: groups.map((group) => group.key),
    itemOrder: {},
    moduleOrder: {},
    pagePlacements: {},
    modules: defaultModules.map((module) => ({
      key: module.key,
      label: module.label,
      items: module.items.map((item) => item.href),
    })),
  };
}

export function createSidebarAccessFromRole(role) {
  return getRoleDefaultSidebarAccess(role);
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

  if (!value || typeof value !== "object") return undefined;

  const modules = normaliseModules(value.modules);
  const knownHrefs = getKnownSidebarHrefs();
  const suppliedItems = Array.isArray(value.items) ? value.items : flattenModuleItems(modules);
  if (!Array.isArray(suppliedItems)) return undefined;

  const items = [...new Set(suppliedItems.filter((href) => knownHrefs.has(href)))];
  const knownGroupKeys = new Set(managedGroups().map((group) => group.department));
  const groups = Array.isArray(value.groups)
    ? [...new Set(value.groups.filter((key) => knownGroupKeys.has(key)))]
    : undefined;
  const itemOrder = {};
  const moduleOrder = {};
  const pagePlacements = {};
  for (const group of managedGroups()) {
    const stored = value.itemOrder?.[group.department];
    if (Array.isArray(stored)) {
      const groupHrefs = new Set(group.items.map((item) => item.href));
      const order = [...new Set(stored.filter((href) => groupHrefs.has(href)))];
      if (order.length > 0) itemOrder[group.department] = order;
    }
    const validModuleKeys = new Set((WORKSPACE_MODULES[group.department] || []).map((module) => module.key));
    const storedModules = value.moduleOrder?.[group.department];
    if (Array.isArray(storedModules)) {
      const order = [...new Set(storedModules.filter((key) => validModuleKeys.has(key)))];
      if (order.length > 0) moduleOrder[group.department] = order;
    }
  }
  const catalogHrefs = new Set(getWorkspacePageCatalog().map((item) => item.href));
  if (value.pagePlacements && typeof value.pagePlacements === "object") {
    for (const [href, moduleKey] of Object.entries(value.pagePlacements)) {
      const normalizedHref = String(href || "").trim();
      const normalizedModuleKey = slugifyKey(moduleKey, "");
      if (catalogHrefs.has(normalizedHref) && normalizedModuleKey) {
        pagePlacements[normalizedHref] = normalizedModuleKey;
      }
    }
  }

  return {
    version: SIDEBAR_ACCESS_VERSION,
    sourceRole: normalizeWorkspaceRole(value.sourceRole),
    items,
    ...(groups ? { groups } : {}),
    itemOrder,
    moduleOrder,
    pagePlacements,
    ...(modules && modules.length > 0 ? { modules } : {}),
  };
}

export function materializeSidebarAccess(role, currentValue) {
  const normalized = normalizeSidebarAccess(currentValue);
  if (normalized?.modules?.length > 0) return normalized;

  const defaults = getRoleDefaultSidebarAccess(role);
  const legacyUniverse = getLegacySidebarHrefs();
  const migratedItems = new Set(normalized?.items || defaults.items);
  if (normalized) {
    defaults.items.forEach((href) => {
      if (!legacyUniverse.has(href)) migratedItems.add(href);
    });
  }
  const projected = getRoleWorkspaceModules([role].filter(Boolean), {
    ...normalized,
    items: [...migratedItems],
  });
  return normalizeSidebarAccess({
    ...defaults,
    ...normalized,
    version: SIDEBAR_ACCESS_VERSION,
    sourceRole: normalizeWorkspaceRole(normalized?.sourceRole || role),
    items: [...migratedItems],
    groups: normalized?.groups || defaults.groups,
    itemOrder: normalized?.itemOrder || {},
    moduleOrder: normalized?.moduleOrder || {},
    pagePlacements: normalized?.pagePlacements || {},
    modules: projected.map((module) => ({
      key: module.key,
      label: module.label,
      items: module.items.map((item) => item.href),
    })),
  });
}

export function applySidebarModuleLayout({
  role,
  currentValue,
  modules,
  sourceRole,
}) {
  const snapshot = materializeSidebarAccess(role, currentValue);
  const nextModules = normaliseModules(modules);
  if (!nextModules || nextModules.length === 0) {
    throw new Error("At least one sidebar module with pages is required.");
  }
  return normalizeSidebarAccess({
    ...snapshot,
    version: SIDEBAR_ACCESS_VERSION,
    sourceRole: normalizeWorkspaceRole(sourceRole || snapshot.sourceRole || role),
    items: flattenModuleItems(nextModules),
    modules: nextModules,
  });
}

// Materialise the complete source snapshot once before a layout is copied to
// other users. Recipients must receive this value unchanged; rebuilding it from
// each recipient's current override would retain recipient-specific placement
// metadata and produce a different layout from the selected source user.
export function createSidebarLayoutCopy({
  role,
  currentValue,
  modules,
  sourceRole,
}) {
  return applySidebarModuleLayout({
    role,
    currentValue,
    modules,
    sourceRole,
  });
}

export function applySidebarPagePlacements({
  role,
  currentValue,
  pagePlacements,
}) {
  const snapshot = normalizeSidebarAccess(currentValue) || getRoleDefaultSidebarAccess(role);
  return normalizeSidebarAccess({
    ...snapshot,
    version: SIDEBAR_ACCESS_VERSION,
    pagePlacements: {
      ...(snapshot.pagePlacements || {}),
      ...(pagePlacements && typeof pagePlacements === "object" ? pagePlacements : {}),
    },
  });
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
  const groups = new Set(snapshot.groups || []);
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
    ...snapshot,
    items: [...items],
    groups: [...groups],
    itemOrder: nextOrder,
    modules: undefined,
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

export function isSidebarAccessOverride(value) {
  const normalized = normalizeSidebarAccess(value);
  return Boolean(normalized?.modules?.length || normalized?.groups?.length || normalized?.items?.length);
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
