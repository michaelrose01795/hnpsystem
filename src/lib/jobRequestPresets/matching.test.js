import { describe, expect, it } from "vitest";
import { JOB_REQUEST_PRESET_CATALOG } from "@/lib/jobRequestPresets/catalog";
import { rankJobRequestPresets } from "@/lib/jobRequestPresets/matching";

const labelsFor = (query, limit = 5) => rankJobRequestPresets({
  query,
  presets: JOB_REQUEST_PRESET_CATALOG,
  limit,
}).map((preset) => preset.label);

describe("job request preset matching", () => {
  it.each(["service 5", "5 service", "5th", "5th service"])(
    "ranks the fifth scheduled service first for %s",
    (query) => {
      expect(labelsFor(query)[0]).toContain("5th scheduled service");
    }
  );

  it.each([
    ["front tyres", "front tyres"],
    ["radio", "radio fault"],
    ["brakes", "braking system"],
    ["MOT", "MOT test"],
    ["warning light", "warning light"],
  ])("returns a contextually relevant first result for %s", (query, expected) => {
    expect(labelsFor(query)[0].toLowerCase()).toContain(expected.toLowerCase());
  });

  it("matches incomplete advisor shorthand", () => {
    expect(labelsFor("servi")[0]).toContain("scheduled service");
  });

  it("does not return loosely related zero-score results", () => {
    expect(labelsFor("windscreen unicorn")).toEqual([]);
  });

  it("removes duplicate descriptions", () => {
    const duplicate = JOB_REQUEST_PRESET_CATALOG[0];
    const results = rankJobRequestPresets({
      query: "mot",
      presets: [duplicate, { ...duplicate, id: 99, label: `${duplicate.label}!` }],
      limit: 8,
    });
    expect(results).toHaveLength(1);
  });
});
