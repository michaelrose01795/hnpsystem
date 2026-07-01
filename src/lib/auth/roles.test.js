// file location: src/lib/auth/roles.test.js
//
// Phase 8 — guards the strict isolation of the synthetic `dev` role: it grants
// Developer Platform access, but must NEVER be assignable through normal staff
// role management (roleCategories) and must NEVER leak in via presentation
// mode's broad access list (DEV_FULL_ACCESS_ROLES).

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
  it("defines the strict dev role + roles list", () => {
    expect(DEV_PLATFORM_ROLE).toBe("dev");
    expect(DEV_PLATFORM_ROLES).toEqual(["dev"]);
  });

  it("hasDevPlatformAccess is true only for the dev role (case-insensitive)", () => {
    expect(hasDevPlatformAccess(["dev"])).toBe(true);
    expect(hasDevPlatformAccess(["DEV"])).toBe(true);
    expect(hasDevPlatformAccess(["Owner", "Admin"])).toBe(false);
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

  it("a broad admin role does NOT satisfy the strict dev gate", () => {
    // The whole point of the Phase 8 re-gate: managers/admins lose dev access.
    expect(hasDevPlatformAccess(["admin manager"])).toBe(false);
    expect(hasDevPlatformAccess(["owner"])).toBe(false);
  });
});
