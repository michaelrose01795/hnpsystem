// file location: src/lib/vhc/shareCode.js
//
// Share codes for the customer VHC report link.
//
// The customer link used to be /vhc/customer/<job number>/<12 base64url chars>
// — three path segments, a mixed-case code with `-` and `_` in it, and the
// internal job number on show. Read out over the phone or seen in a text
// message it looks like a debug URL, and base64url is hostile to reading aloud
// (`I` vs `l`, `O` vs `0`).
//
// New links are /report/<8 chars> instead: one word, one code. The alphabet
// below is Crockford-style — uppercase, with I, L, O and U removed so nothing
// can be misheard or mistyped, and U dropped so the generator cannot spell
// anything unfortunate. 8 characters over 28 symbols is ~38 bits, which is far
// more than a 24-hour link needs.
//
// `normaliseShareCode` is deliberately forgiving in the same direction: a
// customer typing the code by hand gets lowercase and the O/0, I/1 confusions
// folded back before lookup. Old base64url codes still resolve — they are left
// untouched by the normaliser (see below) so links already sent out keep
// working until they expire.

// Web Crypto, not node:crypto — `buildCustomerReportUrl` below is called from
// the job-card page (client), and a `node:crypto` import would either fail the
// browser build or drag a polyfill into it. `globalThis.crypto.getRandomValues`
// is native in Node 18+ and every browser, so one module serves both sides.
const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

// 32 symbols: 0-9 plus A-Z with I, L, O and U removed.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const SHARE_CODE_LENGTH = 8;

// Anything that is exactly our alphabet at our length is a "new style" code and
// is safe to normalise. Anything else (a legacy 12-char base64url code, which is
// case-sensitive) is returned verbatim.
const NEW_STYLE = new RegExp(`^[${ALPHABET}]{${SHARE_CODE_LENGTH}}$`);

/**
 * Generate a customer-facing share code.
 * Rejection sampling keeps the distribution uniform — `% ALPHABET.length` on a
 * raw byte would quietly bias the first few symbols.
 * @returns {string}
 */
export function generateShareCode(length = SHARE_CODE_LENGTH) {
  const max = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= max) continue; // biased tail — draw again
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/**
 * Fold the confusable characters a customer might type back onto the alphabet.
 * Legacy base64url codes are returned unchanged, because they are case- and
 * character-sensitive and must keep resolving.
 * @param {string} raw
 * @returns {string}
 */
export function normaliseShareCode(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";

  const folded = value
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/U/g, "V");

  return NEW_STYLE.test(folded) ? folded : value;
}

/**
 * Build the customer-facing URL for a share code.
 * One place so the SMS, the job card's copy button and any future channel can
 * never disagree about the shape of the link.
 * @param {string} code
 * @param {string} [origin] absolute origin; omit for a relative path
 */
export function buildCustomerReportUrl(code, origin = "") {
  const path = `/report/${encodeURIComponent(code)}`;
  return origin ? `${String(origin).replace(/\/+$/, "")}${path}` : path;
}
