// file location: src/pages/api/tracking/stock/[id].js
//
// GET    one item's history for the right-side drawer: the ledger (checks,
//        receipts, usage, adjustments, orders, lifecycle) with users, every
//        order and the purchase-cost history.
// PUT    edit the item's configuration (capability: manage). The quantity is
//        deliberately NOT editable here — it only changes through a check,
//        movement, receipt or stocktake so every change is in the ledger.
// PATCH  { action: "archive" | "restore" } (capability: archive). Items are
//        archived, never deleted, so their history is kept for reporting.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { STOCK_ROLES } from "@/features/stockControl/stockAccess";
import {
  findActiveDuplicate,
  findItemByCode,
  getItem,
  isStockControlMigrationPending,
  listMovementsForItem,
  listOrdersForItem,
  updateItem,
} from "@/lib/database/stockControl";
import {
  actorFor,
  capabilitiesFor,
  methodNotAllowed,
  recordStockChange,
  redactCosts,
  requireCapability,
  sendServerError,
  sendValidation,
} from "@/lib/stockControl/stockApi";
import { UUID_RE, parseItemInput } from "@/lib/stockControl/stockInput";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Configuration fields worth naming in the ledger when they change.
const TRACKED_FIELDS = {
  title: "name",
  categoryId: "category",
  locationId: "location",
  minLevel: "minimum",
  criticalLevel: "critical level",
  targetLevel: "target",
  reorderQuantity: "reorder quantity",
  maxCapacity: "capacity",
  preferredSupplier: "supplier",
  unitCost: "unit cost",
  calibration: "calibration",
  measurementMode: "measurement",
  unit: "unit",
  intervalDays: "check interval",
};

async function handleHistory(req, res, session, item) {
  const capabilities = capabilitiesFor(session);
  if (!capabilities.view) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return;
  }
  // Before the migration there is no ledger yet: show the item with no history.
  const pending = await isStockControlMigrationPending();
  const [movements, orders] = pending
    ? [[], []]
    : await Promise.all([listMovementsForItem(item.id), listOrdersForItem(item.id)]);
  const purchaseHistory = capabilities.viewCosts
    ? movements
        .filter((movement) => (movement.movementType === "receipt" || movement.movementType === "stock_in") && movement.unitCost !== null)
        .map((movement) => ({
          at: movement.createdAt,
          unitCost: movement.unitCost,
          quantity: movement.quantityDelta,
          supplier: orders.find((order) => order.id === movement.orderId)?.supplier || "",
        }))
    : [];
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).json({
    success: true,
    data: {
      item: redactCosts(item, capabilities),
      movements: movements.map((movement) => redactCosts(movement, capabilities)),
      orders: orders.map((order) => redactCosts(order, capabilities)),
      purchaseHistory,
    },
  });
}

async function handleEdit(req, res, session, item) {
  if (!requireCapability(res, session, "manage")) return;
  const { item: patch, errors } = parseItemInput(req.body || {});
  if (errors.length) {
    sendValidation(res, errors);
    return;
  }
  const title = patch.title ?? item.title;
  const locationId = patch.locationId !== undefined ? patch.locationId : item.locationId;
  // Only guard a change of name or location: rows that predate the guard may
  // already share a name, and must stay editable (e.g. to give them locations).
  const identityChanged = title.trim().toLowerCase() !== item.title.trim().toLowerCase() || locationId !== item.locationId;
  const duplicate = identityChanged ? await findActiveDuplicate({ title, locationId, excludeId: item.id }) : null;
  if (duplicate) {
    res.status(409).json({
      success: false,
      code: "stock_duplicate",
      duplicateId: duplicate.id,
      message: `"${duplicate.title}" already exists at that location.`,
    });
    return;
  }
  if (patch.stockCode || patch.barcode) {
    const clash = await findItemByCode({ stockCode: patch.stockCode, barcode: patch.barcode, excludeId: item.id });
    if (clash) {
      res.status(409).json({ success: false, code: "stock_code_in_use", message: `That stock ID or barcode is already used by "${clash.title}".` });
      return;
    }
  }

  // A new interval re-bases the next check on the last one.
  if (patch.intervalDays !== undefined && patch.intervalDays !== item.intervalDays) {
    const base = item.lastCheck ? new Date(item.lastCheck) : new Date();
    patch.nextCheck = patch.intervalDays ? new Date(base.getTime() + patch.intervalDays * MS_PER_DAY).toISOString() : null;
  }

  const actor = await actorFor(req, res, session);
  const updated = await updateItem(item.id, { ...patch, updatedBy: actor.actorUserId });
  const changed = Object.entries(TRACKED_FIELDS)
    .filter(([key]) => patch[key] !== undefined && JSON.stringify(patch[key] ?? null) !== JSON.stringify(item[key] ?? null))
    .map(([, label]) => label);
  await recordStockChange({
    actor,
    item: updated,
    movement: {
      movementType: "edited",
      reason: changed.length ? `Changed ${changed.join(", ")}` : "Details updated",
      detail: { fields: changed },
    },
    auditAction: "stock_item_edited",
    before: item,
    after: updated,
  });
  res.status(200).json({ success: true, data: updated });
}

async function handleArchive(req, res, session, item) {
  if (!requireCapability(res, session, "archive")) return;
  const action = req.body?.action;
  if (!["archive", "restore"].includes(action)) {
    sendValidation(res, ["Unknown action."]);
    return;
  }
  const actor = await actorFor(req, res, session);
  if (action === "restore") {
    const duplicate = await findActiveDuplicate({ title: item.title, locationId: item.locationId, excludeId: item.id });
    if (duplicate) {
      res.status(409).json({ success: false, code: "stock_duplicate", duplicateId: duplicate.id, message: `An active "${duplicate.title}" already exists at this location.` });
      return;
    }
  }
  const updated = await updateItem(item.id, {
    archivedAt: action === "archive" ? new Date().toISOString() : null,
    archivedBy: action === "archive" ? actor.actorUserId : null,
    updatedBy: actor.actorUserId,
  });
  await recordStockChange({
    actor,
    item: updated,
    movement: { movementType: action === "archive" ? "archived" : "restored", reason: String(req.body?.reason || "").slice(0, 200) || null },
    auditAction: action === "archive" ? "stock_item_archived" : "stock_item_restored",
  });
  res.status(200).json({ success: true, data: updated });
}

async function handler(req, res, session) {
  const id = String(req.query.id || "");
  if (!UUID_RE.test(id)) {
    res.status(400).json({ success: false, message: "A valid stock item id is required." });
    return;
  }
  try {
    const item = await getItem(id);
    if (!item) {
      res.status(404).json({ success: false, message: "Stock item not found." });
      return;
    }
    if (req.method === "GET") return await handleHistory(req, res, session, item);
    if (req.method === "PUT") return await handleEdit(req, res, session, item);
    if (req.method === "PATCH") return await handleArchive(req, res, session, item);
    methodNotAllowed(res, "GET, PUT, PATCH");
  } catch (error) {
    sendServerError(res, error, "Unable to update the stock item");
  }
}

export default withRoleGuard(handler, { allow: STOCK_ROLES });
