// Calculates and saves a practical stop order for one delivery day.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { hasAllAccessRole, normalizeRoles } from "@/lib/auth/roles";
import { getAuditContext } from "@/lib/audit/auditContext";
import { writeAuditLog } from "@/lib/audit/auditLog";
import {
  DELIVERY_DIARY_ROLES,
  resolveDeliveryCapabilities,
} from "@/features/deliveries/deliveryStatus";
import { listDeliveriesForDate, saveDeliveryRouteOrder } from "@/lib/database/deliveries";
import { optimiseDeliveryRoute } from "@/lib/deliveries/routeOptimisation";
import { HNP_ORIGIN_POSTCODE_DEFAULT } from "@/lib/mobileMechanic/config";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  const roles = normalizeRoles(session?.user?.roles ?? []);
  const capabilities = resolveDeliveryCapabilities(roles, hasAllAccessRole(roles));
  if (!capabilities.reorder) {
    res.status(403).json({ success: false, message: "Your role cannot optimise the route." });
    return;
  }

  const date = String(req.body?.date || "").trim();
  if (!ISO_DATE_RE.test(date)) {
    res.status(400).json({ success: false, message: "A valid delivery date is required." });
    return;
  }

  try {
    const before = await listDeliveriesForDate({ date });
    const plan = await optimiseDeliveryRoute({
      deliveries: before,
      originPostcode: process.env.HNP_ORIGIN_POSTCODE || HNP_ORIGIN_POSTCODE_DEFAULT,
      avoidMotorways: Boolean(req.body?.avoidMotorways),
    });
    const written = await saveDeliveryRouteOrder({ date, orderedIds: plan.orderedIds });
    const deliveries = await listDeliveriesForDate({ date });
    const auditContext = await getAuditContext(req, res);
    await writeAuditLog({
      ...auditContext,
      action: "delivery_route_optimised",
      entityType: "parts_delivery_route",
      entityId: date,
      reason: `${written} stop(s) automatically ordered`,
      beforeData: { orderedIds: before.map((row) => row.id) },
      afterData: { orderedIds: plan.orderedIds, plan },
    });

    res.status(200).json({ success: true, data: { date, written, deliveries, plan } });
  } catch (error) {
    console.error("Delivery route optimisation failed:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Unable to optimise the delivery route",
    });
  }
}

export default withRoleGuard(handler, { allow: DELIVERY_DIARY_ROLES });
