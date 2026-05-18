// file location: src/utils/loadTrace.js
//
// TEMPORARY diagnostic tracer for the login -> /newsfeed load sequence.
//
// It prints a timestamped timeline to the browser console (open DevTools with
// F12) and buffers every entry on `window.__hnpTrace`. The buffer is persisted
// to sessionStorage, so it SURVIVES hard navigations / reloads — meaning the
// full login -> /newsfeed timeline (which crosses a full page reload) is kept
// in one place. Capture it from the console with:
//
//   copy(window.__hnpTrace)   — copies the whole timeline to the clipboard
//   hnpTraceTable()           — prints the timeline as a table
//   hnpTraceClear()           — empties the buffer to start a clean capture
//
// `t` is milliseconds since the current document loaded, so `t` jumping back
// down towards 0 marks a hard navigation / reload. `ts` is the wall clock.
//
// Remove this file and its call sites once the load flicker is diagnosed.

import { useEffect, useRef } from "react";

const PREFIX = "[HNP-TRACE]";
const STORAGE_KEY = "hnp-trace-buffer";
const MAX_ENTRIES = 600;

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

const saveBuffer = (buffer) => {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(buffer));
  } catch {
    // sessionStorage unavailable / full — the in-memory buffer still works.
  }
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
    trace("mount", `${name} mounted`, data);
    return () => trace("mount", `${name} UNMOUNTED`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Logs whenever `value` changes — including the first observed value.
export function useTraceValue(name, value) {
  const prev = useRef(Symbol("hnp-init"));
  useEffect(() => {
    if (prev.current !== value) {
      trace("state", `${name}: ${format(prev.current)} -> ${format(value)}`);
      prev.current = value;
    }
  });
}
