// file location: src/pages/api/tracking/equipment/index.js
//
//   GET  /api/tracking/equipment          the register + active checklists
//   POST /api/tracking/equipment          add an asset            (manage)
//   PUT  /api/tracking/equipment          edit an asset's details (manage)
//
// Checks, faults, status changes, documents and checklists have their own
// routes beside this one. There is no DELETE: assets are retired, never
// removed, so their history survives (PATCH /api/tracking/equipment/[id]).

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { normalizeRoles } from "@/lib/auth/roles";
import { createEquipment, listEquipment, updateEquipment } from "@/lib/database/equipment";
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

  if (req.method === "GET") {
    try {
      const data = await listEquipment({ includeInactiveChecklists: capabilities.manageChecklists });
      return res.status(200).json({ success: true, data: data.assets, checklists: data.checklists, capabilities });
    } catch (error) {
      return sendEquipmentError(res, error, "Failed to load equipment");
    }
  }

  if (req.method === "POST" || req.method === "PUT") {
    if (!capabilities.manage) {
      return res.status(403).json({ success: false, message: "Your role cannot change the equipment register." });
    }
    try {
      const { actor, auditContext } = await resolveEquipmentActor(req, res, session);
      const { id, ...fields } = req.body || {};
      const asset =
        req.method === "POST" ? await createEquipment(fields, actor) : await updateEquipment(id, fields, actor);
      await auditEquipment(auditContext, {
        action: req.method === "POST" ? "equipment_created" : "equipment_updated",
        entityId: asset.id,
        afterData: { assetCode: asset.assetCode, name: asset.name },
      });
      return res.status(req.method === "POST" ? 201 : 200).json({ success: true, data: asset });
    } catch (error) {
      return sendEquipmentError(res, error, "Failed to save equipment");
    }
  }

  if (req.method === "DELETE") {
    return res.status(405).json({
      success: false,
      message: "Equipment is retired rather than deleted, so its history is kept.",
    });
  }

  res.setHeader("Allow", ["GET", "POST", "PUT"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

export default withRoleGuard(handler, { authorize: authorizeEquipment("view") });
