// file location: src/pages/api/parts/delivery-logs/index.js
// API endpoint to create and fetch part delivery logs

import { supabase } from "@/lib/supabaseClient";
import { sanitizeNumericId } from "@/lib/utils/ids";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { partId, limit = "10" } = req.query;

    try {
      let query = supabase
        .from("part_delivery_logs")
        .select("*, part:parts_catalog(id, part_number, name)")
        .order("created_at", { ascending: false })
        .limit(Number.parseInt(limit, 10) || 10);

      if (partId) {
        query = query.eq("part_id", partId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return res.status(200).json({
        success: true,
        deliveryLogs: data || [],
      });
    } catch (error) {
      console.error("Error fetching delivery logs:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch delivery logs",
        error: error.message,
      });
    }
  }

  if (req.method === "POST") {
    const { partId, supplier, orderReference, qtyOrdered, qtyReceived, unitCost, deliveryDate, notes, userNumericId } = req.body || {};

    if (!partId) {
      return res.status(400).json({
        success: false,
        message: "Part ID is required",
      });
    }

    try {
      const logPayload = {
        part_id: partId,
        supplier: supplier || null,
        order_reference: orderReference || null,
        qty_ordered: Number.parseInt(qtyOrdered, 10) || 0,
        qty_received: Number.parseInt(qtyReceived, 10) || 0,
        unit_cost: unitCost ? Number.parseFloat(unitCost) : null,
        delivery_date: deliveryDate || null,
        notes: notes || null,
        created_by: sanitizeNumericId(userNumericId) || null,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("part_delivery_logs")
        .insert([logPayload])
        .select("*, part:parts_catalog(id, part_number, name)")
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        deliveryLog: data,
      });
    } catch (error) {
      console.error("Error creating delivery log:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create delivery log",
        error: error.message,
      });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  });
}
