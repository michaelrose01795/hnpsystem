// file location: src/pages/api/vhc/parts-search.js
import { supabaseService } from "@/lib/supabaseClient";

const PART_COLUMNS = [
  "id",
  "part_number",
  "name",
  "description",
  "category",
  "supplier",
  "storage_location",
  "unit_cost",
  "unit_price",
  "qty_in_stock",
  "qty_reserved",
  "qty_on_order",
  "reorder_level",
].join(",");

const buildSearchQuery = (baseQuery, term) => {
  const sanitised = term.replace(/[%,]/g, "");
  const pattern = `%${sanitised}%`;
  const clauses = [
    `part_number.ilike.${pattern}`,
    `name.ilike.${pattern}`,
    `supplier.ilike.${pattern}`,
    `category.ilike.${pattern}`,
    `description.ilike.${pattern}`,
    `oem_reference.ilike.${pattern}`,
    `storage_location.ilike.${pattern}`,
  ];
  if (/^\d+(?:\.\d+)?$/.test(sanitised)) {
    const numericValue = Number.parseFloat(sanitised);
    if (!Number.isNaN(numericValue)) {
      clauses.push(`unit_price.eq.${numericValue}`);
      clauses.push(`unit_cost.eq.${numericValue}`);
    }
  }
  return baseQuery.or(clauses.join(","));
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: `Method ${req.method} not allowed` });
  }

  const search = (req.query.search || "").toString().trim();
  const category = (req.query.category || "").toString().trim();
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 30, 100);

  if (!search && !category) {
    return res.status(400).json({
      success: false,
      message: "Provide a search query or category filter.",
    });
  }

  try {
    let query = supabaseService
      .from("parts_catalog")
      .select(PART_COLUMNS)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(limit);

    if (search) {
      query = buildSearchQuery(query, search);
    }

    if (category) {
      query = query.ilike("category", `%${category}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("parts-search failed", error);
      return res.status(500).json({ success: false, message: "Failed to search parts catalogue." });
    }

    return res.status(200).json({ success: true, parts: data || [] });
  } catch (error) {
    console.error("parts-search exception", error);
    return res.status(500).json({ success: false, message: "Unexpected server error." });
  }
}

