// file location: src/pages/api/parts/delivery-jobs/index.js

import { supabase } from "@/lib/supabaseClient";

const normalizeJobRecord = (job = {}) => ({
  ...job,
  delivery_date: job.delivery_date || null,
  status: job.status || "scheduled",
  items: Array.isArray(job.items) ? job.items : [],
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} not allowed` });
  }

  const { date } = req.query;

  try {
    let query = supabase
      .from("parts_delivery_jobs")
      .select("*")
      .order("status", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (date) {
      query = query.eq("delivery_date", date);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to load delivery jobs:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to load delivery jobs" });
    }

    return res.status(200).json({
      success: true,
      jobs: (data || []).map(normalizeJobRecord),
    });
  } catch (err) {
    console.error("Unexpected delivery jobs error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Unexpected server error" });
  }
}
