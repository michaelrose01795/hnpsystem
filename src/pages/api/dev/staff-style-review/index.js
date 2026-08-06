import createHandler from "@/lib/api/createHandler";
import { DEV_PLATFORM_ROLE } from "@/lib/auth/roles";
import { devOwnerKey } from "@/lib/database/supportSavedViews";
import {
  deleteStaffStyleReviewFinding,
  listStaffStyleReviewFindings,
  listStaffStyleReviewHistory,
  syncStaffStyleReview,
  updateStaffStyleReviewFinding,
} from "@/lib/database/staffStyleReview";
import { recordDevPlatformAudit } from "@/lib/support/devPlatformAudit";

async function handleGet(req, res, session) {
  const result = req.query.historyFor
    ? await listStaffStyleReviewHistory(req.query.historyFor)
    : await listStaffStyleReviewFindings();
  if (!result.ok) return res.status(500).json({ success: false, message: result.error || "Query failed." });
  await recordDevPlatformAudit("dev_platform_view", {
    req,
    session,
    entityId: req.query.historyFor || "staff-style-review",
    diff: { action: req.query.historyFor ? "staff_style_review_history_view" : "staff_style_review_view" },
  });
  return res.status(200).json({ success: true, ...result });
}

async function handlePost(req, res, session) {
  const result = await syncStaffStyleReview({ actorKey: devOwnerKey(session), trigger: "manual" });
  if (!result.ok) return res.status(400).json({ success: false, message: result.error || "Sync failed." });
  await recordDevPlatformAudit("dev_platform_action", {
    req,
    session,
    entityId: "staff-style-review",
    diff: { action: "staff_style_review_sync", total: result.total, warnings: result.warnings?.length || 0 },
  });
  return res.status(200).json({ success: true, ...result });
}

async function handlePut(req, res, session) {
  const result = await updateStaffStyleReviewFinding({
    id: req.body?.id,
    reviewStatus: req.body?.reviewStatus,
    reviewNotes: req.body?.reviewNotes,
    actorKey: devOwnerKey(session),
  });
  if (!result.ok) return res.status(400).json({ success: false, message: result.error || "Review update failed." });
  await recordDevPlatformAudit("dev_platform_action", {
    req,
    session,
    entityId: result.data.auditId,
    diff: { action: "staff_style_review_decision", status: result.data.reviewStatus },
  });
  return res.status(200).json({ success: true, data: result.data });
}

async function handleDelete(req, res, session) {
  const result = await deleteStaffStyleReviewFinding({ id: req.body?.id });
  if (!result.ok) return res.status(400).json({ success: false, message: result.error || "Finding deletion failed." });
  await recordDevPlatformAudit("dev_platform_action", {
    req,
    session,
    entityId: result.data.auditId,
    diff: { action: "staff_style_review_finding_delete", sourceKey: result.data.sourceKey },
  });
  return res.status(200).json({ success: true, data: result.data });
}

export default createHandler({
  allowedRoles: [DEV_PLATFORM_ROLE],
  methods: { GET: handleGet, POST: handlePost, PUT: handlePut, DELETE: handleDelete },
});
