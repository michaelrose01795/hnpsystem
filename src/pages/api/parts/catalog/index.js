// file location: src/pages/api/parts/catalog/index.js
import { supabaseService } from "@/lib/supabaseClient";

const PART_COLUMNS = [
  "id",
  "part_number",
  "name",
  "description",
  "category",
  "supplier",
  "oem_reference",
  "storage_location",
  "service_default_zone",
  "unit_cost",
  "unit_price",
  "qty_in_stock",
  "qty_reserved",
  "qty_on_order",
  "reorder_level",
  "is_active",
  "notes",
  "created_at",
  "updated_at",
].join(",");

const sanitizeTerm = (value = "") =>
  value
    .toString()
    .trim()
    .replace(/[%]/g, "")
    .replace(/,/g, "");

const buildSearchQuery = (query, term) => {
  if (!term) return query;
  const pattern = `%${term}%`;
  const clauses = [
    `part_number.ilike.${pattern}`,
    `name.ilike.${pattern}`,
    `supplier.ilike.${pattern}`,
    `category.ilike.${pattern}`,
    `description.ilike.${pattern}`,
    `oem_reference.ilike.${pattern}`,
    `storage_location.ilike.${pattern}`,
  ];
  clauses.push(`part_number.eq.${term}`);
  clauses.push(`name.eq.${term}`);
  if (/^\d+(?:\.\d+)?$/.test(term)) {
    const numericValue = Number.parseFloat(term);
    if (!Number.isNaN(numericValue)) {
      clauses.push(`unit_price.eq.${numericValue}`);
      clauses.push(`unit_cost.eq.${numericValue}`);
    }
  }
  return query.or(clauses.join(","));
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
    });
  }

  const partNumber = sanitizeTerm(req.query.partNumber || req.query.part_number || "");
  const search = sanitizeTerm(req.query.search || "");
  const category = sanitizeTerm(req.query.category || "");
  const includeInactive = String(req.query.includeInactive || "false") === "true";
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 200);

  if (!partNumber && !search && !category) {
    return res.status(400).json({
      success: false,
      message: "Provide a partNumber, search term, or category filter.",
    });
  }

  try {
    let query = supabaseService
      .from("parts_catalog")
      .select(PART_COLUMNS)
      .order("part_number", { ascending: true })
      .limit(partNumber ? 1 : limit);

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    if (partNumber) {
      query = query.ilike("part_number", partNumber);
    } else if (search) {
      query = buildSearchQuery(query, search);
    }

    if (category) {
      query = query.ilike("category", `%${category}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[parts-catalog] lookup failed", error);
      return res.status(500).json({
        success: false,
        message: "Failed to look up part catalogue.",
      });
    }

    if (partNumber) {
      const part = Array.isArray(data) ? data[0] : null;
      if (!part) {
        return res.status(404).json({
          success: false,
          message: "Part not found.",
        });
      }
      return res.status(200).json({ success: true, part, parts: [part] });
    }

    return res.status(200).json({
      success: true,
      parts: Array.isArray(data) ? data : [],
    });
  } catch (error) {
    console.error("[parts-catalog] unexpected error", error);
    return res.status(500).json({
      success: false,
      message: "Unexpected server error.",
    });
  }
}
