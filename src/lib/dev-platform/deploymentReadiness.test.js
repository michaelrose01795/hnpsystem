// file location: src/lib/dev-platform/deploymentReadiness.test.js
import { describe, expect, it } from "vitest";
import {
  releaseKey,
  scoreReadiness,
  buildDeploymentReadiness,
  evaluateApproval,
} from "@/lib/dev-platform/deploymentReadiness";

const NOW = Date.parse("2026-07-01T12:00:00.000Z");
const daysAgo = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

// Light-row factory matching the shape the intelligence layer reads.
const row = (o = {}) => ({
  id: o.id ?? Math.random().toString(36).slice(2),
  status: o.status ?? "new",
  severity: o.severity ?? "unset",
  inv_severity: o.inv_severity ?? undefined,
  inv_regression: o.inv_regression ?? false,
  inv_drift: o.inv_drift ?? false,
  app_version: o.app_version ?? null,
  commit_sha: o.commit_sha ?? null,
  build_id: o.build_id ?? null,
  created_at: o.created_at ?? daysAgo(0),
});

describe("releaseKey", () => {
  it("prefers app_version, then commit_sha, then build_id", () => {
    expect(releaseKey({ app_version: "1.2.0", commit_sha: "aaa", build_id: "b" })).toBe("1.2.0");
    expect(releaseKey({ commit_sha: "aaa", build_id: "b" })).toBe("aaa");
    expect(releaseKey({ build_id: "b" })).toBe("b");
    expect(releaseKey({})).toBe("(unversioned)");
    expect(releaseKey(null)).toBe("(unversioned)");
  });
});

describe("scoreReadiness", () => {
  it("scores a clean release as ready / approve with 100", () => {
    const r = scoreReadiness([
      row({ status: "resolved", severity: "high" }),
      row({ status: "wont_fix", severity: "critical" }), // closed -> no penalty
    ]);
    expect(r.score).toBe(100);
    expect(r.grade).toBe("ready");
    expect(r.recommendation).toBe("approve");
    expect(r.blockers).toEqual([]);
    expect(r.signals.total).toBe(2);
    expect(r.signals.open).toBe(0);
    expect(r.signals.openCritical).toBe(0);
  });

  it("penalises an open critical enough to leave 'ready'", () => {
    const r = scoreReadiness([row({ status: "new", severity: "critical" })]);
    // 100 - 25 = 75 -> caution
    expect(r.score).toBe(75);
    expect(r.grade).toBe("caution");
    expect(r.recommendation).toBe("review");
    expect(r.blockers.some((b) => b.type === "open_critical")).toBe(true);
    expect(r.signals.openCritical).toBe(1);
  });

  it("uses inv_severity when triaged severity is unset", () => {
    const r = scoreReadiness([row({ status: "new", severity: "unset", inv_severity: "critical" })]);
    expect(r.signals.openCritical).toBe(1);
    expect(r.score).toBe(75);
  });

  it("treats resolved / wont_fix / duplicate as closed (no open penalty)", () => {
    const r = scoreReadiness([
      row({ status: "resolved", severity: "critical" }),
      row({ status: "wont_fix", severity: "critical" }),
      row({ status: "duplicate", severity: "critical" }),
    ]);
    expect(r.signals.open).toBe(0);
    expect(r.signals.openCritical).toBe(0);
    expect(r.score).toBe(100);
  });

  it("penalises regressions and records them as blockers", () => {
    const r = scoreReadiness([
      row({ status: "new", severity: "low", inv_regression: true }),
      row({ status: "new", severity: "low", inv_regression: true }),
    ]);
    expect(r.signals.regressions).toBe(2);
    // 2 open low (4 each = 8) + 2 regressions (15 each = 30) = 38 penalty -> 62
    expect(r.score).toBe(62);
    expect(r.blockers.some((b) => b.type === "regression")).toBe(true);
  });

  it("drops out of 'ready' when criticals + regressions stack up", () => {
    const r = scoreReadiness([
      row({ status: "new", severity: "critical" }),
      row({ status: "new", severity: "critical" }),
      row({ status: "new", severity: "high", inv_regression: true }),
    ]);
    // 2*25 + 1*15 (regression) + 1*8 (openHigh) = 73 -> score 27 -> blocked
    expect(r.score).toBe(27);
    expect(r.grade).toBe("blocked");
    expect(r.recommendation).toBe("hold");
    expect(r.signals.openCritical).toBe(2);
    expect(r.signals.regressions).toBe(1);
    expect(r.signals.openHigh).toBe(1);
  });

  it("counts drift as a warning and a small penalty", () => {
    const r = scoreReadiness([row({ status: "new", severity: "low", inv_drift: true })]);
    // open low (4) + drift (5) = 9 -> 91
    expect(r.score).toBe(91);
    expect(r.signals.drift).toBe(1);
    expect(r.warnings.some((w) => /code drift/i.test(w))).toBe(true);
  });

  it("floors the score at 0", () => {
    const many = Array.from({ length: 10 }, () => row({ status: "new", severity: "critical" }));
    const r = scoreReadiness(many);
    expect(r.score).toBe(0);
    expect(r.grade).toBe("blocked");
  });

  it("applies the >=80 / >=50 grade thresholds at the boundaries", () => {
    // Exactly 80 -> ready. 5 open-low = 20 penalty -> 80.
    const ready = scoreReadiness(Array.from({ length: 5 }, () => row({ status: "new", severity: "low" })));
    expect(ready.score).toBe(80);
    expect(ready.grade).toBe("ready");

    // Exactly 50 -> caution (score < 50 is blocked). 5 openHigh + 2 openLow*? tune:
    // 6 openHigh = 48 penalty -> 52 caution; add nothing else.
    const caution = scoreReadiness(Array.from({ length: 6 }, () => row({ status: "new", severity: "high" })));
    // 6*8 = 48 -> 52 -> caution
    expect(caution.score).toBe(52);
    expect(caution.grade).toBe("caution");
  });

  it("is safe on empty / non-array input", () => {
    const r = scoreReadiness();
    expect(r.score).toBe(100);
    expect(r.grade).toBe("ready");
    expect(r.signals.total).toBe(0);
    expect(scoreReadiness(null).signals.total).toBe(0);
  });
});

describe("buildDeploymentReadiness", () => {
  const reports = [
    row({ id: "a", app_version: "1.2.0", commit_sha: "aaa", status: "resolved", severity: "high", created_at: daysAgo(20) }),
    row({ id: "b", app_version: "1.3.0", commit_sha: "bbb", status: "new", severity: "critical", created_at: daysAgo(2) }),
    row({ id: "c", app_version: "1.3.0", commit_sha: "bbb", status: "new", severity: "low", inv_regression: true, created_at: daysAgo(1) }),
    // Unversioned row grouped by commit_sha.
    row({ id: "d", app_version: null, commit_sha: "ccc", status: "new", severity: "medium", created_at: daysAgo(30) }),
  ];

  it("groups by release and sorts newest-first by last activity", () => {
    const out = buildDeploymentReadiness(reports);
    // 1.3.0 (most recent activity, daysAgo(1)) first, then 1.2.0 (daysAgo(20)), then ccc (daysAgo(30)).
    expect(out.map((g) => g.releaseKey)).toEqual(["1.3.0", "1.2.0", "ccc"]);

    const v13 = out.find((g) => g.releaseKey === "1.3.0");
    expect(v13.appVersion).toBe("1.3.0");
    expect(v13.commitSha).toBe("bbb");
    expect(v13.readiness.signals.total).toBe(2);
    expect(v13.readiness.signals.openCritical).toBe(1);
    expect(v13.readiness.signals.regressions).toBe(1);
    expect(v13.lastActivity).toBe(daysAgo(1));

    // Unversioned release keyed by commit_sha, appVersion null.
    const ccc = out.find((g) => g.releaseKey === "ccc");
    expect(ccc.appVersion).toBeNull();
    expect(ccc.commitSha).toBe("ccc");
  });

  it("merges a persisted approval record for its release", () => {
    const approvals = [
      {
        release_key: "1.3.0",
        status: "approved",
        approver_key: "dev-1",
        readiness_score: 60,
        notes: "shipping with a known regression",
        updated_at: daysAgo(1),
      },
    ];
    const out = buildDeploymentReadiness(reports, { approvals });
    const v13 = out.find((g) => g.releaseKey === "1.3.0");
    expect(v13.approval).toEqual({
      status: "approved",
      approverKey: "dev-1",
      score: 60,
      notes: "shipping with a known regression",
      updatedAt: daysAgo(1),
    });
    // Releases without an approval row get null.
    expect(out.find((g) => g.releaseKey === "1.2.0").approval).toBeNull();
  });

  it("is safe on empty input", () => {
    expect(buildDeploymentReadiness()).toEqual([]);
    expect(buildDeploymentReadiness([], { approvals: [] })).toEqual([]);
  });
});

describe("evaluateApproval", () => {
  it("flags override:true when approving a blocked readiness", () => {
    const readiness = scoreReadiness([
      row({ status: "new", severity: "critical" }),
      row({ status: "new", severity: "critical" }),
      row({ status: "new", severity: "high", inv_regression: true }),
    ]);
    expect(readiness.grade).toBe("blocked");
    const res = evaluateApproval(readiness, "approved");
    expect(res.ok).toBe(true);
    expect(res.override).toBe(true);
    expect(res.reason).toContain(`${readiness.score}/100`);
    expect(res.reason).toMatch(/override/i);
  });

  it("does not override when approving a healthy readiness", () => {
    const readiness = scoreReadiness([row({ status: "resolved", severity: "high" })]);
    expect(readiness.grade).toBe("ready");
    const res = evaluateApproval(readiness, "approved");
    expect(res).toEqual({ ok: true, override: false, reason: "" });
  });

  it("never overrides when the desired status is blocked or pending", () => {
    const blockedReadiness = scoreReadiness([
      row({ status: "new", severity: "critical" }),
      row({ status: "new", severity: "critical" }),
      row({ status: "new", severity: "critical" }),
    ]);
    expect(blockedReadiness.grade).toBe("blocked");
    expect(evaluateApproval(blockedReadiness, "blocked")).toEqual({ ok: true, override: false, reason: "" });
    expect(evaluateApproval(blockedReadiness, "pending")).toEqual({ ok: true, override: false, reason: "" });
  });

  it("defaults desiredStatus to 'approved' and is safe with no args", () => {
    expect(() => evaluateApproval()).not.toThrow();
    const res = evaluateApproval();
    expect(res.ok).toBe(true);
    expect(res.override).toBe(false); // undefined grade is not "blocked"
  });
});
