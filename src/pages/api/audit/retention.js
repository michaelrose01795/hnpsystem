import { withRoleGuard } from "@/lib/auth/roleGuard";
import { AUDIT_ADMIN_ROLES } from "@/lib/auth/roles";
import {
  getAuditRetentionSettings,
  runAuditMaintenance,
  updateAuditRetentionSettings,
} from "@/lib/database/auditActivity";
import { resolveSessionActor } from "@/lib/audit/api";
import { getAuditContext } from "@/lib/audit/auditContext";
import { writeAuditLog } from "@/lib/audit/auditLog";

async function handler(req, res, session) {
  try {
    if (req.method === "GET") {
      const settings = await getAuditRetentionSettings();
      return res.status(200).json({ success: true, data: settings });
    }
    if (req.method === "PUT") {
      const actor = await resolveSessionActor(session);
      if (!actor) return res.status(401).json({ success: false, message: "Authentication required." });
      const before = await getAuditRetentionSettings();
      const liveDays = Number(req.body?.liveDays);
      const archiveDays = Number(req.body?.archiveDays);
      const sessionTimeoutMinutes = Number(req.body?.sessionTimeoutMinutes);
      if (
        !Number.isInteger(liveDays) ||
        !Number.isInteger(archiveDays) ||
        !Number.isInteger(sessionTimeoutMinutes)
      ) {
        return res.status(400).json({ success: false, message: "Retention values must be whole numbers." });
      }
      const settings = await updateAuditRetentionSettings({
        liveDays,
        archiveDays,
        sessionTimeoutMinutes,
        updatedBy: actor.userId,
      });
      const auditContext = await getAuditContext(req, res);
      await writeAuditLog({
        ...auditContext,
        action: "audit_retention_updated",
        entityType: "audit_retention",
        entityId: 1,
        beforeData: before,
        afterData: settings,
      });
      return res.status(200).json({ success: true, data: settings });
    }
    if (req.method === "POST") {
      const result = await runAuditMaintenance({ archive: req.body?.archive === true });
      return res.status(200).json({ success: true, data: result });
    }
    res.setHeader("Allow", ["GET", "PUT", "POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  } catch (error) {
    console.error("/api/audit/retention error", error);
    return res.status(500).json({ success: false, message: "Unable to run audit maintenance." });
  }
}

export default withRoleGuard(handler, { allow: AUDIT_ADMIN_ROLES });
