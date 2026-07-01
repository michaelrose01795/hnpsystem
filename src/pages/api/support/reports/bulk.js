// file location: src/pages/api/support/reports/bulk.js
//
// Phase 9 — Developer Platform BULK triage endpoint. Dev-gated (DEV_PLATFORM_ROLES
// / `dev`) by createHandler. Applies one validated triage patch to many reports in
// a single UPDATE, then writes ONE audit entry per report actually updated — so
// the hash-chained audit stays per-entity (never a single opaque "bulk" blob) and
// a coverage sweep still sees every report that changed.
//
//   POST /api/support/reports/bulk  { ids: string[], updates: { status?, severity?, assignedTo? } }
//
// Also serves the auto-reopen action: the Releases dashboard posts the
// regression candidates' ids with { status: "triaged" } through the same route.

import createHandler from "@/lib/api/createHandler";
import { bulkUpdateSupportReports } from "@/lib/database/support";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { validateBulkTriage, summariseBulkResult } from "@/lib/dev-platform/bulkTriage";
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
const actorRole = (session) => session?.user?.roles?.[0] || "dev";

async function handlePost(req, res, session) {
  const valid = validateBulkTriage(req.body || {});
  if (!valid.ok) {
    return res.status(400).json({ success: false, message: valid.error });
  }

  const result = await bulkUpdateSupportReports(valid.ids, valid.updates);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.error?.message || "Bulk update failed" });
  }

  const updatedSet = new Set(result.updatedIds);
  // One audit entry per report updated — keeps the audit per-entity.
  await Promise.all(
    result.updatedIds.map((id) =>
      writeAuditLog({
        action: "support_report_update",
        actorUserId: actorId(session),
        actorRole: actorRole(session),
        entityType: "support_report",
        entityId: id,
        diff: { ...valid.updates, bulk: true },
        ip: clientIp(req),
        userAgent: req.headers["user-agent"] || null,
      }).catch(() => {})
    )
  );

  const summary = summariseBulkResult(valid.ids.map((id) => ({ id, ok: updatedSet.has(id) })));
  return res.status(200).json({ success: true, ...summary, updates: valid.updates });
}

export default createHandler({
  allowedRoles: DEV_PLATFORM_ROLES,
  methods: { POST: handlePost },
});
