// file location: src/pages/api/access/items/[id].js
//
// GET   one item's full record and timeline: every ledger row, checkouts,
//       restock requests and warranty records (capability: manage).
// PUT   edit the record — name, codes, location, thresholds, supplier, cost.
//       Quantities never change here; they change only through
//       /api/access/transactions so every change is in the ledger.
// PATCH { action: "activate" | "deactivate", reason }.
//
// Capabilities are checked against the store the item belongs to.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { ANY_STORE_MANAGER_ROLES } from "@/features/stockAccess/stockAccessPermissions";
import { getStockAccessStore } from "@/config/stockAccessStores";
import {
  getItem,
  insertTransaction,
  listCheckoutsForItem,
  listLocations,
  listRestockForItem,
  listTransactionsForItem,
  listWarrantyForItem,
  updateItem,
} from "@/lib/database/stockAccess";
import {
  actorFor,
  audit,
  methodNotAllowed,
  redactCosts,
  refuseDuplicateCode,
  refuseIfMigrationPending,
  requireCapability,
  sendError,
  sendValidation,
} from "@/lib/stockAccess/stockAccessApi";
import { parseItemInput, text, uuidOrNull } from "@/lib/stockAccess/stockAccessInput";

/** Field-level before / after for the edit ledger row and the audit record. */
function changedFields(before, after) {
  const changes = {};
  Object.keys(after).forEach((key) => {
    if (key === "updatedAt" || key === "lastMovementAt") return;
    if (JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)) changes[key] = { before: before[key] ?? null, after: after[key] ?? null };
  });
  return changes;
}

async function handler(req, res, session) {
  if (!["GET", "PUT", "PATCH"].includes(req.method)) {
    methodNotAllowed(res, "GET, PUT, PATCH");
    return;
  }
  try {
    if (await refuseIfMigrationPending(res)) return;
    const id = uuidOrNull(req.query.id);
    const item = id ? await getItem(id) : null;
    const store = item ? getStockAccessStore(item.storeKey) : null;
    if (!item || !store) {
      res.status(404).json({ success: false, message: "Stock item not found." });
      return;
    }
    const capabilities = requireCapability(res, session, "manage", store);
    if (!capabilities) return;

    if (req.method === "GET") {
      const [transactions, checkouts, restock, warranty, locations] = await Promise.all([
        listTransactionsForItem(item.id),
        listCheckoutsForItem(item.id),
        listRestockForItem(item.id),
        listWarrantyForItem(item.id),
        listLocations(store.key),
      ]);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).json({ success: true, data: { item: redactCosts(item, capabilities), transactions, checkouts, restock, warranty, locations } });
      return;
    }

    if (req.method === "PUT") {
      const { item: patch, errors } = parseItemInput(req.body || {});
      if (errors.length) {
        sendValidation(res, errors);
        return;
      }
      delete patch.isActive; // activation has its own audited PATCH
      if (await refuseDuplicateCode(res, { storeKey: store.key, sku: patch.sku, barcode: patch.barcode, excludeId: item.id })) return;
      const actor = await actorFor(req, res, session);
      const after = await updateItem(item.id, { ...patch, updatedBy: actor.userId });
      const changes = changedFields(item, after);
      if (Object.keys(changes).length) {
        await insertTransaction({ item: after, action: "edited", userId: actor.userId, userName: actor.name, detail: { changes } });
        await audit(actor, { action: "stock_access_item_edited", entityId: after.id, beforeData: item, afterData: after });
      }
      res.status(200).json({ success: true, data: { item: redactCosts(after, capabilities) } });
      return;
    }

    // PATCH
    const action = req.body?.action;
    if (!["activate", "deactivate"].includes(action)) {
      sendValidation(res, ["Unknown item action."]);
      return;
    }
    if (action === "deactivate" && item.checkedOutQuantity > 0) {
      res.status(409).json({ success: false, message: "This item is still checked out. Return it or write it off before deactivating." });
      return;
    }
    const actor = await actorFor(req, res, session);
    const reason = text(req.body?.reason, 200);
    const updated = await updateItem(item.id, { isActive: action === "activate", updatedBy: actor.userId });
    await insertTransaction({ item: updated, action: action === "activate" ? "activated" : "deactivated", userId: actor.userId, userName: actor.name, reason });
    await audit(actor, { action: `stock_access_item_${action}d`, entityId: item.id, reason });
    res.status(200).json({ success: true, data: { item: redactCosts(updated, capabilities) } });
  } catch (error) {
    sendError(res, error, "Unable to process the stock item request");
  }
}

export default withRoleGuard(handler, { allow: ANY_STORE_MANAGER_ROLES });
