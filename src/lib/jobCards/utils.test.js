import { describe, expect, it } from "vitest";

import { compareJobsForBoard } from "@/lib/jobCards/utils";

const sortJobs = (jobs) => [...jobs].sort(compareJobsForBoard);

describe("compareJobsForBoard", () => {
  it("keeps an explicitly positioned first card ahead of unpositioned cards", () => {
    const jobs = [
      { jobNumber: "UNPOSITIONED", position: null, checkedInAt: "2026-07-28T12:00:00Z" },
      { jobNumber: "DROPPED-FIRST", position: 1, checkedInAt: "2026-07-28T08:00:00Z" },
    ];

    expect(sortJobs(jobs).map((job) => job.jobNumber)).toEqual([
      "DROPPED-FIRST",
      "UNPOSITIONED",
    ]);
  });

  it("treats null, undefined, and empty positions as missing rather than position zero", () => {
    const jobs = [
      { jobNumber: "NULL", position: null, checkedInAt: "2026-07-28T12:00:00Z" },
      { jobNumber: "UNDEFINED", checkedInAt: "2026-07-28T11:00:00Z" },
      { jobNumber: "EMPTY", position: "", checkedInAt: "2026-07-28T10:00:00Z" },
      { jobNumber: "POSITIONED", position: "1", checkedInAt: "2026-07-28T08:00:00Z" },
    ];

    expect(sortJobs(jobs).map((job) => job.jobNumber)).toEqual([
      "POSITIONED",
      "NULL",
      "UNDEFINED",
      "EMPTY",
    ]);
  });

  it("preserves the exact numeric queue order written by drag and drop", () => {
    const jobs = [
      { jobNumber: "THIRD", position: 3 },
      { jobNumber: "FIRST", position: 1 },
      { jobNumber: "SECOND", position: 2 },
    ];

    expect(sortJobs(jobs).map((job) => job.jobNumber)).toEqual([
      "FIRST",
      "SECOND",
      "THIRD",
    ]);
  });
});
