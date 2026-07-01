// file location: src/lib/support/diagnosticAnalysis.test.js
import { describe, expect, it } from "vitest";
import { analyseDiagnostics, buildEnrichedDescription } from "@/lib/support/diagnosticAnalysis";

// A snapshot where a failed request triggers two follow-on errors, plus a
// repeated console error and some user actions before it.
const cascadingSnapshot = {
  route: { asPath: "/job-cards/00099", pathname: "/job-cards/[jobNumber]" },
  code_ownership: { section_key: "jobcard-tab-vhc", file: "src/components/VHCTab.js", line: 42 },
  recent_actions: [
    { type: "route_change", to: "/job-cards/00099", ts: 1000 },
    { type: "click", label: "Open VHC", sectionKey: "jobcard-tab-vhc", ts: 2000 },
  ],
  failed_requests: [
    { method: "POST", url: "/api/vhc/save?x=1", status: 500, ts: 3000 },
  ],
  unhandled_errors: [
    { message: "Cannot read 'id' of undefined", componentStack: "\n    in VHCTab", ts: 3200 },
    { message: "render aborted", ts: 3400 },
  ],
  console_errors: [
    { level: "error", msg: "save failed 500", ts: 3100 },
    { level: "error", msg: "save failed 500", ts: 3500 }, // duplicate
  ],
};

describe("analyseDiagnostics — incidents, trigger, cascade, duplicates", () => {
  const a = analyseDiagnostics(cascadingSnapshot);

  it("groups the close-together errors into a single incident", () => {
    expect(a.incidents).toHaveLength(1);
    expect(a.primaryIncidentId).toBe(a.incidents[0].id);
  });

  it("identifies the earliest event as the trigger (the failed request)", () => {
    expect(a.incidents[0].trigger.kind).toBe("request");
    expect(a.incidents[0].trigger.summary).toContain("/api/vhc/save");
  });

  it("flags cascading and counts duplicates", () => {
    expect(a.incidents[0].cascade).toBe(true);
    expect(a.duplicates[0]).toMatchObject({ count: 2 });
  });

  it("estimates a confidence score with supporting evidence", () => {
    expect(a.probableCause.confidence).toBeGreaterThan(0.5);
    expect(a.probableCause.confidence).toBeLessThanOrEqual(0.95);
    expect(a.probableCause.evidence.length).toBeGreaterThan(0);
  });

  it("identifies the affected page / section / code ownership", () => {
    expect(a.affected.page).toBe("/job-cards/00099");
    expect(a.affected.sectionKey).toBe("jobcard-tab-vhc");
    expect(a.affected.codeOwnership).toEqual({ file: "src/components/VHCTab.js", line: 42 });
    expect(a.affected.component).toBe("VHCTab"); // from the component stack
  });

  it("builds a chronological timeline with exactly one trigger flag", () => {
    expect(a.timeline.length).toBeGreaterThan(0);
    const triggers = a.timeline.filter((t) => t.isTrigger);
    expect(triggers).toHaveLength(1);
    // Actions captured before the error come first.
    expect(a.timeline[0].text).toContain("Opened /job-cards/00099");
  });
});

describe("analyseDiagnostics — separate incidents + empty input", () => {
  it("splits events separated by a large time gap into separate incidents", () => {
    const a = analyseDiagnostics({
      unhandled_errors: [
        { message: "first", ts: 1000 },
        { message: "second", ts: 60000 }, // > INCIDENT_GAP_MS later
      ],
    });
    expect(a.incidents).toHaveLength(2);
  });

  it("returns low confidence and no cause when nothing was captured", () => {
    const a = analyseDiagnostics({});
    expect(a.primaryIncidentId).toBeNull();
    expect(a.probableCause.confidence).toBeLessThan(0.2);
    expect(a.timeline).toEqual([]);
  });
});

describe("buildEnrichedDescription", () => {
  it("includes probable cause, confidence, affected location, and a marked trigger", () => {
    const text = buildEnrichedDescription(cascadingSnapshot);
    expect(text).toMatch(/Probable cause \(\d+% confidence\)/);
    expect(text).toContain("page /job-cards/00099");
    expect(text).toContain("src/components/VHCTab.js:42");
    expect(text).toContain("← likely trigger");
    expect(text).toContain("What went wrong / what I expected:");
  });

  it("degrades gracefully with an empty snapshot", () => {
    const text = buildEnrichedDescription({});
    expect(text).toContain("Timeline: no recent activity was captured.");
  });
});
