// file location: src/pages/api/parts/deliveries/index.js
import {
  listDeliveries,
  createDelivery,
  createDeliveryItem,
  deleteDelivery,
  deleteDeliveryItem,
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
  if (req.method === "GET") {
    const {
      status = "all",
      limit = "50",
      offset = "0",
    } = req.query;

    const result = await listDeliveries({
      status,
      limit: Number.parseInt(limit, 10) || 50,
      offset: Number.parseInt(offset, 10) || 0,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch deliveries",
        error: result.error?.message || result.error,
      });
    }

    return res.status(200).json({
      success: true,
      deliveries: result.data,
      count: result.count,
    });
  }

  if (req.method === "POST") {
    const { items = [], userId, ...deliveryData } = req.body || {};

    const deliveryPayload = {
      supplier: deliveryData.supplier || null,
      order_reference: deliveryData.orderReference || null,
      status: deliveryData.status || "ordering",
      expected_date: deliveryData.expectedDate || null,
      received_date: deliveryData.receivedDate || null,
      notes: deliveryData.notes || null,
    };

    const deliveryResult = await createDelivery(deliveryPayload, { userId });

    if (!deliveryResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to create delivery",
        error: deliveryResult.error?.message || deliveryResult.error,
      });
    }

    const delivery = deliveryResult.data;
    const createdItems = [];
    const appliedAdjustments = [];

    try {
      for (const item of items) {
        if (!item.partId) continue;

        const quantityOrdered = Math.max(
          0,
          parseInteger(item.quantityOrdered, 0)
        );
        const quantityReceived = Math.max(
          0,
          parseInteger(item.quantityReceived, 0)
        );

        const itemPayload = {
          part_id: item.partId,
          job_id: item.jobId || null,
          quantity_ordered: quantityOrdered,
          quantity_received: quantityReceived,
          unit_cost: parseNumber(item.unitCost),
          unit_price: parseNumber(item.unitPrice),
          status:
            item.status ||
            (quantityReceived > 0
              ? quantityReceived >= quantityOrdered
                ? "received"
                : "partial"
              : "ordered"),
          notes: item.notes || null,
        };

        const itemResult = await createDeliveryItem(
          delivery.id,
          itemPayload,
          { userId }
        );

        if (!itemResult.success) {
          throw itemResult.error || new Error("Failed to create delivery item");
        }

        createdItems.push(itemResult.data);

        if (quantityOrdered > 0) {
          const adjust = await adjustPartQuantities(item.partId, {
            stockDelta: 0,
            reservedDelta: 0,
            onOrderDelta: quantityOrdered,
          });

          if (!adjust.success) {
            throw adjust.error || new Error("Failed to queue ordered stock");
          }

          appliedAdjustments.push({
            partId: item.partId,
            stockDelta: 0,
            reservedDelta: 0,
            onOrderDelta: quantityOrdered,
          });
        }

        if (quantityReceived > 0) {
          const adjust = await adjustPartQuantities(item.partId, {
            stockDelta: quantityReceived,
            reservedDelta: 0,
            onOrderDelta: -Math.min(quantityReceived, quantityOrdered),
          });

          if (!adjust.success) {
            throw adjust.error || new Error("Failed to receive stock");
          }

          appliedAdjustments.push({
            partId: item.partId,
            stockDelta: quantityReceived,
            reservedDelta: 0,
            onOrderDelta: -Math.min(quantityReceived, quantityOrdered),
          });

          await recordStockMovement({
            part_id: item.partId,
            delivery_item_id: itemResult.data.id,
            movement_type: "delivery",
            quantity: quantityReceived,
            unit_cost:
              itemResult.data.unit_cost ??
              parseNumber(item.unitCost) ??
              0,
            unit_price:
              itemResult.data.unit_price ??
              parseNumber(item.unitPrice) ??
              0,
            performed_by: userId || null,
            reference: `delivery:${delivery.id}`,
            notes: item.notes || null,
          });
        }
      }
    } catch (err) {
      for (const adjustment of appliedAdjustments.reverse()) {
        await adjustPartQuantities(adjustment.partId, {
          stockDelta: -adjustment.stockDelta,
          reservedDelta: -adjustment.reservedDelta,
          onOrderDelta: -(adjustment.onOrderDelta || 0),
        });
      }

      for (const created of createdItems.reverse()) {
        await deleteDeliveryItem(created.id);
      }

      await deleteDelivery(delivery.id);

      return res.status(500).json({
        success: false,
        message: err?.message || "Failed to process delivery items",
        error: err?.message || err,
      });
    }

    return res.status(201).json({
      success: true,
      delivery: {
        ...delivery,
        delivery_items: createdItems,
      },
    });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  });
}
