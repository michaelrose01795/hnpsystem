// file location: src/pages/api/tracking/equipment/faults.js
//
//   POST  /api/tracking/equipment/faults
//     { equipmentId, description, severity, usability, repairRequired }
//     Anyone who can check equipment can report a fault. "unsafe" usability
//     takes the asset out of service automatically.
//
//   PATCH /api/tracking/equipment/faults                          (managers)
//     { faultId, action: "start-repair" | "resolve" | "update", ... }

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { normalizeRoles } from "@/lib/auth/roles";
import { reportEquipmentFault, updateEquipmentFault } from "@/lib/database/equipment";
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
  const capabilities = resolveEquipmentCapabilities(normalizeRoles(session?.user?.roles ?? []));
  const body = req.body || {};

  if (req.method === "POST") {
    try {
      const { actor, auditContext } = await resolveEquipmentActor(req, res, session);
      const result = await reportEquipmentFault(body, actor);
      await auditEquipment(auditContext, {
        action: "equipment_fault_reported",
        entityId: result.asset.id,
        afterData: { faultId: result.fault.id, severity: result.fault.severity, usability: result.fault.usability },
      });
      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      return sendEquipmentError(res, error, "Failed to report the fault");
    }
  }

  if (req.method === "PATCH") {
    if (!capabilities.manageFaults) {
      return res.status(403).json({ success: false, message: "Your role cannot update faults." });
    }
    try {
      const { actor, auditContext } = await resolveEquipmentActor(req, res, session);
      const result = await updateEquipmentFault(body.faultId, body, actor);
      await auditEquipment(auditContext, {
        action: `equipment_fault_${String(body.action || "update").replace(/-/g, "_")}`,
        entityId: result.asset.id,
        afterData: { faultId: result.fault.id, status: result.fault.status },
      });
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return sendEquipmentError(res, error, "Failed to update the fault");
    }
  }

  res.setHeader("Allow", ["POST", "PATCH"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

export default withRoleGuard(handler, { authorize: authorizeEquipment("reportFault") });
