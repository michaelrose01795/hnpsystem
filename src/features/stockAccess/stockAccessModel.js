// file location: src/features/stockAccess/stockAccessModel.js
//
// The Stock Access domain (/access, /access/manage), pure and shared. The API
// uses it to decide what an action means (planTransaction) before handing the
// deltas to the database function that applies them atomically
// (public.stock_access_apply); the pages use the same functions to render
// statuses, actions, filters and sorting. Nothing here touches the database,
// the network or React (stockAccessModel.test.js).
//
// Vocabulary
// ----------
//   current quantity    everything the business holds: on the shelf + with people
//   checked out         reusable units currently with someone (a checkout row)
//   available           current - checked out = what is on the shelf now
//   reusable            return_required items (tools): Take Out -> Return
//   consumable          everything else: Use reduces stock, no return expected
//   transaction         one append-only ledger row; history is never edited

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// ---------------------------------------------------------------------------
// Categories and units
// ---------------------------------------------------------------------------
// Defaults are what a new item in the category starts with in the editor;
// each item can override them.
export const STOCK_ACCESS_CATEGORIES = [
  { value: "tools", label: "Tools", returnRequired: true, unitType: "each", quantityStep: 1, loanPeriodHours: 24 },
  { value: "consumables", label: "Consumables", returnRequired: false, unitType: "each", quantityStep: 1, loanPeriodHours: null },
  { value: "oils", label: "Oils", returnRequired: false, unitType: "litre", quantityStep: 0.5, loanPeriodHours: null },
  { value: "parts", label: "Parts", returnRequired: false, unitType: "each", quantityStep: 1, loanPeriodHours: null },
  { value: "warranty", label: "Warranty", returnRequired: false, unitType: "each", quantityStep: 1, loanPeriodHours: null },
];

export const CATEGORY_BY_VALUE = Object.fromEntries(STOCK_ACCESS_CATEGORIES.map((entry) => [entry.value, entry]));

export const UNIT_TYPES = [
  { value: "each", label: "Each", short: "", singular: "", plural: "", decimals: 0 },
  { value: "pair", label: "Pairs", short: "", singular: "pair", plural: "pairs", decimals: 0 },
  { value: "box", label: "Boxes", short: "", singular: "box", plural: "boxes", decimals: 0 },
  { value: "pack", label: "Packs", short: "", singular: "pack", plural: "packs", decimals: 0 },
  { value: "roll", label: "Rolls", short: "", singular: "roll", plural: "rolls", decimals: 0 },
  { value: "litre", label: "Litres", short: "L", singular: "", plural: "", decimals: 2 },
  { value: "millilitre", label: "Millilitres", short: "ml", singular: "", plural: "", decimals: 0 },
  { value: "kilogram", label: "Kilograms", short: "kg", singular: "", plural: "", decimals: 2 },
  { value: "metre", label: "Metres", short: "m", singular: "", plural: "", decimals: 2 },
];

export const UNIT_BY_VALUE = Object.fromEntries(UNIT_TYPES.map((entry) => [entry.value, entry]));

// ---------------------------------------------------------------------------
// Actions, statuses and reasons
// ---------------------------------------------------------------------------
export const ACTION_META = {
  take_out: { label: "Take Out", past: "Taken out" },
  return: { label: "Return", past: "Returned" },
  consume: { label: "Use", past: "Used" },
  warranty_store: { label: "Warranty Store", past: "Stored for warranty" },
  warranty_status: { label: "Warranty update", past: "Warranty status changed" },
  restock_request: { label: "Restock Request", past: "Restock requested" },
  restock_update: { label: "Restock update", past: "Restock request updated" },
  receive: { label: "Receive", past: "Stock received" },
  adjustment: { label: "Adjustment", past: "Stock adjusted" },
  mark_missing: { label: "Mark missing", past: "Marked missing" },
  found: { label: "Found", past: "Marked found" },
  write_off: { label: "Write off", past: "Written off" },
  created: { label: "Created", past: "Item created" },
  edited: { label: "Edited", past: "Item edited" },
  activated: { label: "Activated", past: "Item reactivated" },
  deactivated: { label: "Deactivated", past: "Item deactivated" },
};

// Movements a staff member records from /access. Manager-only actions
// (receive, adjustment, custody changes) are separate.
export const QUICK_ACTIONS = ["take_out", "return", "consume", "warranty_store", "restock_request"];

export const RESTOCK_STATUSES = [
  { value: "requested", label: "Requested", tone: "warning", open: true },
  { value: "ordered", label: "Ordered", tone: "info", open: true },
  { value: "partially_received", label: "Partially received", tone: "info", open: true },
  { value: "received", label: "Received", tone: "success", open: false },
  { value: "cancelled", label: "Cancelled", tone: "neutral", open: false },
];
export const RESTOCK_STATUS_BY_VALUE = Object.fromEntries(RESTOCK_STATUSES.map((entry) => [entry.value, entry]));
export const OPEN_RESTOCK_STATUSES = RESTOCK_STATUSES.filter((entry) => entry.open).map((entry) => entry.value);

export const RESTOCK_REASONS = ["Running low", "Out of stock", "Damaged / unusable", "Needed for a job", "Other"];

export const WARRANTY_STATUSES = [
  { value: "stored", label: "Stored", tone: "info" },
  { value: "awaiting_return", label: "Awaiting return", tone: "warning" },
  { value: "returned", label: "Returned to supplier", tone: "success" },
  { value: "disposed", label: "Disposed", tone: "neutral" },
];
export const WARRANTY_STATUS_BY_VALUE = Object.fromEntries(WARRANTY_STATUSES.map((entry) => [entry.value, entry]));

export const ADJUSTMENT_REASONS = [
  "Stock count correction",
  "Damaged",
  "Found stock",
  "Lost / unaccounted for",
  "Opening balance",
  "Transferred between locations",
  "Other",
];

export const NEGATIVE_OVERRIDE_REASONS = ["Stock taken before delivery was booked in", "Count known to be wrong", "Other"];

export const CHECKOUT_STATUS_META = {
  out: { label: "Out", tone: "info" },
  returned: { label: "Returned", tone: "success" },
  missing: { label: "Missing", tone: "danger" },
  written_off: { label: "Written off", tone: "neutral" },
};

// What an item card / row shows.
export const ITEM_STATUS_META = {
  available: { label: "Available", tone: "success" },
  in_stock: { label: "In stock", tone: "success" },
  low: { label: "Low stock", tone: "warning" },
  out_of_stock: { label: "Out of stock", tone: "danger" },
  held: { label: "Checked out", tone: "info" },
  overdue: { label: "Overdue", tone: "danger" },
  missing: { label: "Missing", tone: "danger" },
  inactive: { label: "Inactive", tone: "neutral" },
};

// ---------------------------------------------------------------------------
// Numbers and formatting
// ---------------------------------------------------------------------------
export const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const roundQuantity = (value, places = 3) => {
  const factor = 10 ** places;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const unitFor = (item) => UNIT_BY_VALUE[item?.unitType] || UNIT_BY_VALUE.each;

/** "2.5 L", "3 pairs", "1 box", "12". */
export function formatQuantity(value, item) {
  const number = toNumber(value);
  if (number === null) return "—";
  const unit = unitFor(item);
  const text = number.toLocaleString("en-GB", { maximumFractionDigits: unit.decimals || 0 });
  if (unit.short) return `${text} ${unit.short}`;
  if (unit.plural) return `${text} ${Math.abs(number) === 1 ? unit.singular : unit.plural}`;
  return text;
}

export const unitLabel = (item) => {
  const unit = unitFor(item);
  return unit.short || unit.plural || "items";
};

export const allowsFractions = (item) => (unitFor(item).decimals || 0) > 0;

export function formatMoney(value) {
  const number = toNumber(value);
  if (number === null) return "—";
  return number.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function formatRelative(value, now = new Date()) {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = now.getTime() - date.getTime();
  if (diff < 60 * 1000) return "just now";
  if (diff < MS_PER_HOUR) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < MS_PER_DAY) return `${Math.floor(diff / MS_PER_HOUR)} h ago`;
  const days = Math.floor(diff / MS_PER_DAY);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ---------------------------------------------------------------------------
// Stock state
// ---------------------------------------------------------------------------
export const availableQuantity = (item) =>
  roundQuantity((toNumber(item?.currentQuantity) || 0) - (toNumber(item?.checkedOutQuantity) || 0));

/** "out" when nothing is on the shelf, "low" at or below the minimum, else "ok". */
export function stockLevel(item) {
  const available = availableQuantity(item);
  if (available <= 0) return "out";
  const min = toNumber(item?.minQuantity);
  if (min !== null && available <= min) return "low";
  return "ok";
}

export const isLowStock = (item) => stockLevel(item) !== "ok";

export const isOpenCheckout = (checkout) => checkout?.status === "out" || checkout?.status === "missing";

export function isCheckoutOverdue(checkout, now = new Date()) {
  if (checkout?.status !== "out" || !checkout.dueAt) return false;
  return new Date(checkout.dueAt).getTime() < now.getTime();
}

export const outstandingOnCheckout = (checkout) =>
  roundQuantity((toNumber(checkout?.quantity) || 0) - (toNumber(checkout?.quantityReturned) || 0));

export const holderLabel = (name) => String(name || "Someone").trim().toUpperCase();

/**
 * The single status an item shows, plus the facts behind it.
 * Reusable: Missing > Overdue > [NAME] HAS THIS ITEM once nothing is on the
 * shelf, otherwise Available / Low stock. Consumable: Out / Low / In stock.
 */
export function deriveItemStatus(item, openCheckouts = [], now = new Date()) {
  const checkouts = openCheckouts.filter(isOpenCheckout);
  const holders = Array.from(new Set(checkouts.filter((c) => c.status === "out").map((c) => c.holderName).filter(Boolean)));
  const overdueCount = checkouts.filter((c) => isCheckoutOverdue(c, now)).length;
  const missingCount = checkouts.filter((c) => c.status === "missing").length;
  const facts = { holders, overdueCount, missingCount, available: availableQuantity(item) };

  if (item?.isActive === false) return { key: "inactive", ...ITEM_STATUS_META.inactive, ...facts };

  const level = stockLevel(item);
  if (item?.returnRequired) {
    if (level === "out") {
      if (missingCount && !holders.length) return { key: "missing", ...ITEM_STATUS_META.missing, ...facts };
      if (overdueCount) return { key: "overdue", ...ITEM_STATUS_META.overdue, ...facts };
      if (holders.length === 1) return { key: "held", label: `${holderLabel(holders[0])} HAS THIS ITEM`, tone: "info", ...facts };
      if (holders.length > 1) return { key: "held", label: `All out · ${holders.length} people`, tone: "info", ...facts };
      if (missingCount) return { key: "missing", ...ITEM_STATUS_META.missing, ...facts };
      return { key: "out_of_stock", ...ITEM_STATUS_META.out_of_stock, ...facts };
    }
    if (level === "low") return { key: "low", ...ITEM_STATUS_META.low, ...facts };
    return { key: "available", ...ITEM_STATUS_META.available, ...facts };
  }
  if (level === "out") return { key: "out_of_stock", ...ITEM_STATUS_META.out_of_stock, ...facts };
  if (level === "low") return { key: "low", ...ITEM_STATUS_META.low, ...facts };
  return { key: "in_stock", ...ITEM_STATUS_META.in_stock, ...facts };
}

/** When a reusable item taken now is due back (null = no loan period). */
export function dueAtFor(item, now = new Date()) {
  const hours = toNumber(item?.loanPeriodHours);
  return hours ? new Date(now.getTime() + hours * MS_PER_HOUR).toISOString() : null;
}

/** Suggested quantity for a restock request. */
export function suggestRestockQuantity(item) {
  const reorder = toNumber(item?.reorderQuantity);
  if (reorder && reorder > 0) return reorder;
  const min = toNumber(item?.minQuantity);
  const available = availableQuantity(item);
  if (min !== null && min > 0) return Math.max(roundQuantity(min * 2 - available), toNumber(item?.quantityStep) || 1);
  return toNumber(item?.quantityStep) || 1;
}

/** One-tap quantity chips for the action sheet. */
export function quickQuantities(item) {
  const step = toNumber(item?.quantityStep) || 1;
  if (allowsFractions(item)) return [step, step * 2, step * 4, step * 10].map((value) => roundQuantity(value));
  return [1, 2, 5, 10].map((value) => Math.max(1, Math.round(value * step)));
}

// ---------------------------------------------------------------------------
// What a staff member can do with an item from /access
// ---------------------------------------------------------------------------
/**
 * The buttons on the action sheet, primary first.
 * @returns {{action: string, label: string, primary?: boolean, disabled?: boolean, hint?: string}[]}
 */
export function availableActions(item, { capabilities = {}, openCheckouts = [], userId = null } = {}) {
  if (!item || item.isActive === false || !capabilities.transact) {
    return capabilities.requestRestock && item?.isActive !== false
      ? [{ action: "restock_request", label: ACTION_META.restock_request.label }]
      : [];
  }
  const actions = [];
  const open = openCheckouts.filter((c) => c.status === "out" || c.status === "missing");
  const mine = open.filter((c) => userId !== null && c.holderUserId === userId);
  const available = availableQuantity(item);

  if (item.returnRequired) {
    if (mine.length) actions.push({ action: "return", label: ACTION_META.return.label, primary: true });
    actions.push({
      action: "take_out",
      label: ACTION_META.take_out.label,
      primary: !mine.length,
      hint: available <= 0 ? "Recorded as all out" : undefined,
    });
    if (!mine.length && open.length) actions.push({ action: "return", label: "Return for someone" });
  } else {
    actions.push({ action: "consume", label: ACTION_META.consume.label, primary: true, hint: available <= 0 ? "Recorded as out of stock" : undefined });
    actions.push({ action: "return", label: "Return unused" });
  }
  if (capabilities.storeWarranty && (item.category === "parts" || item.category === "warranty")) {
    actions.push({ action: "warranty_store", label: ACTION_META.warranty_store.label });
  }
  if (capabilities.requestRestock) actions.push({ action: "restock_request", label: ACTION_META.restock_request.label });
  return actions;
}

// ---------------------------------------------------------------------------
// planTransaction — what a quantity action does to the numbers
// ---------------------------------------------------------------------------
/**
 * Turn an action request into the deltas stock_access_apply() applies, or
 * errors. Pure: the API calls it, and the action sheet calls it for an instant
 * preview so staff see the result before they tap.
 *
 * @param {object} args
 * @param {string} args.action        take_out | return | consume | receive | adjustment | mark_missing | found | write_off
 * @param {object} args.item          Mapped item.
 * @param {number} [args.quantity]    Amount (adjustment: see mode).
 * @param {string} [args.mode]        Adjustment: "delta" (signed quantity) or "set" (absolute).
 * @param {object} [args.checkout]    The checkout a return / custody action applies to.
 * @param {boolean} [args.allowNegative]  Authorised override.
 * @param {string} [args.reason]
 * @returns {{errors: string[], warnings: string[], action: string, quantityDelta: number,
 *   checkedOutDelta: number, entry: object, checkoutOp: object|null, preview: object, negative: boolean}}
 */
export function planTransaction({ action, item, quantity, mode = "delta", checkout = null, allowNegative = false, reason = "", now = new Date(), holder = null }) {
  const errors = [];
  const warnings = [];
  let resolvedAction = action;
  let quantityDelta = 0;
  let checkedOutDelta = 0;
  let checkoutOp = null;
  const entry = { quantity: 0, quantity_out: 0, quantity_returned: 0, quantity_consumed: 0 };
  const amount = toNumber(quantity);
  const needsAmount = ["take_out", "return", "consume", "receive"].includes(action);

  if (!item) return { errors: ["Item not found."], warnings, action, quantityDelta, checkedOutDelta, entry, checkoutOp, preview: null, negative: false };

  if (needsAmount) {
    if (amount === null || amount <= 0) errors.push("Enter a quantity greater than zero.");
    else if (!allowsFractions(item) && !Number.isInteger(amount)) errors.push(`${item.name} is counted in whole ${unitLabel(item)}.`);
  }

  switch (action) {
    case "take_out":
      if (!item.returnRequired) {
        // A consumable taken out is a consumable used.
        resolvedAction = "consume";
        quantityDelta = -(amount || 0);
        entry.quantity_consumed = amount || 0;
      } else {
        checkedOutDelta = amount || 0;
        entry.quantity_out = amount || 0;
        checkoutOp = {
          op: "open",
          holder_user_id: holder?.userId ?? null,
          holder_name: holder?.name || "Unknown",
          quantity: amount || 0,
          due_at: dueAtFor(item, now),
        };
      }
      break;
    case "consume":
      if (item.returnRequired) errors.push("Reusable items are returned, not used up. Ask Parts or a manager to write it off if it is broken or gone.");
      quantityDelta = -(amount || 0);
      entry.quantity_consumed = amount || 0;
      break;
    case "return":
      if (checkout) {
        const outstanding = outstandingOnCheckout(checkout);
        if (!isOpenCheckout(checkout)) errors.push("That checkout is already closed.");
        else if (amount !== null && amount > outstanding) errors.push(`Only ${formatQuantity(outstanding, item)} is still out on that record.`);
        checkedOutDelta = -(amount || 0);
        checkoutOp = { op: "return", checkout_id: checkout.id, quantity: amount || 0 };
      } else if (item.returnRequired) {
        errors.push("Choose whose item you are returning.");
      } else {
        quantityDelta = amount || 0;
      }
      entry.quantity_returned = amount || 0;
      break;
    case "receive":
      quantityDelta = amount || 0;
      break;
    case "adjustment": {
      const current = toNumber(item.currentQuantity) || 0;
      if (amount === null) errors.push("Enter the adjustment.");
      else if (mode === "set") {
        if (amount < 0) errors.push("A stock level cannot be set below zero.");
        quantityDelta = roundQuantity(amount - current);
      } else {
        if (amount === 0) errors.push("An adjustment must change the stock.");
        quantityDelta = amount;
      }
      if (!String(reason || "").trim()) errors.push("Every adjustment needs a reason.");
      break;
    }
    case "mark_missing":
    case "found":
    case "write_off": {
      if (!checkout) {
        errors.push("Choose the checkout record.");
        break;
      }
      const opFor = { mark_missing: "missing", found: "found", write_off: "write_off" }[action];
      checkoutOp = { op: opFor, checkout_id: checkout.id };
      if (action === "mark_missing" && checkout.status !== "out") errors.push("Only an item that is out can be marked missing.");
      if (action === "found" && checkout.status !== "missing") errors.push("Only a missing item can be marked found.");
      if (action === "write_off") {
        if (!isOpenCheckout(checkout)) errors.push("That checkout is already closed.");
        if (!String(reason || "").trim()) errors.push("Writing off an item needs a reason.");
        const outstanding = outstandingOnCheckout(checkout);
        // It leaves the business: off the checked-out count and off the total.
        quantityDelta = -outstanding;
        checkedOutDelta = -outstanding;
        entry.quantity_consumed = outstanding;
      }
      break;
    }
    default:
      errors.push("Unknown stock action.");
  }

  entry.quantity = Math.abs(resolvedAction === "adjustment" ? quantityDelta : amount ?? Math.abs(quantityDelta));
  const currentAfter = roundQuantity((toNumber(item.currentQuantity) || 0) + quantityDelta);
  const checkedOutAfter = roundQuantity((toNumber(item.checkedOutQuantity) || 0) + checkedOutDelta);
  const availableAfter = roundQuantity(currentAfter - checkedOutAfter);
  const negative = availableAfter < 0 || currentAfter < 0;

  if (negative && !errors.length) {
    const available = availableQuantity(item);
    const message = available > 0
      ? `Only ${formatQuantity(available, item)} ${item.returnRequired ? "is on the shelf" : "is recorded in stock"}.`
      : `${item.name} is recorded as ${item.returnRequired ? "all checked out" : "out of stock"}.`;
    if (allowNegative) warnings.push(`${message} Recording anyway with an authorised override.`);
    else errors.push(message);
  }
  if (checkedOutAfter < 0 && !errors.length) errors.push("More would be returned than is checked out.");

  const min = toNumber(item.minQuantity);
  if (!negative && availableAfter > 0 && min !== null && availableAfter <= min && availableQuantity(item) > min) {
    warnings.push("This takes the item into low stock.");
  }

  return {
    errors,
    warnings,
    action: resolvedAction,
    quantityDelta: roundQuantity(quantityDelta),
    checkedOutDelta: roundQuantity(checkedOutDelta),
    entry,
    checkoutOp,
    negative,
    preview: { currentAfter, checkedOutAfter, availableAfter },
  };
}

// ---------------------------------------------------------------------------
// Search, filter and sort (manage table + quick screen)
// ---------------------------------------------------------------------------
const norm = (value) => String(value || "").trim().toLowerCase();

/** Exact barcode / SKU match for a scan or a typed code. */
export function matchScan(items = [], code) {
  const needle = norm(code);
  if (!needle) return null;
  return items.find((item) => norm(item.barcode) === needle || norm(item.sku) === needle) || null;
}

export function matchesSearch(item, term) {
  const needle = norm(term);
  if (!needle) return true;
  const haystack = [item.name, item.sku, item.barcode, item.description, item.subcategory, item.bin, item.supplierName, item.supplierPartNumber, item.locationName]
    .map(norm)
    .join(" ");
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}

export const MANAGE_FILTERS = [
  { value: "all", label: "All active items" },
  { value: "low", label: "Low or out of stock" },
  { value: "checked_out", label: "Checked out" },
  { value: "overdue", label: "Overdue" },
  { value: "missing", label: "Missing" },
  { value: "restock", label: "Open restock request" },
  { value: "inactive", label: "Inactive" },
];

/** @param row  {item, status, openCheckouts, openRestock} */
export function matchesManageFilter(row, filter) {
  switch (filter) {
    case "low":
      return row.item.isActive && isLowStock(row.item);
    case "checked_out":
      return row.item.isActive && (toNumber(row.item.checkedOutQuantity) || 0) > 0;
    case "overdue":
      return row.status.overdueCount > 0;
    case "missing":
      return row.status.missingCount > 0;
    case "restock":
      return Boolean(row.openRestock);
    case "inactive":
      return !row.item.isActive;
    default:
      return row.item.isActive;
  }
}

export const MANAGE_SORTS = [
  { value: "name", label: "Name A–Z" },
  { value: "available", label: "Least available" },
  { value: "low_first", label: "Low stock first" },
  { value: "last_movement", label: "Latest movement" },
  { value: "category", label: "Category" },
];

const STATUS_URGENCY = { missing: 0, overdue: 1, out_of_stock: 2, low: 3, held: 4, available: 5, in_stock: 5, inactive: 6 };

export function compareRows(sort) {
  const byName = (a, b) => a.item.name.localeCompare(b.item.name, "en-GB");
  switch (sort) {
    case "available":
      return (a, b) => availableQuantity(a.item) - availableQuantity(b.item) || byName(a, b);
    case "low_first":
      return (a, b) => (STATUS_URGENCY[a.status.key] ?? 9) - (STATUS_URGENCY[b.status.key] ?? 9) || byName(a, b);
    case "last_movement":
      return (a, b) => (b.item.lastMovementAt || "").localeCompare(a.item.lastMovementAt || "") || byName(a, b);
    case "category":
      return (a, b) => a.item.category.localeCompare(b.item.category) || byName(a, b);
    default:
      return byName;
  }
}

/** Items ranked by how often they were moved — the "common items" row. */
export function rankByUse(transactions = [], limit = 8) {
  const counts = new Map();
  transactions.forEach((tx) => {
    if (!tx.itemId || !["take_out", "consume", "return"].includes(tx.action)) return;
    counts.set(tx.itemId, (counts.get(tx.itemId) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([itemId]) => itemId);
}

/** A user's most recent distinct items, newest first. */
export function recentItemIds(transactions = [], limit = 8) {
  const seen = [];
  transactions.forEach((tx) => {
    if (tx.itemId && !seen.includes(tx.itemId) && seen.length < limit) seen.push(tx.itemId);
  });
  return seen;
}

/** Plain-English line for a ledger row in a timeline. */
export function describeTransaction(tx, item) {
  const meta = ACTION_META[tx.action] || { past: tx.action };
  const subject = item || { unitType: "each" };
  const amount = toNumber(tx.quantity);
  const parts = [meta.past];
  if (amount) parts.push(formatQuantity(amount, subject));
  if (tx.action === "adjustment" && tx.quantityDelta) parts[1] = `${tx.quantityDelta > 0 ? "+" : "−"}${formatQuantity(Math.abs(tx.quantityDelta), subject)}`;
  return parts.join(" · ");
}
