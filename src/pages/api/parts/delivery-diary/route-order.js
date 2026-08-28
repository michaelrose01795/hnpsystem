// file location: src/pages/api/parts/delivery-diary/route-order.js
//
// Saves the drag-and-drop route order for one day.
//
// The whole order is sent as an ordered id list rather than a pair of swaps.
// The old up/down buttons swapped two `sort_order` values at a time, which
// meant a half-applied reorder (one update succeeded, the other failed) left
// two stops sharing a number. Writing the full sequence makes the saved order
// exactly what the user sees, and `sort_order` becomes the stop number itself.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { hasAllAccessRole, normalizeRoles } from "@/lib/auth/roles";
import { getAuditContext } from "@/lib/audit/auditContext";
import { writeAuditLog } from "@/lib/audit/auditLog";
import {
  DELIVERY_DIARY_ROLES,
  resolveDeliveryCapabilities,
} from "@/features/deliveries/deliveryStatus";
import {
  listDeliveriesForDate,
  recordDeliveryEvent,
  saveDeliveryRouteOrder,
} from "@/lib/database/deliveries";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_STOPS = 300;

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  const roles = normalizeRoles(session?.user?.roles ?? []);
  const capabilities = resolveDeliveryCapabilities(roles, hasAllAccessRole(roles));
  if (!capabilities.reorder) {
    res.status(403).json({ success: false, message: "Your role cannot reorder the route." });
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const date = String(body.date || "").trim();
  const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : [];

  if (!ISO_DATE_RE.test(date)) {
    res.status(400).json({ success: false, message: "A valid delivery date is required." });
    return;
  }
  const cleanIds = orderedIds
    .map((id) => String(id))
    .filter((id) => UUID_RE.test(id))
    .slice(0, MAX_STOPS);
  if (cleanIds.length === 0) {
    res.status(400).json({ success: false, message: "No stops were supplied." });
    return;
  }
  if (new Set(cleanIds).size !== cleanIds.length) {
    res.status(400).json({ success: false, message: "The route contains a duplicate stop." });
    return;
  }

  try {
    const written = await saveDeliveryRouteOrder({ date, orderedIds: cleanIds });
    const deliveries = await listDeliveriesForDate({ date });

    const auditContext = await getAuditContext(req, res);
    const movedId = String(body.movedId || "");
    if (UUID_RE.test(movedId)) {
      const position = cleanIds.indexOf(movedId);
      if (position >= 0) {
        await recordDeliveryEvent({
          deliveryJobId: movedId,
          eventType: "delivery.reordered",
          actorUserId: auditContext.actorUserId,
          actorName: session?.user?.name || session?.user?.email || null,
          summary: `Moved to stop ${position + 1} of ${cleanIds.length}`,
          detail: { date, position: position + 1, stops: cleanIds.length },
        });
      }
    }

    await writeAuditLog({
      ...auditContext,
      action: "delivery_route_reordered",
      entityType: "parts_delivery_route",
      entityId: date,
      reason: `${written} stop(s) renumbered`,
      afterData: { date, orderedIds: cleanIds },
    });

    res.status(200).json({ success: true, data: { date, written, deliveries } });
  } catch (error) {
    console.error("Delivery route reorder failed:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Unable to save the route order",
    });
  }
}

export default withRoleGuard(handler, { allow: DELIVERY_DIARY_ROLES });
