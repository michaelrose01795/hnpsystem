// file location: src/pages/api/parts/delivery-logs/[partId].js
// API endpoint to fetch delivery logs for a specific part

import { supabase } from "@/lib/supabaseClient";

export default async function handler(req, res) {
  const { partId } = req.query;

  if (!partId) {
    return res.status(400).json({
      success: false,
      message: "Part ID is required",
    });
  }

  if (req.method === "GET") {
    try {
      // Fetch the most recent delivery log for this part
      const { data, error } = await supabase
        .from("part_delivery_logs")
        .select("*")
        .eq("part_id", partId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        deliveryLog: data || null,
      });
    } catch (error) {
      console.error("Error fetching delivery log:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch delivery log",
        error: error.message,
      });
    }
  }

  res.setHeader("Allow", ["GET"]);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  });
}
