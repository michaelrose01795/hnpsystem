// file location: src/lib/support/adminView.test.js
import { describe, expect, it } from "vitest";
import {
  fingerprintKey,
  groupDuplicates,
  deriveBadges,
  impactScore,
  sortReports,
  severityRank,
  matchesView,
  summarisePage,
  isOpenStatus,
} from "@/lib/support/adminView";

const fp = (route, err) => ({ route, component: "X", errorSignatures: [err], requestSignatures: [] });

describe("fingerprintKey + groupDuplicates", () => {
  it("groups reports that share a canonical fingerprint", () => {
    const reports = [
      { id: "a", fingerprint: fp("/vhc", "boom") },
      { id: "b", fingerprint: fp("/vhc", "boom") },
      { id: "c", fingerprint: fp("/hr", "other") },
      { id: "d", fingerprint: null },
    ];
    const grouped = groupDuplicates(reports);
    expect(grouped.find((r) => r.id === "a").duplicateCount).toBe(2);
    expect(grouped.find((r) => r.id === "b").duplicateCount).toBe(2);
    expect(grouped.find((r) => r.id === "c").duplicateCount).toBe(1);
    expect(grouped.find((r) => r.id === "d").duplicateCount).toBe(1);
    expect(fingerprintKey({ fingerprint: null })).toBeNull();
  });
});

describe("deriveBadges", () => {
  it("flags new / regression / recurring / duplicate / drift", () => {
    const now = Date.parse("2026-07-01T12:00:00Z");
    const badges = deriveBadges(
      {
        status: "new",
        created_at: "2026-07-01T11:00:00Z",
        inv_regression: true,
        duplicateCount: 3,
        duplicate_of: "x",
        inv_drift: true,
      },
      { now }
    );
    const keys = badges.map((b) => b.key);
    expect(keys).toEqual(expect.arrayContaining(["new", "regression", "recurring", "duplicate", "drift"]));
    expect(badges.find((b) => b.key === "recurring").label).toBe("Recurring ×3");
  });
  it("does not flag 'new' for an old report", () => {
    const now = Date.parse("2026-07-05T00:00:00Z");
    const badges = deriveBadges({ status: "new", created_at: "2026-07-01T00:00:00Z" }, { now });
    expect(badges.find((b) => b.key === "new")).toBeUndefined();
  });
});

describe("impactScore + sortReports", () => {
  const critical = { id: "crit", severity: "critical", status: "new", inv_priority: "P1", inv_regression: true, created_at: "2026-06-01" };
  const resolvedLow = { id: "res", severity: "low", status: "resolved", created_at: "2026-06-30" };
  const openMed = { id: "med", severity: "medium", status: "in_progress", created_at: "2026-06-20" };

  it("scores a critical open regression above a resolved low", () => {
    expect(impactScore(critical)).toBeGreaterThan(impactScore(resolvedLow));
  });
  it("impact sort surfaces the highest-impact issue first", () => {
    const sorted = sortReports([resolvedLow, openMed, critical], "impact");
    expect(sorted[0].id).toBe("crit");
    expect(sorted[sorted.length - 1].id).toBe("res");
  });
  it("newest sort orders by created_at desc", () => {
    const sorted = sortReports([critical, resolvedLow, openMed], "newest");
    expect(sorted[0].id).toBe("res"); // 2026-06-30 newest
  });
  it("severityRank takes the max of triage + investigation severity", () => {
    expect(severityRank({ severity: "low", inv_severity: "critical" })).toBe(4);
  });
});

describe("matchesView + summarisePage + isOpenStatus", () => {
  it("filters by openOnly / regressionsOnly", () => {
    expect(matchesView({ status: "resolved" }, { openOnly: true })).toBe(false);
    expect(matchesView({ status: "new" }, { openOnly: true })).toBe(true);
    expect(matchesView({ inv_regression: false }, { regressionsOnly: true })).toBe(false);
  });
  it("summarises a page", () => {
    const s = summarisePage([
      { status: "new", assigned_to: null, inv_regression: true },
      { status: "resolved", assigned_to: 1 },
    ]);
    expect(s).toEqual({ shown: 2, open: 1, regressions: 1, unassigned: 1 });
  });
  it("isOpenStatus", () => {
    expect(isOpenStatus("new")).toBe(true);
    expect(isOpenStatus("resolved")).toBe(false);
  });
});
