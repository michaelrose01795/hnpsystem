// file location: src/pages/api/admin/compliance/sars.js
//
// GET   — list subject_requests (most recent first)
// PATCH — update status / fulfilment fields on one row.

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { requireComplianceAdmin } from "@/lib/compliance/roles";
import { listRegister, updateRegisterRow } from "@/lib/compliance/registers";
import { getAuditContext } from "@/lib/audit/auditContext";

const ALLOWED_PATCH_FIELDS = new Set([
  "status",
  "identity_verification_method",
  "response_artifact_url",
  "rejection_reason",
  "fulfilled_at",
  "handled_by",
]);

export default async function handler(req, res) {
  const gate = await requireComplianceAdmin({ getServerSession, authOptions, req, res });
  if (gate.error) {
    return res.status(gate.error.status).json({ success: false, message: gate.error.message });
  }

  if (req.method === "GET") {
    try {
      const rows = await listRegister("subject_requests", { orderBy: "received_at" });
      return res.status(200).json({ success: true, requests: rows });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  if (req.method === "PATCH") {
    const id = String(req.body?.id || "");
    if (!id) {
      return res.status(400).json({ success: false, message: "id is required." });
    }
    const patch = {};
    for (const [key, value] of Object.entries(req.body || {})) {
      if (key !== "id" && ALLOWED_PATCH_FIELDS.has(key)) {
        patch[key] = value;
      }
    }
    if (patch.status === "fulfilled" && !patch.fulfilled_at) {
      patch.fulfilled_at = new Date().toISOString();
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update." });
    }

    try {
      const auditCtx = await getAuditContext(req, res);
      const updated = await updateRegisterRow("subject_requests", id, patch, auditCtx);
      return res.status(200).json({ success: true, request: updated });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  res.setHeader("Allow", ["GET", "PATCH"]);
  return res.status(405).json({ success: false, message: "Method not allowed." });
}
