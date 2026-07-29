import { describe, expect, it } from "vitest";
import { buildInspectionConcerns } from "@/components/VHC/mediaCapture/buildInspectionConcerns";

describe("buildInspectionConcerns", () => {
  it("keeps measurement rows and includes every reported amber/red issue across VHC sections", () => {
    const result = buildInspectionConcerns({
      wheelsTyres: {
        NSF: {
          tread: { outer: "3.1", middle: "3.2", inner: "3.0" },
          concerns: [
            { text: "Sidewall cracked near the rim", status: "Amber" },
            { text: "Valve cap missing", status: "Red" },
          ],
        },
      },
      brakesHubs: {
        frontPads: {
          measurement: "3",
          concerns: [{ issue: "Front pads wearing unevenly", status: "Red" }],
        },
      },
      serviceIndicator: {
        concerns: [{ text: "Oil level below minimum", status: "Amber" }],
      },
      externalInspection: {
        Lighting: {
          concerns: [{ issue: "Nearside headlamp misting", status: "Amber" }],
        },
      },
      internalElectrics: {
        "Warning Lights": {
          concerns: [{ issue: "Airbag warning lamp illuminated", status: "Red" }],
        },
      },
      underside: {
        Exhaust: {
          concerns: [{ issue: "Rear exhaust hanger split", status: "Amber" }],
        },
      },
    });

    expect(result.tyres).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "tyre-NSF", measurement: "3 mm" }),
        expect.objectContaining({
          id: "reported-wheels-NSF-0",
          label: "NSF tyre: Sidewall cracked near the rim",
          status: "amber",
        }),
        expect.objectContaining({
          id: "reported-wheels-NSF-1",
          label: "NSF tyre: Valve cap missing",
          status: "red",
        }),
      ]),
    );
    expect(result.brakes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "brake-frontPads", measurement: "3 mm" }),
        expect.objectContaining({
          id: "reported-brakes-frontPads-0",
          label: "Front brake pads: Front pads wearing unevenly",
          status: "red",
        }),
      ]),
    );
    expect(result.external).toEqual([
      expect.objectContaining({ label: "Nearside headlamp misting", status: "amber" }),
    ]);
    expect(result.additionalSections).toEqual([
      expect.objectContaining({
        key: "service",
        label: "Service & Under Bonnet",
        rows: [expect.objectContaining({ label: "Oil level below minimum" })],
      }),
      expect.objectContaining({
        key: "internal",
        label: "Internal & Electrics",
        rows: [expect.objectContaining({ label: "Warning Lights: Airbag warning lamp illuminated" })],
      }),
      expect.objectContaining({
        key: "underside",
        label: "Underside",
        rows: [expect.objectContaining({ label: "Exhaust: Rear exhaust hanger split" })],
      }),
    ]);
  });

  it("does not add green issues to the customer discussion list", () => {
    const result = buildInspectionConcerns({
      wheelsTyres: {
        NSF: {
          concerns: [{ text: "Checked and OK", status: "Green" }],
        },
      },
      serviceIndicator: {
        concerns: [{ text: "Oil level OK", status: "Green" }],
      },
    });

    expect(result.tyres).toEqual([
      expect.objectContaining({ id: "tyre-NSF", status: "green" }),
    ]);
    expect(result.tyres.some((row) => row.id.startsWith("reported-"))).toBe(false);
    expect(result.additionalSections).toEqual([]);
  });
});
