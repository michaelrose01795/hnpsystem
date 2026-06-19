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
};

export default emitters;
