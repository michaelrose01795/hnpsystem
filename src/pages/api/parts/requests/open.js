// file location: src/pages/api/parts/requests/open.js

import { supabase } from "@/lib/supabaseClient";

const DEFAULT_LIMIT = 10;
const OPEN_STATUSES = [
  "waiting_authorisation",
  "pending",
  "awaiting_stock",
  "on_order",
];

const parseLimit = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(numeric), 50);
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} not allowed` });
  }

  try {
    const { limit } = req.query;
    const resolvedLimit = parseLimit(limit);

    const { data, error } = await supabase
      .from("parts_requests")
      .select(
        `
          request_id,
          job_id,
          part_id,
          quantity,
          status,
          source,
          description,
          created_at,
          job:jobs(
            id,
            job_number,
            waiting_status
          ),
          part:parts_catalog(
            id,
            part_number,
            name
          )
        `
      )
      .in("status", OPEN_STATUSES)
      .order("created_at", { ascending: false })
      .limit(resolvedLimit);

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      requests: data || [],
    });
  } catch (error) {
    console.error("/api/parts/requests/open error", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load parts requests",
    });
  }
}
