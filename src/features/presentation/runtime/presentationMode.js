// Runtime flag indicating that the current page render belongs to /presentation/*.
// Read by the supabase Proxy (`src/lib/database/supabaseClient.js`), the fetch
// interceptor, UserContext, ProtectedRoute, and any page that auto-redirects on
// role so it can short-circuit when in demo mode. Setter is called from _app.js
// before children mount so the first DB import sees the flag.

const FLAG_KEY = "__PRESENTATION__";
const listeners = new Set();

function inWindow() {
  return typeof window !== "undefined";
}

export function isPresentationMode() {
  if (!inWindow()) return false;
  if (window[FLAG_KEY] === true) return true;
  // Defensive fallback: URL prefix sniff in case the flag wasn't set yet (e.g.
  // a module evaluating before _app's first render). Cheap to compute.
  const path = window.location?.pathname || "";
  return path.startsWith("/presentation/") || path === "/presentation";
}

export function setPresentationMode(value) {
  if (!inWindow()) return;
  const next = Boolean(value);
  if (window[FLAG_KEY] === next) return;
  window[FLAG_KEY] = next;
  for (const cb of listeners) {
    try { cb(next); } catch { /* swallow listener errors */ }
  }
}

export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
