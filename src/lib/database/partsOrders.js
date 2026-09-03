// ✅ Parts order helpers
// file location: src/lib/database/partsOrders.js
import { getDatabaseClient } from "@/lib/database/client";
import { logFailure } from "@/lib/utils/logFailure";

const supabase = getDatabaseClient();

const ORDER_SELECT = `
  id,
  order_number,
  status,
  priority,
  customer_id,
  customer_name,
  customer_phone,
  customer_email,
  customer_address,
  vehicle_id,
  vehicle_reg,
  vehicle_make,
  vehicle_model,
  vehicle_vin,
  vehicle_details,
  delivery_type,
  delivery_address,
  delivery_contact,
  delivery_phone,
  delivery_eta,
  delivery_window,
  delivery_status,
  delivery_notes,
  invoice_reference,
  invoice_total,
  invoice_status,
  invoice_notes,
  notes,
  created_by,
  created_at,
  updated_at,
  items:parts_order_card_items(
    id,
    order_id,
    part_catalog_id,
    part_number,
    part_name,
    quantity,
    unit_price,
    status,
    notes,
    created_at,
    updated_at
  )
`;

const ORDER_UPDATE_FIELDS = new Set([
  "status",
  "priority",
  "delivery_type",
  "delivery_address",
  "delivery_contact",
  "delivery_phone",
  "delivery_eta",
  "delivery_window",
  "delivery_status",
  "delivery_notes",
  "invoice_reference",
  "invoice_total",
  "invoice_status",
  "invoice_notes",
  "notes",
]);

const DELIVERY_JOB_STATUS = Object.freeze({
  pending: "planned",
  scheduled: "ready",
  dispatched: "out_for_delivery",
  delivered: "delivered",
});

const normaliseOrderNumber = (value) => String(value || "").trim().toUpperCase();

const orderTotal = (items = []) =>
  items.reduce(
    (total, item) => total + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  );

const plannedTime = (value) => {
  const match = String(value || "").match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}:00` : null;
};

/** Keep the order register and delivery/collection diary on one shared reference. */
export const syncPartsOrderDeliveryJob = async (order) => {
  const orderNumber = normaliseOrderNumber(order?.order_number);
  const fulfilmentType = String(order?.delivery_type || "").toLowerCase();
  if (!orderNumber || !["collection", "delivery"].includes(fulfilmentType)) return null;

  const items = Array.isArray(order.items) ? order.items : [];
  const firstItem = items[0] || {};
  const quantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const total = Number(order.invoice_total) || orderTotal(items);
  const stamp = new Date().toISOString();
  const payload = {
    invoice_number: order.invoice_reference || null,
    customer_id: order.customer_id || null,
    customer_name: order.customer_name || null,
    part_name: firstItem.part_name || (items.length > 1 ? `${items.length} parts lines` : null),
    part_number: firstItem.part_number || null,
    quantity: Math.max(1, quantity),
    unit_price: Number(firstItem.unit_price) || 0,
    total_price: total,
    items: items.map((item) => ({
      id: item.id,
      name: item.part_name || "Part",
      partNumber: item.part_number || null,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unit_price) || 0,
    })),
    is_paid: order.invoice_status === "paid",
    delivery_date: order.delivery_eta || stamp.slice(0, 10),
    address: order.delivery_address || order.customer_address || null,
    contact_name: order.delivery_contact || order.customer_name || null,
    contact_phone: order.delivery_phone || order.customer_phone || null,
    contact_email: order.customer_email || null,
    notes: order.delivery_notes || order.notes || null,
    status: DELIVERY_JOB_STATUS[order.delivery_status] || "planned",
    order_reference: orderNumber,
    vehicle_reg: order.vehicle_reg || null,
    planned_time: plannedTime(order.delivery_window),
    is_collection: fulfilmentType === "collection",
    package_count: items.length,
    updated_at: stamp,
  };

  const { data: existing, error: lookupError } = await supabase
    .from("parts_delivery_jobs")
    .select("id")
    .eq("order_reference", orderNumber)
    .maybeSingle();
  if (lookupError) throw new Error(`Unable to link the order to deliveries: ${lookupError.message}`);

  const query = existing?.id
    ? supabase.from("parts_delivery_jobs").update(payload).eq("id", existing.id)
    : supabase.from("parts_delivery_jobs").insert([{ ...payload, created_at: stamp }]);
  const { data, error } = await query.select("id, order_reference, status, is_collection").maybeSingle();
  if (error) throw new Error(`Unable to save the linked delivery: ${error.message}`);
  return data || null;
};

/**
 * Fetches all parts order cards ("parts orders") with their basic line items.
 * Used by the job-cards Orders tab to show recent activity.
 */
export const getPartsOrders = async () => {
  const { data, error } = await supabase
    .from("parts_order_cards")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    logFailure("❌ getPartsOrders error:", error);
    return [];
  }

  return data || [];
};

export const getPartsOrderByNumber = async (orderNumber) => {
  const normalized = normaliseOrderNumber(orderNumber);
  if (!normalized) return null;
  const { data, error } = await supabase
    .from("parts_order_cards")
    .select(ORDER_SELECT)
    .eq("order_number", normalized)
    .maybeSingle();
  if (error) throw new Error(`Unable to load parts order: ${error.message}`);
  return data || null;
};

export const updatePartsOrderByNumber = async (orderNumber, requestedUpdates = {}) => {
  const normalized = normaliseOrderNumber(orderNumber);
  const updates = Object.fromEntries(
    Object.entries(requestedUpdates).filter(([key]) => ORDER_UPDATE_FIELDS.has(key))
  );
  if (!normalized) throw new Error("An order number is required.");
  if (Object.keys(updates).length === 0) throw new Error("No supported order fields were supplied.");

  const { data, error } = await supabase
    .from("parts_order_cards")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("order_number", normalized)
    .select(ORDER_SELECT)
    .maybeSingle();
  if (error) throw new Error(`Unable to update parts order: ${error.message}`);
  if (!data) return null;
  await syncPartsOrderDeliveryJob(data);
  return data;
};

export const createPartsOrder = async ({ order = {}, items = [], createdBy = null } = {}) => {
  const validItems = items.filter(
    (item) => item && (item.part_name || item.part_number) && Number(item.quantity) > 0
  );
  if (!String(order.customer_name || "").trim()) throw new Error("Customer name is required.");
  if (validItems.length === 0) throw new Error("Add at least one part to the order.");

  const { data: orderRecord, error: orderError } = await supabase
    .from("parts_order_cards")
    .insert([{ ...order, created_by: createdBy || order.created_by || null }])
    .select("*")
    .maybeSingle();
  if (orderError || !orderRecord) {
    throw new Error(`Unable to create parts order: ${orderError?.message || "No order returned."}`);
  }

  const itemPayload = validItems.map((item) => ({
    order_id: orderRecord.id,
    part_catalog_id: item.part_catalog_id || null,
    part_number: item.part_number || null,
    part_name: item.part_name || null,
    quantity: Number(item.quantity) || 1,
    unit_price: Number(item.unit_price) || 0,
    notes: item.notes || null,
  }));
  const { data: savedItems, error: itemError } = await supabase
    .from("parts_order_card_items")
    .insert(itemPayload)
    .select("*");
  if (itemError) throw new Error(`Unable to save order items: ${itemError.message}`);

  const completeOrder = { ...orderRecord, items: savedItems || [] };
  await syncPartsOrderDeliveryJob(completeOrder);
  return completeOrder;
};

export default getPartsOrders;
