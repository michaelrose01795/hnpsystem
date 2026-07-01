// file location: src/pages/api/support/reports/[id].js
//
// Phase 6 — developer-only Support Centre detail + triage endpoint. Gated to
// DEV_FULL_ACCESS_ROLES by createHandler (the whole route is dev-only, unlike the
// open POST on ../reports.js). Every developer action is audit-logged via the
// shared hash-chained writeAuditLog.
//
//   GET   → full report (diagnostics + dev-only investigation), signed screenshot
//           URLs (short-TTL), the comment thread, and the audit history.
//           Writes a `support_report_view` audit entry (private-bundle access).
//   PATCH → triage: status / severity / assignee / duplicate-of. Writes a
//           `support_report_update` audit entry with the requested diff.

import createHandler from "@/lib/api/createHandler";
import {
  getSupportReport,
  updateSupportReport,
  listSupportReportComments,
  listSupportReportAudit,
} from "@/lib/database/support";
import { getSupportScreenshotSignedUrl } from "@/lib/storage/supportMediaBucketService";
import { DEV_FULL_ACCESS_ROLES } from "@/lib/auth/roles";
import { writeAuditLog } from "@/lib/audit/auditLog";

const clientIp = (req) => {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || null;
};

const actorId = (session) => {
  const n = Number.parseInt(session?.user?.id, 10);
  return Number.isInteger(n) ? n : null;
};
const actorRole = (session) => session?.user?.roles?.[0] || (session?.devBypass ? "dev" : null);

// Pair each stored screenshot path with a signed URL + its annotation (from
// diagnostics.attachments, aligned by order).
async function signScreenshots(report) {
  const paths = Array.isArray(report?.screenshot_paths) && report.screenshot_paths.length
    ? report.screenshot_paths
    : report?.screenshot_path
    ? [report.screenshot_path]
    : [];
  const attachments = Array.isArray(report?.diagnostics?.attachments) ? report.diagnostics.attachments : [];
  const signed = await Promise.all(
    paths.map(async (path, order) => ({
      order,
      path,
      url: await getSupportScreenshotSignedUrl(path),
      annotation: attachments.find((a) => a?.order === order)?.annotation || "",
    }))
  );
  return signed;
}

async function handleGet(req, res, session) {
  const { id } = req.query;
  const result = await getSupportReport(id);
  if (!result.success || !result.data) {
    return res.status(404).json({ success: false, message: "Report not found" });
  }

  const [screenshots, comments, audit] = await Promise.all([
    signScreenshots(result.data),
    listSupportReportComments(id),
    listSupportReportAudit(id),
  ]);

  // Audit the private-bundle access (viewing diagnostics is privacy-sensitive).
  await writeAuditLog({
    action: "support_report_view",
    actorUserId: actorId(session),
    actorRole: actorRole(session),
    entityType: "support_report",
    entityId: id,
    ip: clientIp(req),
    userAgent: req.headers["user-agent"] || null,
  });

  return res.status(200).json({
    success: true,
    data: result.data,
    screenshots,
    comments: comments.data || [],
    audit: audit.data || [],
  });
}

async function handlePatch(req, res, session) {
  const { id } = req.query;
  const body = req.body || {};
  const updates = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.severity !== undefined) updates.severity = body.severity;
  if (body.assignedTo !== undefined) updates.assignedTo = body.assignedTo;
  if (body.duplicateOf !== undefined) updates.duplicateOf = body.duplicateOf;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: "No triage fields supplied." });
  }

  const result = await updateSupportReport(id, updates);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.error?.message || "Update failed" });
  }

  await writeAuditLog({
    action: "support_report_update",
    actorUserId: actorId(session),
    actorRole: actorRole(session),
    entityType: "support_report",
    entityId: id,
    diff: updates,
    ip: clientIp(req),
    userAgent: req.headers["user-agent"] || null,
  });

  return res.status(200).json({ success: true, data: result.data });
}

export default createHandler({
  allowedRoles: DEV_FULL_ACCESS_ROLES,
  methods: { GET: handleGet, PATCH: handlePatch },
});
