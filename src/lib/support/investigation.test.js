// file location: src/lib/support/investigation.test.js
import { afterEach, describe, expect, it } from "vitest";
import { buildInvestigation } from "@/lib/support/investigation";
import { buildFingerprint } from "@/lib/support/incidentClustering";
import {
  registerInvestigationProvider,
  clearInvestigationProviders,
} from "@/lib/support/investigationRegistry";

afterEach(() => clearInvestigationProviders());

const cascading = {
  route: { asPath: "/job-cards/00099", pathname: "/job-cards/[jobNumber]" },
  code_ownership: { section_key: "jobcard-tab-vhc", file: "src/components/VHCTab.js", line: 42 },
  recent_actions: [
    { type: "route_change", to: "/job-cards/00099", ts: 1000 },
    { type: "click", label: "Open VHC", sectionKey: "jobcard-tab-vhc", ts: 2000 },
  ],
  failed_requests: [{ method: "POST", url: "/api/vhc/save?x=1", status: 500, ts: 3000 }],
  unhandled_errors: [
    { message: "Cannot read 'id' of undefined", componentStack: "\n    in VHCTab", ts: 3200 },
    { message: "render aborted", ts: 3400 },
  ],
  console_errors: [
    { level: "error", msg: "save failed 500", ts: 3100 },
    { level: "error", msg: "save failed 500", ts: 3500 },
  ],
  attachments: [{ order: 0, hash: "hAAA" }],
};

describe("buildInvestigation — core", () => {
  const inv = buildInvestigation(cascading, { now: "2026-07-01T00:00:00Z" });

  it("explains what happened and identifies the affected module", () => {
    expect(inv.explanation).toContain("/job-cards/00099");
    expect(inv.affectedModules).toEqual(["Job Cards"]);
  });

  it("ranks root causes by confidence (highest first)", () => {
    expect(inv.rootCauses.length).toBeGreaterThan(1);
    for (let i = 1; i < inv.rootCauses.length; i += 1) {
      expect(inv.rootCauses[i - 1].confidence).toBeGreaterThanOrEqual(inv.rootCauses[i].confidence);
    }
  });

  it("suspects api ownership and guesses the DB table + API route + files", () => {
    expect(inv.ownership.primary).toBe("api");
    expect(inv.ownership.api).toContain("/api/vhc/save");
    expect(inv.ownership.database).toContain("vhc");
    expect(inv.inspectFirst.files).toContain("src/components/VHCTab.js");
    expect(inv.inspectFirst.components).toContain("VHCTab");
  });

  it("scores severity, priority, impact, regression risk, complexity, repro", () => {
    expect(inv.severity).toBe("critical"); // render error + cascade
    expect(inv.priority).toMatch(/^P[1-4]$/);
    expect(inv.userImpact).toBe("high");
    expect(inv.regressionRisk).toBe("high");
    expect(["trivial", "small", "medium", "large"]).toContain(inv.fixComplexity);
    expect(inv.reproducibleConfidence).toBeGreaterThan(0.5);
  });

  it("produces a debugging order, manual tests, regression tests, and a GitHub summary", () => {
    expect(inv.debuggingOrder.length).toBeGreaterThan(0);
    expect(inv.manualTests.length).toBeGreaterThan(0);
    expect(inv.regressionTests.some((t) => t.includes("VHCTab"))).toBe(true);
    expect(inv.summary).toContain("## Job Cards incident");
    expect(inv.summary).toContain("Probable root causes");
  });

  it("is flagged developer-only and carries the fingerprint", () => {
    expect(inv.developerOnly).toBe(true);
    expect(inv.fingerprint.component).toBe("VHCTab");
    expect(inv.generatedAt).toBe("2026-07-01T00:00:00Z");
  });
});

describe("buildInvestigation — similar incidents + repeated failures", () => {
  it("detects a similar prior incident and repeated component failures", () => {
    const priorFp = buildFingerprint({ ...cascading, route: { asPath: "/job-cards/00001" } });
    const inv = buildInvestigation(cascading, {
      priorReports: [{ id: "r-past", route: "/job-cards/00001", fingerprint: priorFp }],
    });
    expect(inv.similarIncidents[0].reportId).toBe("r-past");
    expect(inv.similarIncidents[0].reasons).toContain("same error signature");
    expect(inv.repeatedFailures.componentCount).toBe(1);
    expect(inv.summary).toContain("Similar prior incidents: 1");
  });
});

describe("buildInvestigation — extension providers", () => {
  it("merges investigation provider fragments and never breaks on a bad one", () => {
    registerInvestigationProvider({ id: "jobcard", investigate: () => ({ suggestedTables: ["job_cards"] }) });
    registerInvestigationProvider({ id: "boom", investigate: () => { throw new Error("x"); } });
    const inv = buildInvestigation(cascading);
    expect(inv.providers.jobcard).toEqual({ suggestedTables: ["job_cards"] });
    expect(inv.providers.boom).toBeUndefined();
  });
});

describe("buildInvestigation — empty snapshot", () => {
  it("degrades to a low-severity report with no crash", () => {
    const inv = buildInvestigation({});
    expect(inv.severity).toBe("low");
    expect(inv.reproducibleConfidence).toBeLessThan(0.2);
    expect(inv.rootCauses).toEqual([]);
    expect(inv.summary).toContain("incident");
  });
});
