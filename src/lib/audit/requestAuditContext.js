// file location: src/lib/audit/requestAuditContext.js
//
// Server-only. Binds the actor of an API request to every Supabase write that
// request makes, so the database audit trigger can attribute the change.
//
// The trigger (audit_current_actor in
// supabase/migrations/20260928120000_full_database_audit_trail.sql) reads these
// x-audit-* headers only from service-role requests, which only this server can
// make. The headers carry identifiers alone — the trigger reads the name, role,
// department and job title from `users` itself.
//
// The store lives on globalThis under a registered symbol so supabaseClient.js,
// which is also bundled for the browser, can read it without importing
// node:async_hooks.

import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "crypto";
import { getClientIp } from "@/lib/auth/rateLimit";

export const AUDIT_REQUEST_CONTEXT_KEY = Symbol.for("hnp.audit.requestContext");

const storage =
  globalThis[AUDIT_REQUEST_CONTEXT_KEY] ||
  (globalThis[AUDIT_REQUEST_CONTEXT_KEY] = new AsyncLocalStorage());

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Header values must be printable ASCII; anything else is dropped rather than
// risking a fetch that throws and takes the business write down with it.
const headerSafe = (value, max = 200) => {
  const text = String(value ?? "").trim();
  return text && /^[\x20-\x7e]+$/.test(text) ? text.slice(0, max) : null;
};

const firstHeader = (req, name) => {
  const value = req?.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
};

const baseHeaders = (req, actorType, sourcePrefix) => {
  const incomingRequestId = firstHeader(req, "x-request-id");
  const headers = {
    "x-audit-actor-type": actorType,
    // Shared with the browser's api_mutation event, so the page action and the
    // database rows it caused can be correlated.
    "x-request-id": UUID_RE.test(String(incomingRequestId || ""))
      ? incomingRequestId
      : crypto.randomUUID(),
  };
  const path = String(req?.url || "").split("?")[0];
  const source = headerSafe(path ? `${sourcePrefix}:${path}` : null);
  if (source) headers["x-audit-source"] = source;
  const ip = headerSafe(getClientIp(req), 64);
  if (ip) headers["x-audit-client-ip"] = ip;
  return headers;
};

export function buildStaffAuditHeaders(req, session) {
  const user = session?.user || {};
  if (!user.id && !session?.devBypass) {
    return baseHeaders(req, "anonymous", "api");
  }
  const headers = baseHeaders(req, "user", "api");
  const rawId = user.id == null ? "" : String(user.id);
  if (/^\d{1,9}$/.test(rawId)) headers["x-audit-actor-user-id"] = rawId;
  // The subject as authenticated — a numeric user id today, a Keycloak `sub`
  // once Keycloak is live. The trigger matches non-numeric subjects on e-mail.
  const subject = headerSafe(rawId) || (session?.devBypass ? "dev-bypass" : null);
  if (subject) headers["x-audit-auth-subject"] = subject;
  const email = headerSafe(user.email, 254);
  if (email) headers["x-audit-actor-email"] = email;
  const auditSessionId = firstHeader(req, "x-audit-session-id");
  if (UUID_RE.test(String(auditSessionId || ""))) headers["x-audit-session-id"] = auditSessionId;
  return headers;
}

export function buildCustomerAuditHeaders(req, customerSession) {
  const customerId = customerSession?.customerId;
  if (!UUID_RE.test(String(customerId || ""))) {
    return baseHeaders(req, "anonymous", "website");
  }
  const headers = baseHeaders(req, "customer", "website");
  headers["x-audit-customer-id"] = customerId;
  return headers;
}

export function buildSystemAuditHeaders(req, sourcePrefix = "system") {
  return baseHeaders(req, "system", sourcePrefix);
}

export function runWithAuditHeaders(headers, fn) {
  return storage.run({ headers }, fn);
}

export function getAuditHeaders() {
  return storage.getStore()?.headers || null;
}
