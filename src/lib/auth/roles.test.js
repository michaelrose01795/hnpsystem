// file location: src/lib/auth/roles.test.js
//
// Guards Developer Platform access for the synthetic `dev` login and every
// configured application role, while keeping `dev` out of normal role assignment.

import { describe, expect, it } from "vitest";
import {
  DEV_PLATFORM_ROLE,
  DEV_PLATFORM_ROLES,
  DEV_FULL_ACCESS_ROLES,
  hasDevPlatformAccess,
  hasAnyRole,
} from "@/lib/auth/roles";
import { roleCategories } from "@/config/users";

describe("dev platform role", () => {
  it("defines the synthetic dev role and includes every configured application role", () => {
    expect(DEV_PLATFORM_ROLE).toBe("dev");
    expect(DEV_PLATFORM_ROLES).toContain("dev");
    for (const role of DEV_FULL_ACCESS_ROLES) {
      expect(DEV_PLATFORM_ROLES).toContain(role);
    }
  });

  it("hasDevPlatformAccess accepts the dev role and configured user roles case-insensitively", () => {
    expect(hasDevPlatformAccess(["dev"])).toBe(true);
    expect(hasDevPlatformAccess(["DEV"])).toBe(true);
    expect(hasDevPlatformAccess(["Owner", "Admin"])).toBe(true);
    expect(hasDevPlatformAccess(["Customer"])).toBe(true);
    expect(hasDevPlatformAccess([])).toBe(false);
  });

  it("is NOT present in any roleCategories group (never HR-assignable)", () => {
    const everyAssignable = Object.values(roleCategories || {})
      .flat()
      .map((r) => String(r).toLowerCase());
    expect(everyAssignable).not.toContain("dev");
  });

  it("is NOT part of DEV_FULL_ACCESS_ROLES (never leaks via presentation mode)", () => {
    expect(hasAnyRole(["dev"], DEV_FULL_ACCESS_ROLES)).toBe(false);
  });

  it("broad staff roles satisfy the shared Developer Platform gate", () => {
    expect(hasDevPlatformAccess(["admin manager"])).toBe(true);
    expect(hasDevPlatformAccess(["owner"])).toBe(true);
  });
});
