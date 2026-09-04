// file location: src/pages/api/parts/orders/[orderNumber].js
// Server-side detail and status updates for one parts order.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { PARTS_ORDER_ROLES } from "@/lib/auth/roles";
import {
  getPartsOrderByNumber,
  updatePartsOrderByNumber,
} from "@/lib/database/partsOrders";

export async function partsOrderDetailHandler(req, res) {
  const orderNumber = Array.isArray(req.query.orderNumber)
    ? req.query.orderNumber[0]
    : req.query.orderNumber;

  if (!orderNumber) {
    return res.status(400).json({ success: false, message: "An order number is required." });
  }

  try {
    if (req.method === "GET") {
      const order = await getPartsOrderByNumber(orderNumber);
      if (!order) {
        return res.status(404).json({ success: false, message: "Parts order not found." });
      }
      return res.status(200).json({ success: true, order });
    }

    if (req.method === "PATCH") {
      const order = await updatePartsOrderByNumber(orderNumber, req.body?.updates || {});
      if (!order) {
        return res.status(404).json({ success: false, message: "Parts order not found." });
      }
      return res.status(200).json({ success: true, order });
    }

    res.setHeader("Allow", ["GET", "PATCH"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error(`Parts order ${orderNumber} request failed:`, error);
    const isValidationError = /required|no supported order fields/i.test(error?.message || "");
    return res.status(isValidationError ? 400 : 500).json({
      success: false,
      message: error?.message || "Unable to process the parts order",
    });
  }
}

export default withRoleGuard(partsOrderDetailHandler, { allow: PARTS_ORDER_ROLES });
