// file location: src/pages/api/support/reports/[id]/comments.js
//
// Phase 6 — developer notes / internal comments for a support report. Dev-only
// (DEV_FULL_ACCESS_ROLES). Adding a comment is audit-logged.
//
//   GET  → the comment thread (oldest first).
//   POST → add a developer note. Author identity comes from the session.

import createHandler from "@/lib/api/createHandler";
import { listSupportReportComments, addSupportReportComment } from "@/lib/database/support";
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

async function handleGet(req, res) {
  const { id } = req.query;
  const result = await listSupportReportComments(id);
  if (!result.success) {
    return res.status(500).json({ success: false, message: result.error?.message || "Query failed" });
  }
  return res.status(200).json({ success: true, comments: result.data });
}

async function handlePost(req, res, session) {
  const { id } = req.query;
  const body = String(req.body?.body || "").trim();
  if (!body) {
    return res.status(400).json({ success: false, message: "Comment cannot be empty." });
  }

  const authorUsername = session?.user?.name || session?.user?.email || null;
  const result = await addSupportReportComment({
    reportId: id,
    body,
    authorId: actorId(session),
    authorUsername,
  });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.error?.message || "Could not add comment." });
  }

  await writeAuditLog({
    action: "support_report_comment",
    actorUserId: actorId(session),
    actorRole: session?.user?.roles?.[0] || (session?.devBypass ? "dev" : null),
    entityType: "support_report",
    entityId: id,
    diff: { comment_id: result.data?.id },
    ip: clientIp(req),
    userAgent: req.headers["user-agent"] || null,
  });

  return res.status(201).json({ success: true, comment: result.data });
}

export default createHandler({
  allowedRoles: DEV_FULL_ACCESS_ROLES,
  methods: { GET: handleGet, POST: handlePost },
});
