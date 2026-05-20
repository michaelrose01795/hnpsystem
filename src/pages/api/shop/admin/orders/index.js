// file location: src/pages/api/shop/admin/orders/index.js
// GET /api/shop/admin/orders  -> latest orders for the staff Shop panel.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { listOrders } from "@/lib/database/shop";

const ROLES = ["owner", "admin", "admin manager", "general manager", "sales", "accounts"];

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const data = await listOrders({ limit });
  return res.status(200).json({ success: true, data });
}

export default withRoleGuard(handler, { allow: ROLES });
