// file location: src/pages/api/support/activity.js
//
// Phase 10 — Developer Platform ACTIVITY feed. Dev-gated (DEV_PLATFORM_ROLES).
// Reads the shared hash-chained audit_log (already redacted at write time),
// scoped to platform + support actions, and returns the shaped feed + a coverage
// roll-up (which expected dev actions have actually been logged). The read is
// itself audit-logged. No diagnostics blob, no secrets.
//
//   GET /api/support/activity?limit=100&entityType=dev_platform&actor=<id>

import createHandler from "@/lib/api/createHandler";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { listPlatformActivity } from "@/lib/database/supportActivity";
import { shapeActivity, activityCoverage, groupActivityByDay } from "@/lib/dev-platform/activityAudit";
import { recordDevPlatformAudit } from "@/lib/support/devPlatformAudit";

const toInt = (v, f) => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) ? n : f;
};

async function handleGet(req, res, session) {
  const q = req.query || {};
  const limit = Math.min(Math.max(toInt(q.limit, 100), 1), 500);
  const entityType = typeof q.entityType === "string" && q.entityType ? q.entityType : undefined;
  const actorUserId = q.actor != null ? toInt(q.actor, undefined) : undefined;

  const result = await listPlatformActivity({ limit, entityType, actorUserId });
  if (!result.ok) {
    return res.status(500).json({ success: false, message: result.error || "Query failed" });
  }

  const activity = shapeActivity(result.data);
  const coverage = activityCoverage(result.data);
  const byDay = groupActivityByDay(activity);

  await recordDevPlatformAudit("dev_platform_view", {
    req,
    session,
    diff: { surface: "activity", count: activity.length },
  });

  return res.status(200).json({ success: true, activity, byDay, coverage, count: activity.length });
}

export default createHandler({
  allowedRoles: DEV_PLATFORM_ROLES,
  methods: { GET: handleGet },
});
