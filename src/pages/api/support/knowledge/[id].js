// file location: src/pages/api/support/knowledge/[id].js
//
// Phase 10 — engineering knowledge centre (read / update / delete a single
// entry). Dev-gated (DEV_PLATFORM_ROLES). Audit-logged on mutation.

import createHandler from "@/lib/api/createHandler";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import {
  getKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
} from "@/lib/database/supportKnowledge";
import { recordDevPlatformAudit } from "@/lib/support/devPlatformAudit";

function idOf(req) {
  return typeof req.query.id === "string" ? req.query.id : Array.isArray(req.query.id) ? req.query.id[0] : null;
}

async function handleGet(req, res) {
  const result = await getKnowledgeEntry(idOf(req));
  if (!result.ok) return res.status(500).json({ success: false, message: result.error || "Query failed" });
  if (!result.data) return res.status(404).json({ success: false, message: "Entry not found." });
  return res.status(200).json({ success: true, data: result.data });
}

async function handlePatch(req, res, session) {
  const id = idOf(req);
  const result = await updateKnowledgeEntry(id, req.body || {});
  if (!result.ok) return res.status(400).json({ success: false, message: result.error || "Could not update entry." });
  await recordDevPlatformAudit("dev_platform_action", { req, session, entityId: id, diff: { action: "knowledge_update" } });
  return res.status(200).json({ success: true, data: result.data });
}

async function handleDelete(req, res, session) {
  const id = idOf(req);
  const result = await deleteKnowledgeEntry(id);
  if (!result.ok) return res.status(400).json({ success: false, message: result.error || "Could not delete entry." });
  await recordDevPlatformAudit("dev_platform_action", { req, session, entityId: id, diff: { action: "knowledge_delete" } });
  return res.status(200).json({ success: true });
}

export default createHandler({
  allowedRoles: DEV_PLATFORM_ROLES,
  methods: { GET: handleGet, PATCH: handlePatch, DELETE: handleDelete },
});
