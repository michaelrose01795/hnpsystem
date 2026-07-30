import { describe, expect, it } from "vitest";
import {
  aggregateConsolidatedBrakeValues,
  consolidateBrakePartsDisplayRows,
} from "@/lib/vhc/partsDisplayRows";

const brakeItem = ({
  id,
  label,
  measurement = "",
  rows = [],
  notes = "",
  part = null,
  persisted = false,
}) => ({
  vhcId: String(id),
  canonicalVhcId: String(id),
  linkedParts: part ? [part] : [],
  vhcItem: {
    label,
    measurement,
    rows,
    notes,
    concernText: notes,
    category: { id: "brakes_hubs", label: "Brakes & Hubs" },
    categoryLabel: "Brakes & Hubs",
    vhcCheck: persisted ? { vhc_id: Number(id) } : null,
  },
});

describe("consolidateBrakePartsDisplayRows", () => {
  it("adds the values from separate pad and disc VHC rows", () => {
    const values = aggregateConsolidatedBrakeValues([
        {
          id: "rear-pads",
          canonicalId: "1810",
          parts_gbp: 39.99,
          labour_hours: 1.5,
          partsComplete: true,
          labourComplete: true,
        },
        {
          id: "rear-discs",
          canonicalId: "1812",
          parts_gbp: 69.99,
          labour_hours: 0,
          partsComplete: true,
        },
      ]);

    expect(values).toMatchObject({
      sourceVhcIds: ["rear-pads", "1810", "rear-discs", "1812"],
      labourHours: 1.5,
      partsComplete: true,
      labourComplete: true,
    });
    expect(values.partsTotal).toBeCloseTo(109.98, 2);
  });

  it("combines rear pad, disc and recommendation rows with all linked parts", () => {
    const rows = consolidateBrakePartsDisplayRows([
      brakeItem({
        id: "rear-discs",
        label: "Rear Discs",
        measurement: "Visual",
        rows: ["Visual"],
        part: { id: "disc-part", unit_price: 69.99 },
      }),
      brakeItem({
        id: "rear-pads",
        label: "Rear Pads",
        measurement: "2mm",
      }),
      brakeItem({
        id: 42,
        label: "recommend replacement of rear pads and discs due to excessive wear.",
        notes: "recommend replacement of rear pads and discs due to excessive wear.",
        part: { id: "pad-part", unit_price: 39.99 },
        persisted: true,
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      vhcId: "42",
      sourceVhcIds: ["rear-discs", "rear-pads", "42"],
      vhcItem: {
        label: "Rear Brakes",
        rows: ["Discs: Visual check", "Pads: 2mm"],
        notes: "recommend replacement of rear pads and discs due to excessive wear.",
        isConsolidatedBrakeRow: true,
      },
    });
    expect(rows[0].linkedParts.map((part) => part.id)).toEqual(["disc-part", "pad-part"]);
  });

  it("does not combine a separate rear caliper concern", () => {
    const rows = consolidateBrakePartsDisplayRows([
      brakeItem({ id: "rear-discs", label: "Rear Discs", measurement: "Visual" }),
      brakeItem({ id: "rear-pads", label: "Rear Pads", measurement: "2mm" }),
      brakeItem({
        id: 43,
        label: "Rear caliper leaking",
        notes: "Rear caliper leaking",
        persisted: true,
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].vhcItem.label).toBe("Rear Brakes");
    expect(rows[1].vhcItem.label).toBe("Rear caliper leaking");
  });
});
