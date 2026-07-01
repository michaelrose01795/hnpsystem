// file location: src/lib/dev-platform/releaseIntelligence.test.js
import { describe, expect, it } from "vitest";
import {
  buildReleaseRegistry,
  deploymentTimeline,
  incidentVersionTimeline,
  autoReopenCandidates,
  buildReleaseIntelligence,
} from "@/lib/dev-platform/releaseIntelligence";

const NOW = Date.parse("2026-07-01T12:00:00.000Z");
const daysAgo = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();
const FP = { route: "/r", component: "C", errorSignatures: ["boom"], requestSignatures: [] };

const rows = [
  { id: "a", app_version: "1.2.0", commit_sha: "aaa", status: "resolved", severity: "high", created_at: daysAgo(20), inv_regression: false, fingerprint: FP, inv_first_version: "1.2.0", inv_last_version: "1.2.0" },
  { id: "b", app_version: "1.3.0", commit_sha: "bbb", status: "new", severity: "medium", created_at: daysAgo(2), inv_regression: true, fingerprint: FP, inv_first_version: "1.2.0", inv_last_version: "1.3.0" },
  { id: "c", app_version: "1.3.0", commit_sha: "bbb", status: "new", severity: "low", created_at: daysAgo(1), inv_regression: false },
];

describe("buildReleaseRegistry", () => {
  it("builds one row per release with quality roll-ups, newest first", () => {
    const reg = buildReleaseRegistry(rows);
    expect(reg.map((r) => r.version)).toEqual(["1.3.0", "1.2.0"]);
    const v13 = reg.find((r) => r.version === "1.3.0");
    expect(v13.reportCount).toBe(2);
    expect(v13.open).toBe(2);
    expect(v13.regressions).toBe(1);
    expect(v13.qualityScore).toBeLessThan(100);
  });

  it("is safe on empty input", () => {
    expect(buildReleaseRegistry()).toEqual([]);
  });
});

describe("deploymentTimeline", () => {
  it("orders oldest → newest and computes quality delta", () => {
    const tl = deploymentTimeline(rows);
    expect(tl.map((t) => t.version)).toEqual(["1.2.0", "1.3.0"]);
    expect(tl[0].qualityDelta).toBeNull();
    expect(typeof tl[1].qualityDelta).toBe("number");
  });
});

describe("incidentVersionTimeline", () => {
  it("tracks recurring incidents across releases", () => {
    const inc = incidentVersionTimeline(rows);
    expect(inc).toHaveLength(1);
    expect(inc[0].occurrences).toBe(2);
    expect(inc[0].spansReleases).toBe(true);
    expect(inc[0].regression).toBe(true);
    expect(inc[0].versions.sort()).toEqual(["1.2.0", "1.3.0"]);
  });
});

describe("autoReopenCandidates", () => {
  it("recommends reopening a closed report that regressed", () => {
    const closedRegression = { id: "z", status: "resolved", inv_regression: true, inv_first_version: "1.2.0", inv_last_version: "1.4.0", route: "/z" };
    const out = autoReopenCandidates([closedRegression, ...rows]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("z");
    expect(out[0].fromStatus).toBe("resolved");
    expect(out[0].patch).toEqual({ status: "triaged" });
    expect(out[0].reason).toMatch(/1\.4\.0/);
  });

  it("does not reopen an already-open regression", () => {
    expect(autoReopenCandidates([{ id: "o", status: "new", inv_regression: true }])).toHaveLength(0);
  });
});

describe("buildReleaseIntelligence", () => {
  it("composes the full payload", () => {
    const out = buildReleaseIntelligence(rows, { now: NOW });
    expect(out.releaseCount).toBe(2);
    expect(Array.isArray(out.releases)).toBe(true);
    expect(Array.isArray(out.timeline)).toBe(true);
    expect(Array.isArray(out.incidents)).toBe(true);
    expect(out.autoReopenCount).toBe(0);
  });
});
