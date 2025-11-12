// file location: src/pages/api/parts/jobs/[jobPartId].js
import {
  getJobPartById,
  updateJobPart,
  deleteJobPart,
  adjustPartQuantities,
  recordStockMovement,
  getPartById,
} from "@/lib/database/parts";

const PRE_PICK_LOCATIONS = new Set([
  "service_rack_1",
  "service_rack_2",
  "service_rack_3",
  "service_rack_4",
  "sales_rack_1",
  "sales_rack_2",
  "sales_rack_3",
  "sales_rack_4",
  "stairs_pre_pick",
]);

const parseInteger = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export default async function handler(req, res) {
  const { jobPartId } = req.query;

  if (!jobPartId || typeof jobPartId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Job part ID is required",
    });
  }

  const existingResult = await getJobPartById(jobPartId);

  if (!existingResult.success) {
    return res.status(404).json({
      success: false,
      message: "Job part not found",
      error: existingResult.error?.message || existingResult.error,
    });
  }

  const existing = existingResult.data;
  const partInfo =
    existing.part ||
    (await getPartById(existing.part_id).then((r) =>
      r.success ? r.data : null
    ));

  if (!partInfo) {
    return res.status(500).json({
      success: false,
      message: "Failed to load part details for job item",
    });
  }

  if (req.method === "PATCH") {
    const {
      userId,
      status,
      quantityAllocated,
      quantityFitted,
      prePickLocation,
      storageLocation,
      unitCost,
      unitPrice,
      requestNotes,
    } = req.body || {};

    const updates = {};
    const movements = [];
    const adjustmentsToApply = [];

    const newAllocated =
      quantityAllocated !== undefined
        ? Math.max(0, parseInteger(quantityAllocated, 0))
        : existing.quantity_allocated || 0;

    const newFitted =
      quantityFitted !== undefined
        ? Math.max(0, parseInteger(quantityFitted, 0))
        : existing.quantity_fitted || 0;

    const allocatedDelta =
      quantityAllocated !== undefined
        ? newAllocated - (existing.quantity_allocated || 0)
        : 0;

    const fittedDelta =
      quantityFitted !== undefined
        ? newFitted - (existing.quantity_fitted || 0)
        : 0;

    if (allocatedDelta > 0 && partInfo.qty_in_stock < allocatedDelta) {
      return res.status(409).json({
        success: false,
        message: `Insufficient stock. Available: ${partInfo.qty_in_stock}`,
      });
    }

    if (quantityAllocated !== undefined) {
      updates.quantity_allocated = newAllocated;
      if (allocatedDelta !== 0) {
        adjustmentsToApply.push({
          stockDelta: -allocatedDelta,
          reservedDelta: allocatedDelta,
          onOrderDelta: 0,
        });
        movements.push({
          type: allocatedDelta > 0 ? "allocation" : "return",
          quantity:
            allocatedDelta > 0 ? -allocatedDelta : Math.abs(allocatedDelta),
        });
      }
    }

    if (quantityFitted !== undefined) {
      updates.quantity_fitted = newFitted;
      if (fittedDelta !== 0) {
        adjustmentsToApply.push({
          stockDelta: 0,
          reservedDelta: -fittedDelta,
          onOrderDelta: 0,
        });
        if (fittedDelta > 0) {
          movements.push({
            type: "adjustment",
            quantity: -fittedDelta,
          });
        }
      }
    }

    if (status !== undefined) {
      updates.status = status;
      if (
        status === "cancelled" &&
        existing.status !== "cancelled" &&
        (quantityAllocated === undefined ||
          newAllocated >= existing.quantity_allocated)
      ) {
        const outstanding =
          (quantityAllocated !== undefined
            ? newAllocated
            : existing.quantity_allocated || 0) -
          (quantityFitted !== undefined
            ? newFitted
            : existing.quantity_fitted || 0);

        if (outstanding > 0) {
          adjustmentsToApply.push({
            stockDelta: outstanding,
            reservedDelta: -outstanding,
            onOrderDelta: 0,
          });
          movements.push({
            type: "return",
            quantity: outstanding,
          });
          updates.quantity_allocated = Math.max(
            0,
            ((updates.quantity_allocated ?? existing.quantity_allocated) || 0) -
              outstanding
          );
        }
      }
    }

    if (prePickLocation !== undefined) {
      updates.pre_pick_location = PRE_PICK_LOCATIONS.has(prePickLocation)
        ? prePickLocation
        : null;
    }

    if (storageLocation !== undefined) {
      updates.storage_location = storageLocation || null;
    }

    if (requestNotes !== undefined) {
      updates.request_notes =
        typeof requestNotes === "string" && requestNotes.trim().length > 0
          ? requestNotes
          : null;
    }

    if (unitCost !== undefined) {
      const parsed = Number.parseFloat(unitCost);
      updates.unit_cost = Number.isNaN(parsed) ? existing.unit_cost : parsed;
    }

    if (unitPrice !== undefined) {
      const parsed = Number.parseFloat(unitPrice);
      updates.unit_price = Number.isNaN(parsed) ? existing.unit_price : parsed;
    }

    const appliedAdjustments = [];

    for (const adj of adjustmentsToApply) {
      if (
        adj.stockDelta === 0 &&
        adj.reservedDelta === 0 &&
        adj.onOrderDelta === 0
      ) {
        continue;
      }

      const result = await adjustPartQuantities(existing.part_id, adj);
      if (!result.success) {
        // Roll back any prior adjustments
        for (const applied of appliedAdjustments.reverse()) {
          await adjustPartQuantities(existing.part_id, {
            stockDelta: -applied.stockDelta,
            reservedDelta: -applied.reservedDelta,
            onOrderDelta: -(applied.onOrderDelta || 0),
          });
        }

        return res.status(500).json({
          success: false,
          message: "Failed to adjust stock levels",
          error: result.error?.message || result.error,
        });
      }

      appliedAdjustments.push(adj);
    }

    const updateResult = await updateJobPart(jobPartId, updates, { userId });

    if (!updateResult.success) {
      for (const applied of appliedAdjustments.reverse()) {
        await adjustPartQuantities(existing.part_id, {
          stockDelta: -applied.stockDelta,
          reservedDelta: -applied.reservedDelta,
          onOrderDelta: -(applied.onOrderDelta || 0),
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to update job part",
        error: updateResult.error?.message || updateResult.error,
      });
    }

    const updatedJobPart = updateResult.data;

    if (movements.length > 0) {
      for (const movement of movements) {
        await recordStockMovement({
          part_id: existing.part_id,
          job_item_id: existing.id,
          movement_type: movement.type,
          quantity: movement.quantity,
          unit_cost: updatedJobPart.unit_cost || existing.unit_cost || 0,
          unit_price: updatedJobPart.unit_price || existing.unit_price || 0,
          performed_by: userId || null,
          reference: `job:${existing.job_id}`,
          notes: requestNotes || existing.request_notes || null,
        });
      }
    }

    return res.status(200).json({
      success: true,
      jobPart: updatedJobPart,
    });
  }

  if (req.method === "DELETE") {
    const outstanding =
      (existing.quantity_allocated || 0) - (existing.quantity_fitted || 0);

    if (outstanding > 0) {
      const adjustResult = await adjustPartQuantities(existing.part_id, {
        stockDelta: outstanding,
        reservedDelta: -outstanding,
        onOrderDelta: 0,
      });

      if (!adjustResult.success) {
        return res.status(500).json({
          success: false,
          message: "Failed to release reserved stock before deletion",
          error: adjustResult.error?.message || adjustResult.error,
        });
      }

      await recordStockMovement({
        part_id: existing.part_id,
        job_item_id: existing.id,
        movement_type: "return",
        quantity: outstanding,
        unit_cost: existing.unit_cost || 0,
        unit_price: existing.unit_price || 0,
        performed_by: req.body?.userId || null,
        reference: `delete:${existing.job_id}`,
        notes: "Job part deleted, stock returned",
      });
    }

    const deleteResult = await deleteJobPart(jobPartId);

    if (!deleteResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete job part",
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
