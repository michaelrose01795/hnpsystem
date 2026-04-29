// file location: src/pages/api/payslips/[id].js
// Per-payslip endpoint.
// GET: signed-in user can read their own payslip (PIN-unlocked); admins/accounts can read any.
// PUT/DELETE: admins/accounts only.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { normalizeRoles } from "@/lib/auth/roles";
import {
  buildPersonalApiError,
  getPersonalSecurityState,
} from "@/lib/profile/personalServer";
import {
  deletePayslip,
  getPayslipById,
  updatePayslip,
} from "@/lib/database/payslips";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { getAuditContext, shallowDiff } from "@/lib/audit/auditContext";

const ADMIN_ROLES = new Set([
  "admin",
  "admin manager",
  "owner",
  "accounts",
  "accounts manager",
]);

function isAdminRole(roles = []) {
  return normalizeRoles(roles).some((r) => ADMIN_ROLES.has(r));
}

async function handler(req, res, session) {
  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ success: false, message: "Payslip id is required." });
  }

  try {
    const sessionRoles = session?.user?.roles || [];
    const isAdmin = isAdminRole(sessionRoles);

    if (req.method === "GET") {
      const payslip = await getPayslipById(id);
      if (!payslip) return res.status(404).json({ success: false, message: "Payslip not found." });

      if (!isAdmin) {
        // Non-admin: payslip must belong to caller AND personal must be unlocked.
        const securityState = await getPersonalSecurityState(req, res).catch(() => null);
        if (!securityState?.userId || Number(securityState.userId) !== Number(payslip.userId)) {
          return res.status(403).json({ success: false, message: "Not authorised." });
        }
        if (!securityState.isUnlocked) {
          return res.status(423).json({ success: false, message: "Personal dashboard is locked." });
        }
      }

      // Read of own/another user's payslip is sensitive enough to log.
      const ctx = await getAuditContext(req, res);
      await writeAuditLog({
        ...ctx,
        action: "read",
        entityType: "payslip",
        entityId: id,
        diff: { admin_view: isAdmin, target_user_id: payslip.userId ?? null },
      });

      return res.status(200).json({ success: true, data: payslip });
    }

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorised." });
    }

    if (req.method === "PUT") {
      const actorUserId = await resolveSessionUserId(session).catch(() => null);
      const auditCtx = await getAuditContext(req, res);
      const before = await getPayslipById(id).catch(() => null);
      const updated = await updatePayslip(id, req.body || {}, actorUserId);
      await writeAuditLog({
        ...auditCtx,
        action: "update",
        entityType: "payslip",
        entityId: id,
        diff: shallowDiff(before, updated),
      });
      return res.status(200).json({ success: true, data: updated });
    }

    if (req.method === "DELETE") {
      const auditCtx = await getAuditContext(req, res);
      const before = await getPayslipById(id).catch(() => null);
      await deletePayslip(id);
      await writeAuditLog({
        ...auditCtx,
        action: "delete",
        entityType: "payslip",
        entityId: id,
        diff: { before_target_user_id: before?.userId ?? null },
      });
      return res.status(200).json({ success: true, data: { id } });
    }

    res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to handle payslip request.");
  }
}

export default withRoleGuard(handler);
