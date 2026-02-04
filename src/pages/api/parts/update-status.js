// API endpoint for updating part status, location, and related fields
// file location: src/pages/api/parts/update-status.js

import { supabase } from "@/lib/supabaseClient";
import { syncVhcPartsAuthorisation } from "@/lib/database/vhcPartsSync";

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      partItemId,
      status,
      prePickLocation,
      stockStatus,
      etaDate,
      etaTime,
      supplierReference,
      authorised,
    } = req.body;

    if (!partItemId) {
      return res.status(400).json({ error: "partItemId is required" });
    }

    let reservationDelta = 0;
    let reservationPartId = null;
    let vhcContext = null;
    const shouldLoadContext = authorised !== undefined || prePickLocation !== undefined;
    if (shouldLoadContext) {
      const { data: existingItem, error: itemError } = await supabase
        .from("parts_job_items")
        .select("id, job_id, vhc_item_id, origin, part_id, quantity_requested, authorised")
        .eq("id", partItemId)
        .single();

      if (itemError || !existingItem) {
        return res.status(404).json({
          error: "Part item not found",
          details: itemError?.message,
        });
      }

      vhcContext = existingItem;

      if (authorised !== undefined) {
        const wasAuthorised = existingItem.authorised === true;
        const nextAuthorised = Boolean(authorised);
        const quantity = Number(existingItem.quantity_requested || 0);

        if (quantity > 0 && nextAuthorised !== wasAuthorised) {
          reservationDelta = nextAuthorised ? quantity : -quantity;
          reservationPartId = existingItem.part_id;
        }
      }
    }

    // Build update object dynamically based on provided fields
    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) updates.status = status;
    if (prePickLocation !== undefined) updates.pre_pick_location = prePickLocation;
    if (stockStatus !== undefined) updates.stock_status = stockStatus;
    if (etaDate !== undefined) updates.eta_date = etaDate;
    if (etaTime !== undefined) updates.eta_time = etaTime;
    if (supplierReference !== undefined) updates.supplier_reference = supplierReference;
    if (authorised !== undefined) updates.authorised = authorised;

    // Special handling: If moving to "on_order", ensure status is set
    if (prePickLocation === "on_order" && !status) {
      updates.status = "on_order";
    }

    // Special handling: If marking as "Here" (back from on_order), update stock status and status
    if (stockStatus === "in_stock" && !status) {
      updates.status = "stock";
    }

    const { data, error } = await supabase
      .from("parts_job_items")
      .update(updates)
      .eq("id", partItemId)
      .select()
      .single();

    if (error) {
      console.error("Error updating part status:", error);
      return res.status(500).json({ error: "Failed to update part status", details: error.message });
    }

    if (reservationDelta !== 0 && reservationPartId) {
      const { data: partRow, error: partError } = await supabase
        .from("parts_catalog")
        .select("qty_reserved")
        .eq("id", reservationPartId)
        .single();

      if (partError) {
        console.error("Error fetching part for reservation update:", partError);
        return res.status(500).json({
          error: "Failed to update reserved stock",
          details: partError.message,
        });
      }

      const currentReserved = Number(partRow?.qty_reserved || 0);
      const nextReserved = Math.max(0, currentReserved + reservationDelta);

      if (nextReserved !== currentReserved) {
        const { error: updateError } = await supabase
          .from("parts_catalog")
          .update({ qty_reserved: nextReserved, updated_at: new Date().toISOString() })
          .eq("id", reservationPartId);

        if (updateError) {
          console.error("Error updating reserved stock:", updateError);
          return res.status(500).json({
            error: "Failed to update reserved stock",
            details: updateError.message,
          });
        }
      }
    }

    // Keep VHC approval + vhc_authorised job_requests + rectification in sync when a VHC-linked part is updated.
    if (data?.vhc_item_id) {
      try {
        await syncVhcPartsAuthorisation({
          jobId: data.job_id,
          vhcItemId: data.vhc_item_id,
        });
      } catch (syncError) {
        // Log the sync error but don't fail the entire request
        // The part status was already updated successfully
        console.error("VHC sync error (non-blocking):", syncError);
      }
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Unexpected error in update-status API:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
