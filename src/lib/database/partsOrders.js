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

const ORDER_CREATE_FIELDS = new Set([
  "status",
  "priority",
  "customer_id",
  "customer_name",
  "customer_phone",
  "customer_email",
  "customer_address",
  "vehicle_id",
  "vehicle_reg",
  "vehicle_make",
  "vehicle_model",
  "vehicle_vin",
  "vehicle_details",
  "notes",
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
  if (!orderNumber || !["collection", "delivery", "courier"].includes(fulfilmentType)) return null;

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
export const getPartsOrders = async ({ customerId, customerName, vehicleReg, openOnly = false, limit } = {}) => {
  let query = supabase
    .from("parts_order_cards")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false });

  if (customerId) query = query.eq("customer_id", customerId);
  else if (customerName) query = query.ilike("customer_name", String(customerName).trim());
  if (vehicleReg) query = query.ilike("vehicle_reg", String(vehicleReg).trim());
  if (openOnly) query = query.in("status", ["draft", "booked", "ready"]);
  if (limit) query = query.limit(Math.min(Math.max(Number(limit) || 5, 1), 50));

  const { data, error } = await query;

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

  let completeOrder = data;
  if (
    completeOrder.delivery_status === "delivered" &&
    completeOrder.invoice_status === "paid" &&
    completeOrder.status !== "complete"
  ) {
    const { data: completed, error: completionError } = await supabase
      .from("parts_order_cards")
      .update({ status: "complete", updated_at: new Date().toISOString() })
      .eq("order_number", normalized)
      .select(ORDER_SELECT)
      .maybeSingle();
    if (completionError) {
      throw new Error(`Unable to complete parts order: ${completionError.message}`);
    }
    completeOrder = completed || completeOrder;
  }

  await syncPartsOrderDeliveryJob(completeOrder);
  return completeOrder;
};

export const searchPartsOrderCustomers = async (rawTerm) => {
  const term = String(rawTerm || "").trim().replace(/[%_,]/g, "");
  if (term.length < 2) return [];
  const pattern = `%${term}%`;

  const [{ data: customers, error: customerError }, { data: accounts, error: accountError }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, firstname, lastname, email, mobile, telephone, address, postcode, contact_preference, created_at, updated_at")
        .or(`firstname.ilike.${pattern},lastname.ilike.${pattern},name.ilike.${pattern},email.ilike.${pattern},mobile.ilike.${pattern},telephone.ilike.${pattern},postcode.ilike.${pattern}`)
        .order("updated_at", { ascending: false })
        .limit(15),
      supabase
        .from("company_accounts")
        .select("id, account_number, company_name, trading_name, contact_name, contact_email, contact_phone, billing_address_line1, billing_address_line2, billing_city, billing_postcode, updated_at")
        .or(`account_number.ilike.${pattern},company_name.ilike.${pattern},trading_name.ilike.${pattern},contact_name.ilike.${pattern},contact_email.ilike.${pattern},contact_phone.ilike.${pattern},billing_postcode.ilike.${pattern}`)
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);

  if (customerError) throw new Error(`Unable to search customers: ${customerError.message}`);
  if (accountError) throw new Error(`Unable to search customer accounts: ${accountError.message}`);

  return [
    ...(customers || []).map((customer) => ({ ...customer, result_type: "retail", account_type: "Retail" })),
    ...(accounts || []).map((account) => ({
      id: `account:${account.id}`,
      account_id: account.id,
      account_number: account.account_number,
      firstname: account.trading_name || account.company_name || "",
      lastname: "",
      email: account.contact_email || "",
      mobile: account.contact_phone || "",
      telephone: account.contact_phone || "",
      address: [account.billing_address_line1, account.billing_address_line2, account.billing_city].filter(Boolean).join(", "),
      postcode: account.billing_postcode || "",
      contact_name: account.contact_name || "",
      result_type: "account",
      account_type: "Trade account",
      updated_at: account.updated_at,
    })),
  ].slice(0, 20);
};

const removeIncompleteOrder = async (orderId) => {
  if (!orderId) return;
  await supabase.from("parts_order_card_items").delete().eq("order_id", orderId);
  await supabase.from("parts_order_cards").delete().eq("id", orderId);
};

const reserveCatalogueStock = async (items = []) => {
  const reserved = [];
  try {
    for (const item of items) {
      if (!item.part_catalog_id) continue;
      const quantity = Number(item.quantity) || 0;
      const { data: part, error: lookupError } = await supabase
        .from("parts_catalog")
        .select("id, part_number, qty_in_stock, qty_reserved")
        .eq("id", item.part_catalog_id)
        .maybeSingle();
      if (lookupError || !part) throw new Error(`Unable to reserve ${item.part_number || "part"}.`);
      const available = Math.max(0, Number(part.qty_in_stock || 0) - Number(part.qty_reserved || 0));
      if (available < quantity) {
        throw new Error(`${part.part_number || item.part_number || "Part"} only has ${available} available.`);
      }
      const nextReserved = Number(part.qty_reserved || 0) + quantity;
      const { error: updateError } = await supabase
        .from("parts_catalog")
        .update({ qty_reserved: nextReserved, updated_at: new Date().toISOString() })
        .eq("id", part.id);
      if (updateError) throw new Error(`Unable to reserve ${part.part_number || "part"}.`);
      reserved.push({ id: part.id, previous: Number(part.qty_reserved || 0) });
    }
    return reserved;
  } catch (error) {
    await Promise.all(
      reserved.map((entry) =>
        supabase
          .from("parts_catalog")
          .update({ qty_reserved: entry.previous, updated_at: new Date().toISOString() })
          .eq("id", entry.id)
      )
    );
    throw error;
  }
};

export const createPartsOrder = async ({ order = {}, items = [], createdBy = null, reserveStock = false } = {}) => {
  const validItems = items.filter(
    (item) => item && (item.part_name || item.part_number) && Number(item.quantity) > 0
  );
  const isDraft = order.status === "draft";
  if (!isDraft && !String(order.customer_name || "").trim()) throw new Error("Customer name is required.");
  if (!isDraft && validItems.length === 0) throw new Error("Add at least one part to the order.");

  const safeOrder = Object.fromEntries(
    Object.entries(order).filter(([key]) => ORDER_CREATE_FIELDS.has(key))
  );
  const { data: orderRecord, error: orderError } = await supabase
    .from("parts_order_cards")
    .insert([{ ...safeOrder, created_by: createdBy || null }])
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
  let savedItems = [];
  if (itemPayload.length > 0) {
    const { data, error: itemError } = await supabase
      .from("parts_order_card_items")
      .insert(itemPayload)
      .select("*");
    if (itemError) {
      await removeIncompleteOrder(orderRecord.id);
      throw new Error(`Unable to save order items: ${itemError.message}`);
    }
    savedItems = data || [];
  }

  const completeOrder = { ...orderRecord, items: savedItems };
  let reservations = [];
  try {
    if (!isDraft && reserveStock) reservations = await reserveCatalogueStock(validItems);
    if (!isDraft) await syncPartsOrderDeliveryJob(completeOrder);
  } catch (syncError) {
    if (reservations.length > 0) {
      await Promise.all(
        reservations.map((entry) =>
          supabase
            .from("parts_catalog")
            .update({ qty_reserved: entry.previous, updated_at: new Date().toISOString() })
            .eq("id", entry.id)
        )
      );
    }
    await removeIncompleteOrder(orderRecord.id);
    throw syncError;
  }
  return completeOrder;
};

export default getPartsOrders;
