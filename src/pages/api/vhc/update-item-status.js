// API endpoint to update VHC item approval status and related fields
import { supabase } from "@/lib/supabaseClient";

export default async function handler(req, res) {
  if (req.method !== "PATCH" && req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const {
      vhcItemId,
      approvalStatus,
      displayStatus,
      labourHours,
      partsCost,
      totalOverride,
      labourComplete,
      partsComplete,
      approvedBy
    } = req.body;

    if (!vhcItemId) {
      return res.status(400).json({ success: false, message: "vhcItemId is required" });
    }

    // Build update object with only provided fields
    const updateData = {};

    if (approvalStatus !== undefined) {
      if (!['pending', 'authorized', 'declined', 'completed'].includes(approvalStatus)) {
        return res.status(400).json({
          success: false,
          message: "approvalStatus must be 'pending', 'authorized', 'declined', or 'completed'"
        });
      }
      updateData.approval_status = approvalStatus;

      // Use displayStatus from request if provided, otherwise set based on approvalStatus
      if (displayStatus !== undefined) {
        updateData.display_status = displayStatus;
      } else if (approvalStatus === 'authorized') {
        updateData.display_status = 'authorized';
      } else if (approvalStatus === 'declined') {
        updateData.display_status = 'declined';
      } else if (approvalStatus === 'completed') {
        updateData.display_status = 'completed';
      }
      // If returning to pending, displayStatus should be passed from UI to restore original severity

      // Set approved_at and approved_by when status changes to authorized, declined, or completed
      if (approvalStatus === 'authorized' || approvalStatus === 'declined' || approvalStatus === 'completed') {
        updateData.approved_at = new Date().toISOString();
        if (approvedBy) {
          updateData.approved_by = approvedBy;
        }
      }
    }

    if (labourHours !== undefined) {
      if (labourHours === "" || labourHours === null) {
        updateData.labour_hours = null;
      } else {
        updateData.labour_hours = parseFloat(labourHours) || 0;
      }
    }

    if (partsCost !== undefined && partsCost !== null) {
      updateData.parts_cost = parseFloat(partsCost) || 0;
    }

    if (totalOverride !== undefined && totalOverride !== null) {
      updateData.total_override = totalOverride === "" ? null : parseFloat(totalOverride);
    }

    if (labourComplete !== undefined) {
      updateData.labour_complete = Boolean(labourComplete);
    }

    if (partsComplete !== undefined) {
      updateData.parts_complete = Boolean(partsComplete);
    }

    updateData.updated_at = new Date().toISOString();

    // Update the vhc_checks record
    const { data, error } = await supabase
      .from("vhc_checks")
      .update(updateData)
      .eq("vhc_id", vhcItemId)
      .select();

    if (error) {
      console.error("Error updating VHC item status:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update VHC item status",
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      data: data?.[0] || null,
      message: "VHC item status updated successfully"
    });

  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}
