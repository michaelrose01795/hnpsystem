// file location: src/lib/reporting/config/eventCatalogue.js
//
// The canonical reporting EVENT catalogue (Phase-2 §3/§4). Every `report_event`
// row carries an `event_name` that MUST be in this catalogue and an
// `event_category` that MUST be one of EVENT_CATEGORIES. The data-quality layer
// (Phase-2 §13.1) and the emit fan-out validate against this registry so the
// event stream stays clean and queryable.
//
// This is configuration only — emitting events into operational write paths is
// a later phase (gated by the `reporting_emit_enabled` flag). The catalogue is
// the contract those emitters implement.

import { DEPARTMENTS } from "./departments";

// Event categories (Phase-2 §3.3).
export const EVENT_CATEGORIES = Object.freeze([
  "LIFECYCLE",
  "ASSIGNMENT",
  "STATUS_TRANSITION",
  "MILESTONE",
  "DECISION",
  "FINANCIAL",
  "COMMUNICATION",
  "DOCUMENT_MEDIA",
  "INVENTORY",
  "TIME_LABOUR",
  "AUDIT_SECURITY",
  "SYSTEM_AUTOMATED",
]);

// Open-vocabulary domains (Phase-2 §3.1). Reporting does not constrain `domain`
// to keep it forward-compatible (§15), but these are the known values today.
export const EVENT_DOMAINS = Object.freeze([
  "workshop", "parts", "vhc", "service", "mot", "valet", "paint",
  "accounts", "admin", "management", "system",
]);

// Each catalogue entry: { name, category, domain, ownerDepartment, related[], audit }
// `audit:true` means the event is in the audit-required set (Phase-2 §11.2) and
// the emit fan-out ALSO writes an audit_log row.
const E = (name, category, domain, ownerDepartment, related = [], audit = false) => ({
  name,
  category,
  domain,
  ownerDepartment,
  related,
  audit,
});

// ---------------------------------------------------------------------------
// The catalogue (Phase-2 §4.1–§4.11). Not exhaustive of every future event,
// but complete for the departments in scope. New events are added here.
// ---------------------------------------------------------------------------
const CATALOGUE = [
  // Workshop (§4.1)
  E("JOB_CREATED", "LIFECYCLE", "workshop", "workshop", ["service", "parts", "accounts"]),
  E("JOB_ASSIGNED", "ASSIGNMENT", "workshop", "workshop", ["management"]),
  E("JOB_CHECKED_IN", "MILESTONE", "workshop", "workshop", ["service"]),
  E("JOB_STARTED", "MILESTONE", "workshop", "workshop"),
  E("TECH_WORK_COMPLETED", "MILESTONE", "workshop", "workshop", ["service", "parts"]),
  E("JOB_STATUS_CHANGED", "STATUS_TRANSITION", "workshop", "workshop", ["service", "parts", "accounts", "valeting"]),
  E("JOB_COMPLETED", "MILESTONE", "workshop", "workshop", ["service", "accounts", "valeting"]),
  E("JOB_REDIRECTED_FROM_MOBILE", "MILESTONE", "workshop", "workshop", ["service"]),
  E("CLOCK_ON", "TIME_LABOUR", "workshop", "workshop", ["management"]),
  E("CLOCK_OFF", "TIME_LABOUR", "workshop", "workshop", ["management"]),
  E("CLOCKING_EDITED", "AUDIT_SECURITY", "workshop", "workshop", ["accounts", "management"], true),
  E("JOB_REOPENED", "STATUS_TRANSITION", "workshop", "workshop", ["management"], true),

  // Parts (§4.2)
  // related_departments MUST be dim_department codes (§13.1) — VHC is a cross-
  // cutting domain, not a department; the producing department of a VHC-driven
  // part request is workshop (where the item was raised).
  E("PART_REQUESTED", "LIFECYCLE", "parts", "parts", ["workshop"]),
  E("PART_APPROVED", "DECISION", "parts", "parts", ["workshop"]),
  E("PART_ORDERED", "STATUS_TRANSITION", "parts", "parts", ["accounts"]),
  E("PART_RECEIVED", "INVENTORY", "parts", "parts", ["workshop"]),
  E("PART_ALLOCATED", "STATUS_TRANSITION", "parts", "parts", ["workshop"]),
  E("PART_PRE_PICKED", "STATUS_TRANSITION", "parts", "parts", ["workshop"]),
  E("PART_PICKED", "STATUS_TRANSITION", "parts", "parts", ["workshop"]),
  E("PART_FITTED", "MILESTONE", "parts", "workshop", ["parts"]),
  E("PART_CANCELLED", "STATUS_TRANSITION", "parts", "parts", ["workshop", "accounts"]),
  E("PART_REMOVED", "STATUS_TRANSITION", "parts", "parts", ["workshop"]),
  E("PART_UNAVAILABLE", "STATUS_TRANSITION", "parts", "parts", ["workshop"]),
  E("PART_STATUS_CHANGED", "STATUS_TRANSITION", "parts", "parts", ["workshop"]),
  E("STOCK_RECEIVED", "INVENTORY", "parts", "parts", ["accounts"]),
  E("STOCK_ALLOCATED", "INVENTORY", "parts", "parts", ["accounts"]),
  E("STOCK_ADJUSTED", "INVENTORY", "parts", "parts", ["accounts"]),
  E("STOCK_RETURNED", "INVENTORY", "parts", "parts", ["accounts"]),

  // Service Advisors (§4.3)
  E("APPOINTMENT_BOOKED", "LIFECYCLE", "service", "service", ["workshop"]),
  E("APPOINTMENT_STATUS_CHANGED", "STATUS_TRANSITION", "service", "service", ["workshop"]),
  E("CUSTOMER_STATUS_SET", "MILESTONE", "service", "service", ["workshop"]),
  E("CUSTOMER_CONTACTED", "COMMUNICATION", "service", "service"),

  // VHC (§4.4) — owner shifts with the actor (§5.4)
  E("VHC_CREATED", "LIFECYCLE", "vhc", "workshop", ["service"]),
  E("VHC_ITEM_PRICED", "MILESTONE", "vhc", "service", ["parts"]),
  E("VHC_SENT", "COMMUNICATION", "vhc", "service", ["workshop"]),
  E("VHC_VIEWED", "COMMUNICATION", "vhc", "service"),
  E("VHC_AUTHORISED", "DECISION", "vhc", "service", ["workshop", "parts"]),
  E("VHC_DECLINED", "DECISION", "vhc", "service", ["workshop"]),
  E("VHC_ITEM_STATUS_CHANGED", "STATUS_TRANSITION", "vhc", "workshop", ["parts"]),
  E("VHC_COMPLETED", "MILESTONE", "vhc", "workshop", ["service"]),
  E("VHC_REOPENED", "DECISION", "vhc", "workshop", ["service"], true),
  E("VHC_MEDIA_UPLOADED", "DOCUMENT_MEDIA", "vhc", "workshop", ["service"]),

  // MOT (§4.5)
  E("MOT_BOOKED", "LIFECYCLE", "mot", "mot", ["service"]),
  E("MOT_TESTER_ASSIGNED", "ASSIGNMENT", "mot", "mot", ["management"]),
  E("MOT_STARTED", "MILESTONE", "mot", "mot"),
  E("MOT_RESULT_RECORDED", "DECISION", "mot", "mot", ["service", "workshop"], true),
  E("MOT_ADVISORY_ADDED", "DOCUMENT_MEDIA", "mot", "mot", ["service"]),
  E("MOT_RETEST_LINKED", "MILESTONE", "mot", "mot"),
  E("MOT_CERTIFICATE_ISSUED", "MILESTONE", "mot", "mot", ["accounts"]),

  // Valeting (§4.6)
  E("WASH_QUEUED", "LIFECYCLE", "valet", "valeting", ["workshop"]),
  E("WASH_STARTED", "MILESTONE", "valet", "valeting"),
  E("WASH_COMPLETED", "MILESTONE", "valet", "valeting", ["service"]),
  E("WASH_SKIPPED", "DECISION", "valet", "valeting", ["service"]),
  E("WASH_STATUS_CHANGED", "STATUS_TRANSITION", "valet", "valeting"),

  // Paint / Bodyshop (§4.7)
  E("PAINT_JOB_IDENTIFIED", "LIFECYCLE", "paint", "paint", ["workshop"]),
  E("PAINT_STAGE_CHANGED", "STATUS_TRANSITION", "paint", "paint", ["workshop"]),
  E("PAINT_PAINTER_ASSIGNED", "ASSIGNMENT", "paint", "paint", ["management"]),
  E("PAINT_MATERIAL_USED", "INVENTORY", "paint", "paint", ["parts", "accounts"]),
  E("PAINT_COMPLETED", "MILESTONE", "paint", "paint", ["valeting"]),

  // Accounts (§4.8)
  E("INVOICE_CREATED", "LIFECYCLE", "accounts", "accounts", ["service", "workshop", "parts"], true),
  E("INVOICE_ISSUED", "COMMUNICATION", "accounts", "accounts", [], true),
  E("INVOICE_STATUS_CHANGED", "STATUS_TRANSITION", "accounts", "accounts", [], true),
  E("INVOICE_PAID", "FINANCIAL", "accounts", "accounts", [], true),
  E("PAYMENT_RECEIVED", "FINANCIAL", "accounts", "accounts", [], true),
  E("INVOICE_VOIDED", "DECISION", "accounts", "accounts", ["management"], true),
  E("TRANSACTION_POSTED", "FINANCIAL", "accounts", "accounts", [], true),
  E("ACCOUNT_STATUS_CHANGED", "STATUS_TRANSITION", "accounts", "accounts", ["management"], true),
  E("CREDIT_LIMIT_CHANGED", "DECISION", "accounts", "accounts", ["management"], true),
  E("PAYSLIP_GENERATED", "FINANCIAL", "accounts", "accounts", ["hr", "admin"], true),
  E("PAYSLIP_VIEWED", "AUDIT_SECURITY", "accounts", "accounts", ["hr", "admin"], true),

  // Admin (§4.9)
  E("USER_CREATED", "LIFECYCLE", "admin", "admin", ["hr", "management"], true),
  E("ROLE_CHANGED", "AUDIT_SECURITY", "admin", "admin", ["management"], true),
  E("USER_DEACTIVATED", "LIFECYCLE", "admin", "admin", ["hr"], true),
  E("RECORD_DELETED", "AUDIT_SECURITY", "admin", "admin", [], true),
  E("LOGIN_SUCCEEDED", "AUDIT_SECURITY", "admin", "admin", [], true),
  E("LOGIN_FAILED", "AUDIT_SECURITY", "admin", "admin", [], true),
  E("CONSENT_RECORDED", "AUDIT_SECURITY", "admin", "admin", ["management"], true),
  E("DATA_EXPORTED", "AUDIT_SECURITY", "admin", "admin", ["management"], true),
  E("REPORT_VIEWED", "AUDIT_SECURITY", "admin", "admin", ["management"], true),
  E("REPORT_EXPORTED", "AUDIT_SECURITY", "admin", "admin", ["management"], true),
  E("CONFIG_CHANGED", "AUDIT_SECURITY", "admin", "admin", ["management"], true),

  // Management (§4.10)
  E("TARGET_SET", "DECISION", "management", "management", [], true),
  E("TARGET_CHANGED", "DECISION", "management", "management", [], true),
  E("ESCALATION_RAISED", "MILESTONE", "management", "management"),
  E("ESCALATION_RESOLVED", "MILESTONE", "management", "management"),
  E("SNAPSHOT_BUILT", "SYSTEM_AUTOMATED", "management", "system"),
  E("AGGREGATION_REBUILT", "SYSTEM_AUTOMATED", "management", "system", [], true),

  // System / Automated (§4.11)
  E("AUTO_CLOCKOUT", "SYSTEM_AUTOMATED", "system", "system", ["workshop"]),
  E("OVERTIME_AUTO_LOGGED", "SYSTEM_AUTOMATED", "system", "system", ["workshop"]),
  E("NOTIFICATION_SENT", "COMMUNICATION", "system", "system"),
  E("DVLA_SYNCED", "SYSTEM_AUTOMATED", "system", "system", ["mot"]),
  E("INTEGRATION_SYNCED", "SYSTEM_AUTOMATED", "system", "system"),
];

export const EVENT_CATALOGUE = Object.freeze(
  CATALOGUE.reduce((acc, entry) => {
    acc[entry.name] = Object.freeze(entry);
    return acc;
  }, {})
);

export const EVENT_NAMES = Object.freeze(Object.keys(EVENT_CATALOGUE));

// Events that must also write an audit_log row (Phase-2 §11.2).
export const AUDIT_REQUIRED_EVENTS = Object.freeze(
  CATALOGUE.filter((e) => e.audit).map((e) => e.name)
);

export function getEvent(name) {
  return EVENT_CATALOGUE[name] || null;
}

export function isKnownEvent(name) {
  return Boolean(name) && Object.prototype.hasOwnProperty.call(EVENT_CATALOGUE, name);
}

export function isEventAuditRequired(name) {
  return Boolean(getEvent(name)?.audit);
}

// Validate an event-name / category / department combination at emit time.
// Returns { ok, errors[] } (Phase-2 §13.1 event validation).
export function validateEvent({ eventName, eventCategory, ownerDepartment } = {}) {
  const errors = [];
  const entry = getEvent(eventName);
  if (!entry) {
    errors.push(`Unknown event_name "${eventName}" (not in catalogue)`);
  }
  if (eventCategory && !EVENT_CATEGORIES.includes(eventCategory)) {
    errors.push(`Unknown event_category "${eventCategory}"`);
  }
  if (entry && eventCategory && eventCategory !== entry.category) {
    errors.push(`event_category "${eventCategory}" != catalogue category "${entry.category}" for ${eventName}`);
  }
  const dept = ownerDepartment || entry?.ownerDepartment;
  if (dept && !DEPARTMENTS[dept]) {
    errors.push(`owner_department "${dept}" not in dim_department`);
  }
  return { ok: errors.length === 0, errors };
}

export default EVENT_CATALOGUE;
