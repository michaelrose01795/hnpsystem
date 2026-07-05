// file location: src/lib/auth/pageAccess.js
// Enforces the rule: "users can only access pages that appear in
// their manifest-derived navigation." The accessible set is derived per-user
// from the Workspace Navigation manifest so there is one source of truth.
//
// canAccessPath(pathname, roles) returns true when:
//   1. The pathname is in ALWAYS_ALLOWED_PATHS or matches an always-allowed
//      prefix (login, auth, customer portal, website, etc.), OR
//   2. The pathname exactly matches an href in the user's filtered
//      manifest navigation, OR
//   3. The pathname is a dynamic-detail page covered by DYNAMIC_DETAIL_EXTENDS
//      whose underlying list page is itself accessible.
//
// Pages reached purely by direct URL with no nav presence will be blocked.

import { getAccessibleNavPaths as getManifestAccessibleNavPaths } from "@/config/workspace/manifest";
// Route access lists now live in one place — src/config/routeAccess.js — and are
// shared with src/proxy.js so the edge guard and the client guard agree.
import {
  ALWAYS_ALLOWED_EXACT,
  ALWAYS_ALLOWED_PREFIXES,
  DYNAMIC_DETAIL_EXTENDS,
} from "@/config/routeAccess";

const isAlwaysAllowed = (pathname) => {
  if (ALWAYS_ALLOWED_EXACT.has(pathname)) return true;
  return ALWAYS_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

// Return the pathnames the user is allowed to land on directly. The selector is
// manifest-derived so sidebar, workspace nav, quick actions, search, and route
// permissions cannot drift.
export const getAccessibleNavPaths = (roles) => getManifestAccessibleNavPaths(roles);

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
