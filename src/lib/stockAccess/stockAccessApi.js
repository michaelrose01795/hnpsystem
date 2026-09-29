// file location: src/lib/stockAccess/stockAccessApi.js
//
// Shared plumbing for the /api/access/* routes: capability resolution, the
// acting user, error responses, and the records each accepted change writes —
// the stock_access_transactions ledger row (written by the database or by
// insertTransaction) plus a hash-chained platform audit entry via
// writeAuditLog. Low-stock notifications go to the shared DMS feed in the same
// target-role shape as src/lib/stockControl/stockApi.js.

import { hasAllAccessRole, normalizeRoles } from "@/lib/auth/roles";
import { getAuditContext } from "@/lib/audit/auditContext";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { logFailure } from "@/lib/utils/logFailure";
import { resolveStockAccessCapabilities } from "@/features/stockAccess/stockAccessPermissions";
import { getStockAccessStore } from "@/config/stockAccessStores";
import { availableQuantity, formatQuantity, toNumber } from "@/features/stockAccess/stockAccessModel";
import { StockAccessError, findItemByCode, insertNotifications, isStockAccessMigrationPending } from "@/lib/database/stockAccess";

// Notification audiences on the shared feed (target_role values the DMS
// notification consumers read — not permission roles).
const NOTIFY_PARTS = "Parts";
const NOTIFY_MANAGERS = "Managers";

/** What the session may do in a store. */
export const capabilitiesFor = (session, store) => {
  const roles = normalizeRoles(session?.user?.roles ?? []);
  return resolveStockAccessCapabilities(roles, hasAllAccessRole(roles), store);
};

/**
 * The store a request is for: `store` from the query string, else the body.
 * Sends a 404 for an unknown store. @returns {object|null}
 */
export function resolveStore(req, res) {
  const store = getStockAccessStore(req.query?.store || req.body?.store);
  if (!store) res.status(404).json({ success: false, message: "Unknown stock store." });
  return store;
}

/**
 * Stop the request with a 403 unless the session holds `capability`.
 * @returns {object|null} The capabilities, or null when the response was sent.
 */
export function requireCapability(res, session, capability, store) {
  const capabilities = capabilitiesFor(session, store);
  if (capabilities[capability] !== true) {
    res.status(403).json({ success: false, message: "Your role cannot make this stock change." });
    return null;
  }
  return capabilities;
}

/** 409 while the migration has not been applied. @returns {boolean} true when the response was sent. */
export async function refuseIfMigrationPending(res) {
  if (!(await isStockAccessMigrationPending())) return false;
  res.status(409).json({ success: false, code: "migration_pending", message: "Stock Access needs its database migrations (20260928130000_stock_access.sql and 20260928140000_stock_access_stores.sql) before it can be used." });
  return true;
}

/** 409 when another item already uses the SKU / barcode. @returns {boolean} true when sent. */
export async function refuseDuplicateCode(res, { storeKey, sku, barcode, excludeId = null }) {
  if (!sku && !barcode) return false;
  const clash = await findItemByCode({ storeKey, sku, barcode, excludeId });
  if (!clash) return false;
  const skuClash = sku && clash.sku && clash.sku.toLowerCase() === sku.toLowerCase();
  res.status(409).json({
    success: false,
    code: "duplicate_code",
    duplicateId: clash.id,
    message: `${clash.name} already uses ${skuClash ? `SKU ${clash.sku}` : `barcode ${clash.barcode}`}.`,
  });
  return true;
}

export async function actorFor(req, res, session) {
  const auditContext = await getAuditContext(req, res);
  const sessionId = Number(session?.user?.id);
  return {
    auditContext,
    userId: auditContext.actorUserId ?? (Number.isFinite(sessionId) && sessionId > 0 ? sessionId : null),
    name: session?.user?.name || session?.user?.email || "Unknown user",
  };
}

export const methodNotAllowed = (res, allow) => {
  res.setHeader("Allow", allow);
  res.status(405).json({ success: false, message: "Method not allowed" });
};

export const sendValidation = (res, errors) => res.status(400).json({ success: false, message: errors[0], errors });

export function sendError(res, error, fallback) {
  if (error instanceof StockAccessError) {
    res.status(error.status).json({ success: false, code: error.code, message: error.message });
    return;
  }
  logFailure(fallback, error);
  res.status(500).json({ success: false, message: fallback });
}

/** Hide cost fields from roles without viewCosts. */
export function redactCosts(item, capabilities) {
  if (!item || capabilities.viewCosts) return item;
  const rest = { ...item };
  delete rest.unitCost;
  return rest;
}

export async function audit(actor, { action, entityType = "stock_access_item", entityId, reason = null, beforeData = null, afterData = null }) {
  await writeAuditLog({
    ...actor.auditContext,
    action,
    entityType,
    entityId,
    reason,
    beforeData,
    afterData,
  });
}

export async function notify(alerts = []) {
  try {
    await insertNotifications(alerts);
  } catch (error) {
    // A notification failure must never undo a stock change.
    logFailure("Stock Access notification failed", error);
  }
}

/**
 * Alerts for a quantity change: crossing into low stock or running out goes
 * to Parts; an authorised negative override goes to managers. Raised once per
 * crossing because it compares the stock before and after this movement.
 */
export function alertsForChange({ before, after, actor, override = false, reason = "" }) {
  const alerts = [];
  if (!before || !after) return alerts;
  const min = toNumber(after.minQuantity);
  const was = availableQuantity(before);
  const now = availableQuantity(after);
  if (now <= 0 && was > 0) {
    alerts.push({ targetRole: NOTIFY_PARTS, message: `Out of stock: ${after.name} (${after.returnRequired ? "all checked out" : "none left"}).` });
  } else if (min !== null && now <= min && was > min) {
    alerts.push({ targetRole: NOTIFY_PARTS, message: `Low stock: ${after.name} — ${formatQuantity(now, after)} left (minimum ${formatQuantity(min, after)}).` });
  }
  if (override) {
    alerts.push({
      targetRole: NOTIFY_MANAGERS,
      message: `Stock override: ${after.name} recorded below zero by ${actor.name}${reason ? ` (${reason})` : ""}.`,
    });
  }
  return alerts;
}
