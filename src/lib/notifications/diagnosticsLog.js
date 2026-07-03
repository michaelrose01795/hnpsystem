// Diagnostic trace log for the Frontend Feedback & Error System.
//
// Phase 4 (see docs/frontend-feedback-system-rollout.md §Phase 4). Non-diagnostic
// staff only ever see the friendly message + the short reference code on an error
// toast — the technical `devInfo` row is hidden for them (role-gated in the
// renderer). So a developer can still trace what actually happened, every error
// reported through the Phase 3 helper layer records its full `devInfo` HERE,
// keyed by that same reference code.
//
// A staff member reads the code aloud ("ERR-K3F9Q2"); a developer then retrieves
// the full detail either from the browser console (each entry is logged) or via
// `window.__HNP_DIAGNOSTICS__.get("ERR-K3F9Q2")` in dev tools — without the
// technical text ever being shown on a non-diagnostic user's screen.
//
// This is a client-side, in-memory ring buffer only (a bounded recent history);
// it is not persistence and touches no database.

// How many recent errors to retain. Small on purpose — this is a live tracing
// aid, not an audit trail.
const MAX_ENTRIES = 50;

// Newest last. Bounded to MAX_ENTRIES.
const entries = [];

/**
 * Record an error's full devInfo against its reference code.
 * @param {object} params
 * @param {string} params.referenceCode  The code shown on the toast (e.g. "ERR-K3F9Q2").
 * @param {string} [params.message]      The friendly, user-facing sentence.
 * @param {string} [params.devInfo]      The full technical detail (stack, context…).
 * @returns {object|null} The stored entry, or null if there was no reference code.
 */
export function logDiagnostic({ referenceCode, message = "", devInfo = "" } = {}) {
  if (!referenceCode) return null;

  const entry = {
    referenceCode,
    message,
    devInfo,
    at: new Date().toISOString(),
  };

  entries.push(entry);
  while (entries.length > MAX_ENTRIES) entries.shift();

  // Console trace so a developer can always retrieve the full detail by code,
  // even when the in-toast dev row is hidden for non-diagnostic roles. Uses
  // console.debug so it stays out of the way at the default console level.
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug(`[HNP ${referenceCode}] ${message}\n${devInfo}`);
  }

  return entry;
}

/**
 * Look up a previously logged error by its reference code.
 * @param {string} referenceCode
 * @returns {object|null} The stored entry, or null if not found / evicted.
 */
export function getDiagnostic(referenceCode) {
  if (!referenceCode) return null;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].referenceCode === referenceCode) return entries[i];
  }
  return null;
}

/**
 * The recent diagnostic history (newest last). Returns a copy.
 * @returns {object[]}
 */
export function getRecentDiagnostics() {
  return entries.slice();
}

// Dev-tools bridge: lets a developer pull full detail for a staff-quoted code
// straight from the browser console. Non-diagnostic staff have no reason to open
// dev tools, and nothing here is rendered to their screen.
if (typeof window !== "undefined") {
  window.__HNP_DIAGNOSTICS__ = {
    get: getDiagnostic,
    recent: getRecentDiagnostics,
  };
}
