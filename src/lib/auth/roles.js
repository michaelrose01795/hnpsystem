// file location: src/lib/auth/roles.js

export const HR_CORE_ROLES = ["hr manager", "admin manager", "owner", "admin"];
export const HR_MANAGER_ROLES = ["admin manager", "owner", "admin"];
export const MANAGER_SCOPED_ROLES = ["manager", "service manager", "workshop manager", "general manager"];

export function normalizeRoles(roles = []) {
  return roles.map((role) => role?.toString().toLowerCase().trim()).filter(Boolean);
}

export function hasAnyRole(userRoles, allowedRoles = []) {
  const normalized = normalizeRoles(userRoles);
  return allowedRoles.some((role) => normalized.includes(role.toLowerCase()));
}

export function isHrCoreRole(userRoles) {
  return hasAnyRole(userRoles, HR_CORE_ROLES);
}

export function isAdminManagerRole(userRoles) {
  return hasAnyRole(userRoles, HR_MANAGER_ROLES);
}

export function isManagerScopedRole(userRoles) {
  return hasAnyRole(userRoles, MANAGER_SCOPED_ROLES);
}
