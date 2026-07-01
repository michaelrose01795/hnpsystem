// file location: src/lib/dev-platform/intelligence.js
//
// Phase 9 — Developer Platform intelligence engine. PURE, node-testable
// aggregation over the LIGHT report rows returned by listReportsForIntelligence()
// (never the RLS-locked diagnostics blob). It turns the per-report investigation
// signals the ingest engine already computed (investigation.js /
// incidentClustering.js) into cross-report ANALYTICS: problem-area ranking,
// incident clustering, trend series, statistical roll-ups, and predictive
// "recurring problem area" insights.
//
// No React, no I/O, no window. Every function is defensive over partial rows so
// a missing field never throws. "Tone" values are theme-token NAMES (see
// adminView.js) — the UI maps them to var(--<tone>).

import { fingerprintKey, impactScore, isOpenStatus, severityRank } from "@/lib/support/adminView";

const arr = (v) => (Array.isArray(v) ? v : []);
const ms = (v) => {
  const t = Date.parse(String(v || ""));
  return Number.isFinite(t) ? t : null;
};
const DAY_MS = 24 * 60 * 60 * 1000;

// A stable "area" key for a report: the route it happened on, refined by the
// nearest section key so two different panels on the same page are distinct
// problem areas.
export function areaKey(report = {}) {
  const route = String(report.route || "").split("?")[0] || "(unknown route)";
  const section = report.section_key ? `#${report.section_key}` : "";
  return `${route}${section}`;
}

// Numeric regression/drift/open flags read defensively from either the derived
// investigation subfields or the triage columns.
const isRegression = (r) => r?.inv_regression === true;
const isDrift = (r) => r?.inv_drift === true;
const confidenceOf = (r) => {
  const c = Number(r?.inv_confidence);
  return Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : null;
};

// ---------------------------------------------------------------------------
// Roll-up — the top-line statistics for the intelligence dashboard. Complements
// the Support Centre's getSupportReportStats() with intelligence-specific
// aggregates (confidence, drift, distinct problem areas).
// ---------------------------------------------------------------------------
export function rollup(reports = []) {
  const list = arr(reports);
  const tally = (fn) =>
    list.reduce((acc, r) => {
      const k = fn(r) || "unset";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  const confidences = list.map(confidenceOf).filter((c) => c != null);
  const avgConfidence = confidences.length
    ? Number((confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(3))
    : null;
  const areas = new Set(list.map(areaKey));
  return {
    total: list.length,
    open: list.filter((r) => isOpenStatus(r.status)).length,
    unassigned: list.filter((r) => isOpenStatus(r.status) && r.assigned_to == null).length,
    regressions: list.filter(isRegression).length,
    drift: list.filter(isDrift).length,
    problemAreas: areas.size,
    byStatus: tally((r) => r.status),
    bySeverity: tally((r) => (severityRank(r) ? r.inv_severity || r.severity : r.severity)),
    byCategory: tally((r) => r.category),
    avgConfidence,
  };
}

// ---------------------------------------------------------------------------
// Trend series — bucket reports into per-day counts over a trailing window, so
// the dashboard can chart volume / open / regression trends. `now` is injected
// (the module never reads the clock) so it is deterministic + testable.
// ---------------------------------------------------------------------------
export function trendSeries(reports = [], { now = Date.now(), days = 14 } = {}) {
  const span = Math.max(1, days);
  const end = now;
  const start = end - (span - 1) * DAY_MS;
  const dayIndex = (t) => Math.floor((t - start) / DAY_MS);
  const buckets = Array.from({ length: span }, (_, i) => ({
    // Midpoint date of the bucket, ISO date only (no time → no TZ ambiguity).
    date: new Date(start + i * DAY_MS).toISOString().slice(0, 10),
    count: 0,
    open: 0,
    regressions: 0,
  }));
  for (const r of arr(reports)) {
    const t = ms(r.created_at);
    if (t == null) continue;
    const idx = dayIndex(t);
    if (idx < 0 || idx >= span) continue;
    buckets[idx].count += 1;
    if (isOpenStatus(r.status)) buckets[idx].open += 1;
    if (isRegression(r)) buckets[idx].regressions += 1;
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Problem areas — rank the routes/sections producing the most (and most severe)
// reports. This is the heart of "identify recurring problem areas".
// ---------------------------------------------------------------------------
export function problemAreas(reports = [], { now = Date.now(), limit = 12 } = {}) {
  const groups = new Map();
  for (const r of arr(reports)) {
    const key = areaKey(r);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        route: String(r.route || "").split("?")[0] || null,
        sectionKey: r.section_key || null,
        sourceFile: r.source_file || null,
        sourceLine: r.source_line || null,
        total: 0,
        open: 0,
        regressions: 0,
        maxSeverity: 0,
        impact: 0,
        lastSeen: null,
      });
    }
    const g = groups.get(key);
    g.total += 1;
    if (isOpenStatus(r.status)) g.open += 1;
    if (isRegression(r)) g.regressions += 1;
    g.maxSeverity = Math.max(g.maxSeverity, severityRank(r));
    g.impact += impactScore(r);
    // Keep the freshest source ref for the area.
    const t = ms(r.created_at);
    if (t != null && (g.lastSeen == null || t > ms(g.lastSeen))) {
      g.lastSeen = r.created_at;
      if (r.source_file) {
        g.sourceFile = r.source_file;
        g.sourceLine = r.source_line ?? null;
      }
    }
  }
  const now_ = now;
  const scored = Array.from(groups.values()).map((g) => {
    // Recency multiplier: areas active in the last 7d weigh more than stale ones.
    const ageDays = g.lastSeen != null ? Math.max(0, (now_ - ms(g.lastSeen)) / DAY_MS) : 30;
    const recency = ageDays <= 7 ? 1 : ageDays <= 30 ? 0.6 : 0.3;
    const score = Number(
      (g.impact + g.open * 2 + g.regressions * 4 + g.maxSeverity * 2) * recency
    ).toFixed(3) * 1;
    return { ...g, score };
  });
  scored.sort((a, b) => b.score - a.score || b.total - a.total);
  return scored.slice(0, Math.max(1, limit));
}

// ---------------------------------------------------------------------------
// Incident clustering — group reports sharing a canonical fingerprint (the same
// underlying incident recurring). Complements adminView.groupDuplicates by
// returning CLUSTER objects (not annotated rows) for a cluster-first dashboard.
// ---------------------------------------------------------------------------
export function clusterIncidents(reports = [], { limit = 20 } = {}) {
  const clusters = new Map();
  for (const r of arr(reports)) {
    const key = fingerprintKey(r);
    if (!key) continue;
    if (!clusters.has(key)) {
      clusters.set(key, {
        key,
        count: 0,
        open: 0,
        regression: false,
        maxSeverity: 0,
        routes: new Set(),
        versions: new Set(),
        reportIds: [],
        firstSeen: null,
        lastSeen: null,
        sample: null,
      });
    }
    const c = clusters.get(key);
    c.count += 1;
    if (isOpenStatus(r.status)) c.open += 1;
    if (isRegression(r)) c.regression = true;
    c.maxSeverity = Math.max(c.maxSeverity, severityRank(r));
    if (r.route) c.routes.add(String(r.route).split("?")[0]);
    if (r.app_version) c.versions.add(r.app_version);
    c.reportIds.push(r.id);
    const t = ms(r.created_at);
    if (t != null) {
      if (c.firstSeen == null || t < ms(c.firstSeen)) c.firstSeen = r.created_at;
      if (c.lastSeen == null || t > ms(c.lastSeen)) {
        c.lastSeen = r.created_at;
        c.sample = { id: r.id, title: r.title || r.description || "", route: r.route || null };
      }
    }
    if (!c.sample) c.sample = { id: r.id, title: r.title || r.description || "", route: r.route || null };
  }
  return Array.from(clusters.values())
    .filter((c) => c.count > 1) // a cluster is a RECURRENCE
    .map((c) => ({
      key: c.key,
      count: c.count,
      open: c.open,
      regression: c.regression,
      maxSeverity: c.maxSeverity,
      routes: Array.from(c.routes),
      versions: Array.from(c.versions),
      reportIds: c.reportIds,
      firstSeen: c.firstSeen,
      lastSeen: c.lastSeen,
      sample: c.sample,
    }))
    .sort((a, b) => b.count - a.count || b.maxSeverity - a.maxSeverity)
    .slice(0, Math.max(1, limit));
}

// ---------------------------------------------------------------------------
// Predictive insights — flag problem areas whose report volume is RISING (the
// recent window vs the prior window), so a recurring issue is surfaced BEFORE it
// becomes a larger incident. Deterministic (clock injected).
// ---------------------------------------------------------------------------
export function predictiveInsights(reports = [], { now = Date.now(), windowDays = 7, minPrior = 1 } = {}) {
  const w = Math.max(1, windowDays) * DAY_MS;
  const recentStart = now - w;
  const priorStart = now - 2 * w;
  const groups = new Map();
  for (const r of arr(reports)) {
    const t = ms(r.created_at);
    if (t == null || t < priorStart) continue;
    const key = areaKey(r);
    if (!groups.has(key)) groups.set(key, { key, route: r.route || null, sectionKey: r.section_key || null, recent: 0, prior: 0, openRecent: 0 });
    const g = groups.get(key);
    if (t >= recentStart) {
      g.recent += 1;
      if (isOpenStatus(r.status)) g.openRecent += 1;
    } else if (t >= priorStart) {
      g.prior += 1;
    }
  }
  const insights = [];
  for (const g of groups.values()) {
    // Rising = recent strictly exceeds prior AND there is a real recent signal.
    if (g.recent >= 2 && g.recent > g.prior) {
      const delta = g.recent - g.prior;
      const ratio = g.prior >= minPrior ? Number((g.recent / g.prior).toFixed(2)) : null;
      insights.push({
        key: g.key,
        route: g.route,
        sectionKey: g.sectionKey,
        recent: g.recent,
        prior: g.prior,
        openRecent: g.openRecent,
        delta,
        ratio,
        severity: delta >= 4 || (ratio && ratio >= 3) ? "high" : "medium",
        message:
          `${g.route || g.key} is trending up: ${g.recent} report(s) in the last ${windowDays}d ` +
          `vs ${g.prior} in the prior ${windowDays}d` +
          (ratio ? ` (${ratio}×).` : "."),
      });
    }
  }
  return insights.sort((a, b) => b.delta - a.delta || b.recent - a.recent);
}

// ---------------------------------------------------------------------------
// build — compose the whole intelligence payload the API returns / the dashboard
// renders in one call.
// ---------------------------------------------------------------------------
export function buildIntelligence(reports = [], { now = Date.now(), trendDays = 14 } = {}) {
  return {
    generatedAt: new Date(now).toISOString(),
    reportCount: arr(reports).length,
    rollup: rollup(reports),
    trend: trendSeries(reports, { now, days: trendDays }),
    problemAreas: problemAreas(reports, { now }),
    clusters: clusterIncidents(reports),
    predictions: predictiveInsights(reports, { now }),
  };
}
