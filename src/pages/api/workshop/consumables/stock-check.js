// file location: src/pages/api/workshop/consumables/stock-check.js
import {
  addTemporaryConsumables,
  createConsumableLocation,
  deleteConsumable,
  getConsumablesGroupedByLocation,
  listConsumableStockChecks,
  moveConsumable,
  renameConsumable,
  renameConsumableLocation,
  submitStockCheckRequest,
  updateStockCheckStatus,
} from "@/lib/consumables";

async function buildSnapshot() {
  const [{ locations, unassigned }, stockChecks] = await Promise.all([
    getConsumablesGroupedByLocation(),
    listConsumableStockChecks(),
  ]);

  return { locations, unassigned, stockChecks };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const data = await buildSnapshot();
      return res.status(200).json({ success: true, data });
    }

    if (req.method === "POST") {
      const { action } = req.body || {};
      if (!action) {
        return res.status(400).json({ success: false, message: "action is required." });
      }

      switch (action) {
        case "addTemporary": {
          const { items } = req.body || {};
          if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "At least one temporary item is required." });
          }
          await addTemporaryConsumables(items);
          const data = await buildSnapshot();
          return res.status(201).json({ success: true, data });
        }
        case "submit": {
          const { consumableIds, technicianId } = req.body || {};
          if (!Array.isArray(consumableIds) || consumableIds.length === 0) {
            return res.status(400).json({ success: false, message: "Select at least one consumable." });
          }
          await submitStockCheckRequest({ consumableIds, technicianId: technicianId ?? null });
          const data = await buildSnapshot();
          return res.status(201).json({ success: true, data });
        }
        case "renameConsumable": {
          const { consumableId, name } = req.body || {};
          if (!consumableId || !name) {
            return res.status(400).json({ success: false, message: "consumableId and name are required." });
          }
          await renameConsumable(consumableId, name);
          const data = await buildSnapshot();
          return res.status(200).json({ success: true, data });
        }
        case "deleteConsumable": {
          const { consumableId } = req.body || {};
          if (!consumableId) {
            return res.status(400).json({ success: false, message: "consumableId is required." });
          }
          await deleteConsumable(consumableId);
          const data = await buildSnapshot();
          return res.status(200).json({ success: true, data });
        }
        case "moveConsumable": {
          const { consumableId, locationId } = req.body || {};
          if (!consumableId) {
            return res.status(400).json({ success: false, message: "consumableId is required." });
          }
          await moveConsumable({ id: consumableId, locationId: locationId || null });
          const data = await buildSnapshot();
          return res.status(200).json({ success: true, data });
        }
        case "createLocation": {
          const { name } = req.body || {};
          if (!name) {
            return res.status(400).json({ success: false, message: "Location name is required." });
          }
          await createConsumableLocation(name);
          const data = await buildSnapshot();
          return res.status(201).json({ success: true, data });
        }
        case "renameLocation": {
          const { locationId, name } = req.body || {};
          if (!locationId || !name) {
            return res.status(400).json({ success: false, message: "locationId and name are required." });
          }
          await renameConsumableLocation(locationId, name);
          const data = await buildSnapshot();
          return res.status(200).json({ success: true, data });
        }
        case "updateRequestStatus": {
          const { requestId, status } = req.body || {};
          if (!requestId || !status) {
            return res.status(400).json({ success: false, message: "requestId and status are required." });
          }
          await updateStockCheckStatus(requestId, status);
          const data = await buildSnapshot();
          return res.status(200).json({ success: true, data });
        }
        default:
          return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
      }
    }

    return res.status(405).json({ success: false, message: "Method not allowed." });
  } catch (error) {
    console.error("❌ /api/workshop/consumables/stock-check error", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}
