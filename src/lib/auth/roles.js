// file location: src/lib/auth/roles.js

import { roleCategories } from "@/config/users";

export const HR_CORE_ROLES = ["hr manager", "admin manager", "owner", "admin"];
export const HR_MANAGER_ROLES = ["admin manager", "owner", "admin"];
export const MANAGER_SCOPED_ROLES = ["manager", "service manager", "workshop manager", "general manager"];
export const HR_MANAGER_DASHBOARD_ROLES = ["owner", "admin manager"];
export const MOBILE_TECH_ROLES = ["mobile technician"];
export const MOBILE_TECH_ALLOW_UPPER = ["MOBILE TECHNICIAN"];
export const WORKSHOP_CONTROLLER_ROLES = ["workshop manager", "workshop controller"];
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
      "Mobile Technician",
    ]
      .map((role) => role?.toString().trim())
      .filter(Boolean)
  )
);

// Developer Platform role (Phase 8). This role exists ONLY inside the Dev Login
// (minted in code by the synthetic "Developer" area → NextAuth credentials,
// gated by isDevAuthAllowed()). It is deliberately NOT part of roleCategories
// (so it can never be picked in the HR role-assignment surfaces) and NOT part of
// DEV_FULL_ACCESS_ROLES (so it never leaks in via presentation mode). Every
// developer-only Developer Platform surface (the Support Centre + its APIs)
// gates strictly on this role.
export const DEV_PLATFORM_ROLE = "dev";
export const DEV_PLATFORM_ROLES = [DEV_PLATFORM_ROLE];

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

export function isMobileTechnician(userRoles) {
  return hasAnyRole(userRoles, MOBILE_TECH_ROLES);
}

// Developer Platform access gate (Phase 8). Strict: only the `dev` role passes.
export function hasDevPlatformAccess(userRoles) {
  return hasAnyRole(userRoles, DEV_PLATFORM_ROLES);
}
