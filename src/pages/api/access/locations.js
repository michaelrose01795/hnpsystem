// file location: src/pages/api/access/locations.js
//
// POST { store, ... } — add or edit a storage location in a store (capability: manage). Locations carry a
// department so more sites and departments need no schema change. Retiring a
// location (isActive false) keeps it on existing items and history.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { ANY_STORE_MANAGER_ROLES } from "@/features/stockAccess/stockAccessPermissions";
import { saveLocation } from "@/lib/database/stockAccess";
import {
  actorFor,
  audit,
  methodNotAllowed,
  refuseIfMigrationPending,
  requireCapability,
  resolveStore,
  sendError,
  sendValidation,
} from "@/lib/stockAccess/stockAccessApi";
import { parseLocationInput } from "@/lib/stockAccess/stockAccessInput";

async function handler(req, res, session) {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }
  const store = resolveStore(req, res);
  if (!store) return;
  if (!requireCapability(res, session, "manage", store)) return;
  try {
    if (await refuseIfMigrationPending(res)) return;
    const { input, errors } = parseLocationInput(req.body || {});
    if (errors.length) {
      sendValidation(res, errors);
      return;
    }
    const actor = await actorFor(req, res, session);
    const location = await saveLocation({ ...input, storeKey: store.key });
    await audit(actor, { action: input.id ? "stock_access_location_edited" : "stock_access_location_created", entityType: "stock_access_location", entityId: location.id, afterData: location });
    res.status(input.id ? 200 : 201).json({ success: true, data: { location } });
  } catch (error) {
    if (String(error?.cause?.code) === "23505") {
      res.status(409).json({ success: false, message: "A location with that name already exists." });
      return;
    }
    sendError(res, error, "Unable to save the location");
  }
}

export default withRoleGuard(handler, { allow: ANY_STORE_MANAGER_ROLES });
