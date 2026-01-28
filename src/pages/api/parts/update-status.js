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

    let reservationDelta = 0;
    let reservationPartId = null;
    let vhcContext = null;
    if (authorised !== undefined) {
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

      const wasAuthorised = existingItem.authorised === true;
      const nextAuthorised = Boolean(authorised);
      const quantity = Number(existingItem.quantity_requested || 0);

      if (quantity > 0 && nextAuthorised !== wasAuthorised) {
        reservationDelta = nextAuthorised ? quantity : -quantity;
        reservationPartId = existingItem.part_id;
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

    // Keep VHC approval + vhc_authorised job_requests in sync when a VHC-linked part is authorised/declined here.
    // This prevents stale "Authorised VHC Items" rows that were created from job_requests.
    if (authorised !== undefined && vhcContext?.vhc_item_id && String(vhcContext?.origin || "").toLowerCase().includes("vhc")) {
      const jobId = vhcContext.job_id;
      const vhcItemId = vhcContext.vhc_item_id;
      const nextAuthorised = Boolean(authorised);
      const nextApprovalStatus = nextAuthorised ? "authorized" : "declined";

      // 1) Update VHC item approval status (source of truth for "Authorised" sections)
      const { data: updatedVhcRows, error: vhcError } = await supabase
        .from("vhc_checks")
        .update({
          approval_status: nextApprovalStatus,
          display_status: nextApprovalStatus,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("vhc_id", vhcItemId)
        .select("job_id, vhc_id, issue_title, issue_description, section");

      if (vhcError) {
        console.error("[parts/update-status] Failed to sync vhc_checks approval_status:", vhcError);
      }

      const vhcRow = Array.isArray(updatedVhcRows) ? updatedVhcRows[0] : null;
      const resolvedJobId = vhcRow?.job_id ?? jobId;

      // 2) Create/remove the vhc_authorised job_requests row (used by job card write-up + authorised list)
      if (resolvedJobId) {
        if (nextAuthorised) {
          const description =
            (vhcRow?.issue_title || vhcRow?.issue_description || vhcRow?.section || "")
              .toString()
              .trim() || `Authorised item ${vhcItemId}`;

          const { data: prePickRows } = await supabase
            .from("parts_job_items")
            .select("id, pre_pick_location, updated_at")
            .eq("job_id", resolvedJobId)
            .eq("vhc_item_id", vhcItemId)
            .not("pre_pick_location", "is", null)
            .order("updated_at", { ascending: false })
            .limit(1);

          const latestPrePickLocation = prePickRows?.[0]?.pre_pick_location || null;
          const partsJobItemId = prePickRows?.[0]?.id || null;

          const { data: noteRows } = await supabase
            .from("job_notes")
            .select("note_text, updated_at")
            .eq("job_id", resolvedJobId)
            .or(`linked_vhc_id.eq.${vhcItemId},linked_vhc_ids.cs.{${vhcItemId}}`)
            .order("updated_at", { ascending: false })
            .limit(1);

          const noteText = noteRows?.[0]?.note_text || null;

          const { data: existingRequest } = await supabase
            .from("job_requests")
            .select("request_id")
            .eq("job_id", resolvedJobId)
            .eq("request_source", "vhc_authorised")
            .eq("vhc_item_id", vhcItemId)
            .maybeSingle();

          const payload = {
            job_id: resolvedJobId,
            description,
            hours: null,
            job_type: "Customer",
            sort_order: 0,
            status: "inprogress",
            request_source: "vhc_authorised",
            vhc_item_id: vhcItemId,
            parts_job_item_id: partsJobItemId,
            pre_pick_location: latestPrePickLocation,
            note_text: noteText,
            updated_at: new Date().toISOString(),
          };

          if (existingRequest?.request_id) {
            await supabase
              .from("job_requests")
              .update(payload)
              .eq("request_id", existingRequest.request_id);
          } else {
            await supabase.from("job_requests").insert([
              { ...payload, created_at: payload.updated_at },
            ]);
          }
        } else {
          await supabase
            .from("job_requests")
            .delete()
            .eq("job_id", resolvedJobId)
            .eq("request_source", "vhc_authorised")
            .eq("vhc_item_id", vhcItemId);
        }
      }
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Unexpected error in update-status API:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
