// file location: src/features/stockControl/stockModel.js
//
// The stock-control domain for /tracking -> Oil/Stock, pure and shared. The API
// routes use it to decide what a change means (status transitions, significant
// adjustments, usage trends); the panel uses the same functions to render
// statuses, actions, filters and sorting. Nothing here touches the database,
// the network or React, so the rules exist once and are unit tested
// (stockModel.test.js).
//
// Vocabulary
// ----------
//   item        one product at one location (tracking_oil_stock row)
//   level state how much is physically there: normal / low / critical / out
//   order state where an open order is: order required -> ordered ->
//               awaiting delivery -> partially received -> received
//   status      what the item card shows: the order state while stock is on
//               its way, otherwise the level state; archived beats both
//   movement    one ledger row: a physical check, stock in / out, adjustment,
//               receipt, stocktake count or lifecycle event

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Units and measurement
// ---------------------------------------------------------------------------
export const STOCK_UNITS = [
  { value: "litres", label: "Litres", short: "L", decimals: 1 },
  { value: "millilitres", label: "Millilitres", short: "ml", decimals: 0 },
  { value: "units", label: "Units", short: "units", decimals: 0 },
  { value: "boxes", label: "Boxes", short: "boxes", decimals: 0 },
  { value: "packs", label: "Packs", short: "packs", decimals: 0 },
  { value: "rolls", label: "Rolls", short: "rolls", decimals: 0 },
  { value: "kilograms", label: "Kilograms", short: "kg", decimals: 1 },
  { value: "percent", label: "Percentage", short: "%", decimals: 0 },
  { value: "custom", label: "Custom unit", short: "", decimals: 1 },
];

export const MEASUREMENT_MODES = [
  { value: "count", label: "Counted stock", description: "Record an exact quantity on every check." },
  { value: "level", label: "Tank level", description: "Record Full, 3/4, 1/2, 1/4 or Low; the quantity is estimated from capacity." },
  { value: "tank", label: "Bulk tank (dipstick)", description: "Record a dipstick reading; this tank's calibration converts it to a quantity." },
];

export const LEVEL_BANDS = [
  { value: "full", label: "Full", fraction: 1 },
  { value: "three_quarters", label: "Three Quarters", fraction: 0.75 },
  { value: "half", label: "Half", fraction: 0.5 },
  { value: "quarter", label: "Quarter", fraction: 0.25 },
  { value: "low", label: "Low", fraction: 0.1 },
  { value: "empty", label: "Empty", fraction: 0 },
];

export const DIPSTICK_UNITS = [
  { value: "cm", label: "Centimetres" },
  { value: "mm", label: "Millimetres" },
  { value: "in", label: "Inches" },
  { value: "percent", label: "Percent of gauge" },
];

export const CHECK_INTERVAL_OPTIONS = [
  { value: 1, label: "Daily" },
  { value: 7, label: "Weekly" },
  { value: 14, label: "Fortnightly" },
  { value: 30, label: "Monthly" },
  { value: 60, label: "Every 2 months" },
  { value: 90, label: "Quarterly" },
  { value: 182, label: "Every 6 months" },
  { value: 365, label: "Yearly" },
];

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------
// `priority` drives the Action required sort: lower is more urgent.
export const STOCK_STATUS_META = {
  out_of_stock: { label: "Out of Stock", tone: "danger", priority: 0 },
  critical: { label: "Critical", tone: "danger", priority: 1 },
  low: { label: "Low", tone: "warning", priority: 2 },
  order_required: { label: "Order Required", tone: "warning", priority: 3 },
  partially_received: { label: "Partially Received", tone: "accent", priority: 4 },
  awaiting_delivery: { label: "Awaiting Delivery", tone: "accent", priority: 5 },
  ordered: { label: "Ordered", tone: "accent", priority: 6 },
  unmeasured: { label: "Not Measured", tone: "neutral", priority: 7 },
  normal: { label: "Normal", tone: "success", priority: 8 },
  archived: { label: "Archived", tone: "neutral", priority: 9 },
};

export const ORDER_STATUSES = [
  { value: "order_required", label: "Order Required" },
  { value: "ordered", label: "Ordered" },
  { value: "awaiting_delivery", label: "Awaiting Delivery" },
  { value: "partially_received", label: "Partially Received" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

export const OPEN_ORDER_STATUSES = ["order_required", "ordered", "awaiting_delivery", "partially_received"];
// Statuses where stock is physically on its way (counts as incoming).
export const INCOMING_ORDER_STATUSES = ["ordered", "awaiting_delivery", "partially_received"];

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
  { value: "critical", label: "Critical" },
  { value: "out_of_stock", label: "Out of Stock" },
  { value: "order_required", label: "Order Required" },
  { value: "ordered", label: "Ordered" },
  { value: "awaiting_delivery", label: "Awaiting Delivery" },
  { value: "partially_received", label: "Partially Received" },
  { value: "check_due", label: "Check overdue" },
  { value: "archived", label: "Archived" },
];

// ---------------------------------------------------------------------------
// Movements
// ---------------------------------------------------------------------------
export const MOVEMENT_META = {
  check: { label: "Stock check", tone: "neutral" },
  stock_in: { label: "Stock in", tone: "success" },
  stock_out: { label: "Stock out", tone: "warning" },
  adjustment: { label: "Adjustment", tone: "warning" },
  receipt: { label: "Delivery received", tone: "success" },
  stocktake: { label: "Stocktake count", tone: "neutral" },
  order_raised: { label: "Order raised", tone: "accent" },
  order_updated: { label: "Order updated", tone: "accent" },
  order_cancelled: { label: "Order cancelled", tone: "neutral" },
  created: { label: "Item created", tone: "neutral" },
  edited: { label: "Item edited", tone: "neutral" },
  archived: { label: "Archived", tone: "neutral" },
  restored: { label: "Restored", tone: "neutral" },
};

export const HISTORY_FILTERS = [
  { value: "all", label: "Everything" },
  { value: "checks", label: "Checks", types: ["check", "stocktake"] },
  { value: "receipts", label: "Receipts", types: ["receipt", "stock_in"] },
  { value: "usage", label: "Usage", types: ["stock_out"] },
  { value: "adjustments", label: "Adjustments", types: ["adjustment"] },
  { value: "orders", label: "Orders", types: ["order_raised", "order_updated", "order_cancelled", "receipt"] },
];

export const STOCK_OUT_REASONS = [
  "Used on job",
  "Workshop use",
  "Valeting use",
  "Transferred to another location",
  "Other",
];

export const STOCK_IN_REASONS = [
  "Delivery without an order",
  "Returned from job",
  "Transferred in",
  "Other",
];

export const ADJUSTMENT_REASONS = [
  "Miscount correction",
  "Damaged / leaked",
  "Spillage",
  "Expired / disposed",
  "Found stock",
  "Returned to supplier",
  "Other",
];

// Movement types that change the physical quantity.
export const QUANTITY_MOVEMENT_TYPES = ["check", "stock_in", "stock_out", "adjustment", "receipt", "stocktake"];

// ---------------------------------------------------------------------------
// Sorting, filtering and summary
// ---------------------------------------------------------------------------
export const SORT_OPTIONS = [
  { value: "action", label: "Action required" },
  { value: "lowest", label: "Lowest stock" },
  { value: "oldest-check", label: "Oldest check" },
  { value: "recent-check", label: "Recently checked" },
  { value: "name", label: "Name" },
  { value: "category", label: "Category" },
  { value: "usage", label: "Highest usage" },
  { value: "value", label: "Stock value" },
];

// The summary tiles double as one-tap filters. `match` receives the resolved
// row ({ item, status, checkDue }).
export const SUMMARY_FILTERS = [
  {
    key: "action",
    label: "Action Required",
    match: (row) =>
      !row.archived &&
      (["out_of_stock", "critical", "low", "order_required"].includes(row.status.key) || row.checkDue),
  },
  { key: "critical", label: "Critical", match: (row) => !row.archived && row.status.levelState === "critical" },
  { key: "out", label: "Out of Stock", match: (row) => !row.archived && row.status.levelState === "out_of_stock" },
  { key: "low", label: "Low Stock", match: (row) => !row.archived && row.status.levelState === "low" },
  {
    key: "incoming",
    label: "Awaiting Delivery",
    match: (row) => !row.archived && INCOMING_ORDER_STATUSES.includes(row.status.orderState),
  },
  { key: "check-due", label: "Checks Due", match: (row) => !row.archived && row.checkDue },
  { key: "checked-today", label: "Checked Today", match: (row) => !row.archived && isSameLocalDay(row.item.lastCheck, row.now) },
  { key: "total", label: "Total Items", match: (row) => !row.archived },
];

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------
export const toNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

export const roundQuantity = (value, decimals = 2) => {
  const number = toNumber(value);
  if (number === null) return null;
  const factor = 10 ** decimals;
  return Math.round(number * factor) / factor;
};

const toTime = (value) => {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

export function isSameLocalDay(left, right = new Date()) {
  const a = toTime(left);
  const b = toTime(right);
  if (a === null || b === null) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export const getUnitMeta = (unit) => STOCK_UNITS.find((entry) => entry.value === unit) || STOCK_UNITS[2];

/** Short unit label for an item, honouring a custom unit name. */
export function unitShortLabel(item = {}) {
  if (item.unit === "custom") return String(item.customUnitLabel || "").trim() || "units";
  return getUnitMeta(item.unit).short;
}

/** "12.5 L", "3 boxes", "40 %", or "—" when unknown. */
export function formatQuantity(value, item = {}) {
  const number = toNumber(value);
  if (number === null) return "—";
  const meta = getUnitMeta(item.unit);
  const decimals = Number.isInteger(number) ? 0 : meta.decimals;
  const formatted = number.toLocaleString("en-GB", { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
  const unit = unitShortLabel(item);
  return unit ? `${formatted} ${unit}` : formatted;
}

const GBP = typeof Intl !== "undefined" ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }) : null;
export const formatMoney = (value) => {
  const number = toNumber(value);
  if (number === null) return "—";
  return GBP ? GBP.format(number) : `£${number.toFixed(2)}`;
};

export const formatDate = (value) => {
  const time = toTime(value);
  if (time === null) return "—";
  return new Date(time).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatDateTime = (value) => {
  const time = toTime(value);
  if (time === null) return "—";
  return new Date(time).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const intervalLabel = (days) => {
  const number = toNumber(days);
  if (!number) return "—";
  const match = CHECK_INTERVAL_OPTIONS.find((option) => option.value === number);
  if (match) return match.label;
  return `Every ${number} day${number === 1 ? "" : "s"}`;
};

// ---------------------------------------------------------------------------
// Level bands and dipstick calibration
// ---------------------------------------------------------------------------
export const getBandMeta = (band) => LEVEL_BANDS.find((entry) => entry.value === band) || null;

/** The nearest band for a fill fraction (0..1). */
export function bandFromFraction(fraction) {
  const value = toNumber(fraction);
  if (value === null) return null;
  if (value <= 0) return "empty";
  if (value >= 0.875) return "full";
  if (value >= 0.625) return "three_quarters";
  if (value >= 0.375) return "half";
  if (value >= 0.175) return "quarter";
  return "low";
}

/** Estimated quantity for a band, or null without a capacity to scale by. */
export function quantityFromBand(band, capacity) {
  const meta = getBandMeta(band);
  const max = toNumber(capacity);
  if (!meta || max === null || max <= 0) return null;
  return roundQuantity(max * meta.fraction);
}

/**
 * Clean a calibration table: numeric points only, one volume per reading,
 * sorted by reading. Volumes must not fall as the reading rises; a point that
 * would make the curve go backwards is dropped (it is almost always a typo).
 */
export function normaliseCalibration(points) {
  if (!Array.isArray(points)) return [];
  const byReading = new Map();
  points.forEach((point) => {
    const reading = toNumber(point?.reading);
    const volume = toNumber(point?.volume);
    if (reading === null || volume === null || reading < 0 || volume < 0) return;
    byReading.set(reading, volume);
  });
  const sorted = Array.from(byReading.entries())
    .map(([reading, volume]) => ({ reading, volume }))
    .sort((a, b) => a.reading - b.reading);
  const monotonic = [];
  sorted.forEach((point) => {
    const previous = monotonic[monotonic.length - 1];
    if (previous && point.volume < previous.volume) return;
    monotonic.push(point);
  });
  return monotonic;
}

/**
 * Convert a dipstick reading to an estimated quantity.
 *
 * With two or more calibration points the reading is interpolated linearly
 * between the surrounding points and clamped to the table's ends (never
 * extrapolated — a reading past the table is reported as clamped). Without a
 * table, a percentage gauge scales the capacity. Anything else cannot be
 * converted and returns a null volume.
 *
 * @returns {{ volume: number|null, method: "calibration"|"percent"|null, clamped: boolean }}
 */
export function volumeFromDipstick(reading, { calibration = [], capacity = null, dipstickUnit = null } = {}) {
  const value = toNumber(reading);
  if (value === null || value < 0) return { volume: null, method: null, clamped: false };
  const table = normaliseCalibration(calibration);
  if (table.length >= 2) {
    const first = table[0];
    const last = table[table.length - 1];
    if (value <= first.reading) return { volume: roundQuantity(first.volume), method: "calibration", clamped: value < first.reading };
    if (value >= last.reading) return { volume: roundQuantity(last.volume), method: "calibration", clamped: value > last.reading };
    for (let index = 1; index < table.length; index += 1) {
      const upper = table[index];
      if (value <= upper.reading) {
        const lower = table[index - 1];
        const span = upper.reading - lower.reading;
        const ratio = span === 0 ? 0 : (value - lower.reading) / span;
        return { volume: roundQuantity(lower.volume + ratio * (upper.volume - lower.volume)), method: "calibration", clamped: false };
      }
    }
  }
  const max = toNumber(capacity);
  if (dipstickUnit === "percent" && max !== null && max > 0) {
    const clampedValue = Math.min(100, value);
    return { volume: roundQuantity((max * clampedValue) / 100), method: "percent", clamped: value > 100 };
  }
  return { volume: null, method: null, clamped: false };
}

/**
 * What a physical check (or stocktake count) says is there, by the item's
 * measurement mode: a dipstick reading through the tank's calibration, an
 * exact quantity, or a level band scaled by capacity.
 *
 * @param {{ quantity: number|null, levelBand: string|null, dipstickReading: number|null }} input
 * @returns {{ quantity, levelBand, dipstickReading, detail } | { error: string }}
 */
export function resolveCheckReading(item, input) {
  const capacity = toNumber(item.maxCapacity);
  if (item.measurementMode === "tank" && input.dipstickReading !== null) {
    const { volume, method, clamped } = volumeFromDipstick(input.dipstickReading, {
      calibration: item.calibration,
      capacity,
      dipstickUnit: item.dipstickUnit,
    });
    if (volume !== null) {
      return {
        quantity: volume,
        levelBand: capacity ? bandFromFraction(volume / capacity) : input.levelBand,
        dipstickReading: input.dipstickReading,
        detail: { conversion: method, clamped },
      };
    }
    if (!input.levelBand && input.quantity === null) {
      return { error: "This tank has no calibration yet. Add calibration points, or record a level or quantity instead." };
    }
  }
  if (input.quantity !== null) {
    return { quantity: input.quantity, levelBand: input.levelBand || undefined, dipstickReading: input.dipstickReading };
  }
  if (input.levelBand) {
    // Without a capacity the band is recorded but the quantity stays unknown.
    return { quantity: quantityFromBand(input.levelBand, capacity), levelBand: input.levelBand, dipstickReading: input.dipstickReading, detail: { estimatedFromBand: Boolean(capacity) } };
  }
  return { error: "Record a quantity, a level or a dipstick reading." };
}

/** The fill fraction (0..1) of an item, when it has a capacity. */
export function fillFraction(item = {}) {
  const quantity = toNumber(item.currentQuantity);
  const capacity = toNumber(item.maxCapacity) || toNumber(item.targetLevel);
  if (quantity !== null && capacity) return Math.max(0, Math.min(1, quantity / capacity));
  const band = getBandMeta(item.levelBand);
  return band ? band.fraction : null;
}

// ---------------------------------------------------------------------------
// Thresholds and status
// ---------------------------------------------------------------------------
/**
 * The effective thresholds. Critical defaults to half the minimum when only a
 * minimum is set, so an item configured with a single number still has all
 * three levels.
 */
export function getThresholds(item = {}) {
  const min = toNumber(item.minLevel);
  let critical = toNumber(item.criticalLevel);
  if (critical === null && min !== null) critical = roundQuantity(min / 2);
  if (critical !== null && min !== null && critical > min) critical = min;
  return {
    min,
    critical,
    target: toNumber(item.targetLevel),
    max: toNumber(item.maxCapacity),
  };
}

/** normal / low / critical / out_of_stock / unmeasured, from quantity (or band). */
export function resolveLevelState(item = {}) {
  const quantity = toNumber(item.currentQuantity);
  const { min, critical } = getThresholds(item);
  if (quantity !== null) {
    if (quantity <= 0) return "out_of_stock";
    if (critical !== null && quantity <= critical) return "critical";
    if (min !== null && quantity <= min) return "low";
    // A tank read as Low with no numeric thresholds is still low.
    if (min === null && item.levelBand === "low") return "low";
    return "normal";
  }
  if (item.levelBand === "empty") return "out_of_stock";
  if (item.levelBand === "low") return "low";
  if (item.levelBand) return "normal";
  return "unmeasured";
}

/** The open order for an item (newest first), or null. */
export function findOpenOrder(orders = [], itemId) {
  const open = orders
    .filter((order) => order.itemId === itemId && OPEN_ORDER_STATUSES.includes(order.status))
    .sort((a, b) => (toTime(b.createdAt) || 0) - (toTime(a.createdAt) || 0));
  return open[0] || null;
}

/** Quantity still to arrive on an order. */
export function outstandingQuantity(order) {
  if (!order || !INCOMING_ORDER_STATUSES.includes(order.status)) return 0;
  return Math.max(0, roundQuantity((toNumber(order.quantityOrdered) || 0) - (toNumber(order.quantityReceived) || 0)) || 0);
}

/**
 * The status a card shows.
 * @returns {{ key, label, tone, priority, levelState, orderState }}
 */
export function resolveStockStatus(item = {}, openOrder = null) {
  const levelState = resolveLevelState(item);
  const orderState = openOrder ? openOrder.status : null;
  let key = levelState;
  if (item.archivedAt) key = "archived";
  else if (orderState && INCOMING_ORDER_STATUSES.includes(orderState)) key = orderState;
  else if (orderState === "order_required" && levelState !== "out_of_stock" && levelState !== "critical") key = "order_required";
  const meta = STOCK_STATUS_META[key] || STOCK_STATUS_META.normal;
  return { key, label: meta.label, tone: meta.tone, priority: meta.priority, levelState, orderState };
}

export function isCheckOverdue(item = {}, now = new Date()) {
  if (item.archivedAt) return false;
  const next = toTime(item.nextCheck);
  if (next === null) return !item.lastCheck;
  return next <= toTime(now);
}

/** True when a level change should raise a stock alert (worsened into a bad state). */
export function isAlertWorthy(previousState, nextState) {
  const rank = { normal: 0, unmeasured: 0, low: 1, critical: 2, out_of_stock: 3 };
  if (!(nextState in rank) || rank[nextState] === 0) return false;
  return (rank[nextState] || 0) > (rank[previousState] || 0);
}

/**
 * An adjustment or stocktake variance big enough for management to hear
 * about: at least 20% of the item's reference level (target, then capacity,
 * then minimum x 2, then the quantity before), and never less than one unit.
 */
export function isSignificantAdjustment(item = {}, delta, quantityBefore = null) {
  const change = Math.abs(toNumber(delta) || 0);
  if (change < 1) return false;
  const { target, max, min } = getThresholds(item);
  const reference = target || max || (min ? min * 2 : null) || toNumber(quantityBefore) || null;
  if (!reference) return change >= 10;
  return change >= reference * 0.2;
}

// ---------------------------------------------------------------------------
// Replenishment
// ---------------------------------------------------------------------------
/**
 * Suggested order quantity: fill to target (or capacity) less what is on hand
 * and already on its way, rounded UP to whole reorder packs when a reorder
 * quantity is set. Without a target it falls back to one reorder quantity.
 * Staff can always change the number; this is only the starting point.
 *
 * @returns {{ quantity: number, basis: string }}
 */
export function suggestReplenishment(item = {}, { incoming = 0 } = {}) {
  const quantity = toNumber(item.currentQuantity) || 0;
  const { target, max } = getThresholds(item);
  const pack = toNumber(item.reorderQuantity);
  const fillTo = target !== null ? target : max;
  const onWay = toNumber(incoming) || 0;
  if (fillTo !== null && fillTo > 0) {
    const shortfall = Math.max(0, fillTo - quantity - onWay);
    if (shortfall <= 0) return { quantity: 0, basis: `Already at ${target !== null ? "target" : "capacity"} including stock on order` };
    if (pack && pack > 0) {
      const packs = Math.ceil(shortfall / pack);
      return { quantity: roundQuantity(packs * pack), basis: `${packs} × reorder quantity to reach ${target !== null ? "target" : "capacity"}` };
    }
    return { quantity: roundQuantity(shortfall), basis: `Tops up to ${target !== null ? "target" : "capacity"}` };
  }
  if (pack && pack > 0) return { quantity: roundQuantity(pack), basis: "Standard reorder quantity" };
  return { quantity: 0, basis: "Set a target level or reorder quantity for a suggestion" };
}

// ---------------------------------------------------------------------------
// Usage trends
// ---------------------------------------------------------------------------
// Consumption is read from the ledger: recorded usage (stock out) plus falls
// found by a physical check or stocktake (usage nobody booked out).
// Adjustments are corrections, not usage, and are excluded.
const CONSUMPTION_TYPES = ["stock_out", "check", "stocktake"];
export const USAGE_WINDOW_DAYS = 90;
const MIN_USAGE_EVENTS = 3;
const MIN_USAGE_SPAN_DAYS = 14;

/**
 * Average daily usage and an estimated run-out date, only when there is enough
 * history to mean something (3+ consumption events over 14+ days). The result
 * is always an estimate: callers present it as "about", with a range.
 *
 * @param {Array<{ movementType, quantityDelta, createdAt }>} movements  This item's ledger rows.
 */
export function summariseUsage(movements = [], item = {}, now = new Date()) {
  const nowTime = toTime(now) || Date.now();
  const windowStart = nowTime - USAGE_WINDOW_DAYS * MS_PER_DAY;
  const inWindow = movements.filter((movement) => {
    const time = toTime(movement.createdAt);
    return time !== null && time >= windowStart && time <= nowTime;
  });
  const consumption = inWindow.filter(
    (movement) => CONSUMPTION_TYPES.includes(movement.movementType) && (toNumber(movement.quantityDelta) || 0) < 0
  );
  const totalUsed = consumption.reduce((sum, movement) => sum + Math.abs(toNumber(movement.quantityDelta) || 0), 0);
  const firstTime = inWindow.reduce((earliest, movement) => Math.min(earliest, toTime(movement.createdAt)), nowTime);
  const spanDays = Math.max(1, (nowTime - firstTime) / MS_PER_DAY);
  const reliable = consumption.length >= MIN_USAGE_EVENTS && spanDays >= MIN_USAGE_SPAN_DAYS && totalUsed > 0;
  const dailyUsage = totalUsed > 0 ? totalUsed / Math.max(spanDays, 7) : 0;
  const quantity = toNumber(item.currentQuantity);
  let daysRemaining = null;
  let runOutDate = null;
  if (reliable && dailyUsage > 0 && quantity !== null) {
    daysRemaining = quantity / dailyUsage;
    runOutDate = new Date(nowTime + daysRemaining * MS_PER_DAY).toISOString();
  }
  return {
    totalUsed: roundQuantity(totalUsed),
    dailyUsage: roundQuantity(dailyUsage, 3),
    weeklyUsage: roundQuantity(dailyUsage * 7),
    eventCount: consumption.length,
    spanDays: Math.round(spanDays),
    reliable,
    daysRemaining: daysRemaining === null ? null : Math.round(daysRemaining),
    runOutDate,
  };
}

/** "about 2–3 weeks" style wording for a run-out estimate, or null. */
export function describeRunOut(usage) {
  if (!usage?.reliable || usage.daysRemaining === null) return null;
  const days = usage.daysRemaining;
  if (days <= 0) return "Likely run out now";
  const low = Math.max(0, Math.floor(days * 0.75));
  const high = Math.ceil(days * 1.25);
  if (high <= 14) return `about ${low}–${high} days`;
  const lowWeeks = Math.max(1, Math.floor(low / 7));
  const highWeeks = Math.ceil(high / 7);
  return lowWeeks === highWeeks ? `about ${lowWeeks} weeks` : `about ${lowWeeks}–${highWeeks} weeks`;
}

// ---------------------------------------------------------------------------
// Card actions
// ---------------------------------------------------------------------------
/**
 * The context-sensitive primary action for a card, given the caller's
 * capabilities. Normal stock is checked, low stock is ordered, ordered stock
 * shows its order, incoming stock is received.
 *
 * @returns {{ id: string, label: string } | null}
 */
export function getPrimaryAction(status, capabilities = {}) {
  if (!status) return null;
  if (status.key === "archived") return capabilities.manage ? { id: "restore", label: "Restore" } : null;
  if (["awaiting_delivery", "partially_received"].includes(status.key)) {
    return capabilities.receive ? { id: "receive", label: "Mark Received" } : { id: "order-info", label: "Order Info" };
  }
  if (status.key === "ordered") {
    return capabilities.receive ? { id: "receive", label: "Mark Received" } : { id: "order-info", label: "Order Info" };
  }
  if (status.orderState === "order_required") {
    return capabilities.order ? { id: "order", label: "Place Order" } : { id: "check", label: "Check Level" };
  }
  if (["low", "critical", "out_of_stock"].includes(status.levelState)) {
    if (capabilities.order) return { id: "order", label: "Order Stock" };
    if (capabilities.check) return { id: "request-order", label: "Request Order" };
  }
  return capabilities.check ? { id: "check", label: "Check Level" } : null;
}

// ---------------------------------------------------------------------------
// Search, filter, sort, summary
// ---------------------------------------------------------------------------
const normaliseText = (value) => String(value || "").trim().toLowerCase();

/** Search across name, grade, stock ID, barcode, supplier, product code, category and location. */
export function matchesSearch(item, term, { categoryName = "", locationName = "", orderSupplier = "" } = {}) {
  const needle = normaliseText(term);
  if (!needle) return true;
  const haystack = [
    item.title,
    item.oilGrade,
    item.stockCode,
    item.barcode,
    item.preferredSupplier,
    item.supplierProductCode,
    categoryName,
    locationName,
    orderSupplier,
  ]
    .map(normaliseText)
    .join(" | ");
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}

/** An exact barcode / stock-code hit for a scanned value, or null. */
export function findByScan(items = [], value) {
  const scanned = normaliseText(value);
  if (!scanned) return null;
  const fromUrl = parseStockScan(value);
  if (fromUrl?.itemId) return items.find((item) => item.id === fromUrl.itemId) || null;
  return (
    items.find((item) => normaliseText(item.barcode) === scanned) ||
    items.find((item) => normaliseText(item.stockCode) === scanned) ||
    null
  );
}

/**
 * Resolve every item once with its status, open order and derived values, so
 * filtering, sorting and rendering never recompute them.
 */
export function resolveRows(items = [], orders = [], { now = new Date(), categories = [], locations = [] } = {}) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  return items.map((item) => {
    const openOrder = findOpenOrder(orders, item.id);
    const status = resolveStockStatus(item, openOrder);
    const quantity = toNumber(item.currentQuantity);
    const unitCost = toNumber(item.unitCost);
    return {
      item,
      openOrder,
      status,
      now,
      archived: Boolean(item.archivedAt),
      checkDue: isCheckOverdue(item, now),
      category: categoryById.get(item.categoryId) || null,
      location: locationById.get(item.locationId) || null,
      fraction: fillFraction(item),
      value: quantity !== null && unitCost !== null ? quantity * unitCost : null,
      incoming: outstandingQuantity(openOrder),
    };
  });
}

export function filterRows(rows = [], { search = "", categoryId = "all", locationId = "all", status = "all", supplier = "all", summary = null } = {}) {
  const summaryFilter = summary ? SUMMARY_FILTERS.find((filter) => filter.key === summary) : null;
  return rows.filter((row) => {
    if (status === "archived") {
      if (!row.archived) return false;
    } else if (row.archived) {
      return false;
    }
    if (categoryId !== "all" && row.item.categoryId !== categoryId) return false;
    if (locationId !== "all" && row.item.locationId !== locationId) return false;
    if (supplier !== "all") {
      const suppliers = [row.item.preferredSupplier, row.openOrder?.supplier].map(normaliseText);
      if (!suppliers.includes(normaliseText(supplier))) return false;
    }
    if (status === "check_due" && !row.checkDue) return false;
    if (!["all", "archived", "check_due"].includes(status)) {
      if (row.status.key !== status && row.status.levelState !== status && row.status.orderState !== status) return false;
    }
    if (summaryFilter && !summaryFilter.match(row)) return false;
    return matchesSearch(row.item, search, {
      categoryName: row.category?.name,
      locationName: row.location?.name,
      orderSupplier: row.openOrder?.supplier,
    });
  });
}

const compareText = (a, b) => String(a || "").localeCompare(String(b || ""), "en-GB", { sensitivity: "base" });

export function sortRows(rows = [], sortKey = "action") {
  const sorted = [...rows];
  const byName = (a, b) => compareText(a.item.title, b.item.title);
  const lastCheck = (row) => toTime(row.item.lastCheck);
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "lowest": {
        const fa = a.fraction === null ? Number.POSITIVE_INFINITY : a.fraction;
        const fb = b.fraction === null ? Number.POSITIVE_INFINITY : b.fraction;
        return fa - fb || a.status.priority - b.status.priority || byName(a, b);
      }
      case "oldest-check":
        return (lastCheck(a) ?? Number.NEGATIVE_INFINITY) - (lastCheck(b) ?? Number.NEGATIVE_INFINITY) || byName(a, b);
      case "recent-check":
        return (lastCheck(b) ?? Number.NEGATIVE_INFINITY) - (lastCheck(a) ?? Number.NEGATIVE_INFINITY) || byName(a, b);
      case "name":
        return byName(a, b);
      case "category":
        return compareText(a.category?.name || "~", b.category?.name || "~") || byName(a, b);
      case "usage":
        return (toNumber(b.item.usage?.dailyUsage) || 0) - (toNumber(a.item.usage?.dailyUsage) || 0) || byName(a, b);
      case "value":
        return (b.value ?? -1) - (a.value ?? -1) || byName(a, b);
      case "action":
      default: {
        const pa = a.status.priority - (a.checkDue && a.status.priority >= 7 ? 0.5 : 0);
        const pb = b.status.priority - (b.checkDue && b.status.priority >= 7 ? 0.5 : 0);
        return pa - pb || (lastCheck(a) ?? 0) - (lastCheck(b) ?? 0) || byName(a, b);
      }
    }
  });
  return sorted;
}

export function summaryCounts(rows = []) {
  return SUMMARY_FILTERS.map((filter) => ({
    key: filter.key,
    label: filter.label,
    value: rows.filter((row) => filter.match(row)).length,
  }));
}

/** Other active items with the same product name at a different location. */
export function findSiblingRows(rows = [], row) {
  const title = normaliseText(row?.item?.title);
  if (!title) return [];
  return rows.filter(
    (other) => other !== row && !other.archived && normaliseText(other.item.title) === title && other.item.locationId !== row.item.locationId
  );
}

/**
 * findSiblingRows for every row at once: Map(row -> siblings). The grid used to
 * call findSiblingRows per card on every render — a full scan per card, so the
 * whole grid was O(n²) on each search keystroke. Same rules, one pass.
 */
export function indexSiblingRows(rows = []) {
  const byTitle = new Map();
  rows.forEach((row) => {
    const title = normaliseText(row?.item?.title);
    if (!title) return;
    if (!byTitle.has(title)) byTitle.set(title, []);
    byTitle.get(title).push(row);
  });
  const index = new Map();
  byTitle.forEach((group) => {
    group.forEach((row) => {
      index.set(
        row,
        group.filter((other) => other !== row && !other.archived && other.item.locationId !== row.item.locationId)
      );
    });
  });
  return index;
}

/** Distinct supplier names across items and open orders, for the supplier filter. */
export function collectSuppliers(items = [], orders = []) {
  const names = new Map();
  [...items.map((item) => item.preferredSupplier), ...orders.map((order) => order.supplier)].forEach((name) => {
    const trimmed = String(name || "").trim();
    if (trimmed && !names.has(trimmed.toLowerCase())) names.set(trimmed.toLowerCase(), trimmed);
  });
  return Array.from(names.values()).sort(compareText);
}

// ---------------------------------------------------------------------------
// QR / scan links
// ---------------------------------------------------------------------------
export const STOCK_QR_ACTIONS = ["check", "use", "receive"];

/**
 * The URL a stock label's QR code opens. Labels printed before the tracker
 * split read /tracking?tab=oil-stock&stock=…; /tracking redirects those here,
 * and parseStockScan reads either form.
 */
export function buildStockQrUrl(origin, itemId, action = "check") {
  const base = String(origin || "").replace(/\/+$/, "");
  const params = new URLSearchParams({ stock: itemId });
  if (action && STOCK_QR_ACTIONS.includes(action)) params.set("stockAction", action);
  return `${base}/tracking/Oil-Stock?${params.toString()}`;
}

/** Read an item id / action from a scanned QR URL. */
export function parseStockScan(value) {
  const text = String(value || "").trim();
  if (!/[?&]stock=/.test(text)) return null;
  try {
    const url = new URL(text, "http://local");
    const itemId = url.searchParams.get("stock");
    if (!itemId) return null;
    const action = url.searchParams.get("stockAction");
    return { itemId, action: STOCK_QR_ACTIONS.includes(action) ? action : "check" };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// History wording
// ---------------------------------------------------------------------------
export function describeMovement(movement = {}, item = {}) {
  const meta = MOVEMENT_META[movement.movementType] || { label: movement.movementType };
  const delta = toNumber(movement.quantityDelta);
  const parts = [];
  if (movement.movementType === "check" || movement.movementType === "stocktake") {
    if (movement.levelBand) parts.push(getBandMeta(movement.levelBand)?.label || movement.levelBand);
    if (toNumber(movement.dipstickReading) !== null) parts.push(`dipstick ${movement.dipstickReading}`);
    if (toNumber(movement.quantityAfter) !== null) parts.push(`recorded ${formatQuantity(movement.quantityAfter, item)}`);
    if (delta) parts.push(`${delta > 0 ? "+" : "−"}${formatQuantity(Math.abs(delta), item)} vs record`);
  } else if (delta) {
    parts.push(`${delta > 0 ? "+" : "−"}${formatQuantity(Math.abs(delta), item)}`);
    if (toNumber(movement.quantityAfter) !== null) parts.push(`now ${formatQuantity(movement.quantityAfter, item)}`);
  }
  return { label: meta.label, tone: meta.tone, detail: parts.join(" · ") };
}
