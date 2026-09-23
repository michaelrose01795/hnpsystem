// file location: src/pages/api/tracking/stock/index.js
//
// GET  the stock tracker in one request: items (with usage trend and last
//      checker), open orders, categories, locations, suppliers and what the
//      caller's role may do. Also raises the lazy time-based alerts.
// POST create an item (capability: manage).

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { STOCK_ROLES } from "@/features/stockControl/stockAccess";
import { USAGE_WINDOW_DAYS, collectSuppliers, summariseUsage } from "@/features/stockControl/stockModel";
import {
  createItem,
  findActiveDuplicate,
  findItemByCode,
  isStockControlMigrationPending,
  listCategories,
  listItems,
  listLocations,
  listMovementsSince,
  listOpenOrders,
} from "@/lib/database/stockControl";
import {
  actorFor,
  bandForQuantity,
  capabilitiesFor,
  methodNotAllowed,
  recordStockChange,
  redactCosts,
  requireCapability,
  sendServerError,
  sendValidation,
  sweepTimeAlerts,
} from "@/lib/stockControl/stockApi";
import { parseItemInput } from "@/lib/stockControl/stockInput";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function handleList(req, res, session) {
  const capabilities = capabilitiesFor(session);
  if (!capabilities.view) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return;
  }
  // One round trip, not three. The migration probe, the items and everything
  // else used to run as three sequential stages; they are independent reads,
  // so they now run together. While the migration is pending the newer tables
  // may not exist, so the dependent reads are allowed to fail and are only
  // surfaced once the probe says the migration is in.
  const now = new Date();
  const since = new Date(now.getTime() - USAGE_WINDOW_DAYS * MS_PER_DAY).toISOString();
  const [migrationPending, items, dependent] = await Promise.all([
    isStockControlMigrationPending(),
    listItems(),
    Promise.all([listOpenOrders(), listCategories(), listLocations(), listMovementsSince(since)]).then(
      (results) => ({ results }),
      (error) => ({ error })
    ),
  ]);

  if (migrationPending) {
    // Read-only until the migration is applied: the existing items still show.
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).json({
      success: true,
      data: {
        items: items.map((item) => redactCosts(item, capabilities)),
        orders: [],
        categories: [],
        locations: [],
        suppliers: [],
        capabilities: { ...capabilities, check: false, use: false, requestOrder: false, receive: false, order: false, adjust: false, stocktake: false, manage: false, archive: false, configure: false },
        migrationPending: true,
      },
    });
    return;
  }

  if (dependent.error) throw dependent.error;
  const [orders, categories, locations, movements] = dependent.results;

  // Who last checked each item comes from the same movement window the usage
  // trend reads (check and stocktake rows are part of it), rather than from a
  // second query over the same table. Movements arrive oldest first, so the
  // last check seen per item is its latest.
  const movementsByItem = new Map();
  const checkers = new Map();
  movements.forEach((movement) => {
    if (!movementsByItem.has(movement.itemId)) movementsByItem.set(movement.itemId, []);
    movementsByItem.get(movement.itemId).push(movement);
    if (movement.movementType === "check" || movement.movementType === "stocktake") {
      checkers.set(movement.itemId, movement.actorName || null);
    }
  });

  await sweepTimeAlerts({ items, orders, now });

  const enriched = items.map((item) =>
    redactCosts(
      {
        ...item,
        usage: summariseUsage(movementsByItem.get(item.id) || [], item, now),
        lastCheckedByName: checkers.get(item.id) || null,
      },
      capabilities
    )
  );

  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).json({
    success: true,
    data: {
      items: enriched,
      orders: orders.map((order) => redactCosts(order, capabilities)),
      categories,
      locations,
      suppliers: collectSuppliers(items, orders),
      capabilities,
      migrationPending: false,
    },
  });
}

async function handleCreate(req, res, session) {
  if (!requireCapability(res, session, "manage")) return;
  if (await isStockControlMigrationPending()) {
    res.status(409).json({ success: false, message: "Stock control needs its database migration before items can be added." });
    return;
  }
  const { item, errors } = parseItemInput(req.body || {}, { create: true });
  if (errors.length) {
    sendValidation(res, errors);
    return;
  }

  const duplicate = await findActiveDuplicate({ title: item.title, locationId: item.locationId });
  if (duplicate) {
    res.status(409).json({
      success: false,
      code: "stock_duplicate",
      duplicateId: duplicate.id,
      message: `"${duplicate.title}" already exists at this location. Update that item instead, or choose a different location.`,
    });
    return;
  }
  const codeClash = await findItemByCode({ stockCode: item.stockCode, barcode: item.barcode });
  if (codeClash) {
    res.status(409).json({
      success: false,
      code: "stock_code_in_use",
      duplicateId: codeClash.id,
      message: `That stock ID or barcode is already used by "${codeClash.title}".`,
    });
    return;
  }

  const actor = await actorFor(req, res, session);
  const now = new Date();
  const initialQuantity = item.currentQuantity ?? null;
  const created = await createItem({
    ...item,
    levelBand: item.levelBand || bandForQuantity(item, initialQuantity),
    lastCheck: initialQuantity !== null || item.levelBand ? now.toISOString() : null,
    nextCheck: item.intervalDays ? new Date(now.getTime() + item.intervalDays * MS_PER_DAY).toISOString() : null,
    createdBy: actor.actorUserId,
    updatedBy: actor.actorUserId,
  });
  await recordStockChange({
    actor,
    item: created,
    movement: {
      movementType: "created",
      quantityAfter: initialQuantity,
      levelBand: created.levelBand,
      reason: "Item created",
    },
    auditAction: "stock_item_created",
  });
  res.status(201).json({ success: true, data: created });
}

async function handler(req, res, session) {
  try {
    if (req.method === "GET") return await handleList(req, res, session);
    if (req.method === "POST") return await handleCreate(req, res, session);
    methodNotAllowed(res, "GET, POST");
  } catch (error) {
    sendServerError(res, error, "Unable to load stock control");
  }
}

export default withRoleGuard(handler, { allow: STOCK_ROLES });
