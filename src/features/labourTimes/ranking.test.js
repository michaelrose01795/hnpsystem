import { describe, expect, it } from "vitest";
import { rankSuggestions } from "@/features/labourTimes/ranking";

describe("rankSuggestions", () => {
  it("ranks repair relevance before a candidate's source", () => {
    const [best] = rankSuggestions({
      queryText: "rear silencer corroded",
      suggestions: [
        {
          id: "learned-unrelated",
          source: "learned",
          scope: "user",
          displayDescription: "front brake pads",
          timeHours: 1,
        },
        {
          id: "preset-relevant",
          source: "preset",
          displayDescription: "replace rear silencer",
          timeHours: 0.8,
        },
      ],
      limit: 1,
    });

    expect(best.id).toBe("preset-relevant");
    expect(best.timeHours).toBe(0.8);
  });

  it("uses source priority to break equally relevant matches", () => {
    const [best] = rankSuggestions({
      queryText: "replace brake pads",
      suggestions: [
        {
          id: "preset",
          source: "preset",
          displayDescription: "replace brake pads",
          timeHours: 1,
        },
        {
          id: "learned-user",
          source: "learned",
          scope: "user",
          displayDescription: "replace brake pads",
          timeHours: 1.1,
        },
      ],
      limit: 1,
    });

    expect(best.id).toBe("learned-user");
  });
});
