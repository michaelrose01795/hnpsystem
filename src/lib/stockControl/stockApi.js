// file location: src/lib/stockControl/stockApi.js
//
// Shared plumbing for the /api/tracking/stock/* routes: capability resolution,
// the acting user, the one function every quantity change goes through
// (applyQuantityChange), and the records each accepted change writes — a row
// on tracking_stock_movements (the ledger the page renders) and a hash-chained
// platform audit entry via writeAuditLog. Notifications go to the shared DMS
// feed (public.notifications) in the same target-role shape as
// src/lib/notifications/notifyJobStatusChange.js.

import { hasAllAccessRole, normalizeRoles } from "@/lib/auth/roles";
import { getAuditContext, shallowDiff } from "@/lib/audit/auditContext";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { logFailure } from "@/lib/utils/logFailure";
import { resolveStockCapabilities } from "@/features/stockControl/stockAccess";
import {
  STOCK_STATUS_META,
  bandFromFraction,
  formatQuantity,
  isAlertWorthy,
  isCheckOverdue,
  isSignificantAdjustment,
  resolveLevelState,
  roundQuantity,
  toNumber,
} from "@/features/stockControl/stockModel";
import { insertNotifications, recordMovement, updateItem, updateOrder } from "@/lib/database/stockControl";

// Notification audiences on the shared feed. These are the target_role values
// the DMS notification consumers already read (see notifyJobStatusChange.js),
// not permission roles.
const NOTIFY_PARTS = "Parts";
const NOTIFY_MANAGERS = "Managers";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const capabilitiesFor = (session) => {
  const roles = normalizeRoles(session?.user?.roles ?? []);
  return resolveStockCapabilities(roles, hasAllAccessRole(roles));
};

/**
 * Stop the request with a 403 unless the session holds `capability`.
 * @returns {object|null} The capabilities, or null when the response was sent.
 */
export function requireCapability(res, session, capability) {
  const capabilities = capabilitiesFor(session);
  if (capabilities[capability] !== true) {
    res.status(403).json({ success: false, message: "Your role cannot make this stock change." });
    return null;
  }
  return capabilities;
}

export async function actorFor(req, res, session) {
  const auditContext = await getAuditContext(req, res);
  return {
    auditContext,
    actorUserId: auditContext.actorUserId,
    actorName: session?.user?.name || session?.user?.email || null,
  };
}

export function sendServerError(res, error, fallback) {
  logFailure(fallback, error);
  res.status(500).json({ success: false, message: error?.message || fallback });
}

export const methodNotAllowed = (res, allow) => {
  res.setHeader("Allow", allow);
  res.status(405).json({ success: false, message: "Method not allowed" });
};

export const sendValidation = (res, errors) =>
  res.status(400).json({ success: false, message: errors[0], errors });

/** Hide cost fields from roles without viewCosts. */
export function redactCosts(record, capabilities) {
  if (!record || capabilities.viewCosts) return record;
  const rest = { ...record };
  delete rest.unitCost;
  delete rest.value;
  if (rest.detail && Object.prototype.hasOwnProperty.call(rest.detail, "unitCost")) {
    rest.detail = { ...rest.detail };
    delete rest.detail.unitCost;
  }
  return rest;
}

/** Write a ledger row and the matching platform audit entry. */
export async function recordStockChange({ actor, item, movement, auditAction, before = null, after = null, reason = null }) {
  const saved = await recordMovement({
    itemId: item.id,
    locationId: item.locationId || null,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    ...movement,
  });
  await writeAuditLog({
    ...actor.auditContext,
    action: auditAction || `stock_${movement.movementType}`,
    entityType: "stock_item",
    entityId: item.id,
    diff: before && after ? shallowDiff(before, after) : null,
    reason: reason || movement.reason || null,
  });
  return saved;
}

/** Band that matches a quantity when the item has a capacity to measure against. */
export function bandForQuantity(item, quantity) {
  const capacity = toNumber(item.maxCapacity);
  if (quantity === null || !capacity) return item.levelBand || null;
  return bandFromFraction(quantity / capacity);
}

const nextCheckFrom = (item, now) => {
  const days = toNumber(item.intervalDays);
  return days ? new Date(now.getTime() + days * MS_PER_DAY).toISOString() : item.nextCheck || null;
};

/**
 * The single path for every quantity change (check, stock in / out,
 * adjustment, receipt, stocktake count). Updates the item, writes the ledger
 * row + audit entry, and raises notifications for a drop into Low / Critical /
 * Out of Stock and for significant adjustments.
 *
 * @param {object} args
 * @param {object} args.item            Current item (mapped).
 * @param {number|null} args.quantity   New absolute quantity (null = unknown).
 * @param {string} args.movementType
 * @param {object} [args.itemPatch]     Extra columns (band, dipstick, dates).
 * @param {object} [args.movement]      Extra ledger fields (reason, job, order...).
 * @param {boolean} [args.isCheck]      Resets the check schedule.
 */
export async function applyQuantityChange({ actor, item, quantity, movementType, itemPatch = {}, movement = {}, isCheck = false, now = new Date() }) {
  const before = toNumber(item.currentQuantity);
  const after = quantity === null ? null : roundQuantity(Math.max(0, quantity), 3);
  const delta = before !== null && after !== null ? roundQuantity(after - before, 3) : null;
  const patch = { ...itemPatch, currentQuantity: after, updatedBy: actor.actorUserId };
  if (patch.levelBand === undefined) patch.levelBand = bandForQuantity(item, after);
  if (isCheck) {
    patch.lastCheck = now.toISOString();
    patch.nextCheck = nextCheckFrom(item, now);
    patch.checkAlertedAt = null;
  }

  const previousState = resolveLevelState(item);
  const nextState = resolveLevelState({ ...item, ...patch });
  const alerts = [];
  if (isAlertWorthy(item.alertState || previousState, nextState)) {
    patch.alertState = nextState;
    alerts.push({
      targetRole: NOTIFY_PARTS,
      message: `Stock ${STOCK_STATUS_META[nextState].label.toLowerCase()}: ${item.title}${after !== null ? ` — ${formatQuantity(after, item)} left` : ""}.`,
    });
    if (nextState === "out_of_stock") {
      alerts.push({ targetRole: NOTIFY_MANAGERS, message: `Out of stock: ${item.title}.` });
    }
  } else if (nextState === "normal" && item.alertState) {
    patch.alertState = null;
  }

  const significant = ["adjustment", "stocktake"].includes(movementType) && delta !== null && isSignificantAdjustment(item, delta, before);
  if (significant) {
    alerts.push({
      targetRole: NOTIFY_MANAGERS,
      message: `Significant stock ${movementType === "stocktake" ? "variance" : "adjustment"}: ${item.title} ${delta > 0 ? "+" : "−"}${formatQuantity(Math.abs(delta), item)} by ${actor.actorName || "a user"}${movement.reason ? ` (${movement.reason})` : ""}.`,
    });
  }

  const updated = await updateItem(item.id, patch);
  const saved = await recordStockChange({
    actor,
    item: updated,
    movement: {
      ...movement,
      movementType,
      quantityBefore: before,
      quantityAfter: after,
      quantityDelta: delta,
      levelBand: patch.levelBand || null,
      detail: { ...(movement.detail || {}), ...(significant ? { significant: true } : {}) },
    },
    auditAction: `stock_${movementType}`,
    before: { current_quantity: before, level_band: item.levelBand || null },
    after: { current_quantity: after, level_band: patch.levelBand || null },
  });

  await notify(alerts);
  return { item: updated, movement: saved, delta };
}

export async function notify(alerts = []) {
  try {
    await insertNotifications(alerts);
  } catch (error) {
    // A notification failure must never undo a stock change.
    logFailure("Stock notification failed", error);
  }
}

/**
 * Time-based alerts — overdue checks and late deliveries — have no event to
 * hang off, so they are raised lazily when the tracker loads. Each item /
 * order is alerted once (check_alerted_at / delay_alerted_at), and a sweep
 * sends one summary notification per kind rather than one per row.
 */
export async function sweepTimeAlerts({ items = [], orders = [], now = new Date() }) {
  const todayKey = now.toISOString().slice(0, 10);
  const overdue = items.filter(
    (item) => !item.archivedAt && item.nextCheck && isCheckOverdue(item, now) && !item.checkAlertedAt
  );
  const itemTitle = new Map(items.map((item) => [item.id, item.title]));
  const late = orders.filter(
    (order) =>
      ["ordered", "awaiting_delivery", "partially_received"].includes(order.status) &&
      order.expectedDelivery &&
      order.expectedDelivery < todayKey &&
      !order.delayAlertedAt
  );
  if (!overdue.length && !late.length) return;

  const stamp = now.toISOString();
  const listNames = (names) => `${names.slice(0, 5).join(", ")}${names.length > 5 ? ` and ${names.length - 5} more` : ""}`;
  const alerts = [];
  if (overdue.length) {
    alerts.push({
      targetRole: NOTIFY_MANAGERS,
      message: `${overdue.length} stock check${overdue.length === 1 ? " is" : "s are"} overdue: ${listNames(overdue.map((item) => item.title))}.`,
    });
  }
  if (late.length) {
    alerts.push({
      targetRole: NOTIFY_PARTS,
      message: `${late.length} stock deliver${late.length === 1 ? "y is" : "ies are"} late: ${listNames(late.map((order) => itemTitle.get(order.itemId) || "Unknown item"))}.`,
    });
  }
  try {
    await Promise.all([
      ...overdue.map((item) => updateItem(item.id, { checkAlertedAt: stamp })),
      ...late.map((order) => updateOrder(order.id, { delayAlertedAt: stamp })),
    ]);
    await notify(alerts);
  } catch (error) {
    logFailure("Stock alert sweep failed", error);
  }
}
