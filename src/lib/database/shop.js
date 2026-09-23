// file location: src/lib/database/shop.js
//
// Database helper for shop_* tables (catalog, carts, orders).
//
// Server-only writes use the service-role client (the shared `supabase`
// export resolves to it on the server). Public reads filter by
// status='published' on products and status='active' on categories.

import { supabase } from "@/lib/database/supabaseClient";
import { logFailure } from "@/lib/utils/logFailure";

/* ============================= CATALOG ============================= */

export const listPublishedProducts = async () => {
  const { data, error } = await supabase
    .from("shop_products")
    .select("*")
    .eq("status", "published")
    .order("sort_order", { ascending: true });
  if (error) {
    logFailure("[shop] listPublishedProducts:", error.message);
    return [];
  }
  return data || [];
};

export const listAllProducts = async () => {
  const { data, error } = await supabase
    .from("shop_products")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    logFailure("[shop] listAllProducts:", error.message);
    return [];
  }
  return data || [];
};

export const getProductsByIds = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("shop_products")
    .select("*")
    .in("id", ids);
  if (error) {
    logFailure("[shop] getProductsByIds:", error.message);
    return [];
  }
  return data || [];
};

export const upsertProduct = async (row, actor) => {
  const payload = {
    ...row,
    updated_at: new Date().toISOString(),
    updated_by: actor || null,
  };
  const { data, error } = await supabase
    .from("shop_products")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
};

export const deleteProduct = async (id) => {
  const { error } = await supabase.from("shop_products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};

export const listActiveCategories = async () => {
  const { data, error } = await supabase
    .from("shop_categories")
    .select("*")
    .eq("status", "active")
    .order("sort_order", { ascending: true });
  if (error) {
    logFailure("[shop] listActiveCategories:", error.message);
    return [];
  }
  return data || [];
};

export const listAllCategories = async () => {
  const { data, error } = await supabase
    .from("shop_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return [];
  return data || [];
};

export const upsertCategory = async (row, actor) => {
  const { data, error } = await supabase
    .from("shop_categories")
    .upsert(
      { ...row, updated_at: new Date().toISOString(), updated_by: actor || null },
      { onConflict: "id" }
    )
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
};

export const deleteCategory = async (id) => {
  const { error } = await supabase.from("shop_categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};

/* ============================= ORDERS ============================== */

export const generateOrderNumber = () => {
  const year = new Date().getFullYear();
  // 6-char random suffix - the DB unique index will reject collisions and the
  // checkout route retries on conflict.
  const tail = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `HNP-${year}-${tail}`;
};

export const createPendingOrder = async ({
  customerId,
  contactEmail,
  contactPhone,
  shippingAddress,
  items, // [{ product_id, name, sku, qty, unit_price_pence, line_total_pence }]
  subtotalPence,
  shippingPence,
  taxPence,
  totalPence,
}) => {
  const order_number = generateOrderNumber();
  const { data: order, error: orderErr } = await supabase
    .from("shop_orders")
    .insert({
      order_number,
      customer_id: customerId || null,
      contact_email: contactEmail,
      contact_phone: contactPhone || null,
      shipping_address: shippingAddress || {},
      status: "pending_payment",
      subtotal_pence: subtotalPence,
      shipping_pence: shippingPence || 0,
      tax_pence: taxPence || 0,
      total_pence: totalPence,
    })
    .select()
    .single();
  if (orderErr) return { ok: false, error: orderErr.message };

  if (Array.isArray(items) && items.length) {
    const rows = items.map((it) => ({
      order_id: order.id,
      product_id: it.product_id,
      sku: it.sku || null,
      name: it.name,
      qty: it.qty,
      unit_price_pence: it.unit_price_pence,
      line_total_pence: it.line_total_pence,
    }));
    const { error: itemsErr } = await supabase.from("shop_order_items").insert(rows);
    if (itemsErr) return { ok: false, error: itemsErr.message };
  }

  return { ok: true, data: order };
};

export const markOrderPaid = async (orderId, { stripeSessionId, stripePaymentIntent } = {}) => {
  const patch = {
    status: "paid",
    updated_at: new Date().toISOString(),
  };
  if (stripeSessionId) patch.stripe_session_id = stripeSessionId;
  if (stripePaymentIntent) patch.stripe_payment_intent = stripePaymentIntent;
  const { data, error } = await supabase
    .from("shop_orders")
    .update(patch)
    .eq("id", orderId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
};

export const updateOrderStatus = async (orderId, status, actor) => {
  const { data, error } = await supabase
    .from("shop_orders")
    .update({
      status,
      updated_at: new Date().toISOString(),
      updated_by: actor || null,
    })
    .eq("id", orderId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
};

export const setStripeSession = async (orderId, stripeSessionId) => {
  const { error } = await supabase
    .from("shop_orders")
    .update({
      stripe_session_id: stripeSessionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};

export const getOrderById = async (orderId) => {
  const { data, error } = await supabase
    .from("shop_orders")
    .select("*, items:shop_order_items(*)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return null;
  return data;
};

export const getOrderByNumber = async (orderNumber) => {
  const { data, error } = await supabase
    .from("shop_orders")
    .select("*, items:shop_order_items(*)")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (error) return null;
  return data;
};

export const getOrderByStripeSession = async (sessionId) => {
  const { data, error } = await supabase
    .from("shop_orders")
    .select("*, items:shop_order_items(*)")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (error) return null;
  return data;
};

export const listOrders = async ({ limit = 100 } = {}) => {
  const { data, error } = await supabase
    .from("shop_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
};

/* =========================== STOCK ============================== */
// Decrement stock when an order is paid. Best-effort: races aren't critical for
// the marketing-store volumes expected here, and the staff manager can correct
// stock by hand. Phase 4+: swap for an RPC function with proper locking.

export const decrementStockForOrder = async (orderId) => {
  const order = await getOrderById(orderId);
  if (!order) return { ok: false, error: "Order not found" };
  for (const item of order.items || []) {
    if (!item.product_id) continue;
    const { data: product } = await supabase
      .from("shop_products")
      .select("stock_qty")
      .eq("id", item.product_id)
      .maybeSingle();
    if (!product) continue;
    const next = Math.max(0, (product.stock_qty || 0) - item.qty);
    await supabase
      .from("shop_products")
      .update({ stock_qty: next, updated_at: new Date().toISOString() })
      .eq("id", item.product_id);
  }
  return { ok: true };
};

/* =========================== CUSTOMER BASKETS ======================== */
// One saved basket per signed-in customer, so a basket started on a phone
// is still there on a laptop. Signed-out visitors keep their basket in
// localStorage only (see useShopCart) and it is merged up on sign-in.
//
// The table is optional at runtime: if shop_carts has not been created in
// this environment yet, every function below degrades to "no saved basket"
// rather than breaking the shop. Schema lives in
// src/lib/database/schema/shop-carts.sql.

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

const isMissingCartTable = (error) =>
  Boolean(error) &&
  (MISSING_TABLE_CODES.has(error.code) ||
    /shop_carts/i.test(error.message || ""));

export const getCustomerCart = async (customerId) => {
  if (!customerId) return { ok: true, items: [], persisted: false };
  const { data, error } = await supabase
    .from("shop_carts")
    .select("items, updated_at")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) {
    if (isMissingCartTable(error)) return { ok: true, items: [], persisted: false };
    logFailure("[shop] getCustomerCart:", error.message);
    return { ok: false, items: [], persisted: false };
  }
  return {
    ok: true,
    items: Array.isArray(data?.items) ? data.items : [],
    updatedAt: data?.updated_at || null,
    persisted: true,
  };
};

export const saveCustomerCart = async (customerId, items) => {
  if (!customerId) return { ok: false, persisted: false };
  const { error } = await supabase.from("shop_carts").upsert(
    {
      customer_id: customerId,
      items: Array.isArray(items) ? items : [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" }
  );
  if (error) {
    if (isMissingCartTable(error)) return { ok: true, persisted: false };
    logFailure("[shop] saveCustomerCart:", error.message);
    return { ok: false, persisted: false };
  }
  return { ok: true, persisted: true };
};

export const clearCustomerCart = async (customerId) =>
  saveCustomerCart(customerId, []);
