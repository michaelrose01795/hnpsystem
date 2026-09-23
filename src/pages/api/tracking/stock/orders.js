// file location: src/pages/api/tracking/stock/orders.js
//
// The simple order workflow:
//   Order Required -> Ordered -> Awaiting Delivery -> Partially Received -> Received
//
// POST                         raise an order (capability: order)
// PUT  { id, ...fields }       update status / supplier / quantity / dates (order)
// PUT  { id, action: "cancel" }                                          (order)
// PUT  { id, action: "receive", quantity, unitCost?, closeShort? }     (receive)
//      Books the delivered quantity into stock as a receipt, records the
//      purchase cost, and moves the order to Partially Received or Received.
//      `closeShort` marks it Received even though less arrived than ordered.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { STOCK_ROLES } from "@/features/stockControl/stockAccess";
import { OPEN_ORDER_STATUSES, findOpenOrder, formatQuantity, roundQuantity, toNumber } from "@/features/stockControl/stockModel";
import {
  createOrder,
  getItem,
  getOrder,
  isStockControlMigrationPending,
  listOrdersForItem,
  updateOrder,
} from "@/lib/database/stockControl";
import {
  actorFor,
  applyQuantityChange,
  methodNotAllowed,
  recordStockChange,
  requireCapability,
  sendServerError,
  sendValidation,
} from "@/lib/stockControl/stockApi";
import { UUID_RE, parseOrderInput, parseReceiptInput } from "@/lib/stockControl/stockInput";

const ORDERED_STATES = ["ordered", "awaiting_delivery", "partially_received"];

async function handleCreate(req, res, session) {
  if (!requireCapability(res, session, "order")) return;
  const { order, errors } = parseOrderInput(req.body || {}, { create: true });
  if (errors.length) {
    sendValidation(res, errors);
    return;
  }
  const item = await getItem(order.itemId);
  if (!item || item.archivedAt) {
    res.status(404).json({ success: false, message: "Stock item not found or archived." });
    return;
  }
  const existing = findOpenOrder(await listOrdersForItem(item.id, 10), item.id);
  if (existing) {
    res.status(409).json({ success: false, code: "stock_order_open", message: "This item already has an open order. Update it instead.", data: { order: existing } });
    return;
  }
  const actor = await actorFor(req, res, session);
  const created = await createOrder({
    ...order,
    supplier: order.supplier || item.preferredSupplier || null,
    supplierProductCode: order.supplierProductCode || item.supplierProductCode || null,
    unitCost: order.unitCost ?? item.unitCost ?? null,
    orderedAt: ORDERED_STATES.includes(order.status) ? new Date().toISOString() : null,
    createdBy: actor.actorUserId,
    updatedBy: actor.actorUserId,
  });
  await recordStockChange({
    actor,
    item,
    movement: {
      movementType: "order_raised",
      orderId: created.id,
      reason: `${formatQuantity(created.quantityOrdered, item)} ${created.status === "order_required" ? "requested" : "ordered"}${created.supplier ? ` from ${created.supplier}` : ""}`,
      notes: created.notes,
      detail: { status: created.status, reference: created.reference || null, expectedDelivery: created.expectedDelivery },
    },
    auditAction: "stock_order_raised",
  });
  res.status(201).json({ success: true, data: { order: created } });
}

async function handleReceive(req, res, session, order, item) {
  if (!requireCapability(res, session, "receive")) return;
  if (!ORDERED_STATES.includes(order.status) && order.status !== "order_required") {
    sendValidation(res, ["Only an open order can be received."]);
    return;
  }
  const { receipt, errors } = parseReceiptInput(req.body || {});
  if (errors.length) {
    sendValidation(res, errors);
    return;
  }
  const actor = await actorFor(req, res, session);
  const now = new Date().toISOString();
  const receivedTotal = roundQuantity((toNumber(order.quantityReceived) || 0) + receipt.quantity, 3);
  const complete = receipt.closeShort || receivedTotal >= (toNumber(order.quantityOrdered) || 0);
  const unitCost = receipt.unitCost ?? order.unitCost ?? null;
  const current = toNumber(item.currentQuantity);

  const updatedOrder = await updateOrder(order.id, {
    quantityReceived: receivedTotal,
    status: complete ? "received" : "partially_received",
    receivedAt: complete ? now : null,
    orderedAt: order.orderedAt || now,
    unitCost,
    updatedBy: actor.actorUserId,
  });
  const result = await applyQuantityChange({
    actor,
    item,
    // An item with no recorded quantity starts from the delivery itself.
    quantity: (current ?? 0) + receipt.quantity,
    movementType: "receipt",
    itemPatch: {
      lastToppedUp: now,
      ...(item.measurementMode === "tank" ? { lastFilledAt: now } : {}),
      ...(unitCost !== null ? { unitCost } : {}),
    },
    movement: {
      orderId: order.id,
      unitCost,
      reason: complete
        ? receivedTotal < (toNumber(order.quantityOrdered) || 0) ? "Delivery received (closed short)" : "Delivery received"
        : "Part delivery received",
      notes: receipt.notes,
      detail: {
        outstanding: Math.max(0, roundQuantity((toNumber(order.quantityOrdered) || 0) - receivedTotal, 3)),
        supplier: order.supplier || null,
        reference: order.reference || null,
      },
    },
  });
  res.status(200).json({ success: true, data: { order: updatedOrder, item: result.item } });
}

async function handleUpdate(req, res, session, order, item) {
  if (!requireCapability(res, session, "order")) return;
  const actor = await actorFor(req, res, session);
  if (req.body?.action === "cancel") {
    if (!OPEN_ORDER_STATUSES.includes(order.status)) {
      sendValidation(res, ["Only an open order can be cancelled."]);
      return;
    }
    const cancelled = await updateOrder(order.id, { status: "cancelled", updatedBy: actor.actorUserId });
    await recordStockChange({
      actor,
      item,
      movement: { movementType: "order_cancelled", orderId: order.id, reason: String(req.body?.reason || "").slice(0, 200) || "Order cancelled" },
      auditAction: "stock_order_cancelled",
    });
    res.status(200).json({ success: true, data: { order: cancelled } });
    return;
  }

  const { order: patch, errors } = parseOrderInput(req.body || {});
  if (errors.length) {
    sendValidation(res, errors);
    return;
  }
  if (patch.status && ["received", "partially_received"].includes(patch.status)) {
    sendValidation(res, ["Use Mark Received to book a delivery in, so the stock is updated."]);
    return;
  }
  if (patch.status === "cancelled") {
    sendValidation(res, ["Use Cancel order to cancel."]);
    return;
  }
  if (!OPEN_ORDER_STATUSES.includes(order.status)) {
    sendValidation(res, ["This order is closed and can no longer be changed."]);
    return;
  }
  if (patch.quantityOrdered !== undefined && patch.quantityOrdered !== null && patch.quantityOrdered < order.quantityReceived) {
    sendValidation(res, ["The order quantity cannot be less than what has already been received."]);
    return;
  }
  if (patch.status && ORDERED_STATES.includes(patch.status) && !order.orderedAt) patch.orderedAt = new Date().toISOString();
  // A new expected date re-arms the late-delivery alert.
  if (patch.expectedDelivery !== undefined && patch.expectedDelivery !== order.expectedDelivery) patch.delayAlertedAt = null;

  const updated = await updateOrder(order.id, { ...patch, updatedBy: actor.actorUserId });
  const statusChanged = patch.status && patch.status !== order.status;
  await recordStockChange({
    actor,
    item,
    movement: {
      movementType: "order_updated",
      orderId: order.id,
      reason: statusChanged ? `Order ${updated.status.replace(/_/g, " ")}` : "Order details updated",
      notes: patch.notes,
      detail: { from: order.status, to: updated.status, reference: updated.reference || null, expectedDelivery: updated.expectedDelivery },
    },
    auditAction: "stock_order_updated",
    before: order,
    after: updated,
  });
  res.status(200).json({ success: true, data: { order: updated } });
}

async function handler(req, res, session) {
  try {
    if (await isStockControlMigrationPending()) {
      res.status(409).json({ success: false, message: "Stock control needs its database migration before orders can be used." });
      return;
    }
    if (req.method === "POST") return await handleCreate(req, res, session);
    if (req.method !== "PUT") {
      methodNotAllowed(res, "POST, PUT");
      return;
    }
    const id = String(req.body?.id || "");
    if (!UUID_RE.test(id)) {
      sendValidation(res, ["A valid order id is required."]);
      return;
    }
    const order = await getOrder(id);
    const item = order ? await getItem(order.itemId) : null;
    if (!order || !item) {
      res.status(404).json({ success: false, message: "Order not found." });
      return;
    }
    if (req.body?.action === "receive") return await handleReceive(req, res, session, order, item);
    return await handleUpdate(req, res, session, order, item);
  } catch (error) {
    sendServerError(res, error, "Unable to update the stock order");
  }
}

export default withRoleGuard(handler, { allow: STOCK_ROLES });
