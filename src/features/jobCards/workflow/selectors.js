// file location: src/features/jobCards/workflow/selectors.js
import {
  DISPLAY as JOB_STATUS_DISPLAY,
  NORMALIZE as NORMALIZE_JOB,
  STATUSES as JOB_STATUSES,
} from "@/lib/status/catalog/job";

// Small helper used across workflow summaries.
const normalizeText = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase();

export const getWriteUpChecklistTasks = (rawChecklist) => {
  if (Array.isArray(rawChecklist)) return rawChecklist;
  if (rawChecklist && typeof rawChecklist === "object") {
    return Array.isArray(rawChecklist.tasks) ? rawChecklist.tasks : [];
  }
  if (typeof rawChecklist !== "string") return [];

  try {
    const parsed = JSON.parse(rawChecklist);
    if (Array.isArray(parsed)) return parsed;
    return parsed && typeof parsed === "object" && Array.isArray(parsed.tasks)
      ? parsed.tasks
      : [];
  } catch {
    return [];
  }
};

const isCheckedWriteUpTask = (task) => {
  if (typeof task?.checked === "boolean") return task.checked;
  return ["complete", "completed", "done"].includes(normalizeText(task?.status));
};

// Match a customer request to its own write-up task. VHC rows can share a
// sort_order with customer requests, so source and request_id take precedence
// before the legacy positional fallback is considered.
export const isCustomerRequestCompleteInWriteUp = ({
  request,
  requestIndex = -1,
  checklistTasks = [],
} = {}) => {
  if (!request) return false;

  const requestId = Number(request?.requestId ?? request?.request_id ?? null);
  const sortOrder = Number(request?.sortOrder ?? request?.sort_order ?? null);

  return (Array.isArray(checklistTasks) ? checklistTasks : []).some((task) => {
    if (!task || typeof task !== "object" || !isCheckedWriteUpTask(task)) return false;
    const taskSource = normalizeText(task?.source);
    if (taskSource && taskSource !== "request") return false;

    const taskRequestId = Number(task?.requestId ?? task?.request_id ?? null);
    const hasRequestId = Number.isInteger(requestId) && requestId > 0;
    const hasTaskRequestId = Number.isInteger(taskRequestId) && taskRequestId > 0;
    if (hasRequestId && hasTaskRequestId) return taskRequestId === requestId;

    const taskSortOrder = Number(task?.sortOrder ?? task?.sort_order ?? null);
    if (Number.isInteger(sortOrder) && sortOrder > 0 && Number.isInteger(taskSortOrder)) {
      return taskSortOrder === sortOrder;
    }

    return (
      !hasTaskRequestId &&
      Number.isInteger(requestIndex) &&
      requestIndex >= 0 &&
      taskSortOrder === requestIndex + 1
    );
  });
};

// Normalize write-up completion status into a stable shape.
export const getWriteUpCompletionState = ({
  completionStatus = "",
  checklistTasks = [],
  requestRows = [],
} = {}) => {
  const normalized = normalizeText(completionStatus);
  const statusMarkedComplete =
    normalized === "complete" ||
    normalized === "waiting_additional_work" ||
    normalized === "completed" ||
    normalized === "done";

  const checkedTaskCount = Array.isArray(checklistTasks)
    ? checklistTasks.filter((task) => {
        if (!task || typeof task !== "object") return false;
        if (typeof task.checked === "boolean") return task.checked;
        const taskStatus = normalizeText(task.status);
        return taskStatus === "complete" || taskStatus === "completed" || taskStatus === "done";
      }).length
    : 0;

  const completedRequestCount = Array.isArray(requestRows)
    ? requestRows.filter((row) => {
        const rowStatus = normalizeText(row?.status);
        return rowStatus === "complete" || rowStatus === "completed" || rowStatus === "done";
      }).length
    : 0;

  const hasChecklistTasks = Array.isArray(checklistTasks) && checklistTasks.length > 0;
  const hasRequestRows = Array.isArray(requestRows) && requestRows.length > 0;
  // Persisted job-request rows drive the visible Write-up table, so they are
  // authoritative when present. The checklist remains the fallback for legacy
  // or synthetic rows that have not yet been materialised in job_requests.
  const checkedRowCount = hasRequestRows ? completedRequestCount : checkedTaskCount;
  const rowCount = hasRequestRows
    ? requestRows.length
    : hasChecklistTasks
      ? checklistTasks.length
      : 0;
  const allRowsChecked = rowCount > 0 && checkedRowCount === rowCount;

  return {
    normalized,
    statusMarkedComplete,
    checkedRowCount,
    rowCount,
    allRowsChecked,
    isPartiallyComplete: checkedRowCount > 0 && !allRowsChecked,
    isCompleteInstant:
      hasRequestRows || hasChecklistTasks
        ? allRowsChecked
        : statusMarkedComplete,
  };
};

// Customer-request rows follow the parent job workflow until a specific row
// (or the whole write-up) is complete. The persisted job_requests.status
// default is legacy data and must not make a booked request look started.
export const getCustomerRequestWorkflowStatus = ({
  jobStatus = "",
  writeUpComplete = false,
} = {}) => {
  if (writeUpComplete) return "completed";

  const mainJobStatus = NORMALIZE_JOB(jobStatus);
  return mainJobStatus === JOB_STATUSES.BOOKED || mainJobStatus === JOB_STATUSES.CHECKED_IN
    ? "not_started"
    : "inprogress";
};

export const getCustomerRequestEffectiveStatus = ({
  requestStatus = "",
  completedInWriteUp = false,
  workflowStatus = "inprogress",
} = {}) => {
  const normalizedRequestStatus = normalizeText(requestStatus);
  return completedInWriteUp || normalizedRequestStatus === "complete" || normalizedRequestStatus === "completed"
    ? "completed"
    : workflowStatus;
};

// A technician clocking is authoritative evidence that workshop work started,
// even when the persisted jobs.status row has not yet advanced from Checked In.
export const getClockingAwareJobStatus = ({
  jobStatus = "",
  statusLabel = "",
  hasClockingActivity = false,
} = {}) => {
  const storedStatusId = NORMALIZE_JOB(jobStatus);
  const wasPromoted = storedStatusId === JOB_STATUSES.CHECKED_IN && hasClockingActivity;
  const statusId = wasPromoted
    ? JOB_STATUSES.IN_PROGRESS
    : storedStatusId;

  return {
    statusId,
    statusLabel: wasPromoted
      ? JOB_STATUS_DISPLAY[JOB_STATUSES.IN_PROGRESS]
      : String(statusLabel || JOB_STATUS_DISPLAY[statusId] || jobStatus || "").trim(),
  };
};

// Build the cross-table completion writes required for authorised VHC rows in
// the Write-up workspace. job_requests drives the table list, while vhc_checks
// remains the canonical VHC workflow source, so both records must agree.
export const getVhcCompletionUpdatesFromWriteUpTasks = (tasks = []) => {
  const updatesByVhcId = new Map();

  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    if (normalizeText(task?.source) !== "vhc") return;

    const vhcItemId = Number(task?.vhcItemId ?? task?.vhc_item_id ?? null);
    if (!Number.isInteger(vhcItemId) || vhcItemId <= 0) return;

    const complete =
      typeof task?.checked === "boolean"
        ? task.checked
        : ["complete", "completed", "done"].includes(normalizeText(task?.status));

    updatesByVhcId.set(vhcItemId, { vhcItemId, complete });
  });

  return Array.from(updatesByVhcId.values());
};

// Build invoice blockers and cross-tab readiness from shared inputs.
export const getInvoiceWorkflowState = ({
  writeUpComplete,
  vhcRequired,
  vhcQualified,
  vhcSummaryRowsCompleted,
  mileageRecorded,
  partsAllocated,
  partsReady,
  partsIssues = [],
  statusReadyForInvoicing,
} = {}) => {
  const invoicePrerequisitesMet =
    Boolean(writeUpComplete) &&
    Boolean(vhcQualified) &&
    (!vhcRequired || Boolean(vhcSummaryRowsCompleted)) &&
    Boolean(mileageRecorded) &&
    Boolean(partsReady) &&
    Boolean(partsAllocated);

  const invoiceBlockingReasons = [];

  if (!writeUpComplete) {
    invoiceBlockingReasons.push("Complete and mark the write up as finished.");
  }
  if (!vhcQualified) {
    invoiceBlockingReasons.push("Complete the Vehicle Health Check or mark it as not required.");
  }
  if (vhcRequired && !vhcSummaryRowsCompleted) {
    invoiceBlockingReasons.push("Set every VHC Summary row status to Complete or Declined.");
  }
  if (!mileageRecorded) {
    invoiceBlockingReasons.push("Enter current mileage in the Vehicle section.");
  }
  if (!partsAllocated) {
    invoiceBlockingReasons.push("Allocate every booked part to a request or additional request.");
  }
  if (!partsReady) {
    if (Array.isArray(partsIssues) && partsIssues.length > 0) {
      invoiceBlockingReasons.push(
        `Parts tab – review each allocated part in 'Parts Added to Job' (ignore removed rows), then make sure Quantity Allocated meets Quantity Requested and Unit Price is entered before invoicing. Items needing updates: ${partsIssues.join("; ")}.`
      );
    } else {
      invoiceBlockingReasons.push(
        "Parts tab – in 'Parts Added to Job' (excluding removed rows), allocate every part to a request, confirm Quantity Allocated is set correctly, and enter a Unit Price for each allocated part."
      );
    }
  }

  return {
    invoicePrerequisitesMet,
    invoiceBlockingReasons,
    showProformaCompleteSection:
      invoicePrerequisitesMet && Boolean(statusReadyForInvoicing),
  };
};

// Deterministic assistant guidance based on existing workflow data.
export const getNextBestAction = ({
  canEdit,
  canViewPartsTab,
  canViewVhcTab,
  isInvoiceOrBeyondReadOnly,
  overallStatusId,
  writeUpComplete,
  vhcRequired,
  vhcSummaryRowsCompleted,
  partsAllocated,
  partsReady,
  mileageRecorded,
  invoicePrerequisitesMet,
  invoiceBlockingReasons = [],
} = {}) => {
  const blockers = Array.isArray(invoiceBlockingReasons) ? invoiceBlockingReasons : [];

  const buildResponse = ({ title, ownerRole, action, reason }) => ({
    title,
    ownerRole,
    action,
    reason,
    blockers,
  });

  if (isInvoiceOrBeyondReadOnly) {
    return buildResponse({
      title: "Read-only workflow stage",
      ownerRole: "Manager/Admin",
      action: "Review invoice/payment/release status.",
      reason: "This job is in a locked stage for most workshop edits.",
    });
  }

  if (!canEdit) {
    return buildResponse({
      title: "Awaiting an editing role",
      ownerRole: "Service Manager",
      action: "Assign or involve a user with edit permissions.",
      reason: "Your role can view but cannot progress editable workflow steps.",
    });
  }

  if (!writeUpComplete) {
    return buildResponse({
      title: "Complete write-up tasks",
      ownerRole: "Technician",
      action: "Finish and mark write-up tasks as complete.",
      reason: "Write-up completion is a hard gate before invoicing.",
    });
  }

  if (vhcRequired && canViewVhcTab && !vhcSummaryRowsCompleted) {
    return buildResponse({
      title: "Resolve VHC summary decisions",
      ownerRole: "Service Advisor",
      action: "Set all VHC summary rows to Completed or Declined.",
      reason: "VHC summary is still blocking invoice readiness.",
    });
  }

  if (!mileageRecorded) {
    return buildResponse({
      title: "Record mileage",
      ownerRole: "Service Reception",
      action: "Enter and save current vehicle mileage.",
      reason: "Mileage is required before invoicing.",
    });
  }

  if (canViewPartsTab && (!partsAllocated || !partsReady)) {
    return buildResponse({
      title: "Complete parts allocation/pricing",
      ownerRole: "Parts",
      action: "Allocate all booked parts and confirm pricing/quantities.",
      reason: "Parts workflow is still blocking invoice readiness.",
    });
  }

  if (invoicePrerequisitesMet && overallStatusId === JOB_STATUSES.IN_PROGRESS) {
    return buildResponse({
      title: "Ready for invoice",
      ownerRole: "Admin / Accounts",
      action: "Review proforma and create final invoice.",
      reason: "All workflow gates currently appear satisfied.",
    });
  }

  return buildResponse({
    title: "Monitor workflow progression",
    ownerRole: "Workshop Manager",
    action: "Review current status and continue standard progression.",
    reason: "No high-priority blockers were detected.",
  });
};
