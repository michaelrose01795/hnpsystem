import { describe, expect, it } from "vitest";
import {
  buildCapacitySummary,
  buildWorkshopAttention,
  buildWorkshopBoard,
  CLOCKING_STATUSES,
} from "@/lib/clocking/workshopBoard";

const NOW = new Date("2026-08-12T12:00:00.000Z");

const baseSnapshot = {
  users: [{ user_id: 7, first_name: "Sam", last_name: "Park", role: "Technician", email: "sam@example.com" }],
  timeRecords: [{ id: 1, user_id: 7, clock_in: "2026-08-12T08:00:00.000Z", clock_out: null, break_minutes: 0, notes: null }],
  jobClockings: [{ id: 4, user_id: 7, job_id: 10, job_number: "J100", request_id: 50, clock_in: "2026-08-12T09:00:00.000Z", clock_out: null }],
  jobs: [{
    id: 10,
    job_number: "J100",
    description: "Front brakes",
    status: "IN PROGRESS",
    assigned_to: 7,
    queue_position: 1,
    appointments: [],
    job_requests: [{ request_id: 50, description: "Replace front pads", hours: 2, job_type: "Customer", sort_order: 1, status: "inprogress" }],
    vhc_checks: [],
  }],
};

describe("workshop clocking board", () => {
  it("uses the selected request allocation and preserves live decimal hours", () => {
    const board = buildWorkshopBoard(baseSnapshot, NOW);
    expect(board.technicians[0]).toMatchObject({
      status: CLOCKING_STATUSES.IN_PROGRESS,
      currentDescription: "Replace front pads",
      activityHours: 3,
      actualHours: 3,
      allocatedHours: 2,
      differenceHours: 1,
      isOverAllocated: true,
    });
  });

  it("derives capacity without changing efficiency calculations", () => {
    const board = buildWorkshopBoard(baseSnapshot, NOW);
    expect(buildCapacitySummary(board, { totalHours: 8 })).toMatchObject({
      working: 1,
      total: 1,
      productiveHours: 3,
      remainingHours: 5,
      utilisationPct: 37.5,
    });
  });

  it("surfaces only actionable over-allocation and expected-attendance exceptions", () => {
    const board = buildWorkshopBoard(baseSnapshot, NOW);
    const capacityDay = { technicians: [{ userId: 7, effectiveHours: 8 }] };
    const attention = buildWorkshopAttention(board.technicians, capacityDay, 30);
    expect(attention.map((item) => item.id)).toEqual(["allocation-7-10"]);
  });
});

