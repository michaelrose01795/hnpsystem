// file location: src/lib/database/partsCatalogPublic.js
//
// Public (customer-facing) read layer over public.parts_catalog — the same
// table the staff DMS Stock Catalogue at /stock-catalogue manages. The
// /website/parts-catalog shop reads through here.
//
// This file exists separately from the staff parts helpers for one reason:
// parts_catalog carries commercially sensitive columns (unit_cost, supplier,
// storage_location, service/sales/stairs zones, internal notes, reorder
// levels). Those must never reach a customer. Every function here selects an
// explicit column allowlist and maps rows through toPublicProduct(), so a
// column added to the table later cannot leak by default.
//
// Availability rule: a part is sellable online when it is active, has a
// sell price above zero, and has free stock (qty_in_stock - qty_reserved).
// Zero-free-stock parts are still listed so customers can see the range —
// they render as "Available to order" and cannot be added to the basket.

import { supabase } from "@/lib/database/supabaseClient";
import { logFailure } from "@/lib/utils/logFailure";

// Explicit allowlist — never `select("*")` on this table for public reads.
const PUBLIC_COLUMNS = [
  "id",
  "part_number",
  "name",
  "description",
  "category",
  "oem_reference",
  "unit_price",
  "qty_in_stock",
  "qty_reserved",
  "is_active",
  "created_at",
  "updated_at",
].join(",");

const toPence = (value) => Math.round((Number(value) || 0) * 100);

const freeStock = (row) =>
  Math.max(
    0,
    (Number(row?.qty_in_stock) || 0) - (Number(row?.qty_reserved) || 0)
  );

/**
 * Map a parts_catalog row to the product shape the website shop speaks
 * (the same keys as the mock data in features/website/data/shopProducts.js
 * and as the cart items in useShopCart).
 */
export const toPublicProduct = (row) => {
  if (!row) return null;
  const available = freeStock(row);
  return {
    id: row.id,
    sku: row.part_number || null,
    name: row.name,
    description: row.description || null,
    category_id: row.category ? categoryId(row.category) : null,
    category_name: row.category || null,
    oem_reference: row.oem_reference || null,
    price_pence: toPence(row.unit_price),
    compare_at_price_pence: null,
    // Customers see a capped availability signal, never the real shelf count.
    stock_qty: available,
    in_stock: available > 0,
    image_url: null, // parts_catalog holds no imagery — the card draws a placeholder.
    updated_at: row.updated_at || null,
  };
};

/** Stable slug for a free-text category so it can be used as a filter value. */
export const categoryId = (name) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "uncategorised";

const escapeForOr = (value) =>
  String(value || "")
    .trim()
    .replace(/[%,()]/g, " ")
    .replace(/\s+/g, " ");

/**
 * Paginated public product list.
 *
 * @param {object}  opts
 * @param {string}  opts.search    free text over name / part_number / description
 * @param {string}  opts.category  category slug from categoryId()
 * @param {string}  opts.sort      name | price_asc | price_desc | newest
 * @param {number}  opts.limit
 * @param {number}  opts.offset
 * @returns {Promise<{ items: object[], total: number }>}
 */
export const listPublicParts = async ({
  search = "",
  category = "",
  sort = "name",
  limit = 24,
  offset = 0,
} = {}) => {
  const safeLimit = Math.min(96, Math.max(1, Number(limit) || 24));
  const safeOffset = Math.max(0, Number(offset) || 0);

  // `category` arrives as a slug because the column is free text. Resolve it
  // back to the real spellings first so the filter, the count and the paging
  // can all be done in Postgres — filtering a fetched page in JS would only
  // ever see the first page of a catalogue this size.
  let categoryNames = null;
  if (category) {
    const all = await listPublicPartCategories();
    categoryNames = all.filter((c) => c.id === category).map((c) => c.name);
    if (categoryNames.length === 0) return { items: [], total: 0 };
  }

  let query = supabase
    .from("parts_catalog")
    .select(PUBLIC_COLUMNS, { count: "exact" })
    .eq("is_active", true)
    .gt("unit_price", 0);

  if (categoryNames) query = query.in("category", categoryNames);

  const term = escapeForOr(search);
  if (term) {
    query = query.or(
      [
        `name.ilike.%${term}%`,
        `part_number.ilike.%${term}%`,
        `description.ilike.%${term}%`,
        `oem_reference.ilike.%${term}%`,
      ].join(",")
    );
  }

  if (sort === "price_asc") query = query.order("unit_price", { ascending: true });
  else if (sort === "price_desc") query = query.order("unit_price", { ascending: false });
  else if (sort === "newest") query = query.order("created_at", { ascending: false });
  else query = query.order("name", { ascending: true });

  query = query.range(safeOffset, safeOffset + safeLimit - 1);

  const { data, error, count } = await query;
  if (error) {
    logFailure("[partsCatalogPublic] listPublicParts:", error.message);
    return { items: [], total: 0 };
  }

  const rows = data || [];
  return {
    items: rows.map(toPublicProduct),
    total: count ?? rows.length,
  };
};

/** One product by its parts_catalog uuid. Returns null when not sellable. */
export const getPublicPartById = async (id) => {
  if (!id) return null;
  const { data, error } = await supabase
    .from("parts_catalog")
    .select(PUBLIC_COLUMNS)
    .eq("id", id)
    .eq("is_active", true)
    .gt("unit_price", 0)
    .maybeSingle();
  if (error) {
    logFailure("[partsCatalogPublic] getPublicPartById:", error.message);
    return null;
  }
  return toPublicProduct(data);
};

/** Sellable products by id — used to re-price a basket server-side. */
export const getPublicPartsByIds = async (ids) => {
  const list = [...new Set((ids || []).filter(Boolean))];
  if (list.length === 0) return [];
  const { data, error } = await supabase
    .from("parts_catalog")
    .select(PUBLIC_COLUMNS)
    .in("id", list)
    .eq("is_active", true)
    .gt("unit_price", 0);
  if (error) {
    logFailure("[partsCatalogPublic] getPublicPartsByIds:", error.message);
    return [];
  }
  return (data || []).map(toPublicProduct);
};

/**
 * Distinct categories across the sellable catalogue, with counts, so the
 * shop can render filter chips without a round trip per chip.
 *
 * PostgREST has no DISTINCT and caps a response at 1000 rows, so this pages
 * through the category column and folds it down here. Catalogues run to a
 * few thousand parts, so that is a handful of single-column requests — and
 * the result is cached in process for CATEGORY_TTL_MS, which together with
 * the route's s-maxage means the real cost is one sweep a minute at worst.
 */
const CATEGORY_PAGE = 1000;
const CATEGORY_MAX_PAGES = 20; // 20k parts before the list is truncated
const CATEGORY_TTL_MS = 60_000;
let categoryCache = { at: 0, value: null };

export const listPublicPartCategories = async () => {
  if (categoryCache.value && Date.now() - categoryCache.at < CATEGORY_TTL_MS) {
    return categoryCache.value;
  }

  const byId = new Map();
  for (let page = 0; page < CATEGORY_MAX_PAGES; page += 1) {
    const from = page * CATEGORY_PAGE;
    const { data, error } = await supabase
      .from("parts_catalog")
      .select("category")
      .eq("is_active", true)
      .gt("unit_price", 0)
      .not("category", "is", null)
      .range(from, from + CATEGORY_PAGE - 1);
    if (error) {
      logFailure("[partsCatalogPublic] listPublicPartCategories:", error.message);
      // Serve what we have rather than dropping the filter bar entirely.
      break;
    }
    const rows = data || [];
    rows.forEach((row) => {
      const name = String(row.category || "").trim();
      if (!name) return;
      const id = categoryId(name);
      const existing = byId.get(id);
      if (existing) existing.count += 1;
      else byId.set(id, { id, name, count: 1 });
    });
    if (rows.length < CATEGORY_PAGE) break;
  }

  const value = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  categoryCache = { at: Date.now(), value };
  return value;
};

/** A few other parts in the same category — "You may also need" on the PDP. */
export const listRelatedParts = async (product, limit = 4) => {
  if (!product?.category_name) return [];
  const { data, error } = await supabase
    .from("parts_catalog")
    .select(PUBLIC_COLUMNS)
    .eq("is_active", true)
    .gt("unit_price", 0)
    .eq("category", product.category_name)
    .neq("id", product.id)
    .order("name", { ascending: true })
    .limit(Math.max(1, Number(limit) || 4));
  if (error) return [];
  return (data || []).map(toPublicProduct);
};
