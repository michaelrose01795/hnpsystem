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
//   hnpPerf()              summary table for the current page
//   hnpPerf.interactions() slowest interactions + long tasks (INP breakdown)
//   hnpPerf.raw()          every recorded mark
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

// --- interaction responsiveness (INP) ---------------------------------------
//
// INP is the 98th-percentile interaction latency, and it splits into three parts
// that need different fixes:
//
//   inputDelay    time before the handler runs — the main thread was busy
//   processing    the handler + the React render it triggers
//   presentation  time from handler end to the next paint — usually layout /
//                 style recalculation over a large tree
//
// A single number ("INP 480ms") cannot tell you which. This records every slow
// interaction with that breakdown plus the element that was interacted with, and
// separately records long tasks so a blocking script can be attributed.
const INTERACTION_BUDGET_MS = 200; // Google's "good" INP threshold
const MAX_RECORDS = 60;

function interactionStore() {
  if (!isBrowser()) return null;
  if (!window.__hnpInteractions) {
    window.__hnpInteractions = { events: [], longTasks: [], observing: false };
  }
  return window.__hnpInteractions;
}

const describeTarget = (node) => {
  if (!node || typeof node.tagName !== "string") return "(unknown)";
  const id = node.id ? `#${node.id}` : "";
  const section = node.closest?.("[data-dev-section-key]")?.getAttribute("data-dev-section-key");
  const cls = typeof node.className === "string" && node.className
    ? `.${node.className.trim().split(/\s+/).slice(0, 2).join(".")}`
    : "";
  const name = node.getAttribute?.("name") || node.getAttribute?.("aria-label") || "";
  return `${node.tagName.toLowerCase()}${id}${cls}${name ? `[${name}]` : ""}${section ? ` @${section}` : ""}`;
};

export function observeInteractions() {
  const s = interactionStore();
  if (!s || s.observing || typeof PerformanceObserver !== "function") return;
  s.observing = true;

  try {
    // `event` entries carry the full interaction timeline. durationThreshold
    // keeps the observer cheap — fast interactions are never reported.
    const eventObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.interactionId) continue; // ignore non-interaction events
        const inputDelay = Math.round(entry.processingStart - entry.startTime);
        const processing = Math.round(entry.processingEnd - entry.processingStart);
        const presentation = Math.round(entry.startTime + entry.duration - entry.processingEnd);
        s.events.push({
          type: entry.name,
          total: Math.round(entry.duration),
          inputDelay,
          processing,
          presentation,
          target: describeTarget(entry.target),
          route: window.location.pathname,
          at: Math.round(entry.startTime),
        });
        if (s.events.length > MAX_RECORDS) s.events.shift();
      }
    });
    eventObserver.observe({ type: "event", durationThreshold: 40, buffered: true });
  } catch {
    // `event` timing unsupported (Safari/Firefox) — long tasks below still work.
  }

  try {
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        s.longTasks.push({
          duration: Math.round(entry.duration),
          at: Math.round(entry.startTime),
          attribution: (entry.attribution || [])
            .map((a) => a.containerName || a.containerType || a.name)
            .filter(Boolean)
            .join(", "),
          route: window.location.pathname,
        });
        if (s.longTasks.length > MAX_RECORDS) s.longTasks.shift();
      }
    });
    longTaskObserver.observe({ type: "longtask", buffered: true });
  } catch {
    // longtask unsupported
  }
}

/** Worst interactions and long tasks recorded so far. */
export function interactions() {
  const s = interactionStore();
  if (!s) return null;
  const slow = s.events.filter((e) => e.total >= INTERACTION_BUDGET_MS);
  return {
    worst: [...s.events].sort((a, b) => b.total - a.total).slice(0, 15),
    overBudget: slow.length,
    recorded: s.events.length,
    longTasks: [...s.longTasks].sort((a, b) => b.duration - a.duration).slice(0, 15),
    longTaskTotalMs: s.longTasks.reduce((n, t) => n + t.duration, 0),
  };
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
  observeInteractions();
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
  fn.interactions = () => {
    const data = interactions();
    if (!data) return "no interaction data";
    const native = globalThis.__HNP_NATIVE_CONSOLE__ || console;
    native.log(`[PERF] interactions — ${data.overBudget} of ${data.recorded} over ${INTERACTION_BUDGET_MS}ms`);
    if (data.worst.length) native.table(data.worst);
    native.log(`[PERF] long tasks — ${data.longTasks.length} recorded, ${data.longTaskTotalMs}ms total`);
    if (data.longTasks.length) native.table(data.longTasks);
    return "inputDelay = main thread busy · processing = handler + render · presentation = paint";
  };
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

const stageTimings = { startJourney, stage, timed, summary, installPerfConsole, observeInteractions, interactions };
export default stageTimings;
