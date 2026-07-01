// file location: src/lib/dev-platform/assistedInvestigation.test.js
import { describe, expect, it } from "vitest";
import {
  buildAssistedInvestigation,
  assistedInvestigationMarkdown,
} from "@/lib/dev-platform/assistedInvestigation";

// A realistic investigation object, mirroring the shape produced by
// buildInvestigation() in src/lib/support/investigation.js.
const investigation = {
  severity: "high",
  priority: "P1",
  explanation: "The VHC save handler threw when persisting an empty tyre section.",
  reproducibleConfidence: 0.8,
  regressionRisk: "high",
  fixComplexity: "large",
  rootCauses: [
    { cause: "Unhandled error thrown from /api/vhc/save", confidence: 0.9 },
    { cause: "Missing null guard on tyre depth", confidence: 0.4 },
  ],
  ownership: {
    primary: "api",
    api: ["/api/vhc/save", "/api/vhc/save"], // duplicate to prove de-dupe
    database: ["vhc"],
  },
  affected: {
    module: "vhc",
    component: "VhcPanel",
    codeOwnership: { file: "src/features/vhc/save.js", line: 42 },
  },
  affectedModules: ["vhc", "vhc", "job-cards"], // duplicate to prove de-dupe
  inspectFirst: {
    files: ["src/features/vhc/save.js", "src/features/vhc/tyres.js"],
    components: ["VhcPanel", "TyrePanel"],
  },
  debuggingOrder: [
    "Reproduce the save with an empty tyre section",
    "Reproduce the save with an empty tyre section", // dup
  ],
  versionHistory: {
    isRegression: true,
    firstSeenVersion: "1.2.0",
    lastSeenVersion: "1.4.0",
  },
  codeState: {
    drift: { drifted: true, note: "save.js moved 12 lines since capture" },
    sourceMap: { status: "drift" },
  },
  repeatedFailures: { routeCount: 2, componentCount: 1 },
  manualTests: ["Save a VHC with no tyre data", "Save a VHC with full tyre data"],
  regressionTests: ["Assert /api/vhc/save returns a structured error, not a throw"],
};

describe("buildAssistedInvestigation — realistic investigation", () => {
  const assisted = buildAssistedInvestigation(investigation, {
    report: { title: "VHC save crashes on empty tyres" },
  });

  it("marks itself generated and builds a headline from the report title + severity", () => {
    expect(assisted.generated).toBe(true);
    expect(assisted.headline).toContain("VHC save crashes on empty tyres");
    expect(assisted.headline).toContain("HIGH");
    expect(assisted.headline).toContain("P1");
  });

  it("summarises the explanation, top signal and owning layer", () => {
    expect(assisted.summary).toContain(
      "The VHC save handler threw when persisting an empty tyre section."
    );
    // Top root cause confidence rendered as a percentage (0.9 -> 90%).
    expect(assisted.summary).toContain("90%");
    expect(assisted.summary).toContain("Unhandled error thrown from /api/vhc/save");
    expect(assisted.summary).toContain("api layer");
  });

  it("derives an api-layer probable fix referencing the endpoint + table", () => {
    expect(assisted.probableFix).toContain("/api/vhc/save");
    expect(assisted.probableFix).toContain("vhc");
    expect(assisted.probableFix).toMatch(/structured error/i);
    expect(assisted.probableFix).toContain("Root signal:");
  });

  it("types and de-dupes affected systems", () => {
    const sys = assisted.affectedSystems;
    // Every entry has a type + value.
    sys.forEach((s) => {
      expect(typeof s.type).toBe("string");
      expect(typeof s.value).toBe("string");
    });
    // De-duped by type+value: no duplicate keys.
    const keys = sys.map((s) => `${s.type}:${s.value}`);
    expect(new Set(keys).size).toBe(keys.length);

    // Expected typed groups are present.
    const types = new Set(sys.map((s) => s.type));
    expect(types).toContain("module");
    expect(types).toContain("file");
    expect(types).toContain("component");
    expect(types).toContain("api");
    expect(types).toContain("table");

    // The code-ownership file carries a file:line value + a ref.
    const owned = sys.find((s) => s.type === "file" && s.value.includes(":"));
    expect(owned.value).toBe("src/features/vhc/save.js:42");
    expect(owned.ref).toEqual({ file: "src/features/vhc/save.js", line: 42 });

    // The api appears exactly once despite the duplicate input.
    expect(sys.filter((s) => s.type === "api" && s.value === "/api/vhc/save")).toHaveLength(1);
    // The module appears once despite duplicate input.
    expect(sys.filter((s) => s.type === "module" && s.value === "vhc")).toHaveLength(1);
    expect(types).toContain("table");
  });

  it("produces de-duped, forward-looking implementation suggestions", () => {
    const s = assisted.implementationSuggestions;
    expect(new Set(s).size).toBe(s.length); // de-duped
    // The debugging step is carried through exactly once.
    expect(s.filter((x) => x === "Reproduce the save with an empty tyre section")).toHaveLength(1);
    // api-layer advice.
    expect(s.some((x) => /error handling/i.test(x) && x.includes("/api/vhc/save"))).toBe(true);
    // large-fix advice.
    expect(s.some((x) => /split the fix/i.test(x))).toBe(true);
    // source-map drift advice.
    expect(s.some((x) => /Regenerate the dev-layout section map/i.test(x))).toBe(true);
  });

  it("raises regression + drift + repeated-failure warnings, de-duped", () => {
    const w = assisted.regressionWarnings;
    expect(new Set(w).size).toBe(w.length);
    expect(w.some((x) => /regression/i.test(x) && x.includes("1.2.0") && x.includes("1.4.0"))).toBe(true);
    expect(w.some((x) => /drift/i.test(x) && x.includes("save.js moved"))).toBe(true);
    expect(w.some((x) => /High regression risk/i.test(x))).toBe(true);
    expect(w.some((x) => /Repeated failures/i.test(x))).toBe(true);
  });

  it("builds a typed, de-duped verification checklist from manual + regression + drift", () => {
    const c = assisted.verificationChecklist;
    const kinds = c.map((i) => i.kind);
    expect(kinds).toContain("manual");
    expect(kinds).toContain("regression");
    // Manual tests.
    expect(c.some((i) => i.text === "Save a VHC with no tyre data" && i.kind === "manual")).toBe(true);
    // Regression test.
    expect(
      c.some((i) => i.kind === "regression" && /structured error/.test(i.text))
    ).toBe(true);
    // Drift adds a checklist item.
    expect(c.some((i) => /currently-deployed commit/i.test(i.text))).toBe(true);
    // De-duped by text.
    const texts = c.map((i) => i.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("returns a confidence in [0,1] matched by its label", () => {
    expect(assisted.confidence).toBeGreaterThanOrEqual(0);
    expect(assisted.confidence).toBeLessThanOrEqual(1);
    // 0.9*0.5 + 0.8*0.35 + 1*0.15 = 0.88 -> "high"
    expect(assisted.confidence).toBeCloseTo(0.88, 2);
    expect(assisted.confidenceLabel).toBe("high");
  });
});

describe("buildAssistedInvestigation — confidence labels", () => {
  it("labels a medium-confidence investigation", () => {
    const a = buildAssistedInvestigation({
      severity: "medium",
      reproducibleConfidence: 0.2,
      rootCauses: [{ cause: "Slow query", confidence: 0.5 }],
    });
    // 0.5*0.5 + 0.2*0.35 + 1*0.15 = 0.47 -> "medium"
    expect(a.confidence).toBeGreaterThanOrEqual(0.33);
    expect(a.confidence).toBeLessThan(0.66);
    expect(a.confidenceLabel).toBe("medium");
  });

  it("labels a low-confidence investigation with no root cause", () => {
    const a = buildAssistedInvestigation({ severity: "low" });
    expect(a.confidence).toBeLessThan(0.33);
    expect(a.confidenceLabel).toBe("low");
  });
});

describe("buildAssistedInvestigation — safe degradation", () => {
  it("does not throw and is not generated for an empty object", () => {
    let a;
    expect(() => {
      a = buildAssistedInvestigation({});
    }).not.toThrow();
    expect(a.generated).toBe(false);
    expect(a.confidence).toBe(0);
    expect(a.confidenceLabel).toBe("low");
    // Checklist always has a fallback item.
    expect(a.verificationChecklist.length).toBeGreaterThanOrEqual(1);
    expect(a.affectedSystems).toEqual([]);
    expect(a.regressionWarnings).toEqual([]);
  });

  it("tolerates null / non-object input", () => {
    expect(() => buildAssistedInvestigation(null)).not.toThrow();
    expect(() => buildAssistedInvestigation(undefined)).not.toThrow();
    expect(() => buildAssistedInvestigation("nope")).not.toThrow();
    const a = buildAssistedInvestigation(null);
    expect(a.generated).toBe(false);
    // The fallback probable-fix text.
    expect(a.probableFix).toMatch(/No deterministic failure was captured/i);
  });

  it("falls back to an unhandled-error guard fix when no api endpoint is owned", () => {
    const a = buildAssistedInvestigation({
      severity: "high",
      affected: { component: "TyrePanel" },
      rootCauses: [{ cause: "Unhandled error while rendering tyres", confidence: 0.7 }],
    });
    expect(a.probableFix).toMatch(/defensive guard/i);
    expect(a.probableFix).toContain("TyrePanel");
  });
});

describe("assistedInvestigationMarkdown", () => {
  it("renders the headline, sections and checklist checkboxes", () => {
    const assisted = buildAssistedInvestigation(investigation, {
      report: { title: "VHC save crashes on empty tyres" },
    });
    const md = assistedInvestigationMarkdown(assisted);

    // Headline as an H2.
    expect(md).toContain(`## ${assisted.headline}`);
    // Section headers.
    expect(md).toContain("### Probable fix");
    expect(md).toContain("### Affected systems");
    expect(md).toContain("### Implementation suggestions");
    expect(md).toContain("### Verification checklist");
    // Checklist checkboxes with kind annotations.
    expect(md).toContain("- [ ] Save a VHC with no tyre data _(manual)_");
    expect(md).toMatch(/- \[ \] .*structured error.* _\(regression\)_/);
    // Regression warning section rendered.
    expect(md).toContain("Regression warnings");
    // Confidence footer.
    expect(md).toContain("Confidence: high");
    expect(md).toMatch(/no external AI/i);
  });

  it("renders a minimal document for an empty investigation without throwing", () => {
    const assisted = buildAssistedInvestigation({});
    let md;
    expect(() => {
      md = assistedInvestigationMarkdown(assisted);
    }).not.toThrow();
    expect(md).toContain(assisted.headline);
    // The fallback checklist item still renders a checkbox.
    expect(md).toMatch(/- \[ \] /);
    expect(md).toContain("Confidence: low");
  });

  it("is safe with no argument", () => {
    expect(() => assistedInvestigationMarkdown()).not.toThrow();
    const md = assistedInvestigationMarkdown();
    expect(md).toContain("Assisted investigation");
  });
});
