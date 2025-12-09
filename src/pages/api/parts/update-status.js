// API endpoint for updating part status, location, and related fields
// file location: src/pages/api/parts/update-status.js

import { supabase } from "@/lib/supabaseClient";

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

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Unexpected error in update-status API:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
