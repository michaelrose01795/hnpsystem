// file location: src/lib/support/triageValidation.test.js
import { describe, expect, it } from "vitest";
import { buildTriagePatch, sanitiseSearch, normaliseListFilters } from "@/lib/support/triageValidation";

describe("buildTriagePatch", () => {
  it("only includes fields the caller set", () => {
    expect(buildTriagePatch({ status: "triaged" })).toEqual({ status: "triaged" });
    expect(buildTriagePatch({})).toEqual({});
  });
  it("validates status + severity enums", () => {
    expect(() => buildTriagePatch({ status: "bogus" })).toThrow(/Invalid status/);
    expect(() => buildTriagePatch({ severity: "spicy" })).toThrow(/Invalid severity/);
  });
  it("coerces assignee + duplicate to null when blank", () => {
    expect(buildTriagePatch({ assignedTo: "x" })).toEqual({ assigned_to: null });
    expect(buildTriagePatch({ assignedTo: 42 })).toEqual({ assigned_to: 42 });
    expect(buildTriagePatch({ duplicateOf: "" })).toEqual({ duplicate_of: null });
    expect(buildTriagePatch({ duplicateOf: "abc" })).toEqual({ duplicate_of: "abc" });
  });
});

describe("sanitiseSearch", () => {
  it("strips PostgREST-structural characters and clamps", () => {
    expect(sanitiseSearch("a,b(c)*d")).toBe("a b c  d".replace(/\s+$/, ""));
    expect(sanitiseSearch("  hello  ")).toBe("hello");
    expect(sanitiseSearch("x".repeat(200)).length).toBe(120);
  });
});

describe("normaliseListFilters", () => {
  it("clamps limit/offset and defaults sort", () => {
    const f = normaliseListFilters({ limit: "9999", offset: "-5" });
    expect(f.limit).toBe(200);
    expect(f.offset).toBe(0);
    expect(f.sortBy).toBe("created_at");
    expect(f.sortDir).toBe("desc");
  });
  it("drops unknown enum values but keeps valid ones", () => {
    const f = normaliseListFilters({ status: "new", severity: "nope", category: "bug" });
    expect(f.status).toBe("new");
    expect(f.severity).toBeUndefined();
    expect(f.category).toBe("bug");
  });
  it("honours unassigned over assignedTo", () => {
    expect(normaliseListFilters({ unassigned: "1", assignedTo: "7" })).toMatchObject({ unassigned: true });
    expect(normaliseListFilters({ unassigned: "1", assignedTo: "7" }).assignedTo).toBeUndefined();
    expect(normaliseListFilters({ assignedTo: "7" }).assignedTo).toBe(7);
  });
  it("sanitises the search term", () => {
    expect(normaliseListFilters({ q: "a,b" }).q).toBe("a b");
    expect(normaliseListFilters({ q: "   " }).q).toBeUndefined();
  });
  it("accepts asc sort direction and updated_at sort", () => {
    const f = normaliseListFilters({ sortBy: "updated_at", sortDir: "asc" });
    expect(f).toMatchObject({ sortBy: "updated_at", sortDir: "asc" });
  });
});
