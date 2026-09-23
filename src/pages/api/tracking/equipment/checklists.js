// file location: src/pages/api/tracking/equipment/checklists.js
//
//   GET  /api/tracking/equipment/checklists   active checklists (all, for managers)
//   POST /api/tracking/equipment/checklists   create or update one  (managers)
//     { id?, name, category, description, items: [...], isActive }
//
// Checklists are switched off rather than deleted: past checks keep a copy of
// the items and results they were done against.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { normalizeRoles } from "@/lib/auth/roles";
import { listChecklists, saveChecklist } from "@/lib/database/equipment";
import {
  authorizeEquipment,
  resolveEquipmentCapabilities,
} from "@/features/tracking/equipment/equipmentPermissions";
import { resolveEquipmentActor, sendEquipmentError } from "@/lib/tracking/equipmentRequest";
import { writeAuditLog } from "@/lib/audit/auditLog";

async function handler(req, res, session) {
  const capabilities = resolveEquipmentCapabilities(normalizeRoles(session?.user?.roles ?? []));

  if (req.method === "GET") {
    try {
      const data = await listChecklists({ includeInactive: capabilities.manageChecklists });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return sendEquipmentError(res, error, "Failed to load checklists");
    }
  }

  if (req.method === "POST") {
    if (!capabilities.manageChecklists) {
      return res.status(403).json({ success: false, message: "Your role cannot manage checklists." });
    }
    try {
      const { actor, auditContext } = await resolveEquipmentActor(req, res, session);
      const checklist = await saveChecklist(req.body || {}, actor);
      await writeAuditLog({
        ...auditContext,
        action: req.body?.id ? "equipment_checklist_updated" : "equipment_checklist_created",
        entityType: "equipment_checklist",
        entityId: checklist.id,
        afterData: { name: checklist.name, items: checklist.items.length, isActive: checklist.isActive },
      });
      return res.status(200).json({ success: true, data: checklist });
    } catch (error) {
      return sendEquipmentError(res, error, "Failed to save the checklist");
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

export default withRoleGuard(handler, { authorize: authorizeEquipment("view") });
