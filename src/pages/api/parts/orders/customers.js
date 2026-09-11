// Role-guarded customer and trade-account search for parts order entry.
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { PARTS_ORDER_ROLES } from "@/lib/auth/roles";
import { searchPartsOrderCustomers } from "@/lib/database/partsOrders";

export async function partsOrderCustomersHandler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const customers = await searchPartsOrderCustomers(req.query.search);
    return res.status(200).json({ success: true, customers });
  } catch (error) {
    console.error("Parts order customer search failed:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Unable to search customers",
    });
  }
}

export default withRoleGuard(partsOrderCustomersHandler, { allow: PARTS_ORDER_ROLES });
