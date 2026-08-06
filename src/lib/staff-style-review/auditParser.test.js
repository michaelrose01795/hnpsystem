import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseStaffStyleAudit } from "@/lib/staff-style-review/auditParser";

const markdown = fs.readFileSync(
  path.join(process.cwd(), "docs/Not following staffglobal.css setting.md"),
  "utf8"
);

describe("Phase 1 staff style audit parser", () => {
  const parsed = parseStaffStyleAudit(markdown);

  it("imports exactly the requested 128 groups and one specialised decision", () => {
    expect(parsed.total).toBe(129);
    expect(parsed.counts).toEqual({ badge: 54, button: 39, input: 26, popup: 9, specialised: 1 });
    expect(parsed.warnings).toEqual([]);
  });

  it("preserves IDs 1-128 and excludes card/surface IDs 129-158", () => {
    expect(parsed.records.filter((record) => record.originalAuditId != null).map((record) => record.originalAuditId)).toEqual(
      Array.from({ length: 128 }, (_, index) => index + 1)
    );
    expect(parsed.records.some((record) => record.originalAuditId === 129)).toBe(false);
  });

  it("preserves partial-adoption and VHC specialist decision notes", () => {
    const partial = parsed.records.find((record) => record.originalAuditId === 43);
    expect(partial.partialAdoption).toBe(true);
    expect(partial.partialAdoptionNotes).toContain("Partial adoption");

    const specialised = parsed.records.find((record) => record.auditId === "VHC-HUD-DECISION");
    expect(specialised.recommendation).toContain("HUD modifier");
    expect(specialised.specialistExceptionNotes).toContain("camera-safe sizing");
  });

  it("starts every imported record as Pending with source and line references", () => {
    expect(parsed.records.every((record) => record.reviewStatus === "Pending")).toBe(true);
    expect(parsed.records.every((record) => record.sourceFiles.length > 0)).toBe(true);
    expect(parsed.records.every((record) => record.lineReferences.length > 0)).toBe(true);
  });
});
