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
//
// Phase 9 — the boundary now mints a Phase-4-style REFERENCE CODE for every
// caught render crash (reusing generateReferenceCode from buildErrorAlert, the
// same minting the toast/error path uses) so a boundary crash is quotable and
// correlatable exactly like an async error. The code is threaded through the
// recorded timeline event, the pre-filled report, and the recovery screen.

import { generateReferenceCode } from "@/lib/notifications/buildErrorAlert";

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
 * Mint a short, human-quotable reference code for a caught render crash. Thin
 * wrapper over the shared generator so the boundary and the toast/error path
 * produce the SAME `ERR-…` shape and a developer traces either the same way.
 * @returns {string}
 */
export function mintBoundaryReferenceCode() {
  return generateReferenceCode();
}

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
 * @param {{ error?: unknown, componentStack?: string, referenceCode?: string }} [args]
 * @returns {{ category: string, title: string, description: string, referenceCode?: string }}
 */
export function buildBoundaryReportPrefill({ error, componentStack, referenceCode } = {}) {
  const message = errorMessage(error);
  const component = topComponentFromStack(componentStack);
  const title = (component ? `Crash in ${component}: ${message}` : `App error: ${message}`).slice(0, 300);
  const description = [
    "This screen stopped working and showed the recovery message.",
    "",
    // Phase 9 — surface the reference code in the body so the sent report and the
    // code the user saw on screen line up (the code is also on the private
    // diagnostics snapshot and in the timeline).
    referenceCode ? `Reference: ${referenceCode}` : null,
    referenceCode ? "" : null,
    `Error: ${message}`,
    "",
    "A private technical snapshot (the page I was on, where it failed, and the recent errors) is attached automatically.",
  ]
    .filter((line) => line !== null)
    .join("\n");
  return { category: "bug", title, description, referenceCode: referenceCode || undefined };
}

/**
 * Build a timeline event for the diagnostics store's action buffer. Shape matches
 * recordAction()'s generic (non-route_change) branch.
 *
 * @param {string} kind one of BOUNDARY_EVENTS
 * @param {{ sectionKey?: string, message?: string, referenceCode?: string }} [meta]
 * @returns {{ type: string, label?: string, sectionKey?: string, referenceCode?: string }}
 */
export function buildBoundaryEvent(kind, { sectionKey, message, referenceCode } = {}) {
  // Prefix the label with the reference code so it is visible in recent_actions
  // even where only the label is surfaced; keep the raw code on the event too.
  const label = message ? String(message).slice(0, 120) : undefined;
  return {
    type: kind || BOUNDARY_EVENTS.CAUGHT,
    label: referenceCode ? `[${referenceCode}] ${label || ""}`.trim().slice(0, 120) : label,
    sectionKey: sectionKey || undefined,
    referenceCode: referenceCode || undefined,
  };
}
