// file location: src/pages/api/support/saved-views/index.js
//
// Phase 8 — Developer Platform saved views (list + create). Strictly dev-gated
// (DEV_PLATFORM_ROLES). A GET returns the caller's personal views plus every
// shared team view for the surface; a POST creates a new view owned by the
// caller. Ownership is keyed by the session id (owner_key) so the `dev` role
// (synthetic, no users row) works alongside any real numeric user id.

import createHandler from "@/lib/api/createHandler";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import {
  listSupportSavedViews,
  createSupportSavedView,
  devOwnerKey,
} from "@/lib/database/supportSavedViews";
import { recordDevPlatformAudit } from "@/lib/support/devPlatformAudit";

async function handleGet(req, res, session) {
  const surface = typeof req.query.surface === "string" ? req.query.surface : "support";
  const result = await listSupportSavedViews(devOwnerKey(session), { surface });
  if (!result.ok) {
    return res.status(500).json({ success: false, message: result.error || "Query failed" });
  }
  await recordDevPlatformAudit("dev_platform_view", { req, session, diff: { surface, kind: "saved_views_list" } });
  return res.status(200).json({ success: true, data: result.data });
}

async function handlePost(req, res, session) {
  const result = await createSupportSavedView(devOwnerKey(session), req.body || {});
  if (!result.ok) {
    return res.status(400).json({ success: false, message: result.error || "Could not save the view." });
  }
  await recordDevPlatformAudit("dev_platform_action", {
    req,
    session,
    entityId: result.data?.id,
    diff: { action: "saved_view_create", scope: result.data?.scope },
  });
  return res.status(201).json({ success: true, data: result.data });
}

export default createHandler({
  allowedRoles: DEV_PLATFORM_ROLES,
  methods: { GET: handleGet, POST: handlePost },
});
