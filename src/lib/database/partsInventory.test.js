import { describe, expect, it } from "vitest";
import {
  filterUnpromotedPartRequests,
  isOpenPartsJob,
  summarizePartDemand,
} from "@/lib/database/partsInventory";

describe("parts inventory demand lineage", () => {
  it("counts distinct jobs, requirement rows, and requested units separately", () => {
    const result = summarizePartDemand({
      "part-1": [
        { job_id: 73, quantity: 1 },
        { job_id: 73, quantity: 2 },
        { job_id: 80, quantity: 4 },
      ],
    });

    expect(result.jobCounts["part-1"]).toBe(2);
    expect(result.requirementCounts["part-1"]).toBe(3);
    expect(result.demandQuantities["part-1"]).toBe(7);
  });

  it("does not allow negative or invalid quantities to inflate demand", () => {
    const result = summarizePartDemand({
      "part-1": [
        { job_id: 1, quantity: -3 },
        { job_id: 2, quantity: "invalid" },
      ],
    });

    expect(result.demandQuantities["part-1"]).toBe(0);
  });

  it("rejects completed, cancelled, collected, and timestamp-completed jobs", () => {
    expect(isOpenPartsJob({ status: "In Progress", completed_at: null })).toBe(true);
    expect(isOpenPartsJob({ status: "Completed", completed_at: null })).toBe(false);
    expect(isOpenPartsJob({ status: "Cancelled", completed_at: null })).toBe(false);
    expect(isOpenPartsJob({ status: "Collected", completed_at: null })).toBe(false);
    expect(isOpenPartsJob({ status: "In Progress", completed_at: "2026-08-13T10:00:00Z" })).toBe(false);
  });

  it("does not double-count a request already promoted into a job item", () => {
    const requests = [
      { request_id: 10, quantity: 2 },
      { request_id: 11, quantity: 1 },
    ];

    expect(filterUnpromotedPartRequests([{ source_request_id: 10 }], requests)).toEqual([
      { request_id: 11, quantity: 1 },
    ]);
  });
});
