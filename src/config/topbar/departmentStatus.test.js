// file location: src/config/topbar/departmentStatus.test.js
//
// Phase 2.1 — department status registry over the live `metrics` contract.

import { describe, it, expect } from "vitest";
import {
  buildDepartmentStatus,
  DEPARTMENT_STATUS_FALLBACKS,
  DEFAULT_DEPARTMENT_STATUS,
  count,
} from "@/config/topbar/departmentStatus";

describe("count", () => {
  it("pluralises regularly and irregularly", () => {
    expect(count(1, "job")).toBe("1 job");
    expect(count(3, "job")).toBe("3 jobs");
    expect(count(2, "person", "people")).toBe("2 people");
    expect(count(0, "part")).toBe("0 parts");
  });
});

describe("buildDepartmentStatus", () => {
  it("prefers the live jobs-in-progress summary for workshop", () => {
    expect(buildDepartmentStatus("workshop", { metrics: { jobsInProgress: 7 } })).toEqual({
      text: "7 jobs in progress",
      isLive: true,
    });
  });

  it("falls back within a builder to roster headcount", () => {
    expect(buildDepartmentStatus("workshop", { metrics: { techsOnShift: 4 } })).toEqual({
      text: "4 technicians on the floor",
      isLive: true,
    });
  });

  it("uses static fallback when no metric is present", () => {
    expect(buildDepartmentStatus("workshop", { metrics: {} })).toEqual({
      text: DEPARTMENT_STATUS_FALLBACKS.workshop,
      isLive: false,
    });
  });

  it("suppresses live data in the presentation shell", () => {
    expect(
      buildDepartmentStatus("workshop", { metrics: { jobsInProgress: 9 }, isPresentation: true })
    ).toEqual({ text: DEPARTMENT_STATUS_FALLBACKS.workshop, isLive: false });
  });

  it("returns the default for an unknown department", () => {
    expect(buildDepartmentStatus("nonsense", { metrics: {} }).text).toBe(DEFAULT_DEPARTMENT_STATUS);
    expect(buildDepartmentStatus(null, {}).text).toBe(DEFAULT_DEPARTMENT_STATUS);
  });

  it("ignores zero / negative metrics (treats them as absent)", () => {
    expect(buildDepartmentStatus("service", { metrics: { appointmentsToday: 0 } }).isLive).toBe(false);
  });

  it("never throws with missing args", () => {
    expect(() => buildDepartmentStatus("workshop")).not.toThrow();
  });
});
