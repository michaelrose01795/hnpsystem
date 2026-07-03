// The standard reporting API for the Frontend Feedback & Error System.
//
// Phase 3 (see docs/frontend-feedback-system-rollout.md §Phase 3). One line to
// report anything correctly — every helper passes an EXPLICIT toast `type`, so
// the tone never depends on the brittle emoji/keyword inference in alertBus
// (that inference is now fallback-only, for legacy untyped callers).
//
//   reportError("SAVE_FAILED", err, { endpoint: "/api/jobs", jobNumber });
//   reportSuccess("SAVED");
//   reportInfo("No new messages.");
//   reportWarning("SAVED_LOCALLY");
//   await withErrorToast(() => saveJob(payload), { errorMessage: "SAVE_FAILED", successMessage: "SAVED" });
//
// Messages may be a catalogue key (./errorMessages.js) or a literal plain-
// English sentence — resolveMessage() handles both. Technical detail is carried
// in devInfo (built by buildErrorAlert), never in the visible message.

import { friendlyKeyForError } from "@/lib/api/apiError";
import { showAlert } from "@/lib/notifications/alertBus";
import { buildErrorAlert } from "@/lib/notifications/buildErrorAlert";
import { logDiagnostic } from "@/lib/notifications/diagnosticsLog";
import { resolveMessage } from "@/lib/notifications/errorMessages";

// De-duplication window: an identical (type, message) reported again within this
// many ms is suppressed, so a failing loop or a double-clicked action can't spam
// the toast stack with the same sentence. Distinct messages are never affected.
const DUPLICATE_WINDOW_MS = 3500;

// signature (`${type}::${message}`) → last-emitted timestamp.
const recentToasts = new Map();

function isDuplicate(type, message) {
  const now = Date.now();

  // Prune expired signatures first, so a signature that survives is, by
  // definition, still inside the window.
  for (const [signature, ts] of recentToasts) {
    if (now - ts > DUPLICATE_WINDOW_MS) recentToasts.delete(signature);
  }

  const signature = `${type}::${message}`;
  const seen = recentToasts.has(signature);
  recentToasts.set(signature, now);
  return seen;
}

// Shared emit path for the non-error tones. Explicit `type` always wins.
// `allowDuplicate: true` opts out of de-duplication for the rare case where a
// caller genuinely wants to re-announce the same sentence back-to-back.
function emit(type, message, options = {}) {
  const { allowDuplicate = false, ...alertOptions } = options;
  if (!allowDuplicate && isDuplicate(type, message)) return null;
  return showAlert({ message, type, ...alertOptions });
}

/**
 * Report a user-facing failure as an error toast with dev diagnostics attached.
 *
 * @param {string} msgOrKey  Catalogue key (e.g. "SAVE_FAILED") or literal sentence.
 * @param {unknown} [err]    The caught error (or any thrown value) — feeds devInfo.
 * @param {object} [context] Key/values a developer would need (endpoint, ids…).
 *                           Pass `allowDuplicate: true` to bypass de-duplication.
 * @returns {string|null} The alert id, or null when suppressed as a duplicate.
 */
export function reportError(msgOrKey, err = null, context = {}) {
  const { allowDuplicate = false, ...devContext } = context || {};
  const message = resolveMessage(msgOrKey, "error");
  if (!allowDuplicate && isDuplicate("error", message)) return null;
  // buildErrorAlert sets type:"error" (explicit), autoClose:false, a short
  // referenceCode, and the full devInfo.
  const payload = buildErrorAlert(message, err, devContext);
  // Phase 4: log the full devInfo against the reference code so a developer can
  // trace a staff-quoted code even though the technical row is hidden for
  // non-diagnostic roles in the renderer.
  logDiagnostic({
    referenceCode: payload.referenceCode,
    message,
    devInfo: payload.devInfo,
  });
  return showAlert(payload);
}

/**
 * Report a caught error using the friendly key the API/DB choke point already
 * derived — the Phase 5 one-liner. No hand-written message, and the raw
 * `error.message` is never shown (it flows into devInfo via reportError).
 *
 *   try { await apiRequest(...) }
 *   catch (err) { reportApiError(err, { endpoint: "notes.update", jobNumber }); }
 *
 * @param {unknown} err       The caught error — an ApiError carries its own
 *                            `friendlyKey`; any other value is mapped by shape.
 * @param {object} [context]  Dev diagnostics; `allowDuplicate:true` to bypass de-dup.
 * @returns {string|null} The alert id, or null when suppressed as a duplicate.
 */
export function reportApiError(err, context = {}) {
  const friendlyKey = err?.friendlyKey || friendlyKeyForError(err);
  return reportError(friendlyKey, err, context);
}

/**
 * Report a completed action as a success toast.
 * @param {string} msgOrKey  Catalogue key (e.g. "SAVED") or literal sentence.
 * @param {object} [options] showAlert options (duration, autoClose, devInfo) +
 *                           optional `allowDuplicate`.
 * @returns {string|null} The alert id, or null when suppressed as a duplicate.
 */
export function reportSuccess(msgOrKey, options = {}) {
  return emit("success", resolveMessage(msgOrKey, "success"), options);
}

/**
 * Report neutral status as an info toast.
 * @returns {string|null} The alert id, or null when suppressed as a duplicate.
 */
export function reportInfo(msgOrKey, options = {}) {
  return emit("info", resolveMessage(msgOrKey, "info"), options);
}

/**
 * Report a caveat as a warning toast.
 * @returns {string|null} The alert id, or null when suppressed as a duplicate.
 */
export function reportWarning(msgOrKey, options = {}) {
  return emit("warning", resolveMessage(msgOrKey, "warning"), options);
}

/**
 * Run an async function, reporting a friendly error toast if it throws.
 *
 * Wraps the common `try { … } catch { reportError(…) }` pattern so a call site
 * becomes a single line. On failure the caught error is passed to reportError
 * (so devInfo is captured); by default the error is swallowed and `undefined`
 * is returned — set `rethrow: true` to re-throw after reporting.
 *
 * @param {() => Promise<T>|T} fn  The work to run.
 * @param {object} [opts]
 * @param {string} [opts.errorMessage="GENERIC"]  Key/sentence for the failure toast.
 * @param {string} [opts.successMessage]          Key/sentence for a success toast (optional).
 * @param {object|((err:unknown)=>object)} [opts.context]  Dev context, or a
 *                          function of the error returning dev context.
 * @param {boolean} [opts.rethrow=false]          Re-throw after reporting.
 * @returns {Promise<T|undefined>} The function's result, or undefined on a swallowed error.
 * @template T
 */
export async function withErrorToast(fn, opts = {}) {
  const {
    errorMessage = "GENERIC",
    successMessage = null,
    context = {},
    rethrow = false,
  } = opts;

  try {
    const result = await fn();
    if (successMessage) reportSuccess(successMessage);
    return result;
  } catch (err) {
    const devContext = typeof context === "function" ? context(err) : context;
    reportError(errorMessage, err, devContext);
    if (rethrow) throw err;
    return undefined;
  }
}
