// file location: src/pages/api/support/knowledge/index.js
//
// Phase 10 — engineering knowledge centre (list + create). Dev-gated
// (DEV_PLATFORM_ROLES). GET lists curated entries; POST creates one, owned by
// the developer (author_key). Audit-logged.

import createHandler from "@/lib/api/createHandler";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { listKnowledgeEntries, createKnowledgeEntry } from "@/lib/database/supportKnowledge";
import { devOwnerKey } from "@/lib/database/supportSavedViews";
import { recordDevPlatformAudit } from "@/lib/support/devPlatformAudit";

async function handleGet(req, res, session) {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const result = await listKnowledgeEntries({ status });
  if (!result.ok) return res.status(500).json({ success: false, message: result.error || "Query failed" });
  await recordDevPlatformAudit("dev_platform_view", { req, session, diff: { surface: "knowledge_list" } });
  return res.status(200).json({ success: true, data: result.data });
}

async function handlePost(req, res, session) {
  const result = await createKnowledgeEntry(req.body || {}, { authorKey: devOwnerKey(session) });
  if (!result.ok) return res.status(400).json({ success: false, message: result.error || "Could not create entry." });
  await recordDevPlatformAudit("dev_platform_action", {
    req,
    session,
    entityId: result.data?.id,
    diff: { action: "knowledge_create", title: result.data?.title },
  });
  return res.status(201).json({ success: true, data: result.data });
}

export default createHandler({
  allowedRoles: DEV_PLATFORM_ROLES,
  methods: { GET: handleGet, POST: handlePost },
});
