// file location: src/features/jobCards/workflow/jobSettings.js
//
// Rules for the Job Card Settings control centre (/job-cards/[jobNumber] →
// settings popup). Pure functions only, so the popup and the
// /api/job-cards/[jobNumber]/settings route evaluate exactly the same rules.
//
// Nothing here redefines the workflow. Status ids, labels, order and allowed
// transitions come from the canonical catalog (src/lib/status/catalog/job.js)
// and flow (src/lib/status/statusFlow.js); permissions come from
// resolveJobCardPermissions (./permissions.js). This file only classifies a
// requested change against them.

import { DISPLAY as JOB_DISPLAY, STATUSES as JOB_STATUSES } from "@/lib/status/catalog/job";
import { MAIN_STATUS_ORDER, isValidTransition, resolveMainStatusId } from "@/lib/status/statusFlow";

/* ------------------------------------------------------------------------ */
/* Option sets                                                               */
/* ------------------------------------------------------------------------ */

// Stored in jobs.priority (migration 20260923120000_job_card_settings_fields).
// `tone` maps onto the badge family variants.
export const JOB_PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal", tone: "neutral" },
  { value: "priority", label: "Priority", tone: "accent-soft" },
  { value: "urgent", label: "Urgent", tone: "danger" },
  { value: "vehicle_waiting", label: "Vehicle waiting", tone: "warning" },
  { value: "comeback", label: "Comeback", tone: "danger-strong" },
];

export const getJobPriorityOption = (value) =>
  JOB_PRIORITY_OPTIONS.find((option) => option.value === value) || JOB_PRIORITY_OPTIONS[0];

// The values job creation writes (src/pages/job-cards/create, createJobService).
export const JOB_SOURCE_OPTIONS = ["Retail", "Warranty"];
export const JOB_DIVISION_OPTIONS = ["Retail", "Sales"];
export const JOB_WAITING_STATUS_OPTIONS = ["Waiting", "Loan Car", "Collection", "Neither"];

// jobs.type is derived from the source, never picked freely — the rule job
// creation has always applied.
export const resolveJobTypeForSource = (jobSource) =>
  jobSource === "Warranty" ? "Warranty" : "Service";

export const JOB_CANCELLATION_REASONS = [
  "Customer cancelled",
  "Customer did not attend",
  "Booked in error",
  "Duplicate job card",
  "Parts unavailable",
  "Other",
];

// Every workflow-breaking change must carry a reason a manager could act on
// later, not a one-word placeholder.
export const SETTINGS_REASON_MIN_LENGTH = 10;

export const isReasonValid = (value) =>
  String(value || "").trim().length >= SETTINGS_REASON_MIN_LENGTH;

/* ------------------------------------------------------------------------ */
/* Status changes                                                            */
/* ------------------------------------------------------------------------ */

// The statuses the manual control offers. Cancelled is deliberately absent:
// cancelling has its own Danger Zone flow with a mandatory cancellation reason.
export const MANUAL_STATUS_OPTIONS = MAIN_STATUS_ORDER.map((id) => ({
  value: id,
  label: JOB_DISPLAY[id],
}));

// Moving to one of these while a technician is clocked on would strand the
// clocking entry against a job the workshop can no longer work.
const STATUSES_BLOCKED_BY_ACTIVE_CLOCKING = new Set([
  JOB_STATUSES.BOOKED,
  JOB_STATUSES.CHECKED_IN,
  JOB_STATUSES.INVOICED,
  JOB_STATUSES.RELEASED,
  JOB_STATUSES.CANCELLED,
]);

/**
 * Classify a requested main-status change.
 *
 * forward  — the canonical flow allows it (statusFlow.isValidTransition).
 * override — anything else: a backward move, a skipped stage, or leaving a
 *            final status. Needs a manager / admin and a written reason.
 */
export function planStatusChange({ currentStatus, targetStatus, hasActiveClocking = false } = {}) {
  const fromId = resolveMainStatusId(currentStatus);
  const toId = resolveMainStatusId(targetStatus);
  const fromIndex = MAIN_STATUS_ORDER.indexOf(fromId);
  const toIndex = MAIN_STATUS_ORDER.indexOf(toId);

  const isSame = Boolean(fromId) && fromId === toId;
  const isForward = Boolean(fromId && toId) && !isSame && isValidTransition(fromId, toId);
  // An unknown current status (legacy "Open" / "New") has no transition row,
  // so any move out of it is treated as an override rather than guessed at.
  const requiresOverride = Boolean(toId) && !isSame && !isForward;
  const isBackward = fromIndex >= 0 && toIndex >= 0 && toIndex < fromIndex;
  const isReopen =
    toId === JOB_STATUSES.IN_PROGRESS &&
    (fromId === JOB_STATUSES.INVOICED || fromId === JOB_STATUSES.RELEASED);
  const blockedByClocking = hasActiveClocking && STATUSES_BLOCKED_BY_ACTIVE_CLOCKING.has(toId);

  return {
    fromId,
    toId,
    fromLabel: JOB_DISPLAY[fromId] || currentStatus || "Unknown",
    toLabel: JOB_DISPLAY[toId] || targetStatus || "Unknown",
    isValidTarget: Boolean(toId) && toId !== JOB_STATUSES.CANCELLED,
    isSame,
    isForward,
    isBackward,
    isReopen,
    requiresOverride,
    requiresReason: requiresOverride,
    blockedByClocking,
  };
}

/**
 * Why a status change cannot be made, or null when it can. `permissions` is
 * the resolveJobCardPermissions result for the acting user.
 */
export function getStatusChangeBlocker(plan, permissions = {}, { reason = "" } = {}) {
  if (!plan?.isValidTarget) return "Choose a status to move the job to.";
  if (plan.isSame) return `The job is already ${plan.toLabel}.`;
  if (plan.blockedByClocking) {
    return `A technician is clocked on. Clock them off before moving the job to ${plan.toLabel}.`;
  }
  if (plan.requiresOverride) {
    if (!permissions.canOverrideWorkflow) {
      return `Moving from ${plan.fromLabel} to ${plan.toLabel} breaks the normal workflow and needs a manager or admin.`;
    }
    if (!isReasonValid(reason)) {
      return `Give a reason of at least ${SETTINGS_REASON_MIN_LENGTH} characters for this override.`;
    }
    return null;
  }
  // Forward moves follow the same rules as the buttons that normally make them.
  if (plan.toId === JOB_STATUSES.RELEASED) {
    return permissions.canUseReleaseAction ? null : "Only service and workshop staff can release an invoiced job.";
  }
  return permissions.canEdit ? null : "You do not have permission to change this job's status.";
}

/* ------------------------------------------------------------------------ */
/* Workflow locks                                                            */
/* ------------------------------------------------------------------------ */

/**
 * The locks currently applied to the job card, described from the canonical
 * permission flags — so the list can never disagree with what the tabs enforce.
 */
export function describeWorkflowLocks(permissions = {}, { isArchiveMode = false, statusLabel = "" } = {}) {
  const locks = [];
  if (isArchiveMode) {
    locks.push({
      id: "archived",
      label: "Archived",
      description: "This is the archived copy. Every tab is read-only and kept for audit.",
      overridable: false,
    });
    return locks;
  }
  if (permissions.isInvoiceOrBeyondReadOnly) {
    locks.push({
      id: "read-only",
      label: `${statusLabel || "Invoiced"} — read-only`,
      description:
        "Customer requests, contact, scheduling, parts, notes, write-up, VHC, warranty, clocking and documents are locked. Key and car locations stay editable until the job is archived.",
      overridable: Boolean(permissions.canReopenJob),
      overrideLabel: "Reopen job",
    });
  }
  if (!permissions.isInvoiceOrBeyondReadOnly && permissions.isPartsWriteUpVhcLockedByStatus) {
    locks.push({
      id: "parts-writeup-vhc",
      label: "Parts, write-up and VHC",
      description: permissions.partsWriteUpVhcLockDescription,
      overridable: false,
    });
  }
  if (!permissions.isInvoiceOrBeyondReadOnly && permissions.isClockingLockedByStatus) {
    locks.push({
      id: "clocking",
      label: "Clocking",
      description: permissions.clockingLockDescription,
      overridable: false,
    });
  }
  if (!permissions.canEditBase) {
    locks.push({
      id: "role",
      label: "Your role",
      description: "Your role can view this job card but not change it.",
      overridable: false,
    });
  }
  return locks;
}
