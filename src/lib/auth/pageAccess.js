// file location: src/lib/auth/pageAccess.js
// Enforces the rule: "users can only access pages that appear in
// their sidebar or topbar." The accessible set is derived per-user
// from the existing nav config so there is one source of truth.
//
// canAccessPath(pathname, roles) returns true when:
//   1. The pathname is in ALWAYS_ALLOWED_PATHS or matches an always-allowed
//      prefix (login, auth, customer portal, website, etc.), OR
//   2. The pathname exactly matches an href in the user's filtered sidebar
//      or topbar, OR
//   3. The pathname is a dynamic-detail page covered by DYNAMIC_DETAIL_EXTENDS
//      whose underlying list page is itself accessible.
//
// Pages reached purely by direct URL with no nav presence will be blocked.

import { sidebarSections } from "@/config/navigation";
// Route access lists now live in one place — src/config/routeAccess.js — and are
// shared with src/proxy.js so the edge guard and the client guard agree.
import {
  ACCOUNTS_NAV_LINKS,
  ALWAYS_ALLOWED_EXACT,
  ALWAYS_ALLOWED_PREFIXES,
  DYNAMIC_DETAIL_EXTENDS,
  TOPBAR_LINKS,
} from "@/config/routeAccess";

const normalizeRoles = (roles) =>
  (Array.isArray(roles) ? roles : [roles])
    .filter(Boolean)
    .map((role) => String(role).toLowerCase().trim());

const hasMatchingRole = (allowedRoles, userRoleSet) => {
  if (!allowedRoles || allowedRoles.length === 0) return true; // open to all signed-in staff
  if (allowedRoles instanceof Set) {
    for (const role of userRoleSet) if (allowedRoles.has(role)) return true;
    return false;
  }
  return allowedRoles.some((role) => userRoleSet.has(String(role).toLowerCase()));
};

const isAlwaysAllowed = (pathname) => {
  if (ALWAYS_ALLOWED_EXACT.has(pathname)) return true;
  return ALWAYS_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

// Walk the sidebar + topbar configs once per role-set and return the
// set of pathnames the user is allowed to land on directly.
export const getAccessibleNavPaths = (roles) => {
  const userRoleSet = new Set(normalizeRoles(roles));
  const accessible = new Set();

  for (const section of sidebarSections) {
    for (const item of section.items || []) {
      if (!item.href) continue;
      if (hasMatchingRole(item.roles || [], userRoleSet)) {
        accessible.add(item.href);
      }
    }
  }

  for (const link of TOPBAR_LINKS) {
    if (hasMatchingRole(link.roles, userRoleSet)) {
      accessible.add(link.href);
    }
  }

  for (const link of ACCOUNTS_NAV_LINKS) {
    if (hasMatchingRole(link.roles, userRoleSet)) {
      accessible.add(link.href);
    }
  }

  return accessible;
};

export const canAccessPath = (pathname, roles) => {
  if (!pathname) return true;
  if (isAlwaysAllowed(pathname)) return true;

  const accessible = getAccessibleNavPaths(roles);
  if (accessible.has(pathname)) return true;

  const extendsFrom = DYNAMIC_DETAIL_EXTENDS[pathname];
  if (Array.isArray(extendsFrom)) {
    return extendsFrom.some((p) => accessible.has(p));
  }

  return false;
};
