// file location: src/config/navigation.test.js
//
// Phase 11 — the "Developer Platform" sidebar entry must be visible ONLY to the
// synthetic `dev` role and route to /dev. Because the sidebar drives both
// visibility and PageAccessGuard, a leak here would expose the dev platform to
// staff — so lock it with a test that mirrors StaffSidebar's hasAccess() rule.

import { describe, it, expect } from "vitest";
import { sidebarSections } from "@/config/navigation";
import { hasDevPlatformAccess } from "@/lib/auth/roles";

// Mirrors StaffSidebar.hasAccess() (case-insensitive; empty roles = everyone).
function canSee(item, userRoles) {
  if (!item.roles || item.roles.length === 0) return true;
  const roles = userRoles.map((r) => r.toLowerCase());
  return item.roles.some((required) => roles.includes(required.toLowerCase()));
}

const findDevItem = () => {
  for (const section of sidebarSections) {
    for (const item of section.items) {
      if (item.href === "/dev") return { section, item };
    }
  }
  return null;
};

describe("navigation — Developer Platform sidebar entry", () => {
  it("exists, routes to /dev, and is gated to the dev role", () => {
    const found = findDevItem();
    expect(found).not.toBeNull();
    expect(found.section.label).toBe("Developer");
    expect(found.item.roles).toEqual(["dev"]);
  });

  it("is visible to a dev session and hidden from staff", () => {
    const { item } = findDevItem();
    expect(canSee(item, ["dev"])).toBe(true);
    // Representative staff roles must NOT see it.
    for (const staffRole of ["service", "workshop manager", "admin manager", "owner", "parts", "techs"]) {
      expect(canSee(item, [staffRole])).toBe(false);
    }
  });

  it("never appears for a session with no roles", () => {
    const { item } = findDevItem();
    expect(canSee(item, [])).toBe(false);
  });
});

describe("dev role gating stays strict", () => {
  it("hasDevPlatformAccess only accepts the dev role", () => {
    expect(hasDevPlatformAccess(["dev"])).toBe(true);
    for (const staffRole of ["service", "workshop manager", "admin manager", "owner", "admin"]) {
      expect(hasDevPlatformAccess([staffRole])).toBe(false);
    }
    expect(hasDevPlatformAccess([])).toBe(false);
  });
});
