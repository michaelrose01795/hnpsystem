// file location: src/lib/auth/allAccessSession.js
// Canonical identification for the synthetic "All Access" demonstration session.
//
// The login screen's "All access" button mints this session through the NextAuth
// credentials provider (server-gated by isDevAuthAllowed(), exactly like the
// Developer Platform login). It exists so the app can be demonstrated end to end
// from ONE login: every workspace group, every module and every page is
// available without switching between real staff accounts.
//
// Kept import-light so src/proxy.js (edge runtime) can call it.

import { ALL_ACCESS_ROLE, hasAllAccessRole } from "@/lib/auth/roles";

// Fallback identity used only when the demo account's `users` row cannot be
// reached. A live session normally carries the row's numeric user_id instead.
export const ALL_ACCESS_USER_ID = "all-access";
export const ALL_ACCESS_DISPLAY_NAME = "All Access Demo";
export const ALL_ACCESS_DEPARTMENT = "Demonstration";

// Identified by the code-minted role, not by a fixed id: the session now
// carries the demo account's REAL users.user_id (see lib/database/allAccessUser)
// so per-user features work, and falls back to the synthetic id only when the
// database is unreachable. The `all access` role is the part that cannot be
// forged — it is never stored on a users row and is minted in exactly one
// place, behind isDevAuthAllowed(). isDevLogin narrows it further: an ordinary
// email/password session can never carry it.
export function isAllAccessUser(user = null) {
  if (!user || user.isDevLogin !== true) return false;
  return hasAllAccessRole(user.roles || []);
}

export function isAllAccessSession(session = null) {
  return isAllAccessUser(session?.user || null);
}

/**
 * Same identification against a NextAuth JWT, whose fields are named
 * `userId` / `roles` / `isDevLogin` rather than the session-user's `id`.
 */
export function isAllAccessToken(token = null) {
  if (!token) return false;
  return isAllAccessUser({
    id: token.userId,
    roles: token.roles,
    isDevLogin: token.isDevLogin,
  });
}

/**
 * The synthetic user object returned by the credentials provider. Declared here
 * so the identification helpers above and the thing they identify can never
 * drift apart.
 */
export const ALL_ACCESS_SESSION_USER = Object.freeze({
  id: ALL_ACCESS_USER_ID,
  name: ALL_ACCESS_DISPLAY_NAME,
  email: "",
  role: ALL_ACCESS_ROLE,
  roles: Object.freeze([ALL_ACCESS_ROLE]),
  department: ALL_ACCESS_DEPARTMENT,
  isDevLogin: true,
});
