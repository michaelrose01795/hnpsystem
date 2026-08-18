import { describe, expect, it } from "vitest";
import {
  buildCapacitySummary,
  buildWorkshopAttention,
  buildWorkshopBoard,
  CLOCKING_STATUSES,
  reconcileJobClockingsWithTimeRecords,
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
  it("reconciles a stale open job clocking from its closed attendance pair", () => {
    const jobClockings = [{
      id: 1004,
      user_id: 35,
      job_id: 3969,
      clock_in: "2026-08-03T14:36:09.261Z",
      clock_out: null,
    }];
    const timeRecords = [{
      id: 475,
      user_id: 35,
      job_id: 3969,
      clock_in: "2026-08-03T14:36:09.261+00:00",
      clock_out: "2026-08-03T23:59:59.000Z",
    }];

    expect(reconcileJobClockingsWithTimeRecords(jobClockings, timeRecords)[0]).toMatchObject({
      clock_out: "2026-08-03T23:59:59.000Z",
      reconciledFromTimeRecord: true,
    });
  });

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

  it("lists every non-VHC request with the clocked-on one first", () => {
    const snapshot = {
      ...baseSnapshot,
      jobs: [{
        ...baseSnapshot.jobs[0],
        job_requests: [
          { request_id: 49, description: "Oil service", hours: 1, sort_order: 0, status: "pending" },
          { request_id: 50, description: "Replace front pads", hours: 2, sort_order: 1, status: "inprogress" },
          { request_id: 51, description: "Advisory tyre", hours: 1, sort_order: 2, vhc_item_id: 900 },
        ],
      }],
    };
    const board = buildWorkshopBoard(snapshot, NOW);
    expect(board.technicians[0].currentDescriptions).toEqual(["Replace front pads", "Oil service"]);
  });

  it("uses linked VHC labour when the selected request intentionally has null hours", () => {
    const snapshot = {
      ...baseSnapshot,
      jobClockings: [{ ...baseSnapshot.jobClockings[0], request_id: 51 }],
      jobs: [{
        ...baseSnapshot.jobs[0],
        job_requests: [{
          request_id: 51,
          description: "Rear pads",
          hours: null,
          job_type: "Customer",
          sort_order: 1,
          status: "complete",
          request_source: "vhc_authorised",
          vhc_item_id: 900,
        }],
        vhc_checks: [{
          vhc_id: 900,
          request_id: 51,
          approval_status: "pending",
          labour_hours: 2,
          labour_complete: true,
          Complete: true,
        }],
      }],
    };

    const board = buildWorkshopBoard(snapshot, NOW);
    expect(board.technicians[0]).toMatchObject({
      currentDescription: "Rear pads",
      allocatedHours: 2,
      allocationAvailable: true,
    });
  });

  it("uses a daily workshop assignment instead of changing the permanent user role", () => {
    const snapshot = {
      ...baseSnapshot,
      assignments: [{ user_id: 7, assignment_date: "2026-08-12", assignment_type: "mot" }],
    };

    const board = buildWorkshopBoard(snapshot, NOW);
    expect(board.technicians[0]).toMatchObject({
      role: "Technician",
      defaultWorkshopAssignment: "tech",
      workshopAssignment: "mot",
      isMotRole: true,
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

