// Consent ledger writes. Every grant or withdrawal is a new row — no
// updates, no deletes — so the history is evidentially intact.
//
// Callers: cookie banner endpoint, /profile/privacy/consents page, future
// "marketing opt-in" capture points (forms, kiosks, phone notes).

import { supabaseService } from "@/lib/database/supabaseClient";
import { writeAuditLog } from "@/lib/audit/auditLog";

export const CONSENT_PURPOSES = {
  marketing_email: "Marketing emails",
  marketing_sms: "Marketing SMS",
  marketing_post: "Marketing post",
  marketing_phone: "Marketing phone calls",
  service_reminder: "Service reminders",
  research: "Customer research / surveys",
};

export const CONSENT_CHANNELS = ["email", "sms", "post", "phone"];

export const COOKIE_POLICY_VERSION = "v1.0";

const VALID_STATUS = new Set(["granted", "withdrawn"]);

export async function recordConsent({
  subjectType,
  subjectId = null,
  email = null,
  purpose,
  channel = null,
  status,
  source = null,
  policyVersion = null,
  wordingShown = null,
  ip = null,
  userAgent = null,
  capturedBy = null,
}) {
  if (!supabaseService) {
    throw new Error("recordConsent: Supabase service client unavailable.");
  }
  if (!subjectType || !purpose) {
    throw new Error("recordConsent: subjectType and purpose are required.");
  }
  if (!VALID_STATUS.has(status)) {
    throw new Error("recordConsent: status must be 'granted' or 'withdrawn'.");
  }
  if (!CONSENT_PURPOSES[purpose]) {
    throw new Error(`recordConsent: unknown purpose '${purpose}'.`);
  }

  const row = {
    subject_type: subjectType,
    subject_id: typeof subjectId === "number" ? subjectId : null,
    email: email ? String(email).toLowerCase().trim() : null,
    purpose,
    channel,
    status,
    source,
    policy_version: policyVersion,
    wording_shown: wordingShown,
    ip_address: ip || null,
    user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
    captured_by: typeof capturedBy === "number" ? capturedBy : null,
  };

  const { data, error } = await supabaseService
    .from("consent_records")
    .insert([row])
    .select("id")
    .single();
  if (error) throw new Error(`recordConsent insert failed: ${error.message}`);

  // Mirror to audit log for cross-referenced traceability.
  await writeAuditLog({
    action: status === "granted" ? "consent_grant" : "consent_withdraw",
    actorUserId: capturedBy ?? subjectId,
    entityType: "consent_record",
    entityId: data?.id ?? null,
    diff: { purpose, channel, source },
    ip,
    userAgent,
  });

  return data?.id ?? null;
}

// Returns the latest status per (subject, purpose, channel) — i.e. the
// effective consent state right now. A subject is considered to have
// granted a purpose only if their most recent record for that purpose is
// status='granted'.
export async function getEffectiveConsents({ subjectType, subjectId = null, email = null }) {
  if (!supabaseService) return {};
  if (!subjectType) return {};

  let query = supabaseService
    .from("consent_records")
    .select("purpose, channel, status, created_at")
    .eq("subject_type", subjectType)
    .order("created_at", { ascending: false });
  if (typeof subjectId === "number") {
    query = query.eq("subject_id", subjectId);
  } else if (email) {
    query = query.eq("email", String(email).toLowerCase().trim());
  } else {
    return {};
  }

  const { data, error } = await query;
  if (error || !data) return {};

  const seen = new Set();
  const effective = {};
  for (const row of data) {
    const key = `${row.purpose}:${row.channel || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    effective[key] = {
      purpose: row.purpose,
      channel: row.channel,
      status: row.status,
      since: row.created_at,
    };
  }
  return effective;
}
