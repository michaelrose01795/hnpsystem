// Password-reset token signing — Phase 1A.
//
// Stateless single-use tokens. The token payload contains only:
//   { uid: <user_id>, iat: <ms since epoch> }
// and is HMAC-signed using a key that includes the user's CURRENT
// password_hash. Two consequences:
//   1. No password material is ever placed inside the token itself.
//   2. As soon as the user's password is changed (whether by them, by an
//      admin, or by a successful reset), every outstanding token becomes
//      cryptographically invalid — gives us single-use semantics without a
//      tokens table.
//
// TTL is enforced separately on the iat field.

import crypto from "crypto";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERSION = "v1";

const base64UrlEncode = (value) =>
  Buffer.from(value).toString("base64url");

const base64UrlDecode = (value) =>
  Buffer.from(value, "base64url").toString("utf8");

const getBaseSecret = () => {
  const secret =
    process.env.NEXTAUTH_SECRET ||
    process.env.PASSWORD_RESET_SECRET ||
    null;
  if (!secret) {
    throw new Error(
      "Password reset tokens require NEXTAUTH_SECRET (or PASSWORD_RESET_SECRET) to be set."
    );
  }
  return secret;
};

const buildSigningKey = (currentPasswordHash) =>
  crypto
    .createHmac("sha256", getBaseSecret())
    .update("pwreset:")
    .update(String(currentPasswordHash || ""))
    .digest();

const sign = (encodedPayload, currentPasswordHash) =>
  crypto
    .createHmac("sha256", buildSigningKey(currentPasswordHash))
    .update(encodedPayload)
    .digest("base64url");

export function issueResetToken({ userId, currentPasswordHash }) {
  if (typeof userId !== "number" || !Number.isFinite(userId)) {
    throw new Error("issueResetToken: userId must be a number.");
  }
  const payload = { v: VERSION, uid: userId, iat: Date.now() };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const sig = sign(encoded, currentPasswordHash);
  return `${encoded}.${sig}`;
}

// Returns { ok: true, userId } or { ok: false, reason }.
export function verifyResetToken({ token, currentPasswordHash }) {
  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "malformed" };
  }
  const [encoded, providedSig] = token.split(".");
  if (!encoded || !providedSig) {
    return { ok: false, reason: "malformed" };
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encoded));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (payload?.v !== VERSION) return { ok: false, reason: "version" };

  const expectedSig = sign(encoded, currentPasswordHash);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  if (
    typeof payload.iat !== "number" ||
    Date.now() - payload.iat > TOKEN_TTL_MS
  ) {
    return { ok: false, reason: "expired" };
  }
  if (typeof payload.uid !== "number") {
    return { ok: false, reason: "malformed" };
  }
  return { ok: true, userId: payload.uid };
}

export const RESET_TOKEN_TTL_MS = TOKEN_TTL_MS;
