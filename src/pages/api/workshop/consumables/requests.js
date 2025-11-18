// file location: src/pages/api/workshop/consumables/requests.js
import { supabase } from "@/lib/supabaseClient";

const TABLE = "workshop_consumable_requests";

const formatRequestRow = (row) => ({
  id: row.id,
  itemName: row.item_name,
  quantity: row.quantity,
  requestedById: row.requested_by,
  requestedByName: row.requested_by_name,
  status: row.status,
  requestedAt: row.requested_at,
  updatedAt: row.updated_at,
});

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("requested_at", { ascending: false });

      if (error) {
        throw error;
      }

      return res
        .status(200)
        .json({ success: true, data: (data || []).map(formatRequestRow) });
    }

    if (req.method === "POST") {
      const { itemName, quantity, requestedById, requestedByName } = req.body || {};
      if (!itemName) {
        return res
          .status(400)
          .json({ success: false, message: "itemName is required." });
      }

      const numQty = Number(quantity) || 0;
      const { error } = await supabase.from(TABLE).insert({
        item_name: itemName.trim(),
        quantity: numQty,
        requested_by: requestedById || null,
        requested_by_name: requestedByName || null,
      });

      if (error) {
        throw error;
      }

      const { data: newRow, error: fetchError } = await supabase
        .from(TABLE)
        .select("*")
        .order("requested_at", { ascending: false })
        .limit(1);

      if (fetchError) {
        throw fetchError;
      }

      return res.status(201).json({
        success: true,
        data: (newRow || []).map(formatRequestRow),
      });
    }

    if (req.method === "PATCH") {
      const { id, status } = req.body || {};
      if (!id || !status) {
        return res
          .status(400)
          .json({ success: false, message: "id and status are required." });
      }

      const { error } = await supabase
        .from(TABLE)
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        throw error;
      }

      const { data, error: fetchError } = await supabase
        .from(TABLE)
        .select("*")
        .order("requested_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      return res
        .status(200)
        .json({ success: true, data: (data || []).map(formatRequestRow) });
    }

    return res
      .status(405)
      .json({ success: false, message: "Method not allowed." });
  } catch (error) {
    console.error("❌ /api/workshop/consumables/requests error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
}
