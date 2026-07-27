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

import { clockInToJob } from "./jobClocking";

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
