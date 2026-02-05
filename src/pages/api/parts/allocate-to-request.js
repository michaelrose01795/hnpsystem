// file location: src/pages/api/parts/allocate-to-request.js
// API endpoint to allocate a part to a specific job request

import { supabase } from "@/lib/supabaseClient";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { partAllocationId, requestId, jobId } = req.body;

    console.log("[ALLOCATE API] Request received:", { partAllocationId, requestId, jobId });

    // Validate inputs
    if (!partAllocationId || !requestId || !jobId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: partAllocationId, requestId, jobId",
      });
    }

    // Check if this is a VHC item allocation (format: "vhc-123")
    const isVhcAllocation = typeof requestId === "string" && requestId.startsWith("vhc-");

    console.log("[ALLOCATE API] Is VHC allocation:", isVhcAllocation);

    let updateData;
    let vhcItemIdForSync = null;
    if (isVhcAllocation) {
      // Extract the numeric VHC item ID from "vhc-123" format
      const vhcItemId = parseInt(requestId.replace("vhc-", ""), 10);
      if (isNaN(vhcItemId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid VHC item ID format",
        });
      }
      vhcItemIdForSync = vhcItemId;
      updateData = {
        vhc_item_id: vhcItemId,
        allocated_to_request_id: null, // Clear customer request allocation
        updated_at: new Date().toISOString(),
      };
      console.log("[ALLOCATE API] VHC update data:", updateData);
    } else {
      // Regular job request allocation
      updateData = {
        allocated_to_request_id: requestId,
        vhc_item_id: null, // Clear VHC allocation
        updated_at: new Date().toISOString(),
      };
      console.log("[ALLOCATE API] Customer request update data:", updateData);
    }

    // Update the parts_job_items table to link the part to the request
    const { data, error } = await supabase
      .from("parts_job_items")
      .update(updateData)
      .eq("id", partAllocationId)
      .eq("job_id", jobId)
      .select();

    if (error) {
      console.error("[ALLOCATE API] Database error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to allocate part to request",
      });
    }

    if (!data || data.length === 0) {
      console.error("[ALLOCATE API] No data returned - part not found or doesn't belong to job");
      return res.status(404).json({
        success: false,
        message: "Part allocation not found or does not belong to this job",
      });
    }

    console.log("[ALLOCATE API] Successfully updated part:", {
      id: data[0].id,
      vhc_item_id: data[0].vhc_item_id,
      allocated_to_request_id: data[0].allocated_to_request_id,
    });

    // Sync VHC status after allocating a part to a VHC item
    if (vhcItemIdForSync) {
      console.log("[ALLOCATE API] Running VHC sync for vhcItemId:", vhcItemIdForSync);
      try {
        await syncVhcPartsAuthorisation({
          jobId,
          vhcItemId: vhcItemIdForSync,
        });
        console.log("[ALLOCATE API] VHC sync completed successfully");
      } catch (syncError) {
        console.error("[ALLOCATE API] VHC sync error (non-blocking):", syncError);
      }
    }

    console.log("[ALLOCATE API] Returning success response");
    return res.status(200).json({
      success: true,
      message: "Part successfully allocated to request",
      data: data[0],
    });
  } catch (error) {
    console.error("Error in allocate-to-request API:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}
