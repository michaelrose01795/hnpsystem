import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clockInToJob: vi.fn(),
  clockOutFromJob: vi.fn(),
  getJobByNumber: vi.fn(),
  getUserActiveJobs: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock("@/lib/auth/roleGuard", () => ({
  withRoleGuard: (handler) => handler,
}));

vi.mock("@/lib/database/jobs", () => ({
  getJobByNumber: mocks.getJobByNumber,
}));

vi.mock("@/lib/database/jobClocking", () => ({
  clockInToJob: mocks.clockInToJob,
  clockOutFromJob: mocks.clockOutFromJob,
  getUserActiveJobs: mocks.getUserActiveJobs,
}));

vi.mock("@/lib/database/users", () => ({
  getUserById: mocks.getUserById,
}));

import { manageClockingHandler } from "./manage";

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader: vi.fn((name, value) => {
      response.headers[name] = value;
    }),
    status: vi.fn((statusCode) => {
      response.statusCode = statusCode;
      return response;
    }),
    json: vi.fn((body) => {
      response.body = body;
      return response;
    }),
  };
  return response;
};

describe("manager technician clocking API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserById.mockResolvedValue({ id: 7, role: "Techs" });
  });

  it("clocks the selected technician off their verified active entry", async () => {
    mocks.getUserActiveJobs.mockResolvedValue({
      success: true,
      data: [{ clockingId: 12, jobId: 34 }],
    });
    mocks.clockOutFromJob.mockResolvedValue({
      success: true,
      data: { clockingId: 12, clockOut: "2026-07-27T12:00:00.000Z" },
    });
    const response = createResponse();

    await manageClockingHandler(
      { method: "POST", body: { action: "clock-out", userId: 7, clockingId: 12 } },
      response
    );

    expect(mocks.clockOutFromJob).toHaveBeenCalledWith({
      userId: 7,
      jobId: 34,
      clockingId: 12,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("rejects a stale clock-off request instead of updating the wrong entry", async () => {
    mocks.getUserActiveJobs.mockResolvedValue({
      success: true,
      data: [{ clockingId: 99, jobId: 34 }],
    });
    const response = createResponse();

    await manageClockingHandler(
      { method: "POST", body: { action: "clock-out", userId: 7, clockingId: 12 } },
      response
    );

    expect(mocks.clockOutFromJob).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(409);
  });

  it("clocks the selected technician onto the resolved job", async () => {
    mocks.getJobByNumber.mockResolvedValue({
      data: { jobCard: { id: 34, job_number: "00040" } },
      error: null,
    });
    mocks.clockInToJob.mockResolvedValue({
      success: true,
      data: { clockingId: 13, jobId: 34, jobNumber: "00040" },
    });
    const response = createResponse();

    await manageClockingHandler(
      { method: "POST", body: { action: "clock-in", userId: 7, jobNumber: "00040" } },
      response
    );

    expect(mocks.clockInToJob).toHaveBeenCalledWith({
      userId: 7,
      jobId: 34,
      jobNumber: "00040",
      workType: "manual",
    });
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
