// file location: src/pages/api/access/items/index.js
//
// GET  ?store=<key> — the store's manage table: every item (incl. inactive),
//      open checkouts, restock requests, warranty records and locations.
// POST { store, ...item } — create an item in a store (capability: manage).
//      An opening quantity is booked as an "Opening balance" adjustment so it
//      appears in the ledger like every other change.

export const runtime = "nodejs";

import crypto from "crypto";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { ANY_STORE_MANAGER_ROLES } from "@/features/stockAccess/stockAccessPermissions";
import {
  applyTransaction,
  createItem,
  insertTransaction,
  isStockAccessMigrationPending,
  listItems,
  listLocations,
  listOpenCheckouts,
  listRestockRequests,
  listWarrantyRecords,
} from "@/lib/database/stockAccess";
import {
  actorFor,
  audit,
  capabilitiesFor,
  methodNotAllowed,
  redactCosts,
  refuseDuplicateCode,
  refuseIfMigrationPending,
  requireCapability,
  resolveStore,
  sendError,
  sendValidation,
} from "@/lib/stockAccess/stockAccessApi";
import { parseItemInput } from "@/lib/stockAccess/stockAccessInput";

async function handleList(req, res, session, store) {
  const capabilities = capabilitiesFor(session, store);
  if (!capabilities.manage) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  if (await isStockAccessMigrationPending()) {
    res.status(200).json({ success: true, data: { items: [], checkouts: [], restock: [], warranty: [], locations: [], capabilities, migrationPending: true } });
    return;
  }
  const [items, warranty, locations] = await Promise.all([
    listItems({ storeKey: store.key, includeInactive: true }),
    listWarrantyRecords({ storeKey: store.key }),
    listLocations(store.key),
  ]);
  const itemIds = items.map((item) => item.id);
  const [checkouts, restock] = await Promise.all([listOpenCheckouts(itemIds), listRestockRequests({ itemIds })]);
  res.status(200).json({
    success: true,
    data: { items: items.map((item) => redactCosts(item, capabilities)), checkouts, restock, warranty, locations, capabilities, migrationPending: false },
  });
}

async function handleCreate(req, res, session, store) {
  const capabilities = requireCapability(res, session, "manage", store);
  if (!capabilities) return;
  if (await refuseIfMigrationPending(res)) return;
  const { item: fields, errors } = parseItemInput(req.body || {}, { create: true });
  if (errors.length) {
    sendValidation(res, errors);
    return;
  }
  if (await refuseDuplicateCode(res, { ...fields, storeKey: store.key })) return;

  const actor = await actorFor(req, res, session);
  const { openingQuantity, ...record } = fields;
  let item = await createItem({ ...record, storeKey: store.key, currentQuantity: 0, createdBy: actor.userId, updatedBy: actor.userId });
  await insertTransaction({ item, action: "created", userId: actor.userId, userName: actor.name });
  if (openingQuantity > 0) {
    const result = await applyTransaction({
      itemId: item.id,
      action: "adjustment",
      quantityDelta: openingQuantity,
      entry: {
        quantity: openingQuantity,
        user_id: actor.userId,
        user_name: actor.name,
        reason: "Opening balance",
        client_request_id: crypto.randomUUID(),
        detail: { mode: "set" },
      },
    });
    item = result.item;
  }
  await audit(actor, {
    action: "stock_access_item_created",
    entityId: item.id,
    afterData: { store: store.key, name: item.name, category: item.category, current_quantity: item.currentQuantity },
  });
  res.status(201).json({ success: true, data: { item: redactCosts(item, capabilities) } });
}

async function handler(req, res, session) {
  const store = resolveStore(req, res);
  if (!store) return;
  try {
    if (req.method === "GET") return await handleList(req, res, session, store);
    if (req.method === "POST") return await handleCreate(req, res, session, store);
    methodNotAllowed(res, "GET, POST");
  } catch (error) {
    sendError(res, error, "Unable to process the stock item request");
  }
}

export default withRoleGuard(handler, { allow: ANY_STORE_MANAGER_ROLES });
