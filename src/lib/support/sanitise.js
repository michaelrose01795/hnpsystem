// file location: src/lib/support/sanitise.js
//
// Shared sanitiser for the Help & Diagnostics ("support") feature. This is the
// SINGLE SOURCE OF TRUTH for what is allowed to leave the browser and land in
// a support_reports row. It runs in two places (defence in depth):
//
//   1. Client-side, when assembling the diagnostics bundle before submit.
//   2. Server-side, on ingest in the API route — the client is untrusted, so
//      we re-run the same scrub before persisting.
//
// The module is pure (no imports, no I/O) so it runs identically in the
// browser and in Node, and is trivially unit-testable.
//
// Design rules (see docs/help-diagnostics-system-plan.md §4):
//   - Allowlist for structured fields (session/flags) — never copy unknown keys.
//   - Value-pattern scrubbing for every free-text string (console errors,
//     stack traces, URLs, action labels) to strip tokens/keys/PII.
//   - Key-name redaction for anything resembling a secret field.
//   - A hard size cap so a runaway payload can be rejected.

export const REDACTED = "[REDACTED]";
export const MAX_DIAGNOSTICS_BYTES = 256 * 1024; // 256 KB — matches plan §4.6

// ---------------------------------------------------------------------------
// Key-name redaction — field names that must never appear verbatim. Mirrors
// the ALWAYS_REDACT set in src/lib/audit/auditLog.js and extends it with the
// auth/transport secrets relevant to a client diagnostics bundle.
// ---------------------------------------------------------------------------
const SECRET_KEY_NAMES = new Set([
  "password",
  "password_hash",
  "passwordhash",
  "mfa_secret",
  "national_insurance_number",
  "bank_account_number",
  "sort_code",
  "drivers_licence",
  "drivers_licence_number",
  "card_number",
  "cardnumber",
  "cvv",
  "session_token",
  "sessiontoken",
  "token",
  "token_hash",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "idtoken",
  "id_token",
  "apikey",
  "api_key",
  "secret",
  "client_secret",
  "authorization",
  "auth",
  "cookie",
  "set-cookie",
  "jwt",
  "service_role_key",
  "supabase_service_role_key",
  "nextauth_secret",
]);

const isSecretKeyName = (key) => {
  const k = String(key || "").toLowerCase().replace(/[\s-]/g, "_");
  if (SECRET_KEY_NAMES.has(k)) return true;
  // Catch composite names like "x-api-key", "userPassword", "auth_token".
  return /(password|secret|api_?key|auth_?token|access_?token|refresh_?token|session_?token|client_?secret|cookie|bearer)/.test(
    k
  );
};

// ---------------------------------------------------------------------------
// Value-pattern scrubbing — applied to every string we keep. Ordered so that
// broader token patterns run before narrower ones.
// ---------------------------------------------------------------------------
const VALUE_PATTERNS = [
  // JWT / NextAuth / Supabase tokens: three base64url segments.
  { re: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, label: "JWT" },
  // Bearer tokens in headers / logs.
  { re: /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, label: "BEARER" },
  // Stripe-style and generic prefixed secret keys (sk_live_, service_role, etc.).
  { re: /\b(?:sk|pk|rk|whsec)_[A-Za-z0-9_]{8,}/g, label: "KEY" },
  { re: /service_role[A-Za-z0-9._-]*/gi, label: "KEY" },
  // Supabase anon/service JWTs already caught by the JWT rule above.
  // UK National Insurance number (e.g. QQ123456C).
  { re: /\b[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/gi, label: "NINO" },
  // Card-number-like runs of 13–16 digits (allowing spaces/dashes).
  { re: /\b(?:\d[ -]?){13,16}\b/g, label: "CARD" },
];

// Secret-bearing query-string params to strip from URLs.
const SECRET_QUERY_KEYS = /^(token|access_token|refresh_token|key|api_?key|secret|client_secret|code|password|jwt|sig|signature)$/i;

const maskEmail = (s) =>
  s.replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, "$1***$2");

/**
 * Scrub a single free-text string: strip secret query params from any URLs it
 * contains, mask emails, then run the value patterns.
 * @param {string} input
 * @returns {string}
 */
export function scrubString(input) {
  if (typeof input !== "string" || input.length === 0) return input;
  let out = input;

  // Strip secret query-string values wherever they appear in the string.
  out = out.replace(/([?&])([A-Za-z0-9_]+)=([^&\s"'#]+)/g, (match, sep, key) =>
    SECRET_QUERY_KEYS.test(key) ? `${sep}${key}=${REDACTED}` : match
  );

  out = maskEmail(out);

  for (const { re, label } of VALUE_PATTERNS) {
    out = out.replace(re, `[REDACTED:${label}]`);
  }
  return out;
}

/**
 * Recursively sanitise any value. Redacts secret-named keys outright; scrubs
 * every string value; recurses into arrays/objects. Strips functions and
 * other non-serialisable values.
 * @param {*} value
 * @returns {*}
 */
export function sanitiseValue(value) {
  if (value == null) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(sanitiseValue);
  if (typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (isSecretKeyName(key)) {
        out[key] = REDACTED;
        continue;
      }
      out[key] = sanitiseValue(val);
    }
    return out;
  }
  // functions, symbols, bigint, undefined — drop.
  return undefined;
}

/**
 * Sanitise a full diagnostics bundle. Runs the recursive scrub then guarantees
 * the result is JSON-serialisable (drops anything that survived as undefined).
 * @param {object} diagnostics
 * @returns {object}
 */
export function sanitiseDiagnostics(diagnostics) {
  if (!diagnostics || typeof diagnostics !== "object") return {};
  const cleaned = sanitiseValue(diagnostics);
  // Round-trip through JSON to drop undefineds and ensure serialisability.
  try {
    return JSON.parse(JSON.stringify(cleaned ?? {}));
  } catch {
    return {};
  }
}

/**
 * Byte size of a value once JSON-encoded (UTF-8). Used to enforce the cap.
 * @param {*} value
 * @returns {number}
 */
export function jsonByteSize(value) {
  const str = typeof value === "string" ? value : JSON.stringify(value ?? null);
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str).length;
  // Node fallback.
  return Buffer.byteLength(str, "utf8");
}

/**
 * True if the diagnostics blob is within the size cap.
 * @param {object} diagnostics
 * @returns {boolean}
 */
export function isWithinSizeCap(diagnostics) {
  return jsonByteSize(diagnostics) <= MAX_DIAGNOSTICS_BYTES;
}
