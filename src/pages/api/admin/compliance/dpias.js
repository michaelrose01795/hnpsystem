// file location: src/pages/api/admin/compliance/dpias.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { requireComplianceAdmin } from "@/lib/compliance/roles";
import {
  listRegister,
  createRegisterRow,
  updateRegisterRow,
} from "@/lib/compliance/registers";
import { getAuditContext } from "@/lib/audit/auditContext";

const ALLOWED = new Set([
  "system_or_feature",
  "description",
  "status",
  "risk_level",
  "mitigations",
  "signed_off_by",
  "signed_off_at",
  "next_review",
  "document_url",
]);

const sanitise = (body) => {
  const out = {};
  for (const [k, v] of Object.entries(body || {})) if (ALLOWED.has(k)) out[k] = v;
  return out;
};

export default async function handler(req, res) {
  const gate = await requireComplianceAdmin({ getServerSession, authOptions, req, res });
  if (gate.error) return res.status(gate.error.status).json({ success: false, message: gate.error.message });
  const auditCtx = await getAuditContext(req, res);

  try {
    if (req.method === "GET") {
      const rows = await listRegister("dpia_records");
      return res.status(200).json({ success: true, dpias: rows });
    }
    if (req.method === "POST") {
      const payload = sanitise(req.body);
      if (!payload.system_or_feature) {
        return res.status(400).json({ success: false, message: "system_or_feature is required." });
      }
      const row = await createRegisterRow("dpia_records", payload, auditCtx);
      return res.status(200).json({ success: true, dpia: row });
    }
    if (req.method === "PATCH") {
      const id = String(req.body?.id || "");
      if (!id) return res.status(400).json({ success: false, message: "id is required." });
      const patch = sanitise(req.body);
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ success: false, message: "No valid fields to update." });
      }
      const row = await updateRegisterRow("dpia_records", id, patch, auditCtx);
      return res.status(200).json({ success: true, dpia: row });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }

  res.setHeader("Allow", ["GET", "POST", "PATCH"]);
  return res.status(405).json({ success: false, message: "Method not allowed." });
}
