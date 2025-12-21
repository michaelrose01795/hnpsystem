// file location: src/pages/api/parts/orders.js
// Provides a service-side endpoint for parts orders so client pages can fetch them safely.
import { getPartsOrders } from "@/lib/database/partsOrders";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const orders = await getPartsOrders();
    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("Failed to load parts orders:", error);
    res.status(500).json({ success: false, message: "Unable to load parts orders" });
  }
}
