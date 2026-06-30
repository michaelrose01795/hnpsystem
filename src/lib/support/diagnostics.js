// file location: src/lib/support/diagnostics.js
//
// Phase 2 — client runtime capture for the Help & Diagnostics ("support")
// feature. Maintains small, capped ring buffers of recent diagnostic signals
// (console errors, unhandled errors, failed requests, recent actions) plus
// on-demand snapshots (route, device, session, feature flags, code ownership),
// then assembles them into a single sanitised bundle for a support report.
//
// Design:
//   - The buffer + assembly logic is PURE and dependency-injected (no globals)
//     so it runs identically in Node and the browser and is unit-testable.
//   - The browser wiring (console patch, window listeners, fetch wrap, click
//     listener) lives in installBrowserCapture() and is the ONLY part that
//     touches window/document. It always calls through to existing handlers
//     so it coexists with the console/fetch/nav diagnostics already in _app.js.
//   - Everything captured is scrubbed at record time AND again at capture time
//     via the shared sanitiser (src/lib/support/sanitise.js).

import { sanitiseDiagnostics, scrubString } from "@/lib/support/sanitise";
import { findDevLayoutSectionSources } from "@/lib/dev-layout/sectionSourceMap";

// Buffer caps — small on purpose (cheap, bounded memory, never persisted unless
// a report is filed). See plan §6.
export const BUFFER_LIMITS = Object.freeze({
  console: 25,
  errors: 25,
  requests: 25,
  actions: 30,
});

// Only these session fields ever leave the browser (allowlist, not denylist).
export const SESSION_ALLOWLIST = Object.freeze(["authStatus", "roles", "dbUserId", "isDevLogin"]);

// Only these feature flags are captured. NEXT_PUBLIC_* + derived runtime flags.
export const FLAG_ALLOWLIST = Object.freeze(["NEXT_PUBLIC_DEV_AUTH_BYPASS", "presentationMode"]);

const MAX_STRING = 2000;
const MAX_STACK = 4000;

const clampString = (value, max) => {
  const s = typeof value === "string" ? value : String(value ?? "");
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

// Stringify a console argument without throwing on cyclic/large structures.
const safeArg = (arg) => {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
};

// ---------------------------------------------------------------------------
// Ring buffer
// ---------------------------------------------------------------------------
export function createRingBuffer(max) {
  const limit = Number.isInteger(max) && max > 0 ? max : 25;
  let items = [];
  return {
    push(item) {
      items.push(item);
      if (items.length > limit) items = items.slice(items.length - limit);
    },
    toArray() {
      return items.slice();
    },
    clear() {
      items = [];
    },
    get size() {
      return items.length;
    },
    get limit() {
      return limit;
    },
  };
}

/**
 * Create an in-memory diagnostics store (the four ring buffers).
 * @param {object} [limits]
 */
export function createDiagnosticsStore(limits = BUFFER_LIMITS) {
  return {
    console: createRingBuffer(limits.console),
    errors: createRingBuffer(limits.errors),
    requests: createRingBuffer(limits.requests),
    actions: createRingBuffer(limits.actions),
  };
}

// ---------------------------------------------------------------------------
// Record helpers — each scrubs immediately so secrets never sit in memory.
// `ts` is injected by the caller (provider passes Date.now()) to keep these pure.
// ---------------------------------------------------------------------------
export function recordConsole(store, { level = "error", args = [], ts } = {}) {
  const msg = scrubString((args || []).map(safeArg).join(" "));
  store.console.push({ level, msg: clampString(msg, MAX_STRING), ts });
}

export function recordError(store, { message, stack, componentStack, ts } = {}) {
  store.errors.push({
    message: clampString(scrubString(String(message ?? "")), MAX_STRING),
    stack: stack ? clampString(scrubString(String(stack)), MAX_STACK) : undefined,
    componentStack: componentStack
      ? clampString(scrubString(String(componentStack)), MAX_STACK)
      : undefined,
    ts,
  });
}

// Keep path + (scrubbed) query only — never the body. Absolute URLs are reduced
// to pathname+search so we don't log auth in subdomains etc.
const reduceUrl = (url) => {
  const raw = String(url ?? "");
  try {
    const parsed = new URL(raw, "http://local");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return raw;
  }
};

export function recordFailedRequest(store, { method = "GET", url, status, ms, ts } = {}) {
  store.requests.push({
    method: String(method || "GET").toUpperCase().slice(0, 10),
    url: clampString(scrubString(reduceUrl(url)), 500),
    status: Number.isFinite(status) ? status : null,
    ms: Number.isFinite(ms) ? Math.round(ms) : null,
    ts,
  });
}

export function recordAction(store, action = {}) {
  const base = { type: String(action.type || "action").slice(0, 40), ts: action.ts };
  if (action.type === "route_change") {
    store.actions.push({
      ...base,
      from: clampString(scrubString(reduceUrl(action.from)), 300),
      to: clampString(scrubString(reduceUrl(action.to)), 300),
    });
    return;
  }
  // click / generic
  store.actions.push({
    ...base,
    label: action.label ? clampString(scrubString(String(action.label)), 120) : undefined,
    sectionKey: action.sectionKey ? clampString(String(action.sectionKey), 200) : undefined,
  });
}

// ---------------------------------------------------------------------------
// Code ownership resolution via the dev-layout source map.
// ---------------------------------------------------------------------------
/**
 * Resolve a section key to its owning source file/line (best match wins).
 * @param {string} sectionKey
 * @returns {{ section_key: string, file?: string, line?: number|null } | null}
 */
export function resolveCodeOwnership(sectionKey) {
  const key = String(sectionKey || "");
  if (!key) return null;
  const matches = findDevLayoutSectionSources(key);
  const best = matches && matches[0];
  if (!best) return { section_key: key };
  return {
    section_key: key,
    file: best.file || undefined,
    line: Number.isFinite(best.line) ? best.line : null,
  };
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------
const pickAllowed = (source, allowlist) => {
  const out = {};
  if (!source || typeof source !== "object") return out;
  for (const key of allowlist) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
};

/**
 * Snapshot device/viewport info. `win` is injectable for tests.
 * @param {Window} [win]
 */
export function snapshotDevice(win = typeof window !== "undefined" ? window : undefined) {
  if (!win) return {};
  const nav = win.navigator || {};
  return {
    ua: nav.userAgent || undefined,
    platform: nav.platform || undefined,
    lang: nav.language || undefined,
    online: typeof nav.onLine === "boolean" ? nav.onLine : undefined,
    viewport: { w: win.innerWidth || null, h: win.innerHeight || null },
    dpr: win.devicePixelRatio || null,
    isMobile: typeof win.matchMedia === "function" ? win.matchMedia("(max-width: 640px)").matches : undefined,
  };
}

// ---------------------------------------------------------------------------
// Capture — assemble the full bundle then run the shared sanitiser over it.
// All dynamic inputs are passed in via `context` so this stays pure/testable.
// ---------------------------------------------------------------------------
/**
 * @param {ReturnType<typeof createDiagnosticsStore>} store
 * @param {{
 *   route?: object, sectionKey?: string, session?: object, flags?: object,
 *   device?: object, build?: object, capturedAt?: string
 * }} [context]
 * @returns {object} sanitised diagnostics bundle
 */
export function captureDiagnostics(store, context = {}) {
  const bundle = {
    captured_at: context.capturedAt,
    route: context.route || undefined,
    code_ownership: context.sectionKey ? resolveCodeOwnership(context.sectionKey) : undefined,
    device: context.device || undefined,
    session: pickAllowed(context.session, SESSION_ALLOWLIST),
    feature_flags: pickAllowed(context.flags, FLAG_ALLOWLIST),
    build: context.build || undefined,
    console_errors: store?.console?.toArray?.() || [],
    failed_requests: store?.requests?.toArray?.() || [],
    recent_actions: store?.actions?.toArray?.() || [],
    unhandled_errors: store?.errors?.toArray?.() || [],
  };
  // Defence in depth: the buffers already scrubbed, but re-run the full
  // sanitiser over the assembled object (and drop undefineds via JSON).
  return sanitiseDiagnostics(bundle);
}

// ---------------------------------------------------------------------------
// Browser wiring — the only part that touches window/document. Returns an
// uninstall function. Always calls through to existing handlers.
// ---------------------------------------------------------------------------
/**
 * Install console/error/fetch/click capture into the browser.
 * @param {ReturnType<typeof createDiagnosticsStore>} store
 * @param {{ now?: () => number }} [opts]
 * @returns {() => void} uninstall
 */
export function installBrowserCapture(store, opts = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const cleanups = [];

  // --- console.error / console.warn (preserve + call through) ---
  for (const level of ["error", "warn"]) {
    const original = window.console?.[level];
    if (typeof original !== "function") continue;
    const patched = (...args) => {
      try {
        recordConsole(store, { level, args, ts: now() });
      } catch {
        // never let capture break logging
      }
      return original.apply(window.console, args);
    };
    window.console[level] = patched;
    cleanups.push(() => {
      // Only restore if no one else re-patched on top of us.
      if (window.console[level] === patched) window.console[level] = original;
    });
  }

  // --- window error + unhandledrejection ---
  const onError = (event) => {
    recordError(store, {
      message: event?.message || event?.error?.message,
      stack: event?.error?.stack,
      ts: now(),
    });
  };
  const onRejection = (event) => {
    const reason = event?.reason;
    recordError(store, {
      message: reason?.message || String(reason ?? "unhandledrejection"),
      stack: reason?.stack,
      ts: now(),
    });
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  cleanups.push(() => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  });

  // --- fetch wrap (record non-2xx + network failures only; no bodies) ---
  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    const patchedFetch = async (...args) => {
      const start = now();
      const method = args?.[1]?.method || args?.[0]?.method || "GET";
      const url = typeof args?.[0] === "string" ? args[0] : args?.[0]?.url;
      try {
        const res = await originalFetch.apply(window, args);
        if (res && res.status >= 400) {
          recordFailedRequest(store, { method, url, status: res.status, ms: now() - start, ts: start });
        }
        return res;
      } catch (err) {
        recordFailedRequest(store, { method, url, status: 0, ms: now() - start, ts: start });
        throw err;
      }
    };
    window.fetch = patchedFetch;
    cleanups.push(() => {
      if (window.fetch === patchedFetch) window.fetch = originalFetch;
    });
  }

  // --- click → nearest section key (recent actions) ---
  const onClick = (event) => {
    const el = event.target?.closest?.("[data-dev-section-key]");
    const sectionKey = el?.getAttribute?.("data-dev-section-key") || undefined;
    const labelSource = event.target?.closest?.("button, a, [role='button']") || event.target;
    const label =
      labelSource?.getAttribute?.("aria-label") ||
      (labelSource?.textContent || "").trim() ||
      undefined;
    if (!sectionKey && !label) return;
    recordAction(store, { type: "click", label, sectionKey, ts: now() });
  };
  document.addEventListener("click", onClick, true);
  cleanups.push(() => document.removeEventListener("click", onClick, true));

  return () => {
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        // ignore teardown errors
      }
    }
  };
}
