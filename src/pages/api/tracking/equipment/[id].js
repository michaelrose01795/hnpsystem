// file location: src/pages/api/tracking/equipment/[id].js
//
//   GET   /api/tracking/equipment/:id    one asset with its checks, faults,
//                                        documents and activity timeline.
//                                        :id is the uuid or the asset ID (EQ-0001),
//                                        so a scanned QR label resolves directly.
//   PATCH /api/tracking/equipment/:id    { status, reason } — change operational
//                                        status, retire or reinstate    (manage)

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { normalizeRoles } from "@/lib/auth/roles";
import { changeEquipmentStatus, getEquipmentDetail } from "@/lib/database/equipment";
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
  const reference = String(req.query.id || "");

  if (req.method === "GET") {
    try {
      const detail = await getEquipmentDetail(reference);
      return res.status(200).json({ success: true, data: detail });
    } catch (error) {
      return sendEquipmentError(res, error, "Failed to load the equipment record");
    }
  }

  if (req.method === "PATCH") {
    const { status, reason } = req.body || {};
    const allowed = status === "retired" ? capabilities.retire : capabilities.manage;
    if (!allowed) {
      return res.status(403).json({ success: false, message: "Your role cannot change equipment status." });
    }
    try {
      const { actor, auditContext } = await resolveEquipmentActor(req, res, session);
      const asset = await changeEquipmentStatus(reference, { status, reason }, actor);
      await auditEquipment(auditContext, {
        action: status === "retired" ? "equipment_retired" : "equipment_status_changed",
        entityId: asset.id,
        reason: reason || null,
        afterData: { status: asset.operationalStatus },
      });
      return res.status(200).json({ success: true, data: asset });
    } catch (error) {
      return sendEquipmentError(res, error, "Failed to change equipment status");
    }
  }

  res.setHeader("Allow", ["GET", "PATCH"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

export default withRoleGuard(handler, { authorize: authorizeEquipment("view") });
