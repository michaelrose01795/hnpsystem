// file location: src/pages/api/workshop/consumables/requests.js
import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  createConsumableReorderRequest,
  createConsumableRequestRows,
  listConsumableRequestRows,
  markConsumableRequestArrived,
  updateConsumableRequest,
} from "@/lib/database/consumables";

const formatRequestRow = (row) => ({
  id: row.id,
  itemName: row.item_name,
  quantity: row.quantity,
  requestedById: row.requested_by,
  requestedByName: row.requested_by_name,
  consumableId: row.consumable_id,
  status: row.status,
  requestedAt: row.requested_at,
  arrivedAt: row.arrived_at,
  updatedAt: row.updated_at,
});

const ALLOWED_STATUSES = new Set(["pending", "urgent", "ordered", "arrived", "rejected"]);

async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const data = await listConsumableRequestRows();

      return res
        .status(200)
        .json({ success: true, data: (data || []).map(formatRequestRow) });
    }

    if (req.method === "POST") {
      const { action, sourceRequestId, consumableId, itemName, quantity, requestedById, requestedByName, items } = req.body || {};
      if (action === "reorder") {
        if (!sourceRequestId || !consumableId) {
          return res.status(400).json({ success: false, message: "sourceRequestId and consumableId are required." });
        }
        const normalizedQuantity = Math.min(999, Math.max(1, Number.parseInt(quantity, 10) || 1));
        const newRow = await createConsumableReorderRequest({
          sourceRequestId,
          consumableId,
          quantity: normalizedQuantity,
        });
        return res.status(201).json({ success: true, data: [formatRequestRow(newRow)] });
      }

      const requestedItems = Array.isArray(items)
        ? items
        : [{ itemName, quantity }];
      const validItems = requestedItems
        .map((item) => ({
          itemName: (item?.itemName || "").trim(),
          quantity: Math.min(999, Math.max(1, Number.parseInt(item?.quantity, 10) || 1)),
        }))
        .filter((item) => Boolean(item.itemName));

      if (!validItems.length) {
        return res
          .status(400)
          .json({ success: false, message: "At least one consumable is required." });
      }

      const rows = validItems.map((item) => ({
        item_name: item.itemName,
        quantity: item.quantity,
        requested_by: requestedById || null,
        requested_by_name: requestedByName || null,
      }));

      const newRows = await createConsumableRequestRows(rows);

      return res.status(201).json({
        success: true,
        data: (newRows || []).map(formatRequestRow),
      });
    }

    if (req.method === "PATCH") {
      const { id, status, consumableId, quantity } = req.body || {};
      if (!id || !status) {
        return res
          .status(400)
          .json({ success: false, message: "id and status are required." });
      }
      if (!ALLOWED_STATUSES.has(status)) {
        return res.status(400).json({ success: false, message: "Unsupported request status." });
      }

      if (status === "arrived") {
        if (!consumableId) {
          return res.status(400).json({ success: false, message: "consumableId is required when an order arrives." });
        }
        await markConsumableRequestArrived({ requestId: id, consumableId });
      } else {
        const normalizedQuantity = quantity === undefined
          ? undefined
          : Math.min(999, Math.max(1, Number.parseInt(quantity, 10) || 1));
        await updateConsumableRequest({
          id,
          status,
          consumableId,
          quantity: normalizedQuantity,
        });
      }

      const data = await listConsumableRequestRows();

      return res
        .status(200)
        .json({ success: true, data: (data || []).map(formatRequestRow) });
    }

    return res
      .status(405)
      .json({ success: false, message: "Method not allowed." });
  } catch (error) {
    console.error("❌ /api/workshop/consumables/requests error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
}

export default withRoleGuard(handler);
