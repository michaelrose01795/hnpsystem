// file location: src/pages/api/support/releases/approvals.js
//
// Phase 10 — release approval / deployment-readiness records. Dev-gated
// (DEV_PLATFORM_ROLES). GET lists all approval rows; POST records (upserts) an
// approval decision for a release, keyed by release_key. Every decision is
// audit-logged (dev_platform_action) with the readiness score + override flag,
// so approving a release the platform scored as "blocked" is honestly recorded.

import createHandler from "@/lib/api/createHandler";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { listReleaseApprovals, upsertReleaseApproval } from "@/lib/database/supportReleases";
import { deliverEvent } from "@/lib/database/supportNotifications";
import { devOwnerKey } from "@/lib/database/supportSavedViews";
import { recordDevPlatformAudit } from "@/lib/support/devPlatformAudit";

async function handleGet(req, res, session) {
  const result = await listReleaseApprovals();
  if (!result.ok) return res.status(500).json({ success: false, message: result.error || "Query failed" });
  await recordDevPlatformAudit("dev_platform_view", { req, session, diff: { surface: "release_approvals" } });
  return res.status(200).json({ success: true, data: result.data });
}

async function handlePost(req, res, session) {
  const body = req.body || {};
  const result = await upsertReleaseApproval({ ...body, approverKey: devOwnerKey(session) });
  if (!result.ok) return res.status(400).json({ success: false, message: result.error || "Could not record approval." });
  await recordDevPlatformAudit("dev_platform_action", {
    req,
    session,
    entityId: result.data?.id,
    diff: {
      action: "release_approval",
      releaseKey: result.data?.release_key,
      status: result.data?.status,
      readinessScore: result.data?.readiness_score ?? null,
      override: Boolean(body.override),
    },
  });
  // Fire the notification pipeline end-to-end for a blocked/approved decision
  // (best-effort — deliverEvent never throws; matches team default rules + any
  // subscriptions, fanning out one support_notifications row per recipient).
  if (result.data?.status === "blocked") {
    await deliverEvent({
      type: "release.blocked",
      releaseKey: result.data.release_key,
      score: result.data.readiness_score ?? null,
      link: "/dev/readiness",
      entityType: "release",
      entityId: result.data.release_key,
    });
  } else if (result.data?.status === "approved") {
    await deliverEvent({
      type: "release.approved",
      releaseKey: result.data.release_key,
      approverKey: result.data.approver_key,
      link: "/dev/readiness",
      entityType: "release",
      entityId: result.data.release_key,
    });
  }
  return res.status(200).json({ success: true, data: result.data });
}

export default createHandler({
  allowedRoles: DEV_PLATFORM_ROLES,
  methods: { GET: handleGet, POST: handlePost },
});
