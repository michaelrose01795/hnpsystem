// file location: src/pages/api/admin/compliance/breaches.js
//
// GET   — list breach_records
// POST  — create a new breach (intake form)
// PATCH — update breach (containment, decisions, ICO ref, …)

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { requireComplianceAdmin } from "@/lib/compliance/roles";
import {
  listRegister,
  createRegisterRow,
  updateRegisterRow,
} from "@/lib/compliance/registers";
import { getAuditContext } from "@/lib/audit/auditContext";

const ALLOWED_FIELDS = new Set([
  "detected_at",
  "reported_internally_at",
  "ico_notified_at",
  "ico_reference",
  "subjects_notified_at",
  "category",
  "severity",
  "root_cause",
  "affected_count",
  "data_categories_affected",
  "containment_actions",
  "remediation_actions",
  "reportable_to_ico",
  "reportable_to_subjects",
  "decision_rationale",
  "status",
  "owner_user_id",
]);

const sanitisePayload = (body) => {
  const out = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (ALLOWED_FIELDS.has(k)) out[k] = v;
  }
  return out;
};

export default async function handler(req, res) {
  const gate = await requireComplianceAdmin({ getServerSession, authOptions, req, res });
  if (gate.error) {
    return res.status(gate.error.status).json({ success: false, message: gate.error.message });
  }
  const auditCtx = await getAuditContext(req, res);

  if (req.method === "GET") {
    try {
      const rows = await listRegister("breach_records", { orderBy: "detected_at" });
      return res.status(200).json({ success: true, breaches: rows });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  if (req.method === "POST") {
    const payload = sanitisePayload(req.body);
    if (!payload.detected_at) {
      payload.detected_at = new Date().toISOString();
    }
    payload.owner_user_id = payload.owner_user_id ?? gate.userId;

    try {
      const row = await createRegisterRow("breach_records", payload, auditCtx);
      return res.status(200).json({ success: true, breach: row });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  if (req.method === "PATCH") {
    const id = String(req.body?.id || "");
    if (!id) return res.status(400).json({ success: false, message: "id is required." });
    const patch = sanitisePayload(req.body);
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update." });
    }
    try {
      const row = await updateRegisterRow("breach_records", id, patch, auditCtx);
      return res.status(200).json({ success: true, breach: row });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PATCH"]);
  return res.status(405).json({ success: false, message: "Method not allowed." });
}
