// file location: src/lib/stockAccess/stockAccessInput.js
//
// Request-body parsing for /api/access/*. Every write route turns the raw JSON
// into a clean, bounded object here (or a list of field errors), so the routes
// never trust a browser value directly. Enumerations come from the shared
// model so the API accepts exactly what the pages offer.

import {
  RESTOCK_REASONS,
  STOCK_ACCESS_CATEGORIES,
  UNIT_TYPES,
  WARRANTY_STATUSES,
  toNumber,
} from "@/features/stockAccess/stockAccessModel";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_QUANTITY = 1_000_000;

export const text = (value, max = 200) => {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, max);
};

export const uuidOrNull = (value) => (UUID_RE.test(String(value || "")) ? String(value) : null);

const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key);
const oneOf = (value, options, fallback) => (options.some((option) => option.value === value) ? value : fallback);

/** A vehicle registration, normalised to upper case without spaces. */
export const vehicleReg = (value) => text(value, 12).toUpperCase().replace(/\s+/g, "");

/** A quantity; `signed` allows negatives (adjustments). */
export function quantity(value, label, errors, { required = false, signed = false, allowZero = true } = {}) {
  const number = toNumber(value);
  if (number === null) {
    if (required) errors.push(`${label} is required.`);
    return null;
  }
  if ((!signed && number < 0) || (!allowZero && number === 0)) {
    errors.push(`${label} must be ${allowZero ? "zero or more" : "more than zero"}.`);
    return null;
  }
  if (Math.abs(number) > MAX_QUANTITY) {
    errors.push(`${label} is too large.`);
    return null;
  }
  return Math.round(number * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------
export const TRANSACTION_ACTIONS = ["take_out", "return", "consume", "receive", "adjustment", "mark_missing", "found", "write_off"];

export function parseTransactionInput(body = {}) {
  const errors = [];
  const input = {
    itemId: uuidOrNull(body.itemId),
    action: TRANSACTION_ACTIONS.includes(body.action) ? body.action : null,
    mode: body.mode === "set" ? "set" : "delta",
    checkoutId: uuidOrNull(body.checkoutId),
    restockRequestId: uuidOrNull(body.restockRequestId),
    jobNumber: text(body.jobNumber, 30),
    vehicleReg: vehicleReg(body.vehicleReg),
    reason: text(body.reason, 200),
    notes: text(body.notes, 1000),
    clientRequestId: uuidOrNull(body.clientRequestId),
    allowNegative: body.allowNegative === true,
  };
  if (!input.itemId) errors.push("Choose an item.");
  if (!input.action) errors.push("Choose what you are doing with the item.");
  if (!input.clientRequestId) errors.push("The request is missing its submission reference. Refresh and try again.");
  input.quantity = quantity(body.quantity, "Quantity", errors, { signed: input.action === "adjustment" });
  return { input, errors };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
/**
 * Item create / edit. The current quantity is accepted on create only (the
 * opening balance, recorded as an adjustment); after that it changes only
 * through a transaction, so every change is in the ledger.
 */
export function parseItemInput(body = {}, { create = false } = {}) {
  const errors = [];
  const item = {};

  if (create || has(body, "name")) {
    item.name = text(body.name, 120);
    if (!item.name) errors.push("Name is required.");
  }
  if (create || has(body, "category")) {
    item.category = oneOf(body.category, STOCK_ACCESS_CATEGORIES, null);
    if (!item.category) errors.push("Choose a category.");
  }
  ["subcategory", "bin", "supplierName", "supplierPartNumber"].forEach((key) => {
    if (has(body, key)) item[key] = text(body[key], 80);
  });
  if (has(body, "sku")) item.sku = text(body.sku, 60);
  if (has(body, "barcode")) item.barcode = text(body.barcode, 80);
  if (has(body, "description")) item.description = text(body.description, 1000);
  if (has(body, "notes")) item.notes = text(body.notes, 1000);
  if (has(body, "department")) item.department = text(body.department, 40).toLowerCase() || "workshop";
  if (has(body, "locationId")) item.locationId = uuidOrNull(body.locationId);
  if (create || has(body, "unitType")) item.unitType = oneOf(body.unitType, UNIT_TYPES, "each");
  if (has(body, "returnRequired")) item.returnRequired = body.returnRequired === true;
  if (has(body, "isActive")) item.isActive = body.isActive !== false;

  [
    ["minQuantity", "Minimum quantity"],
    ["reorderQuantity", "Reorder quantity"],
    ["unitCost", "Unit cost"],
  ].forEach(([key, label]) => {
    if (has(body, key)) item[key] = quantity(body[key], label, errors);
  });
  if (has(body, "quantityStep")) {
    item.quantityStep = quantity(body.quantityStep, "Quantity step", errors, { allowZero: false }) ?? 1;
  }
  if (has(body, "loanPeriodHours")) {
    const hours = quantity(body.loanPeriodHours, "Loan period", errors, { allowZero: false });
    item.loanPeriodHours = hours === null ? null : Math.round(hours);
  }
  if (create) item.openingQuantity = quantity(body.openingQuantity, "Opening quantity", errors) ?? 0;

  return { item, errors };
}

// ---------------------------------------------------------------------------
// Restock
// ---------------------------------------------------------------------------
export function parseRestockCreate(body = {}) {
  const errors = [];
  const input = {
    itemId: uuidOrNull(body.itemId),
    reason: RESTOCK_REASONS.includes(body.reason) ? body.reason : null,
    notes: text(body.notes, 500),
  };
  if (!input.itemId) errors.push("Choose an item.");
  if (!input.reason) errors.push("Choose a reason.");
  input.quantityRequested = quantity(body.quantityRequested, "Quantity", errors, { required: true, allowZero: false });
  return { input, errors };
}

export const RESTOCK_UPDATE_ACTIONS = ["order", "cancel", "edit"];

export function parseRestockUpdate(body = {}) {
  const errors = [];
  const input = {
    id: uuidOrNull(body.id),
    action: RESTOCK_UPDATE_ACTIONS.includes(body.action) ? body.action : null,
    supplierReference: text(body.supplierReference, 80),
    expectedAt: ISO_DATE_RE.test(String(body.expectedAt || "")) ? body.expectedAt : null,
    reason: text(body.reason, 200),
    notes: has(body, "notes") ? text(body.notes, 500) : undefined,
  };
  if (!input.id) errors.push("Choose a restock request.");
  if (!input.action) errors.push("Unknown restock action.");
  if (has(body, "quantityRequested")) {
    input.quantityRequested = quantity(body.quantityRequested, "Quantity", errors, { allowZero: false });
  }
  if (input.action === "cancel" && !input.reason) errors.push("Give a reason for cancelling.");
  return { input, errors };
}

// ---------------------------------------------------------------------------
// Warranty
// ---------------------------------------------------------------------------
export function parseWarrantyCreate(body = {}) {
  const errors = [];
  const input = {
    itemId: uuidOrNull(body.itemId),
    partDescription: text(body.partDescription, 200),
    partNumber: text(body.partNumber, 60),
    jobNumber: text(body.jobNumber, 30),
    vehicleReg: vehicleReg(body.vehicleReg),
    claimReference: text(body.claimReference, 60),
    locationId: uuidOrNull(body.locationId),
    bin: text(body.bin, 60),
    notes: text(body.notes, 1000),
    clientRequestId: uuidOrNull(body.clientRequestId),
  };
  input.quantity = quantity(body.quantity ?? 1, "Quantity", errors, { allowZero: false }) ?? 1;
  if (!input.partDescription && !input.itemId) errors.push("Describe the part.");
  if (!input.jobNumber && !input.vehicleReg) errors.push("Enter the job number or vehicle registration.");
  return { input, errors };
}

export function parseWarrantyUpdate(body = {}) {
  const errors = [];
  const input = {
    id: uuidOrNull(body.id),
    status: WARRANTY_STATUSES.some((entry) => entry.value === body.status) ? body.status : null,
    outcomeReference: text(body.outcomeReference, 80),
    notes: text(body.notes, 500),
  };
  if (!input.id) errors.push("Choose a warranty record.");
  if (!input.status) errors.push("Choose a status.");
  return { input, errors };
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------
export function parseLocationInput(body = {}) {
  const errors = [];
  const input = {
    id: uuidOrNull(body.id),
    name: text(body.name, 80),
    department: text(body.department, 40).toLowerCase() || "workshop",
    description: text(body.description, 200),
    isActive: body.isActive !== false,
  };
  if (!input.name) errors.push("Name the location.");
  if (!input.id) {
    input.key = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    if (!input.key) errors.push("Name the location with letters or numbers.");
  }
  return { input, errors };
}
