// file location: src/lib/auth/roles.js

import { roleCategories } from "@/config/users";

export const HR_CORE_ROLES = ["hr manager", "admin manager", "owner", "admin"];
export const HR_MANAGER_ROLES = ["admin manager", "owner", "admin"];
export const MANAGER_SCOPED_ROLES = ["manager", "service manager", "workshop manager", "general manager"];
export const HR_MANAGER_DASHBOARD_ROLES = ["owner", "admin manager"];
export const DEV_FULL_ACCESS_ROLES = Array.from(
  new Set(
    [
      ...Object.values(roleCategories || {}).flat(),
      "HR Manager",
      "After Sales Manager",
      "Aftersales Manager",
      "Manager",
      "Admin",
      "Admin Manager",
      "Owner",
      "General Manager",
      "Accounts",
      "Accounts Manager",
      "Service",
      "Service Manager",
      "Workshop Manager",
      "Parts",
      "Parts Manager",
      "Techs",
      "MOT Tester",
      "Valet Service",
    ]
      .map((role) => role?.toString().trim())
      .filter(Boolean)
  )
);

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

export function canAccessHrManagerDashboard(userRoles) {
  return hasAnyRole(userRoles, HR_MANAGER_DASHBOARD_ROLES);
}
