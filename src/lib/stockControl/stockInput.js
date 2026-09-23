// file location: src/lib/stockControl/stockInput.js
//
// Request-body parsing for /api/tracking/stock/*. Every write route turns the
// raw JSON into a clean, bounded object here (or a list of field errors), so
// the routes never trust a browser value directly. Enumerations come from the
// shared model so the API accepts exactly what the panel offers.

import {
  CHECK_INTERVAL_OPTIONS,
  DIPSTICK_UNITS,
  LEVEL_BANDS,
  MEASUREMENT_MODES,
  ORDER_STATUSES,
  STOCK_UNITS,
  normaliseCalibration,
  toNumber,
} from "@/features/stockControl/stockModel";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_QUANTITY = 1_000_000;

export const text = (value, max = 200) => {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, max);
};

const oneOf = (value, options, fallback) =>
  options.some((option) => option.value === value) ? value : fallback;

/** A non-negative quantity, or null for blank. `errors` collects messages. */
export function quantity(value, label, errors, { required = false, allowZero = true } = {}) {
  const number = toNumber(value);
  if (number === null) {
    if (required) errors.push(`${label} is required.`);
    return null;
  }
  if (number < 0 || (!allowZero && number === 0)) {
    errors.push(`${label} must be ${allowZero ? "zero or more" : "more than zero"}.`);
    return null;
  }
  if (number > MAX_QUANTITY) {
    errors.push(`${label} is too large.`);
    return null;
  }
  return Math.round(number * 1000) / 1000;
}

export const uuidOrNull = (value) => (UUID_RE.test(String(value || "")) ? String(value) : null);

/**
 * Item create / edit. `partial` accepts a subset (edit); create requires a
 * title. The current quantity is only accepted on create — after that it can
 * only change through a check, movement or stocktake, so every change is in
 * the ledger.
 */
export function parseItemInput(body = {}, { create = false } = {}) {
  const errors = [];
  const item = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  if (create || has("title")) {
    item.title = text(body.title, 120);
    if (!item.title) errors.push("Name is required.");
  }
  ["stockCode", "barcode", "oilGrade", "preferredSupplier", "supplierProductCode", "customUnitLabel"].forEach((key) => {
    if (has(key)) item[key] = text(body[key], 80);
  });
  if (has("notes")) item.notes = text(body.notes, 1000);
  if (has("categoryId")) item.categoryId = uuidOrNull(body.categoryId);
  if (has("locationId")) item.locationId = uuidOrNull(body.locationId);
  if (create || has("measurementMode")) item.measurementMode = oneOf(body.measurementMode, MEASUREMENT_MODES, "count");
  if (create || has("unit")) item.unit = oneOf(body.unit, STOCK_UNITS, "units");
  if (item.unit === "custom" && has("customUnitLabel") && !item.customUnitLabel) errors.push("Name the custom unit.");
  if (has("dipstickUnit")) item.dipstickUnit = oneOf(body.dipstickUnit, DIPSTICK_UNITS, "cm");

  [
    ["minLevel", "Minimum level"],
    ["criticalLevel", "Critical level"],
    ["targetLevel", "Target level"],
    ["reorderQuantity", "Reorder quantity"],
    ["maxCapacity", "Maximum capacity"],
    ["unitCost", "Unit cost"],
  ].forEach(([key, label]) => {
    if (has(key)) item[key] = quantity(body[key], label, errors);
  });
  if (has("leadTimeDays")) {
    const days = quantity(body.leadTimeDays, "Lead time", errors);
    item.leadTimeDays = days === null ? null : Math.min(365, Math.round(days));
  }
  if (has("intervalDays")) {
    const days = toNumber(body.intervalDays);
    item.intervalDays = days && days > 0 ? Math.min(730, Math.round(days)) : null;
    item.intervalLabel = CHECK_INTERVAL_OPTIONS.find((option) => option.value === item.intervalDays)?.label || null;
  }
  if (has("calibration")) {
    item.calibration = normaliseCalibration(body.calibration).slice(0, 100);
  }
  if (create && has("currentQuantity")) item.currentQuantity = quantity(body.currentQuantity, "Current quantity", errors);
  if (create && has("levelBand")) item.levelBand = oneOf(body.levelBand, LEVEL_BANDS, null);

  if (item.minLevel !== undefined && item.targetLevel !== undefined && item.minLevel !== null && item.targetLevel !== null && item.targetLevel < item.minLevel) {
    errors.push("Target level should be at or above the minimum level.");
  }
  if (item.maxCapacity && item.targetLevel && item.targetLevel > item.maxCapacity) {
    errors.push("Target level cannot be above the maximum capacity.");
  }
  if (item.measurementMode === "level" && create && !item.maxCapacity) {
    // Allowed, but the quantity can then only be estimated once a capacity is set.
  }
  return { item, errors };
}

/** Check / stock in / stock out / adjustment / request-order bodies. */
export function parseMovementInput(body = {}) {
  const errors = [];
  const type = text(body.type, 30);
  const input = {
    type,
    itemId: uuidOrNull(body.itemId),
    reason: text(body.reason, 120),
    jobNumber: text(body.jobNumber, 40),
    notes: text(body.notes, 1000),
  };
  if (!input.itemId) errors.push("A stock item is required.");
  if (!["check", "stock_in", "stock_out", "adjustment", "request_order"].includes(type)) errors.push("Unknown stock action.");

  if (type === "check") {
    input.quantity = quantity(body.quantity, "Quantity", errors);
    input.levelBand = body.levelBand ? oneOf(body.levelBand, LEVEL_BANDS, null) : null;
    input.dipstickReading = quantity(body.dipstickReading, "Dipstick reading", errors);
    if (input.quantity === null && !input.levelBand && input.dipstickReading === null) {
      errors.push("Record a quantity, a level or a dipstick reading.");
    }
  }
  if (type === "stock_in" || type === "stock_out") {
    input.quantity = quantity(body.quantity, "Quantity", errors, { required: true, allowZero: false });
    if (type === "stock_in") input.unitCost = quantity(body.unitCost, "Unit cost", errors);
    if (!input.reason) errors.push("Choose a reason.");
  }
  if (type === "adjustment") {
    input.mode = body.mode === "set" ? "set" : "delta";
    if (input.mode === "set") {
      input.quantity = quantity(body.quantity, "New quantity", errors, { required: true });
    } else {
      const delta = toNumber(body.delta);
      if (delta === null || delta === 0) errors.push("Enter the amount to add or remove.");
      input.delta = delta;
    }
    if (!input.reason) errors.push("A reason is required for every adjustment.");
  }
  return { input, errors };
}

/** Order create / update. */
export function parseOrderInput(body = {}, { create = false } = {}) {
  const errors = [];
  const order = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
  if (create) {
    order.itemId = uuidOrNull(body.itemId);
    if (!order.itemId) errors.push("A stock item is required.");
  }
  if (create || has("status")) {
    order.status = oneOf(body.status, ORDER_STATUSES, "ordered");
    if (create && ["received", "partially_received", "cancelled"].includes(order.status)) {
      errors.push("A new order starts as Order Required, Ordered or Awaiting Delivery.");
    }
  }
  if (create || has("quantityOrdered")) {
    order.quantityOrdered = quantity(body.quantityOrdered, "Order quantity", errors, { required: create, allowZero: false });
  }
  if (has("supplier")) order.supplier = text(body.supplier, 120);
  if (has("supplierProductCode")) order.supplierProductCode = text(body.supplierProductCode, 80);
  if (has("reference")) order.reference = text(body.reference, 80);
  if (has("notes")) order.notes = text(body.notes, 1000);
  if (has("unitCost")) order.unitCost = quantity(body.unitCost, "Unit cost", errors);
  if (has("expectedDelivery")) {
    const date = text(body.expectedDelivery, 10);
    if (date && !ISO_DATE_RE.test(date)) errors.push("Expected delivery must be a date.");
    order.expectedDelivery = date || null;
  }
  return { order, errors };
}

export function parseReceiptInput(body = {}) {
  const errors = [];
  const receipt = {
    quantity: quantity(body.quantity, "Quantity received", errors, { required: true, allowZero: false }),
    unitCost: quantity(body.unitCost, "Unit cost", errors),
    notes: text(body.notes, 1000),
    closeShort: body.closeShort === true,
  };
  return { receipt, errors };
}
