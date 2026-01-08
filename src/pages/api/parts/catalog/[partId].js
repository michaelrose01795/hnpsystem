// file location: src/pages/api/parts/catalog/[partId].js

import { supabase } from "@/lib/supabaseClient";
import { isValidUuid } from "@/lib/utils/ids";

export default async function handler(req, res) {
  const { partId } = req.query;

  if (!partId || !isValidUuid(partId)) {
    return res.status(400).json({ success: false, message: "Valid part ID is required" });
  }

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("parts_catalog")
        .select("*")
        .eq("id", partId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ success: false, message: "Part not found" });
        }
        throw error;
      }

      return res.status(200).json({ success: true, part: data });
    } catch (error) {
      console.error("Failed to fetch part:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to fetch part",
        error: error.message,
      });
    }
  }

  if (req.method === "PATCH") {
    try {
      const {
        name,
        description,
        category,
        supplier,
        unit_cost,
        unit_price,
        qty_in_stock,
        qty_reserved,
        qty_on_order,
        reorder_level,
        storage_location,
        service_default_zone,
        notes,
      } = req.body;

      const updates = {};

      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (supplier !== undefined) updates.supplier = supplier;
      if (unit_cost !== undefined) updates.unit_cost = unit_cost;
      if (unit_price !== undefined) updates.unit_price = unit_price;
      if (qty_in_stock !== undefined) updates.qty_in_stock = qty_in_stock;
      if (qty_reserved !== undefined) updates.qty_reserved = qty_reserved;
      if (qty_on_order !== undefined) updates.qty_on_order = qty_on_order;
      if (reorder_level !== undefined) updates.reorder_level = reorder_level;
      if (storage_location !== undefined) updates.storage_location = storage_location;
      if (service_default_zone !== undefined) updates.service_default_zone = service_default_zone;
      if (notes !== undefined) updates.notes = notes;

      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("parts_catalog")
        .update(updates)
        .eq("id", partId)
        .select("*")
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ success: false, message: "Part not found" });
        }
        throw error;
      }

      return res.status(200).json({ success: true, part: data });
    } catch (error) {
      console.error("Failed to update part:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to update part",
        error: error.message,
      });
    }
  }

  res.setHeader("Allow", ["GET", "PATCH"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}
