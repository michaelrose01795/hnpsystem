// file location: src/pages/api/tracking/stock/movements.js
//
// POST one stock action against an item. Physical checks and stock movements
// are deliberately different things:
//
//   check          what is physically there now (count, level band or dipstick).
//                  Sets the quantity; any difference from the record is booked
//                  as the check's variance and resets the check schedule.
//   stock_in       stock added outside an order (capability: receive)
//   stock_out      stock used / removed, optionally against a job (capability: use)
//   adjustment     audited correction with a mandatory reason (capability: adjust)
//   request_order  flag the item Order Required for Parts (capability: requestOrder)

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { STOCK_ROLES } from "@/features/stockControl/stockAccess";
import { findOpenOrder, resolveCheckReading, suggestReplenishment, toNumber } from "@/features/stockControl/stockModel";
import { createOrder, getItem, isStockControlMigrationPending, listOrdersForItem } from "@/lib/database/stockControl";
import {
  actorFor,
  applyQuantityChange,
  methodNotAllowed,
  notify,
  recordStockChange,
  requireCapability,
  sendServerError,
  sendValidation,
} from "@/lib/stockControl/stockApi";
import { parseMovementInput } from "@/lib/stockControl/stockInput";

const CAPABILITY_FOR = {
  check: "check",
  stock_in: "receive",
  stock_out: "use",
  adjustment: "adjust",
  request_order: "requestOrder",
};

async function handleRequestOrder(req, res, actor, item, input) {
  const orders = await listOrdersForItem(item.id, 10);
  const open = findOpenOrder(orders, item.id);
  if (open) {
    res.status(409).json({ success: false, message: "This item already has an open order.", data: { order: open } });
    return;
  }
  const suggestion = suggestReplenishment(item);
  const order = await createOrder({
    itemId: item.id,
    status: "order_required",
    supplier: item.preferredSupplier || null,
    supplierProductCode: item.supplierProductCode || null,
    quantityOrdered: suggestion.quantity || toNumber(item.reorderQuantity) || 0,
    unitCost: item.unitCost ?? null,
    notes: input.notes || null,
    createdBy: actor.actorUserId,
    updatedBy: actor.actorUserId,
  });
  await recordStockChange({
    actor,
    item,
    movement: { movementType: "order_raised", orderId: order.id, reason: "Order requested", notes: input.notes },
    auditAction: "stock_order_requested",
  });
  await notify([{ targetRole: "Parts", message: `Order requested: ${item.title} by ${actor.actorName || "the workshop"}.` }]);
  res.status(201).json({ success: true, data: { item, order } });
}

async function handler(req, res, session) {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }
  try {
    const { input, errors } = parseMovementInput(req.body || {});
    if (errors.length) {
      sendValidation(res, errors);
      return;
    }
    if (!requireCapability(res, session, CAPABILITY_FOR[input.type])) return;
    if (await isStockControlMigrationPending()) {
      res.status(409).json({ success: false, message: "Stock control needs its database migration before stock can be recorded." });
      return;
    }
    const item = await getItem(input.itemId);
    if (!item) {
      res.status(404).json({ success: false, message: "Stock item not found." });
      return;
    }
    if (item.archivedAt) {
      res.status(409).json({ success: false, message: "This item is archived. Restore it before recording stock." });
      return;
    }
    const actor = await actorFor(req, res, session);

    if (input.type === "request_order") {
      await handleRequestOrder(req, res, actor, item, input);
      return;
    }

    const current = toNumber(item.currentQuantity);
    const common = { reason: input.reason, jobNumber: input.jobNumber, notes: input.notes };
    let result;

    if (input.type === "check") {
      const reading = resolveCheckReading(item, input);
      if (reading.error) {
        sendValidation(res, [reading.error]);
        return;
      }
      result = await applyQuantityChange({
        actor,
        item,
        quantity: reading.quantity,
        movementType: "check",
        isCheck: true,
        itemPatch: {
          ...(reading.levelBand !== undefined ? { levelBand: reading.levelBand } : {}),
          ...(reading.dipstickReading !== null && reading.dipstickReading !== undefined ? { dipstickReading: reading.dipstickReading } : {}),
        },
        movement: { ...common, reason: common.reason || "Physical check", dipstickReading: reading.dipstickReading ?? null, detail: reading.detail || {} },
      });
    } else {
      if (current === null) {
        sendValidation(res, ["This item has no recorded quantity yet. Record a check first."]);
        return;
      }
      if (input.type === "stock_in") {
        const now = new Date().toISOString();
        result = await applyQuantityChange({
          actor,
          item,
          quantity: current + input.quantity,
          movementType: "stock_in",
          itemPatch: {
            lastToppedUp: now,
            ...(item.measurementMode === "tank" ? { lastFilledAt: now } : {}),
            ...(input.unitCost !== null ? { unitCost: input.unitCost } : {}),
          },
          movement: { ...common, unitCost: input.unitCost },
        });
      } else if (input.type === "stock_out") {
        const clamped = input.quantity > current;
        result = await applyQuantityChange({
          actor,
          item,
          quantity: current - input.quantity,
          movementType: "stock_out",
          movement: { ...common, detail: clamped ? { requested: input.quantity, clampedToZero: true } : {} },
        });
      } else {
        const next = input.mode === "set" ? input.quantity : current + input.delta;
        if (next < 0) {
          sendValidation(res, ["An adjustment cannot take the quantity below zero."]);
          return;
        }
        result = await applyQuantityChange({ actor, item, quantity: next, movementType: "adjustment", movement: common });
      }
    }
    res.status(200).json({ success: true, data: { item: result.item, movement: result.movement } });
  } catch (error) {
    sendServerError(res, error, "Unable to record the stock action");
  }
}

export default withRoleGuard(handler, { allow: STOCK_ROLES });
