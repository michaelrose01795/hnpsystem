// file location: src/pages/api/vhc/item-aliases.js

import { supabase } from "@/lib/supabaseClient";

const buildErrorResponse = (res, status, message) => {
  res.status(status).json({
    success: false,
    message,
  });
};

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { jobId, displayId, vhcItemId } = req.body || {};
    if (!jobId || !displayId || !vhcItemId) {
      return buildErrorResponse(res, 400, "jobId, displayId, and vhcItemId are required");
    }

    try {
      // Set display_id directly on vhc_checks (consolidated from vhc_item_aliases)
      const { data, error } = await supabase
        .from("vhc_checks")
        .update({
          display_id: displayId,
          updated_at: new Date().toISOString(),
        })
        .eq("vhc_id", Number(vhcItemId))
        .select("vhc_id, job_id, display_id, created_at, updated_at")
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        alias: data ? {
          id: data.vhc_id,
          job_id: data.job_id,
          display_id: data.display_id,
          vhc_item_id: data.vhc_id,
          created_at: data.created_at,
          updated_at: data.updated_at,
        } : null,
      });
    } catch (error) {
      console.error("Failed to upsert VHC item alias:", error);
      return buildErrorResponse(res, 500, error.message || "Failed to persist VHC item alias");
    }
  }

  if (req.method === "DELETE") {
    const { jobId, displayId, vhcItemId } = req.body || {};
    if (!jobId || !displayId) {
      return buildErrorResponse(res, 400, "jobId and displayId are required");
    }

    try {
      // Clear display_id on the vhc_checks row
      let query = supabase
        .from("vhc_checks")
        .update({ display_id: null, updated_at: new Date().toISOString() })
        .eq("job_id", jobId)
        .eq("display_id", displayId);

      if (vhcItemId !== null && vhcItemId !== undefined) {
        query = query.eq("vhc_id", Number(vhcItemId));
      }

      const { error } = await query;
      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Failed to remove VHC item alias:", error);
      return buildErrorResponse(res, 500, error.message || "Failed to remove VHC item alias");
    }
  }

  res.setHeader("Allow", ["POST", "DELETE"]);
  return buildErrorResponse(res, 405, `Method ${req.method} not allowed`);
}

