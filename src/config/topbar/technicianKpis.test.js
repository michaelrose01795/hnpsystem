import { describe, expect, it } from "vitest";
import { buildTechnicianKpis } from "@/config/topbar/technicianKpis";

describe("buildTechnicianKpis", () => {
  it("formats the technician queue, daily allocation and monthly efficiency", () => {
    expect(
      buildTechnicianKpis({
        jobsLinedUp: 3,
        allocatedToday: 6.25,
        efficiencyPct: 87.64,
        queuedJobNumbers: ["12345", "12346", "12347"],
      })
    ).toEqual([
      {
        key: "technicianJobsLinedUp",
        label: "jobs lined up",
        hint: "assigned in Next Jobs after the current job",
        value: 3,
        detail: ["12345", "12346", "12347"],
      },
      {
        key: "technicianAllocatedToday",
        label: "allocated today",
        hint: "planned labour hours for today",
        value: "6.3h",
      },
      {
        key: "technicianEfficiency",
        label: "efficiency",
        hint: "allocated versus logged hours this month",
        value: "87.6%",
      },
    ]);
  });

  it("uses zero values while the live snapshot is loading", () => {
    expect(buildTechnicianKpis().map((kpi) => kpi.value)).toEqual([0, "0h", "0%"]);
  });
});
