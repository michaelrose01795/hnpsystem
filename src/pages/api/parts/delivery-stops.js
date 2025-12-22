// file location: src/pages/api/parts/delivery-stops.js

import { supabase } from "@/lib/supabaseClient";

const sanitizeJobIds = (value) => {
  if (!value) {
    return [];
  }
  const ids = Array.isArray(value) ? value : String(value).split(",");
  return ids
    .map((entry) => {
      const parsed = Number(entry);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((entry) => entry !== null);
};

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} not allowed` });
  }

  try {
    const jobIds =
      req.method === "POST"
        ? sanitizeJobIds(req.body?.jobIds)
        : sanitizeJobIds(req.query?.jobIds);

    if (!jobIds.length) {
      return res.status(200).json({ success: true, stops: [] });
    }

    const { data, error } = await supabase
      .from("delivery_stops")
      .select(
        `
          id,
          job_id,
          status,
          stop_number,
          delivery:deliveries(
            id,
            delivery_date,
            vehicle_reg
          )
        `
      )
      .in("job_id", jobIds)
      .in("status", ["planned", "en_route"])
      .order("stop_number", { ascending: true });

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      stops: data || [],
    });
  } catch (error) {
    console.error("/api/parts/delivery-stops error", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load delivery stops",
    });
  }
}
