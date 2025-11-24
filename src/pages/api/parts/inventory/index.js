// file location: src/pages/api/parts/inventory/index.js

import { supabase } from "@/lib/supabaseClient";

const parseNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const deriveStockStatus = (part) => {
  if (!part?.is_active) return "inactive";
  const inStock = Number(part?.qty_in_stock ?? 0);
  const reorderLevel = Number(part?.reorder_level ?? 0);
  const onOrder = Number(part?.qty_on_order ?? 0);

  if (inStock <= 0 && onOrder > 0) return "back_order";
  if (inStock <= reorderLevel) return "low_stock";
  return "in_stock";
};

const mapPartRecord = (record, jobCounts = {}) => ({
  ...record,
  stock_status: deriveStockStatus(record),
  open_job_count: jobCounts[record.id] || 0,
});

const OPEN_JOB_STATUSES = [
  "pending",
  "awaiting_stock",
  "allocated",
  "picked",
];

export default async function handler(req, res) {
  if (req.method === "GET") {
    const {
      search = "",
      includeInactive = "false",
      limit = "50",
      offset = "0",
    } = req.query;

    try {
      const from = Number.parseInt(offset, 10) || 0;
      const to = from + (Number.parseInt(limit, 10) || 50) - 1;

      let query = supabase
        .from("parts_catalog")
        .select(
          `id, part_number, name, description, category, supplier, oem_reference, storage_location,
           service_default_zone, qty_in_stock, qty_reserved, qty_on_order, reorder_level,
           unit_cost, unit_price, is_active, notes, created_at, updated_at`,
          { count: "exact" }
        )
        .order("part_number", { ascending: true })
        .range(from, to);

      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        const safeSearch = trimmedSearch.replace(/,/g, "");
        const pattern = `%${safeSearch}%`;
        query = query.or(
          `part_number.ilike.${pattern},name.ilike.${pattern},description.ilike.${pattern},oem_reference.ilike.${pattern}`
        );
      }

      if (includeInactive !== "true") {
        query = query.eq("is_active", true);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      let jobCounts = {};
      const parts = data || [];
      const partIds = parts.map((part) => part.id).filter(Boolean);

      if (partIds.length > 0) {
        const { data: jobRows, error: jobError } = await supabase
          .from("parts_job_items")
          .select("part_id")
          .in("part_id", partIds)
          .in("status", OPEN_JOB_STATUSES);

        if (jobError) throw jobError;

        jobCounts = (jobRows || []).reduce((acc, row) => {
          acc[row.part_id] = (acc[row.part_id] || 0) + 1;
          return acc;
        }, {});
      }

      return res.status(200).json({
        success: true,
        parts: parts.map((row) => mapPartRecord(row, jobCounts)),
        count: count || 0,
      });
    } catch (error) {
      console.error("Error fetching parts inventory:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load parts inventory",
        error: error.message,
      });
    }
  }

  if (req.method === "POST") {
    const { userId, ...partData } = req.body || {};

    try {
      const payload = {
        part_number: partData.partNumber || partData.part_number,
        name: partData.partName || partData.name,
        description: partData.description || null,
        category: partData.category || null,
        supplier: partData.supplier || null,
        storage_location: partData.storageLocation || partData.storage_location || null,
        qty_in_stock: parseNumber(partData.qtyInStock ?? partData.qty_in_stock, 0),
        qty_reserved: parseNumber(partData.qtyReserved ?? partData.qty_reserved, 0),
        qty_on_order: parseNumber(partData.qtyOnOrder ?? partData.qty_on_order, 0),
        reorder_level: parseNumber(partData.reorderLevel ?? partData.reorder_level, 0),
        unit_cost: parseNumber(partData.unitCost ?? partData.unit_cost, 0),
        unit_price: parseNumber(partData.unitPrice ?? partData.unit_price, 0),
        is_active: partData.isActive ?? partData.is_active ?? true,
        created_by: userId || null,
        notes: partData.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!payload.part_number || !payload.name) {
        return res.status(400).json({
          success: false,
          message: "Part number and name are required",
        });
      }

      const { data, error } = await supabase
        .from("parts_catalog")
        .insert([payload])
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return res.status(409).json({
            success: false,
            message: "A part with this part number already exists",
            error: error.message,
          });
        }
        throw error;
      }

      return res.status(201).json({
        success: true,
        part: mapPartRecord(data),
      });
    } catch (error) {
      console.error("Error creating part:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create part",
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
