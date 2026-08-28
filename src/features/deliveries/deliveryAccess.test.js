// Route-access regression cover for the Parts Driver grant.
//
// Giving drivers /deliveries also has to NOT give them anything else. The
// DYNAMIC_DETAIL_EXTENDS entries for /parts and /parts-manager used to inherit
// from /deliveries, which would have handed a driver the Parts Manager screen;
// these tests pin both halves — the driver stays on one page, and Parts and
// Parts Manager keep everything they had.
import { describe, expect, it } from "vitest";
import { canAccessPath } from "@/lib/auth/pageAccess";

const PARTS_PAGES = ["/deliveries", "/delivery-planner", "/stock-catalogue", "/goods-in", "/jobs", "/parts-manager", "/parts"];

describe("delivery diary access", () => {
  it("gives a Parts Driver the diary and nothing else", () => {
    const roles = ["Parts Driver"];
    expect(canAccessPath("/deliveries", roles)).toBe(true);
    for (const page of PARTS_PAGES.filter((p) => p !== "/deliveries")) {
      expect([page, canAccessPath(page, roles)]).toEqual([page, false]);
    }
    expect(canAccessPath("/hr/manager", roles)).toBe(false);
    expect(canAccessPath("/admin/users", roles)).toBe(false);
  });

  it("leaves Parts and Parts Manager exactly as they were", () => {
    for (const role of ["Parts", "Parts Manager"]) {
      for (const page of PARTS_PAGES) {
        expect([role, page, canAccessPath(page, [role])]).toEqual([role, page, true]);
      }
    }
  });

  it("does not open the diary to unrelated roles", () => {
    for (const role of ["Service", "Techs", "Valet Service", "Admin Manager", "MOT Tester"]) {
      expect([role, canAccessPath("/deliveries", [role])]).toEqual([role, false]);
    }
  });
});
