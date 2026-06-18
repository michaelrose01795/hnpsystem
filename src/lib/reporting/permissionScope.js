// file location: src/lib/reporting/permissionScope.js
//
// PRIORITY 9 — Reporting permission layer (Phase-1 §9.3 / §14, ADR-7).
//
// Built ENTIRELY on the existing role system (src/lib/auth/roles.js). No parallel
// identity/permission store. Server-side only — the client never decides
// visibility. Derives, from a user's roles, the row/column scope they may see:
//
//   - Visibility LEVEL: self | department | cross-department | executive
//   - DEPARTMENTS visible: a list of dim_department codes, or 'all'
//   - SENSITIVE gates (orthogonal): financial (pay/PII/£ detail) per HR/Accounts
//   - The user id, for self-scope row filtering
//
// The engine injects this scope as a mandatory WHERE into every query, and the
// KPI catalogue's per-KPI `permission` array gates whether a KPI is offered at all.

import {
  normalizeRoles,
  hasAnyRole,
  MANAGER_SCOPED_ROLES,
  HR_CORE_ROLES,
} from "@/lib/auth/roles";
import { resolveDepartmentForRoles, resolveDepartmentForRole } from "./config/departments";

// Reporting-specific role groupings (lowercase), layered on the shared constants.
export const EXECUTIVE_ROLES = Object.freeze([
  "owner",
  "admin manager",
  "general manager",
  "after sales director",
  "sales director",
  "buying director",
]);

export const DEPARTMENT_MANAGER_ROLES = Object.freeze([
  "service manager",
  "workshop manager",
  "workshop controller",
  "parts manager",
  "accounts manager",
  "after sales manager",
  "aftersales manager",
  "admin manager",
]);

// Roles permitted to see financial detail (£, AR, payments) — Accounts + execs.
export const FINANCIAL_SENSITIVE_ROLES = Object.freeze([
  "accounts",
  "accounts manager",
  ...EXECUTIVE_ROLES,
]);

// Visibility level constants.
export const SCOPE_LEVELS = Object.freeze({
  SELF: "self",
  DEPARTMENT: "department",
  CROSS_DEPARTMENT: "cross-department",
  EXECUTIVE: "executive",
});

// Resolve the reporting scope for a session/roles. Pass either a session object
// or an array of roles. `userId` is the canonical id used for self-scope filters.
export function resolveScope(input) {
  const session = input && input.user ? input : null;
  const roles = normalizeRoles(session ? session.user?.roles || [] : input || []);
  const userId = session ? Number(session.user?.id) || null : null;

  const isExecutive = hasAnyRole(roles, EXECUTIVE_ROLES);
  const isCrossDept = isExecutive || hasAnyRole(roles, MANAGER_SCOPED_ROLES);
  const isDeptManager = hasAnyRole(roles, DEPARTMENT_MANAGER_ROLES);

  const sensitive = {
    // Pay / PII (NI, salary, payslips, disciplinary) — HR core only (§14.1).
    pii: hasAnyRole(roles, HR_CORE_ROLES),
    // Financial detail (£, AR, payments) — Accounts + execs.
    financial: hasAnyRole(roles, FINANCIAL_SENSITIVE_ROLES),
  };

  let level;
  let departments;
  let scopedUserId = null;

  if (isExecutive) {
    level = SCOPE_LEVELS.EXECUTIVE;
    departments = "all";
  } else if (isCrossDept) {
    level = SCOPE_LEVELS.CROSS_DEPARTMENT;
    departments = "all";
  } else if (isDeptManager) {
    level = SCOPE_LEVELS.DEPARTMENT;
    // A manager may map to multiple departments via multiple roles.
    departments = Array.from(
      new Set(roles.map((r) => resolveDepartmentForRole(r)).filter(Boolean))
    );
    if (departments.length === 0) {
      const fallback = resolveDepartmentForRoles(roles);
      departments = fallback ? [fallback] : [];
    }
  } else {
    // Operational role → own records, own department only (§14.1).
    level = SCOPE_LEVELS.SELF;
    const dept = resolveDepartmentForRoles(roles);
    departments = dept ? [dept] : [];
    scopedUserId = userId;
  }

  return {
    level,
    departments, // 'all' | string[]
    userId: scopedUserId, // non-null only at self scope
    sensitive,
    roles,
  };
}

// Can this scope see a given department code?
export function canSeeDepartment(scope, departmentCode) {
  if (!scope) return false;
  if (scope.departments === "all") return true;
  return Array.isArray(scope.departments) && scope.departments.includes(departmentCode);
}

// Does this scope satisfy a KPI's `permission` requirement? A KPI's permission is
// an array that may contain explicit role names AND/OR the symbolic tokens
// 'MANAGER_SCOPED_ROLES' / 'HR_CORE_ROLES' / 'self' (own-scope ok). Empty/absent
// permission means "any authenticated reporting user".
export function scopeSatisfiesKpiPermission(scope, permission) {
  if (!permission || permission.length === 0) return true;
  if (!scope) return false;
  if (scope.level === SCOPE_LEVELS.EXECUTIVE) return true; // execs see everything (§14.1)

  const roles = scope.roles || [];
  for (const token of permission) {
    if (token === "self") return true;
    if (token === "MANAGER_SCOPED_ROLES" && hasAnyRole(roles, MANAGER_SCOPED_ROLES)) return true;
    if (token === "HR_CORE_ROLES" && hasAnyRole(roles, HR_CORE_ROLES)) return true;
    if (typeof token === "string" && hasAnyRole(roles, [token])) return true;
  }
  return false;
}

// Stable hash of a scope for cache keys.
export function scopeHash(scope) {
  if (!scope) return "noscope";
  const depts = scope.departments === "all" ? "all" : (scope.departments || []).slice().sort().join(",");
  return `${scope.level}:${depts}:${scope.userId || 0}:${scope.sensitive?.financial ? 1 : 0}${scope.sensitive?.pii ? 1 : 0}`;
}

// Warnings surfaced into the envelope when a scope narrows what was requested.
export function scopeWarnings(scope, requestedDepartment) {
  const warnings = [];
  if (requestedDepartment && !canSeeDepartment(scope, requestedDepartment)) {
    warnings.push(`department "${requestedDepartment}" is outside your reporting scope — results narrowed`);
  }
  return warnings;
}

export default resolveScope;
