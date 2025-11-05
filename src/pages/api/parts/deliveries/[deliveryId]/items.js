// file location: src/pages/api/parts/deliveries/[deliveryId]/items.js
import {
  createDeliveryItem,
  adjustPartQuantities,
  recordStockMovement,
} from "@/lib/database/parts";

const parseInteger = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export default async function handler(req, res) {
  const { deliveryId } = req.query;

  if (!deliveryId || typeof deliveryId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Delivery ID is required",
    });
  }

  if (req.method === "POST") {
    const {
      partId,
      jobId,
      quantityOrdered,
      quantityReceived,
      unitCost,
      unitPrice,
      status,
      notes,
      userId,
    } = req.body || {};

    if (!partId) {
      return res.status(400).json({
        success: false,
        message: "Part ID is required",
      });
    }

    const orderedQty = Math.max(0, parseInteger(quantityOrdered, 0));
    const receivedQty = Math.max(0, parseInteger(quantityReceived, 0));

    const itemPayload = {
      part_id: partId,
      job_id: jobId || null,
      quantity_ordered: orderedQty,
      quantity_received: receivedQty,
      unit_cost: parseNumber(unitCost),
      unit_price: parseNumber(unitPrice),
      status:
        status ||
        (receivedQty > 0
          ? receivedQty >= orderedQty
            ? "received"
            : "partial"
          : "ordered"),
      notes: notes || null,
    };

    const createdItemResult = await createDeliveryItem(
      deliveryId,
      itemPayload,
      { userId }
    );

    if (!createdItemResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to create delivery item",
        error: createdItemResult.error?.message || createdItemResult.error,
      });
    }

    const appliedAdjustments = [];

    if (orderedQty > 0) {
      const adjust = await adjustPartQuantities(partId, {
        stockDelta: 0,
        reservedDelta: 0,
        onOrderDelta: orderedQty,
      });

      if (!adjust.success) {
        await adjustPartQuantities(partId, {
          stockDelta: 0,
          reservedDelta: 0,
          onOrderDelta: -orderedQty,
        });

        return res.status(500).json({
          success: false,
          message: "Failed to queue ordered quantity",
          error: adjust.error?.message || adjust.error,
        });
      }

      appliedAdjustments.push({
        stockDelta: 0,
        reservedDelta: 0,
        onOrderDelta: orderedQty,
      });
    }

    if (receivedQty > 0) {
      const adjust = await adjustPartQuantities(partId, {
        stockDelta: receivedQty,
        reservedDelta: 0,
        onOrderDelta: -Math.min(receivedQty, orderedQty),
      });

      if (!adjust.success) {
        // rollback previous adjustments
        for (const adj of appliedAdjustments.reverse()) {
          await adjustPartQuantities(partId, {
            stockDelta: -adj.stockDelta,
            reservedDelta: -adj.reservedDelta,
            onOrderDelta: -(adj.onOrderDelta || 0),
          });
        }

        return res.status(500).json({
          success: false,
          message: "Failed to post received quantity to stock",
          error: adjust.error?.message || adjust.error,
        });
      }

      appliedAdjustments.push({
        stockDelta: receivedQty,
        reservedDelta: 0,
        onOrderDelta: -Math.min(receivedQty, orderedQty),
      });

      await recordStockMovement({
        part_id: partId,
        delivery_item_id: createdItemResult.data.id,
        movement_type: "delivery",
        quantity: receivedQty,
        unit_cost:
          createdItemResult.data.unit_cost ??
          parseNumber(unitCost) ??
          0,
        unit_price:
          createdItemResult.data.unit_price ??
          parseNumber(unitPrice) ??
          0,
        performed_by: userId || null,
        reference: `delivery:${deliveryId}`,
        notes: notes || null,
      });
    }

    return res.status(201).json({
      success: true,
      deliveryItem: createdItemResult.data,
    });
  }

  res.setHeader("Allow", ["POST"]);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  });
}
