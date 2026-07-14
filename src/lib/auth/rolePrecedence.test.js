// file location: src/lib/auth/rolePrecedence.test.js
//
// Phase 1.3 — centralised primary-role selection. Locks the two behaviours the
// identity line depends on: (1) the most significant role wins regardless of
// array order, and (2) display labels preserve known acronyms.

import { describe, it, expect } from "vitest";
import {
  getPrimaryRole,
  getPrimaryRoleLabel,
  formatRoleLabel,
} from "@/lib/auth/rolePrecedence";

describe("getPrimaryRole", () => {
  it("returns null for an empty / missing role set", () => {
    expect(getPrimaryRole([])).toBeNull();
    expect(getPrimaryRole()).toBeNull();
    expect(getPrimaryRole(null)).toBeNull();
  });

  it("picks the most significant role regardless of array order", () => {
    // 'techs' comes first but 'workshop manager' outranks it.
    expect(getPrimaryRole(["techs", "workshop manager"])).toBe("workshop manager");
    expect(getPrimaryRole(["workshop manager", "techs"])).toBe("workshop manager");
  });

  it("prefers leadership over a department manager", () => {
    expect(getPrimaryRole(["service manager", "owner"])).toBe("owner");
  });

  it("is case-insensitive and trims", () => {
    expect(getPrimaryRole(["  Service Manager ", "TECHS"])).toBe("service manager");
  });

  it("falls back to the first role when none are known", () => {
    expect(getPrimaryRole(["made up role", "another"])).toBe("made up role");
  });

  it("ranks a known role above an unknown one", () => {
    expect(getPrimaryRole(["made up role", "service"])).toBe("service");
  });
});

describe("formatRoleLabel", () => {
  it("title-cases ordinary roles", () => {
    expect(formatRoleLabel("service manager")).toBe("Service Manager");
    expect(formatRoleLabel("parts driver")).toBe("Parts Driver");
  });

  it("preserves acronyms", () => {
    expect(formatRoleLabel("mot tester")).toBe("MOT Tester");
    expect(formatRoleLabel("hr manager")).toBe("HR Manager");
  });

  it("returns an empty string for falsy input", () => {
    expect(formatRoleLabel("")).toBe("");
    expect(formatRoleLabel(null)).toBe("");
  });
});

describe("getPrimaryRoleLabel", () => {
  it("combines precedence + formatting", () => {
    expect(getPrimaryRoleLabel(["techs", "mot tester"])).toBe("MOT Tester");
  });

  it("returns an empty string when there are no roles", () => {
    expect(getPrimaryRoleLabel([])).toBe("");
  });
});
