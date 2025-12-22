// file location: src/pages/api/parts/job-items/feed.js

import { supabase } from "@/lib/supabaseClient";

const DEFAULT_LIMIT = 8;
const VALID_STATUSES = [
  "waiting_authorisation",
  "pending",
  "awaiting_stock",
  "on_order",
  "pre_picked",
  "stock",
  "allocated",
  "picked",
];

const parseLimit = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(numeric), 50);
};

const buildStatusFilter = (value) => {
  if (!value) {
    return VALID_STATUSES;
  }
  const entries = Array.isArray(value) ? value : String(value).split(",");
  const normalised = entries
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => VALID_STATUSES.includes(entry));
  return normalised.length ? normalised : VALID_STATUSES;
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} not allowed` });
  }

  try {
    const { limit, statuses } = req.query;
    const resolvedLimit = parseLimit(limit);
    const statusFilter = buildStatusFilter(statuses);

    const { data, error } = await supabase
      .from("parts_job_items")
      .select(
        `
          id,
          job_id,
          part_id,
          quantity_requested,
          quantity_allocated,
          quantity_fitted,
          status,
          origin,
          request_notes,
          created_at,
          job:jobs(
            id,
            job_number,
            waiting_status,
            status,
            vehicle_reg
          ),
          part:parts_catalog(
            id,
            part_number,
            name,
            supplier,
            unit_price
          )
        `
      )
      .in("status", statusFilter)
      .order("created_at", { ascending: false })
      .limit(resolvedLimit);

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      items: data || [],
    });
  } catch (error) {
    console.error("/api/parts/job-items/feed error", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load parts job items",
    });
  }
}
