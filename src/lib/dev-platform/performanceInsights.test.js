// file location: src/lib/dev-platform/performanceInsights.test.js
import { describe, expect, it } from "vitest";
import {
  endpointKey,
  endpointStats,
  requestTimeline,
  executionFlow,
  perfMetrics,
  buildPerformanceProfile,
} from "@/lib/dev-platform/performanceInsights";

const snapshot = {
  failed_requests: [
    { ts: "2026-07-01T12:00:00.000Z", method: "get", url: "/api/jobs?x=1", status: 500, ms: 320 },
    { ts: "2026-07-01T12:00:01.000Z", method: "GET", url: "/api/jobs?x=2", status: 500, ms: 480 },
    { ts: "2026-07-01T12:00:02.000Z", method: "POST", url: "/api/sales", status: 404, ms: 40 },
  ],
  recent_actions: [
    { ts: "2026-07-01T11:59:58.000Z", type: "route_change", to: "/job-cards" },
    { ts: "2026-07-01T11:59:59.500Z", type: "click", label: "Save", sectionKey: "vhc-panel" },
  ],
  providers: {
    "dev-metadata": {
      performance: { ttfbMs: 120, domReadyMs: 800, loadMs: 1500 },
      memory: { usedMb: 90, limitMb: 2048, pressure: 0.04 },
      network: { effectiveType: "4g" },
      repeatedApiFailures: [{ endpoint: "GET /api/jobs", count: 2 }],
      recentRouteChanges: 3,
    },
  },
};

describe("endpointKey", () => {
  it("normalises method + path, dropping the query", () => {
    expect(endpointKey({ method: "get", url: "/api/jobs?x=1" })).toBe("GET /api/jobs");
  });
});

describe("endpointStats", () => {
  it("groups requests by endpoint with counts + duration figures", () => {
    const stats = endpointStats(snapshot);
    const jobs = stats.find((s) => s.endpoint === "GET /api/jobs");
    expect(jobs.count).toBe(2);
    expect(jobs.avgMs).toBe(400);
    expect(jobs.maxMs).toBe(480);
    expect(jobs.serverErrors).toBe(2);
    expect(jobs.statuses[500]).toBe(2);
  });

  it("is safe with no requests", () => {
    expect(endpointStats({})).toEqual([]);
  });
});

describe("requestTimeline", () => {
  it("orders requests by time with a status tone", () => {
    const tl = requestTimeline(snapshot);
    expect(tl).toHaveLength(3);
    expect(tl[0].tone).toBe("danger-base"); // 500
    expect(tl[2].tone).toBe("warning-base"); // 404
    expect(tl[0].path).toBe("/api/jobs");
  });
});

describe("executionFlow", () => {
  it("orders actions and computes the gap between steps", () => {
    const flow = executionFlow(snapshot);
    expect(flow).toHaveLength(2);
    expect(flow[0].label).toBe("→ /job-cards");
    expect(flow[1].gapMs).toBe(1500);
    expect(flow[1].sectionKey).toBe("vhc-panel");
  });
});

describe("perfMetrics", () => {
  it("flattens dev-metadata timing/memory/network", () => {
    const m = perfMetrics(snapshot);
    expect(m.ttfbMs).toBe(120);
    expect(m.memoryUsedMb).toBe(90);
    expect(m.memoryPressure).toBe(0.04);
    expect(m.recentRouteChanges).toBe(3);
    expect(m.repeatedApiFailures).toHaveLength(1);
  });

  it("returns null figures when the provider did not run", () => {
    const m = perfMetrics({});
    expect(m.ttfbMs).toBeNull();
    expect(m.recentRouteChanges).toBe(0);
    expect(m.repeatedApiFailures).toEqual([]);
  });
});

describe("buildPerformanceProfile", () => {
  it("composes the full profile", () => {
    const out = buildPerformanceProfile(snapshot, { now: Date.parse("2026-07-01T12:00:05.000Z") });
    expect(out.endpointCount).toBe(2);
    expect(out.totalCapturedRequests).toBe(3);
    expect(out.metrics.ttfbMs).toBe(120);
    expect(Array.isArray(out.requestTimeline)).toBe(true);
    expect(Array.isArray(out.executionFlow)).toBe(true);
  });
});
