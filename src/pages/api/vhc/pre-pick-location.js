// file location: src/pages/api/vhc/pre-pick-location.js

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabase } from "@/lib/database/supabaseClient";
import { normalizePrePickLocation } from "@/lib/prePickLocations";
import { resolveCanonicalVhcId, syncVhcPartsAuthorisation } from "@/lib/database/vhcPartsSync";

const buildPartPrePickUpdates = (prePickLocation, timestamp) => {
  const updates = {
    pre_pick_location: prePickLocation,
    updated_at: timestamp,
  };

  if (prePickLocation === "on_order") {
    updates.status = "on_order";
    updates.stock_status = "no_stock";
    return updates;
  }

  if (prePickLocation) {
    updates.status = "pre_picked";
    updates.stock_status = "in_stock";
    return updates;
  }

  updates.status = "pending";
  updates.stock_status = null;
  return updates;
};

async function handler(req, res) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      jobId,
      requestId = null,
      vhcItemId = null,
      prePickLocation = null,
    } = req.body || {};

    if (!jobId) {
      return res.status(400).json({ error: "jobId is required" });
    }

    if (
      (requestId === null || requestId === undefined || requestId === "") &&
      (vhcItemId === null || vhcItemId === undefined || vhcItemId === "")
    ) {
      return res.status(400).json({ error: "requestId or vhcItemId is required" });
    }

    const timestamp = new Date().toISOString();
    const normalizedRequestId =
      requestId === null || requestId === undefined || requestId === ""
        ? null
        : String(requestId).trim();
    const normalizedPrePickLocation = normalizePrePickLocation(prePickLocation);
    const linkedVhcItemIds = new Set();

    const addLinkedVhcItemId = async (rawValue) => {
      if (rawValue === null || rawValue === undefined || rawValue === "") return;
      const canonicalValue = await resolveCanonicalVhcId({ jobId, rawVhcId: rawValue });
      const normalizedValue = normalizePrePickLocation(canonicalValue);
      if (normalizedValue) {
        linkedVhcItemIds.add(normalizedValue);
      }
    };

    await addLinkedVhcItemId(vhcItemId);

    if (normalizedRequestId) {
      const { data: requestRow, error: requestLookupError } = await supabase
        .from("job_requests")
        .select("request_id, vhc_item_id")
        .eq("job_id", jobId)
        .eq("request_id", normalizedRequestId)
        .maybeSingle();

      if (requestLookupError) {
        return res.status(500).json({
          error: "Failed to load linked request",
          details: requestLookupError.message,
        });
      }

      await addLinkedVhcItemId(requestRow?.vhc_item_id ?? null);
    }

    const linkedVhcItemIdsList = Array.from(linkedVhcItemIds);
    let updatedPartIds = [];

    if (linkedVhcItemIdsList.length > 0) {
      const { data: linkedParts, error: linkedPartsError } = await supabase
        .from("parts_job_items")
        .select("id, vhc_item_id")
        .eq("job_id", jobId)
        .in("vhc_item_id", linkedVhcItemIdsList);

      if (linkedPartsError) {
        return res.status(500).json({
          error: "Failed to load linked parts",
          details: linkedPartsError.message,
        });
      }

      const linkedPartIds = (linkedParts || []).map((row) => row.id).filter(Boolean);

      if (linkedPartIds.length > 0) {
        const { error: updatePartsError } = await supabase
          .from("parts_job_items")
          .update(buildPartPrePickUpdates(normalizedPrePickLocation, timestamp))
          .in("id", linkedPartIds);

        if (updatePartsError) {
          return res.status(500).json({
            error: "Failed to update linked parts",
            details: updatePartsError.message,
          });
        }

        updatedPartIds = linkedPartIds;

        for (const linkedVhcId of linkedVhcItemIdsList) {
          await syncVhcPartsAuthorisation({
            jobId,
            vhcItemId: linkedVhcId,
          });
        }
      } else {
        if (normalizedRequestId) {
          const { error: requestUpdateError } = await supabase
            .from("job_requests")
            .update({
              pre_pick_location: normalizedPrePickLocation,
              updated_at: timestamp,
            })
            .eq("job_id", jobId)
            .eq("request_id", normalizedRequestId);

          if (requestUpdateError) {
            return res.status(500).json({
              error: "Failed to update linked request",
              details: requestUpdateError.message,
            });
          }
        }

        const { error: vhcUpdateError } = await supabase
          .from("vhc_checks")
          .update({
            pre_pick_location: normalizedPrePickLocation,
            request_id: normalizedRequestId,
            updated_at: timestamp,
          })
          .eq("job_id", jobId)
          .in("vhc_id", linkedVhcItemIdsList);

        if (vhcUpdateError) {
          return res.status(500).json({
            error: "Failed to update linked VHC rows",
            details: vhcUpdateError.message,
          });
        }
      }
    } else if (normalizedRequestId) {
      const { error: requestUpdateError } = await supabase
        .from("job_requests")
        .update({
          pre_pick_location: normalizedPrePickLocation,
          updated_at: timestamp,
        })
        .eq("job_id", jobId)
        .eq("request_id", normalizedRequestId);

      if (requestUpdateError) {
        return res.status(500).json({
          error: "Failed to update request pre-pick location",
          details: requestUpdateError.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      requestId: normalizedRequestId,
      linkedVhcItemIds: linkedVhcItemIdsList,
      updatedPartIds,
      prePickLocation: normalizedPrePickLocation,
    });
  } catch (error) {
    console.error("Failed to update linked pre-pick location", error);
    return res.status(500).json({
      error: "Failed to update linked pre-pick location",
      details: error?.message || "Unknown error",
    });
  }
}

export default withRoleGuard(handler);
