// API endpoint to update VHC item approval status and related fields
import { supabase } from "@/lib/supabaseClient";
import { syncVhcPartsAuthorisation } from "@/lib/database/vhcPartsSync";

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

    const normaliseApproval = (value) => {
      if (value === null || value === undefined) return value;
      const normalised = String(value).trim().toLowerCase();
      if (!normalised) return normalised;
      if (normalised === "authorised") return "authorized";
      if (normalised === "approved") return "authorized";
      return normalised;
    };

    const normaliseDisplay = (value) => {
      if (value === null || value === undefined) return value;
      const normalised = String(value).trim().toLowerCase();
      if (!normalised) return normalised;
      if (normalised === "authorised") return "authorized";
      if (normalised === "approved") return "authorized";
      return normalised;
    };

    // Build update object with only provided fields
    const updateData = {};

    if (approvalStatus !== undefined) {
      const nextApprovalStatus = normaliseApproval(approvalStatus);
      if (!["pending", "authorized", "declined", "completed"].includes(nextApprovalStatus)) {
        return res.status(400).json({
          success: false,
          message: "approvalStatus must be 'pending', 'authorized', 'declined', or 'completed'"
        });
      }
      updateData.approval_status = nextApprovalStatus;

      // Use displayStatus from request if provided, otherwise set based on approvalStatus
      if (displayStatus !== undefined) {
        updateData.display_status = normaliseDisplay(displayStatus);
      } else if (nextApprovalStatus === "authorized") {
        updateData.display_status = "authorized";
      } else if (nextApprovalStatus === "declined") {
        updateData.display_status = "declined";
      } else if (nextApprovalStatus === "completed") {
        updateData.display_status = "completed";
      }
      // If returning to pending, displayStatus should be passed from UI to restore original severity

      // Set approved_at and approved_by when status changes to authorized, declined, or completed
      if (nextApprovalStatus === "authorized" || nextApprovalStatus === "declined" || nextApprovalStatus === "completed") {
        updateData.approved_at = new Date().toISOString();
        if (approvedBy) {
          updateData.approved_by = approvedBy;
        }
      } else if (nextApprovalStatus === "pending") {
        updateData.approved_at = null;
        updateData.approved_by = null;
        if (displayStatus === undefined) {
          updateData.display_status = null;
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

    if (!data || data.length === 0) {
      // Supabase can return no error but also no updated rows if the filter didn't match.
      return res.status(404).json({
        success: false,
        message: `No vhc_checks row found for vhc_id ${vhcItemId}`,
      });
    }

    const updatedRow = data?.[0] || null;

    if (approvalStatus !== undefined) {
      const normalizedStatus = normaliseApproval(approvalStatus);

      let vhcRow = updatedRow;
      if (!vhcRow?.job_id) {
        const { data: vhcFetch } = await supabase
          .from("vhc_checks")
          .select("job_id, issue_title, issue_description, section")
          .eq("vhc_id", vhcItemId)
          .single();
        vhcRow = vhcFetch || vhcRow;
      }

      const jobId = vhcRow?.job_id ?? null;
      const shouldReserve = normalizedStatus === "authorized";
      const shouldRelease = normalizedStatus === "declined" || normalizedStatus === "pending";

      if (jobId) {
        const { data: jobParts, error: partsError } = await supabase
          .from("parts_job_items")
          .select("id, part_id, quantity_requested, status, authorised")
          .eq("job_id", jobId)
          .eq("vhc_item_id", vhcItemId);

        if (partsError) {
          console.error("Failed to load VHC parts for reservation update:", partsError);
        } else {
          for (const part of jobParts || []) {
            if (!part?.part_id) continue;
            if (String(part.status || "").toLowerCase() === "booked") {
              continue;
            }

            const qty = Number(part.quantity_requested || 0);
            if (qty <= 0) continue;

            const nextAuthorised = shouldReserve ? true : shouldRelease ? false : part.authorised === true;
            const statusUpdate = shouldReserve
              ? (["on_order", "awaiting_stock"].includes(String(part.status || "").toLowerCase())
                ? part.status
                : "waiting_authorisation")
              : shouldRelease
              ? "pending"
              : part.status;

            if (nextAuthorised !== part.authorised || statusUpdate !== part.status) {
              await supabase
                .from("parts_job_items")
                .update({
                  authorised: nextAuthorised,
                  status: statusUpdate,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", part.id);
            }

            if (shouldReserve || shouldRelease) {
              const { data: partRow, error: partError } = await supabase
                .from("parts_catalog")
                .select("qty_reserved")
                .eq("id", part.part_id)
                .single();

              if (partError) {
                console.error("Failed to load catalog part for reservation update:", partError);
                continue;
              }

              const currentReserved = Number(partRow?.qty_reserved || 0);
              const nextReserved = shouldReserve
                ? currentReserved + qty
                : Math.max(0, currentReserved - qty);

              if (nextReserved !== currentReserved) {
                if (nextReserved === 0 && currentReserved - qty < 0) {
                  console.warn("Reserved stock clamped at zero", {
                    partId: part.part_id,
                    jobId,
                    qty,
                    currentReserved,
                  });
                }
                await supabase
                  .from("parts_catalog")
                  .update({
                    qty_reserved: nextReserved,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", part.part_id);
              }
            }
          }
        }

        await syncVhcPartsAuthorisation({
          jobId,
          vhcItemId,
          approvalStatus: normalizedStatus,
        });
      }
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
