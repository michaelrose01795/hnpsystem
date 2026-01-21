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
  if (req.method === "POST") {
    const {
      partNumber,
      name,
      supplier,
      category,
      storageLocation,
      unitCost,
      unitPrice,
      description,
      notes,
    } = req.body || {};

    const required = [
      ["partNumber", partNumber],
      ["name", name],
      ["supplier", supplier],
      ["category", category],
      ["storageLocation", storageLocation],
      ["unitCost", unitCost],
      ["unitPrice", unitPrice],
    ];

    const missing = required.filter(([, value]) => !String(value || "").trim()).map(([key]) => key);
    if (missing.length > 0) {
      const labels = {
        partNumber: "Part Number",
        name: "Name",
        supplier: "Supplier",
        category: "Category",
        storageLocation: "Storage Location",
        unitCost: "Unit Cost",
        unitPrice: "Unit Price",
      };
      return res.status(400).json({
        success: false,
        message: "All fields are required to create a part.",
        missing: missing.map((key) => labels[key] || key),
      });
    }

    const parsedUnitCost = Number.parseFloat(unitCost);
    const parsedUnitPrice = Number.parseFloat(unitPrice);
    if (!Number.isFinite(parsedUnitCost) || !Number.isFinite(parsedUnitPrice)) {
      return res.status(400).json({
        success: false,
        message: "Unit cost and unit price must be valid numbers.",
      });
    }

    try {
      const payload = {
        part_number: String(partNumber).trim(),
        name: String(name).trim(),
        supplier: String(supplier).trim(),
        category: String(category).trim(),
        storage_location: String(storageLocation).trim(),
        unit_cost: parsedUnitCost,
        unit_price: parsedUnitPrice,
        description: String(description || "").trim() || null,
        notes: String(notes || "").trim() || null,
        is_active: true,
        qty_in_stock: 0,
        qty_reserved: 0,
        qty_on_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseService
        .from("parts_catalog")
        .insert([payload])
        .select(PART_COLUMNS)
        .single();

      if (error) {
        console.error("[parts-catalog] create failed", error);
        return res.status(500).json({
          success: false,
          message: "Failed to create part catalogue record.",
        });
      }

      return res.status(201).json({
        success: true,
        part: data,
      });
    } catch (error) {
      console.error("[parts-catalog] create unexpected error", error);
      return res.status(500).json({
        success: false,
        message: "Unexpected server error.",
      });
    }
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
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
