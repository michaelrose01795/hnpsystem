// file location: src/pages/api/tracking/stock/stocktakes.js
//
// The guided stocktake (capability: stocktake). One POST per step:
//
//   { action: "start", scopeType: "all" | "location" | "category", scopeId? }
//        -> the run, plus the ordered item ids to walk through
//   { action: "count", stocktakeId, itemId, quantity? | levelBand? | dipstickReading?, notes? }
//        -> books the counted amount as a `stocktake` movement. The difference
//           from the recorded quantity is the audited variance; significant
//           variances notify management (see applyQuantityChange).
//   { action: "complete" | "abandon", stocktakeId }

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { STOCK_ROLES } from "@/features/stockControl/stockAccess";
import { LEVEL_BANDS, resolveCheckReading, toNumber } from "@/features/stockControl/stockModel";
import {
  createStocktake,
  getItem,
  getStocktake,
  isStockControlMigrationPending,
  listCategories,
  listItems,
  listLocations,
  listStocktakeMovements,
  updateStocktake,
} from "@/lib/database/stockControl";
import {
  actorFor,
  applyQuantityChange,
  methodNotAllowed,
  requireCapability,
  sendServerError,
  sendValidation,
} from "@/lib/stockControl/stockApi";
import { UUID_RE, quantity as parseQuantity, text } from "@/lib/stockControl/stockInput";

async function handleStart(req, res, actor) {
  const scopeType = ["location", "category"].includes(req.body?.scopeType) ? req.body.scopeType : "all";
  const scopeId = scopeType === "all" ? null : String(req.body?.scopeId || "");
  if (scopeType !== "all" && !UUID_RE.test(scopeId)) {
    sendValidation(res, [`Choose a ${scopeType} to count.`]);
    return;
  }
  const [items, categories, locations] = await Promise.all([listItems(), listCategories(), listLocations()]);
  const scoped = items
    .filter((item) => !item.archivedAt)
    .filter((item) => scopeType === "all" || (scopeType === "location" ? item.locationId === scopeId : item.categoryId === scopeId));
  if (!scoped.length) {
    sendValidation(res, ["There are no active items in that selection."]);
    return;
  }
  // Walk shelf by shelf: location, then name — the order someone would count in.
  const locationOrder = new Map(locations.map((location, index) => [location.id, index]));
  scoped.sort(
    (a, b) =>
      (locationOrder.get(a.locationId) ?? 999) - (locationOrder.get(b.locationId) ?? 999) ||
      a.title.localeCompare(b.title, "en-GB", { sensitivity: "base" })
  );
  const scopeLabel =
    scopeType === "all"
      ? "All stock"
      : (scopeType === "location" ? locations : categories).find((entry) => entry.id === scopeId)?.name || scopeType;
  const stocktake = await createStocktake({ scopeType, scopeId, scopeLabel, itemCount: scoped.length, startedBy: actor.actorUserId });
  res.status(201).json({ success: true, data: { stocktake, itemIds: scoped.map((item) => item.id) } });
}

async function refreshTotals(stocktakeId) {
  const counts = await listStocktakeMovements(stocktakeId);
  const latestByItem = new Map();
  counts.forEach((movement) => latestByItem.set(movement.itemId, movement));
  let varianceCount = 0;
  let varianceValue = 0;
  let hasValue = false;
  latestByItem.forEach((movement) => {
    const delta = toNumber(movement.quantityDelta) || 0;
    if (delta !== 0) varianceCount += 1;
    const cost = toNumber(movement.detail?.unitCost);
    if (cost !== null) {
      varianceValue += delta * cost;
      hasValue = true;
    }
  });
  return updateStocktake(stocktakeId, {
    countedCount: latestByItem.size,
    varianceCount,
    varianceValue: hasValue ? Math.round(varianceValue * 100) / 100 : null,
  });
}

async function handleCount(req, res, actor, stocktake) {
  const itemId = String(req.body?.itemId || "");
  if (!UUID_RE.test(itemId)) {
    sendValidation(res, ["A stock item is required."]);
    return;
  }
  const item = await getItem(itemId);
  if (!item || item.archivedAt) {
    res.status(404).json({ success: false, message: "Stock item not found or archived." });
    return;
  }
  const errors = [];
  const input = {
    quantity: parseQuantity(req.body?.quantity, "Counted quantity", errors),
    levelBand: LEVEL_BANDS.some((band) => band.value === req.body?.levelBand) ? req.body.levelBand : null,
    dipstickReading: parseQuantity(req.body?.dipstickReading, "Dipstick reading", errors),
  };
  if (errors.length) {
    sendValidation(res, errors);
    return;
  }
  const reading = resolveCheckReading(item, input);
  if (reading.error) {
    sendValidation(res, [reading.error]);
    return;
  }
  const result = await applyQuantityChange({
    actor,
    item,
    quantity: reading.quantity,
    movementType: "stocktake",
    isCheck: true,
    itemPatch: {
      ...(reading.levelBand !== undefined ? { levelBand: reading.levelBand } : {}),
      ...(reading.dipstickReading !== null && reading.dipstickReading !== undefined ? { dipstickReading: reading.dipstickReading } : {}),
    },
    movement: {
      stocktakeId: stocktake.id,
      reason: `Stocktake — ${stocktake.scopeLabel || "stock"}`,
      notes: text(req.body?.notes, 1000),
      dipstickReading: reading.dipstickReading ?? null,
      // Cost at count time, so the run's variance value survives later price changes.
      detail: { ...(reading.detail || {}), unitCost: item.unitCost ?? null },
    },
  });
  const updated = await refreshTotals(stocktake.id);
  res.status(200).json({ success: true, data: { item: result.item, movement: result.movement, stocktake: updated } });
}

async function handler(req, res, session) {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }
  if (!requireCapability(res, session, "stocktake")) return;
  try {
    if (await isStockControlMigrationPending()) {
      res.status(409).json({ success: false, message: "Stock control needs its database migration before a stocktake can run." });
      return;
    }
    const actor = await actorFor(req, res, session);
    const action = req.body?.action;
    if (action === "start") return await handleStart(req, res, actor);

    const stocktakeId = String(req.body?.stocktakeId || "");
    const stocktake = UUID_RE.test(stocktakeId) ? await getStocktake(stocktakeId) : null;
    if (!stocktake) {
      res.status(404).json({ success: false, message: "Stocktake not found." });
      return;
    }
    if (stocktake.status !== "in_progress") {
      sendValidation(res, ["This stocktake has already finished."]);
      return;
    }
    if (action === "count") return await handleCount(req, res, actor, stocktake);
    if (action === "complete" || action === "abandon") {
      const updated = await updateStocktake(stocktake.id, {
        status: action === "complete" ? "completed" : "abandoned",
        completedAt: new Date().toISOString(),
        notes: text(req.body?.notes, 1000) || undefined,
      });
      res.status(200).json({ success: true, data: { stocktake: updated } });
      return;
    }
    sendValidation(res, ["Unknown stocktake action."]);
  } catch (error) {
    sendServerError(res, error, "Unable to update the stocktake");
  }
}

export default withRoleGuard(handler, { allow: STOCK_ROLES });
