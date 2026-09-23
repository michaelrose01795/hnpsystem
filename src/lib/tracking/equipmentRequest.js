// file location: src/lib/tracking/equipmentRequest.js
//
// Request plumbing shared by the /api/tracking/equipment routes: who is acting
// (taken from the session, never from the request body), the audit context
// for the central audit log, and one error → response mapping.

import { getAuditContext } from "@/lib/audit/auditContext";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { getAuditActor } from "@/lib/database/auditActivity";
import { EquipmentError } from "@/lib/database/equipment";
import { logFailure } from "@/lib/utils/logFailure";

/**
 * The acting user for timeline entries and "last checked by". The id comes from
 * the NextAuth session via the audit context; the display name from the users
 * table so it matches the rest of the DMS.
 */
export async function resolveEquipmentActor(req, res, session) {
  const auditContext = await getAuditContext(req, res);
  let name = session?.user?.name || session?.user?.email || null;
  if (auditContext.actorUserId) {
    try {
      const auditActor = await getAuditActor(auditContext.actorUserId);
      if (auditActor?.name) name = auditActor.name;
    } catch (error) {
      logFailure("Equipment: unable to resolve the acting user", error);
    }
  }
  return {
    actor: { userId: auditContext.actorUserId, name: name || "Unknown user" },
    auditContext,
  };
}

export function auditEquipment(auditContext, { action, entityId, reason = null, afterData = null }) {
  return writeAuditLog({
    ...auditContext,
    action,
    entityType: "equipment_asset",
    entityId,
    reason,
    afterData,
  });
}

export function sendEquipmentError(res, error, fallbackMessage) {
  if (error instanceof EquipmentError) {
    return res.status(error.status || 400).json({ success: false, message: error.message });
  }
  logFailure(fallbackMessage, error);
  return res.status(500).json({ success: false, message: fallbackMessage });
}
