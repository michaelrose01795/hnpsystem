// file location: src/pages/api/parts/vhc-labour.js

import { supabase } from "@/lib/supabaseClient";
import { resolveAuditIds } from "@/lib/utils/ids";

const parseLabourHours = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
    });
  }

  const { jobId, vhcItemId, labourHours, userId, userNumericId } = req.body || {};
  if (!jobId || vhcItemId === null || vhcItemId === undefined) {
    return res.status(400).json({
      success: false,
      message: "jobId and vhcItemId are required",
    });
  }

  const parsedVhcItemId = Number(vhcItemId);
  if (!Number.isInteger(parsedVhcItemId)) {
    return res.status(400).json({
      success: false,
      message: "vhcItemId must be a valid integer",
    });
  }

  try {
    const { uuid: auditUserId } = resolveAuditIds(userId, userNumericId);
    const resolvedHours = parseLabourHours(labourHours);

    const { data: updatedItems, error } = await supabase
      .from("parts_job_items")
      .update({
        labour_hours: resolvedHours,
        updated_at: new Date().toISOString(),
        updated_by: auditUserId || null,
      })
      .eq("job_id", jobId)
      .eq("vhc_item_id", parsedVhcItemId)
      .select("id, job_id, vhc_item_id, labour_hours, updated_at, updated_by");

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      updatedCount: Array.isArray(updatedItems) ? updatedItems.length : 0,
      items: updatedItems || [],
    });
  } catch (error) {
    console.error("Failed to update VHC labour hours:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update labour hours",
      error: error.message,
    });
  }
}
