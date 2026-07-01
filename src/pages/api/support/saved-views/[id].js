// file location: src/pages/api/support/saved-views/[id].js
//
// Phase 8 — Developer Platform saved view mutations (update + delete). Strictly
// dev-gated (DEV_PLATFORM_ROLES) and owner-scoped: the data layer only mutates a
// row whose owner_key matches the caller, so one developer can never edit or
// delete another's view.

import createHandler from "@/lib/api/createHandler";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import {
  updateSupportSavedView,
  deleteSupportSavedView,
  devOwnerKey,
} from "@/lib/database/supportSavedViews";
import { recordDevPlatformAudit } from "@/lib/support/devPlatformAudit";

async function handlePatch(req, res, session) {
  const { id } = req.query;
  const result = await updateSupportSavedView(id, devOwnerKey(session), req.body || {});
  if (!result.ok) {
    return res.status(400).json({ success: false, message: result.error || "Update failed" });
  }
  await recordDevPlatformAudit("dev_platform_action", {
    req,
    session,
    entityId: id,
    diff: { action: "saved_view_update" },
  });
  return res.status(200).json({ success: true, data: result.data });
}

async function handleDelete(req, res, session) {
  const { id } = req.query;
  const result = await deleteSupportSavedView(id, devOwnerKey(session));
  if (!result.ok) {
    return res.status(400).json({ success: false, message: result.error || "Delete failed" });
  }
  await recordDevPlatformAudit("dev_platform_action", {
    req,
    session,
    entityId: id,
    diff: { action: "saved_view_delete" },
  });
  return res.status(200).json({ success: true });
}

export default createHandler({
  allowedRoles: DEV_PLATFORM_ROLES,
  methods: { PATCH: handlePatch, DELETE: handleDelete },
});
