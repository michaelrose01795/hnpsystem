// file location: src/pages/api/access/index.js
//
// GET ?store=<key> — one store's quick screen (/access/<store>) in one request:
// active items, open checkouts (who holds what), open restock requests,
// locations, the caller's recent items, the store's most-used items and what
// the caller's role may do there.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { ANY_STORE_USER_ROLES } from "@/features/stockAccess/stockAccessPermissions";
import { rankByUse, recentItemIds } from "@/features/stockAccess/stockAccessModel";
import {
  isStockAccessMigrationPending,
  listItems,
  listLocations,
  listMovementsSince,
  listOpenCheckouts,
  listRestockRequests,
} from "@/lib/database/stockAccess";
import { actorFor, capabilitiesFor, methodNotAllowed, redactCosts, resolveStore, sendError } from "@/lib/stockAccess/stockAccessApi";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RANKING_WINDOW_DAYS = 30;

async function handler(req, res, session) {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }
  const store = resolveStore(req, res);
  if (!store) return;
  const capabilities = capabilitiesFor(session, store);
  if (!capabilities.view) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const actor = await actorFor(req, res, session);
    const empty = { items: [], checkouts: [], restock: [], locations: [], recentItemIds: [], commonItemIds: [] };
    if (await isStockAccessMigrationPending()) {
      res.status(200).json({ success: true, data: { ...empty, userId: actor.userId, capabilities, migrationPending: true } });
      return;
    }
    const since = new Date(Date.now() - RANKING_WINDOW_DAYS * MS_PER_DAY).toISOString();
    const [items, locations, movements] = await Promise.all([
      listItems({ storeKey: store.key }),
      listLocations(store.key),
      listMovementsSince(since, { storeKey: store.key }),
    ]);
    const itemIds = items.map((item) => item.id);
    const [checkouts, restock] = await Promise.all([
      listOpenCheckouts(itemIds),
      listRestockRequests({ itemIds, openOnly: true }),
    ]);
    const mine = actor.userId === null ? [] : movements.filter((tx) => tx.userId === actor.userId);
    res.status(200).json({
      success: true,
      data: {
        items: items.map((item) => redactCosts(item, capabilities)),
        checkouts,
        restock,
        locations,
        recentItemIds: recentItemIds(mine),
        commonItemIds: rankByUse(movements),
        userId: actor.userId,
        capabilities,
        migrationPending: false,
      },
    });
  } catch (error) {
    sendError(res, error, "Unable to load Stock Access");
  }
}

export default withRoleGuard(handler, { allow: ANY_STORE_USER_ROLES });
