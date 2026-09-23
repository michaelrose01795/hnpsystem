// file location: src/lib/database/stockControl.js
//
// Every Supabase read/write for the stock-control tracker (/tracking ->
// Oil/Stock), server side only. The browser reaches it over
// /api/tracking/stock/*, which enforces the capabilities in
// src/features/stockControl/stockAccess.js and writes the ledger row + platform
// audit record for every accepted change (src/lib/stockControl/stockApi.js).
//
// Tables:
//   tracking_oil_stock           the items (one product at one location)
//   tracking_stock_categories    configurable categories
//   tracking_stock_locations     configurable locations + department
//   tracking_stock_orders        order workflow incl. partial deliveries
//   tracking_stock_stocktakes    guided stocktake runs
//   tracking_stock_movements     the ledger every history / trend reads
//   notifications                the shared DMS notification feed (insert only)
//
// Everything except tracking_oil_stock arrives with
// supabase/migrations/20260922140000_stock_control.sql. Until that is applied
// the tracker still lists the existing items read-only;
// `isStockControlMigrationPending()` tells the page why the controls are off.

import { supabase } from "@/lib/database/supabaseClient";

const ITEMS = "tracking_oil_stock";
const CATEGORIES = "tracking_stock_categories";
const LOCATIONS = "tracking_stock_locations";
const ORDERS = "tracking_stock_orders";
const STOCKTAKES = "tracking_stock_stocktakes";
const MOVEMENTS = "tracking_stock_movements";
const NOTIFICATIONS = "notifications";

const OPEN_ORDER_STATUSES = ["order_required", "ordered", "awaiting_delivery", "partially_received"];

// ---------------------------------------------------------------------------
// Migration detection
// ---------------------------------------------------------------------------
// A positive probe is kept for the life of the process; a negative one is
// re-checked after a minute so applying the migration needs no restart.
const PENDING_RECHECK_MS = 60 * 1000;
let migrationApplied = null;
let probedAt = 0;

export async function isStockControlMigrationPending() {
  if (migrationApplied === true) return false;
  if (migrationApplied === false && Date.now() - probedAt < PENDING_RECHECK_MS) return true;
  const { error } = await supabase.from(MOVEMENTS).select("id").limit(1);
  migrationApplied = !error;
  probedAt = Date.now();
  return !migrationApplied;
}

const unwrap = ({ data, error }, context) => {
  if (error) {
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
// Mappers (snake_case rows -> the camelCase shape the model and panel use)
// ---------------------------------------------------------------------------
export const mapItem = (row = {}) => ({
  id: row.id,
  title: row.title || "",
  stockCode: row.stock_code || "",
  barcode: row.barcode || "",
  categoryId: row.category_id || null,
  locationId: row.location_id || null,
  oilGrade: row.oil_grade || "",
  measurementMode: row.measurement_mode || "count",
  unit: row.unit || "units",
  customUnitLabel: row.custom_unit_label || "",
  currentQuantity: numberOrNull(row.current_quantity),
  levelBand: row.level_band || null,
  minLevel: numberOrNull(row.min_level),
  criticalLevel: numberOrNull(row.critical_level),
  targetLevel: numberOrNull(row.target_level),
  reorderQuantity: numberOrNull(row.reorder_quantity),
  maxCapacity: numberOrNull(row.max_capacity),
  preferredSupplier: row.preferred_supplier || "",
  supplierProductCode: row.supplier_product_code || "",
  leadTimeDays: numberOrNull(row.lead_time_days),
  unitCost: numberOrNull(row.unit_cost),
  dipstickReading: numberOrNull(row.dipstick_reading),
  dipstickUnit: row.dipstick_unit || "cm",
  calibration: Array.isArray(row.calibration) ? row.calibration : [],
  lastCheck: row.last_check || null,
  nextCheck: row.next_check || null,
  lastToppedUp: row.last_topped_up || null,
  lastFilledAt: row.last_filled_at || null,
  intervalDays: numberOrNull(row.interval_days),
  notes: row.notes || "",
  // The pre-upgrade free-text stock note, kept read-only for reference.
  legacyStock: row.stock || "",
  alertState: row.alert_state || null,
  checkAlertedAt: row.check_alerted_at || null,
  consumableId: row.consumable_id || null,
  archivedAt: row.archived_at || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

// camelCase item fields -> columns. Only keys present on the input are written.
const ITEM_COLUMN_MAP = {
  title: "title",
  stockCode: "stock_code",
  barcode: "barcode",
  categoryId: "category_id",
  locationId: "location_id",
  oilGrade: "oil_grade",
  measurementMode: "measurement_mode",
  unit: "unit",
  customUnitLabel: "custom_unit_label",
  currentQuantity: "current_quantity",
  levelBand: "level_band",
  minLevel: "min_level",
  criticalLevel: "critical_level",
  targetLevel: "target_level",
  reorderQuantity: "reorder_quantity",
  maxCapacity: "max_capacity",
  preferredSupplier: "preferred_supplier",
  supplierProductCode: "supplier_product_code",
  leadTimeDays: "lead_time_days",
  unitCost: "unit_cost",
  dipstickReading: "dipstick_reading",
  dipstickUnit: "dipstick_unit",
  calibration: "calibration",
  lastCheck: "last_check",
  nextCheck: "next_check",
  lastToppedUp: "last_topped_up",
  lastFilledAt: "last_filled_at",
  intervalDays: "interval_days",
  intervalLabel: "interval_label",
  notes: "notes",
  alertState: "alert_state",
  checkAlertedAt: "check_alerted_at",
  archivedAt: "archived_at",
  archivedBy: "archived_by",
  updatedBy: "updated_by",
  createdBy: "created_by",
};

const toItemColumns = (patch = {}) => {
  const row = {};
  Object.entries(ITEM_COLUMN_MAP).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) row[column] = patch[key] === "" ? null : patch[key];
  });
  return row;
};

export const mapOrder = (row = {}) => ({
  id: row.id,
  itemId: row.item_id,
  status: row.status,
  supplier: row.supplier || "",
  supplierProductCode: row.supplier_product_code || "",
  quantityOrdered: numberOrNull(row.quantity_ordered) || 0,
  quantityReceived: numberOrNull(row.quantity_received) || 0,
  unitCost: numberOrNull(row.unit_cost),
  expectedDelivery: row.expected_delivery || null,
  reference: row.reference || "",
  notes: row.notes || "",
  orderedAt: row.ordered_at || null,
  receivedAt: row.received_at || null,
  delayAlertedAt: row.delay_alerted_at || null,
  createdBy: row.created_by || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const ORDER_COLUMN_MAP = {
  itemId: "item_id",
  status: "status",
  supplier: "supplier",
  supplierProductCode: "supplier_product_code",
  quantityOrdered: "quantity_ordered",
  quantityReceived: "quantity_received",
  unitCost: "unit_cost",
  expectedDelivery: "expected_delivery",
  reference: "reference",
  notes: "notes",
  orderedAt: "ordered_at",
  receivedAt: "received_at",
  delayAlertedAt: "delay_alerted_at",
  createdBy: "created_by",
  updatedBy: "updated_by",
};

const toOrderColumns = (patch = {}) => {
  const row = {};
  Object.entries(ORDER_COLUMN_MAP).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) row[column] = patch[key] === "" ? null : patch[key];
  });
  return row;
};

export const mapMovement = (row = {}) => ({
  id: row.id,
  itemId: row.item_id,
  movementType: row.movement_type,
  quantityBefore: numberOrNull(row.quantity_before),
  quantityAfter: numberOrNull(row.quantity_after),
  quantityDelta: numberOrNull(row.quantity_delta),
  levelBand: row.level_band || null,
  dipstickReading: numberOrNull(row.dipstick_reading),
  unitCost: numberOrNull(row.unit_cost),
  reason: row.reason || "",
  jobNumber: row.job_number || "",
  notes: row.notes || "",
  orderId: row.order_id || null,
  stocktakeId: row.stocktake_id || null,
  locationId: row.location_id || null,
  actorUserId: row.actor_user_id || null,
  actorName: row.actor_name || "",
  detail: row.detail || {},
  createdAt: row.created_at,
});

export const mapCategory = (row = {}) => ({
  id: row.id,
  key: row.key,
  name: row.name,
  sortOrder: row.sort_order ?? 0,
  isActive: row.is_active !== false,
});

export const mapLocation = (row = {}) => ({
  id: row.id,
  key: row.key,
  name: row.name,
  department: row.department || "",
  sortOrder: row.sort_order ?? 0,
  isActive: row.is_active !== false,
});

export const mapStocktake = (row = {}) => ({
  id: row.id,
  scopeType: row.scope_type,
  scopeId: row.scope_id || null,
  scopeLabel: row.scope_label || "",
  status: row.status,
  itemCount: row.item_count || 0,
  countedCount: row.counted_count || 0,
  varianceCount: row.variance_count || 0,
  varianceValue: numberOrNull(row.variance_value),
  startedBy: row.started_by || null,
  startedAt: row.started_at,
  completedAt: row.completed_at || null,
});

// ---------------------------------------------------------------------------
// Categories and locations
// ---------------------------------------------------------------------------
export async function listCategories() {
  const data = unwrap(await supabase.from(CATEGORIES).select("*").order("sort_order").order("name"), "Unable to load stock categories");
  return (data || []).map(mapCategory);
}

export async function listLocations() {
  const data = unwrap(await supabase.from(LOCATIONS).select("*").order("sort_order").order("name"), "Unable to load stock locations");
  return (data || []).map(mapLocation);
}

const TAXONOMY_TABLE = { category: CATEGORIES, location: LOCATIONS };

export async function saveTaxonomyEntry(kind, { id = null, key, name, department, sortOrder, isActive }) {
  const table = TAXONOMY_TABLE[kind];
  if (!table) throw new Error(`Unknown stock setting type: ${kind}`);
  const row = { updated_at: new Date().toISOString() };
  if (name !== undefined) row.name = name;
  if (sortOrder !== undefined) row.sort_order = sortOrder;
  if (isActive !== undefined) row.is_active = isActive;
  if (kind === "location" && department !== undefined) row.department = department || null;
  const query = id
    ? supabase.from(table).update(row).eq("id", id)
    : supabase.from(table).insert({ ...row, key });
  const data = unwrap(await query.select("*").single(), `Unable to save stock ${kind}`);
  return kind === "category" ? mapCategory(data) : mapLocation(data);
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
export async function listItems() {
  const data = unwrap(await supabase.from(ITEMS).select("*").order("title"), "Unable to load stock items");
  return (data || []).map(mapItem);
}

export async function getItem(id) {
  const data = unwrap(await supabase.from(ITEMS).select("*").eq("id", id).maybeSingle(), "Unable to load stock item");
  return data ? mapItem(data) : null;
}

/** An active item with the same name at the same location (the duplicate guard). */
export async function findActiveDuplicate({ title, locationId, excludeId = null }) {
  // ilike without wildcards = case-insensitive equality; escape any the name contains.
  const exact = String(title || "").trim().replace(/[\\%_]/g, (match) => `\\${match}`);
  let query = supabase.from(ITEMS).select("id, title, location_id").is("archived_at", null).ilike("title", exact);
  query = locationId ? query.eq("location_id", locationId) : query.is("location_id", null);
  if (excludeId) query = query.neq("id", excludeId);
  const data = unwrap(await query.limit(1), "Unable to check for duplicate stock items");
  return data?.[0] ? mapItem(data[0]) : null;
}

export async function findItemByCode({ stockCode, barcode, excludeId = null }) {
  const filters = [];
  if (stockCode) filters.push(`stock_code.ilike.${String(stockCode).replace(/[,()]/g, "")}`);
  if (barcode) filters.push(`barcode.eq.${String(barcode).replace(/[,()]/g, "")}`);
  if (!filters.length) return null;
  let query = supabase.from(ITEMS).select("id, title, stock_code, barcode").or(filters.join(","));
  if (excludeId) query = query.neq("id", excludeId);
  const data = unwrap(await query.limit(1), "Unable to check stock codes");
  return data?.[0] ? mapItem(data[0]) : null;
}

export async function createItem(fields) {
  const data = unwrap(await supabase.from(ITEMS).insert(toItemColumns(fields)).select("*").single(), "Unable to create stock item");
  return mapItem(data);
}

export async function updateItem(id, patch) {
  const row = { ...toItemColumns(patch), updated_at: new Date().toISOString() };
  const data = unwrap(await supabase.from(ITEMS).update(row).eq("id", id).select("*").single(), "Unable to update stock item");
  return mapItem(data);
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export async function listOpenOrders() {
  const data = unwrap(
    await supabase.from(ORDERS).select("*").in("status", OPEN_ORDER_STATUSES).order("created_at", { ascending: false }),
    "Unable to load stock orders"
  );
  return (data || []).map(mapOrder);
}

export async function listOrdersForItem(itemId, limit = 50) {
  const data = unwrap(
    await supabase.from(ORDERS).select("*").eq("item_id", itemId).order("created_at", { ascending: false }).limit(limit),
    "Unable to load the item's orders"
  );
  return (data || []).map(mapOrder);
}

export async function getOrder(id) {
  const data = unwrap(await supabase.from(ORDERS).select("*").eq("id", id).maybeSingle(), "Unable to load stock order");
  return data ? mapOrder(data) : null;
}

export async function createOrder(fields) {
  const data = unwrap(await supabase.from(ORDERS).insert(toOrderColumns(fields)).select("*").single(), "Unable to create stock order");
  return mapOrder(data);
}

export async function updateOrder(id, patch) {
  const row = { ...toOrderColumns(patch), updated_at: new Date().toISOString() };
  const data = unwrap(await supabase.from(ORDERS).update(row).eq("id", id).select("*").single(), "Unable to update stock order");
  return mapOrder(data);
}

// ---------------------------------------------------------------------------
// Movements
// ---------------------------------------------------------------------------
const MOVEMENT_COLUMNS =
  "id, item_id, movement_type, quantity_before, quantity_after, quantity_delta, level_band, dipstick_reading, unit_cost, reason, job_number, notes, order_id, stocktake_id, location_id, actor_user_id, actor_name, detail, created_at";

export async function recordMovement({
  itemId,
  movementType,
  quantityBefore = null,
  quantityAfter = null,
  quantityDelta = null,
  levelBand = null,
  dipstickReading = null,
  unitCost = null,
  reason = null,
  jobNumber = null,
  notes = null,
  orderId = null,
  stocktakeId = null,
  locationId = null,
  actorUserId = null,
  actorName = null,
  detail = {},
}) {
  const data = unwrap(
    await supabase
      .from(MOVEMENTS)
      .insert({
        item_id: itemId,
        movement_type: movementType,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        quantity_delta: quantityDelta,
        level_band: levelBand,
        dipstick_reading: dipstickReading,
        unit_cost: unitCost,
        reason: reason || null,
        job_number: jobNumber || null,
        notes: notes || null,
        order_id: orderId,
        stocktake_id: stocktakeId,
        location_id: locationId,
        actor_user_id: actorUserId,
        actor_name: actorName,
        detail: detail || {},
      })
      .select(MOVEMENT_COLUMNS)
      .single(),
    "Unable to record stock movement"
  );
  return mapMovement(data);
}

/** Quantity movements for every item since a date — the usage-trend input. */
export async function listMovementsSince(sinceIso) {
  const data = unwrap(
    await supabase
      .from(MOVEMENTS)
      .select("item_id, movement_type, quantity_delta, actor_name, created_at")
      .in("movement_type", ["check", "stock_in", "stock_out", "adjustment", "receipt", "stocktake"])
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .limit(20000),
    "Unable to load stock movements"
  );
  return (data || []).map(mapMovement);
}

export async function listMovementsForItem(itemId, limit = 250) {
  const data = unwrap(
    await supabase.from(MOVEMENTS).select(MOVEMENT_COLUMNS).eq("item_id", itemId).order("created_at", { ascending: false }).limit(limit),
    "Unable to load stock history"
  );
  return (data || []).map(mapMovement);
}

// ---------------------------------------------------------------------------
// Stocktakes
// ---------------------------------------------------------------------------
export async function createStocktake(fields) {
  const data = unwrap(
    await supabase
      .from(STOCKTAKES)
      .insert({
        scope_type: fields.scopeType,
        scope_id: fields.scopeId || null,
        scope_label: fields.scopeLabel || null,
        item_count: fields.itemCount || 0,
        started_by: fields.startedBy || null,
      })
      .select("*")
      .single(),
    "Unable to start stocktake"
  );
  return mapStocktake(data);
}

export async function getStocktake(id) {
  const data = unwrap(await supabase.from(STOCKTAKES).select("*").eq("id", id).maybeSingle(), "Unable to load stocktake");
  return data ? mapStocktake(data) : null;
}

export async function updateStocktake(id, patch) {
  const row = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.countedCount !== undefined) row.counted_count = patch.countedCount;
  if (patch.varianceCount !== undefined) row.variance_count = patch.varianceCount;
  if (patch.varianceValue !== undefined) row.variance_value = patch.varianceValue;
  if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
  if (patch.notes !== undefined) row.notes = patch.notes;
  const data = unwrap(await supabase.from(STOCKTAKES).update(row).eq("id", id).select("*").single(), "Unable to update stocktake");
  return mapStocktake(data);
}

export async function listStocktakeMovements(stocktakeId) {
  const data = unwrap(
    await supabase.from(MOVEMENTS).select(MOVEMENT_COLUMNS).eq("stocktake_id", stocktakeId).order("created_at"),
    "Unable to load stocktake counts"
  );
  return (data || []).map(mapMovement);
}

// ---------------------------------------------------------------------------
// Notifications (the shared DMS feed — same insert shape as
// src/lib/notifications/notifyJobStatusChange.js)
// ---------------------------------------------------------------------------
export async function insertNotifications(rows = []) {
  if (!rows.length) return;
  unwrap(
    await supabase.from(NOTIFICATIONS).insert(
      rows.map((row) => ({ message: row.message, target_role: row.targetRole, type: row.type || "stock" }))
    ),
    "Unable to send stock notifications"
  );
}
