// file location: src/lib/support/providers/devMetadataProvider.js
//
// Built-in DEV-ONLY diagnostic provider — extra signals that help an engineer but
// are noise (or mild fingerprinting) for everyone else, so they are only attached
// when the capture context is `isDev`:
//   - browser performance timing (TTFB / DOM ready / load)
//   - memory pressure (Chrome's performance.memory, as a used/limit ratio)
//   - network quality (navigator.connection effectiveType / rtt / downlink)
//   - repeated API failures (same endpoint failing more than once)
//   - a coarse render/route-activity signal
//
// All browser objects arrive via the injected `win` / `store`, so the function is
// pure and node-testable. Everything returned is sanitised downstream.

const round = (n) => (Number.isFinite(n) ? Math.round(n) : null);

// Reduce a URL to method + path so repeated-failure grouping ignores querystrings.
const reqKey = (r) => {
  const url = String(r?.url || "");
  const path = url.split("?")[0];
  return `${String(r?.method || "GET").toUpperCase()} ${path}`;
};

function readPerformance(win) {
  const perf = win?.performance;
  if (!perf) return undefined;
  try {
    const nav = perf.getEntriesByType?.("navigation")?.[0];
    if (nav) {
      return {
        ttfbMs: round(nav.responseStart),
        domReadyMs: round(nav.domContentLoadedEventEnd),
        loadMs: round(nav.loadEventEnd),
      };
    }
    const t = perf.timing;
    if (t && t.navigationStart) {
      return {
        ttfbMs: round(t.responseStart - t.navigationStart),
        domReadyMs: round(t.domContentLoadedEventEnd - t.navigationStart),
        loadMs: round(t.loadEventEnd - t.navigationStart),
      };
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function readMemory(win) {
  const mem = win?.performance?.memory;
  if (!mem || !Number.isFinite(mem.usedJSHeapSize)) return undefined;
  const used = mem.usedJSHeapSize;
  const limit = mem.jsHeapSizeLimit || 0;
  return {
    usedMb: round(used / (1024 * 1024)),
    limitMb: limit ? round(limit / (1024 * 1024)) : null,
    pressure: limit ? Number((used / limit).toFixed(2)) : null,
  };
}

function readNetwork(win) {
  const c = win?.navigator?.connection;
  if (!c) return undefined;
  const net = {};
  if (c.effectiveType) net.effectiveType = String(c.effectiveType);
  if (Number.isFinite(c.downlink)) net.downlinkMbps = c.downlink;
  if (Number.isFinite(c.rtt)) net.rttMs = round(c.rtt);
  if (typeof c.saveData === "boolean") net.saveData = c.saveData;
  return Object.keys(net).length ? net : undefined;
}

function repeatedApiFailures(store) {
  const requests = store?.requests?.toArray?.() || [];
  const counts = new Map();
  for (const r of requests) {
    const k = reqKey(r);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

/**
 * @param {{ win?: object, store?: object }} context
 * @returns {object}
 */
export function collectDevMetadata({ win, store } = {}) {
  const out = {};

  const performance = readPerformance(win);
  if (performance) out.performance = performance;

  const memory = readMemory(win);
  if (memory) out.memory = memory;

  const network = readNetwork(win);
  if (network) out.network = network;

  const repeated = repeatedApiFailures(store);
  if (repeated.length) out.repeatedApiFailures = repeated;

  // Coarse activity signal: how many route changes are in the buffer (a proxy for
  // navigation/render churn — true per-component render counts would need
  // instrumentation we deliberately avoid here).
  const actions = store?.actions?.toArray?.() || [];
  const routeChanges = actions.filter((a) => a?.type === "route_change").length;
  if (routeChanges) out.recentRouteChanges = routeChanges;

  return out;
}

export const devMetadataProvider = {
  id: "dev-metadata",
  label: "Developer metadata",
  devOnly: true,
  collect: collectDevMetadata,
};

export default devMetadataProvider;
