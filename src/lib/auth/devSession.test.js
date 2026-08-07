import { describe, expect, it } from "vitest";
import {
  DEV_PLATFORM_USER_ID,
  hasDevPlatformPageAccess,
  isSyntheticDevPlatformSession,
  isSyntheticDevPlatformToken,
  isSyntheticDevPlatformUser,
} from "@/lib/auth/devSession";

describe("synthetic Developer Platform session", () => {
  const user = {
    id: DEV_PLATFORM_USER_ID,
    roles: ["DEV"],
    isDevLogin: true,
  };

  it("recognises the canonical synthetic developer identity", () => {
    expect(isSyntheticDevPlatformUser(user)).toBe(true);
    expect(isSyntheticDevPlatformSession({ user })).toBe(true);
  });

  it("does not treat employee-backed development logins as synthetic", () => {
    expect(isSyntheticDevPlatformUser({ ...user, id: "42" })).toBe(false);
  });

  it("requires both the dev-login marker and Developer Platform role", () => {
    expect(isSyntheticDevPlatformUser({ ...user, isDevLogin: false })).toBe(false);
    expect(isSyntheticDevPlatformUser({ ...user, roles: ["Admin"] })).toBe(false);
  });

  it("recognises the same identity on a NextAuth token", () => {
    expect(isSyntheticDevPlatformToken({ userId: DEV_PLATFORM_USER_ID, roles: ["dev"], isDevLogin: true })).toBe(true);
    expect(isSyntheticDevPlatformToken({ userId: "42", roles: ["dev"], isDevLogin: true })).toBe(false);
    expect(isSyntheticDevPlatformToken(null)).toBe(false);
  });

  it("grants full page access to the Developer Platform login and nobody else", () => {
    expect(hasDevPlatformPageAccess(user)).toBe(true);
    expect(hasDevPlatformPageAccess({ id: "7", roles: ["ADMIN", "ADMIN MANAGER"], isDevLogin: false })).toBe(false);
    expect(hasDevPlatformPageAccess({ id: "7", roles: ["ADMIN"], isDevLogin: true })).toBe(false);
    expect(hasDevPlatformPageAccess(null)).toBe(false);
  });
});
