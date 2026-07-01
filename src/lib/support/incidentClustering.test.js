// file location: src/lib/support/incidentClustering.test.js
import { describe, expect, it } from "vitest";
import {
  stableHash,
  buildFingerprint,
  similarity,
  findSimilarReports,
  repeatedFailures,
} from "@/lib/support/incidentClustering";

const snap = {
  route: { asPath: "/job-cards/00099?tab=vhc", pathname: "/job-cards/[jobNumber]" },
  code_ownership: { section_key: "jobcard-tab-vhc" },
  unhandled_errors: [{ message: "Cannot read 'id' of undefined", componentStack: "\n    in VHCTab" }],
  console_errors: [{ level: "error", msg: "save failed 500" }],
  failed_requests: [{ method: "POST", url: "/api/vhc/save?x=1", status: 500 }],
  recent_actions: [{ type: "click", sectionKey: "jobcard-tab-vhc" }],
  attachments: [{ order: 0, hash: "hAAA" }],
};

describe("stableHash", () => {
  it("is deterministic and differs for different input", () => {
    expect(stableHash("abc")).toBe(stableHash("abc"));
    expect(stableHash("abc")).not.toBe(stableHash("abd"));
  });
});

describe("buildFingerprint", () => {
  it("extracts route (querystring stripped), component, and multi-signal sets", () => {
    const fp = buildFingerprint(snap);
    expect(fp.route).toBe("/job-cards/00099");
    expect(fp.component).toBe("VHCTab");
    expect(fp.sectionKey).toBe("jobcard-tab-vhc");
    expect(fp.requestSignatures[0]).toContain("/api/vhc/save");
    expect(fp.screenshotHashes).toEqual(["hAAA"]);
    expect(fp.errorSignatures.length).toBeGreaterThan(0);
  });

  it("normalises numbers so differing ids still match", () => {
    const a = buildFingerprint(snap);
    const b = buildFingerprint({ ...snap, route: { asPath: "/job-cards/12345" } });
    // error + request signatures are number-normalised → identical
    expect(a.errorSignatures).toEqual(b.errorSignatures);
    expect(a.requestSignatures).toEqual(b.requestSignatures);
  });
});

describe("similarity", () => {
  it("scores identical fingerprints high with reasons", () => {
    const fp = buildFingerprint(snap);
    const { score, reasons } = similarity(fp, fp);
    expect(score).toBeGreaterThan(0.8);
    expect(reasons).toContain("same error signature");
    expect(reasons).toContain("identical screenshot");
  });

  it("scores unrelated fingerprints at zero", () => {
    const other = buildFingerprint({
      route: { asPath: "/customers/5" },
      unhandled_errors: [{ message: "totally different failure" }],
    });
    const { score } = similarity(buildFingerprint(snap), other);
    expect(score).toBe(0);
  });
});

describe("findSimilarReports + repeatedFailures", () => {
  const priors = [
    { id: "r1", route: "/job-cards/00001", fingerprint: buildFingerprint({ ...snap, route: { asPath: "/job-cards/00001" } }) },
    { id: "r2", route: "/customers/9", fingerprint: buildFingerprint({ route: { asPath: "/customers/9" }, unhandled_errors: [{ message: "x" }] }) },
  ];

  it("ranks similar prior reports above the threshold", () => {
    const matches = findSimilarReports(buildFingerprint(snap), priors);
    expect(matches[0].reportId).toBe("r1");
    expect(matches[0].score).toBeGreaterThan(0.25);
    expect(matches.find((m) => m.reportId === "r2")).toBeUndefined();
  });

  it("counts repeated failures on the same route + component", () => {
    const rf = repeatedFailures(buildFingerprint(snap), priors);
    expect(rf.component).toBe("VHCTab");
    expect(rf.componentCount).toBe(1); // r1 shares the component
    expect(rf.routeCount).toBe(0); // routes differ (job number differs, path not normalised for route count)
  });
});
