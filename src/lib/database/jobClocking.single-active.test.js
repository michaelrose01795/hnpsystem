import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeRows: [],
  from: vi.fn(),
}));

vi.mock("@/lib/database/client", () => ({
  getDatabaseClient: () => ({ from: mocks.from }),
}));

vi.mock("@/lib/services/jobStatusService", () => ({
  logJobSubStatus: vi.fn(),
}));

vi.mock("@/lib/canonical/fields", () => ({
  getVehicleRegistration: vi.fn(() => ""),
}));

import {
  clockInToJob,
  resolveClockingDisplayWindow,
  sumJobClockingHours,
} from "./jobClocking";

describe("sumJobClockingHours", () => {
  it("includes both job-level and request-linked clocking entries", () => {
    expect(
      sumJobClockingHours([
        { requestId: null, hoursWorked: 40.39 },
        { requestId: null, hoursWorked: 3.12 },
        { requestId: 1, hoursWorked: 0.01 },
      ])
    ).toBe(43.52);
  });

  it("accepts database-shaped values and ignores invalid durations", () => {
    expect(
      sumJobClockingHours([
        { hours_worked: "2.5" },
        { hours_worked: null },
        { hoursWorked: -1 },
        { hoursWorked: "not-a-number" },
      ])
    ).toBe(2.5);
  });
});

describe("resolveClockingDisplayWindow", () => {
  it("keeps clock-off blank while using the current time for a live duration", () => {
    const now = Date.parse("2026-08-24T13:08:00.000Z");

    expect(
      resolveClockingDisplayWindow({
        clockIn: "2026-08-24T13:07:00.000Z",
        clockOut: null,
        now,
      })
    ).toEqual({
      clockIn: "2026-08-24T13:07:00.000Z",
      completedClockOut: null,
      durationEnd: "2026-08-24T13:08:00.000Z",
      isActive: true,
    });
  });

  it("uses the persisted timestamp after the technician clocks off", () => {
    const clockOut = "2026-08-24T14:12:00.000Z";

    expect(
      resolveClockingDisplayWindow({
        clockIn: "2026-08-24T13:07:00.000Z",
        clockOut,
        now: Date.parse("2026-08-24T15:00:00.000Z"),
      })
    ).toEqual({
      clockIn: "2026-08-24T13:07:00.000Z",
      completedClockOut: clockOut,
      durationEnd: clockOut,
      isActive: false,
    });
  });
});

describe("clockInToJob single-active-job guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeRows = [];
    mocks.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            order: () => ({
              limit: async () => ({ data: mocks.activeRows, error: null }),
            }),
          }),
        }),
      }),
    }));
  });

  it("rejects clock-in when the user already has an open job entry", async () => {
    mocks.activeRows = [
      {
        id: 907,
        job_id: 845,
        job_number: "ENR00765",
        clock_in: "2026-06-05T17:20:00.000Z",
      },
    ];

    const result = await clockInToJob({
      userId: 6,
      jobId: 305,
      jobNumber: "ENR00225",
      workType: "repair",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("already clocked onto job ENR00765");
    expect(result.error).toContain("Clock them off before starting another job");
  });
});
