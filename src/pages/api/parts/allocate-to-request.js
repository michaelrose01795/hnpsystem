// file location: src/pages/api/parts/allocate-to-request.js
// API endpoint to allocate a part to a specific job request

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabase } from "@/lib/database/supabaseClient";
import { syncVhcPartsAuthorisation } from "@/lib/database/vhcPartsSync";

const buildVhcRowDescription = async ({ jobId, vhcItemId }) => {
  if (!jobId || !Number.isInteger(vhcItemId)) return null;

  const { data: checkRow, error } = await supabase
    .from("vhc_checks")
    .select("section, issue_title, issue_description, measurement, note_text")
    .eq("job_id", jobId)
    .eq("vhc_id", vhcItemId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch VHC row ${vhcItemId}: ${error.message}`);
  }
  if (!checkRow) return null;

  const raw = [
    checkRow.section,
    checkRow.issue_title,
    checkRow.issue_description,
    checkRow.measurement,
    checkRow.note_text,
  ]
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .join(" ");

  const compact = raw.replace(/\s+/g, " ").trim();
  return compact || null;
};

const fetchVhcRequestRow = async ({ jobId, requestId = null, vhcItemId = null }) => {
  let query = supabase
    .from("job_requests")
    .select("request_id, vhc_item_id")
    .eq("job_id", jobId);

  if (requestId !== null && requestId !== undefined && requestId !== "") {
    query = query.eq("request_id", requestId);
  } else if (vhcItemId !== null && vhcItemId !== undefined && vhcItemId !== "") {
    query = query.eq("vhc_item_id", vhcItemId);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Failed to resolve VHC request row: ${error.message}`);
  }
  return data || null;
};

async function handler(req, res, session) {
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
      const rowDescription = await buildVhcRowDescription({ jobId, vhcItemId });
      vhcItemIdForSync = vhcItemId;
      const linkedRequest = await fetchVhcRequestRow({ jobId, vhcItemId });
      updateData = {
        vhc_item_id: vhcItemId,
        row_description: rowDescription,
        allocated_to_request_id: linkedRequest?.request_id ?? null,
        updated_at: new Date().toISOString(),
      };
      console.log("[ALLOCATE API] VHC update data:", updateData);
    } else {
      const linkedRequest = await fetchVhcRequestRow({ jobId, requestId });
      const linkedVhcItemId = linkedRequest?.vhc_item_id ?? null;
      const rowDescription = Number.isInteger(linkedVhcItemId)
        ? await buildVhcRowDescription({ jobId, vhcItemId: linkedVhcItemId })
        : null;
      updateData = {
        allocated_to_request_id: requestId,
        vhc_item_id: Number.isInteger(linkedVhcItemId) ? linkedVhcItemId : null,
        row_description: rowDescription,
        updated_at: new Date().toISOString(),
      };
      vhcItemIdForSync = Number.isInteger(linkedVhcItemId) ? linkedVhcItemId : null;
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

export default withRoleGuard(handler);
