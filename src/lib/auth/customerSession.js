// file location: src/lib/auth/customerSession.js
// Lightweight HMAC-signed cookie session for the public-facing customer
// area (/website/login + /website/profile). Deliberately separate from
// the staff NextAuth session — staff and customers must never share a
// session token. The cookie is httpOnly, SameSite=Lax, signed with
// HS256-style HMAC over a JSON payload.

import crypto from "crypto";

export const CUSTOMER_COOKIE_NAME = "hnp_customer_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const secret = () =>
  process.env.CUSTOMER_SESSION_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "dev-only-customer-session-secret-change-me";

const b64url = (buf) =>
  Buffer.from(buf)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const b64urlDecode = (str) => {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(
    str.replace(/-/g, "+").replace(/_/g, "/") + pad,
    "base64",
  );
};

export function signCustomerToken({ authId, customerId }) {
  const payload = {
    authId,
    customerId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(
    crypto.createHmac("sha256", secret()).update(body).digest(),
  );
  return `${body}.${sig}`;
}

export function verifyCustomerToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = b64url(
    crypto.createHmac("sha256", secret()).update(body).digest(),
  );
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function buildCustomerCookie(token, { remove = false } = {}) {
  const parts = [
    `${CUSTOMER_COOKIE_NAME}=${remove ? "" : token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${remove ? 0 : TOKEN_TTL_SECONDS}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function getCustomerSessionFromReq(req) {
  const cookies = req.cookies || parseCookies(req.headers?.cookie || "");
  const token = cookies[CUSTOMER_COOKIE_NAME];
  if (!token) return null;
  return verifyCustomerToken(token);
}
