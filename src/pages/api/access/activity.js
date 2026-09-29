// file location: src/pages/api/access/activity.js
//
// GET the store's stock ledger, newest first (capability: manage).
// Query: store (required), action, itemId, userId, days (default 7, max 365).

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { ANY_STORE_MANAGER_ROLES } from "@/features/stockAccess/stockAccessPermissions";
import { ACTION_META } from "@/features/stockAccess/stockAccessModel";
import { listActivity } from "@/lib/database/stockAccess";
import { methodNotAllowed, refuseIfMigrationPending, requireCapability, resolveStore, sendError } from "@/lib/stockAccess/stockAccessApi";
import { uuidOrNull } from "@/lib/stockAccess/stockAccessInput";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function handler(req, res, session) {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }
  const store = resolveStore(req, res);
  if (!store) return;
  if (!requireCapability(res, session, "manage", store)) return;
  try {
    if (await refuseIfMigrationPending(res)) return;
    const days = Math.min(365, Math.max(1, Number.parseInt(req.query.days, 10) || 7));
    const userId = Number.parseInt(req.query.userId, 10);
    const transactions = await listActivity({
      storeKey: store.key,
      action: Object.prototype.hasOwnProperty.call(ACTION_META, req.query.action) ? req.query.action : null,
      itemId: uuidOrNull(req.query.itemId),
      userId: Number.isFinite(userId) && userId > 0 ? userId : null,
      sinceIso: new Date(Date.now() - days * MS_PER_DAY).toISOString(),
      limit: 500,
    });
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).json({ success: true, data: { transactions, days } });
  } catch (error) {
    sendError(res, error, "Unable to load stock activity");
  }
}

export default withRoleGuard(handler, { allow: ANY_STORE_MANAGER_ROLES });
