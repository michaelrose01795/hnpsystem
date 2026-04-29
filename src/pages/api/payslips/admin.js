// file location: src/pages/api/payslips/admin.js
// Admin/accounts endpoint for managing payslips for any user.
// GET: list with filters. POST: create a payslip for the supplied userId.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import {
  createPayslip,
  listPayslipsAdmin,
} from "@/lib/database/payslips";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { getAuditContext } from "@/lib/audit/auditContext";

const ALLOWED_ROLES = [
  "admin",
  "admin manager",
  "owner",
  "accounts",
  "accounts manager",
];

async function handler(req, res, session) {
  try {
    if (req.method === "GET") {
      const {
        search = "",
        userId = "",
        department = "",
        status = "",
        paidFrom = "",
        paidTo = "",
        periodFrom = "",
        periodTo = "",
        limit = "500",
      } = req.query;

      const payslips = await listPayslipsAdmin({
        search: String(search || "").trim(),
        userId: userId ? Number(userId) : null,
        department: String(department || "").trim(),
        status: String(status || "").trim(),
        paidFrom: paidFrom || null,
        paidTo: paidTo || null,
        periodFrom: periodFrom || null,
        periodTo: periodTo || null,
        limit: Math.min(2000, Math.max(1, Number(limit) || 500)),
      });
      return res.status(200).json({ success: true, data: payslips });
    }

    if (req.method === "POST") {
      const actorUserId = await resolveSessionUserId(session).catch(() => null);
      const auditCtx = await getAuditContext(req, res);
      const created = await createPayslip(req.body || {}, actorUserId);
      await writeAuditLog({
        ...auditCtx,
        action: "create",
        entityType: "payslip",
        entityId: created?.id ?? null,
        diff: {
          target_user_id: created?.userId ?? null,
          period_start: created?.periodStart ?? null,
          period_end: created?.periodEnd ?? null,
          gross: created?.gross ?? null,
          net: created?.net ?? null,
        },
      });
      return res.status(201).json({ success: true, data: created });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error?.message || "Failed to handle payslip admin request.",
    });
  }
}

export default withRoleGuard(handler, { allow: ALLOWED_ROLES });
