// file location: src/pages/api/tracking/stock/settings.js
//
// POST add or change a stock category or location (capability: configure).
//   { kind: "category" | "location", id?, name?, department?, isActive?, sortOrder? }
// Entries are retired (isActive: false), never deleted, so historic items and
// movements keep their category / location for reporting.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { STOCK_ROLES } from "@/features/stockControl/stockAccess";
import { isStockControlMigrationPending, listCategories, listLocations, saveTaxonomyEntry } from "@/lib/database/stockControl";
import { actorFor, methodNotAllowed, requireCapability, sendServerError, sendValidation } from "@/lib/stockControl/stockApi";
import { UUID_RE, text } from "@/lib/stockControl/stockInput";

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

async function handler(req, res, session) {
  if (req.method !== "POST") {
    methodNotAllowed(res, "POST");
    return;
  }
  if (!requireCapability(res, session, "configure")) return;
  try {
    if (await isStockControlMigrationPending()) {
      res.status(409).json({ success: false, message: "Stock control needs its database migration first." });
      return;
    }
    const kind = req.body?.kind === "location" ? "location" : req.body?.kind === "category" ? "category" : null;
    if (!kind) {
      sendValidation(res, ["Choose categories or locations."]);
      return;
    }
    const id = req.body?.id ? String(req.body.id) : null;
    if (id && !UUID_RE.test(id)) {
      sendValidation(res, ["Invalid entry."]);
      return;
    }
    const name = req.body?.name !== undefined ? text(req.body.name, 60) : undefined;
    if (!id && !name) {
      sendValidation(res, ["A name is required."]);
      return;
    }
    if (name !== undefined && !name) {
      sendValidation(res, ["A name is required."]);
      return;
    }

    const existing = kind === "category" ? await listCategories() : await listLocations();
    if (name && existing.some((entry) => entry.id !== id && entry.name.toLowerCase() === name.toLowerCase())) {
      sendValidation(res, [`A ${kind} called "${name}" already exists.`]);
      return;
    }
    let key;
    if (!id) {
      const base = slugify(name) || kind;
      key = base;
      let suffix = 2;
      while (existing.some((entry) => entry.key === key)) key = `${base}-${suffix++}`;
    }

    const saved = await saveTaxonomyEntry(kind, {
      id,
      key,
      name,
      department: req.body?.department !== undefined ? text(req.body.department, 60) : undefined,
      isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined,
      sortOrder: Number.isInteger(req.body?.sortOrder) ? req.body.sortOrder : id ? undefined : (existing.length + 1) * 10,
    });
    const actor = await actorFor(req, res, session);
    await writeAuditLog({
      ...actor.auditContext,
      action: id ? `stock_${kind}_updated` : `stock_${kind}_created`,
      entityType: `stock_${kind}`,
      entityId: saved.id,
      reason: saved.name,
    });
    res.status(200).json({ success: true, data: saved });
  } catch (error) {
    sendServerError(res, error, "Unable to save the stock setting");
  }
}

export default withRoleGuard(handler, { allow: STOCK_ROLES });
