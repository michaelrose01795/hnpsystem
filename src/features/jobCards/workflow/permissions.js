// file location: src/features/jobCards/workflow/permissions.js
import { STATUSES as JOB_STATUSES } from "@/lib/status/catalog/job";
import { resolveMainStatusId } from "@/lib/status/statusFlow";

// Build a shared permission model for the job-card workflow page.
export const resolveJobCardPermissions = ({
  userRoles = [],
  jobStatus = "",
  isArchiveMode = false,
  isValetMode = false,
  vhcRequired = false,
} = {}) => {
  // Normalize role strings once to ensure matching is consistent.
  const normalizedRoles = (Array.isArray(userRoles) ? userRoles : [])
    .map((role) => String(role || "").trim().toLowerCase())
    .filter(Boolean);

  // Shared role buckets used across tabs.
  const canEditBase = [
    "service",
    "service manager",
    "workshop manager",
    "admin",
    "admin manager",
    "parts",
    "parts manager",
  ].some((role) => normalizedRoles.includes(role));

  const canManageDocumentsBase = [
    "service manager",
    "workshop manager",
    "after-sales manager",
    "admin",
    "admin manager",
  ].some((role) => normalizedRoles.includes(role));

  const canViewPartsTab = [
    "workshop manager",
    "service manager",
    "parts",
    "parts manager",
    "after-sales manager",
  ].some((role) => normalizedRoles.includes(role));

  const isWorkshopManager = normalizedRoles.includes("workshop manager");

  // Resolve current main status once for consistent lock decisions.
  const mainStatusForEditLock = resolveMainStatusId(jobStatus);
  const statusLower = String(jobStatus || "").trim().toLowerCase();

  // Read-only rule in existing flow: Invoiced/Released/Archived lock most tabs.
  const isInvoiceOrBeyondReadOnly =
    mainStatusForEditLock === JOB_STATUSES.INVOICED ||
    mainStatusForEditLock === JOB_STATUSES.RELEASED ||
    statusLower === "archived";

  const canEdit = !isArchiveMode && !isInvoiceOrBeyondReadOnly && canEditBase;
  const canManageDocuments =
    !isArchiveMode && !isInvoiceOrBeyondReadOnly && canManageDocumentsBase;

  const canUseReleaseAction =
    !isArchiveMode &&
    canEditBase &&
    mainStatusForEditLock === JOB_STATUSES.INVOICED;

  const canViewVhcTab = Boolean(vhcRequired || isWorkshopManager);

  const isPartsWriteUpVhcLockedByStatus =
    mainStatusForEditLock === JOB_STATUSES.BOOKED ||
    mainStatusForEditLock === JOB_STATUSES.INVOICED ||
    mainStatusForEditLock === JOB_STATUSES.RELEASED;

  const canEditPartsWriteUpVhc = canEdit && !isPartsWriteUpVhcLockedByStatus;

  const isClockingLockedByStatus =
    mainStatusForEditLock === JOB_STATUSES.INVOICED ||
    mainStatusForEditLock === JOB_STATUSES.RELEASED;

  // Existing explanatory copy kept centralized so tabs stay consistent.
  const clockingLockDescription =
    mainStatusForEditLock === JOB_STATUSES.INVOICED
      ? "Clocking is locked because this job has been invoiced."
      : mainStatusForEditLock === JOB_STATUSES.RELEASED
      ? "Clocking is locked because this job has been released."
      : "Clocking is locked for the current job status.";

  const generalReadOnlyLockDescription = isInvoiceOrBeyondReadOnly
    ? `This tab is locked because the job is ${jobStatus || "read-only"}.`
    : "";

  const partsWriteUpVhcLockDescription =
    mainStatusForEditLock === JOB_STATUSES.BOOKED
      ? "This section unlocks when the job is moved to Checked In or In Progress."
      : mainStatusForEditLock === JOB_STATUSES.INVOICED
      ? "This section unlocks if the job status is moved back to In Progress by a manager."
      : mainStatusForEditLock === JOB_STATUSES.RELEASED
      ? "This section unlocks if the job is moved back from Released to In Progress by a manager."
      : "This section is locked for the current job status.";

  // Keep lock sets centralized so tab shell and content use same source.
  const lockedTabIds = new Set(
    isInvoiceOrBeyondReadOnly
      ? [
          "customer-requests",
          "contact",
          "scheduling",
          "parts",
          "notes",
          "write-up",
          "vhc",
          "warranty",
          "clocking",
          "documents",
        ]
      : [
          ...(isPartsWriteUpVhcLockedByStatus ? ["parts", "write-up", "vhc"] : []),
          ...(isClockingLockedByStatus ? ["clocking"] : []),
        ]
  );

  // Keep tab availability in one place.
  const tabs = isValetMode
    ? [
        { id: "customer-requests", label: "Customer Requests" },
        { id: "documents", label: "Documents" },
      ]
    : [
        { id: "customer-requests", label: "Customer Requests" },
        { id: "contact", label: "Contact" },
        { id: "scheduling", label: "Scheduling" },
        { id: "service-history", label: "Service History" },
        { id: "notes", label: "Notes" },
        ...(canViewPartsTab ? [{ id: "parts", label: "Parts" }] : []),
        { id: "write-up", label: "Write Up" },
        ...(canViewVhcTab ? [{ id: "vhc", label: "VHC" }] : []),
        { id: "warranty", label: "Warranty" },
        { id: "clocking", label: "Clocking" },
        { id: "messages", label: "Messages" },
        { id: "documents", label: "Documents" },
        { id: "invoice", label: "Invoice" },
      ];

  return {
    normalizedRoles,
    isWorkshopManager,
    mainStatusForEditLock,
    isInvoiceOrBeyondReadOnly,
    canEditBase,
    canEdit,
    canManageDocuments,
    canUseReleaseAction,
    canViewPartsTab,
    canViewVhcTab,
    canEditPartsWriteUpVhc,
    isPartsWriteUpVhcLockedByStatus,
    isClockingLockedByStatus,
    clockingLockDescription,
    generalReadOnlyLockDescription,
    partsWriteUpVhcLockDescription,
    lockedTabIds,
    tabs,
  };
};
