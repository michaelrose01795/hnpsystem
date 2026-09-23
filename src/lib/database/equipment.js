// file location: src/lib/database/equipment.js
//
// Database access for the Equipment/Tools tracker. Server-only: every function
// runs under the service role behind a role-guarded /api/tracking/equipment
// route, and every table it touches is closed to the browser (see
// supabase/migrations/20260922160000_equipment_asset_tracking.sql).
//
// Writes follow one pattern: change the record, then append to
// tracking_equipment_events so the asset's timeline shows who did what and
// when. The rules for WHAT changes (next due dates, when an asset goes out of
// service, what status a repair returns it to) live in the pure model,
// src/features/tracking/equipment/equipmentModel.js, and in this file's
// transition helpers — never in the page.

import crypto from "crypto";
import { getDatabaseClient } from "@/lib/database/client";
import { logFailure } from "@/lib/utils/logFailure";
import { WORKSHOP_MANAGER_ROLES } from "@/lib/auth/roles";
import {
  EQUIPMENT_CATEGORY_BY_KEY,
  EQUIPMENT_DEPARTMENT_BY_KEY,
  EQUIPMENT_DOCUMENT_TYPE_BY_KEY,
  EQUIPMENT_EXPIRING_DOCUMENT_TYPES,
  EQUIPMENT_LOCATION_BY_KEY,
  EQUIPMENT_OPERATIONAL_STATUSES,
  EQUIPMENT_REMINDER_WINDOWS,
} from "@/config/equipmentTracking";
import {
  calendarDaysBetween,
  computeNextDue,
  getDueItems,
  normaliseAssetCode,
  normaliseChecklistItems,
  toDate,
  toDateInputValue,
} from "@/features/tracking/equipment/equipmentModel";

const supabase = getDatabaseClient();

const ASSETS = "tracking_equipment_tools";
const CHECKS = "tracking_equipment_checks";
const FAULTS = "tracking_equipment_faults";
const DOCUMENTS = "tracking_equipment_documents";
const EVENTS = "tracking_equipment_events";
const CHECKLISTS = "tracking_equipment_checklists";
const REMINDERS = "tracking_equipment_reminders";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPERATIONAL_STATUS_KEYS = new Set(EQUIPMENT_OPERATIONAL_STATUSES.map((status) => status.key));
const TIMELINE_LIMIT = 300;

export class EquipmentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "EquipmentError";
    this.status = status;
  }
}

const fail = (error, context) => {
  if (!error) return;
  if (error.code === "23505" && /asset_code/i.test(error.message || "")) {
    throw new EquipmentError("That asset ID is already in use.", 409);
  }
  throw new Error(`${context}: ${error.message || error}`);
};

/* ------------------------------------------------------------------------ */
/* Serialisers (snake_case rows → the camelCase shape the model and UI use)   */
/* ------------------------------------------------------------------------ */
const numberOrNull = (value) => (value === null || value === undefined ? null : Number(value));

const serialiseFault = (row) => ({
  id: row.id,
  equipmentId: row.equipment_id,
  description: row.description,
  severity: row.severity,
  usability: row.usability,
  repairRequired: row.repair_required,
  status: row.status,
  sourceCheckId: row.source_check_id,
  reportedBy: row.reported_by,
  reportedByName: row.reported_by_name || "",
  reportedAt: row.reported_at,
  repairStartedAt: row.repair_started_at,
  resolvedBy: row.resolved_by,
  resolvedByName: row.resolved_by_name || "",
  resolvedAt: row.resolved_at,
  resolutionNotes: row.resolution_notes || "",
  repairCost: numberOrNull(row.repair_cost),
  repairedBy: row.repaired_by || "",
});

const serialiseAsset = (row, { openFaults = [], userNames = new Map() } = {}) => ({
  id: row.id,
  assetCode: row.asset_code,
  name: row.name,
  category: row.category,
  department: row.department || "",
  location: row.location || "",
  locationDetail: row.location_detail || "",
  operationalStatus: row.operational_status,
  statusReason: row.status_reason || "",
  statusChangedAt: row.status_changed_at,
  manufacturer: row.manufacturer || "",
  model: row.model || "",
  serialNumber: row.serial_number || "",
  notes: row.notes || "",
  checklistId: row.checklist_id,
  dueSoonDays: row.due_soon_days,
  lastChecked: row.last_checked,
  nextDue: row.next_due,
  intervalDays: row.interval_days,
  intervalMonths: row.interval_months,
  intervalLabel: row.interval_label,
  lastCheckedBy: row.last_checked_by,
  lastCheckedByName: userNames.get(row.last_checked_by) || "",
  lastCheckResult: row.last_check_result || "",
  lastCheckCondition: row.last_check_condition || "",
  serviceIntervalMonths: row.service_interval_months,
  lastServiceAt: row.last_service_at,
  nextServiceDue: row.next_service_due,
  serviceProvider: row.service_provider || "",
  requiresCalibration: Boolean(row.requires_calibration),
  calibrationIntervalMonths: row.calibration_interval_months,
  lastCalibratedAt: row.last_calibrated_at,
  calibrationDue: row.calibration_due,
  calibrationCompany: row.calibration_company || "",
  calibrationCertificateRef: row.calibration_certificate_ref || "",
  purchaseDate: row.purchase_date,
  purchasePrice: numberOrNull(row.purchase_price),
  supplier: row.supplier || "",
  purchaseReference: row.purchase_reference || "",
  warrantyExpiry: row.warranty_expiry,
  warrantyProvider: row.warranty_provider || "",
  retiredAt: row.retired_at,
  retiredBy: row.retired_by,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  openFaults,
});

const serialiseCheck = (row) => ({
  id: row.id,
  equipmentId: row.equipment_id,
  checkType: row.check_type,
  result: row.result,
  condition: row.condition || "",
  checklistId: row.checklist_id,
  checklistName: row.checklist_name || "",
  checklistResults: Array.isArray(row.checklist_results) ? row.checklist_results : [],
  notes: row.notes || "",
  provider: row.provider || "",
  certificateRef: row.certificate_ref || "",
  cost: numberOrNull(row.cost),
  nextDueAt: row.next_due_at,
  bulkBatchId: row.bulk_batch_id,
  performedBy: row.performed_by,
  performedByName: row.performed_by_name || "",
  performedAt: row.performed_at,
});

const serialiseDocument = (row) => ({
  id: row.id,
  equipmentId: row.equipment_id,
  checkId: row.check_id,
  faultId: row.fault_id,
  docType: row.doc_type,
  title: row.title || "",
  fileName: row.file_name,
  mimeType: row.mime_type || "",
  sizeBytes: row.size_bytes,
  expiresAt: row.expires_at,
  uploadedBy: row.uploaded_by,
  uploadedByName: row.uploaded_by_name || "",
  uploadedAt: row.uploaded_at,
});

const serialiseEvent = (row) => ({
  id: row.id,
  equipmentId: row.equipment_id,
  eventType: row.event_type,
  summary: row.summary,
  detail: row.detail || {},
  actorUserId: row.actor_user_id,
  actorName: row.actor_name || "",
  occurredAt: row.occurred_at,
});

const serialiseChecklist = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category || "",
  description: row.description || "",
  items: normaliseChecklistItems(row.items),
  isActive: row.is_active !== false,
  updatedAt: row.updated_at,
});

/* ------------------------------------------------------------------------ */
/* Input sanitising                                                          */
/* ------------------------------------------------------------------------ */
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

const cleanText = (max) => (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().slice(0, max);
  return text || null;
};
const cleanInteger = (min, max) => (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) throw new EquipmentError("Expected a whole number.");
  return Math.min(max, Math.max(min, number));
};
const cleanMoney = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/[£,\s]/g, ""));
  if (!Number.isFinite(number) || number < 0) throw new EquipmentError("Enter a valid amount.");
  return Math.round(number * 100) / 100;
};
const cleanTimestamp = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = toDate(value);
  if (!date) throw new EquipmentError("Enter a valid date.");
  return date.toISOString();
};
const cleanDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = toDate(value);
  if (!date) throw new EquipmentError("Enter a valid date.");
  return toDateInputValue(date);
};
const cleanBoolean = (value) => value === true || value === "true";
const cleanUuid = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (!UUID_RE.test(String(value))) throw new EquipmentError("Invalid reference.");
  return String(value);
};
const cleanKey = (lookup, label) => (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (!lookup[value]) throw new EquipmentError(`Unknown ${label}.`);
  return value;
};

// Editable asset fields: camelCase input → column, cleaner, timeline label.
// Operational status is deliberately absent — it only changes through
// changeEquipmentStatus, faults and checks, each of which records why.
const ASSET_FIELDS = {
  name: ["name", cleanText(160), "Name"],
  assetCode: ["asset_code", (value) => normaliseAssetCode(value) || null, "Asset ID"],
  category: ["category", cleanKey(EQUIPMENT_CATEGORY_BY_KEY, "category"), "Category"],
  department: ["department", cleanKey(EQUIPMENT_DEPARTMENT_BY_KEY, "department"), "Department"],
  location: ["location", cleanKey(EQUIPMENT_LOCATION_BY_KEY, "location"), "Location"],
  locationDetail: ["location_detail", cleanText(120), "Location detail"],
  manufacturer: ["manufacturer", cleanText(120), "Manufacturer"],
  model: ["model", cleanText(120), "Model"],
  serialNumber: ["serial_number", cleanText(120), "Serial number"],
  notes: ["notes", cleanText(4000), "Notes"],
  checklistId: ["checklist_id", cleanUuid, "Checklist"],
  dueSoonDays: ["due_soon_days", cleanInteger(0, 365), "Due Soon window"],
  lastChecked: ["last_checked", cleanTimestamp, "Last checked"],
  nextDue: ["next_due", cleanTimestamp, "Next due"],
  intervalDays: ["interval_days", cleanInteger(1, 3660), "Check interval"],
  intervalMonths: ["interval_months", cleanInteger(1, 120), "Check interval"],
  intervalLabel: ["interval_label", cleanText(40), "Check interval"],
  serviceIntervalMonths: ["service_interval_months", cleanInteger(1, 120), "Service interval"],
  lastServiceAt: ["last_service_at", cleanTimestamp, "Last service"],
  nextServiceDue: ["next_service_due", cleanTimestamp, "Next service"],
  serviceProvider: ["service_provider", cleanText(160), "Service provider"],
  requiresCalibration: ["requires_calibration", cleanBoolean, "Calibration tracking"],
  calibrationIntervalMonths: ["calibration_interval_months", cleanInteger(1, 120), "Calibration interval"],
  lastCalibratedAt: ["last_calibrated_at", cleanTimestamp, "Last calibrated"],
  calibrationDue: ["calibration_due", cleanTimestamp, "Calibration expiry"],
  calibrationCompany: ["calibration_company", cleanText(160), "Calibration company"],
  calibrationCertificateRef: ["calibration_certificate_ref", cleanText(120), "Calibration certificate"],
  purchaseDate: ["purchase_date", cleanDate, "Purchase date"],
  purchasePrice: ["purchase_price", cleanMoney, "Purchase price"],
  supplier: ["supplier", cleanText(160), "Supplier"],
  purchaseReference: ["purchase_reference", cleanText(120), "Purchase reference"],
  warrantyExpiry: ["warranty_expiry", cleanDate, "Warranty expiry"],
  warrantyProvider: ["warranty_provider", cleanText(160), "Warranty provider"],
};

const buildAssetPatch = (input = {}) => {
  const patch = {};
  for (const [key, [column, clean]] of Object.entries(ASSET_FIELDS)) {
    if (hasOwn(input, key)) patch[column] = clean(input[key]);
  }
  return patch;
};

// Compare the way each column is stored, so a re-save that changes nothing
// (a timestamp re-serialised, "12.00" read back as 12) is not logged as an edit.
const comparable = (clean, value) => {
  if (value === null || value === undefined || value === "") return "";
  if (clean === cleanTimestamp) return toDate(value)?.getTime() ?? "";
  if (clean === cleanMoney) return Number(value);
  return String(value);
};

const changedFieldLabels = (before, patch) => {
  const labels = new Set();
  for (const [column, clean, label] of Object.values(ASSET_FIELDS)) {
    if (!hasOwn(patch, column)) continue;
    if (comparable(clean, before?.[column]) !== comparable(clean, patch[column])) labels.add(label);
  }
  return [...labels];
};

/* ------------------------------------------------------------------------ */
/* Shared reads                                                              */
/* ------------------------------------------------------------------------ */
async function resolveUserNames(ids = []) {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(Number(id)) && Number(id) > 0).map(Number))];
  const names = new Map();
  if (!unique.length) return names;
  const { data, error } = await supabase
    .from("users")
    .select("user_id, first_name, last_name, email")
    .in("user_id", unique);
  if (error) {
    logFailure("Equipment: unable to resolve user names", error);
    return names;
  }
  for (const user of data || []) {
    names.set(
      user.user_id,
      [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email || `User #${user.user_id}`
    );
  }
  return names;
}

async function loadOpenFaults(equipmentIds = null) {
  let query = supabase.from(FAULTS).select("*").neq("status", "resolved").order("reported_at", { ascending: false });
  if (equipmentIds) query = query.in("equipment_id", equipmentIds);
  const { data, error } = await query;
  fail(error, "Unable to load equipment faults");
  const byAsset = new Map();
  for (const row of data || []) {
    const list = byAsset.get(row.equipment_id) || [];
    list.push(serialiseFault(row));
    byAsset.set(row.equipment_id, list);
  }
  return byAsset;
}

async function serialiseAssets(rows = []) {
  if (!rows.length) return [];
  const [faults, userNames] = await Promise.all([
    loadOpenFaults(rows.map((row) => row.id)),
    resolveUserNames(rows.map((row) => row.last_checked_by)),
  ]);
  return rows.map((row) => serialiseAsset(row, { openFaults: faults.get(row.id) || [], userNames }));
}

async function loadAssetRow(reference) {
  const ref = String(reference || "").trim();
  if (!ref) throw new EquipmentError("An equipment reference is required.");
  const query = supabase.from(ASSETS).select("*");
  // Asset codes are stored normalised (upper case), so an exact match is right
  // — and avoids ilike treating "_" in a code as a wildcard.
  const { data, error } = UUID_RE.test(ref)
    ? await query.eq("id", ref).maybeSingle()
    : await query.eq("asset_code", normaliseAssetCode(ref)).maybeSingle();
  fail(error, "Unable to load equipment");
  if (!data) throw new EquipmentError("Equipment not found.", 404);
  return data;
}

async function loadAssetRows(ids = []) {
  const { data, error } = await supabase.from(ASSETS).select("*").in("id", ids);
  fail(error, "Unable to load equipment");
  const rows = data || [];
  if (rows.length !== new Set(ids).size) throw new EquipmentError("Some of that equipment no longer exists.", 404);
  return rows;
}

async function updateAssetRow(id, patch) {
  const { data, error } = await supabase
    .from(ASSETS)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  fail(error, "Unable to update equipment");
  return data;
}

async function insertEvents(events = []) {
  const rows = events.filter(Boolean).map((event) => ({
    equipment_id: event.equipmentId,
    event_type: event.eventType,
    summary: String(event.summary || "").slice(0, 300),
    detail: event.detail || {},
    actor_user_id: event.actor?.userId || null,
    actor_name: event.actor?.name || null,
    ...(event.occurredAt ? { occurred_at: event.occurredAt } : {}),
  }));
  if (!rows.length) return;
  const { error } = await supabase.from(EVENTS).insert(rows);
  // The record change has already happened; a missing timeline row must not
  // turn a saved check into an error the technician retries.
  if (error) logFailure("Equipment: unable to record timeline event", error);
}

async function notify(message) {
  const { error } = await supabase.from("notifications").insert({
    message: String(message).slice(0, 1000),
    target_role: WORKSHOP_MANAGER_ROLES[0],
  });
  if (error) logFailure("Equipment: unable to write notification", error);
}

const assetLabel = (row) => `${row.name} (${row.asset_code})`;
const statusLabel = (key) => EQUIPMENT_OPERATIONAL_STATUSES.find((status) => status.key === key)?.label || key;

function statusChange(row, to, reason, actor) {
  if (!to || row.operational_status === to) return { patch: {}, event: null };
  const now = new Date().toISOString();
  return {
    patch: {
      operational_status: to,
      status_reason: reason ? String(reason).slice(0, 300) : null,
      status_changed_at: now,
      ...(to === "retired"
        ? { retired_at: now, retired_by: actor?.userId || null }
        : row.operational_status === "retired"
          ? { retired_at: null, retired_by: null }
          : {}),
    },
    event: {
      equipmentId: row.id,
      eventType: to === "retired" ? "retired" : row.operational_status === "retired" ? "reinstated" : "status_changed",
      summary: `Status: ${statusLabel(row.operational_status)} → ${statusLabel(to)}`,
      detail: { from: row.operational_status, to, reason: reason || null },
      actor,
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Register                                                                  */
/* ------------------------------------------------------------------------ */
export async function listChecklists({ includeInactive = false } = {}) {
  let query = supabase.from(CHECKLISTS).select("*").order("name", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  fail(error, "Unable to load checklists");
  return (data || []).map(serialiseChecklist);
}

// The whole register is listed, so its open faults are simply every unresolved
// fault — they no longer wait on the asset query for an id list (which also put
// every asset id into the request URL). Assets, faults and checklists load
// together; only the "last checked by" names need the asset rows first.
export async function listEquipment({ includeInactiveChecklists = false } = {}) {
  const [{ data, error }, faults, checklists] = await Promise.all([
    supabase.from(ASSETS).select("*").order("name", { ascending: true }),
    loadOpenFaults(),
    listChecklists({ includeInactive: includeInactiveChecklists }),
  ]);
  fail(error, "Unable to load equipment");
  const rows = data || [];
  const userNames = rows.length ? await resolveUserNames(rows.map((row) => row.last_checked_by)) : new Map();
  const assets = rows.map((row) => serialiseAsset(row, { openFaults: faults.get(row.id) || [], userNames }));
  return { assets, checklists };
}

export async function getEquipmentDetail(reference) {
  const row = await loadAssetRow(reference);
  const [checks, faults, documents, events, userNames] = await Promise.all([
    supabase.from(CHECKS).select("*").eq("equipment_id", row.id).order("performed_at", { ascending: false }).limit(200),
    supabase.from(FAULTS).select("*").eq("equipment_id", row.id).order("reported_at", { ascending: false }),
    supabase.from(DOCUMENTS).select("*").eq("equipment_id", row.id).is("removed_at", null).order("uploaded_at", { ascending: false }),
    supabase.from(EVENTS).select("*").eq("equipment_id", row.id).order("occurred_at", { ascending: false }).limit(TIMELINE_LIMIT),
    resolveUserNames([row.last_checked_by]),
  ]);
  fail(checks.error, "Unable to load equipment checks");
  fail(faults.error, "Unable to load equipment faults");
  fail(documents.error, "Unable to load equipment documents");
  fail(events.error, "Unable to load equipment history");
  // The asset's open faults are already in `faults` (every fault, newest
  // first — the same order loadOpenFaults uses), so serialise from those rather
  // than querying the faults table a second time.
  const allFaults = (faults.data || []).map(serialiseFault);
  const openFaults = allFaults.filter((fault, index) => faults.data[index].status !== "resolved");
  const asset = serialiseAsset(row, { openFaults, userNames });
  return {
    asset,
    checks: (checks.data || []).map(serialiseCheck),
    faults: allFaults,
    documents: (documents.data || []).map(serialiseDocument),
    events: (events.data || []).map(serialiseEvent),
  };
}

export async function createEquipment(input = {}, actor = null) {
  const patch = buildAssetPatch(input);
  if (!patch.name) throw new EquipmentError("Enter the equipment name.");
  if (!patch.asset_code) delete patch.asset_code; // take the next EQ-#### from the sequence
  if (!patch.department && patch.location) patch.department = EQUIPMENT_LOCATION_BY_KEY[patch.location]?.department || null;
  const row = {
    ...patch,
    operational_status: patch.next_due ? "in_service" : "awaiting_inspection",
    created_by: actor?.userId || null,
    updated_by: actor?.userId || null,
  };
  const { data, error } = await supabase.from(ASSETS).insert(row).select("*").single();
  fail(error, "Unable to create equipment");
  await insertEvents([
    {
      equipmentId: data.id,
      eventType: "created",
      summary: `Added to the register as ${data.asset_code}`,
      detail: { category: data.category, location: data.location },
      actor,
    },
  ]);
  const [asset] = await serialiseAssets([data]);
  return asset;
}

export async function updateEquipment(id, input = {}, actor = null) {
  const before = await loadAssetRow(id);
  const patch = buildAssetPatch(input);
  if (hasOwn(patch, "name") && !patch.name) throw new EquipmentError("Enter the equipment name.");
  if (hasOwn(patch, "asset_code") && !patch.asset_code) delete patch.asset_code;
  const changed = changedFieldLabels(before, patch);
  if (!changed.length) {
    const [asset] = await serialiseAssets([before]);
    return asset;
  }
  const after = await updateAssetRow(before.id, { ...patch, updated_by: actor?.userId || null });
  await insertEvents([
    {
      equipmentId: before.id,
      eventType: "updated",
      summary: `Updated ${changed.join(", ").toLowerCase()}`,
      detail: { fields: changed },
      actor,
    },
  ]);
  const [asset] = await serialiseAssets([after]);
  return asset;
}

export async function changeEquipmentStatus(id, { status, reason } = {}, actor = null) {
  if (!OPERATIONAL_STATUS_KEYS.has(status)) throw new EquipmentError("Choose a valid status.");
  const row = await loadAssetRow(id);
  const reasonText = String(reason || "").trim();
  if ((status === "retired" || status === "out_of_service") && !reasonText) {
    throw new EquipmentError("Give a reason for this status change.");
  }
  if (status === "in_service") {
    const open = (await loadOpenFaults([row.id])).get(row.id) || [];
    if (open.some((fault) => fault.usability === "unsafe")) {
      throw new EquipmentError("Resolve the unsafe fault before returning this equipment to service.", 409);
    }
  }
  const { patch, event } = statusChange(row, status, reasonText, actor);
  if (!event) {
    const [asset] = await serialiseAssets([row]);
    return asset;
  }
  const after = await updateAssetRow(row.id, { ...patch, updated_by: actor?.userId || null });
  await insertEvents([event]);
  const [asset] = await serialiseAssets([after]);
  return asset;
}

/* ------------------------------------------------------------------------ */
/* Faults                                                                    */
/* ------------------------------------------------------------------------ */
const FAULT_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const FAULT_USABILITY = new Set(["usable", "restricted", "unsafe"]);

const cleanFaultInput = (input = {}) => {
  const description = String(input.description || "").trim().slice(0, 2000);
  if (!description) throw new EquipmentError("Describe the fault.");
  const severity = FAULT_SEVERITIES.has(input.severity) ? input.severity : "medium";
  const usability = FAULT_USABILITY.has(input.usability) ? input.usability : "restricted";
  return { description, severity, usability, repairRequired: input.repairRequired !== false };
};

// Inserts the fault and works out what it does to the asset. Returns the
// asset patch rather than writing it, so a failed check can fold the fault and
// its own changes into one update.
async function insertFault(row, input, actor, sourceCheckId = null) {
  const fault = cleanFaultInput(input);
  const { data, error } = await supabase
    .from(FAULTS)
    .insert({
      equipment_id: row.id,
      description: fault.description,
      severity: fault.severity,
      usability: fault.usability,
      repair_required: fault.repairRequired,
      source_check_id: sourceCheckId,
      reported_by: actor?.userId || null,
      reported_by_name: actor?.name || null,
    })
    .select("*")
    .single();
  fail(error, "Unable to record the fault");

  const events = [
    {
      equipmentId: row.id,
      eventType: "fault_reported",
      summary: `Fault reported: ${fault.description}`,
      detail: {
        faultId: data.id,
        severity: fault.severity,
        usability: fault.usability,
        repairRequired: fault.repairRequired,
        checkId: sourceCheckId,
      },
      actor,
    },
  ];
  let patch = {};
  if (fault.usability === "unsafe" && !["out_of_service", "retired"].includes(row.operational_status)) {
    const change = statusChange(row, "out_of_service", `Unsafe fault: ${fault.description}`.slice(0, 300), actor);
    patch = change.patch;
    events.push(change.event);
  }

  const urgent = fault.usability === "unsafe" || fault.severity === "critical" || fault.severity === "high";
  await notify(
    `${urgent ? "⚠️ " : ""}Equipment fault on ${assetLabel(row)}: ${fault.description}` +
      (fault.usability === "unsafe" ? " — marked Out of Service." : ` (${fault.severity}).`)
  );

  return { fault: data, patch, events };
}

export async function reportEquipmentFault(input = {}, actor = null) {
  const row = await loadAssetRow(input.equipmentId);
  if (row.operational_status === "retired") throw new EquipmentError("This equipment is retired.", 409);
  const { fault, patch, events } = await insertFault(row, input, actor, null);
  const after = Object.keys(patch).length ? await updateAssetRow(row.id, { ...patch, updated_by: actor?.userId || null }) : row;
  await insertEvents(events);
  const [asset] = await serialiseAssets([after]);
  return { asset, fault: serialiseFault(fault) };
}

const RETURN_STATUSES = new Set(["awaiting_inspection", "in_service"]);

export async function updateEquipmentFault(faultId, input = {}, actor = null) {
  const id = cleanUuid(faultId);
  if (!id) throw new EquipmentError("A fault reference is required.");
  const { data: before, error } = await supabase.from(FAULTS).select("*").eq("id", id).maybeSingle();
  fail(error, "Unable to load the fault");
  if (!before) throw new EquipmentError("Fault not found.", 404);
  const row = await loadAssetRow(before.equipment_id);
  const now = new Date().toISOString();
  const events = [];
  let faultPatch = {};
  let assetPatch = {};

  if (input.action === "start-repair") {
    if (before.status !== "open") throw new EquipmentError("Only an open fault can go into repair.", 409);
    faultPatch = { status: "in_repair", repair_started_at: now };
    events.push({
      equipmentId: row.id,
      eventType: "fault_repair_started",
      summary: `Repair started: ${before.description}`,
      detail: { faultId: id, repairedBy: cleanText(160)(input.repairedBy) },
      actor,
    });
    if (row.operational_status !== "retired") {
      const change = statusChange(row, "under_repair", `Repairing: ${before.description}`.slice(0, 300), actor);
      assetPatch = change.patch;
      if (change.event) events.push(change.event);
    }
  } else if (input.action === "resolve") {
    if (before.status === "resolved") throw new EquipmentError("This fault is already resolved.", 409);
    const notes = String(input.resolutionNotes || "").trim().slice(0, 2000);
    if (!notes) throw new EquipmentError("Say how the fault was resolved.");
    faultPatch = {
      status: "resolved",
      resolved_at: now,
      resolved_by: actor?.userId || null,
      resolved_by_name: actor?.name || null,
      resolution_notes: notes,
      repair_cost: cleanMoney(input.repairCost),
      repaired_by: cleanText(160)(input.repairedBy),
    };
    events.push({
      equipmentId: row.id,
      eventType: "fault_resolved",
      summary: `Fault resolved: ${before.description}`,
      detail: { faultId: id, resolution: notes, repairCost: faultPatch.repair_cost, repairedBy: faultPatch.repaired_by },
      actor,
    });
    // What the asset returns to depends on what is still wrong with it.
    const remaining = ((await loadOpenFaults([row.id])).get(row.id) || []).filter((fault) => fault.id !== id);
    if (row.operational_status !== "retired") {
      let target = null;
      if (remaining.some((fault) => fault.usability === "unsafe")) {
        target = "out_of_service";
      } else if (["out_of_service", "under_repair"].includes(row.operational_status)) {
        target = RETURN_STATUSES.has(input.returnTo) ? input.returnTo : "awaiting_inspection";
      }
      const change = statusChange(row, target, target === "awaiting_inspection" ? "Repaired — inspect before use" : null, actor);
      assetPatch = change.patch;
      if (change.event) events.push(change.event);
    }
  } else if (input.action === "update") {
    const next = cleanFaultInput({ ...serialiseFault(before), ...input });
    faultPatch = {
      description: next.description,
      severity: next.severity,
      usability: next.usability,
      repair_required: next.repairRequired,
    };
    events.push({
      equipmentId: row.id,
      eventType: "fault_updated",
      summary: `Fault updated: ${next.description}`,
      detail: { faultId: id, severity: next.severity, usability: next.usability },
      actor,
    });
    if (next.usability === "unsafe" && !["out_of_service", "retired"].includes(row.operational_status)) {
      const change = statusChange(row, "out_of_service", `Unsafe fault: ${next.description}`.slice(0, 300), actor);
      assetPatch = change.patch;
      if (change.event) events.push(change.event);
    }
  } else {
    throw new EquipmentError("Unknown fault action.");
  }

  const { data: fault, error: faultError } = await supabase
    .from(FAULTS)
    .update({ ...faultPatch, updated_at: now })
    .eq("id", id)
    .select("*")
    .single();
  fail(faultError, "Unable to update the fault");
  const after = Object.keys(assetPatch).length
    ? await updateAssetRow(row.id, { ...assetPatch, updated_by: actor?.userId || null })
    : row;
  await insertEvents(events);
  const [asset] = await serialiseAssets([after]);
  return { asset, fault: serialiseFault(fault) };
}

/* ------------------------------------------------------------------------ */
/* Checks, inspections, services, calibrations                               */
/* ------------------------------------------------------------------------ */
const CHECK_TYPES = new Set(["routine", "inspection", "service", "calibration"]);
const CHECK_RESULTS = new Set(["pass", "advisory", "fail"]);
const CONDITIONS = new Set(["good", "fair", "poor", "unsafe"]);
const MAX_BULK = 200;
const CHECK_VERB = { routine: "Check", inspection: "Inspection", service: "Service", calibration: "Calibration" };
const RESULT_WORD = { pass: "passed", advisory: "passed with advisories", fail: "failed" };

const cleanChecklistResults = (results = []) =>
  (Array.isArray(results) ? results : []).slice(0, 60).map((item) => ({
    id: String(item?.id || "").slice(0, 40),
    label: String(item?.label || "").slice(0, 160),
    kind: item?.kind === "reading" ? "reading" : "check",
    ...(item?.kind === "reading"
      ? {
          reading: Number.isFinite(Number(item?.reading)) && item?.reading !== null && item?.reading !== "" ? Number(item.reading) : null,
          unit: String(item?.unit || "").slice(0, 16),
          inRange: item?.inRange !== false,
        }
      : { outcome: ["pass", "fail", "na"].includes(item?.outcome) ? item.outcome : null }),
  }));

// Next due date for the kind of check just done, from that check's date.
const nextDueForCheck = (row, checkType, performedAt) => {
  if (checkType === "calibration") {
    return computeNextDue(performedAt, { intervalMonths: row.calibration_interval_months || 12 });
  }
  if (checkType === "service") {
    return row.service_interval_months ? computeNextDue(performedAt, { intervalMonths: row.service_interval_months }) : null;
  }
  return computeNextDue(performedAt, { intervalMonths: row.interval_months, intervalDays: row.interval_days });
};

/**
 * Record a check on one asset, or the same check on several (bulk). Every asset
 * gets its own check row, its own schedule update and its own timeline entry;
 * a bulk run only shares a bulk_batch_id so it can be traced as one action.
 */
export async function recordEquipmentChecks(input = {}, actor = null) {
  const ids = [...new Set((Array.isArray(input.equipmentIds) ? input.equipmentIds : []).map(cleanUuid).filter(Boolean))];
  if (!ids.length) throw new EquipmentError("Choose the equipment that was checked.");
  if (ids.length > MAX_BULK) throw new EquipmentError(`Log at most ${MAX_BULK} checks at once.`);
  const isBulk = ids.length > 1;

  const checkType = CHECK_TYPES.has(input.checkType) ? input.checkType : "routine";
  const result = CHECK_RESULTS.has(input.result) ? input.result : null;
  if (!result) throw new EquipmentError("Choose a result.");
  const condition = CONDITIONS.has(input.condition) ? input.condition : null;
  const raisesFault = result === "fail" || condition === "unsafe";
  if (raisesFault && isBulk) {
    throw new EquipmentError("A failed or unsafe check has to be logged on its own so its fault is recorded against the right asset.");
  }
  if (raisesFault && !String(input.fault?.description || "").trim()) {
    throw new EquipmentError("Describe the fault found during this check.");
  }

  const performedAt = cleanTimestamp(input.performedAt) || new Date().toISOString();
  if (new Date(performedAt).getTime() > Date.now() + 5 * 60 * 1000) {
    throw new EquipmentError("A check cannot be dated in the future.");
  }
  const explicitNextDue = isBulk ? null : cleanTimestamp(input.nextDueAt);
  const rows = await loadAssetRows(ids);
  const retired = rows.find((row) => row.operational_status === "retired");
  if (retired) throw new EquipmentError(`${assetLabel(retired)} is retired and cannot be checked.`, 409);

  const checklistResults = isBulk ? [] : cleanChecklistResults(input.checklistResults);
  const batchId = isBulk ? crypto.randomUUID() : null;
  const notes = cleanText(4000)(input.notes);
  const checklistId = isBulk ? null : cleanUuid(input.checklistId);

  const checkRows = rows.map((row) => ({
    equipment_id: row.id,
    check_type: checkType,
    result,
    condition,
    checklist_id: checklistId,
    checklist_name: isBulk ? null : cleanText(160)(input.checklistName),
    checklist_results: checklistResults,
    notes,
    provider: cleanText(160)(input.provider),
    certificate_ref: cleanText(120)(input.certificateRef),
    cost: cleanMoney(input.cost),
    next_due_at: (explicitNextDue ? toDate(explicitNextDue) : nextDueForCheck(row, checkType, performedAt))?.toISOString() || null,
    bulk_batch_id: batchId,
    performed_by: actor?.userId || null,
    performed_by_name: actor?.name || null,
    performed_at: performedAt,
  }));
  const { data: insertedChecks, error } = await supabase.from(CHECKS).insert(checkRows).select("*");
  fail(error, "Unable to record the check");
  const checkByAsset = new Map((insertedChecks || []).map((check) => [check.equipment_id, check]));

  const openFaults = await loadOpenFaults(ids);
  const updatedRows = [];
  const createdFaults = [];
  const events = [];

  for (const row of rows) {
    const check = checkByAsset.get(row.id);
    const nextDue = check?.next_due_at || null;
    let patch = { updated_by: actor?.userId || null };

    if (checkType === "routine" || checkType === "inspection") {
      patch = {
        ...patch,
        last_checked: performedAt,
        last_checked_by: actor?.userId || null,
        last_check_result: result,
        last_check_condition: condition,
        next_due: nextDue,
      };
    } else if (checkType === "calibration") {
      patch = {
        ...patch,
        last_calibrated_at: performedAt,
        calibration_due: nextDue,
        requires_calibration: true,
        ...(check?.provider ? { calibration_company: check.provider } : {}),
        ...(check?.certificate_ref ? { calibration_certificate_ref: check.certificate_ref } : {}),
      };
    } else if (checkType === "service") {
      patch = {
        ...patch,
        last_service_at: performedAt,
        next_service_due: nextDue,
        ...(check?.provider ? { service_provider: check.provider } : {}),
      };
    }

    events.push({
      equipmentId: row.id,
      eventType: checkType === "routine" ? "check" : checkType,
      summary: `${CHECK_VERB[checkType]} ${RESULT_WORD[result]}`,
      detail: {
        checkId: check?.id,
        checkType,
        result,
        condition,
        notes,
        checklistName: check?.checklist_name || null,
        failedItems: checklistResults.filter((item) => item.outcome === "fail").map((item) => item.label),
        readings: checklistResults
          .filter((item) => item.kind === "reading" && item.reading !== null)
          .map((item) => ({ label: item.label, reading: item.reading, unit: item.unit, inRange: item.inRange })),
        nextDue,
        provider: check?.provider || null,
        certificateRef: check?.certificate_ref || null,
        batchId,
        batchSize: isBulk ? ids.length : undefined,
      },
      actor,
      occurredAt: performedAt,
    });

    let workingRow = row;
    if (raisesFault) {
      const faultInput = { ...input.fault, usability: condition === "unsafe" ? "unsafe" : input.fault?.usability };
      const outcome = await insertFault(workingRow, faultInput, actor, check?.id || null);
      createdFaults.push(serialiseFault(outcome.fault));
      patch = { ...patch, ...outcome.patch };
      events.push(...outcome.events);
      workingRow = { ...workingRow, ...outcome.patch };
    } else if (
      (checkType === "routine" || checkType === "inspection") &&
      row.operational_status === "awaiting_inspection" &&
      !(openFaults.get(row.id) || []).some((fault) => fault.usability === "unsafe")
    ) {
      const change = statusChange(row, "in_service", "Passed inspection", actor);
      patch = { ...patch, ...change.patch };
      if (change.event) events.push(change.event);
    }

    updatedRows.push(await updateAssetRow(row.id, patch));
  }

  await insertEvents(events);
  return {
    assets: await serialiseAssets(updatedRows),
    checks: (insertedChecks || []).map(serialiseCheck),
    faults: createdFaults,
    batchId,
  };
}

/* ------------------------------------------------------------------------ */
/* Checklists                                                                */
/* ------------------------------------------------------------------------ */
export async function saveChecklist(input = {}, actor = null) {
  const name = cleanText(160)(input.name);
  if (!name) throw new EquipmentError("Give the checklist a name.");
  const items = normaliseChecklistItems(input.items);
  if (!items.length) throw new EquipmentError("Add at least one checklist item.");
  const payload = {
    name,
    category: input.category ? cleanKey(EQUIPMENT_CATEGORY_BY_KEY, "category")(input.category) : null,
    description: cleanText(500)(input.description),
    items,
    is_active: input.isActive !== false,
    updated_by: actor?.userId || null,
    updated_at: new Date().toISOString(),
  };
  const id = cleanUuid(input.id);
  const query = id
    ? supabase.from(CHECKLISTS).update(payload).eq("id", id)
    : supabase.from(CHECKLISTS).insert({ ...payload, created_by: actor?.userId || null });
  const { data, error } = await query.select("*").single();
  fail(error, "Unable to save the checklist");
  return serialiseChecklist(data);
}

/* ------------------------------------------------------------------------ */
/* Documents                                                                 */
/* ------------------------------------------------------------------------ */
export async function createEquipmentDocument(input = {}, actor = null) {
  const row = await loadAssetRow(input.equipmentId);
  const docType = EQUIPMENT_DOCUMENT_TYPE_BY_KEY[input.docType] ? input.docType : "other";
  const payload = {
    equipment_id: row.id,
    check_id: cleanUuid(input.checkId),
    fault_id: cleanUuid(input.faultId),
    doc_type: docType,
    title: cleanText(160)(input.title),
    file_name: cleanText(200)(input.fileName) || "document",
    mime_type: cleanText(80)(input.mimeType),
    size_bytes: Number.isFinite(Number(input.sizeBytes)) ? Math.round(Number(input.sizeBytes)) : null,
    storage_path: input.storagePath,
    expires_at: cleanDate(input.expiresAt),
    uploaded_by: actor?.userId || null,
    uploaded_by_name: actor?.name || null,
  };
  const { data, error } = await supabase.from(DOCUMENTS).insert(payload).select("*").single();
  fail(error, "Unable to record the document");
  const typeLabel = EQUIPMENT_DOCUMENT_TYPE_BY_KEY[docType].label;
  await insertEvents([
    {
      equipmentId: row.id,
      eventType: "document_added",
      summary: `${typeLabel} added: ${data.title || data.file_name}`,
      detail: {
        documentId: data.id,
        docType,
        checkId: data.check_id,
        faultId: data.fault_id,
        expiresAt: data.expires_at,
      },
      actor,
    },
  ]);
  return serialiseDocument(data);
}

export async function getEquipmentDocument(documentId) {
  const id = cleanUuid(documentId);
  if (!id) throw new EquipmentError("A document reference is required.");
  const { data, error } = await supabase.from(DOCUMENTS).select("*").eq("id", id).maybeSingle();
  fail(error, "Unable to load the document");
  if (!data || data.removed_at) throw new EquipmentError("Document not found.", 404);
  return data;
}

// Soft delete: the file and index row stay so the history remains provable.
export async function removeEquipmentDocument(documentId, actor = null) {
  const document = await getEquipmentDocument(documentId);
  const { error } = await supabase
    .from(DOCUMENTS)
    .update({ removed_at: new Date().toISOString(), removed_by: actor?.userId || null })
    .eq("id", document.id);
  fail(error, "Unable to remove the document");
  await insertEvents([
    {
      equipmentId: document.equipment_id,
      eventType: "document_removed",
      summary: `Document removed: ${document.title || document.file_name}`,
      detail: { documentId: document.id, docType: document.doc_type },
      actor,
    },
  ]);
  return { id: document.id };
}

/* ------------------------------------------------------------------------ */
/* Reminders                                                                 */
/* ------------------------------------------------------------------------ */
const REMINDER_TITLES = {
  "check-overdue": "Equipment checks overdue",
  "check-due-soon": "Equipment checks due soon",
  "calibration-expired": "Equipment calibration expired",
  "calibration-expiring": "Equipment calibration expiring",
  "service-overdue": "Equipment service overdue",
  "service-due": "Equipment service due",
  "fault-unresolved": "Equipment faults still unresolved",
  "document-expired": "Equipment certificates expired",
  "document-expiring": "Equipment certificates expiring",
};
const DIGEST_NAME_LIMIT = 6;

/**
 * Scheduled reminder pass. Idempotent: each reminder is keyed on what it is
 * about and the date it concerns, and only keys never sent before produce a
 * notification. Notifications are grouped into one digest per reminder type.
 */
export async function runEquipmentReminderSweep(now = new Date()) {
  const { data: rows, error } = await supabase.from(ASSETS).select("*").neq("operational_status", "retired");
  fail(error, "Unable to load equipment for reminders");
  const assets = await serialiseAssets(rows || []);
  const candidates = [];
  const add = (type, key, asset, text) =>
    candidates.push({ reminder_key: `${type}:${key}`, reminder_type: type, equipment_id: asset.id, text });

  for (const asset of assets) {
    const name = `${asset.name} (${asset.assetCode})`;
    const unusable = ["out_of_service", "under_repair"].includes(asset.operationalStatus);
    for (const item of getDueItems(asset, now)) {
      const dateKey = toDateInputValue(item.dueAt);
      if (item.kind === "check" && !unusable) {
        if (item.daysUntil < 0) add("check-overdue", `${asset.id}:${dateKey}`, asset, name);
        else if (item.daysUntil <= item.dueSoonDays) add("check-due-soon", `${asset.id}:${dateKey}`, asset, name);
      } else if (item.kind === "calibration") {
        if (item.daysUntil < 0) add("calibration-expired", `${asset.id}:${dateKey}`, asset, name);
        else if (item.daysUntil <= EQUIPMENT_REMINDER_WINDOWS.calibrationDays) {
          add("calibration-expiring", `${asset.id}:${dateKey}`, asset, `${name} on ${dateKey}`);
        }
      } else if (item.kind === "service" && !unusable) {
        if (item.daysUntil < 0) add("service-overdue", `${asset.id}:${dateKey}`, asset, name);
        else if (item.daysUntil <= EQUIPMENT_REMINDER_WINDOWS.serviceDays) {
          add("service-due", `${asset.id}:${dateKey}`, asset, `${name} on ${dateKey}`);
        }
      }
    }
    for (const fault of asset.openFaults || []) {
      const reportedAt = toDate(fault.reportedAt);
      if (!reportedAt) continue;
      const daysOpen = calendarDaysBetween(reportedAt, now);
      if (daysOpen < EQUIPMENT_REMINDER_WINDOWS.faultRepeatDays) continue;
      const period = Math.floor(daysOpen / EQUIPMENT_REMINDER_WINDOWS.faultRepeatDays);
      add("fault-unresolved", `${fault.id}:${period}`, asset, `${name} — ${fault.description} (${daysOpen} days)`);
    }
  }

  // Certificates: only the newest of each expiring type per asset counts —
  // last year's LOLER report expiring is not news once this year's is filed.
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const { data: documents, error: documentError } = await supabase
    .from(DOCUMENTS)
    .select("id, equipment_id, doc_type, title, file_name, expires_at, uploaded_at")
    .is("removed_at", null)
    .in("doc_type", EQUIPMENT_EXPIRING_DOCUMENT_TYPES)
    .not("expires_at", "is", null)
    .order("expires_at", { ascending: false });
  fail(documentError, "Unable to load expiring documents");
  const newestByAssetType = new Map();
  for (const document of documents || []) {
    const key = `${document.equipment_id}:${document.doc_type}`;
    if (!newestByAssetType.has(key)) newestByAssetType.set(key, document);
  }
  for (const document of newestByAssetType.values()) {
    const asset = assetById.get(document.equipment_id);
    const expires = toDate(document.expires_at);
    if (!asset || !expires) continue;
    const days = calendarDaysBetween(now, expires);
    const label = `${asset.name} (${asset.assetCode}) — ${EQUIPMENT_DOCUMENT_TYPE_BY_KEY[document.doc_type]?.label || document.doc_type}`;
    if (days < 0) add("document-expired", document.id, asset, label);
    else if (days <= EQUIPMENT_REMINDER_WINDOWS.documentDays) add("document-expiring", document.id, asset, `${label} on ${document.expires_at}`);
  }

  if (!candidates.length) return { candidates: 0, sent: 0, notifications: 0 };

  const { data: inserted, error: reminderError } = await supabase
    .from(REMINDERS)
    .upsert(
      candidates.map(({ reminder_key, reminder_type, equipment_id }) => ({ reminder_key, reminder_type, equipment_id })),
      { onConflict: "reminder_key", ignoreDuplicates: true }
    )
    .select("reminder_key");
  fail(reminderError, "Unable to record reminders");

  const fresh = new Set((inserted || []).map((row) => row.reminder_key));
  const byType = new Map();
  for (const candidate of candidates) {
    if (!fresh.has(candidate.reminder_key)) continue;
    const list = byType.get(candidate.reminder_type) || [];
    list.push(candidate.text);
    byType.set(candidate.reminder_type, list);
  }

  for (const [type, names] of byType) {
    const shown = names.slice(0, DIGEST_NAME_LIMIT).join("; ");
    const more = names.length > DIGEST_NAME_LIMIT ? `; and ${names.length - DIGEST_NAME_LIMIT} more` : "";
    await notify(`🔧 ${REMINDER_TITLES[type]} (${names.length}): ${shown}${more}.`);
  }

  return { candidates: candidates.length, sent: fresh.size, notifications: byType.size };
}
