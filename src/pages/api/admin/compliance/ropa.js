// file location: src/pages/api/admin/compliance/ropa.js
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
  "name",
  "purpose",
  "lawful_basis",
  "data_categories",
  "recipients",
  "international_transfers",
  "security_measures",
  "retention_summary",
  "owner_user_id",
  "last_reviewed_at",
  "next_review_at",
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
      const rows = await listRegister("processing_activities", { orderBy: "name", ascending: true });
      return res.status(200).json({ success: true, activities: rows });
    }
    if (req.method === "POST") {
      const payload = sanitise(req.body);
      if (!payload.name) {
        return res.status(400).json({ success: false, message: "name is required." });
      }
      const row = await createRegisterRow("processing_activities", payload, auditCtx);
      return res.status(200).json({ success: true, activity: row });
    }
    if (req.method === "PATCH") {
      const id = String(req.body?.id || "");
      if (!id) return res.status(400).json({ success: false, message: "id is required." });
      const patch = sanitise(req.body);
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ success: false, message: "No valid fields to update." });
      }
      const row = await updateRegisterRow("processing_activities", id, patch, auditCtx);
      return res.status(200).json({ success: true, activity: row });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }

  res.setHeader("Allow", ["GET", "POST", "PATCH"]);
  return res.status(405).json({ success: false, message: "Method not allowed." });
}
