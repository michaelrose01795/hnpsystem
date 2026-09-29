// file location: src/pages/api/access/restock.js
//
// GET  ?store=<key> — the store's restock requests — every request for processRestock roles, the open
//      ones for everyone else.
// POST flag an item as running low / out (capability: requestRestock). One
//      request stays open per item: a second flag returns the existing one
//      (`joined: true`) instead of doubling the order.
// PUT  { id, action: "order" | "cancel" | "edit" } (capability: processRestock).
//      Receiving goes through /api/access/transactions (action "receive" with
//      restockRequestId) so the stock and the request update together.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { ANY_STORE_USER_ROLES } from "@/features/stockAccess/stockAccessPermissions";
import { getStockAccessStore } from "@/config/stockAccessStores";
import { OPEN_RESTOCK_STATUSES, RESTOCK_STATUS_BY_VALUE, formatDateTime, formatQuantity } from "@/features/stockAccess/stockAccessModel";
import { createRestock, getItem, getRestock, insertTransaction, listItems, listRestockRequests, updateRestock } from "@/lib/database/stockAccess";
import {
  actorFor,
  audit,
  capabilitiesFor,
  methodNotAllowed,
  notify,
  refuseIfMigrationPending,
  requireCapability,
  resolveStore,
  sendError,
  sendValidation,
} from "@/lib/stockAccess/stockAccessApi";
import { parseRestockCreate, parseRestockUpdate } from "@/lib/stockAccess/stockAccessInput";

async function handleList(req, res, session) {
  const store = resolveStore(req, res);
  if (!store) return;
  const capabilities = capabilitiesFor(session, store);
  if (!capabilities.view) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return;
  }
  const items = await listItems({ storeKey: store.key, includeInactive: true });
  const requests = await listRestockRequests({ itemIds: items.map((item) => item.id), openOnly: !capabilities.processRestock });
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).json({ success: true, data: { requests } });
}

async function handleCreate(req, res, session) {
  const { input, errors } = parseRestockCreate(req.body || {});
  if (errors.length) {
    sendValidation(res, errors);
    return;
  }
  const item = await getItem(input.itemId);
  const store = item ? getStockAccessStore(item.storeKey) : null;
  if (!item || !item.isActive || !store) {
    res.status(404).json({ success: false, message: "Stock item not found." });
    return;
  }
  if (!requireCapability(res, session, "requestRestock", store)) return;
  const actor = await actorFor(req, res, session);
  const { request, existing } = await createRestock({
    ...input,
    requestedBy: actor.userId,
    requesterName: actor.name,
  });
  if (existing) {
    res.status(200).json({
      success: true,
      data: {
        joined: true,
        request: existing,
        message: `Already ${RESTOCK_STATUS_BY_VALUE[existing.status]?.label.toLowerCase() || "requested"} by ${existing.requesterName || "someone"} at ${formatDateTime(existing.requestedAt)} — no duplicate raised.`,
      },
    });
    return;
  }
  await insertTransaction({
    item,
    action: "restock_request",
    quantity: request.quantityRequested,
    userId: actor.userId,
    userName: actor.name,
    reason: request.reason,
    notes: request.notes,
    restockRequestId: request.id,
  });
  await audit(actor, { action: "stock_access_restock_requested", entityType: "stock_access_restock", entityId: request.id, reason: request.reason });
  await notify([
    {
      targetRole: "Parts",
      message: `Restock requested: ${item.name} × ${formatQuantity(request.quantityRequested, item)} by ${actor.name} (${request.reason}).`,
    },
  ]);
  res.status(201).json({ success: true, data: { joined: false, request, message: `Restock requested: ${formatQuantity(request.quantityRequested, item)} × ${item.name}` } });
}

async function handleUpdate(req, res, session) {
  const { input, errors } = parseRestockUpdate(req.body || {});
  if (errors.length) {
    sendValidation(res, errors);
    return;
  }
  const request = await getRestock(input.id);
  if (!request) {
    res.status(404).json({ success: false, message: "Restock request not found." });
    return;
  }
  if (!OPEN_RESTOCK_STATUSES.includes(request.status)) {
    res.status(409).json({ success: false, message: "This restock request is already closed." });
    return;
  }
  const item = await getItem(request.itemId);
  if (!requireCapability(res, session, "processRestock", getStockAccessStore(item?.storeKey))) return;
  const actor = await actorFor(req, res, session);
  const now = new Date().toISOString();
  let patch;
  if (input.action === "order") {
    if (request.status !== "requested") {
      res.status(409).json({ success: false, message: "This request has already been ordered." });
      return;
    }
    patch = {
      status: "ordered",
      orderedBy: actor.userId,
      orderedAt: now,
      supplierReference: input.supplierReference,
      expectedAt: input.expectedAt,
      ...(input.quantityRequested ? { quantityRequested: input.quantityRequested } : {}),
    };
  } else if (input.action === "cancel") {
    patch = { status: "cancelled", cancelledBy: actor.userId, cancelledAt: now, cancelReason: input.reason };
  } else {
    patch = {
      ...(input.quantityRequested ? { quantityRequested: input.quantityRequested } : {}),
      ...(input.supplierReference ? { supplierReference: input.supplierReference } : {}),
      ...(input.expectedAt ? { expectedAt: input.expectedAt } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    };
  }
  const updated = await updateRestock(request.id, patch);
  await insertTransaction({
    item,
    action: "restock_update",
    quantity: updated.quantityRequested,
    userId: actor.userId,
    userName: actor.name,
    reason: input.action === "cancel" ? input.reason : null,
    restockRequestId: updated.id,
    detail: { from: request.status, to: updated.status, action: input.action, supplierReference: updated.supplierReference || undefined },
  });
  await audit(actor, {
    action: `stock_access_restock_${input.action}`,
    entityType: "stock_access_restock",
    entityId: updated.id,
    reason: input.reason || null,
    beforeData: { status: request.status, quantity_requested: request.quantityRequested },
    afterData: { status: updated.status, quantity_requested: updated.quantityRequested },
  });
  res.status(200).json({ success: true, data: { request: updated } });
}

async function handler(req, res, session) {
  try {
    if (await refuseIfMigrationPending(res)) return;
    if (req.method === "GET") return await handleList(req, res, session);
    if (req.method === "POST") return await handleCreate(req, res, session);
    if (req.method === "PUT") return await handleUpdate(req, res, session);
    methodNotAllowed(res, "GET, POST, PUT");
  } catch (error) {
    sendError(res, error, "Unable to process the restock request");
  }
}

export default withRoleGuard(handler, { allow: ANY_STORE_USER_ROLES });
