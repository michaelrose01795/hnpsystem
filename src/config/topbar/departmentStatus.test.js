// file location: src/config/topbar/departmentStatus.test.js
//
// Phase 1.2 — reusable department status registry. Locks the live-vs-fallback
// contract, presentation-mode suppression, pluralisation, and safe defaults.

import { describe, it, expect } from "vitest";
import {
  buildDepartmentStatus,
  DEPARTMENT_STATUS_FALLBACKS,
  DEFAULT_DEPARTMENT_STATUS,
} from "@/config/topbar/departmentStatus";

describe("buildDepartmentStatus", () => {
  it("produces a live summary from real headcount", () => {
    const result = buildDepartmentStatus("workshop", {
      headcount: { techs: 4 },
    });
    expect(result).toEqual({ text: "4 technicians on the floor", isLive: true });
  });

  it("pluralises correctly for a single person", () => {
    const result = buildDepartmentStatus("mot", { headcount: { motTesters: 1 } });
    expect(result.text).toBe("1 MOT tester on shift");
    expect(result.isLive).toBe(true);
  });

  it("uses an irregular plural where configured", () => {
    expect(buildDepartmentStatus("parts", { headcount: { parts: 1 } }).text).toBe(
      "1 person on the parts desk"
    );
    expect(buildDepartmentStatus("parts", { headcount: { parts: 3 } }).text).toBe(
      "3 people on the parts desk"
    );
  });

  it("falls back to static copy when there is no live signal", () => {
    const result = buildDepartmentStatus("workshop", { headcount: { techs: 0 } });
    expect(result).toEqual({
      text: DEPARTMENT_STATUS_FALLBACKS.workshop,
      isLive: false,
    });
  });

  it("suppresses live data in the presentation shell", () => {
    const result = buildDepartmentStatus("workshop", {
      isPresentation: true,
      headcount: { techs: 9 },
    });
    expect(result).toEqual({
      text: DEPARTMENT_STATUS_FALLBACKS.workshop,
      isLive: false,
    });
  });

  it("uses static fallback for departments without a builder", () => {
    const result = buildDepartmentStatus("accounts", { headcount: { techs: 5 } });
    expect(result).toEqual({
      text: DEPARTMENT_STATUS_FALLBACKS.accounts,
      isLive: false,
    });
  });

  it("returns the default status for an unknown / null department", () => {
    expect(buildDepartmentStatus(null, {})).toEqual({
      text: DEFAULT_DEPARTMENT_STATUS,
      isLive: false,
    });
    expect(buildDepartmentStatus("nonsense", {}).text).toBe(DEFAULT_DEPARTMENT_STATUS);
  });

  it("never throws when signals are missing", () => {
    expect(() => buildDepartmentStatus("workshop")).not.toThrow();
    expect(buildDepartmentStatus("workshop").isLive).toBe(false);
  });
});
