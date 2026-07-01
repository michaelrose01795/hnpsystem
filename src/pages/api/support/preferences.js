// file location: src/pages/api/support/preferences.js
//
// Phase 8 — Developer Platform developer + notification preferences. Strictly
// dev-gated (DEV_PLATFORM_ROLES); one row per owner_key (upsert). Values are
// normalised through the shared allowlist (savedViewValidation.normalisePreferences)
// on both write and read, so a client can never persist arbitrary keys.

import createHandler from "@/lib/api/createHandler";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import {
  getSupportUserPreferences,
  putSupportUserPreferences,
  devOwnerKey,
} from "@/lib/database/supportSavedViews";
import { recordDevPlatformAudit } from "@/lib/support/devPlatformAudit";

async function handleGet(req, res, session) {
  const result = await getSupportUserPreferences(devOwnerKey(session));
  if (!result.ok) {
    return res.status(500).json({ success: false, message: result.error || "Query failed" });
  }
  return res.status(200).json({ success: true, data: result.data });
}

async function handlePut(req, res, session) {
  const result = await putSupportUserPreferences(devOwnerKey(session), req.body?.preferences || req.body || {});
  if (!result.ok) {
    return res.status(400).json({ success: false, message: result.error || "Could not save preferences." });
  }
  await recordDevPlatformAudit("dev_platform_action", { req, session, diff: { action: "preferences_update" } });
  return res.status(200).json({ success: true, data: result.data });
}

export default createHandler({
  allowedRoles: DEV_PLATFORM_ROLES,
  methods: { GET: handleGet, PUT: handlePut },
});
