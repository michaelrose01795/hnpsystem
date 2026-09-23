import { describe, expect, it } from "vitest";
import { detectAnomalies } from "@/lib/status/anomalyDetector";
import { enhanceTimeline } from "@/lib/status/timelineEnhancer";

describe("job lifecycle timeline cleanup", () => {
  it("shows one Booked event when legacy no-op writes occurred minutes apart", () => {
    const entries = [
      {
        id: "created-1",
        kind: "event",
        eventType: "job_created",
        status: "job_created",
        label: "Job Created",
        timestamp: "2026-08-19T15:56:00.000Z",
        userName: null,
      },
      ...["15:57", "15:58", "16:01"].map((time, index) => ({
        id: `booked-${index}`,
        kind: "status",
        status: "booked",
        label: "Booked",
        department: "Service Reception",
        timestamp: `2026-08-19T${time}:00.000Z`,
        userName: "System",
      })),
    ];

    const enhanced = enhanceTimeline(entries, {
      importance_scoring_enabled: true,
      grouping_enabled: false,
      phase_grouping_enabled: false,
    });

    expect(enhanced.filter((entry) => entry.status === "booked")).toHaveLength(1);
    expect(
      detectAnomalies(
        { job: { overallStatus: "booked" }, workflows: {} },
        enhanced
      ).filter((anomaly) => anomaly.code === "MISSING_ACTOR")
    ).toEqual([]);
  });
});
