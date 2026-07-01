// file location: src/lib/dev-platform/productivityMetrics.test.js
import { describe, expect, it } from "vitest";
import { buildProductivityMetrics } from "@/lib/dev-platform/productivityMetrics";

const NOW = "2026-07-01T12:00:00.000Z"; // windowDays=30 → windowStart 2026-06-01T12:00:00Z

// Light-row shape: { id, status, severity, assigned_to, created_at, updated_at }
const rows = [
  // Terminal + resolved (dev 5). resolveHours = 5.
  { id: 1, status: "resolved", severity: "low", assigned_to: 5, created_at: "2026-06-20T00:00:00.000Z", updated_at: "2026-06-20T05:00:00.000Z" },
  // Terminal + resolved (wont_fix, dev 5). resolveHours = 15.
  { id: 2, status: "wont_fix", severity: "medium", assigned_to: 5, created_at: "2026-06-21T00:00:00.000Z", updated_at: "2026-06-21T15:00:00.000Z" },
  // Terminal but NOT in the "resolved" set (duplicate, dev 7). resolveHours = 10.
  { id: 3, status: "duplicate", severity: "low", assigned_to: 7, created_at: "2026-06-22T00:00:00.000Z", updated_at: "2026-06-22T10:00:00.000Z" },
  // Open (new), unassigned. age vs NOW = 6 days.
  { id: 4, status: "new", severity: "high", assigned_to: null, created_at: "2026-06-25T12:00:00.000Z", updated_at: "2026-06-25T12:00:00.000Z" },
  // Open (in_progress), dev 7. age vs NOW = 16 days.
  { id: 5, status: "in_progress", severity: "critical", assigned_to: 7, created_at: "2026-06-15T12:00:00.000Z", updated_at: "2026-06-20T00:00:00.000Z" },
  // OUTSIDE the 30-day window (created ~2 months ago). Terminal, so not open.
  { id: 6, status: "resolved", severity: "low", assigned_to: 5, created_at: "2026-05-01T00:00:00.000Z", updated_at: "2026-05-02T00:00:00.000Z" },
];

describe("buildProductivityMetrics — totals", () => {
  const out = buildProductivityMetrics(rows, { now: NOW, windowDays: 30 });

  it("counts created as in-window rows (excludes the out-of-window row)", () => {
    expect(out.totals.created).toBe(5); // r1..r5; r6 dropped by window
  });

  it("counts resolved as the resolved+wont_fix subset in-window", () => {
    expect(out.totals.resolved).toBe(2); // r1 (resolved) + r2 (wont_fix)
  });

  it("counts closed as all terminal rows in-window", () => {
    expect(out.totals.closed).toBe(3); // r1 + r2 + r3 (duplicate)
  });

  it("counts open across ALL rows regardless of window", () => {
    expect(out.totals.open).toBe(2); // r4 (new) + r5 (in_progress)
  });

  it("reports the window metadata (from/to/days)", () => {
    expect(out.window.days).toBe(30);
    expect(out.window.to).toBe(NOW);
    expect(out.window.from).toBe("2026-06-01T12:00:00.000Z");
  });
});

describe("buildProductivityMetrics — throughput buckets", () => {
  const out = buildProductivityMetrics(rows, { now: NOW, windowDays: 30 });
  const byDate = Object.fromEntries(out.throughput.map((b) => [b.date, b]));

  it("counts created on the created_at UTC day and resolved on the updated_at UTC day", () => {
    expect(byDate["2026-06-15"]).toEqual({ date: "2026-06-15", created: 1, resolved: 0 }); // r5 created only
    expect(byDate["2026-06-20"]).toEqual({ date: "2026-06-20", created: 1, resolved: 1 }); // r1 created + resolved
    expect(byDate["2026-06-21"]).toEqual({ date: "2026-06-21", created: 1, resolved: 1 }); // r2
    expect(byDate["2026-06-22"]).toEqual({ date: "2026-06-22", created: 1, resolved: 1 }); // r3 duplicate (terminal)
    expect(byDate["2026-06-25"]).toEqual({ date: "2026-06-25", created: 1, resolved: 0 }); // r4 created only
  });

  it("is sorted ascending by date and excludes the out-of-window row", () => {
    const dates = out.throughput.map((b) => b.date);
    expect(dates).toEqual([...dates].sort((a, b) => a.localeCompare(b)));
    expect(dates).not.toContain("2026-05-01");
    expect(dates).not.toContain("2026-05-02");
  });
});

describe("buildProductivityMetrics — resolve-time stats", () => {
  const out = buildProductivityMetrics(rows, { now: NOW, windowDays: 30 });

  it("computes mean time-to-resolve in hours over terminal rows", () => {
    // resolveHours: r1=5, r2=15, r3=10 → mean 10
    expect(out.meanTimeToResolveHours).toBe(10);
  });

  it("computes median time-to-resolve in hours over terminal rows", () => {
    expect(out.medianTimeToResolveHours).toBe(10); // sorted [5,10,15] → 10
  });

  it("computes resolutionRate in [0,1]", () => {
    expect(out.resolutionRate).toBe(0.6); // 3 terminal / 5 created
    expect(out.resolutionRate).toBeGreaterThanOrEqual(0);
    expect(out.resolutionRate).toBeLessThanOrEqual(1);
  });
});

describe("buildProductivityMetrics — byDeveloper", () => {
  const out = buildProductivityMetrics(rows, { now: NOW, windowDays: 30 });

  it("aggregates per assignee and sorts by resolved desc", () => {
    expect(out.byDeveloper).toEqual([
      { key: "5", assigned: 2, resolved: 2, avgResolveHours: 10 }, // r1,r2
      { key: "7", assigned: 2, resolved: 1, avgResolveHours: 10 }, // r3 (terminal) + r5 (open)
    ]);
  });

  it("excludes rows with no assignee", () => {
    // r4 (assigned_to null) never appears as a developer key.
    expect(out.byDeveloper.map((d) => d.key)).not.toContain("null");
  });
});

describe("buildProductivityMetrics — backlog", () => {
  const out = buildProductivityMetrics(rows, { now: NOW, windowDays: 30 });

  it("computes mean backlog age in days over open rows", () => {
    // r4 age 6d, r5 age 16d → mean 11
    expect(out.backlogAgeDays).toBe(11);
  });

  it("reports the oldest open age in days", () => {
    expect(out.oldestOpenDays).toBe(16);
  });
});

describe("buildProductivityMetrics — empty / degenerate input", () => {
  it("returns zeros and nulls without throwing on empty input", () => {
    const out = buildProductivityMetrics([], { now: NOW, windowDays: 30 });
    expect(out.totals).toEqual({ created: 0, resolved: 0, closed: 0, open: 0 });
    expect(out.throughput).toEqual([]);
    expect(out.meanTimeToResolveHours).toBeNull();
    expect(out.medianTimeToResolveHours).toBeNull();
    expect(out.resolutionRate).toBe(0);
    expect(out.backlogAgeDays).toBeNull();
    expect(out.oldestOpenDays).toBeNull();
    expect(out.byDeveloper).toEqual([]);
    // now is truthy → window.from is still the computed windowStart even with no rows.
    expect(out.window.from).toBe("2026-06-01T12:00:00.000Z");
  });

  it("is safe with no arguments at all", () => {
    expect(() => buildProductivityMetrics()).not.toThrow();
    const out = buildProductivityMetrics();
    expect(out.totals.created).toBe(0);
    expect(out.window.from).toBeNull(); // now falsy → windowStart not surfaced
    expect(out.window.to).toBeNull();
  });

  it("treats everything as in-window when now is falsy", () => {
    // Same rows, but no now → r6 (old) is NOT dropped, backlog ages are null (no now).
    const out = buildProductivityMetrics(rows, { windowDays: 30 });
    expect(out.totals.created).toBe(6); // all rows in-window
    expect(out.totals.open).toBe(2); // still r4 + r5
    expect(out.backlogAgeDays).toBeNull(); // no now → cannot age
    expect(out.oldestOpenDays).toBeNull();
  });
});
