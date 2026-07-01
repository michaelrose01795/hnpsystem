// file location: src/lib/support/errorBoundaryDiagnostics.js
//
// Phase 4 — pure helpers for the Help & Diagnostics ("support") error boundary.
//
// The boundary itself is a React class component (componentDidCatch /
// getDerivedStateFromError can only live on a class), but every decision it makes
// — how to summarise a render error, what the pre-filled report should say, and
// what timeline event to record for a recovery attempt — is factored out here so
// it is PURE and unit-testable in the node Vitest environment (the repo has no
// jsdom / React DOM test runner; see Phase 3's testing rationale).
//
// These helpers never touch window/document and never record anything themselves;
// they only build plain objects that the boundary feeds into the existing
// diagnostics store (recordError / recordAction) and the existing support modal
// (openSupportReport). Capture-time + server-side sanitisation still apply.

// Timeline event types recorded into the diagnostics store's `actions` ring
// buffer (surfaces as `recent_actions` in the captured bundle). Kept short so
// recordAction()'s 40-char `type` clamp never truncates them.
export const BOUNDARY_EVENTS = Object.freeze({
  CAUGHT: "boundary_caught",
  RETRY: "boundary_retry",
  RELOAD: "boundary_reload",
  REPORT: "boundary_report",
});

/**
 * Best-effort human-readable message for any thrown value.
 * @param {unknown} error
 * @returns {string}
 */
export function errorMessage(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (typeof error.message === "string" && error.message) return error.message;
  try {
    return String(error);
  } catch {
    return "Unknown error";
  }
}

/**
 * Extract the top-most user component name from a React component stack string
 * (e.g. "\n    in JobCardDetail (at ...)\n    in div"). Returns null when no
 * usable name is present.
 * @param {string} [componentStack]
 * @returns {string | null}
 */
export function topComponentFromStack(componentStack) {
  if (!componentStack || typeof componentStack !== "string") return null;
  const line = componentStack
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return null;
  // React stacks read "in ComponentName (at file:line)"; tolerate "at" too.
  const match = line.match(/^(?:in|at)\s+([A-Za-z0-9_$.]+)/);
  return match ? match[1] : null;
}

/**
 * Build the pre-filled support report for a caught render error. The user always
 * sees and can edit these fields before sending; the private diagnostics blob
 * (route, section key, resolved code ownership, the recorded error, recovery
 * timeline) is attached separately by openSupportReport().
 *
 * @param {{ error?: unknown, componentStack?: string }} [args]
 * @returns {{ category: string, title: string, description: string }}
 */
export function buildBoundaryReportPrefill({ error, componentStack } = {}) {
  const message = errorMessage(error);
  const component = topComponentFromStack(componentStack);
  const title = (component ? `Crash in ${component}: ${message}` : `App error: ${message}`).slice(0, 300);
  const description = [
    "This screen stopped working and showed the recovery message.",
    "",
    `Error: ${message}`,
    "",
    "A private technical snapshot (the page I was on, where it failed, and the recent errors) is attached automatically.",
  ].join("\n");
  return { category: "bug", title, description };
}

/**
 * Build a timeline event for the diagnostics store's action buffer. Shape matches
 * recordAction()'s generic (non-route_change) branch.
 *
 * @param {string} kind one of BOUNDARY_EVENTS
 * @param {{ sectionKey?: string, message?: string }} [meta]
 * @returns {{ type: string, label?: string, sectionKey?: string }}
 */
export function buildBoundaryEvent(kind, { sectionKey, message } = {}) {
  return {
    type: kind || BOUNDARY_EVENTS.CAUGHT,
    label: message ? String(message).slice(0, 120) : undefined,
    sectionKey: sectionKey || undefined,
  };
}
