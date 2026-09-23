// file location: src/pages/api/tracking/equipment/checks.js
//
//   POST /api/tracking/equipment/checks
//     { equipmentIds: [...], checkType, result, condition, checklistId,
//       checklistName, checklistResults, notes, nextDueAt, performedAt,
//       provider, certificateRef, cost, fault: { description, severity,
//       usability, repairRequired } }
//
// One id logs a single check. Several ids is a bulk check (managers only):
// every asset still gets its own check row, schedule update and timeline
// entry. Services and calibrations are logged here too (managers only).
// The performer and time are taken from the session, never the body.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { normalizeRoles } from "@/lib/auth/roles";
import { recordEquipmentChecks } from "@/lib/database/equipment";
import {
  authorizeEquipment,
  resolveEquipmentCapabilities,
} from "@/features/tracking/equipment/equipmentPermissions";
import {
  auditEquipment,
  resolveEquipmentActor,
  sendEquipmentError,
} from "@/lib/tracking/equipmentRequest";

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const capabilities = resolveEquipmentCapabilities(normalizeRoles(session?.user?.roles ?? []));
  const body = req.body || {};
  const ids = Array.isArray(body.equipmentIds) ? body.equipmentIds : [];
  if (ids.length > 1 && !capabilities.bulkCheck) {
    return res.status(403).json({ success: false, message: "Your role cannot log checks in bulk." });
  }
  if (["service", "calibration"].includes(body.checkType) && !capabilities.recordMaintenance) {
    return res.status(403).json({ success: false, message: "Your role cannot record services or calibrations." });
  }

  try {
    const { actor, auditContext } = await resolveEquipmentActor(req, res, session);
    const result = await recordEquipmentChecks(body, actor);
    for (const check of result.checks) {
      await auditEquipment(auditContext, {
        action: `equipment_${check.checkType}_logged`,
        entityId: check.equipmentId,
        reason: result.batchId ? `bulk:${result.batchId}` : null,
        afterData: { checkId: check.id, result: check.result, nextDueAt: check.nextDueAt },
      });
    }
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return sendEquipmentError(res, error, "Failed to log the check");
  }
}

export default withRoleGuard(handler, { authorize: authorizeEquipment("check") });
