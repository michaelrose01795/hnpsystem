import { describe, expect, it } from "vitest";
import {
  buildTechnicianCapacitySchedule,
  getDailyContractedHours,
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
});
