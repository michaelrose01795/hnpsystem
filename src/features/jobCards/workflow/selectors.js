// file location: src/features/jobCards/workflow/selectors.js
import { STATUSES as JOB_STATUSES } from "@/lib/status/catalog/job";

// Small helper used across workflow summaries.
const normalizeText = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase();

// Normalize write-up completion status into a stable shape.
export const getWriteUpCompletionState = ({
  completionStatus = "",
  checklistTasks = [],
} = {}) => {
  const normalized = normalizeText(completionStatus);
  const statusMarkedComplete =
    normalized === "complete" ||
    normalized === "waiting_additional_work" ||
    normalized === "completed" ||
    normalized === "done";

  const allRowsChecked =
    Array.isArray(checklistTasks) &&
    checklistTasks.length > 0 &&
    checklistTasks.every((task) => {
      if (!task || typeof task !== "object") return false;
      if (typeof task.checked === "boolean") return task.checked;
      const taskStatus = normalizeText(task.status);
      return taskStatus === "complete" || taskStatus === "completed" || taskStatus === "done";
    });

  return {
    normalized,
    statusMarkedComplete,
    allRowsChecked,
    isCompleteInstant:
      Array.isArray(checklistTasks) && checklistTasks.length > 0
        ? allRowsChecked
        : statusMarkedComplete,
  };
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
