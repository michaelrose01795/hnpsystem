import { describe, expect, it } from "vitest";
import {
  DEV_PLATFORM_USER_ID,
  isSyntheticDevPlatformSession,
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
});
