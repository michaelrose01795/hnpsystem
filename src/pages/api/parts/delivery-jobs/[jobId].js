// file location: src/pages/api/parts/delivery-jobs/[jobId].js

import { supabase } from "@/lib/supabaseClient";

const mapPayloadToColumns = (payload = {}) => {
  const mapped = {};

  if (payload.status !== undefined) {
    mapped.status = payload.status;
  }

  if (payload.deliveryDate !== undefined) {
    mapped.delivery_date = payload.deliveryDate;
  }

  if (payload.completedAt !== undefined) {
    mapped.completed_at = payload.completedAt;
  }

  if (payload.sortOrder !== undefined) {
    mapped.sort_order = payload.sortOrder;
  }

  if (payload.notes !== undefined) {
    mapped.notes = payload.notes;
  }

  if (payload.driverId !== undefined) {
    mapped.driver_id = payload.driverId;
  }

  return mapped;
};

export default async function handler(req, res) {
  const { jobId } = req.query;

  if (!jobId) {
    return res
      .status(400)
      .json({ success: false, message: "Delivery job ID is required" });
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} not allowed` });
  }

  const updates = mapPayloadToColumns(req.body || {});

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: "No valid fields provided for update",
    });
  }

  try {
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("parts_delivery_jobs")
      .update(updates)
      .eq("id", jobId)
      .select("*")
      .single();

    if (error) {
      console.error("Failed to update delivery job:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to update delivery job" });
    }

    return res.status(200).json({ success: true, job: data });
  } catch (err) {
    console.error("Unexpected delivery job update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Unexpected server error" });
  }
}
