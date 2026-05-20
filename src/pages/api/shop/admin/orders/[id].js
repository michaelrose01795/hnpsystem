// file location: src/pages/api/shop/admin/orders/[id].js
//   GET    -> single order with items
//   PATCH  body { status } -> update workflow status

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { getOrderById, updateOrderStatus } from "@/lib/database/shop";

const ROLES = ["owner", "admin", "admin manager", "general manager", "sales", "accounts"];

const actor = (s) => s?.user?.username || s?.user?.name || s?.user?.email || "Staff User";

const VALID_STATUSES = [
  "pending_payment",
  "paid",
  "fulfilling",
  "shipped",
  "completed",
  "cancelled",
  "refunded",
];

async function handler(req, res, session) {
  const { id } = req.query;
  if (req.method === "GET") {
    const data = await getOrderById(id);
    if (!data) return res.status(404).json({ success: false, message: "Order not found" });
    return res.status(200).json({ success: true, data });
  }
  if (req.method === "PATCH") {
    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of ${VALID_STATUSES.join(", ")}`,
      });
    }
    const result = await updateOrderStatus(id, status, actor(session));
    if (!result.ok) return res.status(500).json({ success: false, message: result.error });
    return res.status(200).json({ success: true, data: result.data });
  }
  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ success: false, message: "Method Not Allowed" });
}

export default withRoleGuard(handler, { allow: ROLES });
