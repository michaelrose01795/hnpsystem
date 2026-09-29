// file location: src/lib/database/stockAccess.js
//
// Every Supabase read/write for Stock Access (/access, /access/manage), server
// side only. The browser reaches it over /api/access/*, which enforces the
// capabilities in src/features/stockAccess/stockAccessPermissions.js.
//
// Every quantity change goes through applyTransaction() -> the database
// function public.stock_access_apply(), which locks the item, refuses negative
// stock without an authorised override, updates the checkout / restock row and
// appends the ledger row in one transaction. Non-quantity events (item edits,
// restock requests, warranty storage) append a ledger row via
// insertTransaction(). The ledger is append-only (a trigger refuses UPDATE /
// DELETE), so nothing here ever edits history.
//
// Every store (src/config/stockAccessStores.js) shares these tables; list
// queries take a storeKey and rows carry store_key (checkouts and restock
// requests follow their item). store_key arrives with
// supabase/migrations/20260928140000_stock_access_stores.sql.
//
// Tables arrive with supabase/migrations/20260928130000_stock_access.sql. Until
// it is applied, isStockAccessMigrationPending() tells the pages why the
// screen is empty.

import { supabase } from "@/lib/database/supabaseClient";

const LOCATIONS = "stock_access_locations";
const ITEMS = "stock_access_items";
const CHECKOUTS = "stock_access_checkouts";
const RESTOCK = "stock_access_restock_requests";
const WARRANTY = "stock_access_warranty_records";
const TRANSACTIONS = "stock_access_transactions";
const NOTIFICATIONS = "notifications";

const OPEN_CHECKOUT_STATUSES = ["out", "missing"];
const OPEN_RESTOCK_STATUSES = ["requested", "ordered", "partially_received"];

export class StockAccessError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.name = "StockAccessError";
    this.status = status;
    this.code = code;
  }
}

// Messages raised by stock_access_apply() -> what the user is told.
const RPC_ERRORS = {
  STOCK_ACCESS_NOT_FOUND: [404, "Stock item not found."],
  STOCK_ACCESS_INACTIVE: [409, "This item is inactive. Ask Parts or a manager to reactivate it."],
  STOCK_ACCESS_NEGATIVE: [409, "There is not enough recorded stock for that. A manager can record it with an override."],
  STOCK_ACCESS_NOT_CHECKED_OUT: [409, "More would be returned than is checked out."],
  STOCK_ACCESS_CHECKOUT_NOT_FOUND: [404, "That checkout record was not found."],
  STOCK_ACCESS_CHECKOUT_CLOSED: [409, "That checkout has already been closed — refresh to see the latest."],
  STOCK_ACCESS_RETURN_TOO_MANY: [409, "More would be returned than is still out on that record."],
  STOCK_ACCESS_BAD_CHECKOUT_OP: [400, "Unknown checkout action."],
  STOCK_ACCESS_RESTOCK_NOT_FOUND: [404, "That restock request was not found."],
  STOCK_ACCESS_RESTOCK_CLOSED: [409, "That restock request is already closed."],
};

const unwrap = ({ data, error }, context) => {
  if (error) {
    const known = Object.keys(RPC_ERRORS).find((code) => String(error.message || "").includes(code));
    if (known) {
      const [status, message] = RPC_ERRORS[known];
      throw new StockAccessError(message, status, known);
    }
    const wrapped = new Error(`${context}: ${error.message}`);
    wrapped.cause = error;
    throw wrapped;
  }
  return data;
};

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// ---------------------------------------------------------------------------
// Migration detection (same pattern as src/lib/database/stockControl.js)
// ---------------------------------------------------------------------------
const PENDING_RECHECK_MS = 60 * 1000;
let migrationApplied = null;
let probedAt = 0;

export async function isStockAccessMigrationPending() {
  if (migrationApplied === true) return false;
  if (migrationApplied === false && Date.now() - probedAt < PENDING_RECHECK_MS) return true;
  // store_key arrives with the second migration, so this waits for both.
  const { error } = await supabase.from(TRANSACTIONS).select("id, store_key").limit(1);
  migrationApplied = !error;
  probedAt = Date.now();
  return !migrationApplied;
}

// ---------------------------------------------------------------------------
// Mappers (snake_case rows -> the camelCase shape the model and pages use)
// ---------------------------------------------------------------------------
export const mapLocation = (row = {}) => ({
  id: row.id,
  storeKey: row.store_key || null,
  key: row.key,
  name: row.name || "",
  department: row.department || "",
  description: row.description || "",
  sortOrder: row.sort_order ?? 0,
  isActive: row.is_active !== false,
});

export const mapItem = (row = {}) => ({
  id: row.id,
  storeKey: row.store_key || null,
  name: row.name || "",
  description: row.description || "",
  sku: row.sku || "",
  barcode: row.barcode || "",
  category: row.category || "consumables",
  subcategory: row.subcategory || "",
  department: row.department || "workshop",
  locationId: row.location_id || null,
  bin: row.bin || "",
  unitType: row.unit_type || "each",
  currentQuantity: numberOrNull(row.current_quantity) ?? 0,
  checkedOutQuantity: numberOrNull(row.checked_out_quantity) ?? 0,
  minQuantity: numberOrNull(row.min_quantity),
  reorderQuantity: numberOrNull(row.reorder_quantity),
  quantityStep: numberOrNull(row.quantity_step) ?? 1,
  returnRequired: row.return_required === true,
  loanPeriodHours: numberOrNull(row.loan_period_hours),
  supplierName: row.supplier_name || "",
  supplierPartNumber: row.supplier_part_number || "",
  unitCost: numberOrNull(row.unit_cost),
  isActive: row.is_active !== false,
  notes: row.notes || "",
  lastMovementAt: row.last_movement_at || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

// camelCase item fields -> columns. Only keys present on the input are written.
const ITEM_COLUMN_MAP = {
  storeKey: "store_key",
  name: "name",
  description: "description",
  sku: "sku",
  barcode: "barcode",
  category: "category",
  subcategory: "subcategory",
  department: "department",
  locationId: "location_id",
  bin: "bin",
  unitType: "unit_type",
  currentQuantity: "current_quantity",
  minQuantity: "min_quantity",
  reorderQuantity: "reorder_quantity",
  quantityStep: "quantity_step",
  returnRequired: "return_required",
  loanPeriodHours: "loan_period_hours",
  supplierName: "supplier_name",
  supplierPartNumber: "supplier_part_number",
  unitCost: "unit_cost",
  isActive: "is_active",
  notes: "notes",
  createdBy: "created_by",
  updatedBy: "updated_by",
};

const toItemColumns = (patch = {}) => {
  const row = {};
  Object.entries(ITEM_COLUMN_MAP).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) row[column] = patch[key] === "" ? null : patch[key];
  });
  return row;
};

export const mapCheckout = (row = {}) => ({
  id: row.id,
  itemId: row.item_id,
  holderUserId: row.holder_user_id ?? null,
  holderName: row.holder_name || "",
  quantity: numberOrNull(row.quantity) ?? 0,
  quantityReturned: numberOrNull(row.quantity_returned) ?? 0,
  status: row.status,
  takenAt: row.taken_at || null,
  dueAt: row.due_at || null,
  returnedAt: row.returned_at || null,
  missingAt: row.missing_at || null,
  jobNumber: row.job_number || "",
  vehicleReg: row.vehicle_reg || "",
  notes: row.notes || "",
});

export const mapRestock = (row = {}) => ({
  id: row.id,
  itemId: row.item_id,
  status: row.status,
  quantityRequested: numberOrNull(row.quantity_requested) ?? 0,
  quantityReceived: numberOrNull(row.quantity_received) ?? 0,
  reason: row.reason || "",
  notes: row.notes || "",
  requestedBy: row.requested_by ?? null,
  requesterName: row.requester_name || "",
  requestedAt: row.requested_at || null,
  supplierReference: row.supplier_reference || "",
  expectedAt: row.expected_at || null,
  orderedAt: row.ordered_at || null,
  receivedAt: row.received_at || null,
  cancelledAt: row.cancelled_at || null,
  cancelReason: row.cancel_reason || "",
  updatedAt: row.updated_at || null,
});

export const mapWarranty = (row = {}) => ({
  id: row.id,
  storeKey: row.store_key || null,
  itemId: row.item_id || null,
  partDescription: row.part_description || "",
  partNumber: row.part_number || "",
  quantity: numberOrNull(row.quantity) ?? 1,
  jobNumber: row.job_number || "",
  vehicleReg: row.vehicle_reg || "",
  claimReference: row.claim_reference || "",
  locationId: row.location_id || null,
  bin: row.bin || "",
  status: row.status,
  storedBy: row.stored_by ?? null,
  storedByName: row.stored_by_name || "",
  storedAt: row.stored_at || null,
  statusChangedAt: row.status_changed_at || null,
  outcomeReference: row.outcome_reference || "",
  notes: row.notes || "",
});

export const mapTransaction = (row = {}) => ({
  id: row.id,
  storeKey: row.store_key || null,
  itemId: row.item_id || null,
  action: row.action,
  quantity: numberOrNull(row.quantity) ?? 0,
  quantityOut: numberOrNull(row.quantity_out) ?? 0,
  quantityReturned: numberOrNull(row.quantity_returned) ?? 0,
  quantityConsumed: numberOrNull(row.quantity_consumed) ?? 0,
  quantityDelta: numberOrNull(row.quantity_delta) ?? 0,
  stockBefore: numberOrNull(row.stock_before),
  stockAfter: numberOrNull(row.stock_after),
  checkedOutAfter: numberOrNull(row.checked_out_after),
  availableAfter: numberOrNull(row.available_after),
  userId: row.user_id ?? null,
  userName: row.user_name || "",
  locationId: row.location_id || null,
  locationName: row.location_name || "",
  bin: row.bin || "",
  jobNumber: row.job_number || "",
  vehicleReg: row.vehicle_reg || "",
  reason: row.reason || "",
  notes: row.notes || "",
  checkoutId: row.checkout_id || null,
  restockRequestId: row.restock_request_id || null,
  warrantyRecordId: row.warranty_record_id || null,
  overrideNegative: row.override_negative === true,
  detail: row.detail || {},
  occurredAt: row.occurred_at,
});

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------
export async function listLocations(storeKey) {
  const data = unwrap(
    await supabase.from(LOCATIONS).select("*").eq("store_key", storeKey).order("sort_order").order("name"),
    "Unable to load stock locations"
  );
  return (data || []).map(mapLocation);
}

export async function saveLocation({ id = null, storeKey, key, name, department, description, sortOrder, isActive }) {
  const row = { updated_at: new Date().toISOString() };
  if (name !== undefined) row.name = name;
  if (department !== undefined) row.department = department || "workshop";
  if (description !== undefined) row.description = description || null;
  if (sortOrder !== undefined) row.sort_order = sortOrder;
  if (isActive !== undefined) row.is_active = isActive;
  const query = id
    ? supabase.from(LOCATIONS).update(row).eq("id", id).eq("store_key", storeKey)
    : supabase.from(LOCATIONS).insert({ ...row, key, store_key: storeKey });
  return mapLocation(unwrap(await query.select("*").single(), "Unable to save the location"));
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
export async function listItems({ storeKey, includeInactive = false } = {}) {
  let query = supabase.from(ITEMS).select("*").eq("store_key", storeKey).order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  const data = unwrap(await query, "Unable to load stock items");
  return (data || []).map(mapItem);
}

export async function getItem(id) {
  const data = unwrap(await supabase.from(ITEMS).select("*").eq("id", id).maybeSingle(), "Unable to load the stock item");
  return data ? mapItem(data) : null;
}

/** Another item in the store already using this SKU or barcode (codes are unique per store). */
export async function findItemByCode({ storeKey, sku, barcode, excludeId = null }) {
  // ilike without wildcards = case-insensitive equality; escape any the code contains.
  const exact = (value) => String(value || "").trim().replace(/[\\%_]/g, (match) => `\\${match}`);
  const found = [];
  if (sku) {
    let query = supabase.from(ITEMS).select("id, name, sku, barcode").eq("store_key", storeKey).ilike("sku", exact(sku));
    if (excludeId) query = query.neq("id", excludeId);
    found.push(...(unwrap(await query.limit(1), "Unable to check the SKU") || []));
  }
  if (barcode && !found.length) {
    let query = supabase.from(ITEMS).select("id, name, sku, barcode").eq("store_key", storeKey).eq("barcode", barcode);
    if (excludeId) query = query.neq("id", excludeId);
    found.push(...(unwrap(await query.limit(1), "Unable to check the barcode") || []));
  }
  return found[0] ? mapItem(found[0]) : null;
}

export async function createItem(fields) {
  return mapItem(unwrap(await supabase.from(ITEMS).insert(toItemColumns(fields)).select("*").single(), "Unable to create the stock item"));
}

/** Edits the record. Quantities never change here — only through applyTransaction. */
export async function updateItem(id, patch) {
  const row = { ...toItemColumns(patch), updated_at: new Date().toISOString() };
  delete row.current_quantity;
  delete row.store_key; // an item never changes store by edit
  return mapItem(unwrap(await supabase.from(ITEMS).update(row).eq("id", id).select("*").single(), "Unable to update the stock item"));
}

// ---------------------------------------------------------------------------
// Checkouts
// ---------------------------------------------------------------------------
/** Open checkouts for the given items (a store's items). */
export async function listOpenCheckouts(itemIds = []) {
  if (!itemIds.length) return [];
  const data = unwrap(
    await supabase
      .from(CHECKOUTS)
      .select("*")
      .in("item_id", itemIds)
      .in("status", OPEN_CHECKOUT_STATUSES)
      .order("taken_at", { ascending: false }),
    "Unable to load checked-out items"
  );
  return (data || []).map(mapCheckout);
}

export async function listCheckoutsForItem(itemId, limit = 100) {
  const data = unwrap(
    await supabase.from(CHECKOUTS).select("*").eq("item_id", itemId).order("taken_at", { ascending: false }).limit(limit),
    "Unable to load the item's checkouts"
  );
  return (data || []).map(mapCheckout);
}

export async function getCheckout(id) {
  const data = unwrap(await supabase.from(CHECKOUTS).select("*").eq("id", id).maybeSingle(), "Unable to load the checkout");
  return data ? mapCheckout(data) : null;
}

// ---------------------------------------------------------------------------
// Transactions (the ledger)
// ---------------------------------------------------------------------------
/**
 * Apply a planned quantity change atomically (see stock_access_apply in the
 * migration). Returns { duplicate, transaction, item, checkout, restock }.
 */
export async function applyTransaction({ itemId, action, quantityDelta = 0, checkedOutDelta = 0, allowNegative = false, entry = {}, checkoutOp = null, restockOp = null }) {
  const data = unwrap(
    await supabase.rpc("stock_access_apply", {
      p_item_id: itemId,
      p_action: action,
      p_quantity_delta: quantityDelta,
      p_checked_out_delta: checkedOutDelta,
      p_allow_negative: Boolean(allowNegative),
      p_entry: entry,
      p_checkout: checkoutOp,
      p_restock: restockOp,
    }),
    "Unable to record the stock movement"
  );
  return {
    duplicate: data?.duplicate === true,
    transaction: data?.transaction ? mapTransaction(data.transaction) : null,
    item: data?.item ? mapItem(data.item) : null,
    checkout: data?.checkout ? mapCheckout(data.checkout) : null,
    restock: data?.restock ? mapRestock(data.restock) : null,
  };
}

/** Append a non-quantity event (created, edited, restock / warranty events). */
export async function insertTransaction({
  item = null,
  action,
  quantity = 0,
  userId = null,
  userName = null,
  locationName = null,
  jobNumber = null,
  vehicleReg = null,
  reason = null,
  notes = null,
  restockRequestId = null,
  warrantyRecordId = null,
  locationId = null,
  bin = null,
  clientRequestId = null,
  storeKey = null,
  detail = {},
}) {
  const current = item ? Number(item.currentQuantity) || 0 : null;
  const out = item ? Number(item.checkedOutQuantity) || 0 : null;
  const data = unwrap(
    await supabase
      .from(TRANSACTIONS)
      .insert({
        item_id: item?.id || null,
        store_key: storeKey || item?.storeKey,
        action,
        quantity,
        stock_before: current,
        stock_after: current,
        checked_out_after: out,
        available_after: item ? current - out : null,
        user_id: userId,
        user_name: userName,
        location_id: locationId ?? item?.locationId ?? null,
        location_name: locationName,
        bin: bin ?? (item?.bin || null),
        job_number: jobNumber || null,
        vehicle_reg: vehicleReg || null,
        reason: reason || null,
        notes: notes || null,
        restock_request_id: restockRequestId,
        warranty_record_id: warrantyRecordId,
        client_request_id: clientRequestId,
        detail: detail || {},
      })
      .select("*")
      .single(),
    "Unable to record the stock event"
  );
  return mapTransaction(data);
}

/** The ledger row a submission already produced (idempotency for non-RPC writes). */
export async function findTransactionByRequestId(clientRequestId) {
  if (!clientRequestId) return null;
  const data = unwrap(
    await supabase.from(TRANSACTIONS).select("*").eq("client_request_id", clientRequestId).maybeSingle(),
    "Unable to check for a duplicate submission"
  );
  return data ? mapTransaction(data) : null;
}

export async function listTransactionsForItem(itemId, limit = 500) {
  const data = unwrap(
    await supabase.from(TRANSACTIONS).select("*").eq("item_id", itemId).order("occurred_at", { ascending: false }).limit(limit),
    "Unable to load the item history"
  );
  return (data || []).map(mapTransaction);
}

export async function listTransactionsForWarranty(warrantyRecordId) {
  const data = unwrap(
    await supabase.from(TRANSACTIONS).select("*").eq("warranty_record_id", warrantyRecordId).order("occurred_at", { ascending: false }),
    "Unable to load the warranty history"
  );
  return (data || []).map(mapTransaction);
}

/** Lightweight rows for "recent" / "common" rankings. */
export async function listMovementsSince(sinceIso, { storeKey, userId = null, limit = 2000 } = {}) {
  let query = supabase
    .from(TRANSACTIONS)
    .select("item_id, action, user_id, occurred_at")
    .eq("store_key", storeKey)
    .in("action", ["take_out", "return", "consume"])
    .gte("occurred_at", sinceIso)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (userId !== null) query = query.eq("user_id", userId);
  const data = unwrap(await query, "Unable to load recent stock movements");
  return (data || []).map(mapTransaction);
}

/** The activity log: newest first, optionally filtered. */
export async function listActivity({ storeKey, action = null, userId = null, itemId = null, sinceIso = null, limit = 300 } = {}) {
  let query = supabase.from(TRANSACTIONS).select("*").eq("store_key", storeKey).order("occurred_at", { ascending: false }).limit(limit);
  if (action) query = query.eq("action", action);
  if (userId !== null) query = query.eq("user_id", userId);
  if (itemId) query = query.eq("item_id", itemId);
  if (sinceIso) query = query.gte("occurred_at", sinceIso);
  const data = unwrap(await query, "Unable to load stock activity");
  return (data || []).map(mapTransaction);
}

// ---------------------------------------------------------------------------
// Restock requests
// ---------------------------------------------------------------------------
/** Restock requests for the given items (a store's items). */
export async function listRestockRequests({ itemIds = [], openOnly = false, limit = 300 } = {}) {
  if (!itemIds.length) return [];
  let query = supabase.from(RESTOCK).select("*").in("item_id", itemIds).order("requested_at", { ascending: false }).limit(limit);
  if (openOnly) query = query.in("status", OPEN_RESTOCK_STATUSES);
  const data = unwrap(await query, "Unable to load restock requests");
  return (data || []).map(mapRestock);
}

export async function listRestockForItem(itemId, limit = 50) {
  const data = unwrap(
    await supabase.from(RESTOCK).select("*").eq("item_id", itemId).order("requested_at", { ascending: false }).limit(limit),
    "Unable to load the item's restock requests"
  );
  return (data || []).map(mapRestock);
}

export async function getRestock(id) {
  const data = unwrap(await supabase.from(RESTOCK).select("*").eq("id", id).maybeSingle(), "Unable to load the restock request");
  return data ? mapRestock(data) : null;
}

export async function findOpenRestockForItem(itemId) {
  const data = unwrap(
    await supabase.from(RESTOCK).select("*").eq("item_id", itemId).in("status", OPEN_RESTOCK_STATUSES).limit(1),
    "Unable to check open restock requests"
  );
  return data?.[0] ? mapRestock(data[0]) : null;
}

/**
 * Create a request. Returns { request, existing } — when another request for
 * the item is already open (unique index), that one comes back as `existing`.
 */
export async function createRestock(fields) {
  const { data, error } = await supabase
    .from(RESTOCK)
    .insert({
      item_id: fields.itemId,
      quantity_requested: fields.quantityRequested,
      reason: fields.reason,
      notes: fields.notes || null,
      requested_by: fields.requestedBy ?? null,
      requester_name: fields.requesterName || null,
    })
    .select("*")
    .single();
  if (error && String(error.code) === "23505") {
    return { request: null, existing: await findOpenRestockForItem(fields.itemId) };
  }
  return { request: mapRestock(unwrap({ data, error }, "Unable to create the restock request")), existing: null };
}

const RESTOCK_COLUMN_MAP = {
  status: "status",
  quantityRequested: "quantity_requested",
  supplierReference: "supplier_reference",
  expectedAt: "expected_at",
  orderedBy: "ordered_by",
  orderedAt: "ordered_at",
  cancelledBy: "cancelled_by",
  cancelledAt: "cancelled_at",
  cancelReason: "cancel_reason",
  notes: "notes",
};

export async function updateRestock(id, patch) {
  const row = { updated_at: new Date().toISOString() };
  Object.entries(RESTOCK_COLUMN_MAP).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) row[column] = patch[key] === "" ? null : patch[key];
  });
  return mapRestock(unwrap(await supabase.from(RESTOCK).update(row).eq("id", id).select("*").single(), "Unable to update the restock request"));
}

// ---------------------------------------------------------------------------
// Warranty storage
// ---------------------------------------------------------------------------
export async function listWarrantyRecords({ storeKey, openOnly = false, limit = 300 } = {}) {
  let query = supabase.from(WARRANTY).select("*").eq("store_key", storeKey).order("stored_at", { ascending: false }).limit(limit);
  if (openOnly) query = query.in("status", ["stored", "awaiting_return"]);
  const data = unwrap(await query, "Unable to load warranty storage");
  return (data || []).map(mapWarranty);
}

export async function listWarrantyForItem(itemId, limit = 50) {
  const data = unwrap(
    await supabase.from(WARRANTY).select("*").eq("item_id", itemId).order("stored_at", { ascending: false }).limit(limit),
    "Unable to load the item's warranty records"
  );
  return (data || []).map(mapWarranty);
}

export async function getWarrantyRecord(id) {
  const data = unwrap(await supabase.from(WARRANTY).select("*").eq("id", id).maybeSingle(), "Unable to load the warranty record");
  return data ? mapWarranty(data) : null;
}

export async function createWarrantyRecord(fields) {
  const data = unwrap(
    await supabase
      .from(WARRANTY)
      .insert({
        store_key: fields.storeKey,
        item_id: fields.itemId || null,
        part_description: fields.partDescription,
        part_number: fields.partNumber || null,
        quantity: fields.quantity,
        job_number: fields.jobNumber || null,
        vehicle_reg: fields.vehicleReg || null,
        claim_reference: fields.claimReference || null,
        location_id: fields.locationId || null,
        bin: fields.bin || null,
        stored_by: fields.storedBy ?? null,
        stored_by_name: fields.storedByName || null,
        notes: fields.notes || null,
      })
      .select("*")
      .single(),
    "Unable to store the warranty part"
  );
  return mapWarranty(data);
}

export async function updateWarrantyRecord(id, patch) {
  const row = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.statusChangedBy !== undefined) row.status_changed_by = patch.statusChangedBy;
  if (patch.statusChangedAt !== undefined) row.status_changed_at = patch.statusChangedAt;
  if (patch.outcomeReference !== undefined) row.outcome_reference = patch.outcomeReference || null;
  if (patch.claimReference !== undefined) row.claim_reference = patch.claimReference || null;
  if (patch.locationId !== undefined) row.location_id = patch.locationId || null;
  if (patch.bin !== undefined) row.bin = patch.bin || null;
  if (patch.notes !== undefined) row.notes = patch.notes || null;
  return mapWarranty(unwrap(await supabase.from(WARRANTY).update(row).eq("id", id).select("*").single(), "Unable to update the warranty record"));
}

// ---------------------------------------------------------------------------
// Notifications — the shared DMS feed (same shape as stockControl.js)
// ---------------------------------------------------------------------------
export async function insertNotifications(rows = []) {
  if (!rows.length) return;
  unwrap(
    await supabase.from(NOTIFICATIONS).insert(rows.map((row) => ({ message: row.message, target_role: row.targetRole, type: row.type || "stock" }))),
    "Unable to send stock notifications"
  );
}
