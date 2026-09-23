// file location: src/lib/support/autoErrorLog.js
//
// AUTOMATIC error capture for the in-app error experience.
//
// Everything the app catches is logged here — a render crash caught by a
// SupportErrorBoundary, a window runtime error or unhandled rejection, an API /
// data-load failure reported through reportError(), a permission denial, or a
// framework page error (404 / 500 / SSR). It is posted to
// /api/support/error-events and persisted, WHETHER OR NOT the user goes on to
// press "Report a problem".
//
// Relationship to the rest of the support stack:
//   • diagnostics.js ring buffers  — rich, in-memory, sent only with a report.
//   • diagnosticsLog.js            — in-memory, dev-console tracing by code.
//   • THIS module                  — the durable trail, keyed by the same short
//                                    reference code the user sees on screen, so
//                                    a staff member quoting "ERR-K3F9Q2" is
//                                    traceable even if they never file a report.
//
// Design constraints:
//   • Capture must never break the thing it observes. Every path is wrapped and
//     failures are swallowed — a failed log is not an error the user hears about.
//   • It must never recurse. Posting the log itself goes through the raw fetch
//     captured at module load, and /api/support/error-events is on the ignore
//     list, so a failing log endpoint cannot log itself in a loop.
//   • It is client-side de-duplicated on fingerprint before the network call, so
//     a render loop costs one request, not hundreds. (The server collapses too.)
//   • It is fire-and-forget with `keepalive`, so an error immediately before a
//     navigation or reload still gets through.

import { stableHash } from "@/lib/support/incidentClustering";
import { readBuildInfo } from "@/lib/support/buildInfo";

export const ERROR_EVENTS_ENDPOINT = "/api/support/error-events";

// Failure kinds — mirrors the CHECK constraint on support_error_events.kind.
export const ERROR_KINDS = Object.freeze({
  RENDER: "render",
  RUNTIME: "runtime",
  UNHANDLED_REJECTION: "unhandled_rejection",
  API: "api",
  DATA_LOAD: "data_load",
  PERMISSION: "permission",
  PAGE: "page",
  CONSOLE: "console",
  OTHER: "other",
});

// Client-side de-duplication window. A repeat of the same fingerprint inside
// this window is dropped before it reaches the network.
const DEDUPE_WINDOW_MS = 60 * 1000;

// Hard ceiling on posts per page-load, so a pathological loop that somehow
// produces a fresh fingerprint each time still cannot flood the endpoint.
const MAX_EVENTS_PER_SESSION = 40;

// Endpoints that must never be logged, or capture would feed itself.
const IGNORED_ENDPOINTS = [ERROR_EVENTS_ENDPOINT, "/api/support/reports"];

// The unpatched fetch, captured at module load — before installBrowserCapture()
// wraps window.fetch. Posting through the wrapped fetch would record our own
// request as a failed request when the endpoint is down.
const rawFetch =
  typeof window !== "undefined" && typeof window.fetch === "function"
    ? window.fetch.bind(window)
    : null;

// fingerprint → last posted timestamp.
const recentlyPosted = new Map();
let postedThisSession = 0;

/** Reset the module's in-memory de-duplication state (tests / hard navigation). */
export function resetAutoErrorLog() {
  recentlyPosted.clear();
  postedThisSession = 0;
}

/**
 * Normalise a message so cosmetically different repeats of the same failure
 * share a fingerprint: strip ids, uuids, numbers, quoted values and hex blobs.
 * @param {string} message
 * @returns {string}
 */
export function normaliseMessage(message) {
  return String(message || "")
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>")
    .replace(/0x[0-9a-f]+/g, "<hex>")
    .replace(/\d+/g, "<n>")
    .replace(/["'`][^"'`]{0,80}["'`]/g, "<str>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/**
 * Collapse a route to a shape that groups dynamic segments together, so
 * /job-cards/12345 and /job-cards/67890 fingerprint identically.
 * @param {string} route
 * @returns {string}
 */
export function normaliseRoute(route) {
  return (
    String(route || "")
      .split("?")[0]
      .split("#")[0]
      // UUIDs FIRST. A uuid starts with hex that may begin with digits, so the
      // numeric rule below would otherwise eat its leading characters and leave
      // the rest of the uuid intact — defeating the grouping entirely.
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/<uuid>")
      .replace(/\/\d+/g, "/<id>")
      .slice(0, 200)
  );
}

/**
 * The grouping key for a failure. Same kind + same normalised message + same
 * route shape + same component = the same incident.
 * @param {{ kind?: string, message?: string, route?: string, component?: string, statusCode?: number }} input
 * @returns {string}
 */
export function buildEventFingerprint({ kind, message, route, component, statusCode } = {}) {
  return stableHash(
    [
      kind || ERROR_KINDS.RUNTIME,
      normaliseMessage(message),
      normaliseRoute(route),
      component || "",
      statusCode == null ? "" : String(statusCode),
    ].join("|")
  );
}

/** Browser / device facts a developer needs to reproduce. No identifiers. */
function snapshotBrowser() {
  if (typeof window === "undefined") return {};
  const nav = window.navigator || {};
  const screen = window.screen || {};
  return {
    language: nav.language || null,
    platform: nav.userAgentData?.platform || nav.platform || null,
    mobile: nav.userAgentData?.mobile ?? null,
    online: nav.onLine ?? null,
    viewport: { w: window.innerWidth || null, h: window.innerHeight || null },
    screen: { w: screen.width || null, h: screen.height || null, dpr: window.devicePixelRatio || null },
    timezone: (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      } catch {
        return null;
      }
    })(),
  };
}

/**
 * The deployment/build reference for the running bundle — resolved from the
 * same inlined env vars the support report uses, so an auto-logged event and a
 * user-filed report agree about which build produced them.
 */
function snapshotBuild() {
  try {
    const build = readBuildInfo(process.env) || {};
    return {
      appVersion: build.appVersion || build.version || null,
      commitSha: build.commitSha || null,
      commitRef: build.commitRef || null,
      buildId: build.buildId || null,
      deploymentEnv: build.deploymentEnv || build.env || null,
    };
  } catch {
    return {};
  }
}

/** Best-effort message for any thrown value. */
function messageOf(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error.message === "string" && error.message) return error.message;
  try {
    return String(error);
  } catch {
    return "";
  }
}

function shouldSkipEndpoint(context) {
  const endpoint = context?.endpoint || context?.url;
  if (typeof endpoint !== "string") return false;
  return IGNORED_ENDPOINTS.some((ignored) => endpoint.includes(ignored));
}

/**
 * Record one caught error to the durable trail. Fire-and-forget: returns the
 * fingerprint it used (or null when the event was suppressed), never a promise
 * the caller has to handle, and never throws.
 *
 * @param {object} input
 * @param {string} [input.kind]           One of ERROR_KINDS. Default "runtime".
 * @param {unknown} [input.error]         The caught value — message/stack read from it.
 * @param {string} [input.message]        Overrides the message read from `error`.
 * @param {string} [input.referenceCode]  The code shown on screen ("ERR-…").
 * @param {string} [input.componentStack] React component stack (render crashes).
 * @param {string} [input.component]      Top component name.
 * @param {string} [input.boundaryLevel]  app | route | section.
 * @param {string} [input.variant]        staff | customer.
 * @param {string} [input.route]          Defaults to the current location.
 * @param {string} [input.sectionKey]
 * @param {number} [input.statusCode]     HTTP status, for API failures.
 * @param {object} [input.context]        Extra dev context (endpoint, ids…).
 * @returns {string|null} the fingerprint posted, or null when suppressed.
 */
export function logErrorEvent(input = {}) {
  try {
    if (typeof window === "undefined") return null;
    if (postedThisSession >= MAX_EVENTS_PER_SESSION) return null;
    if (shouldSkipEndpoint(input.context)) return null;

    const kind = input.kind || ERROR_KINDS.RUNTIME;
    const message = input.message || messageOf(input.error);
    const route =
      input.route || `${window.location?.pathname || ""}${window.location?.search || ""}`;
    const stack = typeof input.error?.stack === "string" ? input.error.stack : input.stack || null;

    const fingerprint = buildEventFingerprint({
      kind,
      message,
      route,
      component: input.component,
      statusCode: input.statusCode,
    });

    // Client-side de-duplication — a loop costs one request.
    const now = Date.now();
    for (const [key, ts] of recentlyPosted) {
      if (now - ts > DEDUPE_WINDOW_MS) recentlyPosted.delete(key);
    }
    if (recentlyPosted.has(fingerprint)) return null;
    recentlyPosted.set(fingerprint, now);
    postedThisSession += 1;

    const build = snapshotBuild();
    const payload = {
      kind,
      referenceCode: input.referenceCode || null,
      fingerprint,
      message,
      stack,
      componentStack: input.componentStack || null,
      component: input.component || null,
      boundaryLevel: input.boundaryLevel || null,
      variant: input.variant || null,
      route,
      sectionKey: input.sectionKey || null,
      statusCode: Number.isInteger(input.statusCode) ? input.statusCode : null,
      device: snapshotBrowser(),
      context: input.context || {},
      ...build,
    };

    postEvent(payload);
    return fingerprint;
  } catch {
    // Capture must never break the thing it observes.
    return null;
  }
}

/**
 * POST the event. `keepalive` so an error that happens immediately before a
 * navigation or reload still reaches the server. Uses the fetch captured at
 * module load so the diagnostics fetch-wrapper never sees this request.
 */
function postEvent(payload) {
  try {
    const body = JSON.stringify(payload);

    if (rawFetch) {
      rawFetch(ERROR_EVENTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        credentials: "same-origin",
      }).catch(() => {
        // Endpoint unreachable — the in-memory diagnostics still hold the detail
        // and the user's on-screen recovery is unaffected.
      });
      return;
    }

    // No fetch at all (very old browser): sendBeacon is the last resort.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(ERROR_EVENTS_ENDPOINT, new Blob([body], { type: "application/json" }));
    }
  } catch {
    // Swallowed by design.
  }
}
