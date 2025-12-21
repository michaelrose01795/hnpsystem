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
      const payload = {
        job_id: jobId,
        display_id: displayId,
        vhc_item_id: Number(vhcItemId),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("vhc_item_aliases")
        .upsert(payload, { onConflict: "job_id,display_id" })
        .select("id, job_id, display_id, vhc_item_id, created_at, updated_at")
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        alias: data,
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
      let query = supabase
        .from("vhc_item_aliases")
        .delete()
        .eq("job_id", jobId)
        .eq("display_id", displayId);

      if (vhcItemId !== null && vhcItemId !== undefined) {
        query = query.eq("vhc_item_id", Number(vhcItemId));
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

