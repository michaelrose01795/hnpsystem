import { describe, expect, it } from "vitest";
import { estimateLabourHours } from "@/features/labourTimes/fallbackEstimator";

describe("estimateLabourHours", () => {
  it.each([
    ["Rear pads low at 3mm", 1, "brake pads only"],
    ["Rear brake pads and discs require replacement", 1.5, "brake pads and discs"],
    ["Pads & rotors worn", 1.5, "brake pads and discs"],
    ["OSF tyre has a nail in the tread, puncture repair required", 0.5, "puncture repair"],
    ["NSR tyre measured at 1.5mm and is below the legal limit", 0.5, "single tyre replacement"],
    ["Offside rear tyre", 0.5, "single tyre work"],
    ["Balance offside front tyre and wheel", 0.3, "wheel balance"],
    ["Offside front wheel bearing noisy", 1.5, "wheel bearing"],
    ["Nearside front lower arm bush split", 1.5, "suspension arm"],
  ])("maps %s to a standard repair time", (description, expectedHours, expectedReason) => {
    const result = estimateLabourHours(description);

    expect(result.hours).toBe(expectedHours);
    expect(result.reason).toContain(expectedReason);
    expect(["high", "medium"]).toContain(result.confidence);
  });

  it("keeps an unknown concern as a low-confidence default", () => {
    expect(estimateLabourHours("Investigate unusual concern")).toEqual({
      hours: 0.5,
      reason: "fallback default",
      confidence: "low",
    });
  });
});
