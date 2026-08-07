import { describe, expect, it } from "vitest";
import { buildCodexPrompt } from "@/lib/staff-style-review/codexPrompt";

const finding = Object.freeze({
  auditId: "1",
  category: "badge",
  type: "Badge",
  route: "Any staff route",
  sectionName: "Topbar alert summary pill",
  visibilityInstructions: "Trigger one or more application alerts.",
  issueSummary: "A plain div recreates the padding, radius, background, colour and typography.",
  sourceReference: "`src/components/TopbarAlerts.js:111`",
});

describe("buildCodexPrompt", () => {
  it("builds one complete instruction from the finding, not just the source reference", () => {
    const prompt = buildCodexPrompt(finding, "");
    expect(prompt).toContain("`src/components/TopbarAlerts.js:111`");
    expect(prompt).toContain("every rendered use of the affected component");
    expect(prompt).toContain("Topbar alert summary pill");
    expect(prompt).toContain("Any staff route");
    expect(prompt).toContain("how to see it: Trigger one or more application alerts.");
    expect(prompt).toContain("audit rationale:");
    expect(prompt).toContain("removing conflicting inline visual overrides");
    expect(prompt).toContain("preserving layout, behaviour, data logic, permissions, responsive behaviour");
    expect(prompt).toContain("changing no unrelated UI");
    expect(prompt.split(". ").length).toBeLessThan(3); // stays a single sentence
  });

  it("names the shared family that matches the finding's category", () => {
    expect(buildCodexPrompt(finding)).toContain("the existing badge family (`.app-badge`");
    expect(buildCodexPrompt({ ...finding, category: "button" })).toContain("the existing button family");
    expect(buildCodexPrompt({ ...finding, category: "input" })).toContain("the existing input family");
    expect(buildCodexPrompt({ ...finding, category: "popup" })).toContain("the existing popup/modal family");
  });

  it("tells Codex to inspect first when the finding may be a deliberate exception", () => {
    expect(buildCodexPrompt(finding)).not.toContain("possible deliberate specialist exception");
    expect(buildCodexPrompt({ ...finding, category: "specialised" })).toContain(
      "possible deliberate specialist exception"
    );
    expect(
      buildCodexPrompt({ ...finding, specialistExceptionNotes: "Intentional VHC HUD treatment." })
    ).toContain("rather than forcing a conversion");
  });

  it("folds the reviewer's own notes in when they exist", () => {
    expect(buildCodexPrompt(finding, "Checked — the pill is shared with the mobile topbar.")).toContain(
      'taking the reviewer note "Checked — the pill is shared with the mobile topbar." into account'
    );
  });

  it("returns nothing without a finding", () => {
    expect(buildCodexPrompt(null)).toBe("");
  });
});
