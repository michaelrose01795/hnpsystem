// file location: src/pages/api/admin/compliance/retention.js
//
// Read & manage retention policies + recent runs.
//
// GET            — { policies, recentRuns }
// POST           — upsert a retention_policies row by entity_type
// PATCH          — update an existing policy by entity_type
// POST ?action=run — record a manual retention run (rows_processed,
//                   rows_actioned, dry_run). The actual deletion logic
//                   lives in tools/scripts (Phase 8 runbook); this
//                   endpoint just persists the run summary so the audit
//                   trail is complete.

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { requireComplianceAdmin } from "@/lib/compliance/roles";
import { supabaseService } from "@/lib/database/supabaseClient";
import {
  listRegister,
  createRegisterRow,
  updateRegisterRow,
} from "@/lib/compliance/registers";
import { getAuditContext } from "@/lib/audit/auditContext";
import { writeAuditLog } from "@/lib/audit/auditLog";

const ALLOWED_POLICY_FIELDS = new Set([
  "entity_type",
  "retention_period",
  "legal_basis",
  "action",
  "notes",
  "reviewed_at",
]);

const sanitisePolicy = (body) => {
  const out = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (ALLOWED_POLICY_FIELDS.has(k)) out[k] = v;
  }
  return out;
};

export default async function handler(req, res) {
  const gate = await requireComplianceAdmin({ getServerSession, authOptions, req, res });
  if (gate.error) return res.status(gate.error.status).json({ success: false, message: gate.error.message });
  const auditCtx = await getAuditContext(req, res);

  try {
    if (req.method === "GET") {
      const [policies, runsRes] = await Promise.all([
        listRegister("retention_policies", { orderBy: "entity_type", ascending: true }),
        supabaseService
          .from("retention_runs")
          .select("*")
          .order("ran_at", { ascending: false })
          .limit(50),
      ]);
      const recentRuns = runsRes?.data || [];
      return res.status(200).json({ success: true, policies, recentRuns });
    }

    if (req.method === "POST" && String(req.query?.action || "") === "run") {
      const entityType = String(req.body?.entity_type || "");
      const action = String(req.body?.action || "delete");
      const dryRun = Boolean(req.body?.dry_run ?? true);
      const rowsProcessed = Number(req.body?.rows_processed || 0);
      const rowsActioned = Number(req.body?.rows_actioned || 0);
      const notes = req.body?.notes ? String(req.body.notes) : null;

      if (!entityType) {
        return res.status(400).json({ success: false, message: "entity_type is required." });
      }

      const { data: row, error } = await supabaseService
        .from("retention_runs")
        .insert([
          {
            entity_type: entityType,
            action,
            dry_run: dryRun,
            rows_processed: Number.isFinite(rowsProcessed) ? rowsProcessed : 0,
            rows_actioned: Number.isFinite(rowsActioned) ? rowsActioned : 0,
            triggered_by: gate.userId,
            notes,
          },
        ])
        .select("*")
        .single();
      if (error) return res.status(500).json({ success: false, message: error.message });

      await writeAuditLog({
        ...auditCtx,
        action: "retention_run",
        entityType: "retention_run",
        entityId: row?.id,
        diff: {
          entity_type: entityType,
          dry_run: dryRun,
          rows_processed: rowsProcessed,
          rows_actioned: rowsActioned,
        },
      });
      return res.status(200).json({ success: true, run: row });
    }

    if (req.method === "POST") {
      const payload = sanitisePolicy(req.body);
      if (!payload.entity_type || !payload.retention_period || !payload.action) {
        return res
          .status(400)
          .json({ success: false, message: "entity_type, retention_period, action are required." });
      }
      const row = await createRegisterRow("retention_policies", payload, auditCtx);
      return res.status(200).json({ success: true, policy: row });
    }

    if (req.method === "PATCH") {
      const entityType = String(req.body?.entity_type || "");
      if (!entityType) {
        return res.status(400).json({ success: false, message: "entity_type is required." });
      }
      const patch = sanitisePolicy(req.body);
      delete patch.entity_type;
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ success: false, message: "No valid fields to update." });
      }
      const row = await updateRegisterRow("retention_policies", entityType, patch, auditCtx);
      return res.status(200).json({ success: true, policy: row });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }

  res.setHeader("Allow", ["GET", "POST", "PATCH"]);
  return res.status(405).json({ success: false, message: "Method not allowed." });
}
