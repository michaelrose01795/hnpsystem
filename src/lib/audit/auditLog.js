// Append-only audit log writer with tamper-evident hash chain.
//
// Every privacy-sensitive write path goes through writeAuditLog(). The
// caller passes the actor + entity + action + a redacted diff; this module
// computes row_hash = sha256(payload || prev_hash) where prev_hash is the
// row_hash of the most recently inserted row.
//
// The chain is best-effort tamper-evidence: an adversary with DB write
// access can rewrite history, but they would also have to recompute every
// subsequent row's hash. A daily verifier (Phase 2 follow-up) will re-walk
// the chain and alert on any break.
//
// Sensitive fields must be redacted by the caller via redactDiff() — this
// module does not introspect domain models.

import crypto from "crypto";
import { supabaseService } from "@/lib/database/supabaseClient";

// Field names that must never appear verbatim in the diff. Extend as new
// sensitive fields are added to the schema.
const ALWAYS_REDACT = new Set([
  "password",
  "password_hash",
  "password_algo",
  "mfa_secret",
  "mfa_secret_encrypted",
  "mfa_recovery_codes_hashed",
  "national_insurance_number",
  "bank_account_number",
  "sort_code",
  "drivers_licence",
  "drivers_licence_number",
  "card_number",
  "cvv",
  "session_token",
  "token_hash",
]);

const REDACTED = "[REDACTED]";

const sha256Hex = (input) =>
  crypto.createHash("sha256").update(input).digest("hex");

export function redactDiff(diff) {
  if (!diff || typeof diff !== "object") return diff;
  if (Array.isArray(diff)) return diff.map(redactDiff);
  const out = {};
  for (const [key, value] of Object.entries(diff)) {
    if (ALWAYS_REDACT.has(key)) {
      out[key] = REDACTED;
      continue;
    }
    if (value && typeof value === "object") {
      out[key] = redactDiff(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function fetchPrevHash() {
  if (!supabaseService) return null;
  try {
    const { data, error } = await supabaseService
      .from("audit_log")
      .select("row_hash")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data.row_hash || null;
  } catch {
    return null;
  }
}

// Required fields:
//   action       — short event verb, e.g. 'login_success', 'password_change'
// Optional:
//   actorUserId, actorRole, entityType, entityId, diff, reason,
//   ip, userAgent, requestId
//
// Failures are logged but never thrown — audit failures must not break
// the originating request. (A separate alert path will catch repeat
// failures.)
export async function writeAuditLog({
  action,
  actorUserId = null,
  actorRole = null,
  entityType = null,
  entityId = null,
  diff = null,
  reason = null,
  ip = null,
  userAgent = null,
  requestId = null,
} = {}) {
  if (!supabaseService) return;
  if (!action) {
    console.error("[audit] writeAuditLog called without action");
    return;
  }
  try {
    const safeDiff = diff ? redactDiff(diff) : null;
    const prevHash = await fetchPrevHash();
    const occurredAt = new Date().toISOString();

    const payload = JSON.stringify({
      occurred_at: occurredAt,
      actor_user_id: actorUserId,
      actor_role: actorRole,
      action,
      entity_type: entityType,
      entity_id: entityId == null ? null : String(entityId),
      diff: safeDiff,
      reason,
      ip_address: ip,
      user_agent: userAgent,
      request_id: requestId,
    });
    const rowHash = sha256Hex(`${payload}|${prevHash || ""}`);

    await supabaseService.from("audit_log").insert([
      {
        occurred_at: occurredAt,
        actor_user_id:
          typeof actorUserId === "number" ? actorUserId : null,
        actor_role: actorRole,
        action,
        entity_type: entityType,
        entity_id: entityId == null ? null : String(entityId),
        prev_hash: prevHash,
        row_hash: rowHash,
        diff: safeDiff,
        reason,
        ip_address: ip || null,
        user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
        request_id: requestId || null,
      },
    ]);
  } catch (err) {
    console.error("[audit] writeAuditLog failed:", err?.message || err);
  }
}
