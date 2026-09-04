// file location: src/pages/api/parts/orders.js
// Provides a service-side endpoint for parts orders so client pages can fetch them safely.
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { PARTS_ORDER_ROLES } from "@/lib/auth/roles";
import { createPartsOrder, getPartsOrders } from "@/lib/database/partsOrders";

export async function partsOrdersHandler(req, res) {
  try {
    if (req.method === "GET") {
      const orders = await getPartsOrders({
        customerId: req.query.customerId,
        customerName: req.query.customerName,
        vehicleReg: req.query.vehicleReg,
        openOnly: req.query.openOnly === "true",
        limit: req.query.limit,
      });
      return res.status(200).json({ success: true, orders });
    }

    if (req.method === "POST") {
      const createInput = {
        order: req.body?.order || {},
        items: Array.isArray(req.body?.items) ? req.body.items : [],
      };
      if (req.body?.reserveStock === true) createInput.reserveStock = true;
      const order = await createPartsOrder(createInput);
      return res.status(201).json({ success: true, order });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Parts orders request failed:", error);
    const isValidationError = /required|at least one part/i.test(error?.message || "");
    return res.status(isValidationError ? 400 : 500).json({
      success: false,
      message: error?.message || "Unable to process the parts order",
    });
  }
}

export default withRoleGuard(partsOrdersHandler, { allow: PARTS_ORDER_ROLES });
