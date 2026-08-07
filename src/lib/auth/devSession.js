// file location: src/lib/auth/devSession.js
// Canonical identification for the synthetic Developer Platform session.

import { DEV_PLATFORM_ROLE, hasAnyRole } from "@/lib/auth/roles";

export const DEV_PLATFORM_USER_ID = "dev-platform";

export function isSyntheticDevPlatformUser(user = null) {
  if (!user || user.isDevLogin !== true) return false;

  const userId = user.id ?? user.user_id ?? null;
  return (
    String(userId || "").trim() === DEV_PLATFORM_USER_ID &&
    hasAnyRole(user.roles || [], [DEV_PLATFORM_ROLE])
  );
}

export function isSyntheticDevPlatformSession(session = null) {
  return isSyntheticDevPlatformUser(session?.user || null);
}

/**
 * Same identification against a NextAuth JWT, whose fields are named
 * `userId` / `roles` / `isDevLogin` rather than the session-user's `id`.
 * Kept import-light so src/proxy.js (edge runtime) can call it.
 */
export function isSyntheticDevPlatformToken(token = null) {
  if (!token) return false;
  return isSyntheticDevPlatformUser({
    id: token.userId,
    roles: token.roles,
    isDevLogin: token.isDevLogin,
  });
}

/**
 * The Developer Platform login is a diagnostic account: it must be able to open
 * every page in the app so audits, style reviews and layout overlays can be run
 * against the real screens. This grants that page-level access ONLY — it never
 * adds roles to the user, so the sidebar, topbar, quick actions and every
 * role-driven feature check still see exactly the `dev` role and render nothing
 * extra. No other account is affected.
 */
export function hasDevPlatformPageAccess(user = null) {
  return isSyntheticDevPlatformUser(user);
}
