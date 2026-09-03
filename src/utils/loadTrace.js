// file location: src/utils/loadTrace.js
//
// Diagnostic tracer for the login -> /newsfeed load sequence.
//
// OFF BY DEFAULT. It is a debug channel: nothing is printed and nothing is
// buffered until the channel is turned on, so an ordinary F12 stays clean.
//
//   hnpDebug("trace")   in the console, then reload
//   ?debug=trace        on the URL, for one visit
//
// Once on, it prints a timestamped timeline to the browser console and buffers
// every entry on `window.__hnpTrace`. The buffer is persisted to
// sessionStorage, so it SURVIVES hard navigations / reloads — meaning the full
// login -> /newsfeed timeline (which crosses a full page reload) is kept in one
// place. Capture it from the console with:
//
//   copy(window.__hnpTrace)   — copies the whole timeline to the clipboard
//   hnpTraceTable()           — prints the timeline as a table
//   hnpTraceClear()           — empties the buffer to start a clean capture
//
// `t` is milliseconds since the current document loaded, so `t` jumping back
// down towards 0 marks a hard navigation / reload. `ts` is the wall clock.

import { useEffect, useRef } from "react";

import { isDebugChannelEnabled } from "@/utils/debugChannels";


const PREFIX = "[HNP-TRACE]";
const STORAGE_KEY = "hnp-trace-buffer";
const MAX_ENTRIES = 600;

// Development-only AND opt-in. Every trace() call JSON-stringifies the ring
// buffer into sessionStorage and prints through the stashed native console, so
// `compiler.removeConsole` in next.config.mjs never stripped it — it has to
// gate itself. In a production build the exports below become no-ops the
// bundler can eliminate; in development they stay inert until the `trace`
// channel is enabled.
//
// Resolved once at module load, so the per-render cost of useTraceValue stays a
// single boolean check rather than a storage read.
const TRACING_ENABLED =
  process.env.NODE_ENV !== "production" && isDebugChannelEnabled("trace");

// Exported so call sites that install their own diagnostic listeners (the
// navigation timeline in _app.js) can skip that work entirely rather than
// installing handlers that would call a no-op trace().
export const TRACE_ENABLED = TRACING_ENABLED;

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const t0 = now();

// quietConsole.js silences console.log at the default log level; it stashes the
// native methods on this global so diagnostics can still print.
const getConsole = () =>
  (typeof globalThis !== "undefined" && globalThis.__HNP_NATIVE_CONSOLE__) || console;

const loadBuffer = () => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Coalesce persistence to one write per idle slice. The buffer is only read
// back after a hard navigation, so it does not need to be durable per entry —
// and serialising it on every call was the single most expensive thing this
// module did during boot, when traces arrive in bursts.
let saveScheduled = false;
let pendingBuffer = null;
const flushBuffer = () => {
  saveScheduled = false;
  const buffer = pendingBuffer;
  pendingBuffer = null;
  if (!buffer) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(buffer));
  } catch {
    // sessionStorage unavailable / full — the in-memory buffer still works.
  }
};
const saveBuffer = (buffer) => {
  pendingBuffer = buffer;
  if (saveScheduled) return;
  saveScheduled = true;
  const schedule =
    typeof window.requestIdleCallback === "function"
      ? (fn) => window.requestIdleCallback(fn, { timeout: 500 })
      : (fn) => window.setTimeout(fn, 0);
  schedule(flushBuffer);
  // A hard navigation can happen before the idle callback runs; persist
  // synchronously on the way out so the cross-reload timeline is not lost.
  window.addEventListener("pagehide", flushBuffer, { once: true });
};

const format = (value) => {
  if (typeof value === "symbol") return "(initial)";
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

// Core tracer — records one timeline entry and prints one console line.
export function trace(category, message, data) {
  if (!TRACING_ENABLED) return;
  if (typeof window === "undefined") return;

  const elapsed = Number((now() - t0).toFixed(1));
  const entry = {
    t: elapsed,
    ts: Date.now(),
    category,
    message,
    path: window.location.pathname + window.location.search,
  };
  if (data !== undefined) entry.data = data;

  if (!window.__hnpTrace) {
    // Rehydrate so the buffer survives the hard navigation login -> /newsfeed.
    window.__hnpTrace = loadBuffer();
    window.hnpTraceTable = () => {
      getConsole().table(window.__hnpTrace);
      return `${window.__hnpTrace.length} entries — run copy(window.__hnpTrace) to copy them all`;
    };
    window.hnpTraceClear = () => {
      window.__hnpTrace = [];
      saveBuffer([]);
      return "HNP trace buffer cleared";
    };
  }

  window.__hnpTrace.push(entry);
  if (window.__hnpTrace.length > MAX_ENTRIES) {
    window.__hnpTrace.splice(0, window.__hnpTrace.length - MAX_ENTRIES);
  }
  saveBuffer(window.__hnpTrace);

  const line = `${PREFIX} +${elapsed}ms [${category}] ${message}`;
  if (data !== undefined) getConsole().log(line, data);
  else getConsole().log(line);
}

// Logs "<name> mounted" / "<name> UNMOUNTED" — use to catch remounts/flicker.
export function useTraceMount(name, data) {
  useEffect(() => {
    if (!TRACING_ENABLED) return undefined;
    trace("mount", `${name} mounted`, data);
    return () => trace("mount", `${name} UNMOUNTED`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Logs whenever `value` changes — including the first observed value.
// Deliberately has no dependency array: detecting a change requires running
// after every render. In production the body short-circuits immediately, so the
// per-render cost is a single boolean check (it is mounted five times in
// UserProvider alone, plus StaffLayout).
export function useTraceValue(name, value) {
  const prev = useRef(Symbol("hnp-init"));
  useEffect(() => {
    if (!TRACING_ENABLED) return;
    if (prev.current !== value) {
      trace("state", `${name}: ${format(prev.current)} -> ${format(value)}`);
      prev.current = value;
    }
  });
}
