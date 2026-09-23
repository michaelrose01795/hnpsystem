// file location: src/lib/utils/logFailure.js
//
// The developer-facing failure log — one place every handled failure is
// printed from, so F12 carries one readable line per distinct problem instead
// of a wall of raw Supabase objects.
//
// NOT to be confused with reportError() in src/lib/notifications/report.js.
// That one is USER-facing: it raises a toast with a plain-English sentence and
// a reference code. This one prints nothing to the user and never raises a
// toast — it is the console line a developer reads. A call site that surfaces
// a failure in the UI wants reportError(); a call site deep in a DB helper,
// which has no UI to surface anything in, wants logFailure().
//
// What it adds over a bare console.error:
//
//   * Normalisation — Error, Supabase PostgrestError, fetch-Response-ish and
//     plain objects all print the same way: message first, then only the
//     fields that actually carry information (code / details / hint / status).
//   * De-duplication — the same failure inside DEDUPE_WINDOW_MS is counted,
//     not reprinted. A retry loop or a re-rendering component that fails five
//     times a second produces one line, then "(x23)" when it next prints.
//   * Consistent labels — the emoji prefixes and trailing colons that grew up
//     across call sites are stripped, so labels sort and filter cleanly in the
//     DevTools console filter box.
//
// It deliberately goes through console.error rather than the native console
// stashed by quietConsole.js: console.error is patched by
// installBrowserCapture() in src/lib/support/diagnostics.js to feed support
// diagnostics, and handled failures belong in that capture.
//
// Usage — a drop-in for console.error at a handled failure:
//
//   logFailure("getAllJobs error:", error);
//   logFailure("upload failed", error, { jobNumber, bucket });

const DEDUPE_WINDOW_MS = 3000;
const MAX_TRACKED_KEYS = 200;

// key -> { count, lastPrintedAt }
const seen = new Map();

const isPlainObject = (value) =>
  !!value && typeof value === "object" && !Array.isArray(value);

// "❌ getAllJobs error:" -> "getAllJobs error"
// A leading "[tag]" or "(note)" is kept — those are deliberate namespaces.
const cleanLabel = (label) =>
  String(label ?? "")
    .replace(/^[^\w[(]+/u, "")
    .replace(/[\s:]+$/u, "")
    .trim();

/**
 * Reduce any thrown/returned failure to a message plus the fields worth
 * printing alongside it.
 */
export function normaliseFailure(detail) {
  if (detail === null || detail === undefined) {
    return { message: "(no error detail)", extras: null };
  }

  if (typeof detail === "string") {
    return { message: detail, extras: null };
  }

  if (detail instanceof Error) {
    const extras = {};
    if (detail.name && detail.name !== "Error") extras.name = detail.name;
    if (detail.code) extras.code = detail.code;
    if (detail.cause) extras.cause = detail.cause;
    return {
      message: detail.message || String(detail),
      extras: Object.keys(extras).length ? extras : null,
      stack: detail.stack,
    };
  }

  if (isPlainObject(detail)) {
    const message =
      detail.message ||
      detail.error_description ||
      (typeof detail.error === "string" ? detail.error : null) ||
      detail.statusText ||
      detail.details ||
      detail.hint ||
      JSON.stringify(detail);

    // Supabase PostgrestError carries code/details/hint; a fetch-ish object
    // carries status. Anything else the call site passed through is kept.
    const extras = {};
    for (const key of Object.keys(detail)) {
      if (key === "message" || key === "stack") continue;
      const value = detail[key];
      if (value === null || value === undefined || value === "") continue;
      if (value === message) continue;
      extras[key] = value;
    }
    return {
      message: String(message),
      extras: Object.keys(extras).length ? extras : null,
      stack: detail.stack,
    };
  }

  return { message: String(detail), extras: null };
}

// Bounded eviction: this map lives for the life of the tab (and, on the server,
// the life of the process), so it must not grow without limit.
const remember = (key) => {
  if (seen.size >= MAX_TRACKED_KEYS) {
    seen.delete(seen.keys().next().value);
  }
  const record = { count: 0, lastPrintedAt: 0 };
  seen.set(key, record);
  return record;
};

/**
 * Log a handled failure. Returns the normalised failure so a caller can reuse
 * the message (to surface it in the UI, say) without re-parsing the original.
 *
 * Trailing arguments are tolerated so this stays a drop-in for the call sites
 * that passed console.error a loose list: plain objects are merged into the
 * printed context, anything else is collected under `detail`.
 *
 * @param {string} label     what failed, e.g. "getAllJobs error"
 * @param {unknown} [detail] the error / Supabase error / response
 * @param {...unknown} rest  extra context objects, or loose values to attach
 * @returns {{label: string, message: string, extras: object|null, stack: string|undefined, printed: boolean}}
 */
export function logFailure(label, detail, ...rest) {
  const context = {};
  const loose = [];
  for (const item of rest) {
    if (isPlainObject(item)) Object.assign(context, item);
    else if (item !== undefined) loose.push(item);
  }
  if (loose.length) context.detail = loose.length === 1 ? loose[0] : loose;

  const cleaned = cleanLabel(label);
  const { message, extras, stack } = normaliseFailure(detail);

  const key = `${cleaned}|${message}`;
  const now = Date.now();
  const record = seen.get(key) || remember(key);
  record.count += 1;

  if (record.lastPrintedAt && now - record.lastPrintedAt < DEDUPE_WINDOW_MS) {
    return { label: cleaned, message, extras, stack, printed: false };
  }

  const repeats = record.count - 1;
  record.lastPrintedAt = now;
  record.count = 0;

  const headline =
    repeats > 0 ? `${cleaned}: ${message} (x${repeats + 1})` : `${cleaned}: ${message}`;

  const payload = { ...(extras || {}), ...context };
  if (Object.keys(payload).length) console.error(headline, payload);
  else console.error(headline);

  return { label: cleaned, message, extras, stack, printed: true };
}

/** Test hook — clears the de-duplication state. */
export function resetFailureLog() {
  seen.clear();
}

export default logFailure;
