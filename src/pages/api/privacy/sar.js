// file location: src/pages/api/privacy/sar.js
//
// File a subject request (access / erasure / rectification / portability /
// objection / restriction). Creates a row in subject_requests with a
// 30-day SLA timer; compliance staff fulfil it via /admin/compliance/sars.

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabaseService } from "@/lib/database/supabaseClient";
import { getClientIp, getUserAgent } from "@/lib/auth/rateLimit";
import { writeAuditLog } from "@/lib/audit/auditLog";

const ALLOWED_TYPES = new Set([
  "access",
  "erasure",
  "rectification",
  "portability",
  "objection",
  "restriction",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
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

  const requestType = String(req.body?.requestType || "").toLowerCase();
  const details = String(req.body?.details || "").slice(0, 2000);
  if (!ALLOWED_TYPES.has(requestType)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid request type." });
  }

  const { data: user, error: userErr } = await supabaseService
    .from("users")
    .select("user_id, email, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (userErr || !user) {
    return res.status(404).json({ success: false, message: "Account not found." });
  }
  const subjectType =
    String(user.role || "").toLowerCase() === "customer" ? "customer" : "employee";

  const { data: row, error } = await supabaseService
    .from("subject_requests")
    .insert([
      {
        subject_user_id: user.user_id,
        subject_email: user.email,
        subject_type: subjectType,
        request_type: requestType,
        status: "received",
        details: details || null,
      },
    ])
    .select("id, request_type, status, received_at, due_at")
    .single();

  if (error) {
    return res.status(500).json({ success: false, message: error.message });
  }

  await writeAuditLog({
    action: "subject_request",
    actorUserId: user.user_id,
    entityType: "subject_request",
    entityId: row?.id || null,
    diff: { request_type: requestType, has_details: Boolean(details) },
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  return res.status(200).json({ success: true, request: row });
}
