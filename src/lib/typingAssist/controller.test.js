// file location: src/lib/typingAssist/controller.test.js
// Pure parts of the controller and mirror: moving issues through edits and
// splitting text into mirror segments.

import { describe, expect, it } from "vitest";
import { shiftIssues } from "./controller";
import { buildMirrorSegments } from "./fieldMirror";

const issue = (start, end, extra = {}) => ({ kind: "spelling", start, end, word: "x", ...extra });

describe("shiftIssues", () => {
  it("keeps issues before an edit and moves issues after it", () => {
    const before = "teh cat recieve";
    const after = "teh big cat recieve";
    expect(shiftIssues([issue(0, 3), issue(8, 15)], before, after)).toEqual([issue(0, 3), issue(12, 19)]);
  });

  it("drops an issue the edit touches", () => {
    expect(shiftIssues([issue(0, 5)], "recie", "recieve")).toEqual([]);
  });

  it("keeps a word's issue when a space is typed after it", () => {
    expect(shiftIssues([issue(0, 7)], "recieve", "recieve ")).toEqual([issue(0, 7)]);
  });
});

describe("buildMirrorSegments", () => {
  it("wraps issues in marks and keeps the rest as text", () => {
    const marked = issue(4, 7);
    expect(buildMirrorSegments("the teh end", [marked], null)).toEqual([
      { type: "text", text: "the " },
      { type: "mark", text: "teh", issue: marked },
      { type: "text", text: " end" },
    ]);
  });

  it("places the ghost word at the caret", () => {
    expect(buildMirrorSegments("kind rega", [], { at: 9, text: "rds" })).toEqual([
      { type: "text", text: "kind rega" },
      { type: "ghost", text: "rds" },
    ]);
  });

  it("gives a trailing newline a line of height", () => {
    expect(buildMirrorSegments("notes\n", [], null).at(-1)).toEqual({ type: "text", text: "​" });
  });
});
