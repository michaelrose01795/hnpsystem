// file location: src/pages/api/parts/inventory/[partId].js

import { supabase } from "@/lib/supabaseClient";

const parseNumeric = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const OPEN_JOB_STATUSES = ["pending", "awaiting_stock", "allocated", "picked"];

const withJobCount = async (part) => {
  if (!part?.id) return part;
  const { data: jobRows, error } = await supabase
    .from("parts_job_items")
    .select("part_id")
    .eq("part_id", part.id)
    .in("status", OPEN_JOB_STATUSES);

  if (error) throw error;

  return {
    ...part,
    open_job_count: (jobRows || []).length,
  };
};

export default async function handler(req, res) {
  const { partId } = req.query;

  if (!partId || typeof partId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Part ID is required",
    });
  }

  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("parts_catalog")
        .select("*")
        .eq("id", partId)
        .single();

      if (error || !data) {
        return res.status(404).json({
          success: false,
          message: "Part not found",
          error: error?.message,
        });
      }

      const payload = await withJobCount(data);

      return res.status(200).json({
        success: true,
        part: payload,
      });
    }

    if (req.method === "PATCH") {
      const { userId, ...updates } = req.body || {};

      const payload = {
        ...updates,
        qty_in_stock: updates.qty_in_stock !== undefined
          ? parseNumeric(updates.qty_in_stock, undefined)
          : undefined,
        qty_reserved: updates.qty_reserved !== undefined
          ? parseNumeric(updates.qty_reserved, undefined)
          : undefined,
        qty_on_order: updates.qty_on_order !== undefined
          ? parseNumeric(updates.qty_on_order, undefined)
          : undefined,
        reorder_level: updates.reorder_level !== undefined
          ? parseNumeric(updates.reorder_level, undefined)
          : undefined,
        unit_cost: updates.unit_cost !== undefined
          ? parseNumeric(updates.unit_cost, undefined)
          : undefined,
        unit_price: updates.unit_price !== undefined
          ? parseNumeric(updates.unit_price, undefined)
          : undefined,
        updated_at: new Date().toISOString(),
      };

      if (userId) payload.updated_by = userId;

      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      const { data, error } = await supabase
        .from("parts_catalog")
        .update(payload)
        .eq("id", partId)
        .select()
        .single();

      if (error) throw error;

      const updatedWithCount = await withJobCount(data);

      return res.status(200).json({
        success: true,
        part: updatedWithCount,
      });
    }

    if (req.method === "DELETE") {
      const { error } = await supabase
        .from("parts_catalog")
        .delete()
        .eq("id", partId);

      if (error) throw error;

      return res.status(204).end();
    }

    res.setHeader("Allow", ["GET", "PATCH", "DELETE"]);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
    });

  } catch (error) {
    console.error("Error handling part:", error);
    return res.status(500).json({
      success: false,
      message: "Operation failed",
      error: error.message,
    });
  }
}
