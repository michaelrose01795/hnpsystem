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
