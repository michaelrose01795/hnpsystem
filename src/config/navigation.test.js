// file location: src/config/navigation.test.js
//
// The "Developer Platform" sidebar entry remains visible only to the synthetic
// `dev` role and routes to /dev. Configured users instead enter through the
// explicit DEV PAGE button on /dev/user-diagnostic.

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

describe("Developer Platform route access", () => {
  it("accepts the dev role and configured application roles", () => {
    expect(hasDevPlatformAccess(["dev"])).toBe(true);
    for (const staffRole of ["service", "workshop manager", "admin manager", "owner", "admin"]) {
      expect(hasDevPlatformAccess([staffRole])).toBe(true);
    }
    expect(hasDevPlatformAccess([])).toBe(false);
  });
});
