// file location: src/lib/auth/roles.js

import { roleCategories } from "@/config/users";

export const HR_CORE_ROLES = ["hr manager", "admin manager", "owner", "admin"];
export const HR_MANAGER_ROLES = ["admin manager", "owner", "admin"];
export const MANAGER_SCOPED_ROLES = ["manager", "service manager", "workshop manager", "general manager"];
export const HR_MANAGER_DASHBOARD_ROLES = ["owner", "admin manager"];
export const MOBILE_TECH_ROLES = ["mobile technician"];
export const MOBILE_TECH_ALLOW_UPPER = ["MOBILE TECHNICIAN"];
export const WORKSHOP_CONTROLLER_ROLES = ["workshop manager", "workshop controller"];
export const TECHNICIAN_ROLES = [
  "Techs",
  "Technician",
  "Technician Lead",
  "Lead Technician",
  "MOT Tester",
  "Tester",
];
export const WORKSHOP_CAPACITY_MANAGER_ROLES = [
  "service manager",
  "workshop manager",
  "general manager",
  "admin manager",
  "owner",
  "admin",
];
export const WORKSHOP_CAPACITY_VIEW_ROLES = Array.from(new Set([
  ...WORKSHOP_CAPACITY_MANAGER_ROLES,
  ...TECHNICIAN_ROLES,
  "service",
  "mobile technician",
]));
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
// gated by isDevAuthAllowed()). It remains separate from roleCategories so it
// can never be picked in the HR role-assignment surfaces.
export const DEV_PLATFORM_ROLE = "dev";
// The platform is also available to every configured application user. Keeping
// the access list here means both the /dev pages and their APIs use the same
// rule, while the synthetic dev login continues to work independently.
export const DEV_PLATFORM_ROLES = Array.from(
  new Set([DEV_PLATFORM_ROLE, ...DEV_FULL_ACCESS_ROLES])
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

export function isMobileTechnician(userRoles) {
  return hasAnyRole(userRoles, MOBILE_TECH_ROLES);
}

// Developer Platform access gate: the synthetic dev role or any configured app role passes.
export function hasDevPlatformAccess(userRoles) {
  return hasAnyRole(userRoles, DEV_PLATFORM_ROLES);
}

// Diagnostics visibility gate (Phase 4, Frontend Feedback & Error System).
// Decides who may SEE and COPY the technical `devInfo` on an error toast; every
// other user still gets the friendly message + the short reference code. Delegates
// to the purpose-built Developer Platform role so the gate has a single source of
// truth and no hardcoded role strings live at the call site — widen here (never at
// the call site) if an approved diagnostic role group is later ratified.
export function canViewDiagnostics(userRoles) {
  return hasDevPlatformAccess(userRoles);
}
