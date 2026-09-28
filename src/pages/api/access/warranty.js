// file location: src/pages/api/access/warranty.js
//
// GET  ?store=<key> — the store's warranty storage — every record for manageWarranty roles, the parts
//      still held (stored / awaiting return) for everyone else.
// POST { store, ... } — store a part (capability: storeWarranty): who stored it, when, the
//      job / vehicle, storage location and bin. Idempotent on clientRequestId.
// PUT  { id, status, outcomeReference } (capability: manageWarranty) — move it
//      to awaiting return, returned to supplier or disposed.
//
// Storing a warranty part never changes catalogue stock: the part in the bag
// is the one removed from the vehicle, not one taken from the shelf.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { ANY_STORE_USER_ROLES } from "@/features/stockAccess/stockAccessPermissions";
import { getStockAccessStore } from "@/config/stockAccessStores";
import { WARRANTY_STATUS_BY_VALUE } from "@/features/stockAccess/stockAccessModel";
import {
  createWarrantyRecord,
  findTransactionByRequestId,
  getItem,
  getWarrantyRecord,
  insertTransaction,
  listLocations,
  listWarrantyRecords,
  updateWarrantyRecord,
} from "@/lib/database/stockAccess";
import {
  actorFor,
  audit,
  capabilitiesFor,
  methodNotAllowed,
  refuseIfMigrationPending,
  requireCapability,
  resolveStore,
  sendError,
  sendValidation,
} from "@/lib/stockAccess/stockAccessApi";
import { parseWarrantyCreate, parseWarrantyUpdate } from "@/lib/stockAccess/stockAccessInput";

async function handleList(req, res, session) {
  const store = resolveStore(req, res);
  if (!store) return;
  const capabilities = capabilitiesFor(session, store);
  if (!capabilities.view) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return;
  }
  const records = await listWarrantyRecords({ storeKey: store.key, openOnly: !capabilities.manageWarranty });
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).json({ success: true, data: { records } });
}

async function handleCreate(req, res, session) {
  const store = resolveStore(req, res);
  if (!store) return;
  if (!requireCapability(res, session, "storeWarranty", store)) return;
  const { input, errors } = parseWarrantyCreate(req.body || {});
  if (errors.length) {
    sendValidation(res, errors);
    return;
  }
  const previous = await findTransactionByRequestId(input.clientRequestId);
  if (previous) {
    res.status(200).json({ success: true, data: { duplicate: true, message: "Already recorded — that submission was received once." } });
    return;
  }
  const item = input.itemId ? await getItem(input.itemId) : null;
  if (input.itemId && (!item || item.storeKey !== store.key)) {
    res.status(404).json({ success: false, message: "Stock item not found." });
    return;
  }
  const actor = await actorFor(req, res, session);
  const locations = await listLocations(store.key);
  const locationId = input.locationId || locations.find((entry) => entry.key === "warranty_store")?.id || null;
  const location = locations.find((entry) => entry.id === locationId) || null;

  const record = await createWarrantyRecord({
    ...input,
    storeKey: store.key,
    partDescription: input.partDescription || item?.name,
    partNumber: input.partNumber || item?.supplierPartNumber || item?.sku || "",
    locationId,
    storedBy: actor.userId,
    storedByName: actor.name,
  });
  await insertTransaction({
    item,
    action: "warranty_store",
    quantity: record.quantity,
    userId: actor.userId,
    userName: actor.name,
    jobNumber: record.jobNumber,
    vehicleReg: record.vehicleReg,
    notes: record.notes,
    warrantyRecordId: record.id,
    locationId,
    locationName: location?.name || null,
    bin: record.bin || null,
    clientRequestId: input.clientRequestId,
    storeKey: store.key,
    detail: { partDescription: record.partDescription, partNumber: record.partNumber || undefined },
  });
  await audit(actor, { action: "stock_access_warranty_stored", entityType: "stock_access_warranty", entityId: record.id });
  res.status(201).json({
    success: true,
    data: {
      duplicate: false,
      record,
      message: `Stored for warranty: ${record.partDescription}${location ? ` · ${location.name}` : ""}${record.bin ? ` · ${record.bin}` : ""}`,
    },
  });
}

async function handleUpdate(req, res, session) {
  const { input, errors } = parseWarrantyUpdate(req.body || {});
  if (errors.length) {
    sendValidation(res, errors);
    return;
  }
  const record = await getWarrantyRecord(input.id);
  if (!record) {
    res.status(404).json({ success: false, message: "Warranty record not found." });
    return;
  }
  if (!requireCapability(res, session, "manageWarranty", getStockAccessStore(record.storeKey))) return;
  if (record.status === input.status) {
    sendValidation(res, [`This part is already ${WARRANTY_STATUS_BY_VALUE[input.status].label.toLowerCase()}.`]);
    return;
  }
  const actor = await actorFor(req, res, session);
  const updated = await updateWarrantyRecord(record.id, {
    status: input.status,
    statusChangedBy: actor.userId,
    statusChangedAt: new Date().toISOString(),
    outcomeReference: input.outcomeReference || record.outcomeReference,
  });
  const item = record.itemId ? await getItem(record.itemId) : null;
  await insertTransaction({
    item,
    action: "warranty_status",
    quantity: record.quantity,
    userId: actor.userId,
    userName: actor.name,
    jobNumber: record.jobNumber,
    vehicleReg: record.vehicleReg,
    notes: input.notes,
    warrantyRecordId: record.id,
    locationId: record.locationId,
    bin: record.bin || null,
    storeKey: record.storeKey,
    detail: { from: record.status, to: updated.status, outcomeReference: updated.outcomeReference || undefined, partDescription: record.partDescription },
  });
  await audit(actor, {
    action: "stock_access_warranty_status",
    entityType: "stock_access_warranty",
    entityId: record.id,
    beforeData: { status: record.status },
    afterData: { status: updated.status, outcome_reference: updated.outcomeReference },
  });
  res.status(200).json({ success: true, data: { record: updated } });
}

async function handler(req, res, session) {
  try {
    if (await refuseIfMigrationPending(res)) return;
    if (req.method === "GET") return await handleList(req, res, session);
    if (req.method === "POST") return await handleCreate(req, res, session);
    if (req.method === "PUT") return await handleUpdate(req, res, session);
    methodNotAllowed(res, "GET, POST, PUT");
  } catch (error) {
    sendError(res, error, "Unable to process the warranty record");
  }
}

export default withRoleGuard(handler, { allow: ANY_STORE_USER_ROLES });
