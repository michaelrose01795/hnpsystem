import { describe, expect, it } from "vitest";
import {
  buildWorkshopCapacitySegments,
  buildTechnicianCapacitySchedule,
  getDayCapacityProgress,
  getDailyContractedHours,
  getJobCapacityDateKey,
  getLeaveHoursForDate,
} from "@/lib/capacity/technicianCapacity";

const technician = {
  user_id: 7,
  first_name: "Alex",
  last_name: "Taylor",
  email: "alex@example.com",
  role: "Techs",
  contracted_hours: 40,
};

describe("technician capacity", () => {
  it("derives a standard day from weekly contracted hours", () => {
    expect(getDailyContractedHours(40)).toBe(8);
    expect(getDailyContractedHours(30)).toBe(6);
  });

  it("removes a full approved leave day", () => {
    const leave = { start_date: "2026-07-23", end_date: "2026-07-23", notes: "" };
    expect(getLeaveHoursForDate(leave, "2026-07-23", 8)).toBe(8);
  });

  it("removes half a standard day for a half-day request", () => {
    const leave = {
      start_date: "2026-07-23",
      end_date: "2026-07-23",
      notes: JSON.stringify({ halfDay: "AM" }),
    };
    expect(getLeaveHoursForDate(leave, "2026-07-23", 8)).toBe(4);
  });

  it("uses a manual date override after applying the HR-derived suggestion", () => {
    const [day] = buildTechnicianCapacitySchedule({
      users: [technician],
      dates: ["2026-07-23"],
      absences: [{
        user_id: 7,
        type: "Holiday",
        start_date: "2026-07-23",
        end_date: "2026-07-23",
        notes: JSON.stringify({ halfDay: "PM" }),
      }],
      overrides: [{ user_id: 7, capacity_date: "2026-07-23", available_hours: 6 }],
    });

    expect(day.technicians[0]).toMatchObject({
      dailyHours: 8,
      leaveHours: 4,
      suggestedHours: 4,
      overrideHours: 6,
      effectiveHours: 6,
      hasOverride: true,
    });
    expect(day.totalHours).toBe(6);
  });

  it("uses the appointment date and falls back to the active capacity date", () => {
    expect(getJobCapacityDateKey({
      appointment: { scheduledTime: "2026-07-28T09:00:00.000Z" },
    }, "2026-07-27")).toBe("2026-07-28");
    expect(getJobCapacityDateKey({}, "2026-07-27")).toBe("2026-07-27");
  });

  it("totals explicitly completed request and VHC labour", () => {
    expect(getDayCapacityProgress([{
      id: 10,
      techCompletionStatus: null,
      vhcChecks: [{
        approval_status: "authorized",
        labour_hours: 2,
        labour_complete: true,
      }],
    }], {
      10: { totalHours: 3, completedHours: 1 },
    })).toEqual({
      plannedHours: 5,
      completedHours: 3,
      remainingHours: 2,
    });
  });

  it("preserves completed and remaining capacity before the overloaded segment", () => {
    expect(buildWorkshopCapacitySegments({
      capacityHours: 10,
      completedHours: 2,
      remainingPlannedHours: 11,
    })).toMatchObject({
      greenPct: 15.38,
      amberPct: 61.54,
      redPct: 23.08,
      neutralPct: 0,
      overloadHours: 3,
      capacityMarkerPct: 76.92,
    });
  });

  it("shows assigned work as red when a technician has no capacity", () => {
    expect(buildWorkshopCapacitySegments({
      capacityHours: 0,
      completedHours: 0,
      remainingPlannedHours: 2,
    })).toMatchObject({
      greenPct: 0,
      amberPct: 0,
      redPct: 100,
      overloadHours: 2,
    });
  });

  it("keeps completed capacity green and marks completed overrun red", () => {
    expect(buildWorkshopCapacitySegments({
      capacityHours: 8,
      completedHours: 10,
      remainingPlannedHours: 0,
    })).toMatchObject({
      greenPct: 80,
      amberPct: 0,
      redPct: 20,
      overloadHours: 2,
    });
  });
});
