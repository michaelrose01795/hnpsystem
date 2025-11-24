// file location: src/pages/api/parts/summary.js

import { supabase } from "@/lib/supabaseClient";

const fetchCount = async (query) => {
  const { count, error } = await query.select("id", { count: "exact", head: true });
  if (error) throw error;
  return count || 0;
};

const OPEN_JOB_STATUSES = [
  "waiting_authorisation",
  "pending",
  "awaiting_stock",
  "on_order",
  "pre_picked",
  "stock",
  "allocated",
  "picked",
];

const chunkArray = (array = [], size = 200) => {
  if (!Array.isArray(array) || array.length === 0) return [];
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
};

const fetchJobCountsForParts = async (partIds = []) => {
  if (!Array.isArray(partIds) || partIds.length === 0) {
    return {};
  }

  const chunks = chunkArray(partIds, 200);
  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("parts_job_items")
        .select("part_id")
        .in("part_id", chunk)
        .in("status", OPEN_JOB_STATUSES)
    )
  );

  return results.reduce((acc, result) => {
    if (result.error) {
      throw result.error;
    }
    (result.data || []).forEach((row) => {
      acc[row.part_id] = (acc[row.part_id] || 0) + 1;
    });
    return acc;
  }, {});
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
    });
  }

  try {
    const [
      { data: catalog, error: catalogError },
      totalParts,
      partsOnOrder,
      pendingDeliveries,
      activeJobParts,
    ] = await Promise.all([
      supabase
        .from("parts_catalog")
        .select(
          "id, part_number, name, supplier, storage_location, qty_in_stock, qty_on_order, reorder_level, unit_cost, unit_price, is_active",
          { count: "exact" }
        )
        .eq("is_active", true),
      fetchCount(supabase.from("parts_catalog").eq("is_active", true)),
      fetchCount(supabase.from("parts_catalog").eq("is_active", true).gt("qty_on_order", 0)),
      fetchCount(
        supabase
          .from("parts_deliveries")
          .in("status", ["ordering", "on_route", "partial"])
      ),
      fetchCount(
        supabase
          .from("parts_job_items")
          .in("status", OPEN_JOB_STATUSES)
      ),
    ]);

    if (catalogError) throw catalogError;

    const partIds = (catalog || []).map((part) => part.id).filter(Boolean);
    const jobCounts = await fetchJobCountsForParts(partIds);

    const stockAlerts = (catalog || [])
      .filter((part) => Number(part.qty_in_stock || 0) <= Number(part.reorder_level || 0))
      .map((part) => {
        const inStock = Number(part.qty_in_stock) || 0;
        const reorderLevel = Number(part.reorder_level) || 0;
        const qtyOnOrder = Number(part.qty_on_order) || 0;
        let status = "in_stock";
        if (!part.is_active) {
          status = "inactive";
        } else if (inStock <= 0 && qtyOnOrder > 0) {
          status = "back_order";
        } else if (inStock <= reorderLevel) {
          status = "low_stock";
        }

        return {
          id: part.id,
          partNumber: part.part_number,
          name: part.name,
          supplier: part.supplier,
          location: part.storage_location,
          inStock,
          reorderLevel,
          qtyOnOrder,
          unitCost: Number(part.unit_cost) || 0,
          unitPrice: Number(part.unit_price) || 0,
          status,
          openJobCount: jobCounts[part.id] || 0,
        };
      })
      .sort((a, b) => a.inStock - b.inStock);

    const totalInventoryValue = (catalog || []).reduce(
      (sum, part) => sum + (Number(part.qty_in_stock) || 0) * (Number(part.unit_cost) || 0),
      0
    );

    return res.status(200).json({
      success: true,
      summary: {
        totalParts,
        lowStockCount: stockAlerts.length,
        lowStockParts: stockAlerts,
        totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
        partsOnOrder,
        pendingDeliveries,
        activeJobParts,
      },
    });
  } catch (error) {
    console.error("Error loading parts manager summary:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load parts manager summary",
      error: error.message,
    });
  }
}
