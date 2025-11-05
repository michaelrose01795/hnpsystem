// file location: src/pages/api/parts/deliveries/items/[itemId].js
import {
  getDeliveryItemById,
  updateDeliveryItem,
  deleteDeliveryItem,
  adjustPartQuantities,
  recordStockMovement,
} from "@/lib/database/parts";

const parseInteger = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseNumber = (value, fallback) => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export default async function handler(req, res) {
  const { itemId } = req.query;

  if (!itemId || typeof itemId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Delivery item ID is required",
    });
  }

  const existingResult = await getDeliveryItemById(itemId);

  if (!existingResult.success) {
    return res.status(404).json({
      success: false,
      message: "Delivery item not found",
      error: existingResult.error?.message || existingResult.error,
    });
  }

  const existing = existingResult.data;

  if (req.method === "PATCH") {
    const {
      userId,
      quantityOrdered,
      quantityReceived,
      status,
      notes,
      unitCost,
      unitPrice,
    } = req.body || {};

    const newOrdered =
      quantityOrdered !== undefined
        ? Math.max(0, parseInteger(quantityOrdered, 0))
        : existing.quantity_ordered;

    const newReceived =
      quantityReceived !== undefined
        ? Math.max(0, parseInteger(quantityReceived, 0))
        : existing.quantity_received;

    const orderDelta = newOrdered - existing.quantity_ordered;
    const receivedDelta = newReceived - existing.quantity_received;
    const onOrderDelta = orderDelta - receivedDelta;
    const stockDelta = receivedDelta;

    const updates = {
      quantity_ordered: newOrdered,
      quantity_received: newReceived,
      status:
        status ||
        (newReceived > 0
          ? newReceived >= newOrdered
            ? "received"
            : "partial"
          : existing.status),
      notes: notes !== undefined ? notes : existing.notes,
      unit_cost:
        unitCost !== undefined
          ? parseNumber(unitCost, existing.unit_cost)
          : existing.unit_cost,
      unit_price:
        unitPrice !== undefined
          ? parseNumber(unitPrice, existing.unit_price)
          : existing.unit_price,
    };

    const appliedAdjustments = [];

    if (orderDelta !== 0 || receivedDelta !== 0) {
      const adjustmentResult = await adjustPartQuantities(existing.part_id, {
        stockDelta,
        reservedDelta: 0,
        onOrderDelta,
      });

      if (!adjustmentResult.success) {
        return res.status(500).json({
          success: false,
          message: "Failed to adjust inventory for delivery item",
          error: adjustmentResult.error?.message || adjustmentResult.error,
        });
      }

      appliedAdjustments.push({ stockDelta, onOrderDelta });
    }

    const updateResult = await updateDeliveryItem(itemId, updates, { userId });

    if (!updateResult.success) {
      for (const adj of appliedAdjustments.reverse()) {
        await adjustPartQuantities(existing.part_id, {
          stockDelta: -adj.stockDelta,
          reservedDelta: 0,
          onOrderDelta: -adj.onOrderDelta,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to update delivery item",
        error: updateResult.error?.message || updateResult.error,
      });
    }

    if (receivedDelta !== 0) {
      await recordStockMovement({
        part_id: existing.part_id,
        delivery_item_id: existing.id,
        movement_type: receivedDelta > 0 ? "delivery" : "correction",
        quantity: receivedDelta,
        unit_cost: updateResult.data.unit_cost || existing.unit_cost || 0,
        unit_price: updateResult.data.unit_price || existing.unit_price || 0,
        performed_by: userId || null,
        reference: `delivery:${existing.delivery_id}`,
        notes: notes || existing.notes || null,
      });
    }

    return res.status(200).json({
      success: true,
      deliveryItem: updateResult.data,
    });
  }

  if (req.method === "DELETE") {
    const outstanding =
      (existing.quantity_ordered || 0) - (existing.quantity_received || 0);
    const stockReduction = existing.quantity_received || 0;

    if (outstanding !== 0 || stockReduction !== 0) {
      const adjustResult = await adjustPartQuantities(existing.part_id, {
        stockDelta: -stockReduction,
        reservedDelta: 0,
        onOrderDelta: -outstanding,
      });

      if (!adjustResult.success) {
        return res.status(500).json({
          success: false,
          message: "Failed to reverse inventory for deleted item",
          error: adjustResult.error?.message || adjustResult.error,
        });
      }

      if (stockReduction !== 0) {
        await recordStockMovement({
          part_id: existing.part_id,
          delivery_item_id: existing.id,
          movement_type: "correction",
          quantity: -stockReduction,
          unit_cost: existing.unit_cost || 0,
          unit_price: existing.unit_price || 0,
          performed_by: req.body?.userId || null,
          reference: `delivery-delete:${existing.delivery_id}`,
          notes: "Delivery item removed",
        });
      }
    }

    const deleteResult = await deleteDeliveryItem(itemId);

    if (!deleteResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete delivery item",
        error: deleteResult.error?.message || deleteResult.error,
      });
    }

    return res.status(204).end();
  }

  res.setHeader("Allow", ["PATCH", "DELETE"]);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  });
}
