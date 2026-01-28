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

    const updatedRow = data?.[0] || null;

    if (approvalStatus !== undefined) {
      const normalizedStatus = String(approvalStatus || "").toLowerCase();
      const shouldCreate = normalizedStatus === "authorized" || normalizedStatus === "completed";
      const shouldRemove = normalizedStatus === "pending" || normalizedStatus === "declined";

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
      }

      if (jobId && shouldCreate) {
        const description =
          (vhcRow?.issue_title || vhcRow?.issue_description || vhcRow?.section || "")
            .toString()
            .trim() || `Authorised item ${vhcItemId}`;

        const { data: prePickRows } = await supabase
          .from("parts_job_items")
          .select("id, pre_pick_location, updated_at")
          .eq("job_id", jobId)
          .eq("vhc_item_id", vhcItemId)
          .not("pre_pick_location", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1);

        const prePickLocation = prePickRows?.[0]?.pre_pick_location || null;
        const partsJobItemId = prePickRows?.[0]?.id || null;

        const { data: noteRows } = await supabase
          .from("job_notes")
          .select("note_text, updated_at")
          .eq("job_id", jobId)
          .or(`linked_vhc_id.eq.${vhcItemId},linked_vhc_ids.cs.{${vhcItemId}}`)
          .order("updated_at", { ascending: false })
          .limit(1);

        const noteText = noteRows?.[0]?.note_text || null;

        const { data: existingRequest } = await supabase
          .from("job_requests")
          .select("request_id")
          .eq("job_id", jobId)
          .eq("request_source", "vhc_authorised")
          .eq("vhc_item_id", vhcItemId)
          .maybeSingle();

        const payload = {
          job_id: jobId,
          description,
          hours: null,
          job_type: "Customer",
          sort_order: 0,
          status: "inprogress",
          request_source: "vhc_authorised",
          vhc_item_id: vhcItemId,
          parts_job_item_id: partsJobItemId,
          pre_pick_location: prePickLocation,
          note_text: noteText,
          updated_at: new Date().toISOString()
        };

        if (existingRequest?.request_id) {
          await supabase
            .from("job_requests")
            .update(payload)
            .eq("request_id", existingRequest.request_id);
        } else {
          await supabase.from("job_requests").insert([
            { ...payload, created_at: payload.updated_at }
          ]);
        }
      } else if (jobId && shouldRemove) {
        await supabase
          .from("job_requests")
          .delete()
          .eq("job_id", jobId)
          .eq("request_source", "vhc_authorised")
          .eq("vhc_item_id", vhcItemId);

        await supabase
          .from("parts_job_items")
          .update({
            pre_pick_location: null,
            updated_at: new Date().toISOString(),
          })
          .eq("job_id", jobId)
          .eq("vhc_item_id", vhcItemId);

        const { data: notesToUpdate, error: notesError } = await supabase
          .from("job_notes")
          .select("note_id, linked_vhc_id, linked_vhc_ids")
          .eq("job_id", jobId)
          .or(`linked_vhc_id.eq.${vhcItemId},linked_vhc_ids.cs.{${vhcItemId}}`);

        if (notesError) {
          console.error("Failed to load VHC-linked notes for cleanup:", notesError);
        } else {
          for (const note of notesToUpdate || []) {
            const nextLinkedVhcId =
              String(note.linked_vhc_id ?? "") === String(vhcItemId)
                ? null
                : note.linked_vhc_id;
            const nextLinkedVhcIds = Array.isArray(note.linked_vhc_ids)
              ? note.linked_vhc_ids.filter((id) => String(id) !== String(vhcItemId))
              : note.linked_vhc_ids;

            if (
              nextLinkedVhcId === note.linked_vhc_id &&
              nextLinkedVhcIds === note.linked_vhc_ids
            ) {
              continue;
            }

            await supabase
              .from("job_notes")
              .update({
                linked_vhc_id: nextLinkedVhcId,
                linked_vhc_ids: nextLinkedVhcIds,
                updated_at: new Date().toISOString(),
              })
              .eq("note_id", note.note_id);
          }
        }
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
