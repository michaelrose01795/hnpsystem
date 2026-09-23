// file location: src/lib/vhc/brakeDiagramValues.test.js
import { describe, expect, it } from "vitest";
import { buildBrakeDiagramValues } from "@/lib/vhc/brakeDiagramValues";

describe("buildBrakeDiagramValues", () => {
  it.each([
    ["Good", "good"],
    ["Monitor", "advisory"],
    ["Replace", "critical"],
  ])("uses the rear drum %s status for both rear diagram buttons", (status, severity) => {
    const values = buildBrakeDiagramValues(
      {
        rearDrums: { status, concerns: [] },
      },
      true,
    );

    expect(values.nsr).toEqual({ value: "drum", severity, isDrum: true });
    expect(values.osr).toEqual({ value: "drum", severity, isDrum: true });
  });

  it("uses the most urgent rear drum concern colour", () => {
    const values = buildBrakeDiagramValues(
      {
        rearDrums: {
          status: "Good",
          concerns: [{ status: "Amber" }, { status: "Red" }],
        },
      },
      true,
    );

    expect(values.nsr.severity).toBe("critical");
    expect(values.osr.severity).toBe("critical");
  });

  it("continues to use rear pad and disc data when rear discs are selected", () => {
    const values = buildBrakeDiagramValues(
      {
        rearPads: { measurement: "3", status: "Amber", concerns: [] },
        rearDiscs: {
          tab: "visual",
          measurements: { values: [], status: "Green" },
          visual: { status: "Red" },
          concerns: [],
        },
      },
      false,
    );

    expect(values.nsr).toEqual({ value: 3, severity: "critical" });
    expect(values.osr).toEqual({ value: 3, severity: "critical" });
  });
});
