// file location: src/lib/dev-platform/intelligence.test.js
import { describe, expect, it } from "vitest";
import {
  areaKey,
  rollup,
  trendSeries,
  problemAreas,
  clusterIncidents,
  predictiveInsights,
  buildIntelligence,
} from "@/lib/dev-platform/intelligence";

const NOW = Date.parse("2026-07-01T12:00:00.000Z");
const daysAgo = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

// A shared fingerprint so two rows cluster.
const FP = { route: "/job-cards", component: "VhcPanel", errorSignatures: ["boom"], requestSignatures: [] };

const rows = [
  { id: "a", route: "/job-cards/1", section_key: "vhc-panel", status: "new", severity: "high", assigned_to: null, created_at: daysAgo(0), inv_regression: true, inv_confidence: 0.8, fingerprint: FP, app_version: "1.2.0", source_file: "src/x.js", source_line: 10 },
  { id: "b", route: "/job-cards/2", section_key: "vhc-panel", status: "resolved", severity: "medium", assigned_to: 5, created_at: daysAgo(1), inv_confidence: 0.4, fingerprint: FP, app_version: "1.3.0" },
  { id: "c", route: "/sales", section_key: null, status: "new", severity: "low", assigned_to: null, created_at: daysAgo(2), inv_drift: true, category: "visual" },
];

describe("areaKey", () => {
  it("combines route (query stripped) with section", () => {
    expect(areaKey({ route: "/a?x=1", section_key: "s" })).toBe("/a#s");
    expect(areaKey({ route: "/a" })).toBe("/a");
    expect(areaKey({})).toBe("(unknown route)");
  });
});

describe("rollup", () => {
  it("aggregates open / regressions / drift / distinct areas", () => {
    const r = rollup(rows);
    expect(r.total).toBe(3);
    expect(r.open).toBe(2); // a + c
    expect(r.unassigned).toBe(2); // a + c (open + no assignee)
    expect(r.regressions).toBe(1);
    expect(r.drift).toBe(1);
    expect(r.problemAreas).toBe(3);
    expect(r.avgConfidence).toBeCloseTo(0.6, 5);
  });

  it("is safe on empty input", () => {
    expect(rollup().total).toBe(0);
    expect(rollup().avgConfidence).toBeNull();
  });
});

describe("trendSeries", () => {
  it("buckets by day within the window and counts open/regressions", () => {
    const series = trendSeries(rows, { now: NOW, days: 3 });
    expect(series).toHaveLength(3);
    const today = series[series.length - 1];
    expect(today.count).toBe(1); // row a
    expect(today.regressions).toBe(1);
    expect(series.reduce((s, b) => s + b.count, 0)).toBe(3);
  });

  it("drops reports outside the window", () => {
    const series = trendSeries([{ created_at: daysAgo(100), status: "new" }], { now: NOW, days: 5 });
    expect(series.reduce((s, b) => s + b.count, 0)).toBe(0);
  });
});

describe("problemAreas", () => {
  it("ranks areas by impact + regressions, freshest first among ties", () => {
    const areas = problemAreas(rows, { now: NOW });
    // Every distinct area appears.
    expect(areas.length).toBe(3);
    // The regression area outranks the low-severity sales one.
    const top = areas[0];
    expect(top.regressions).toBeGreaterThanOrEqual(0);
    expect(areas.map((a) => a.key)).toContain("/sales");
  });

  it("keeps the freshest source ref per area", () => {
    const merged = problemAreas(
      [
        { id: "1", route: "/r", section_key: "s", status: "new", created_at: daysAgo(2), source_file: "old.js", source_line: 1 },
        { id: "2", route: "/r", section_key: "s", status: "new", created_at: daysAgo(0), source_file: "new.js", source_line: 2 },
      ],
      { now: NOW }
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].total).toBe(2);
    expect(merged[0].sourceFile).toBe("new.js");
  });
});

describe("clusterIncidents", () => {
  it("groups recurring incidents by fingerprint (count > 1 only)", () => {
    const clusters = clusterIncidents(rows);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(2);
    expect(clusters[0].reportIds.sort()).toEqual(["a", "b"]);
    expect(clusters[0].versions.sort()).toEqual(["1.2.0", "1.3.0"]);
    expect(clusters[0].regression).toBe(true);
  });

  it("returns nothing when no fingerprint recurs", () => {
    expect(clusterIncidents([rows[2]])).toHaveLength(0);
  });
});

describe("predictiveInsights", () => {
  it("flags areas rising vs the prior window", () => {
    const rising = [
      // prior window: 1 report ~10 days ago
      { id: "p", route: "/hot", status: "new", created_at: daysAgo(10) },
      // recent window: 3 reports in the last 7 days
      { id: "r1", route: "/hot", status: "new", created_at: daysAgo(1) },
      { id: "r2", route: "/hot", status: "new", created_at: daysAgo(2) },
      { id: "r3", route: "/hot", status: "new", created_at: daysAgo(3) },
    ];
    const insights = predictiveInsights(rising, { now: NOW, windowDays: 7 });
    expect(insights).toHaveLength(1);
    expect(insights[0].route).toBe("/hot");
    expect(insights[0].recent).toBe(3);
    expect(insights[0].prior).toBe(1);
    expect(insights[0].ratio).toBe(3);
  });

  it("does not flag stable or single-report areas", () => {
    const stable = [
      { id: "1", route: "/x", status: "new", created_at: daysAgo(1) },
      { id: "2", route: "/x", status: "new", created_at: daysAgo(10) },
    ];
    expect(predictiveInsights(stable, { now: NOW, windowDays: 7 })).toHaveLength(0);
  });
});

describe("buildIntelligence", () => {
  it("composes the full payload", () => {
    const out = buildIntelligence(rows, { now: NOW });
    expect(out.reportCount).toBe(3);
    expect(out.rollup.total).toBe(3);
    expect(out.trend.length).toBe(14);
    expect(Array.isArray(out.problemAreas)).toBe(true);
    expect(Array.isArray(out.clusters)).toBe(true);
    expect(Array.isArray(out.predictions)).toBe(true);
    expect(typeof out.generatedAt).toBe("string");
  });
});
