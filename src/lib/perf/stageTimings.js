// file location: src/lib/perf/stageTimings.js
//
// Client-side stage timing for the journeys that matter to a user:
//
//   URL -> login screen        cold document load
//   login -> usable app        credential submit through to the shell being usable
//   page -> page               client-side navigation
//   job card open              route change through to the card's data being on screen
//
// Each journey is broken into parts that map onto different fixes, so a
// regression can be attributed rather than guessed at:
//
//   network   TTFB of the document (responseStart - requestStart)
//   html      document download + parse to domInteractive
//   js        script fetch/eval before React runs
//   hydrate   React attaching to the server-rendered markup
//   shell     the app shell (session -> user -> sidebar access) becoming ready
//   data      the route's own data arriving
//   api.*     per-endpoint TTFB, split into db/app from the Server-Timing header
//
// Always collected (it is a handful of numbers from APIs the browser already
// populates), never sent anywhere on its own. Read it with:
//
//   hnpPerf()        summary table for the current page
//   hnpPerf.raw()    every recorded mark
//   hnpPerf.clear()
//
// In development the summary also prints automatically once a journey settles.

const isBrowser = () => typeof window !== "undefined";
const IS_DEV = process.env.NODE_ENV !== "production";

const nowMs = () =>
  isBrowser() && typeof performance?.now === "function" ? performance.now() : Date.now();

const store = () => {
  if (!isBrowser()) return null;
  if (!window.__hnpPerfStore) {
    window.__hnpPerfStore = { marks: [], journey: null, journeyStart: 0 };
  }
  return window.__hnpPerfStore;
};

/** Begin a named journey. Subsequent stage() calls are timed relative to it. */
export function startJourney(name) {
  const s = store();
  if (!s) return;
  s.journey = name;
  s.journeyStart = nowMs();
  s.marks.push({ journey: name, stage: "start", at: 0, ts: Date.now() });
}

/** Record a stage completing within the current journey. */
export function stage(name, detail) {
  const s = store();
  if (!s) return;
  const at = s.journeyStart ? nowMs() - s.journeyStart : nowMs();
  s.marks.push({ journey: s.journey, stage: name, at: Math.round(at), detail, ts: Date.now() });
  if (IS_DEV && typeof performance?.mark === "function") {
    try { performance.mark(`hnp:${s.journey || "app"}:${name}`); } catch { /* ignore */ }
  }
}

/** Time an awaited operation and record it as a stage. */
export async function timed(name, fn) {
  const t0 = nowMs();
  try {
    return await fn();
  } finally {
    stage(name, { ms: Math.round(nowMs() - t0) });
  }
}

// --- document-load breakdown -------------------------------------------------
function navigationBreakdown() {
  if (!isBrowser() || typeof performance?.getEntriesByType !== "function") return null;
  const nav = performance.getEntriesByType("navigation")[0];
  if (!nav) return null;
  return {
    redirect: Math.round(nav.redirectEnd - nav.redirectStart),
    dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
    tcp: Math.round(nav.connectEnd - nav.connectStart),
    ttfb: Math.round(nav.responseStart - nav.requestStart),
    download: Math.round(nav.responseEnd - nav.responseStart),
    domInteractive: Math.round(nav.domInteractive),
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
    load: Math.round(nav.loadEventEnd || 0),
    type: nav.type,
  };
}

// --- API breakdown from Server-Timing ---------------------------------------
function apiBreakdown(sinceMs = 0) {
  if (!isBrowser() || typeof performance?.getEntriesByType !== "function") return [];
  return performance
    .getEntriesByType("resource")
    .filter((e) => e.startTime >= sinceMs && e.name.includes("/api/"))
    .map((e) => {
      const st = Array.isArray(e.serverTiming) ? e.serverTiming : [];
      const pick = (n) => st.find((x) => x.name === n)?.duration ?? null;
      return {
        url: e.name.replace(window.location.origin, ""),
        total: Math.round(e.duration),
        ttfb: Math.round(e.responseStart ? e.responseStart - e.requestStart : 0),
        db: pick("db") == null ? null : Math.round(pick("db")),
        app: pick("app") == null ? null : Math.round(pick("app")),
        transferKB: e.transferSize ? Math.round(e.transferSize / 1024) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

// --- script weight actually fetched -----------------------------------------
function scriptBreakdown() {
  if (!isBrowser() || typeof performance?.getEntriesByType !== "function") return null;
  const scripts = performance.getEntriesByType("resource").filter((e) => e.initiatorType === "script");
  const bytes = scripts.reduce((n, e) => n + (e.encodedBodySize || 0), 0);
  const last = scripts.reduce((m, e) => Math.max(m, e.responseEnd), 0);
  return { count: scripts.length, transferKB: Math.round(bytes / 1024), lastFinishedAt: Math.round(last) };
}

export function summary() {
  const s = store();
  if (!s) return null;
  return {
    journey: s.journey,
    stages: s.marks.filter((m) => m.stage !== "start"),
    navigation: navigationBreakdown(),
    scripts: scriptBreakdown(),
    api: apiBreakdown(),
  };
}

// --- console surface ---------------------------------------------------------
export function installPerfConsole() {
  if (!isBrowser() || window.hnpPerf) return;
  const fn = () => {
    const data = summary();
    if (!data) return "no timings yet";
    const native = globalThis.__HNP_NATIVE_CONSOLE__ || console;
    // Plain label: no colour literals. `npm run check:design` (correctly) treats
    // any hex in src/ as staff UI colour that should come from a theme token,
    // and console styling is not worth an exception.
    native.log(`[PERF] ${data.journey || "page"}`);
    if (data.navigation) native.table([data.navigation]);
    if (data.stages.length) native.table(data.stages.map(({ stage: st, at, detail }) => ({ stage: st, atMs: at, ...(detail || {}) })));
    if (data.scripts) native.table([data.scripts]);
    if (data.api.length) native.table(data.api);
    return `${data.api.length} API calls · copy(hnpPerf.raw()) for the full record`;
  };
  fn.raw = summary;
  fn.clear = () => {
    const s = store();
    if (s) { s.marks = []; s.journey = null; s.journeyStart = 0; }
    return "cleared";
  };
  window.hnpPerf = fn;
  if (IS_DEV) {
    const native = globalThis.__HNP_NATIVE_CONSOLE__ || console;
    native.log("[PERF] run hnpPerf() for a stage breakdown");
  }
}

const stageTimings = { startJourney, stage, timed, summary, installPerfConsole };
export default stageTimings;
