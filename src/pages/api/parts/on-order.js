// API endpoint to fetch parts on order for a specific job
// file location: src/pages/api/parts/on-order.js

import { getDatabaseClient } from "@/lib/database/client";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { jobId } = req.query;

  if (!jobId) {
    return res.status(400).json({ success: false, message: "Job ID is required" });
  }

  const supabase = getDatabaseClient();

  try {
    // Query parts_job_items with status 'on_order' for this job
    const { data, error } = await supabase
      .from("parts_job_items")
      .select(`
        id,
        part_id,
        quantity_requested,
        quantity_allocated,
        quantity_fitted,
        status,
        origin,
        unit_cost,
        unit_price,
        eta_date,
        eta_time,
        supplier_reference,
        created_at,
        parts_catalog:part_id(
          id,
          part_number,
          name,
          description
        )
      `)
      .eq("job_id", jobId)
      .eq("status", "on_order")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Format the response
    const formattedParts = data.map((item) => ({
      id: item.id,
      partId: item.part_id,
      partNumber: item.parts_catalog?.part_number || "N/A",
      partName: item.parts_catalog?.name || "Unknown",
      description: item.parts_catalog?.description || "",
      quantity: item.quantity_requested || 1,
      unitPrice: item.unit_price || 0,
      unitCost: item.unit_cost || 0,
      etaDate: item.eta_date || null,
      etaTime: item.eta_time || null,
      supplierReference: item.supplier_reference || null,
      status: item.status,
      origin: item.origin,
    }));

    return res.status(200).json({
      success: true,
      parts: formattedParts,
      count: formattedParts.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch parts on order",
    });
  }
}
