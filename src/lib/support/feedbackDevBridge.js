// file location: src/lib/support/feedbackDevBridge.js
//
// Phase 10 — a small dev-only inspection bridge for the Frontend Feedback &
// Error System, mirroring the Phase-4 `window.__HNP_DIAGNOSTICS__` pattern.
//
// The Feedback System's live state is spread across a few places: the reporting
// helpers (last reported error + its reference code), the Phase-4 diagnostic
// trace log (recent errors keyed by reference code), and the support-report
// context (boundary / support-report open state, captured snapshot). This module
// aggregates the globally-reachable parts into ONE inspectable surface:
//
//   • the /dev/feedback-diagnostics page renders it visually (dev-gated), and
//   • `window.__HNP_FEEDBACK__` exposes it in the browser console:
//       __HNP_FEEDBACK__.state()   → { lastError, recent, updatedAt }
//       __HNP_FEEDBACK__.recent()  → recent diagnostics (newest last)
//       __HNP_FEEDBACK__.subscribe(fn) → live updates (returns an unsubscribe)
//
// It holds only what the reporting layer can push without a React context (last
// error + reference code); the React panel supplements it with live context
// state (support-report open, last snapshot). Client-side, in-memory only — no
// persistence, no DB, no PII beyond what already flows through the trace log.

import { getRecentDiagnostics } from "@/lib/notifications/diagnosticsLog";

// The most recent error that flowed through the Phase-3 reporting helpers.
let lastError = null; // { referenceCode, message, kind, source, at }
let updatedAt = null;
const subscribers = new Set();

// Phase 10.1 — support reports the user created by CLICKING an error/warning
// toast ("Report this problem"). Bounded recent history for the dev diagnostics
// page + a set of the alert ids already reported, so a repeated click on the
// same toast can't file a duplicate.
const MAX_REPORTS = 25;
const reportsCreated = []; // { origin, referenceCode, message, at } (newest last)
const reportedAlertIds = new Set();

function notify() {
  const snapshot = getFeedbackState();
  subscribers.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      // A faulty subscriber must never break the reporting path.
    }
  });
}

/**
 * Record the error the reporting layer just surfaced. Called by reportError /
 * reportApiError so the dev bridge always reflects the latest reference code.
 * @param {{ referenceCode?: string, message?: string, kind?: string, source?: string }} entry
 */
export function recordFeedbackError({ referenceCode, message, kind = "error", source } = {}) {
  lastError = {
    referenceCode: referenceCode || null,
    message: message || "",
    kind,
    source: source || null,
    at: new Date().toISOString(),
  };
  updatedAt = lastError.at;
  notify();
}

/**
 * Record a support report the user created by clicking an error/warning toast.
 * Idempotent per alert id: the same alert can only be recorded once, so repeated
 * clicks on a still-visible toast cannot produce duplicate reports.
 * @param {{ origin?: string, referenceCode?: string, message?: string, alertId?: string|number }} entry
 * @returns {boolean} true if newly recorded, false if this alert was already reported.
 */
export function recordReportCreated({ origin = "toast", referenceCode, message, alertId } = {}) {
  const key = alertId != null ? String(alertId) : null;
  if (key && reportedAlertIds.has(key)) return false;
  if (key) reportedAlertIds.add(key);
  reportsCreated.push({
    origin,
    referenceCode: referenceCode || null,
    message: message || "",
    alertId: key,
    at: new Date().toISOString(),
  });
  while (reportsCreated.length > MAX_REPORTS) reportsCreated.shift();
  updatedAt = new Date().toISOString();
  notify();
  return true;
}

/**
 * Has a report already been filed for this alert? Drives the toast's disabled
 * "Reported ✓" state so a user can't double-file from repeated clicks.
 * @param {string|number} alertId
 * @returns {boolean}
 */
export function hasReportedAlert(alertId) {
  return alertId != null && reportedAlertIds.has(String(alertId));
}

/**
 * The current aggregated feedback state (globally-reachable parts only).
 * @returns {{ lastError: object|null, latestReferenceCode: string|null, recent: object[], reportsCreated: object[], updatedAt: string|null }}
 */
export function getFeedbackState() {
  const recent = getRecentDiagnostics();
  const latestReferenceCode = lastError?.referenceCode || recent[recent.length - 1]?.referenceCode || null;
  return { lastError, latestReferenceCode, recent, reportsCreated: reportsCreated.slice(), updatedAt };
}

/**
 * Subscribe to feedback-state changes. Returns an unsubscribe function.
 * @param {(state: object) => void} fn
 * @returns {() => void}
 */
export function subscribeFeedbackState(fn) {
  if (typeof fn !== "function") return () => {};
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

// Console bridge — installed once, lazily, like __HNP_DIAGNOSTICS__.
if (typeof window !== "undefined" && !window.__HNP_FEEDBACK__) {
  window.__HNP_FEEDBACK__ = {
    state: getFeedbackState,
    recent: getRecentDiagnostics,
    subscribe: subscribeFeedbackState,
    reports: () => getFeedbackState().reportsCreated,
  };
}
