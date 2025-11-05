// file location: src/pages/api/parts/deliveries/[deliveryId].js
import { updateDelivery } from "@/lib/database/parts";

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

export default async function handler(req, res) {
  const { deliveryId } = req.query;

  if (!deliveryId || typeof deliveryId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Delivery ID is required",
    });
  }

  if (req.method === "PATCH") {
    const { userId, ...updates } = req.body || {};

    const payload = {
      supplier: updates.supplier,
      order_reference: updates.orderReference,
      status: updates.status,
      expected_date: parseDate(updates.expectedDate),
      received_date: parseDate(updates.receivedDate),
      notes: updates.notes,
    };

    const result = await updateDelivery(deliveryId, payload, { userId });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to update delivery",
        error: result.error?.message || result.error,
      });
    }

    return res.status(200).json({
      success: true,
      delivery: result.data,
    });
  }

  res.setHeader("Allow", ["PATCH"]);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  });
}
