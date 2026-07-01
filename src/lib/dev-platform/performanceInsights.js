// file location: src/lib/dev-platform/performanceInsights.js
//
// Phase 9 — Developer Platform performance profiling + API/DB request tracing.
// PURE, node-testable aggregation over a single SANITISED diagnostics snapshot
// (the exact bundle Live Ops already polls via captureDiagnostics()) — so it
// introduces NO new capture path and NO new privacy surface: it reads only the
// already-scrubbed failed_requests (method + path + status + duration, NEVER
// bodies), recent_actions, and the dev-metadata provider's timing/memory/network
// figures. Everything here is names + durations only, sanitiser-clean.
//
// No React, no I/O, no window. `now` is injected for determinism.

const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const stripQuery = (u) => String(u || "").split("?")[0];

const statusTone = (status) => {
  const s = Number(status) || 0;
  if (s >= 500) return "danger-base";
  if (s >= 400) return "warning-base";
  return "text-1";
};

// Reduce a request to a stable endpoint key: METHOD /path (querystring dropped).
export function endpointKey(req = {}) {
  return `${String(req.method || "GET").toUpperCase()} ${stripQuery(req.url)}`;
}

// ---------------------------------------------------------------------------
// Endpoint stats — group the captured (non-2xx) requests by endpoint, with count,
// status breakdown, and duration figures. Captured requests are failures by
// design (Phase 2 logs only non-2xx, no bodies), so this is the "failing / slow
// endpoints" table.
// ---------------------------------------------------------------------------
export function endpointStats(snapshot = {}) {
  const requests = arr(snapshot.failed_requests);
  const groups = new Map();
  for (const r of requests) {
    const key = endpointKey(r);
    if (!groups.has(key)) groups.set(key, { endpoint: key, method: String(r.method || "GET").toUpperCase(), path: stripQuery(r.url), count: 0, statuses: {}, durations: [], maxMs: 0 });
    const g = groups.get(key);
    g.count += 1;
    const st = r.status || "err";
    g.statuses[st] = (g.statuses[st] || 0) + 1;
    const d = num(r.ms);
    if (d != null) {
      g.durations.push(d);
      g.maxMs = Math.max(g.maxMs, d);
    }
  }
  return Array.from(groups.values())
    .map((g) => ({
      endpoint: g.endpoint,
      method: g.method,
      path: g.path,
      count: g.count,
      statuses: g.statuses,
      avgMs: g.durations.length ? Math.round(g.durations.reduce((a, b) => a + b, 0) / g.durations.length) : null,
      maxMs: g.durations.length ? g.maxMs : null,
      serverErrors: Object.entries(g.statuses).filter(([s]) => Number(s) >= 500).reduce((a, [, c]) => a + c, 0),
    }))
    .sort((a, b) => b.count - a.count || (b.maxMs || 0) - (a.maxMs || 0));
}

// ---------------------------------------------------------------------------
// Request timeline — the captured requests as a time-ordered trace (newest last),
// each with a tone by status class. This is the "API request timeline" surface.
// ---------------------------------------------------------------------------
export function requestTimeline(snapshot = {}, { limit = 50 } = {}) {
  return arr(snapshot.failed_requests)
    .map((r) => ({
      ts: r.ts || null,
      method: String(r.method || "GET").toUpperCase(),
      path: stripQuery(r.url),
      status: r.status ?? null,
      ms: num(r.ms),
      tone: statusTone(r.status),
    }))
    .sort((a, b) => (Date.parse(a.ts) || 0) - (Date.parse(b.ts) || 0))
    .slice(-Math.max(1, limit));
}

// ---------------------------------------------------------------------------
// Execution flow — the recent_actions buffer as an ordered flow (route changes +
// interactions) with the gap (ms) between consecutive steps, so a developer can
// see the path that led to an incident. No values — action types + section keys
// only (already sanitised).
// ---------------------------------------------------------------------------
export function executionFlow(snapshot = {}, { limit = 40 } = {}) {
  const actions = arr(snapshot.recent_actions)
    .slice()
    .sort((a, b) => (Date.parse(a.ts) || 0) - (Date.parse(b.ts) || 0));
  return actions.slice(-Math.max(1, limit)).map((a, i, list) => {
    const prev = list[i - 1];
    const gapMs = prev && a.ts && prev.ts ? Math.max(0, (Date.parse(a.ts) || 0) - (Date.parse(prev.ts) || 0)) : null;
    return {
      ts: a.ts || null,
      kind: a.type || "action",
      label: a.type === "route_change" ? `→ ${a.to || "?"}` : a.label || a.type || "interaction",
      sectionKey: a.sectionKey || null,
      gapMs,
    };
  });
}

// ---------------------------------------------------------------------------
// Perf metrics — pull the dev-metadata provider's page-timing / memory / network
// figures into a flat, chart-ready shape. Returns null figures when the provider
// did not run (e.g. non-dev capture) rather than throwing.
// ---------------------------------------------------------------------------
export function perfMetrics(snapshot = {}) {
  const dm = snapshot?.providers?.["dev-metadata"] || {};
  const timing = dm.performance || {};
  const memory = dm.memory || {};
  return {
    ttfbMs: num(timing.ttfbMs),
    domReadyMs: num(timing.domReadyMs),
    loadMs: num(timing.loadMs),
    memoryUsedMb: num(memory.usedMb),
    memoryPressure: num(memory.pressure),
    network: dm.network || null,
    recentRouteChanges: num(dm.recentRouteChanges) || 0,
    repeatedApiFailures: arr(dm.repeatedApiFailures),
  };
}

// ---------------------------------------------------------------------------
// build — compose the whole performance profile from one snapshot.
// ---------------------------------------------------------------------------
export function buildPerformanceProfile(snapshot = {}, { now = Date.now() } = {}) {
  const endpoints = endpointStats(snapshot);
  return {
    generatedAt: new Date(now).toISOString(),
    metrics: perfMetrics(snapshot),
    endpoints,
    endpointCount: endpoints.length,
    requestTimeline: requestTimeline(snapshot),
    executionFlow: executionFlow(snapshot),
    totalCapturedRequests: arr(snapshot.failed_requests).length,
  };
}
