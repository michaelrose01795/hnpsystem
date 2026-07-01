// file location: src/pages/api/support/notifications/rules.js
//
// Phase 10 — notification subscription rules (list / create / update / delete).
// Dev-gated (DEV_PLATFORM_ROLES). Owner-scoped; mutations are audit-logged
// (dev_platform_action).

import createHandler from "@/lib/api/createHandler";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import {
  listNotificationRules,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
} from "@/lib/database/supportNotifications";
import { devOwnerKey } from "@/lib/database/supportSavedViews";
import { recordDevPlatformAudit } from "@/lib/support/devPlatformAudit";

async function handleGet(req, res, session) {
  const result = await listNotificationRules(devOwnerKey(session));
  if (!result.ok) return res.status(500).json({ success: false, message: result.error || "Query failed" });
  return res.status(200).json({ success: true, data: result.data });
}

async function handlePost(req, res, session) {
  const owner = devOwnerKey(session);
  const result = await createNotificationRule(owner, req.body || {});
  if (!result.ok) return res.status(400).json({ success: false, message: result.error });
  await recordDevPlatformAudit("dev_platform_action", { req, session, entityId: result.data?.id, diff: { action: "notification_rule_create", event: result.data?.event } });
  return res.status(201).json({ success: true, data: result.data });
}

async function handlePatch(req, res, session) {
  const owner = devOwnerKey(session);
  const { id, ...patch } = req.body || {};
  if (!id) return res.status(400).json({ success: false, message: "Rule id is required." });
  const result = await updateNotificationRule(id, owner, patch);
  if (!result.ok) return res.status(400).json({ success: false, message: result.error });
  await recordDevPlatformAudit("dev_platform_action", { req, session, entityId: id, diff: { action: "notification_rule_update" } });
  return res.status(200).json({ success: true, data: result.data });
}

async function handleDelete(req, res, session) {
  const owner = devOwnerKey(session);
  const id = typeof req.query.id === "string" ? req.query.id : (req.body || {}).id;
  if (!id) return res.status(400).json({ success: false, message: "Rule id is required." });
  const result = await deleteNotificationRule(id, owner);
  if (!result.ok) return res.status(400).json({ success: false, message: result.error });
  await recordDevPlatformAudit("dev_platform_action", { req, session, entityId: id, diff: { action: "notification_rule_delete" } });
  return res.status(200).json({ success: true });
}

export default createHandler({
  allowedRoles: DEV_PLATFORM_ROLES,
  methods: { GET: handleGet, POST: handlePost, PATCH: handlePatch, DELETE: handleDelete },
});
