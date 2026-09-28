// file location: src/pages/api/access/transactions.js
//
// POST one stock movement in a store (body.store = the store key; the item
// must belong to it). The pure model decides what the action means
// (planTransaction); stock_access_apply() applies it atomically and appends
// the ledger row. Capability per action:
//
//   take_out / return / consume        transact      (the /access screen)
//   receive (optionally a restock)     processRestock
//   adjustment (reason required)       adjust
//   mark_missing / found / write_off   manageCustody
//   allowNegative (reason required)    overrideNegative
//
// `clientRequestId` makes the call idempotent: a double tap or a retry returns
// the original transaction with `duplicate: true` instead of booking twice.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { ANY_STORE_USER_ROLES } from "@/features/stockAccess/stockAccessPermissions";
import { ACTION_META, formatQuantity, planTransaction } from "@/features/stockAccess/stockAccessModel";
import { applyTransaction, getCheckout, getItem, listCheckoutsForItem } from "@/lib/database/stockAccess";
import {
  actorFor,
  alertsForChange,
  audit,
  methodNotAllowed,
  notify,
  redactCosts,
  refuseIfMigrationPending,
  requireCapability,
  resolveStore,
  sendError,
  sendValidation,
} from "@/lib/stockAccess/stockAccessApi";
import { parseTransactionInput } from "@/lib/stockAccess/stockAccessInput";

const CAPABILITY_FOR = {
  take_out: "transact",
  return: "transact",
  consume: "transact",
  receive: "processRestock",
  adjustment: "adjust",
  mark_missing: "manageCustody",
  found: "manageCustody",
  write_off: "manageCustody",
};

async function handler(req, res, session) {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }
  try {
    const { input, errors } = parseTransactionInput(req.body || {});
    if (errors.length) {
      sendValidation(res, errors);
      return;
    }
    const store = resolveStore(req, res);
    if (!store) return;
    const capabilities = requireCapability(res, session, CAPABILITY_FOR[input.action], store);
    if (!capabilities) return;
    if (input.allowNegative) {
      if (!capabilities.overrideNegative) {
        res.status(403).json({ success: false, message: "Only Parts, managers and admin can record stock below zero." });
        return;
      }
      if (!input.reason) {
        sendValidation(res, ["Give a reason for the override."]);
        return;
      }
    }
    if (await refuseIfMigrationPending(res)) return;

    const item = await getItem(input.itemId);
    if (!item || item.storeKey !== store.key) {
      res.status(404).json({ success: false, message: "Stock item not found." });
      return;
    }
    let checkout = null;
    if (input.checkoutId) {
      checkout = await getCheckout(input.checkoutId);
      if (!checkout || checkout.itemId !== item.id) {
        res.status(404).json({ success: false, message: "That checkout record was not found for this item." });
        return;
      }
    }
    const actor = await actorFor(req, res, session);

    const plan = planTransaction({
      action: input.action,
      item,
      quantity: input.quantity,
      mode: input.mode,
      checkout,
      allowNegative: input.allowNegative,
      reason: input.reason,
      holder: { userId: actor.userId, name: actor.name },
    });
    if (plan.errors.length) {
      // A shortage is a 409 with a code, so the page can offer the override
      // to roles that hold it; everything else is a plain validation error.
      if (plan.negative) {
        res.status(409).json({ success: false, code: "negative", canOverride: capabilities.overrideNegative, message: plan.errors[0] });
        return;
      }
      sendValidation(res, plan.errors);
      return;
    }

    const warnings = [...plan.warnings];
    if (plan.action === "take_out" && actor.userId !== null) {
      const alreadyHeld = (await listCheckoutsForItem(item.id, 50)).filter(
        (entry) => entry.status === "out" && entry.holderUserId === actor.userId
      );
      if (alreadyHeld.length) warnings.push("You already have this item out — this records another one.");
    }
    if (plan.action === "take_out" && plan.checkoutOp) {
      plan.checkoutOp.job_number = input.jobNumber || null;
      plan.checkoutOp.vehicle_reg = input.vehicleReg || null;
      plan.checkoutOp.notes = input.notes || null;
    }
    const onBehalfOf =
      input.action === "return" && checkout && checkout.holderUserId !== actor.userId ? checkout.holderName : null;

    const result = await applyTransaction({
      itemId: item.id,
      action: plan.action,
      quantityDelta: plan.quantityDelta,
      checkedOutDelta: plan.checkedOutDelta,
      allowNegative: input.allowNegative && plan.negative,
      checkoutOp: plan.checkoutOp,
      restockOp: input.action === "receive" && input.restockRequestId ? { request_id: input.restockRequestId, quantity: input.quantity } : null,
      entry: {
        ...plan.entry,
        user_id: actor.userId,
        user_name: actor.name,
        job_number: input.jobNumber,
        vehicle_reg: input.vehicleReg,
        reason: input.reason || (input.action === "return" && !checkout ? "Returned unused" : ""),
        notes: input.notes,
        client_request_id: input.clientRequestId,
        detail: {
          ...(onBehalfOf ? { onBehalfOf } : {}),
          ...(input.action === "adjustment" ? { mode: input.mode } : {}),
          ...(plan.action !== input.action ? { requestedAction: input.action } : {}),
        },
      },
    });

    if (!result.duplicate) {
      const override = result.transaction?.overrideNegative === true;
      await audit(actor, {
        action: `stock_access_${plan.action}`,
        entityId: item.id,
        reason: input.reason || null,
        beforeData: { current_quantity: item.currentQuantity, checked_out_quantity: item.checkedOutQuantity },
        afterData: { current_quantity: result.item.currentQuantity, checked_out_quantity: result.item.checkedOutQuantity, override_negative: override },
      });
      await notify(alertsForChange({ before: item, after: result.item, actor, override, reason: input.reason }));
    }

    const verb = ACTION_META[plan.action]?.past || "Recorded";
    res.status(result.duplicate ? 200 : 201).json({
      success: true,
      data: {
        duplicate: result.duplicate,
        message: result.duplicate
          ? "Already recorded — that submission was received once."
          : `${verb}: ${plan.entry.quantity ? `${formatQuantity(plan.entry.quantity, item)} × ` : ""}${item.name}`,
        warnings: result.duplicate ? [] : warnings,
        item: redactCosts(result.item, capabilities),
        transaction: result.transaction,
        checkout: result.checkout,
        restock: result.restock,
      },
    });
  } catch (error) {
    sendError(res, error, "Unable to record the stock movement");
  }
}

export default withRoleGuard(handler, { allow: ANY_STORE_USER_ROLES });
