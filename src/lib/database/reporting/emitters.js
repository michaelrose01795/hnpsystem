// file location: src/lib/database/reporting/emitters.js
//
// PHASE 5 — Lifecycle emit adapters (Event Spine go-live + Status History).
//
// Thin, domain-specific wrappers over emitReportEvent (the fan-out in
// reportEvent.js). Operational write paths call ONE of these helpers at the
// point a lifecycle moment occurs; the adapter knows the correct event_name,
// entity linkage, status-history entity key and owner department for that moment,
// so the call-site stays a single line.
//
// Every adapter is NON-BLOCKING and best-effort (emitReportEvent swallows its own
// errors and is gated by the `reporting_emit_enabled` flag). Until that flag is
// flipped ON these are inert no-ops, so wiring them into operational code is safe
// and changes nothing a user sees (ADR-18 / Risk R10).
//
// Design choices:
//   - Jobs already write job_status_history operationally (the reference table),
//     so emitJob* writes ONLY the report_event — no duplicate history.
//   - Parts / VHC / Invoice write BOTH the report_event AND the per-entity
//     *_status_history row (those history tables are new — Phase-2 §6).
//   - owner_department is left to the catalogue default (eventCatalogue.js), which
//     is the §7.5 step-3 "event-name default" — the correct producing department.
//   - One event per transition (named milestone when it maps, else the generic
//     <ENTITY>_STATUS_CHANGED), both carrying from_state/to_state, so KPIs can
//     target a stable name without double-counting the same transition.

import { emitReportEvent } from "./reportEvent";

// ---------------------------------------------------------------------------
// JOB lifecycle (owner: workshop). History handled operationally — event only.
// ---------------------------------------------------------------------------
export async function emitJobStatusChanged({
  jobId,
  jobNumber = null,
  fromStatus = null,
  toStatus = null,
  actorUserId = null,
  actorRole = null,
  reason = null,
} = {}) {
  return emitReportEvent({
    event: {
      eventName: "JOB_STATUS_CHANGED",
      entityType: "job",
      entityId: jobId,
      fromState: fromStatus,
      toState: toStatus,
      actorUserId,
      actorRole,
      reason,
      payload: jobNumber ? { job_number: jobNumber } : null,
    },
    // No `history` — jobs.js already inserts job_status_history (the reference
    // table). Re-writing it here would duplicate the lifecycle record.
  });
}

export async function emitJobCreated({ jobId, jobNumber = null, type = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "JOB_CREATED",
      entityType: "job",
      entityId: jobId,
      toState: "booked",
      actorUserId,
      actorRole,
      payload: { job_number: jobNumber, type },
    },
  });
}

// ---------------------------------------------------------------------------
// VHC lifecycle (owner shifts with actor — catalogue defaults encode it).
// ---------------------------------------------------------------------------
export async function emitVhcCreated({ vhcId, jobId = null, severity = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "VHC_CREATED",
      entityType: "vhc_item",
      entityId: vhcId,
      parentEntityType: jobId ? "job" : null,
      parentEntityId: jobId,
      toState: "new",
      actorUserId,
      actorRole,
      payload: severity ? { severity } : null,
    },
    history: {
      entityKey: "vhc_item",
      entityId: vhcId,
      fromStatus: null,
      toStatus: "new",
      changedBy: actorUserId,
      reason: "created",
    },
  });
}

// Approval decision (authorise / decline) — drives conversion + re-auth audit.
export async function emitVhcDecision({
  vhcId,
  jobId = null,
  fromStatus = null,
  decision, // "authorised" | "declined"
  amountGbp = null,
  actorUserId = null,
  actorRole = null,
  actorKind = null,
  reason = null,
  // Job-level declinations (vhc_declinations has no vhc_id) emit the event only —
  // there is no single vhc_checks item transition to record in item history.
  writeHistory = true,
} = {}) {
  const declined = String(decision).toLowerCase().startsWith("decl");
  const eventName = declined ? "VHC_DECLINED" : "VHC_AUTHORISED";
  return emitReportEvent({
    event: {
      eventName,
      entityType: "vhc_item",
      entityId: vhcId,
      parentEntityType: jobId ? "job" : null,
      parentEntityId: jobId,
      fromState: fromStatus,
      toState: declined ? "declined" : "approved",
      amountGbp,
      actorUserId,
      actorRole,
      actorKind: actorKind || (actorUserId ? "user" : "customer"),
      reason,
    },
    history: writeHistory
      ? {
          entityKey: "vhc_item",
          entityId: vhcId,
          fromStatus,
          toStatus: declined ? "declined" : "approved",
          changedBy: actorUserId,
          actorKind: actorKind || (actorUserId ? "user" : "customer"),
          reason,
        }
      : null,
  });
}

// Generic VHC item status transition (workflow status helper).
export async function emitVhcItemStatusChanged({ vhcId, jobId = null, fromStatus = null, toStatus = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "VHC_ITEM_STATUS_CHANGED",
      entityType: "vhc_item",
      entityId: vhcId,
      parentEntityType: jobId ? "job" : null,
      parentEntityId: jobId,
      fromState: fromStatus,
      toState: toStatus,
      actorUserId,
      actorRole,
    },
    history: {
      entityKey: "vhc_item",
      entityId: vhcId,
      fromStatus,
      toStatus,
      changedBy: actorUserId,
    },
  });
}

export async function emitVhcSent({ vhcId = null, jobId = null, sendMethod = "email", actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "VHC_SENT",
      entityType: "vhc_item",
      entityId: vhcId ?? jobId,
      parentEntityType: jobId ? "job" : null,
      parentEntityId: jobId,
      actorUserId,
      actorRole,
      payload: { send_method: sendMethod },
    },
  });
}

// ---------------------------------------------------------------------------
// PARTS lifecycle (owner: parts; PART_FITTED owned by workshop per catalogue).
// One event per transition: named milestone when the target status maps, else
// the generic PART_STATUS_CHANGED. Always writes parts_job_items_status_history.
// ---------------------------------------------------------------------------
const PART_STATUS_EVENT = {
  on_order: "PART_ORDERED",
  allocated: "PART_ALLOCATED",
  pre_picked: "PART_PRE_PICKED",
  picked: "PART_PICKED",
  fitted: "PART_FITTED",
  cancelled: "PART_CANCELLED",
  removed: "PART_REMOVED",
  unavailable: "PART_UNAVAILABLE",
};

export function partEventForStatus(toStatusCanonical) {
  return PART_STATUS_EVENT[toStatusCanonical] || "PART_STATUS_CHANGED";
}

export async function emitPartStatusChanged({
  partId,
  jobId = null,
  fromStatus = null,
  toStatus = null,
  toStatusCanonical = null,
  quantity = null,
  actorUserId = null,
  actorAuthUuid = null,
  actorRole = null,
  reason = null,
} = {}) {
  const eventName = partEventForStatus(toStatusCanonical || toStatus);
  return emitReportEvent({
    event: {
      eventName,
      entityType: "part",
      entityId: partId,
      parentEntityType: jobId ? "job" : null,
      parentEntityId: jobId,
      fromState: fromStatus,
      toState: toStatus,
      quantity,
      actorUserId,
      actorAuthUuid,
      actorRole,
      reason,
    },
    history: {
      entityKey: "part",
      entityId: partId,
      fromStatus,
      toStatus,
      changedBy: actorUserId,
      reason,
      meta: quantity != null ? { quantity } : null,
    },
  });
}

// ---------------------------------------------------------------------------
// INVOICE / ACCOUNTS lifecycle (owner: accounts). Audit-required (catalogue).
// ---------------------------------------------------------------------------
export async function emitInvoiceCreated({ invoiceId, invoiceNumber = null, jobId = null, amountGbp = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "INVOICE_CREATED",
      entityType: "invoice",
      entityId: invoiceId,
      parentEntityType: jobId ? "job" : null,
      parentEntityId: jobId,
      toState: "draft",
      amountGbp,
      actorUserId,
      actorRole,
      payload: { invoice_number: invoiceNumber },
    },
    history: {
      entityKey: "invoice",
      entityId: invoiceId,
      fromStatus: null,
      toStatus: "draft",
      changedBy: actorUserId,
      reason: "created",
    },
  });
}

export async function emitInvoiceStatusChanged({ invoiceId, fromStatus = null, toStatus = null, amountGbp = null, actorUserId = null, actorRole = null, reason = null } = {}) {
  const paid = String(toStatus || "").toLowerCase() === "paid";
  return emitReportEvent({
    event: {
      eventName: paid ? "INVOICE_PAID" : "INVOICE_STATUS_CHANGED",
      entityType: "invoice",
      entityId: invoiceId,
      fromState: fromStatus,
      toState: toStatus,
      amountGbp,
      actorUserId,
      actorRole,
      reason,
    },
    history: {
      entityKey: "invoice",
      entityId: invoiceId,
      fromStatus,
      toStatus,
      changedBy: actorUserId,
      reason,
      meta: amountGbp != null ? { amount_gbp: amountGbp } : null,
    },
  });
}

export async function emitPaymentReceived({ invoiceId, amountGbp = null, method = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "PAYMENT_RECEIVED",
      entityType: "invoice",
      entityId: invoiceId,
      amountGbp,
      actorUserId,
      actorRole,
      payload: method ? { method } : null,
    },
  });
}

export async function emitTransactionPosted({ accountId = null, jobNumber = null, amountGbp = null, type = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "TRANSACTION_POSTED",
      entityType: "account",
      entityId: accountId,
      amountGbp,
      actorUserId,
      actorRole,
      payload: { type, job_number: jobNumber },
    },
  });
}

// ---------------------------------------------------------------------------
// MOT lifecycle (owner: mot). Phase-15 — completes §4.5. Result recording is
// audit-required (catalogue). History is written to mot_test_status_history,
// interim-keyed by the job id until the mot_tests entity lands (TD-E / P7).
// ---------------------------------------------------------------------------
export async function emitMotBooked({ jobId, vehicleId = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "MOT_BOOKED",
      entityType: "mot_test",
      entityId: jobId,
      parentEntityType: "job",
      parentEntityId: jobId,
      toState: "booked",
      actorUserId,
      actorRole,
      payload: vehicleId ? { vehicle_id: vehicleId } : null,
    },
    history: { entityKey: "mot_test", entityId: jobId, fromStatus: null, toStatus: "booked", changedBy: actorUserId, reason: "booked" },
  });
}

export async function emitMotTesterAssigned({ jobId, testerId = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "MOT_TESTER_ASSIGNED",
      entityType: "mot_test",
      entityId: jobId,
      parentEntityType: "job",
      parentEntityId: jobId,
      actorUserId,
      actorRole,
      payload: testerId != null ? { tester_id: testerId } : null,
    },
  });
}

export async function emitMotStarted({ jobId, testerId = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "MOT_STARTED",
      entityType: "mot_test",
      entityId: jobId,
      parentEntityType: "job",
      parentEntityId: jobId,
      fromState: "booked",
      toState: "in_test",
      actorUserId,
      actorRole,
      payload: testerId != null ? { tester_id: testerId } : null,
    },
    history: { entityKey: "mot_test", entityId: jobId, fromStatus: "booked", toStatus: "in_test", changedBy: actorUserId },
  });
}

// Pass / fail / retest result. Audit-required (compliance) — the catalogue marks
// MOT_RESULT_RECORDED audit:true, so emitReportEvent fans out an audit_log row.
export async function emitMotResultRecorded({ jobId, result = null, mileageAtTest = null, testerId = null, actorUserId = null, actorRole = null, reason = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "MOT_RESULT_RECORDED",
      entityType: "mot_test",
      entityId: jobId,
      parentEntityType: "job",
      parentEntityId: jobId,
      fromState: "in_test",
      toState: "result_recorded",
      actorUserId,
      actorRole,
      reason,
      payload: { result, mileage_at_test: mileageAtTest, tester_id: testerId },
    },
    history: {
      entityKey: "mot_test",
      entityId: jobId,
      fromStatus: "in_test",
      toStatus: "result_recorded",
      changedBy: actorUserId,
      reason,
      meta: { result, mileage_at_test: mileageAtTest, tester_id: testerId },
    },
  });
}

export async function emitMotAdvisoryAdded({ jobId, severity = null, defectCode = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "MOT_ADVISORY_ADDED",
      entityType: "mot_test",
      entityId: jobId,
      parentEntityType: "job",
      parentEntityId: jobId,
      actorUserId,
      actorRole,
      payload: { severity, defect_code: defectCode },
    },
  });
}

export async function emitMotRetestLinked({ jobId, originalTestId = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "MOT_RETEST_LINKED",
      entityType: "mot_test",
      entityId: jobId,
      parentEntityType: "job",
      parentEntityId: jobId,
      toState: "retest",
      actorUserId,
      actorRole,
      payload: originalTestId != null ? { original_test_id: originalTestId } : null,
    },
    history: { entityKey: "mot_test", entityId: jobId, fromStatus: "result_recorded", toStatus: "retest", changedBy: actorUserId },
  });
}

export async function emitMotCertificateIssued({ jobId, expiryDate = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "MOT_CERTIFICATE_ISSUED",
      entityType: "mot_test",
      entityId: jobId,
      parentEntityType: "job",
      parentEntityId: jobId,
      toState: "certificate_issued",
      actorUserId,
      actorRole,
      payload: expiryDate ? { expiry_date: expiryDate } : null,
    },
    history: { entityKey: "mot_test", entityId: jobId, fromStatus: "result_recorded", toStatus: "certificate_issued", changedBy: actorUserId },
  });
}

// ---------------------------------------------------------------------------
// WASH / VALETING lifecycle (owner: valeting). Phase-15 — completes §4.6.
// One event per transition: named milestone when the target state maps, else the
// generic WASH_STATUS_CHANGED. Always writes wash_status_history.
// ---------------------------------------------------------------------------
const WASH_STATUS_EVENT = {
  queued: "WASH_QUEUED",
  started: "WASH_STARTED",
  completed: "WASH_COMPLETED",
  skipped: "WASH_SKIPPED",
};

export function washEventForState(toStateCanonical) {
  return WASH_STATUS_EVENT[toStateCanonical] || "WASH_STATUS_CHANGED";
}

export async function emitWashStatusChanged({
  jobId,
  fromStatus = null,
  toStatus = null,
  toStatusCanonical = null,
  washAssignee = null,
  actorUserId = null,
  actorRole = null,
  reason = null,
} = {}) {
  const eventName = washEventForState(toStatusCanonical || toStatus);
  return emitReportEvent({
    event: {
      eventName,
      entityType: "wash",
      entityId: jobId,
      parentEntityType: "job",
      parentEntityId: jobId,
      fromState: fromStatus,
      toState: toStatus,
      actorUserId,
      actorRole,
      reason,
      payload: washAssignee != null ? { wash_assignee: washAssignee } : null,
    },
    history: {
      entityKey: "wash",
      entityId: jobId,
      fromStatus,
      toStatus,
      changedBy: actorUserId,
      reason,
      meta: washAssignee != null ? { wash_assignee: washAssignee } : null,
    },
  });
}

// ---------------------------------------------------------------------------
// PAINT / BODYSHOP lifecycle (owner: paint). Phase-15 — completes §4.7.
// Stage transitions map to PAINT_COMPLETED / PAINT_JOB_IDENTIFIED milestones,
// else the generic PAINT_STAGE_CHANGED. Writes paint_stage_history.
// ---------------------------------------------------------------------------
const PAINT_STAGE_EVENT = {
  identified: "PAINT_JOB_IDENTIFIED",
  completed: "PAINT_COMPLETED",
};

export function paintEventForStage(toStageCanonical) {
  return PAINT_STAGE_EVENT[toStageCanonical] || "PAINT_STAGE_CHANGED";
}

export async function emitPaintStageChanged({
  jobId,
  fromStage = null,
  toStage = null,
  toStageCanonical = null,
  bay = null,
  painterId = null,
  actorUserId = null,
  actorRole = null,
  reason = null,
} = {}) {
  const eventName = paintEventForStage(toStageCanonical || toStage);
  return emitReportEvent({
    event: {
      eventName,
      entityType: "paint_stage",
      entityId: jobId,
      parentEntityType: "job",
      parentEntityId: jobId,
      fromState: fromStage,
      toState: toStage,
      actorUserId,
      actorRole,
      reason,
      payload: { bay, painter_id: painterId },
    },
    history: {
      entityKey: "paint_stage",
      entityId: jobId,
      fromStatus: fromStage,
      toStatus: toStage,
      changedBy: actorUserId,
      reason,
      meta: { bay, painter_id: painterId },
    },
  });
}

export async function emitPaintPainterAssigned({ jobId, painterId = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "PAINT_PAINTER_ASSIGNED",
      entityType: "paint_stage",
      entityId: jobId,
      parentEntityType: "job",
      parentEntityId: jobId,
      actorUserId,
      actorRole,
      payload: painterId != null ? { painter_id: painterId } : null,
    },
  });
}

export async function emitPaintMaterialUsed({ jobId, paintCode = null, quantity = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "PAINT_MATERIAL_USED",
      entityType: "paint_stage",
      entityId: jobId,
      parentEntityType: "job",
      parentEntityId: jobId,
      quantity,
      actorUserId,
      actorRole,
      payload: { paint_code: paintCode },
    },
  });
}

// ---------------------------------------------------------------------------
// SERVICE — appointment lifecycle (owner: service). Writes appointment history.
// ---------------------------------------------------------------------------
export async function emitAppointmentStatusChanged({ appointmentId, jobId = null, fromStatus = null, toStatus = null, actorUserId = null, actorRole = null, reason = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "APPOINTMENT_STATUS_CHANGED",
      entityType: "appointment",
      entityId: appointmentId,
      parentEntityType: jobId ? "job" : null,
      parentEntityId: jobId,
      fromState: fromStatus,
      toState: toStatus,
      actorUserId,
      actorRole,
      reason,
    },
    history: { entityKey: "appointment", entityId: appointmentId, fromStatus, toStatus, changedBy: actorUserId, reason },
  });
}

// ---------------------------------------------------------------------------
// ACCOUNTS — credit-control lifecycle (owner: accounts). Audit-required.
// ---------------------------------------------------------------------------
export async function emitAccountStatusChanged({ accountId, fromStatus = null, toStatus = null, actorUserId = null, actorRole = null, reason = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "ACCOUNT_STATUS_CHANGED",
      entityType: "account",
      entityId: accountId,
      fromState: fromStatus,
      toState: toStatus,
      actorUserId,
      actorRole,
      reason,
    },
    history: { entityKey: "account", entityId: accountId, fromStatus, toStatus, changedBy: actorUserId, reason },
  });
}

export async function emitCreditLimitChanged({ accountId, fromLimit = null, toLimit = null, actorUserId = null, actorRole = null, reason = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "CREDIT_LIMIT_CHANGED",
      entityType: "account",
      entityId: accountId,
      fromState: fromLimit == null ? null : String(fromLimit),
      toState: toLimit == null ? null : String(toLimit),
      actorUserId,
      actorRole,
      reason,
      payload: { from_limit: fromLimit, to_limit: toLimit },
    },
  });
}

export async function emitInvoiceVoided({ invoiceId, amountGbp = null, actorUserId = null, actorRole = null, reason = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "INVOICE_VOIDED",
      entityType: "invoice",
      entityId: invoiceId,
      toState: "cancelled",
      amountGbp,
      actorUserId,
      actorRole,
      reason,
    },
    history: { entityKey: "invoice", entityId: invoiceId, toStatus: "cancelled", changedBy: actorUserId, reason },
  });
}

// ---------------------------------------------------------------------------
// ADMIN / SECURITY (owner: admin). All audit-required (catalogue) — closing the
// audit-coverage gaps the readiness audit found (role changes / deletes unlogged).
// ---------------------------------------------------------------------------
export async function emitRoleChanged({ userId, fromRole = null, toRole = null, actorUserId = null, actorRole = null, reason = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "ROLE_CHANGED",
      entityType: "user",
      entityId: userId,
      fromState: fromRole,
      toState: toRole,
      actorUserId,
      actorRole,
      reason,
      payload: { from_role: fromRole, to_role: toRole },
    },
    audit: { action: "role_changed", entityType: "user", entityId: userId, diff: { from_role: fromRole, to_role: toRole }, reason },
  });
}

export async function emitUserCreated({ userId, role = null, department = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "USER_CREATED",
      entityType: "user",
      entityId: userId,
      toState: "active",
      actorUserId,
      actorRole,
      payload: { role, department },
    },
  });
}

export async function emitUserDeactivated({ userId, actorUserId = null, actorRole = null, reason = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "USER_DEACTIVATED",
      entityType: "user",
      entityId: userId,
      toState: "inactive",
      actorUserId,
      actorRole,
      reason,
    },
  });
}

export async function emitRecordDeleted({ entityType, entityId, actorUserId = null, actorRole = null, reason = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "RECORD_DELETED",
      entityType: entityType || "record",
      entityId,
      actorUserId,
      actorRole,
      reason,
      payload: { entity_type: entityType, entity_id: entityId },
    },
  });
}

export async function emitConfigChanged({ key, fromValue = null, toValue = null, actorUserId = null, actorRole = null } = {}) {
  return emitReportEvent({
    event: {
      eventName: "CONFIG_CHANGED",
      entityType: "config",
      entityId: key,
      fromState: fromValue == null ? null : String(fromValue),
      toState: toValue == null ? null : String(toValue),
      actorUserId,
      actorRole,
      payload: { key, from: fromValue, to: toValue },
    },
  });
}

const emitters = {
  emitJobStatusChanged,
  emitJobCreated,
  emitVhcCreated,
  emitVhcDecision,
  emitVhcItemStatusChanged,
  emitVhcSent,
  emitPartStatusChanged,
  partEventForStatus,
  emitInvoiceCreated,
  emitInvoiceStatusChanged,
  emitPaymentReceived,
  emitTransactionPosted,
  // Phase-15 — MOT
  emitMotBooked,
  emitMotTesterAssigned,
  emitMotStarted,
  emitMotResultRecorded,
  emitMotAdvisoryAdded,
  emitMotRetestLinked,
  emitMotCertificateIssued,
  // Phase-15 — Valeting
  emitWashStatusChanged,
  washEventForState,
  // Phase-15 — Paint
  emitPaintStageChanged,
  paintEventForStage,
  emitPaintPainterAssigned,
  emitPaintMaterialUsed,
  // Phase-15 — Service / Accounts
  emitAppointmentStatusChanged,
  emitAccountStatusChanged,
  emitCreditLimitChanged,
  emitInvoiceVoided,
  // Phase-15 — Admin / security
  emitRoleChanged,
  emitUserCreated,
  emitUserDeactivated,
  emitRecordDeleted,
  emitConfigChanged,
};

export default emitters;
