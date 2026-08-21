import { describe, expect, it } from "vitest";
import {
  WORKSHOP_APPOINTMENT_TIME_OPTIONS,
  formatAppointmentTimestamp,
  isWorkshopAppointmentTime,
  toAppointmentTimestamp,
} from "./dateTime";

describe("appointment date and time handling", () => {
  it("offers half-hour workshop slots from 8 AM through 5 PM", () => {
    expect(WORKSHOP_APPOINTMENT_TIME_OPTIONS).toHaveLength(19);
    expect(WORKSHOP_APPOINTMENT_TIME_OPTIONS[0]).toEqual({ value: "08:00", label: "8:00 AM" });
    expect(WORKSHOP_APPOINTMENT_TIME_OPTIONS.at(-1)).toEqual({ value: "17:00", label: "5:00 PM" });
    expect(isWorkshopAppointmentTime("07:30")).toBe(false);
    expect(isWorkshopAppointmentTime("17:30")).toBe(false);
  });

  it("stores winter appointments at the equivalent UTC instant", () => {
    expect(toAppointmentTimestamp("2026-01-15", "08:00")).toBe("2026-01-15T08:00:00.000Z");
  });

  it("stores BST appointments without changing their London wall-clock time", () => {
    const timestamp = toAppointmentTimestamp("2026-08-20", "08:00");

    expect(timestamp).toBe("2026-08-20T07:00:00.000Z");
    expect(formatAppointmentTimestamp(timestamp)).toEqual({ date: "2026-08-20", time: "08:00" });
  });

  it("formats the same appointment consistently regardless of the server timezone", () => {
    expect(formatAppointmentTimestamp("2026-08-20T07:00:00.000Z")).toEqual({
      date: "2026-08-20",
      time: "08:00",
    });
  });

  it("rejects times outside workshop booking hours", () => {
    expect(() => toAppointmentTimestamp("2026-08-20", "07:00")).toThrow(
      "between 8:00 AM and 5:00 PM"
    );
  });
});
