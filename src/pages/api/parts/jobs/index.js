// file location: src/pages/api/parts/jobs/index.js
import {
  fetchJobWithParts,
  createJobPart,
  getPartById,
  adjustPartQuantities,
  recordStockMovement,
  deleteJobPart,
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

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }
  return Boolean(value);
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { search } = req.query;

    if (!search) {
      return res.status(400).json({
        success: false,
        message: "Search query (job number or registration) is required",
      });
    }

    const result = await fetchJobWithParts(search);

    if (!result.success) {
      const status =
        result.error?.message ===
        "Job card not found for provided search term"
          ? 404
          : 500;

      return res.status(status).json({
        success: false,
        message: result.error?.message || "Failed to fetch job card details",
      });
    }

    return res.status(200).json({
      success: true,
      job: result.data.job,
      parts: result.data.parts,
    });
  }

  if (req.method === "POST") {
    const {
      jobId,
      partId,
      quantityRequested,
      quantity,
      allocateFromStock,
      prePickLocation,
      storageLocation,
      status,
      origin,
      unitCost,
      unitPrice,
      requestNotes,
      userId,
    } = req.body || {};

    if (!jobId || !partId) {
      return res.status(400).json({
        success: false,
        message: "Job ID and part ID are required",
      });
    }

    const requestedQuantityRaw =
      quantityRequested ?? quantity ?? req.body?.quantity_allocated ?? 1;
    const requestedQuantity = Math.max(
      1,
      Number.parseInt(requestedQuantityRaw, 10) || 1
    );

    const shouldAllocate = toBoolean(allocateFromStock);
    let resolvedUnitCost = unitCost;
    let resolvedUnitPrice = unitPrice;
    let resolvedStorageLocation = storageLocation || null;

    const partResult = await getPartById(partId);
    if (!partResult.success) {
      return res.status(404).json({
        success: false,
        message: "Part not found in catalogue",
        error: partResult.error?.message || partResult.error,
      });
    }

    const part = partResult.data;

    resolvedUnitCost =
      typeof resolvedUnitCost === "number"
        ? resolvedUnitCost
        : Number.parseFloat(resolvedUnitCost);

    resolvedUnitPrice =
      typeof resolvedUnitPrice === "number"
        ? resolvedUnitPrice
        : Number.parseFloat(resolvedUnitPrice);

    if (Number.isNaN(resolvedUnitCost)) {
      resolvedUnitCost = part.unit_cost || 0;
    }

    if (Number.isNaN(resolvedUnitPrice)) {
      resolvedUnitPrice = part.unit_price || 0;
    }

    if (!resolvedStorageLocation) {
      resolvedStorageLocation = part.storage_location || null;
    }

    if (shouldAllocate && part.qty_in_stock < requestedQuantity) {
      return res.status(409).json({
        success: false,
        message: `Insufficient stock. Available: ${part.qty_in_stock}`,
      });
    }

    const sanitizedPrePick =
      typeof prePickLocation === "string" &&
      PRE_PICK_LOCATIONS.has(prePickLocation)
        ? prePickLocation
        : null;

    const jobPartPayload = {
      part_id: partId,
      quantity_requested: requestedQuantity,
      quantity_allocated: shouldAllocate ? requestedQuantity : 0,
      status:
        status ||
        (shouldAllocate ? "allocated" : "awaiting_stock"),
      origin: origin || "vhc",
      pre_pick_location: sanitizedPrePick,
      storage_location: resolvedStorageLocation,
      unit_cost: resolvedUnitCost,
      unit_price: resolvedUnitPrice,
      request_notes: requestNotes || null,
      allocated_by: shouldAllocate ? userId || null : null,
    };

    const createResult = await createJobPart(jobId, jobPartPayload, {
      userId,
    });

    if (!createResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to create job part entry",
        error: createResult.error?.message || createResult.error,
      });
    }

    const newJobPart = createResult.data;

    if (shouldAllocate) {
      const adjustResult = await adjustPartQuantities(partId, {
        stockDelta: -requestedQuantity,
        reservedDelta: requestedQuantity,
      });

      if (!adjustResult.success) {
        await deleteJobPart(newJobPart.id);

        return res.status(500).json({
          success: false,
          message: "Failed to adjust stock levels for allocation",
          error: adjustResult.error?.message || adjustResult.error,
        });
      }

      await recordStockMovement({
        part_id: partId,
        job_item_id: newJobPart.id,
        movement_type: "allocation",
        quantity: -requestedQuantity,
        unit_cost: resolvedUnitCost,
        unit_price: resolvedUnitPrice,
        performed_by: userId || null,
        reference: `job:${jobId}`,
        notes: requestNotes || null,
      });
    }

    return res.status(201).json({
      success: true,
      jobPart: newJobPart,
    });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  });
}
