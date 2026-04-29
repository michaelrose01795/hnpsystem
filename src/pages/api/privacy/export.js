// file location: src/pages/api/privacy/export.js
//
// Downloads everything we hold about the signed-in user as a single JSON
// file (machine-readable, fulfils Art. 20 portability for self-serve cases
// — admin-handled SARs can include richer export bundles later).
//
// Implementation: hand-rolled per-table queries scoped to the requester.
// Adding a table to the export = add a new section here. Conservative by
// default — when in doubt, omit.

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabaseService } from "@/lib/database/supabaseClient";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { getClientIp, getUserAgent } from "@/lib/auth/rateLimit";

const sanitiseUser = (row) => {
  if (!row) return null;
  const {
    password_hash,
    password_algo,
    password_updated_at,
    mfa_secret,
    mfa_secret_encrypted,
    mfa_recovery_codes_hashed,
    ...safe
  } = row;
  void password_hash;
  void password_algo;
  void password_updated_at;
  void mfa_secret;
  void mfa_secret_encrypted;
  void mfa_recovery_codes_hashed;
  return safe;
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const session = await getServerSession(req, res, authOptions);
  const userId = Number(session?.user?.id);
  if (!session?.user || !Number.isFinite(userId) || userId <= 0) {
    return res.status(401).json({ success: false, message: "Not signed in." });
  }
  if (!supabaseService) {
    return res.status(500).json({ success: false, message: "Server missing Supabase service client." });
  }

  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const generatedAt = new Date().toISOString();

  // Each section is best-effort: a missing table or column does not abort
  // the export. The user gets whatever we could collect.
  const fetchSection = async (table, query) => {
    try {
      const { data, error } = await query;
      if (error) {
        console.warn(`[privacy/export] section ${table} skipped:`, error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn(`[privacy/export] section ${table} threw:`, err?.message || err);
      return [];
    }
  };

  const userRow = await fetchSection(
    "users",
    supabaseService.from("users").select("*").eq("user_id", userId).maybeSingle()
  );

  const consents = await fetchSection(
    "consent_records",
    supabaseService
      .from("consent_records")
      .select("id, purpose, channel, status, source, policy_version, created_at")
      .eq("subject_id", userId)
      .order("created_at", { ascending: false })
  );

  const requests = await fetchSection(
    "subject_requests",
    supabaseService
      .from("subject_requests")
      .select("*")
      .eq("subject_user_id", userId)
      .order("received_at", { ascending: false })
  );

  const recentAuthEvents = await fetchSection(
    "audit_log",
    supabaseService
      .from("audit_log")
      .select("id, occurred_at, action, ip_address")
      .eq("actor_user_id", userId)
      .in("action", ["login_success", "login_fail", "password_change", "password_reset"])
      .order("occurred_at", { ascending: false })
      .limit(200)
  );

  // Only include domain tables when a 'customer_id' or 'user_id' linkage
  // is unambiguous. For now, expose nothing else automatically; a fuller
  // SAR (admin-handled) covers cross-table data.

  await writeAuditLog({
    action: "privacy_export",
    actorUserId: userId,
    entityType: "user",
    entityId: userId,
    ip,
    userAgent,
  });

  const filename = `hnp-privacy-export-${userId}-${generatedAt.slice(0, 10)}.json`;

  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );
  return res.status(200).send(
    JSON.stringify(
      {
        generatedAt,
        subject: { user_id: userId },
        profile: sanitiseUser(Array.isArray(userRow) ? userRow[0] : userRow) || null,
        consents,
        subject_requests: requests,
        recent_auth_events: recentAuthEvents,
        notes:
          "This file contains the data the HNP DMS holds against your account that is reasonable to self-serve. " +
          "For a complete subject access request (SAR), use the 'Request access to all data' button on the privacy page.",
      },
      null,
      2
    )
  );
}
