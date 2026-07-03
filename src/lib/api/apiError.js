// Typed error + failure-shape → friendly-key mapping for the Frontend Feedback
// & Error System.
//
// Phase 5 (see docs/frontend-feedback-system-rollout.md §Phase 5 — API/DB choke
// point). This is the single place that converts a raw failure (a non-ok HTTP
// response, a network drop, an aborted/timed-out request, a Supabase/PostgREST
// error object, or any thrown value) into a normalised `ApiError` carrying a
// **friendlyKey** — a catalogue key from src/lib/notifications/errorMessages.js.
//
// Callers can then report the failure through the Phase 3 helpers
// (reportApiError → reportError) and get a plain-English sentence with NO raw
// `error.message` on screen; the technical detail still flows into devInfo.
//
// Backwards compatible by design: `ApiError extends Error`, so every existing
// `catch (err)` that reads `err.message` / `err.status` / `err.payload` keeps
// working — those fields are preserved. `code` and `friendlyKey` are additive.

// friendlyKey values MUST match keys in src/lib/notifications/errorMessages.js
// (kept as plain strings here to avoid a notifications ↔ api import coupling).
export const FRIENDLY_KEYS = Object.freeze({
  NETWORK: "NETWORK",
  PERMISSION: "PERMISSION",
  TIMEOUT: "TIMEOUT",
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",
  SERVER: "SERVER",
  GENERIC: "GENERIC",
});

/**
 * A normalised, reportable error. `status`/`payload`/`message` mirror the legacy
 * shape thrown by apiRequest; `code` (symbolic) and `friendlyKey` (catalogue
 * key) are the Phase 5 additions.
 */
export class ApiError extends Error {
  constructor(message, { status = null, code = null, friendlyKey = FRIENDLY_KEYS.GENERIC, payload = null, cause = null, context = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.friendlyKey = friendlyKey;
    this.payload = payload;
    this.context = context;
    // Preserve the underlying error for devInfo/stack without clobbering it.
    if (cause && cause !== this) this.cause = cause;
  }

  get isApiError() {
    return true;
  }
}

// --- failure-shape detectors -------------------------------------------------

/** A fetch that never reached the server (offline, DNS, CORS-drop, etc.). */
export function isNetworkError(error) {
  if (!error) return false;
  const name = error.name || "";
  const message = String(error.message || "").toLowerCase();
  return (
    name === "TypeError" &&
    (message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("network request failed") ||
      message.includes("load failed"))
  );
}

/** A request the browser/caller aborted — treated as a timeout for the user. */
export function isAbortError(error) {
  if (!error) return false;
  return error.name === "AbortError" || error.name === "TimeoutError" || error.code === 20;
}

// --- friendly-key mappers ----------------------------------------------------

/** HTTP status → friendly catalogue key. */
export function friendlyKeyForStatus(status) {
  if (status == null) return FRIENDLY_KEYS.GENERIC;
  if (status === 401 || status === 403) return FRIENDLY_KEYS.PERMISSION;
  if (status === 404) return FRIENDLY_KEYS.NOT_FOUND;
  if (status === 408 || status === 504) return FRIENDLY_KEYS.TIMEOUT;
  if (status === 400 || status === 409 || status === 422) return FRIENDLY_KEYS.VALIDATION;
  if (status >= 500) return FRIENDLY_KEYS.SERVER;
  return FRIENDLY_KEYS.GENERIC;
}

// Postgres / PostgREST error codes we can map to a friendly tone. Anything else
// falls through to a status-based or SERVER default.
const SUPABASE_CODE_KEYS = {
  "42501": FRIENDLY_KEYS.PERMISSION, // insufficient_privilege (RLS)
  PGRST301: FRIENDLY_KEYS.PERMISSION, // JWT / row-level auth
  PGRST116: FRIENDLY_KEYS.NOT_FOUND, // no rows for single()
  "23505": FRIENDLY_KEYS.VALIDATION, // unique_violation
  "23503": FRIENDLY_KEYS.VALIDATION, // foreign_key_violation
  "23502": FRIENDLY_KEYS.VALIDATION, // not_null_violation
  "23514": FRIENDLY_KEYS.VALIDATION, // check_violation
  "22P02": FRIENDLY_KEYS.VALIDATION, // invalid_text_representation
  "57014": FRIENDLY_KEYS.TIMEOUT, // query_canceled / statement timeout
};

/** Supabase/PostgREST error object → friendly catalogue key. */
export function friendlyKeyForSupabase(error, status = null) {
  if (!error) return FRIENDLY_KEYS.GENERIC;
  const mapped = error.code && SUPABASE_CODE_KEYS[error.code];
  if (mapped) return mapped;
  if (status != null) return friendlyKeyForStatus(status);
  return FRIENDLY_KEYS.SERVER;
}

/** Any thrown value → friendly catalogue key (network / abort / status / code). */
export function friendlyKeyForError(error) {
  if (error instanceof ApiError) return error.friendlyKey || FRIENDLY_KEYS.GENERIC;
  if (isNetworkError(error)) return FRIENDLY_KEYS.NETWORK;
  if (isAbortError(error)) return FRIENDLY_KEYS.TIMEOUT;
  if (typeof error?.status === "number") return friendlyKeyForStatus(error.status);
  // A bare Supabase result error carries a code but no HTTP status.
  if (error?.code && SUPABASE_CODE_KEYS[error.code]) return SUPABASE_CODE_KEYS[error.code];
  return FRIENDLY_KEYS.GENERIC;
}

// --- builders ----------------------------------------------------------------

function codeForError(error, status) {
  if (error?.code) return String(error.code);
  if (status != null) return `HTTP_${status}`;
  if (isNetworkError(error)) return "NETWORK";
  if (isAbortError(error)) return "TIMEOUT";
  return "UNKNOWN";
}

/**
 * Build an ApiError from a non-ok fetch Response (used by apiRequest). Preserves
 * the exact legacy message so existing callers reading `err.message` are unchanged.
 */
export function apiErrorFromResponse(response, payload) {
  const status = response?.status ?? null;
  const message =
    payload?.message ||
    payload?.error ||
    `${status ?? ""} ${response?.statusText ?? ""}`.trim() ||
    "Request failed";
  return new ApiError(message, {
    status,
    code: payload?.code || (status != null ? `HTTP_${status}` : "UNKNOWN"),
    friendlyKey: friendlyKeyForStatus(status),
    payload: payload ?? null,
  });
}

/**
 * The DATABASE choke point: map a Supabase/PostgREST error object (`{ message,
 * code, details, hint }`, as returned on `{ data, error }`) into an ApiError.
 * DB helpers can adopt this incrementally — no existing helper is required to.
 * @returns {ApiError|null} null when there is no error to map.
 */
export function apiErrorFromSupabase(supabaseError, context = {}) {
  if (!supabaseError) return null;
  if (supabaseError instanceof ApiError) return supabaseError;
  const status = typeof supabaseError.status === "number" ? supabaseError.status : null;
  return new ApiError(supabaseError.message || "Database request failed", {
    status,
    code: supabaseError.code || (status != null ? `HTTP_${status}` : "DB_ERROR"),
    friendlyKey: friendlyKeyForSupabase(supabaseError, status),
    payload: {
      details: supabaseError.details ?? null,
      hint: supabaseError.hint ?? null,
    },
    cause: supabaseError,
    context,
  });
}

/**
 * Idempotently normalise ANY thrown value into an ApiError. Already-normalised
 * errors pass through (merging any extra context); everything else is wrapped
 * while preserving message/status/payload.
 */
export function toApiError(error, context = {}) {
  if (error instanceof ApiError) {
    if (context && Object.keys(context).length) {
      error.context = { ...(error.context || {}), ...context };
    }
    return error;
  }
  const status = typeof error?.status === "number" ? error.status : null;
  return new ApiError(error?.message || String(error ?? "Unknown error"), {
    status,
    code: codeForError(error, status),
    friendlyKey: friendlyKeyForError(error),
    payload: error?.payload ?? null,
    cause: error,
    context,
  });
}
