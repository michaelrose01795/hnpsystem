// file location: src/pages/api/parts/delivery-diary/[deliveryJobId].js
//
// Reads one delivery, and applies the two kinds of change the diary makes:
//
//   PATCH { action: "mark_ready" | ... , payload }  a workflow transition
//   PATCH { patch: { driver_id, vehicle_reg, ... } } a field edit
//
// Both go through the same guard chain: role guard -> delivery capabilities ->
// transition legality (src/features/deliveries/deliveryStatus.js) -> field
// allow-list. Nothing the browser sends reaches a column directly.
//
// Every accepted change writes two records: a row on parts_delivery_events
// (the trail the page renders) and a hash-chained entry via writeAuditLog
// (the platform audit record).

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { hasAllAccessRole, normalizeRoles } from "@/lib/auth/roles";
import { getAuditContext, shallowDiff } from "@/lib/audit/auditContext";
import { writeAuditLog } from "@/lib/audit/auditLog";
import {
  DELIVERY_ACTIONS,
  DELIVERY_ACTION_TIMESTAMP,
  DELIVERY_DIARY_ROLES,
  DELIVERY_FAILURE_REASONS,
  DELIVERY_STATUS,
  canApplyDeliveryAction,
  deliveryStatusLabel,
  normaliseDeliveryStatus,
  resolveDeliveryCapabilities,
} from "@/features/deliveries/deliveryStatus";
import {
  getDeliveryJob,
  listDeliveryEvents,
  recordDeliveryEvent,
  syncDeliveryLinkedRecords,
  updateDeliveryJob,
} from "@/lib/database/deliveries";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const FAILURE_REASON_VALUES = new Set(DELIVERY_FAILURE_REASONS.map((r) => r.value));

// ---------------------------------------------------------------------------
// Field allow-list
// ---------------------------------------------------------------------------
// Each editable column names the capability it needs and how its value is
// coerced. A key that is not in this map is silently ignored, so a stray or
// crafted property can never reach the table.
const trimmedText = (max) => (value) => {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim().slice(0, max) || null;
};

const asBoolean = (value) => value === true || value === "true";

const asTime = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  return TIME_RE.test(text) ? text.slice(0, 5) : null;
};

const asNonNegativeInt = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
};

const asPositiveIntOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const asMoney = (value) => {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;
};

const asRegistration = (value) => {
  const text = trimmedText(16)(value);
  return text ? text.toUpperCase() : null;
};

const EDITABLE_FIELDS = {
  driver_id: { capability: "assign", coerce: asPositiveIntOrNull },
  driver_name: { capability: "assign", coerce: trimmedText(120) },
  vehicle_reg: { capability: "assign", coerce: asRegistration },
  planned_time: { capability: "assign", coerce: asTime },
  window_start: { capability: "assign", coerce: asTime },
  window_end: { capability: "assign", coerce: asTime },
  is_urgent: { capability: "assign", coerce: asBoolean },
  is_collection: { capability: "assign", coerce: asBoolean },
  package_count: { capability: "pick", coerce: asNonNegativeInt },
  missing_items: { capability: "pick", coerce: trimmedText(500) },
  surcharge_value: { capability: "pick", coerce: asMoney },
  core_return_expected: { capability: "pick", coerce: asBoolean },
  core_return_collected: { capability: "drive", coerce: asBoolean },
  core_return_notes: { capability: "pick", coerce: trimmedText(500) },
  notes: { capability: "view", coerce: trimmedText(2000) },
  postcode: { capability: "assign", coerce: (v) => (trimmedText(12)(v) || "").toUpperCase() || null },
  order_reference: { capability: "assign", coerce: trimmedText(60) },
};

// Human sentences for the event trail, so the history reads like a log book
// rather than a column dump.
const FIELD_LABELS = {
  driver_id: "Driver",
  driver_name: "Driver",
  vehicle_reg: "Delivery vehicle",
  planned_time: "Planned time",
  window_start: "Window start",
  window_end: "Window end",
  is_urgent: "Urgent",
  is_collection: "Customer collection",
  package_count: "Packages",
  missing_items: "Missing items",
  surcharge_value: "Surcharge",
  core_return_expected: "Core return expected",
  core_return_collected: "Core collected",
  core_return_notes: "Core notes",
  notes: "Delivery notes",
  postcode: "Postcode",
  order_reference: "Order reference",
};

const describeFieldChange = (field, value) => {
  const label = FIELD_LABELS[field] || field;
  if (typeof value === "boolean") return `${label} ${value ? "set" : "cleared"}`;
  if (value === null || value === "") return `${label} cleared`;
  return `${label} set to ${value}`;
};

// ---------------------------------------------------------------------------
// Workflow transitions
// ---------------------------------------------------------------------------
/**
 * Build the column patch for a workflow action, including the extra facts the
 * action carries (failure reason, proof of delivery, core collection).
 */
function buildActionPatch(action, delivery, payload, actorUserId) {
  const now = new Date().toISOString();
  const patch = { status: action.to };

  const timestampColumn = DELIVERY_ACTION_TIMESTAMP[action.key];
  if (timestampColumn) patch[timestampColumn] = now;

  if (action.key === "dispatch" && !delivery.loaded_at) {
    // Dispatching straight from Ready still records the load, so the timeline
    // never has a gap the driver did not actually skip.
    patch.loaded_at = now;
  }

  if (action.key === "mark_delivered") {
    const recipient = trimmedText(120)(payload.recipientName);
    if (!recipient) {
      return { error: "A recipient name is required to record a delivery." };
    }
    patch.pod_recipient_name = recipient;
    patch.pod_notes = trimmedText(500)(payload.podNotes);
    patch.pod_captured_at = now;
    patch.pod_captured_by = actorUserId;
    patch.failed_reason = null;
    patch.failed_notes = null;
    if (delivery.core_return_expected) {
      patch.core_return_collected = asBoolean(payload.coreCollected);
    }
  }

  if (action.key === "mark_failed") {
    const reason = String(payload.failedReason || "").trim();
    if (!FAILURE_REASON_VALUES.has(reason)) {
      return { error: "Select why the delivery failed." };
    }
    patch.failed_reason = reason;
    patch.failed_notes = trimmedText(500)(payload.failedNotes);
  }

  if (action.key === "reopen") {
    // Reopening clears the outcome but keeps the timestamps that record what
    // actually happened, so the trail is not rewritten.
    patch.failed_reason = null;
    patch.failed_notes = null;
    patch.completed_at = null;
  }

  return { patch };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
async function handler(req, res, session) {
  const deliveryJobId = String(req.query.deliveryJobId || "");
  if (!UUID_RE.test(deliveryJobId)) {
    res.status(400).json({ success: false, message: "Invalid delivery id" });
    return;
  }

  const roles = normalizeRoles(session?.user?.roles ?? []);
  const capabilities = resolveDeliveryCapabilities(roles, hasAllAccessRole(roles));
  if (!capabilities.view) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return;
  }

  if (req.method === "GET") {
    try {
      const [delivery, events] = await Promise.all([
        getDeliveryJob(deliveryJobId),
        listDeliveryEvents(deliveryJobId),
      ]);
      if (!delivery) {
        res.status(404).json({ success: false, message: "Delivery not found" });
        return;
      }
      res.status(200).json({ success: true, data: { delivery, events } });
    } catch (error) {
      console.error("Delivery load failed:", error);
      res.status(500).json({ success: false, message: error?.message || "Unable to load delivery" });
    }
    return;
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "GET, PATCH");
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const actionKey = body.action ? String(body.action) : null;
  const requestedPatch = body.patch && typeof body.patch === "object" ? body.patch : null;
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};

  if (!actionKey && !requestedPatch) {
    res.status(400).json({ success: false, message: "Nothing to change" });
    return;
  }

  try {
    const before = await getDeliveryJob(deliveryJobId);
    if (!before) {
      res.status(404).json({ success: false, message: "Delivery not found" });
      return;
    }

    const auditContext = await getAuditContext(req, res);
    const actorUserId = auditContext.actorUserId;
    const actorName = session?.user?.name || session?.user?.email || null;

    let patch = {};
    let summary = "";
    let eventType = "delivery.updated";
    const fromStatus = normaliseDeliveryStatus(before.status);
    let toStatus = fromStatus;

    if (actionKey) {
      const action = DELIVERY_ACTIONS[actionKey];
      const verdict = canApplyDeliveryAction(before, actionKey, capabilities);
      if (!verdict.ok) {
        res.status(verdict.reason.startsWith("Your role") ? 403 : 409).json({
          success: false,
          message: verdict.reason,
        });
        return;
      }

      const built = buildActionPatch(action, before, payload, actorUserId);
      if (built.error) {
        res.status(400).json({ success: false, message: built.error });
        return;
      }
      patch = built.patch;
      toStatus = action.to;
      eventType = `delivery.${actionKey}`;
      summary = `${deliveryStatusLabel(fromStatus)} → ${deliveryStatusLabel(toStatus)}`;

      // Assigning the run to whoever dispatches it, when nobody was named. The
      // driver on the road is the useful record, not an empty column.
      if (action.to === DELIVERY_STATUS.OUT_FOR_DELIVERY && !before.driver_id && actorUserId) {
        patch.driver_id = actorUserId;
        patch.driver_name = actorName;
      }
    }

    const fieldNotes = [];
    if (requestedPatch) {
      for (const [field, rawValue] of Object.entries(requestedPatch)) {
        const spec = EDITABLE_FIELDS[field];
        if (!spec) continue;
        if (capabilities[spec.capability] !== true) {
          res.status(403).json({
            success: false,
            message: `Your role cannot change ${FIELD_LABELS[field] || field}.`,
          });
          return;
        }
        const value = spec.coerce(rawValue);
        patch[field] = value;
        fieldNotes.push(describeFieldChange(field, value));
      }
      if (fieldNotes.length > 0 && !summary) {
        summary = fieldNotes.join(", ");
        eventType = "delivery.details_updated";
      }
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ success: false, message: "Nothing to change" });
      return;
    }

    const after = await updateDeliveryJob(deliveryJobId, patch);
    if (!after) {
      res.status(500).json({ success: false, message: "Delivery update did not return a row" });
      return;
    }

    // Downstream records only need touching when the workflow state moved.
    const syncNotes = actionKey ? await syncDeliveryLinkedRecords(after) : [];

    await recordDeliveryEvent({
      deliveryJobId,
      eventType,
      fromStatus,
      toStatus,
      actorUserId,
      actorName,
      summary: [summary, ...fieldNotes.filter((note) => note !== summary), ...syncNotes]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 500),
      detail: {
        action: actionKey,
        fields: requestedPatch ? Object.keys(requestedPatch) : [],
        failedReason: after.failed_reason || null,
        recipient: after.pod_recipient_name || null,
      },
    });

    await writeAuditLog({
      ...auditContext,
      action: actionKey ? `delivery_${actionKey}` : "delivery_update",
      entityType: "parts_delivery_job",
      entityId: deliveryJobId,
      diff: shallowDiff(before, after),
      reason: summary || null,
    });

    const events = await listDeliveryEvents(deliveryJobId);
    res.status(200).json({ success: true, data: { delivery: after, events, syncNotes } });
  } catch (error) {
    console.error("Delivery update failed:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Unable to update the delivery",
    });
  }
}

export default withRoleGuard(handler, { allow: DELIVERY_DIARY_ROLES });
