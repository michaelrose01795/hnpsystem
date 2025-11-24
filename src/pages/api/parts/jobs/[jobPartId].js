// file location: src/pages/api/parts/jobs/[jobPartId].js

import { supabase } from "@/lib/supabaseClient";

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

const PART_COLUMNS = [
  "id",
  "part_number",
  "name",
  "supplier",
  "storage_location",
  "qty_in_stock",
  "qty_reserved",
  "qty_on_order",
  "unit_cost",
  "unit_price",
].join(",");

export default async function handler(req, res) {
  const { jobPartId } = req.query;

  if (!jobPartId || typeof jobPartId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Job part ID is required",
    });
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from("parts_job_items")
      .select(`*, part:parts_catalog(${PART_COLUMNS})`)
      .eq("id", jobPartId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        message: "Job part not found",
        error: fetchError?.message,
      });
    }

    const partInfo = existing.part;

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
      const now = new Date().toISOString();
      let stockNeedsUpdate = false;
      let newStock = Number(partInfo.qty_in_stock || 0);
      let newReserved = Number(partInfo.qty_reserved || 0);

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
          newStock -= allocatedDelta;
          newReserved += allocatedDelta;
          stockNeedsUpdate = true;
        }
      }

      if (quantityFitted !== undefined) {
        updates.quantity_fitted = newFitted;
        if (fittedDelta !== 0) {
          newReserved -= fittedDelta;
          stockNeedsUpdate = true;
        }
      }

      if (status !== undefined) {
        updates.status = status;
        if (status === "cancelled" && existing.status !== "cancelled") {
          const outstanding =
            (quantityAllocated !== undefined ? newAllocated : existing.quantity_allocated || 0) -
            (quantityFitted !== undefined ? newFitted : existing.quantity_fitted || 0);

          if (outstanding > 0) {
            newStock += outstanding;
            newReserved -= outstanding;
            stockNeedsUpdate = true;
            updates.quantity_allocated = Math.max(0, newAllocated - outstanding);
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

      updates.updated_at = now;
      if (userId) {
        updates.updated_by = userId;
      }

      if (stockNeedsUpdate) {
        const { error: invError } = await supabase
          .from("parts_catalog")
          .update({
            qty_in_stock: newStock,
            qty_reserved: newReserved,
            updated_at: now,
            updated_by: userId || null,
          })
          .eq("id", existing.part_id);

        if (invError) throw invError;
      }

      const { data: updated, error: updateError } = await supabase
        .from("parts_job_items")
        .update(updates)
        .eq("id", jobPartId)
        .select(`*, part:parts_catalog(${PART_COLUMNS})`)
        .single();

      if (updateError) throw updateError;

      return res.status(200).json({
        success: true,
        jobPart: updated,
      });
    }

    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
    });
  } catch (error) {
    console.error("Error updating job part:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update job part",
      error: error.message,
    });
  }
}
