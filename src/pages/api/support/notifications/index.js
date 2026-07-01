// file location: src/pages/api/support/notifications/index.js
//
// Phase 10 — in-app notifications (list + mark read). Dev-gated
// (DEV_PLATFORM_ROLES). Owner-scoped by session owner_key so the synthetic `dev`
// identity and any real numeric user both work. Reads are NOT audited (a feed
// poll would flood the log, same discipline as the health probe); marking read
// is a lightweight state change, also un-audited.
//
//   GET  /api/support/notifications?unread=1
//   POST /api/support/notifications  { action: "read", id }  |  { action: "read_all" }

import createHandler from "@/lib/api/createHandler";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { listNotifications, markNotificationRead, markAllRead } from "@/lib/database/supportNotifications";
import { devOwnerKey } from "@/lib/database/supportSavedViews";

async function handleGet(req, res, session) {
  const owner = devOwnerKey(session);
  const unreadOnly = req.query.unread === "1" || req.query.unread === "true";
  const result = await listNotifications(owner, { unreadOnly });
  if (!result.ok) return res.status(500).json({ success: false, message: result.error || "Query failed" });
  return res.status(200).json({ success: true, data: result.data, unread: result.unread });
}

async function handlePost(req, res, session) {
  const owner = devOwnerKey(session);
  const { action, id } = req.body || {};
  if (action === "read_all") {
    const result = await markAllRead(owner);
    if (!result.ok) return res.status(400).json({ success: false, message: result.error });
    return res.status(200).json({ success: true });
  }
  if (action === "read" && id) {
    const result = await markNotificationRead(id, owner);
    if (!result.ok) return res.status(400).json({ success: false, message: result.error });
    return res.status(200).json({ success: true });
  }
  return res.status(400).json({ success: false, message: "Unknown action." });
}

export default createHandler({
  allowedRoles: DEV_PLATFORM_ROLES,
  methods: { GET: handleGet, POST: handlePost },
});
