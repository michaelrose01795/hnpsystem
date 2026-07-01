// file location: src/lib/dev-platform/productivityMetrics.js
//
// Phase 10 — engineering productivity metrics. PURE analytics over the LIGHT
// report rows (status, severity, assigned_to, created_at, updated_at) — no
// diagnostics blob. `now` is injected for deterministic, node-testable output.
//
// APPROXIMATION (documented): the schema has no dedicated resolved_at column, so
// "time to resolve" is approximated as updated_at − created_at for reports in a
// terminal status (resolved / wont_fix / duplicate). This is the same trade-off
// the rest of the intelligence layer makes (it aggregates over already-present
// columns rather than adding a new store). It is accurate to within the last
// triage edit, which for a human-scale internal tool is close enough to trend on.

import { isOpenStatus } from "@/lib/support/adminView";

const arr = (v) => (Array.isArray(v) ? v : []);
const ms = (d) => {
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : null;
};
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const TERMINAL = new Set(["resolved", "wont_fix", "duplicate"]);
const RESOLVED = new Set(["resolved", "wont_fix"]);

function dayKey(t) {
  // YYYY-MM-DD in UTC (no Date.now / locale dependence).
  return new Date(t).toISOString().slice(0, 10);
}

function resolveHours(r) {
  const a = ms(r.created_at);
  const b = ms(r.updated_at);
  if (a == null || b == null || b < a) return null;
  return (b - a) / HOUR;
}

function median(nums) {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}
const mean = (nums) => {
  const xs = nums.filter((n) => Number.isFinite(n));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};
const round1 = (n) => (n == null ? null : Number(n.toFixed(1)));

/**
 * Build the productivity metrics payload.
 *
 * @param {object[]} reports LIGHT rows
 * @param {{ now?: string, windowDays?: number }} [opts]
 * @returns {object}
 */
export function buildProductivityMetrics(reports = [], opts = {}) {
  const nowT = ms(opts.now) ?? 0;
  const windowDays = Number.isFinite(opts.windowDays) ? opts.windowDays : 30;
  const windowStart = nowT - windowDays * DAY;
  const rows = arr(reports);

  const inWindow = (r) => {
    const t = ms(r.created_at);
    return t == null || nowT === 0 ? true : t >= windowStart;
  };

  const windowed = rows.filter(inWindow);
  const resolvedRows = windowed.filter((r) => RESOLVED.has(r.status));
  const terminalRows = windowed.filter((r) => TERMINAL.has(r.status));
  const openRows = rows.filter((r) => isOpenStatus(r.status));

  // Throughput: created vs resolved per UTC day across the window.
  const buckets = new Map();
  const ensure = (key) => {
    if (!buckets.has(key)) buckets.set(key, { date: key, created: 0, resolved: 0 });
    return buckets.get(key);
  };
  windowed.forEach((r) => {
    const c = ms(r.created_at);
    if (c != null) ensure(dayKey(c)).created += 1;
  });
  terminalRows.forEach((r) => {
    const u = ms(r.updated_at);
    if (u != null) ensure(dayKey(u)).resolved += 1;
  });
  const throughput = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));

  const resolveTimes = terminalRows.map(resolveHours).filter((n) => n != null);

  // Per-developer contribution (by assignee). Only rows with an assignee count.
  const devMap = new Map();
  windowed.forEach((r) => {
    if (r.assigned_to == null) return;
    const key = String(r.assigned_to);
    if (!devMap.has(key)) devMap.set(key, { key, assigned: 0, resolved: 0, resolveTimes: [] });
    const d = devMap.get(key);
    d.assigned += 1;
    if (TERMINAL.has(r.status)) {
      d.resolved += 1;
      const h = resolveHours(r);
      if (h != null) d.resolveTimes.push(h);
    }
  });
  const byDeveloper = Array.from(devMap.values())
    .map((d) => ({
      key: d.key,
      assigned: d.assigned,
      resolved: d.resolved,
      avgResolveHours: round1(mean(d.resolveTimes)),
    }))
    .sort((a, b) => b.resolved - a.resolved || b.assigned - a.assigned);

  // Backlog age: mean age (days) of currently-open reports.
  const backlogAges = openRows
    .map((r) => {
      const c = ms(r.created_at);
      return c != null && nowT ? (nowT - c) / DAY : null;
    })
    .filter((n) => n != null);

  return {
    window: { days: windowDays, from: nowT ? new Date(windowStart).toISOString() : null, to: opts.now || null },
    totals: {
      created: windowed.length,
      resolved: resolvedRows.length,
      closed: terminalRows.length,
      open: openRows.length,
    },
    throughput,
    meanTimeToResolveHours: round1(mean(resolveTimes)),
    medianTimeToResolveHours: round1(median(resolveTimes)),
    // Resolution efficiency: resolved ÷ created in-window (capped at 1 for display honesty).
    resolutionRate: windowed.length ? Number(Math.min(1, terminalRows.length / windowed.length).toFixed(2)) : 0,
    backlogAgeDays: round1(mean(backlogAges)),
    oldestOpenDays: backlogAges.length ? round1(Math.max(...backlogAges)) : null,
    byDeveloper,
  };
}
