import { describe, expect, it } from "vitest";
import { formatFactValue, groupVehicleFacts } from "@/lib/technicalInfo/factGroups";

const fact = (source, key, label, value, retrievedAt = null) => ({ id: `${source}:${key}`, label, value, source, retrievedAt, url: null });

describe("vehicle fact grouping", () => {
  it("collapses a value repeated across sources into one field", () => {
    const { groups, sources } = groupVehicleFacts([
      fact("DMS vehicle record", "registration", "Registration", "AB12CDE"),
      fact("DMS vehicle record", "make", "Recorded make", "Ford"),
      fact("DVLA", "registrationNumber", "Registration", "AB12 CDE", "2026-10-01T10:00:00Z"),
      fact("DVLA", "make", "Make", "FORD", "2026-10-01T10:00:00Z"),
    ]);
    const vehicle = groups.find((group) => group.id === "vehicle");
    expect(vehicle.fields.map((field) => field.label)).toEqual(["Registration", "Make"]);
    expect(vehicle.fields[1]).toMatchObject({ sources: ["DMS vehicle record", "DVLA"], conflict: false });
    expect(sources.map((source) => source.name)).toEqual(["DMS vehicle record", "DVLA"]);
  });

  it("keeps disagreeing sources as separate flagged fields", () => {
    const { groups } = groupVehicleFacts([
      fact("DMS vehicle record", "make", "Recorded make", "Ford"),
      fact("DVLA", "make", "Make", "VAUXHALL"),
    ]);
    expect(groups[0].fields).toHaveLength(2);
    expect(groups[0].fields.every((field) => field.conflict)).toBe(true);
  });

  it("groups unknown keys under additional details and formats values", () => {
    const { groups } = groupVehicleFacts([fact("DVLA", "markedForExport", "Marked for export", false)]);
    expect(groups[0]).toMatchObject({ id: "additional", primary: false });
    expect(groups[0].fields[0].value).toBe("No");
    expect(formatFactValue("2026-03-01")).toBe("1 Mar 2026");
    expect(formatFactValue("2019-09")).toBe("Sept 2019".replace("Sept", new Date("2019-09-01T00:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })));
  });
});
