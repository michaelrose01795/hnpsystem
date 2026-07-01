// file location: src/lib/dev-platform/searchEngine.test.js
import { describe, expect, it } from "vitest";
import { applyQuery, matchesText, tokenize } from "@/lib/dev-platform/searchEngine";

const items = [
  { id: 1, title: "Login button broken", status: "new", severity: "high", owner: { name: "Ada" } },
  { id: 2, title: "Dropdown misaligned", status: "resolved", severity: "low", owner: { name: "Grace" } },
  { id: 3, title: "Login redirect loop", status: "new", severity: "critical", owner: { name: "Ada" } },
];

describe("tokenize", () => {
  it("lowercases and splits on whitespace, dropping empties", () => {
    expect(tokenize("  Login   Loop ")).toEqual(["login", "loop"]);
    expect(tokenize("")).toEqual([]);
  });
});

describe("matchesText", () => {
  it("returns true for an empty query", () => {
    expect(matchesText(items[0], "", ["title"])).toBe(true);
  });

  it("requires every token to match (AND semantics)", () => {
    expect(matchesText(items[0], "login broken", ["title"])).toBe(true);
    expect(matchesText(items[0], "login dropdown", ["title"])).toBe(false);
  });

  it("searches dotted paths and function accessors", () => {
    expect(matchesText(items[0], "ada", ["owner.name"])).toBe(true);
    expect(matchesText(items[0], "ada", [(i) => i.owner.name])).toBe(true);
  });
});

describe("applyQuery", () => {
  const spec = {
    searchFields: ["title", "owner.name"],
    sorters: {
      severityDesc: (a, b) => ({ low: 1, high: 2, critical: 3 }[b.severity] - { low: 1, high: 2, critical: 3 }[a.severity]),
      idAsc: (a, b) => a.id - b.id,
    },
    defaultSort: "idAsc",
  };

  it("filters by free text across fields", () => {
    const out = applyQuery(items, { ...spec, q: "login" });
    expect(out.map((i) => i.id)).toEqual([1, 3]);
  });

  it("applies equality + array filters", () => {
    expect(applyQuery(items, { ...spec, filters: { status: "new" } }).map((i) => i.id)).toEqual([1, 3]);
    expect(applyQuery(items, { ...spec, filters: { severity: ["low", "critical"] } }).map((i) => i.id)).toEqual([2, 3]);
  });

  it("ignores empty / null filter values", () => {
    expect(applyQuery(items, { ...spec, filters: { status: "", severity: null } })).toHaveLength(3);
  });

  it("supports custom matchers", () => {
    const out = applyQuery(items, {
      ...spec,
      filters: { openOnly: true },
      matchers: { openOnly: (item) => item.status === "new" },
    });
    expect(out.map((i) => i.id)).toEqual([1, 3]);
  });

  it("sorts by the requested sorter, falling back to defaultSort", () => {
    expect(applyQuery(items, { ...spec, sort: "severityDesc" }).map((i) => i.id)).toEqual([3, 1, 2]);
    expect(applyQuery(items, { ...spec, sort: "unknown" }).map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it("does not mutate the input array", () => {
    const copy = items.slice();
    applyQuery(items, { ...spec, sort: "severityDesc" });
    expect(items).toEqual(copy);
  });
});
