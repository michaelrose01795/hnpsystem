// file location: src/lib/support/recoveryModel.js
//
// Phase 9 — pure decision layer for the Support & Recovery System.
//
// The error boundary (SupportErrorBoundary + its RouteBoundary / SectionBoundary
// wrappers) is a React class, but every DECISION it makes when it catches an
// error is factored out here so it is pure and unit-testable in the node Vitest
// environment (same rationale as errorBoundaryDiagnostics.js — no jsdom runner).
//
// This module answers three questions, with no side effects and no window/DOM
// access:
//   1. What KIND of failure is this, and is it recoverable in place?  (classifyError)
//   2. Has this boundary entered a CRASH LOOP (same subtree dying again and
//      again)?                                                         (nextCrashState / isCrashLoop)
//   3. Given the boundary LEVEL + audience VARIANT + the above, which recovery
//      ACTIONS should we offer and what should the screen say?         (resolveRecovery)
//
// The boundary owns the reference code (minted via errorBoundaryDiagnostics) and
// the actual navigation / reload / report side effects; this file only shapes the
// plan.

// Where a boundary sits in the tree. Drives which recovery actions make sense.
//   APP     — the single app-shell boundary in _app.js. A crash here has replaced
//             the whole interface, so "go back" / "reload just this section" are
//             meaningless; offer retry, full reload, home, report.
//   ROUTE   — wraps one page's content below the shell. The chrome (sidebar /
//             topbar) survives, so "go back" and "return to dashboard" work.
//   SECTION — wraps a leaf subtree (a tab, a panel, a widget). The rest of the
//             page still works; keep the recovery UI compact and local.
export const RECOVERY_LEVELS = Object.freeze({
  APP: "app",
  ROUTE: "route",
  SECTION: "section",
});

// Who is looking at the recovery screen. STAFF surfaces route "home" to the
// staff dashboard and may reveal a diagnostics panel to authorised roles;
// CUSTOMER surfaces (public website, customer VHC view) use softer copy, route
// "home" to the public landing page, and never expose technical detail.
export const RECOVERY_VARIANTS = Object.freeze({
  STAFF: "staff",
  CUSTOMER: "customer",
});

// Stable identifiers for each recovery action the boundary can render. The
// boundary maps these to real handlers (retry → reset state, reload → location
// .reload, back → router.back, home → router.push(home), report → openSupportReport).
export const RECOVERY_ACTIONS = Object.freeze({
  RETRY: "retry",
  RELOAD: "reload",
  BACK: "back",
  HOME: "home",
  REPORT: "report",
});

// A subtree that crashes again within this window of a recovery attempt is
// treated as still-failing rather than a fresh, unrelated crash.
export const CRASH_LOOP_WINDOW_MS = 8000;
// This many crashes inside the rolling window ⇒ we stop offering in-place retry
// (it clearly is not helping) and steer the user to a heavier recovery.
export const CRASH_LOOP_THRESHOLD = 3;

// Default landing routes per audience (the app dashboard vs the public site).
const DEFAULT_HOME = Object.freeze({
  [RECOVERY_VARIANTS.STAFF]: "/newsfeed",
  [RECOVERY_VARIANTS.CUSTOMER]: "/",
});

/**
 * Best-effort message for any thrown value (kept local so this module has no
 * dependency on errorBoundaryDiagnostics — the boundary already has both).
 * @param {unknown} error
 * @returns {string}
 */
function messageOf(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error.message === "string") return error.message;
  try {
    return String(error);
  } catch {
    return "";
  }
}

/**
 * Classify a caught error so the boundary can pick sensible defaults.
 *
 * The important distinction is between a failure a plain in-place RETRY can fix
 * (a transient render throw) and one it cannot:
 *   - `chunk`  — a stale/failed dynamic import ("Loading chunk … failed",
 *                "error loading dynamically imported module"). Re-rendering the
 *                same broken bundle won't help; only a full reload fetches the
 *                new chunks. `retryUseless: true`, `suggestReload: true`.
 *   - `network`— a fetch/offline style throw surfaced during render. Retry MAY
 *                help once connectivity returns, so it stays offered.
 *   - `render` — anything else; assumed a transient/in-place-recoverable throw.
 *
 * @param {unknown} error
 * @returns {{ kind: "chunk"|"network"|"render", recoverable: boolean, retryUseless: boolean, suggestReload: boolean }}
 */
export function classifyError(error) {
  const msg = messageOf(error).toLowerCase();
  const name = (error && typeof error === "object" && error.name ? String(error.name) : "").toLowerCase();

  const isChunk =
    name === "chunkloaderror" ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("dynamically imported module") ||
    msg.includes("failed to fetch dynamically imported");
  if (isChunk) {
    return { kind: "chunk", recoverable: true, retryUseless: true, suggestReload: true };
  }

  const isNetwork =
    name === "networkerror" ||
    msg.includes("failed to fetch") ||
    msg.includes("network request failed") ||
    msg.includes("networkerror");
  if (isNetwork) {
    return { kind: "network", recoverable: true, retryUseless: false, suggestReload: false };
  }

  return { kind: "render", recoverable: true, retryUseless: false, suggestReload: false };
}

/**
 * Fold a new crash timestamp into the rolling crash record. Timestamps older
 * than the window are pruned so a lull resets the loop — a page that crashes
 * once, is fixed, and crashes again an hour later is NOT a loop.
 *
 * Pure: pass `now` in (the boundary passes Date.now()); returns a NEW record.
 *
 * @param {{ timestamps?: number[] }} [prev]
 * @param {{ now: number, windowMs?: number }} opts
 * @returns {{ timestamps: number[], count: number, firstAt: number, lastAt: number }}
 */
export function nextCrashState(prev, { now, windowMs = CRASH_LOOP_WINDOW_MS } = {}) {
  const previous = Array.isArray(prev?.timestamps) ? prev.timestamps : [];
  const kept = previous.filter((t) => Number.isFinite(t) && now - t <= windowMs);
  kept.push(now);
  return {
    timestamps: kept,
    count: kept.length,
    firstAt: kept[0],
    lastAt: now,
  };
}

/**
 * Is the boundary in a crash loop (>= threshold crashes still inside the window)?
 * @param {{ timestamps?: number[] }} [crashState]
 * @param {{ threshold?: number }} [opts]
 * @returns {boolean}
 */
export function isCrashLoop(crashState, { threshold = CRASH_LOOP_THRESHOLD } = {}) {
  const count = Array.isArray(crashState?.timestamps) ? crashState.timestamps.length : 0;
  return count >= threshold;
}

/**
 * Resolve the home (dashboard / landing) route for an audience, honouring an
 * explicit override the boundary may pass.
 * @param {string} variant
 * @param {string} [homeHref]
 * @returns {string}
 */
export function resolveHomeHref(variant, homeHref) {
  if (typeof homeHref === "string" && homeHref) return homeHref;
  return DEFAULT_HOME[variant] || DEFAULT_HOME[RECOVERY_VARIANTS.STAFF];
}

// Human labels per action, resolved with level/variant context so one action id
// reads correctly everywhere (e.g. "reload" is "Reload app" at APP level but
// "Reload page" at ROUTE level).
function labelFor(actionId, { level, variant }) {
  switch (actionId) {
    case RECOVERY_ACTIONS.RETRY:
      return level === RECOVERY_LEVELS.SECTION ? "Retry" : "Try again";
    case RECOVERY_ACTIONS.RELOAD:
      if (level === RECOVERY_LEVELS.APP) return "Reload app";
      return "Reload page";
    case RECOVERY_ACTIONS.BACK:
      return "Go back";
    case RECOVERY_ACTIONS.HOME:
      return variant === RECOVERY_VARIANTS.CUSTOMER ? "Return home" : "Return to dashboard";
    case RECOVERY_ACTIONS.REPORT:
      return "Report a problem";
    default:
      return actionId;
  }
}

// Visual weight for the button family. Exactly one primary per screen (the
// action most likely to recover), the rest secondary, report always ghost.
function toneFor(actionId, primaryId) {
  if (actionId === RECOVERY_ACTIONS.REPORT) return "ghost";
  return actionId === primaryId ? "primary" : "secondary";
}

/**
 * Produce the full recovery plan for a caught error: whether retry is still
 * worth offering, the headline + message, and the ordered list of actions
 * (each with a stable id, human label, and button tone).
 *
 * Decision summary:
 *   - Base action set is chosen by LEVEL (see RECOVERY_LEVELS).
 *   - RETRY is dropped when it cannot help: a crash loop (retry already failed
 *     repeatedly) or a `retryUseless` classification (stale chunk). The screen
 *     then frames the failure as needing a heavier recovery and RELOAD becomes
 *     the primary action.
 *   - SECTION boundaries never show navigation actions (the surrounding page is
 *     fine); a looping SECTION escalates to offering a page reload.
 *   - The diagnostics panel is only ever advertised to authorised roles, on
 *     STAFF surfaces (the boundary still gates on canViewDiagnostics at render).
 *
 * @param {object} args
 * @param {string} [args.level=RECOVERY_LEVELS.ROUTE]
 * @param {string} [args.variant=RECOVERY_VARIANTS.STAFF]
 * @param {unknown} [args.error]
 * @param {boolean} [args.loopDetected=false]
 * @param {string} [args.homeHref]
 * @param {string} [args.sectionLabel]  friendly name of the crashed section
 * @returns {{
 *   recoverable: boolean,
 *   loop: boolean,
 *   headline: string,
 *   message: string,
 *   primaryActionId: string,
 *   actions: Array<{ id: string, label: string, tone: string }>,
 *   homeHref: string,
 *   allowDiagnostics: boolean,
 * }}
 */
export function resolveRecovery({
  level = RECOVERY_LEVELS.ROUTE,
  variant = RECOVERY_VARIANTS.STAFF,
  error,
  loopDetected = false,
  homeHref,
  sectionLabel,
} = {}) {
  const classification = classifyError(error);
  const retryHelps = !loopDetected && !classification.retryUseless;

  // Base ordered action ids per level.
  let ids;
  if (level === RECOVERY_LEVELS.APP) {
    ids = [RECOVERY_ACTIONS.RETRY, RECOVERY_ACTIONS.RELOAD, RECOVERY_ACTIONS.HOME, RECOVERY_ACTIONS.REPORT];
  } else if (level === RECOVERY_LEVELS.SECTION) {
    // A healthy page surrounds a section crash → keep it local (retry + report).
    // Only when the section keeps dying (or its bundle is stale) do we escalate
    // to a page reload, since local retry can no longer fix it.
    ids = retryHelps
      ? [RECOVERY_ACTIONS.RETRY, RECOVERY_ACTIONS.REPORT]
      : [RECOVERY_ACTIONS.RELOAD, RECOVERY_ACTIONS.REPORT];
  } else {
    // ROUTE
    ids = [
      RECOVERY_ACTIONS.RETRY,
      RECOVERY_ACTIONS.RELOAD,
      RECOVERY_ACTIONS.BACK,
      RECOVERY_ACTIONS.HOME,
      RECOVERY_ACTIONS.REPORT,
    ];
  }

  // Drop retry when it cannot help.
  if (!retryHelps) ids = ids.filter((id) => id !== RECOVERY_ACTIONS.RETRY);

  // Primary action: retry if it still helps, otherwise reload if present,
  // otherwise the first remaining action.
  let primaryId;
  if (retryHelps && ids.includes(RECOVERY_ACTIONS.RETRY)) primaryId = RECOVERY_ACTIONS.RETRY;
  else if (ids.includes(RECOVERY_ACTIONS.RELOAD)) primaryId = RECOVERY_ACTIONS.RELOAD;
  else primaryId = ids[0];

  const actions = ids.map((id) => ({
    id,
    label: labelFor(id, { level, variant }),
    tone: toneFor(id, primaryId),
  }));

  // Copy.
  const where =
    level === RECOVERY_LEVELS.SECTION && sectionLabel
      ? `The “${sectionLabel}” section`
      : level === RECOVERY_LEVELS.APP
        ? "The app"
        : "This page";

  let headline;
  let message;
  if (loopDetected) {
    headline =
      variant === RECOVERY_VARIANTS.CUSTOMER
        ? "This page is having trouble loading"
        : `${where} keeps running into a problem`;
    message =
      variant === RECOVERY_VARIANTS.CUSTOMER
        ? "We’re sorry — this keeps failing. Reloading or heading back usually clears it. If not, please let us know."
        : "It’s failed a few times in a row, so trying again won’t help. Reload or head back, and please send a report so we can fix it.";
  } else if (classification.retryUseless) {
    headline =
      variant === RECOVERY_VARIANTS.CUSTOMER ? "A newer version is available" : "This screen needs a reload";
    message =
      "Part of the app updated while you were here. Reload to get the latest version — your place will be restored where possible.";
  } else {
    headline =
      variant === RECOVERY_VARIANTS.CUSTOMER
        ? "Sorry — something went wrong"
        : `${where} hit an unexpected error`;
    message =
      variant === RECOVERY_VARIANTS.CUSTOMER
        ? "Something didn’t load correctly. You can try again or head back — and if it keeps happening, please report it."
        : "You can try again, reload, or send us a report so we can look into it. Your unsaved changes are kept where possible.";
  }

  return {
    recoverable: classification.recoverable,
    loop: Boolean(loopDetected),
    headline,
    message,
    primaryActionId: primaryId,
    actions,
    homeHref: resolveHomeHref(variant, homeHref),
    allowDiagnostics: variant === RECOVERY_VARIANTS.STAFF,
  };
}
