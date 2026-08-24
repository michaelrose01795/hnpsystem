// file location: src/components/page-ui/job-cards/myjobs/job-cards-myjobs-job-number-ui.js
import { useRef, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import useIsMobile from "@/hooks/useIsMobile";
import VhcMediaGallery from "@/components/VHC/VhcMediaGallery"; // read-only viewer for media captured during the health check
import { collectLinkedPartRows, resolveLinkedPrePickLocation } from "@/lib/prePickLocations"; // Pre-pick single source of truth = parts_job_items (see project_pre_pick_location).
import {
  TECHNICIAN_JOB_TAB_LABELS,
  TechnicianJobContentShell,
  TechnicianJobHeader,
  TechnicianJobSummaryCard,
  TechnicianJobSummaryGrid,
  TechnicianJobTabRow,
} from "@/components/JobCards/TechnicianJobLayout";

const compactLabelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "12px",
  fontWeight: "700",
  color: "var(--text-1)",
};

const formatRequestStatusLabel = (status) => {
  const value = String(status || "sent").trim().toLowerCase();
  const labels = {
    pending: "Sent",
    waiting_authorisation: "Sent",
    being_checked: "Being Checked",
    priced: "Price Available",
    awaiting_approval: "Awaiting Approval",
    ordered: "Ordered",
    on_order: "Ordered",
    allocated: "Ready to Collect",
    pre_picked: "Ready to Collect",
    picked: "Ready to Collect",
    stock: "Ready to Collect",
    issued: "Issued",
    fulfilled: "Fitted",
    fitted: "Fitted",
    declined: "Declined",
    unavailable: "Declined",
    cancelled: "Cancelled",
  };
  return labels[value] || value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const extractRequestDetail = (description = "", label) => {
  const match = String(description || "").match(new RegExp(`${label}:\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim() || "";
};

const resolveRequestPartName = (request) => {
  if (request?.part?.name) return request.part.name;
  const partRequired = extractRequestDetail(request?.description, "Part required");
  if (partRequired) return partRequired;
  return `Individual request #${request?.request_id || request?.requestId || ""}`.trim();
};

const resolveBookedPartName = (part) =>
  part?.part?.name ||
  part?.part_name_snapshot ||
  part?.partNameSnapshot ||
  part?.row_description ||
  part?.rowDescription ||
  "Booked part";

const resolveBookedPartNumber = (part) =>
  part?.part?.partNumber ||
  part?.part?.part_number ||
  part?.part_number_snapshot ||
  part?.partNumberSnapshot ||
  "";

const resolveBookedPartQuantity = (part, camelKey, snakeKey) => {
  const value = Number(part?.[camelKey] ?? part?.[snakeKey] ?? 0);
  return Number.isFinite(value) ? value : 0;
};

function QuickStatCard({ stat, sectionKey, scrollTargetId }) {
  if (!stat) return null;

  const isClickable = Boolean(scrollTargetId || stat.onClick);
  const CardTag = isClickable ? "button" : "div";
  const handleClick = () => {
    if (scrollTargetId) {
      document.getElementById(scrollTargetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      return;
    }
    stat.onClick?.();
  };

  return (
    <TechnicianJobSummaryCard
      as={CardTag}
      type={isClickable ? "button" : undefined}
      sectionKey={sectionKey}
      sectionType="stat-card"
      backgroundToken="theme"
      data-dev-text-preview={`${stat.value} ${stat.label}`}
      gap="6px"
      onClick={isClickable ? handleClick : undefined}
      style={{
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        cursor: isClickable ? "pointer" : "default"
      }}
    >
      <div style={{
        fontSize: stat.pill ? "15px" : "24px",
        fontWeight: "700",
        color: "var(--text-1)",
        backgroundColor: stat.pill ? `${stat.accent}15` : "transparent",
        padding: stat.pill ? "6px 14px" : 0,
        borderRadius: stat.pill ? "var(--control-radius)" : 0,
        letterSpacing: stat.pill ? "0.04em" : 0,
        textTransform: stat.pill ? "uppercase" : "none"
      }}>
        {stat.value}
      </div>
      <span style={{
        fontSize: "12px",
        color: "var(--text-1)",
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: "0.04em"
      }}>
        {stat.label}
      </span>
    </TechnicianJobSummaryCard>
  );
}

export default function TechJobDetailPageUi(props) {
  const {
    BrakesHubsDetailsModal,
    Button,
    CustomerVideoButton,
    CustomerRequestsTab,
    DevLayoutSection,
    DocumentsTab,
    DocumentsUploadPopup,
    ExternalDetailsModal,
    InlineLoading,
    InternalElectricsDetailsModal,
    LocationUpdateModal,
    ModalPortal,
    MyJobCardShellSkeleton,
    NotesTabNew,
    ServiceIndicatorDetailsModal,
    UndersideDetailsModal,
    VhcAssistantPanel,
    VhcCameraButton,
    WheelsTyresDetailsModal,
    WriteUpForm,
    WriteUpWorkspace,
    activeSection,
    activeTab,
    authorisedVhcItems,
    authorizedVhcRows,
    authorizedVhcRowsLoading,
    authorizedParts,
    authorizedPartsLoading,
    canClockIntoMotHandoff,
    canCompleteJob,
    canCompleteVhc,
    canEditTrackingLocations,
    canManageDocuments,
    canEditWorkspace,
    clockInLoading,
    clockOutLoading,
    completeJobFeedback,
    completeJobLockedTitle,
    customer,
    dbUserId,
    detectedJobTypes,
    fetchJobData,
    formatDateTime,
    formatPrePickLabel,
    getBadgeState,
    getOptionalCount,
    getPartsStatusStyle,
    handleAddNote,
    handleCompleteJob,
    handleCompleteVhcClick,
    handleDeleteDocument,
    handleJobClockIn,
    handleJobClockOut,
    handlePartsRequestSubmit,
    handlePartsRequestAction,
    handlePartsRequestNote,
    handlePartJobItemAction,
    handleRenameDocument,
    handleReplaceDocument,
    handleMarkAllRequestsComplete,
    handleNotesChange,
    handleSaveRequestWorkDetails,
    handleSaveWriteUp,
    handleSectionComplete,
    handleSectionDismiss,
    handleTrackerSave,
    handleUpdateRequests,
    handleUpdateRequestStatus,
    isHeaderCompleteStatus,
    isReopenMode,
    isVhcCompleted,
    jobCard,
    jobClocking,
    jobData,
    jobDocuments,
    jobNumber,
    jobStatusBadgeStyle,
    newNote,
    notes,
    notesLoading,
    notesSubmitting,
    actingUserNumericId,
    openSection,
    partRequestDescription,
    partRequestQuantity,
    partsFeedback,
    partsRequests,
    partsRequestsLoading,
    partsSubmitting,
    prePickByVhcId,
    quickStats,
    router,
    saveError,
    saveStatus,
    sectionStatus,
    setActiveTab,
    setJobData,
    setLiveWriteUpTasks,
    setNewNote,
    setPartRequestDescription,
    setPartRequestQuantity,
    setPartsFeedback,
    setShowAddNote,
    setShowDocumentsPopup,
    setShowGreenItems,
    setShowJobTypesPopup,
    setShowVhcSummary,
    setTrackerQuickModalOpen,
    showAddNote,
    showDocumentsPopup,
    showGreenItems,
    showJobTypesPopup,
    showVhcReopenButton,
    showVhcSummary,
    techStatusDisplay,
    trackerEntry,
    trackerQuickModalOpen,
    user,
    vehicle,
    vhcAssistantState,
    vhcChecks,
    vhcCustomerStatus,
    vhcData,
    vhcSummaryItems,
    vhcTabAmberReady,
    visibleTabs,
    workspaceClockingEntries,
    workspaceJobData,
    workspaceOverallStatusId,
    writeUpTabComplete,
    writeUpTabPartiallyComplete,
  } = props; // receive page logic props.

  // Bumped after any VHC media upload so the read-only gallery below re-fetches
  // the job's files and the technician sees their capture immediately.
  const [galleryReloadToken, setGalleryReloadToken] = useState(0);
  const bumpGallery = () => setGalleryReloadToken((token) => token + 1);
  // The tech route supplies the page payload as `{ jobCard, vehicle, ... }`.
  // Media uploads can fall back to jobNumber, but the gallery requires the
  // numeric job id, so every camera/gallery call must use the nested id.
  const resolvedJobId = jobData?.jobCard?.id || jobData?.id || jobCard?.id || null;
  const isMobile = useIsMobile(767);
  const [partAttachments, setPartAttachments] = useState([]);
  const [partsUploadBusy, setPartsUploadBusy] = useState(false);
  const [partsValidationError, setPartsValidationError] = useState("");
  const [expandedPartRequestId, setExpandedPartRequestId] = useState(null);
  const [editingPartRequestId, setEditingPartRequestId] = useState(null);
  const [editingPartRequestText, setEditingPartRequestText] = useState("");
  const [requestNoteDrafts, setRequestNoteDrafts] = useState({});
  const partAttachmentInputRef = useRef(null);

  const clearPartRequestForm = () => {
    setPartRequestDescription("");
    setPartRequestQuantity(1);
    setPartAttachments([]);
    setPartsUploadBusy(false);
    setPartsValidationError("");
    setPartsFeedback("");
  };

  const submitIndividualPartRequest = async () => {
    const trimmedPart = String(partRequestDescription || "").trim();
    if (!trimmedPart) {
      setPartsValidationError("Enter the part required before sending the request.");
      return;
    }
    setPartsValidationError("");
    let uploadedAttachments = [];
    if (partAttachments.length > 0) {
      const targetJobId = jobData?.jobCard?.id || jobData?.id || null;
      if (!targetJobId) {
        setPartsValidationError("Job data is still loading. Try again in a moment.");
        return;
      }
      setPartsUploadBusy(true);
      try {
        uploadedAttachments = await Promise.all(partAttachments.map(async (file) => {
          const formData = new FormData();
          formData.append("jobId", String(targetJobId));
          formData.append("userId", String(user?.user_id || dbUserId || ""));
          formData.append("file", file);
          const response = await fetch("/api/jobcards/upload-document", {
            method: "POST",
            body: formData,
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.message || payload.error || `Failed to upload ${file.name}`);
          }
          return {
            name: payload.file?.filename || file.name,
            fileId: payload.file?.fileId || null,
            url: payload.file?.path || "",
            size: file.size,
            type: file.type,
          };
        }));
      } catch (uploadError) {
        setPartsUploadBusy(false);
        setPartsFeedback(uploadError.message || "Failed to upload the selected images.");
        return;
      }
      setPartsUploadBusy(false);
    }
    const result = await handlePartsRequestSubmit?.({
      partRequired: trimmedPart,
      quantity: partRequestQuantity,
      attachments: uploadedAttachments,
    });
    if (result?.success !== false) {
      clearPartRequestForm();
    }
  };

  const startEditRequest = (request) => {
    setEditingPartRequestId(request.request_id);
    setEditingPartRequestText(resolveRequestPartName(request));
  };

  const saveEditRequest = async (request) => {
    const trimmed = editingPartRequestText.trim();
    if (!trimmed) return;
    const currentDescription = String(request.description || "");
    const nextDescription = /Part required:\s*[^\n]+/i.test(currentDescription)
      ? currentDescription.replace(/Part required:\s*[^\n]+/i, `Part required: ${trimmed}`)
      : [`Part required: ${trimmed}`, currentDescription].filter(Boolean).join("\n");
    await handlePartsRequestAction?.({
      requestId: request.request_id,
      action: "edit",
      updates: { description: nextDescription || `Part required: ${trimmed}` },
    });
    setEditingPartRequestId(null);
    setEditingPartRequestText("");
  };

  const sendRequestNote = async (request) => {
    const note = String(requestNoteDrafts[request.request_id] || "").trim();
    if (!note) return;
    await handlePartsRequestNote?.({ requestId: request.request_id, note });
    setRequestNoteDrafts((prev) => ({ ...prev, [request.request_id]: "" }));
  };

  const vhcCustomerStatusMeta = (() => {
    const status = String(vhcCustomerStatus?.status || "pending").toLowerCase();
    if (status === "viewed") {
      return {
        label: "Viewed",
        detail: vhcCustomerStatus?.viewedAt ? `Viewed ${formatDateTime(vhcCustomerStatus.viewedAt)}` : "Customer opened the VHC link",
        background: "var(--success-surface)",
        color: "var(--text-1)",
      };
    }
    if (status === "sent") {
      return {
        label: "Sent",
        detail: vhcCustomerStatus?.sentAt ? `Sent ${formatDateTime(vhcCustomerStatus.sentAt)}` : "VHC sent to customer",
        background: "var(--theme)",
        color: "var(--text-1)",
      };
    }
    return {
      label: "Pending",
      detail: vhcCustomerStatus?.readyAt ? "Ready to send" : "Not sent to customer",
      background: "var(--warning-surface)",
      color: "var(--text-1)",
    };
  })();
  const compactSummaryPrimaryStyle = {
    fontSize: "16px",
    fontWeight: "600",
    color: "var(--text-1)",
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  const compactSummarySecondaryStyle = {
    fontSize: "13px",
    color: "var(--grey-accent)",
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  const customerStatusToneClass =
    vhcCustomerStatusMeta.label === "Viewed"
      ? "app-badge--success"
      : vhcCustomerStatusMeta.label === "Sent"
        ? "app-badge--accent-soft"
        : "app-badge--warning";
  const customerName =
    [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") ||
    "N/A";
  const customerContact =
    customer?.mobile || customer?.telephone || customer?.email || "No contact info";
  const mileageDisplay =
    vehicle?.mileage !== null && vehicle?.mileage !== undefined
      ? Number(vehicle.mileage).toLocaleString()
      : "N/A";
  const keyLocationDisplay = String(trackerEntry?.keyLocation || "")
    .trim()
    .replace(/^Keys (received|hung|updated)\s*[-–]\s*/i, "")
    .replace(/^Key locations?\s*[-:–]\s*/i, "") || "N/A";
  const vehicleLocationDisplay = trackerEntry?.vehicleLocation || "N/A";

  // Pre-pick location resolves from the allocated/linked part(s) — the single
  // source of truth on parts_job_items — with the legacy job_requests value kept
  // only as a read fallback. This mirrors the main job-card page so every screen
  // shows the same location (see project_pre_pick_location).
  const linkedPrePickPartsSource = [
    ...(Array.isArray(jobCard?.partsAllocations) ? jobCard.partsAllocations : []),
    ...(Array.isArray(jobCard?.parts_job_items) ? jobCard.parts_job_items : [])
  ];
  const bookedJobPartsSource = Array.isArray(jobCard?.partsAllocations) && jobCard.partsAllocations.length > 0 ?
    jobCard.partsAllocations :
    Array.isArray(jobCard?.parts_job_items) ?
      jobCard.parts_job_items :
      [];
  const bookedJobParts = bookedJobPartsSource.filter((part) => {
    const status = String(part?.status || "").trim().toLowerCase();
    return !["cancelled", "removed", "unavailable"].includes(status);
  });
  const requestFulfilledPartIds = new Set(
    (Array.isArray(partsRequests) ? partsRequests : []).
    map((request) => request?.fulfilled_by ?? request?.fulfilledBy ?? null).
    filter(Boolean).
    map(String)
  );
  const partsRequestIds = new Set(
    (Array.isArray(partsRequests) ? partsRequests : []).
    map((request) => request?.request_id ?? request?.requestId ?? null).
    filter(Boolean).
    map(String)
  );
  const directlyBookedJobParts = bookedJobParts.filter((part) => {
    if (requestFulfilledPartIds.has(String(part?.id || ""))) return false;
    const sourceRequestId = part?.sourceRequestId ?? part?.source_request_id ?? null;
    return !sourceRequestId || !partsRequestIds.has(String(sourceRequestId));
  });
  const findBookedPartForRequest = (request) => {
    const fulfilledPartId = request?.fulfilled_by ?? request?.fulfilledBy ?? null;
    if (fulfilledPartId) {
      const fulfilledPart = bookedJobParts.find((part) => String(part?.id) === String(fulfilledPartId));
      if (fulfilledPart) return fulfilledPart;
    }

    const requestId = request?.request_id ?? request?.requestId ?? null;
    if (!requestId) return null;
    return bookedJobParts.find((part) => {
      const sourceRequestId = part?.sourceRequestId ?? part?.source_request_id ?? null;
      return sourceRequestId && String(sourceRequestId) === String(requestId);
    }) || null;
  };
  const resolveBookedPartCollectionLocation = (part) => {
    const prePickLocation = part?.prePickLocation ?? part?.pre_pick_location ?? "";
    return prePickLocation ? formatPrePickLabel?.(prePickLocation) || String(prePickLocation) : "Not allocated";
  };
  const resolveRowPrePickLocation = (row) =>
    resolveLinkedPrePickLocation({
      linkedPartRows: collectLinkedPartRows({
        parts: linkedPrePickPartsSource,
        requestId: row?.requestId ?? row?.request_id ?? null,
        vhcItemId: row?.vhcItemId ?? row?.vhc_item_id ?? row?.vhc_id ?? null,
        resolveCanonicalVhcId: (value) => (value === null || value === undefined ? "" : String(value))
      }),
      fallbackValues: [row?.prePickLocation, row?.pre_pick_location]
    });

  const overviewCustomerRequests = (() => {
    const structuredRows = Array.isArray(jobCard?.jobRequests) && jobCard.jobRequests.length > 0 ?
    jobCard.jobRequests :
    Array.isArray(jobCard?.job_requests) && jobCard.job_requests.length > 0 ?
    jobCard.job_requests :
    [];

    if (structuredRows.length > 0) {
      return structuredRows.
      filter((row) => (row?.requestSource ?? row?.request_source ?? "customer_request") === "customer_request").
      map((row, index) => ({
        text: row?.description ?? row?.text ?? "",
        hours: row?.hours ?? row?.time ?? "",
        jobType: row?.jobType ?? row?.job_type ?? row?.paymentType ?? "Customer",
        status: row?.status ?? null,
        prePickLocation: resolveRowPrePickLocation(row),
        sortOrder: row?.sortOrder ?? row?.sort_order ?? index + 1,
        original: row
      })).
      sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }

    return (Array.isArray(jobCard?.requests) ? jobCard.requests : []).
    map((request, index) => ({
      text: request?.text || request?.description || request || "",
      hours: request?.hours ?? request?.time ?? "",
      jobType: request?.jobType ?? request?.paymentType ?? "Customer",
      status: request?.status ?? null,
      prePickLocation: request?.prePickLocation ?? request?.pre_pick_location ?? null,
      sortOrder: index + 1,
      original: request
    }));
  })();
  const overviewAuthorisedRequests = (() => {
    const structuredRows = [
      ...(Array.isArray(jobCard?.jobRequests) ? jobCard.jobRequests : []),
      ...(Array.isArray(jobCard?.job_requests) ? jobCard.job_requests : [])
    ];
    const requestRows = structuredRows.
    filter((row) => {
      const source = String(row?.requestSource ?? row?.request_source ?? "").toLowerCase().trim();
      const status = String(row?.status ?? row?.approvalStatus ?? row?.approval_status ?? row?.authorizationState ?? row?.authorization_state ?? "").toLowerCase().trim();
      return source === "vhc_authorised" ||
      source === "vhc_authorized" ||
      status === "authorized" ||
      status === "authorised" ||
      status === "completed" ||
      row?.vhcItemId !== null && row?.vhcItemId !== undefined ||
      row?.vhc_item_id !== null && row?.vhc_item_id !== undefined;
    }).
    map((row, index) => ({
      rowKey: `request-${row?.requestId ?? row?.request_id ?? row?.vhcItemId ?? row?.vhc_item_id ?? index}`,
      text: row?.label ?? row?.description ?? row?.text ?? row?.section ?? "Authorised item",
      detail: row?.detail ?? row?.issueDescription ?? row?.issue_description ?? row?.noteText ?? row?.note_text ?? "",
      hours: row?.labourHours ?? row?.labour_hours ?? row?.hours ?? row?.time ?? "",
      jobType: row?.jobType ?? row?.job_type ?? row?.paymentType ?? "Customer",
      status: row?.status ?? row?.approvalStatus ?? row?.approval_status ?? row?.authorizationState ?? row?.authorization_state ?? "authorized",
      prePickLocation: resolveRowPrePickLocation(row),
      sortOrder: row?.sortOrder ?? row?.sort_order ?? index + 1
    }));

    if (requestRows.length > 0) {
      return requestRows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }

    const vhcRows = Array.isArray(authorisedVhcItems) && authorisedVhcItems.length > 0 ?
    authorisedVhcItems :
    Array.isArray(authorizedVhcRows) ?
    authorizedVhcRows :
    [];

    return vhcRows.map((row, index) => ({
      rowKey: `vhc-${row?.vhc_id ?? row?.vhcItemId ?? row?.id ?? index}`,
      text: row?.label ?? row?.issue_title ?? row?.issueTitle ?? row?.description ?? row?.section ?? "Authorised item",
      detail: row?.issueDescription ?? row?.issue_description ?? row?.noteText ?? row?.note_text ?? "",
      hours: row?.labourHours ?? row?.labour_hours ?? row?.hours ?? "",
      jobType: row?.jobType ?? row?.job_type ?? row?.paymentType ?? "Customer",
      status: row?.status ?? row?.approvalStatus ?? row?.approval_status ?? row?.authorizationState ?? row?.authorization_state ?? "authorized",
      prePickLocation: resolveRowPrePickLocation(row),
      sortOrder: index + 1
    }));
  })();
  const formatOverviewHours = (value) => {
    const numeric = Number(value);
    const safe = Number.isFinite(numeric) ? numeric : 0;
    return `${safe.toFixed(1)}h`;
  };
  const getOverviewPaymentPillStyle = (paymentType = "") => {
    const normalized = String(paymentType || "").trim().toLowerCase();
    const isCustomer = normalized === "customer";
    const isWarranty = normalized === "warranty";
    const isGoodwill = normalized.includes("goodwill");
    const isInternal = normalized === "internal";
    const isDanger = normalized === "insurance" || normalized === "lease company";
    return {
      backgroundColor: isCustomer ? "var(--success-surface)" : isWarranty || isInternal ? "var(--warning-surface)" : isDanger ? "var(--danger-surface)" : isGoodwill ? "var(--theme)" : "var(--control-bg)",
      color: "var(--text-1)"
    };
  };
  const getOverviewStatusPresentation = (statusValue = "") => {
    const normalized = String(statusValue || "not_started").
    trim().
    toLowerCase().
    replace(/\s+/g, "_");
    const labelMap = {
      authorized: "Authorised",
      authorised: "Authorised",
      added_to_job: "Added to Job",
      removed: "Removed",
      completed: "Completed",
      complete: "Completed",
      not_started: "Not Started",
      declined: "Declined",
      inprogress: "In Progress",
      pending: "Pending",
      cancelled: "Cancelled",
      on_hold: "On Hold"
    };
    const isSuccess = ["added_to_job", "completed", "complete", "authorized", "authorised"].includes(normalized);
    const isDanger = ["removed", "declined", "cancelled", "canceled"].includes(normalized);
    const isWarning = ["not_started", "on_hold", "hold", "pending"].includes(normalized);
    return {
      label: labelMap[normalized] || normalized.
      split("_").
      filter(Boolean).
      map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).
      join(" ") || "Not Started",
      style: {
        backgroundColor: isSuccess ? "var(--success-surface)" : isDanger ? "var(--danger-surface)" : isWarning ? "var(--warning-surface)" : "var(--theme)",
        color: "var(--text-1)"
      }
    };
  };
  const overviewRequestPillStyle = {
    height: "var(--control-height)",
    minHeight: "var(--control-height)",
    maxHeight: "var(--control-height)",
    padding: "var(--control-padding)",
    borderRadius: "var(--control-radius)",
    fontSize: "var(--control-font-size)",
    fontWeight: "600",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    cursor: "default",
    border: "none",
    whiteSpace: "nowrap"
  };
  const overviewRequestSubtitleStyle = {
    fontSize: "11px",
    color: "var(--text-1)",
    fontWeight: "700",
    letterSpacing: "0.12em",
    textTransform: "uppercase"
  };
  const overviewRequestRowStyle = {
    padding: "14px",
    color: "var(--text-1)",
    border: "none",
    borderRadius: "var(--control-radius)",
    marginBottom: "12px",
    transition: "var(--control-transition)",
    backgroundColor: "var(--warning-surface)"
  };
  const overviewAuthorisedRowStyle = {
    ...overviewRequestRowStyle,
    backgroundColor: "var(--success-surface)"
  };
  const overviewRequestColumnGridStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 190px 90px 180px 150px",
    columnGap: "8px",
    rowGap: "12px",
    alignItems: "center"
  };
  const overviewRequestValueColumnStyle = {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "stretch"
  };
  const overviewRequestFullWidthValueStyle = {
    width: "100%"
  };
  const renderVhcSummaryItem = (item, idx) => (
    <LayerTheme
      key={idx}
      className="vhc-summary-item"
      radius="var(--radius-xs)"
      padding="12px 16px"
      gap="0"
    >
      <div className="vhc-summary-item__section" style={{
        color: "var(--text-1)"
      }}>
        {item.section}
      </div>
      <div className="vhc-summary-item__text" style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap"
      }}>
        <span>{item.text}</span>
        {item.unmatchedTyre ? <span className="app-btn app-btn--xs app-btn--danger" style={{
          minHeight: "22px",
          height: "22px",
          padding: "0 8px",
          fontSize: "11px",
          lineHeight: 1,
          cursor: "default"
        }}>
            Unmatched
          </span> : null}
      </div>
    </LayerTheme>
  );

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
        <div style={{
    padding: "40px",
    textAlign: "center"
  }}>
          <h2 style={{
      color: "var(--text-1)"
    }}>Access Denied</h2>
          <p>This page is only for Technicians.</p>
        </div>
      </>; // render extracted page section.

    case "section2":
      return <MyJobCardShellSkeleton jobNumber={jobNumber} />; // render extracted page section.

    case "section3":
      return <>
        <div style={{
    padding: "40px",
    textAlign: "center"
  }}>
          <h2 style={{
      color: "var(--text-1)"
    }}>Job Not Found</h2>
          <button onClick={() => router.push("/tech")} style={{
      padding: "12px 24px",
      backgroundColor: "var(--primary)",
      color: "var(--text-2)",
      border: "none",
      borderRadius: "var(--radius-xs)",
      cursor: "pointer",
      marginTop: "20px"
    }}>
            Back to My Jobs
          </button>
        </div>
      </>; // render extracted page section.

    case "section4":
      return <div style={{
  padding: "24px",
  display: "flex",
  justifyContent: "center"
}}>
        <InlineLoading width={180} label="Loading roster" />
      </div>; // render extracted page section.

    case "section5":
      return <>
        {/* Header Section */}
        <TechnicianJobHeader>
          <h1 style={{
        color: "var(--text-1)",
        fontSize: "28px",
        fontWeight: "700",
        margin: "0",
        lineHeight: 1,
        flexShrink: 0
      }}>
            {jobCard.jobNumber}
          </h1>
          <span style={{
        fontSize: "12px",
        color: "var(--text-1)",
        flexShrink: 0
      }}>
            Updated {formatDateTime(jobCard.updatedAt)}
          </span>
          <div style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "12px",
        flexWrap: "wrap"
      }}>
              {/* Status pill rides the shared .app-btn shape. Semantic colour
                  for non-complete states comes from STATUS_BADGE_STYLES — those
                  background/color tokens are applied inline because .app-btn
                  does not expose a per-status colour variant. */}
              <span className={isHeaderCompleteStatus ? "app-btn app-btn--primary" : "app-btn"} style={isHeaderCompleteStatus ? {
            cursor: "default",
            letterSpacing: "0.02em"
          } : {
            background: jobStatusBadgeStyle.background,
            color: "var(--text-1)",
            border: "none",
            cursor: "default",
            letterSpacing: "0.02em"
          }}>
                {techStatusDisplay}
              </span>
              <div style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap"
          }}>
                {/* Clock Out / Clock In / Complete Job all use the global `<Button>`
                    component so they share the canonical `.app-btn` sizing, radius
                    and hover treatment. Previously each was an inline-styled <button>
                    with hardcoded padding/border-radius — now visual appearance is
                    centrally owned by the design system. */}
                {jobClocking ? <Button variant="secondary" size="sm" onClick={handleJobClockOut} disabled={clockOutLoading || clockInLoading}>
                    {clockOutLoading ? "Clocking Out..." : "Clock Out"}
                  </Button> : <Button variant="secondary" size="sm" onClick={handleJobClockIn} disabled={clockInLoading || clockOutLoading} title={canClockIntoMotHandoff ? "Clock in to complete the remaining MOT request" : "Clock in to start technician work"}>
                    {clockInLoading ? "Clocking In..." : canClockIntoMotHandoff ? "Clock In to MOT" : "Clock In"}
                  </Button>}

                <Button variant="primary" size="sm" onClick={handleCompleteJob} disabled={!canCompleteJob || clockInLoading || clockOutLoading} title={completeJobLockedTitle}>
                  {canCompleteJob ? "Complete Job" : "Complete Job (locked)"}
                </Button>
              </div>
            </div>
        </TechnicianJobHeader>

        {completeJobFeedback ? <div style={{
      padding: "12px 14px",
      borderRadius: "var(--radius-xs)",
      backgroundColor: "var(--warning-surface)",
      border: "none",
      color: "var(--text-1)",
      margin: 0
    }}>
            <div style={{
        fontSize: "13px",
        fontWeight: "700",
        marginBottom: "4px"
      }}>
              {completeJobFeedback.title}
            </div>
            <div style={{
        fontSize: "13px",
        lineHeight: 1.45
      }}>
              {completeJobFeedback.detail}
            </div>
          </div> : null}

        {/* Vehicle, customer, clocked time, and location summary */}
        <TechnicianJobSummaryGrid>
          <TechnicianJobSummaryCard
            sectionKey="myjob-summary-vehicle"
            sectionType="content-card"
            style={{
              minWidth: 0,
              overflow: "hidden"
            }}
          >
            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              alignItems: "start",
              columnGap: "10px"
            }}>
              <div style={compactSummaryPrimaryStyle}>
                {vehicle?.reg || "N/A"}
              </div>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap"
              }}>
                <span style={{
                  fontSize: "13px",
                  color: "var(--text-1)",
                  fontWeight: "600"
                }}>
                  Mileage
                </span>
                <span style={{
                  fontSize: "14px",
                  color: "var(--text-1)",
                  fontWeight: "600",
                  fontVariantNumeric: "tabular-nums"
                }}>
                  {mileageDisplay}
                </span>
              </div>
            </div>
            <div style={compactSummarySecondaryStyle}>
              {vehicle?.makeModel || [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "N/A"}
            </div>
          </TechnicianJobSummaryCard>

          <TechnicianJobSummaryCard
            sectionKey="myjob-summary-customer"
            sectionType="content-card"
            style={{
              minWidth: 0,
              overflow: "hidden"
            }}
          >
            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              alignItems: "center",
              columnGap: "10px"
            }}>
              <div style={{
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}>
                <div style={compactSummaryPrimaryStyle}>
                  {customerName}
                </div>
                <div style={compactSummarySecondaryStyle}>
                  {customerContact}
                </div>
              </div>
              <span
                title={vhcCustomerStatusMeta.detail}
                className={`app-badge app-badge--uppercase ${customerStatusToneClass}`}
              >
                VHC: {vhcCustomerStatusMeta.label}
              </span>
            </div>
          </TechnicianJobSummaryCard>

          <QuickStatCard
            stat={quickStats.find((stat) => stat.label === "Clocked Hours")}
            sectionKey="myjob-quick-stat-clocked-hours"
            scrollTargetId="job-progress-total-time"
          />

          <TechnicianJobSummaryCard
            sectionKey="myjob-summary-locations"
            sectionType="content-card"
            style={{
              flexDirection: "row",
              alignItems: "stretch",
              minWidth: 0,
              overflow: "hidden",
              minHeight: "68px",
              cursor: canEditTrackingLocations ? "pointer" : "default",
              opacity: canEditTrackingLocations ? 1 : 0.75
            }}
          >
            <div
              onClick={() => {
                if (canEditTrackingLocations) {
                  setTrackerQuickModalOpen(true);
                }
              }}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "stretch",
                flex: 1,
                width: "100%",
                gap: "10px"
              }}
            >
              <div style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center"
              }}>
                <div style={{
                  fontSize: "12px",
                  lineHeight: 1.1,
                  fontWeight: "700",
                  color: "var(--text-1)",
                  marginBottom: "6px"
                }}>
                  Key location
                </div>
                <div style={{
                  ...compactSummaryPrimaryStyle,
                  fontSize: "17px",
                  lineHeight: 1.15
                }}>
                  {keyLocationDisplay}
                </div>
              </div>
              <div style={{
                width: "1px",
                backgroundColor: "var(--surface)",
                flexShrink: 0
              }} />
              <div style={{
                flex: 1,
                minWidth: 0,
                textAlign: "right",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "flex-end"
              }}>
                <div style={{
                  fontSize: "12px",
                  lineHeight: 1.1,
                  fontWeight: "700",
                  color: "var(--text-1)",
                  marginBottom: "6px"
                }}>
                  Car location
                </div>
                <div style={{
                  ...compactSummaryPrimaryStyle,
                  fontSize: "17px",
                  lineHeight: 1.15
                }}>
                  {vehicleLocationDisplay}
                </div>
              </div>
            </div>
          </TechnicianJobSummaryCard>
        </TechnicianJobSummaryGrid>

        {/* Tab Row */}
        <TechnicianJobTabRow>
          {visibleTabs.map(tab => {
        const isActive = activeTab === tab;
        const isVhcTab = tab === "vhc";
        const isVhcGreen = isVhcTab && isVhcCompleted;
        const isVhcAmber = isVhcTab && vhcTabAmberReady;
        const isWriteUpTab = tab === "write-up";
        const isComplete = isVhcGreen || isWriteUpTab && writeUpTabComplete;
        const isAmber = isVhcAmber || isWriteUpTab && writeUpTabPartiallyComplete;
        const tabTone = isComplete ? "success" : isAmber ? "warning" : "default";
        return <button
          key={tab}
          className={`tab-api__item${isActive ? " is-active" : ""}`}
          data-tone={tabTone}
          onClick={event => {
            setActiveTab(tab);
            event.currentTarget.scrollIntoView({
              behavior: "smooth",
              inline: "center",
              block: "nearest"
            });
          }}
        >
                {TECHNICIAN_JOB_TAB_LABELS[tab] || tab.replace("-", " ")}
              </button>;
      })}
        </TechnicianJobTabRow>

        {/* All technician tabs share the same canonical content shell as the
            main job-card page. The transparent scroll region preserves the
            landscape technician workflow without changing the shell design. */}
        <TechnicianJobContentShell activeTab={activeTab}>
          
          <DevLayoutSection as="div" className="app-page-stack" sectionKey="myjob-main-scroll" sectionType="section-shell" parentKey="myjob-main-content" backgroundToken="none" style={{
        flex: 1,
        overflowY: "auto",
        minHeight: 0
      }}>
          
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && <DevLayoutSection as="div" className="app-page-stack" sectionKey="myjob-tab-overview" sectionType="content-card" parentKey="myjob-main-scroll" backgroundToken="none" data-dev-page="My job detail" data-dev-tab="Overview" data-dev-card-section="overview tab" data-dev-text-preview="Overview tab" data-dev-auto-outline="cards">
              {CustomerRequestsTab && workspaceJobData ? <CustomerRequestsTab
                jobData={workspaceJobData}
                canEdit={canEditWorkspace}
                onUpdate={handleUpdateRequests}
                onUpdateRequestStatus={handleUpdateRequestStatus}
                onNavigateTab={setActiveTab}
                clockingEntries={workspaceClockingEntries}
                overallStatusId={workspaceOverallStatusId}
                vhcChecks={vhcChecks}
                notes={notes}
                partsJobItems={workspaceJobData.parts_job_items || []}
              /> : <>
              {/* Job Details */}
              <LayerSurface as="section" sectionKey="myjob-overview-details" sectionType="content-card" parentKey="myjob-tab-overview" backgroundToken="surface" radius="var(--section-card-radius)" padding="var(--section-card-padding)" gap="var(--layout-card-gap)">
                <h3 style={{
              fontSize: "18px",
              fontWeight: "600",
              marginBottom: "16px"
            }}>
                  Job Details
                </h3>
                {(overviewCustomerRequests.length > 0 || overviewAuthorisedRequests.length > 0) && <div style={{
              marginBottom: "16px"
            }}>
                    <strong style={{
                fontSize: "14px",
                color: "var(--text-1)",
                letterSpacing: "0.04em"
              }}>Customer Requests:</strong>
                    <div style={{
                marginTop: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "0"
              }}>
                      {overviewCustomerRequests.map((req, i) => {
                const statusPresentation = getOverviewStatusPresentation(req.status);
                return <div key={i} style={overviewRequestRowStyle}>
                          <div style={overviewRequestColumnGridStyle}>
                            <div style={{
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      alignSelf: "start"
                    }}>
                              <span style={overviewRequestSubtitleStyle}>Request {i + 1}</span>
                              <span style={{
                        fontSize: "14px",
                        color: "var(--text-1)"
                      }}>
                                {req.text}
                              </span>
                            </div>
                            <div style={overviewRequestValueColumnStyle}>
                              <span className="app-btn app-btn--sm" style={{
                      ...overviewRequestPillStyle,
                      ...overviewRequestFullWidthValueStyle,
                      backgroundColor: "var(--control-bg)",
                      color: "var(--text-1)"
                    }}>
                                {req.prePickLocation ?
                        `Pre-picked: ${formatPrePickLabel(req.prePickLocation)}` :
                        "Pre-pick not set"}
                              </span>
                            </div>
                            <div style={overviewRequestValueColumnStyle}>
                              <span className="app-btn app-btn--sm" style={{
                        ...overviewRequestPillStyle,
                        ...overviewRequestFullWidthValueStyle,
                        backgroundColor: "var(--control-bg)",
                        color: "var(--text-1)"
                      }}>
                                {formatOverviewHours(req.hours)}
                              </span>
                            </div>
                            <div style={overviewRequestValueColumnStyle}>
                              <span className="app-btn app-btn--sm" style={{
                        ...overviewRequestPillStyle,
                        ...overviewRequestFullWidthValueStyle,
                        ...getOverviewPaymentPillStyle(req.jobType)
                      }}>
                                {req.jobType || "Customer"}
                              </span>
                            </div>
                            <div style={overviewRequestValueColumnStyle}>
                              <span className="app-btn app-btn--sm" style={{
                        ...overviewRequestPillStyle,
                        ...overviewRequestFullWidthValueStyle,
                        ...statusPresentation.style
                      }}>
                                {statusPresentation.label}
                              </span>
                            </div>
                          </div>
                          {notes.filter(note => Array.isArray(note.linkedRequestIndices) ? note.linkedRequestIndices.includes(i + 1) : note.linkedRequestIndex === i + 1).map(note => <div key={note.noteId} style={{
                    fontSize: "11px",
                    color: "var(--text-1)",
                    marginTop: "6px"
                  }}>
                                Note: {note.noteText}
                              </div>)}
                        </div>;
              })}
                      {overviewAuthorisedRequests.map((row, i) => {
                const statusPresentation = getOverviewStatusPresentation(row.status || "authorized");
                const rowDetail = row.detail && !String(row.text || "").toLowerCase().includes(String(row.detail || "").toLowerCase()) ?
                row.detail :
                "";
                return <div key={row.rowKey || i} style={overviewAuthorisedRowStyle}>
                          <div style={overviewRequestColumnGridStyle}>
                            <div style={{
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      alignSelf: "start"
                    }}>
                              <span style={overviewRequestSubtitleStyle}>Authorised {i + 1}</span>
                              <span style={{
                        fontSize: "14px",
                        color: "var(--text-1)"
                      }}>
                                {row.text}
                              </span>
                              {rowDetail ? <span style={{
                        fontSize: "13px",
                        color: "var(--text-1)"
                      }}>
                                  - {rowDetail}
                                </span> : null}
                            </div>
                            <div style={overviewRequestValueColumnStyle}>
                              <span className="app-btn app-btn--sm" style={{
                      ...overviewRequestPillStyle,
                      ...overviewRequestFullWidthValueStyle,
                      backgroundColor: "var(--control-bg)",
                      color: "var(--text-1)"
                    }}>
                                {row.prePickLocation ?
                        `Pre-picked: ${formatPrePickLabel(row.prePickLocation)}` :
                        "Pre-pick not set"}
                              </span>
                            </div>
                            <div style={overviewRequestValueColumnStyle}>
                              <span className="app-btn app-btn--sm" style={{
                        ...overviewRequestPillStyle,
                        ...overviewRequestFullWidthValueStyle,
                        backgroundColor: "var(--control-bg)",
                        color: "var(--text-1)"
                      }}>
                                {formatOverviewHours(row.hours)}
                              </span>
                            </div>
                            <div style={overviewRequestValueColumnStyle}>
                              <span className="app-btn app-btn--sm" style={{
                        ...overviewRequestPillStyle,
                        ...overviewRequestFullWidthValueStyle,
                        ...getOverviewPaymentPillStyle(row.jobType)
                      }}>
                                {row.jobType || "Customer"}
                              </span>
                            </div>
                            <div style={overviewRequestValueColumnStyle}>
                              <span className="app-btn app-btn--sm" style={{
                        ...overviewRequestPillStyle,
                        ...overviewRequestFullWidthValueStyle,
                        ...statusPresentation.style
                      }}>
                                {statusPresentation.label}
                              </span>
                            </div>
                          </div>
                        </div>;
              })}
                    </div>
                  </div>}
                {authorisedVhcItems.length > 0 ? <div style={{
              marginTop: "24px"
            }}>
                  <div style={{
                padding: "16px",
                backgroundColor: "var(--theme)",
                borderRadius: "var(--radius-sm)"
              }}>
                    <div style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "var(--text-1)",
                  marginBottom: "6px"
                }}>
                      Vehicle Health Check
                    </div>
                    <div>
                      <div>
                        <div style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "var(--text-1)",
                      marginBottom: "10px"
                    }}>
                          Authorised items
                        </div>
                        <div style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap"
                    }}>
                          {authorisedVhcItems.map(check => {
                        const resolvedVhcId = check.vhc_id ?? check.id;
                        return <div key={resolvedVhcId || check.id} style={{
                          fontSize: "13px",
                          color: "var(--text-1)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          alignItems: "flex-start",
                          backgroundColor: "var(--success-surface)",
                          border: "none",
                          borderRadius: "var(--radius-xs)",
                          padding: "10px 14px"
                        }}>
                                <span style={{
                            fontWeight: "600",
                            color: "var(--text-1)"
                          }}>
                                  {check.issue_title || check.issueTitle || check.section}
                                </span>
                                {notes.filter(note => Array.isArray(note.linkedVhcIds) ? note.linkedVhcIds.includes(resolvedVhcId) : note.linkedVhcId === resolvedVhcId).map(note => <div key={note.noteId} style={{
                            fontSize: "11px",
                            color: "var(--text-1)"
                          }}>
                                      Note: {note.noteText}
                                    </div>)}
                                {(() => {
                            const prePickSet = resolvedVhcId ? prePickByVhcId.get(String(resolvedVhcId)) : null;
                            if (!prePickSet || prePickSet.size === 0) return null;
                            return Array.from(prePickSet).map(location => <div key={`${resolvedVhcId}-${location}`} style={{
                              fontSize: "11px",
                              color: "var(--text-1)"
                            }}>
                                      Pre pick: {formatPrePickLabel(location)}
                                    </div>);
                          })()}
                              </div>;
                      })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div> : null}
                {jobCard.cosmeticNotes && <div>
                    <strong style={{
                fontSize: "14px",
                color: "var(--text-1)",
                letterSpacing: "0.04em"
              }}>Cosmetic Notes:</strong>
                    <p style={{
                marginTop: "10px",
                color: "var(--text-1)",
                lineHeight: 1.6
              }}>{jobCard.cosmeticNotes}</p>
                  </div>}
              </LayerSurface>
              </>}
            </DevLayoutSection>}

          {/* VHC TAB */}
          {activeTab === "vhc" && <DevLayoutSection as="div" sectionKey="myjob-tab-vhc" sectionType="section-shell" parentKey="myjob-main-scroll" backgroundToken="none" shell className="vhc-section-shell">
              {!activeSection && (showVhcReopenButton ? <DevLayoutSection as="div" sectionKey="myjob-vhc-reopen-banner" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="section-card-bg" className="vhc-content-card" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            paddingBlock: "10px" // Exact inset requested for this compact completed-VHC banner.
          }}>
                  <div>
                    <h2 className="vhc-toolbar__title">VHC Completed</h2>
                    <p className="vhc-toolbar__subtitle" style={{
                marginTop: "6px"
              }}>
                      Vehicle Health Check completed.
                    </p>
                  </div>
                  <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}>
                    <CustomerVideoButton jobNumber={jobNumber} userId={dbUserId || user?.id} vhcContextLabel={activeSection || "vhc-summary"} vhcData={vhcData} buttonClassName="app-btn app-btn--primary app-btn--sm" onUploadComplete={() => {
                fetchJobData();
                bumpGallery();
              }} />
                    <Button type="button" variant="secondary" size="sm" onClick={handleCompleteVhcClick}>
                      Reopen VHC
                    </Button>
                  </div>
                </DevLayoutSection> : <>
                  {/* VHC Header with Save Status */}
                  <DevLayoutSection as="div" sectionKey="myjob-vhc-header" sectionType="toolbar" parentKey="myjob-tab-vhc" backgroundToken="section-card-bg" className="vhc-toolbar">
                    <div>
                      <h2 className="vhc-toolbar__title" style={{ color: "var(--text-1)" }}>Vehicle Health Check</h2>
                      <p className="vhc-toolbar__subtitle">
                        Complete mandatory sections to finish VHC
                      </p>
                    </div>
                    <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}>
                      <div
                        title={vhcCustomerStatusMeta.detail}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: "4px",
                          minWidth: "112px"
                        }}
                      >
                        <span style={{
                          fontSize: "10px",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "var(--text-1)",
                          fontWeight: 700
                        }}>
                          Customer VHC
                        </span>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "5px 10px",
                          borderRadius: "var(--control-radius)",
                          backgroundColor: vhcCustomerStatusMeta.background,
                          color: "var(--text-1)",
                          fontSize: "12px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          minHeight: "24px"
                        }}>
                          {vhcCustomerStatusMeta.label}
                        </span>
                      </div>
                      {saveStatus === "saving" && <span style={{
                  fontSize: "13px",
                  color: "var(--text-1)"
                }}>Saving...</span>}
                      {saveStatus === "saved" && <span style={{
                  fontSize: "13px",
                  color: "var(--text-1)"
                }}>Saved</span>}
                      {saveStatus === "error" && <span style={{
                  fontSize: "13px",
                  color: "var(--text-1)"
                }}>{saveError || "Save failed"}</span>}
                      <button type="button" className={`vhc-btn${showVhcSummary ? " vhc-btn--active" : ""}`} onClick={() => setShowVhcSummary(prev => !prev)}>
                        {showVhcSummary ? "Close VHC summary" : "Show Summary"}
                      </button>

                      {(() => {
                  const isCompleteDisabled = !showVhcReopenButton && !canCompleteVhc;
                  const isCompleteActive = !showVhcReopenButton && canCompleteVhc;
                  return <button type="button" className={`vhc-btn${isCompleteActive ? " vhc-btn--active" : ""}`} style={{ color: isCompleteActive ? "var(--text-2)" : "var(--text-1)" }} onClick={handleCompleteVhcClick} disabled={!showVhcReopenButton && !canCompleteVhc} title={showVhcReopenButton ? "Reopen the Vehicle Health Check to make additional changes" : canCompleteVhc ? "Mark the Vehicle Health Check as complete" : "Complete all mandatory sections to finish the VHC"}>
                        {showVhcReopenButton ? "Reopen" : "Complete VHC"}
                      </button>;
                })()}

                      {/* Camera Button - Always visible for technicians */}
                      {jobNumber && <VhcCameraButton jobId={resolvedJobId} jobNumber={jobNumber} userId={dbUserId || user?.id} buttonStyle={{
                  minHeight: "var(--control-height)",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-xs)",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "12px",
                  lineHeight: 1,
                  background: "var(--theme)",
                  color: "var(--text-1)",
                  transition: "all 0.18s ease"
                }} onUploadComplete={() => {
                  console.log("VHC media uploaded, refreshing job data...");
                  fetchJobData();
                  bumpGallery();
                }} />}
                    </div>
                  </DevLayoutSection>

                  {/* TODO: Myjob VHC Assistant remains here but is intentionally hidden from the front end for now. */}
                  {false && <DevLayoutSection as="div" sectionKey="myjob-vhc-assistant" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="section-card-bg" className="vhc-content-card">
                      <VhcAssistantPanel state={vhcAssistantState} title="VHC Assistant (Technician)" chromeless />
                    </DevLayoutSection>}

                  {!showVhcSummary && <>
                      {/* Mandatory Sections */}
                      <DevLayoutSection as="div" sectionKey="myjob-vhc-mandatory" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="section-card-bg" className="vhc-content-card">
                    <h3 className="vhc-section-heading" style={{ color: "var(--text-1)" }}>Mandatory Sections</h3>
                    <div className="vhc-card-grid">

                  {/* Wheels & Tyres */}
                  <DevLayoutSection as="div" sectionKey="myjob-vhc-card-wheels" sectionType="content-card" parentKey="myjob-vhc-mandatory" backgroundToken="control-bg" className="vhc-card vhc-card--mandatory" onClick={() => openSection("wheelsTyres")}>
                    <div className="vhc-card__header">
                      <h4 className="vhc-card__title" style={{ color: "var(--text-1)" }}>Wheels & Tyres</h4>
                      <span className="app-badge app-badge--uppercase" style={getBadgeState(sectionStatus.wheelsTyres)}>
                        {sectionStatus.wheelsTyres}
                      </span>
                    </div>
                    <p className="vhc-card__description">Check tread depth, pressure, and condition</p>
                  </DevLayoutSection>

                  {/* Brakes & Hubs */}
                  <DevLayoutSection as="div" sectionKey="myjob-vhc-card-brakes" sectionType="content-card" parentKey="myjob-vhc-mandatory" backgroundToken="control-bg" className="vhc-card vhc-card--mandatory" onClick={() => openSection("brakesHubs")}>
                    <div className="vhc-card__header">
                      <h4 className="vhc-card__title" style={{ color: "var(--text-1)" }}>Brakes & Hubs</h4>
                      <span className="app-badge app-badge--uppercase" style={getBadgeState(sectionStatus.brakesHubs)}>
                        {sectionStatus.brakesHubs}
                      </span>
                    </div>
                    <p className="vhc-card__description">Check pads, discs, and brake system</p>
                  </DevLayoutSection>

                  {/* Service Indicator & Under Bonnet */}
                  <DevLayoutSection as="div" sectionKey="myjob-vhc-card-service" sectionType="content-card" parentKey="myjob-vhc-mandatory" backgroundToken="control-bg" className="vhc-card vhc-card--mandatory" onClick={() => openSection("serviceIndicator")}>
                    <div className="vhc-card__header">
                      <h4 className="vhc-card__title" style={{ color: "var(--text-1)" }}>Service Indicator & Under Bonnet</h4>
                      <span className="app-badge app-badge--uppercase" style={getBadgeState(sectionStatus.serviceIndicator)}>
                        {sectionStatus.serviceIndicator}
                      </span>
                    </div>
                    <p className="vhc-card__description">Service reminder, oil level, under bonnet items</p>
                  </DevLayoutSection>
                </div>
                      </DevLayoutSection>

              {/* Additional Checks (Optional) */}
              <DevLayoutSection as="div" sectionKey="myjob-vhc-additional" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="section-card-bg" className="vhc-content-card">
                <h3 className="vhc-section-heading" style={{ color: "var(--text-1)" }}>
                  Additional Checks
                  <span style={{
                    fontSize: "12px",
                    fontWeight: "normal",
                    marginLeft: "8px",
                    color: "var(--text-1)"
                  }}>
                    (Optional)
                  </span>
                </h3>
                <div className="vhc-card-grid">

                  {/* External */}
                  <DevLayoutSection as="div" sectionKey="myjob-vhc-card-external" sectionType="content-card" parentKey="myjob-vhc-additional" backgroundToken="control-bg" className="vhc-card" onClick={() => openSection("externalInspection")}>
                    <div className="vhc-card__header">
                      <h4 className="vhc-card__title" style={{ color: "var(--text-1)" }}>External</h4>
                      {getOptionalCount("externalInspection") > 0 && <span className="app-badge app-badge--uppercase" style={{
                        backgroundColor: "var(--primary-hover)",
                        color: "var(--text-2)"
                      }}>
                          {getOptionalCount("externalInspection")} items
                        </span>}
                    </div>
                    <p className="vhc-card__description">Body, lights, glass, mirrors</p>
                  </DevLayoutSection>

                  {/* Internal & Electrics */}
                  <DevLayoutSection as="div" sectionKey="myjob-vhc-card-internal" sectionType="content-card" parentKey="myjob-vhc-additional" backgroundToken="control-bg" className="vhc-card" onClick={() => openSection("internalElectrics")}>
                    <div className="vhc-card__header">
                      <h4 className="vhc-card__title" style={{ color: "var(--text-1)" }}>Internal & Electrics</h4>
                      {getOptionalCount("internalElectrics") > 0 && <span className="app-badge app-badge--uppercase" style={{
                        backgroundColor: "var(--primary-hover)",
                        color: "var(--text-2)"
                      }}>
                          {getOptionalCount("internalElectrics")} items
                        </span>}
                    </div>
                    <p className="vhc-card__description">Interior, lights, electrics, controls</p>
                  </DevLayoutSection>

                  {/* Underside */}
                  <DevLayoutSection as="div" sectionKey="myjob-vhc-card-underside" sectionType="content-card" parentKey="myjob-vhc-additional" backgroundToken="control-bg" className="vhc-card" onClick={() => openSection("underside")}>
                    <div className="vhc-card__header">
                      <h4 className="vhc-card__title" style={{ color: "var(--text-1)" }}>Underside</h4>
                      {getOptionalCount("underside") > 0 && <span className="app-badge app-badge--uppercase" style={{
                        backgroundColor: "var(--primary-hover)",
                        color: "var(--text-2)"
                      }}>
                          {getOptionalCount("underside")} items
                        </span>}
                    </div>
                    <p className="vhc-card__description">Exhaust, suspension, steering, driveshafts</p>
                  </DevLayoutSection>
                </div>
              </DevLayoutSection>
                </>}

              {/* VHC Summary */}
              {showVhcSummary && <DevLayoutSection as="div" sectionKey="myjob-vhc-summary" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="section-card-bg" className="vhc-content-card vhc-content-card--bordered">
                  <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px"
              }}>
                    <h3 className="vhc-section-heading" style={{
                  marginBottom: 0
                }}>
                      VHC Summary
                    </h3>
                  </div>

                  <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px"
              }}>
                    {/* Red Items */}
                    {vhcSummaryItems.red.length > 0 && <div>
                        <div className="vhc-summary-banner" style={{
                    backgroundColor: "var(--danger-surface)"
                  }}>
                          <strong style={{
                      color: "var(--text-1)"
                    }}>
                            Critical Issues ({vhcSummaryItems.red.length})
                          </strong>
                        </div>
                        {vhcSummaryItems.red.map((item, idx) => renderVhcSummaryItem(item, idx))}
                      </div>}

                    {/* Amber Items */}
                    {vhcSummaryItems.amber.length > 0 && <div>
                        <div className="vhc-summary-banner" style={{
                    backgroundColor: "var(--warning-surface)"
                  }}>
                          <strong style={{
                      color: "var(--text-1)"
                    }}>
                            Advisory Items ({vhcSummaryItems.amber.length})
                          </strong>
                        </div>
                        {vhcSummaryItems.amber.map((item, idx) => renderVhcSummaryItem(item, idx))}
                      </div>}

                    {/* Green Items (Toggle) */}
                    {vhcSummaryItems.green.length > 0 && <div>
                        <div className="vhc-summary-banner" style={{
                    backgroundColor: "var(--success-surface)",
                    cursor: "pointer"
                  }} onClick={() => setShowGreenItems(!showGreenItems)}>
                          <strong style={{
                      color: "var(--text-1)"
                    }}>
                            OK Items ({vhcSummaryItems.green.length})
                          </strong>
                          <span style={{
                      marginLeft: "auto",
                      fontSize: "12px",
                      color: "var(--text-1)"
                    }}>
                            {showGreenItems ? "Hide" : "Show"}
                          </span>
                        </div>
                        {showGreenItems && vhcSummaryItems.green.map((item, idx) => renderVhcSummaryItem(item, idx))}
                      </div>}

                    {vhcSummaryItems.red.length === 0 && vhcSummaryItems.amber.length === 0 && vhcSummaryItems.green.length === 0 && <p style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "var(--text-1)",
                  textAlign: "center",
                  padding: "20px"
                }}>
                        No items reported yet. Complete the VHC sections to add items.
                      </p>}
                  </div>
                </DevLayoutSection>}
                </>)}

              {/* Captured media — read-only viewer so the technician can see the
                  photos / videos they took against concerns during this check. */}
              {!activeSection && <DevLayoutSection as="div" sectionKey="myjob-vhc-media" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="section-card-bg" className="vhc-content-card">
                  <VhcMediaGallery jobId={resolvedJobId} reloadToken={galleryReloadToken} />
                </DevLayoutSection>}

              {/* VHC Modals */}
              {activeSection === "wheelsTyres" && <DevLayoutSection as="div" sectionKey="myjob-vhc-modal-wheels" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="surface">
                  <WheelsTyresDetailsModal isOpen={true} inlineMode onClose={data => handleSectionDismiss("wheelsTyres", data)} onComplete={data => handleSectionComplete("wheelsTyres", data)} initialData={vhcData.wheelsTyres} isReopenMode={isReopenMode} jobId={resolvedJobId} jobNumber={jobNumber} userId={dbUserId || user?.id || null} onSectionMediaUploaded={() => { fetchJobData?.(); bumpGallery(); }} />
                </DevLayoutSection>}

              {activeSection === "brakesHubs" && <DevLayoutSection as="div" sectionKey="myjob-vhc-modal-brakes" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="surface">
                  <BrakesHubsDetailsModal isOpen={true} inlineMode onClose={data => handleSectionDismiss("brakesHubs", data)} onComplete={data => handleSectionComplete("brakesHubs", data)} initialData={vhcData.brakesHubs} isReopenMode={isReopenMode} jobId={resolvedJobId} jobNumber={jobNumber} userId={dbUserId || user?.id || null} onSectionMediaUploaded={() => { fetchJobData?.(); bumpGallery(); }} />
                </DevLayoutSection>}

              {activeSection === "serviceIndicator" && <DevLayoutSection as="div" sectionKey="myjob-vhc-modal-service" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="surface">
                  <ServiceIndicatorDetailsModal isOpen={true} inlineMode onClose={data => handleSectionDismiss("serviceIndicator", data)} onComplete={data => handleSectionComplete("serviceIndicator", data)} initialData={vhcData.serviceIndicator} isReopenMode={isReopenMode} jobId={resolvedJobId} jobNumber={jobNumber} userId={dbUserId || user?.id || null} onSectionMediaUploaded={() => { fetchJobData?.(); bumpGallery(); }} />
                </DevLayoutSection>}

              {activeSection === "externalInspection" && <DevLayoutSection as="div" sectionKey="myjob-vhc-modal-external" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="surface">
                  <ExternalDetailsModal isOpen={true} inlineMode onClose={data => handleSectionDismiss("externalInspection", data)} onComplete={data => handleSectionComplete("externalInspection", data)} initialData={vhcData.externalInspection} isReopenMode={isReopenMode} jobId={resolvedJobId} jobNumber={jobNumber} userId={dbUserId || user?.id || null} onSectionMediaUploaded={() => { fetchJobData?.(); bumpGallery(); }} />
                </DevLayoutSection>}

              {activeSection === "internalElectrics" && <DevLayoutSection as="div" sectionKey="myjob-vhc-modal-internal" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="surface">
                  <InternalElectricsDetailsModal isOpen={true} inlineMode onClose={data => handleSectionDismiss("internalElectrics", data)} onComplete={data => handleSectionComplete("internalElectrics", data)} initialData={vhcData.internalElectrics} isReopenMode={isReopenMode} jobId={resolvedJobId} jobNumber={jobNumber} userId={dbUserId || user?.id || null} onSectionMediaUploaded={() => { fetchJobData?.(); bumpGallery(); }} />
                </DevLayoutSection>}

              {activeSection === "underside" && <DevLayoutSection as="div" sectionKey="myjob-vhc-modal-underside" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="surface">
                  <UndersideDetailsModal isOpen={true} inlineMode onClose={data => handleSectionDismiss("underside", data)} onComplete={data => handleSectionComplete("underside", data)} initialData={vhcData.underside} isReopenMode={isReopenMode} jobId={resolvedJobId} jobNumber={jobNumber} userId={dbUserId || user?.id || null} onSectionMediaUploaded={() => { fetchJobData?.(); bumpGallery(); }} />
                </DevLayoutSection>}
            </DevLayoutSection>}

          {/* PARTS TAB */}
          {activeTab === "parts" && <DevLayoutSection as="div" sectionKey="myjob-tab-parts" sectionType="section-shell" parentKey="myjob-main-scroll" backgroundToken="none" shell style={{
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "var(--page-stack-gap)",
            alignItems: "stretch"
          }}>
              <LayerSurface as="section" sectionKey="myjob-parts-active-requests" sectionType="content-card" parentKey="myjob-tab-parts" backgroundToken="surface" radius="var(--radius-sm)" padding="20px" gap="12px">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--text-1)" }}>Active Requests</h3>
                  <span style={{ fontSize: "12px", color: "var(--text-1)" }}>
                    {partsRequests.length} request{partsRequests.length === 1 ? "" : "s"} · {bookedJobParts.length} booked part{bookedJobParts.length === 1 ? "" : "s"}
                  </span>
                </div>
                {partsRequestsLoading ? <p style={{ margin: 0, fontSize: "14px", color: "var(--text-1)" }}>Loading requests and booked parts...</p> : partsRequests.length === 0 && bookedJobParts.length === 0 ? <p style={{ margin: 0, fontSize: "14px", color: "var(--text-1)" }}>
                  No part requests or booked parts for this job yet.
                </p> : partsRequests.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {partsRequests.map((request) => {
                    const statusLabel = formatRequestStatusLabel(request.status);
                    const badgeStyle = getPartsStatusStyle(request.status);
                    const quantity = request.quantity ?? 1;
                    const bookedPart = findBookedPartForRequest(request);
                    const partLabel = bookedPart ? resolveBookedPartName(bookedPart) : resolveRequestPartName(request);
                    const partNumber = bookedPart ? resolveBookedPartNumber(bookedPart) : request?.part?.part_number || request?.part?.partNumber || "";
                    const location = [extractRequestDetail(request.description, "Side"), extractRequestDetail(request.description, "Vehicle area")].filter(Boolean).join(" ") || "Not set";
                    const priority = extractRequestDetail(request.description, "Priority") || statusLabel;
                    const requesterName = request.requester ? `${request.requester.first_name || ""} ${request.requester.last_name || ""}`.trim() : "";
                    const canEditRequest = ["pending", "waiting_authorisation"].includes(String(request.status || "").toLowerCase()) && !request.fulfilled_by;
                    const isExpanded = expandedPartRequestId === request.request_id;
                    const latestUpdate = request.updated_at && request.updated_at !== request.created_at ? formatDateTime(request.updated_at) : "No Parts update yet";
                    return <LayerTheme key={request.request_id} as="article" sectionKey={`myjob-parts-request-row-${request.request_id}`} sectionType="content-card" parentKey="myjob-parts-active-requests" backgroundToken="theme" radius="var(--radius-sm)" padding="14px" gap="10px">
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1.4fr) repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", alignItems: "start" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {editingPartRequestId === request.request_id ? (
                            <input className="app-input" value={editingPartRequestText} onChange={(event) => setEditingPartRequestText(event.target.value)} />
                          ) : (
                            <strong style={{ color: "var(--text-1)", fontSize: "15px" }}>{partLabel}</strong>
                          )}
                          {partNumber && <span style={{ color: "var(--text-1)", fontSize: "12px" }}>Part number: {partNumber}</span>}
                          <span style={{ color: "var(--text-1)", fontSize: "12px" }}>Requested by {requesterName || "Technician"}</span>
                          <span style={{ color: "var(--text-1)", fontSize: "12px" }}>Requested {formatDateTime(request.created_at)}</span>
                        </div>
                        <span style={{ color: "var(--text-1)", fontSize: "13px" }}>Qty {quantity}</span>
                        <span style={{ color: "var(--text-1)", fontSize: "13px" }}>Vehicle: {location}</span>
                        {bookedPart && <span style={{ color: "var(--text-1)", fontSize: "13px" }}>Collect: {resolveBookedPartCollectionLocation(bookedPart)}</span>}
                        <span style={{ color: "var(--text-1)", fontSize: "13px" }}>{priority}</span>
                        <span style={{ ...badgeStyle, color: "var(--text-1)", padding: "5px 10px", borderRadius: "var(--control-radius)", fontSize: "11px", fontWeight: "700", textAlign: "center" }}>{statusLabel}</span>
                      </div>
                      <div style={{ color: "var(--text-1)", fontSize: "12px" }}>Latest update: {latestUpdate}</div>
                      {isExpanded && <div style={{ color: "var(--text-1)", fontSize: "13px", whiteSpace: "pre-wrap" }}>{request.description || "No detail supplied."}</div>}
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setExpandedPartRequestId(isExpanded ? null : request.request_id)}>{isExpanded ? "Hide Details" : "View Details"}</Button>
                        {editingPartRequestId === request.request_id ? <>
                          <Button type="button" variant="primary" size="sm" onClick={() => saveEditRequest(request)}>Save Edit</Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => setEditingPartRequestId(null)}>Cancel Edit</Button>
                        </> : canEditRequest && <Button type="button" variant="secondary" size="sm" onClick={() => startEditRequest(request)}>Edit</Button>}
                        {canEditRequest && <Button type="button" variant="secondary" size="sm" onClick={() => handlePartsRequestAction?.({ requestId: request.request_id, action: "cancel" })}>Cancel Request</Button>}
                        {String(request.status || "").toLowerCase() === "issued" && <Button type="button" variant="primary" size="sm" onClick={() => handlePartsRequestAction?.({ requestId: request.request_id, action: "fitted", jobItemId: request.fulfilled_by })}>Mark Fitted</Button>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) auto", gap: "8px", alignItems: "center" }}>
                        <input
                          className="app-input"
                          value={requestNoteDrafts[request.request_id] || ""}
                          onChange={(event) => setRequestNoteDrafts((prev) => ({ ...prev, [request.request_id]: event.target.value }))}
                          placeholder="Add a note for this request"
                        />
                        <Button type="button" variant="secondary" size="sm" onClick={() => sendRequestNote(request)}>Add Note</Button>
                      </div>
                    </LayerTheme>;
                  })}
                </div>}
                {directlyBookedJobParts.length > 0 && <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                    <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--text-1)" }}>Booked to this job</h4>
                    <span style={{ fontSize: "12px", color: "var(--text-1)" }}>From the job-card Parts tab</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {directlyBookedJobParts.map((part) => {
                      const statusLabel = formatRequestStatusLabel(part.status);
                      const badgeStyle = getPartsStatusStyle(part.status);
                      const partName = resolveBookedPartName(part);
                      const partNumber = resolveBookedPartNumber(part);
                      const quantityBooked = resolveBookedPartQuantity(part, "quantityRequested", "quantity_requested");
                      const quantityAllocated = resolveBookedPartQuantity(part, "quantityAllocated", "quantity_allocated");
                      const quantityFitted = resolveBookedPartQuantity(part, "quantityFitted", "quantity_fitted");
                      const stockLocation = part?.storageLocation ?? part?.storage_location ?? part?.part?.storageLocation ?? part?.part?.storage_location ?? "";
                      const requestNotes = part?.requestNotes ?? part?.request_notes ?? "";
                      const updatedAt = part?.updatedAt ?? part?.updated_at ?? part?.createdAt ?? part?.created_at ?? null;

                      return <LayerTheme key={part.id} as="article" sectionKey={`myjob-parts-booked-row-${part.id}`} sectionType="content-card" parentKey="myjob-parts-active-requests" backgroundToken="theme" radius="var(--radius-sm)" padding="14px" gap="10px">
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1.5fr) repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", alignItems: "start" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <strong style={{ color: "var(--text-1)", fontSize: "15px" }}>{partName}</strong>
                            <span style={{ color: "var(--text-1)", fontSize: "12px" }}>Part number: {partNumber || "Not recorded"}</span>
                          </div>
                          <span style={{ color: "var(--text-1)", fontSize: "13px" }}>Booked: {quantityBooked || 1}</span>
                          <span style={{ color: "var(--text-1)", fontSize: "13px" }}>Allocated: {quantityAllocated}</span>
                          <span style={{ color: "var(--text-1)", fontSize: "13px" }}>Fitted: {quantityFitted}</span>
                          <span style={{ ...badgeStyle, color: "var(--text-1)", padding: "5px 10px", borderRadius: "var(--control-radius)", fontSize: "11px", fontWeight: "700", textAlign: "center" }}>{statusLabel}</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", color: "var(--text-1)", fontSize: "12px" }}>
                          <span>Collection location: {resolveBookedPartCollectionLocation(part)}</span>
                          <span>Stock location: {stockLocation || "Not recorded"}</span>
                          <span>Latest update: {updatedAt ? formatDateTime(updatedAt) : "Not recorded"}</span>
                        </div>
                        {requestNotes && <div style={{ color: "var(--text-1)", fontSize: "12px", whiteSpace: "pre-wrap" }}>Parts note: {requestNotes}</div>}
                      </LayerTheme>;
                    })}
                  </div>
                </>}
              </LayerSurface>

              {(Array.isArray(authorizedParts) && authorizedParts.length > 0) && <LayerSurface as="section" sectionKey="myjob-parts-ready-approved" sectionType="content-card" parentKey="myjob-tab-parts" backgroundToken="surface" radius="var(--radius-sm)" padding="20px" gap="12px">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--text-1)" }}>Ready or Approved Parts</h3>
                  <span style={{ fontSize: "12px", color: "var(--text-1)" }}>{authorizedParts.length} item{authorizedParts.length === 1 ? "" : "s"}</span>
                </div>
                {authorizedPartsLoading ? <p style={{ margin: 0, fontSize: "14px", color: "var(--text-1)" }}>Loading approved parts...</p> : <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {authorizedParts.map((part) => {
                    const statusLabel = formatRequestStatusLabel(part.status);
                    const badgeStyle = getPartsStatusStyle(part.status);
                    const partName = part.part?.name || part.part_name_snapshot || part.row_description || "Approved part";
                    const canCollect = ["allocated", "pre_picked", "picked", "stock"].includes(String(part.status || "").toLowerCase());
                    return <LayerTheme key={part.id} as="article" sectionKey={`myjob-parts-ready-${part.id}`} sectionType="content-card" parentKey="myjob-parts-ready-approved" backgroundToken="theme" radius="var(--radius-sm)" padding="14px" gap="8px">
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1.5fr) repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", alignItems: "center" }}>
                        <strong style={{ color: "var(--text-1)", fontSize: "15px" }}>{partName}</strong>
                        <span style={{ color: "var(--text-1)", fontSize: "13px" }}>Qty {part.quantity_requested || 1}</span>
                        <span style={{ color: "var(--text-1)", fontSize: "13px" }}>{part.authorised ? "Approved" : "Ordered"}</span>
                        <span style={{ ...badgeStyle, color: "var(--text-1)", padding: "5px 10px", borderRadius: "var(--control-radius)", fontSize: "11px", fontWeight: "700", textAlign: "center" }}>{statusLabel}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", color: "var(--text-1)", fontSize: "12px" }}>
                        <span>Latest update: {formatDateTime(part.updated_at || part.created_at)}</span>
                        {canCollect && <Button type="button" variant="primary" size="sm" onClick={() => handlePartJobItemAction?.({ jobItemId: part.id, action: "collected" })}>Mark as Collected</Button>}
                      </div>
                    </LayerTheme>;
                  })}
                </div>}
              </LayerSurface>}

              {(!authorizedParts || authorizedParts.length === 0) && !authorizedVhcRowsLoading && authorizedVhcRows.length > 0 && <LayerSurface as="section" sectionKey="myjob-parts-authorised-findings" sectionType="content-card" parentKey="myjob-tab-parts" backgroundToken="surface" radius="var(--radius-sm)" padding="16px" gap="8px">
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>Approved technician findings</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-1)" }}>{authorizedVhcRows.length} approved finding{authorizedVhcRows.length === 1 ? "" : "s"} waiting for parts allocation.</p>
              </LayerSurface>}

              <LayerSurface as="section" sectionKey="myjob-parts-request" sectionType="content-card" parentKey="myjob-tab-parts" backgroundToken="surface" radius="var(--radius-sm)" padding="20px" gap="16px">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    <h3 style={{ margin: 0, fontSize: "19px", fontWeight: "700", color: "var(--text-1)" }}>
                      Request an Individual Part
                    </h3>
                    <p style={{ margin: 0, color: "var(--text-1)", fontSize: "14px", maxWidth: "62ch" }}>
                      Send a part request directly to the Parts team without completing a full VHC.
                    </p>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-1)", backgroundColor: "var(--theme)", borderRadius: "var(--control-radius)", padding: "6px 12px" }}>
                    Sent directly to Parts
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    // Equal outer tracks keep Part Required and Photos at a 50/50 split; quantity occupies the centre track.
                    gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(140px, 180px) minmax(0, 1fr)",
                    gap: "var(--layout-card-gap)",
                    alignItems: "stretch",
                  }}
                >
                  <LayerTheme sectionKey="myjob-parts-required-field" sectionType="content-card" parentKey="myjob-parts-request" radius="var(--radius-sm)" padding="14px" gap="8px">
                    <label style={compactLabelStyle}>
                      Part Required
                      <input
                        type="search"
                        className="app-input app-input--search"
                        value={partRequestDescription}
                        onChange={(event) => {
                          setPartRequestDescription(event.target.value);
                          setPartsValidationError("");
                          if (partsFeedback) setPartsFeedback("");
                        }}
                        placeholder="Search or type the part needed"
                      />
                    </label>
                  </LayerTheme>

                  <LayerTheme sectionKey="myjob-parts-quantity-field" sectionType="content-card" parentKey="myjob-parts-request" radius="var(--radius-sm)" padding="14px" gap="8px" style={{ justifyContent: "center" }}>
                    <label style={compactLabelStyle}>
                      Quantity
                      <div style={{ display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) 44px", gap: "var(--space-2)", alignItems: "center" }}>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setPartRequestQuantity(Math.max(1, Number(partRequestQuantity || 1) - 1))}>-</Button>
                        <input
                          type="number"
                          className="app-input"
                          min={1}
                          value={partRequestQuantity}
                          onChange={(event) => setPartRequestQuantity(Math.max(1, Number(event.target.value) || 1))}
                        />
                        <Button type="button" variant="secondary" size="sm" onClick={() => setPartRequestQuantity(Math.max(1, Number(partRequestQuantity || 1) + 1))}>+</Button>
                      </div>
                    </label>
                  </LayerTheme>

                  <LayerTheme sectionKey="myjob-parts-upload-summary" sectionType="content-card" parentKey="myjob-parts-request" radius="var(--radius-sm)" padding="14px" gap="8px">
                    <label style={compactLabelStyle}>
                      Photos or images (optional)
                      <input
                        ref={partAttachmentInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={(event) => setPartAttachments(Array.from(event.target.files || []))}
                        style={{ display: "none" }}
                      />
                      <Button type="button" variant="secondary" onClick={() => partAttachmentInputRef.current?.click()}>
                        Choose Images
                      </Button>
                      <span style={{ fontSize: "12px", fontWeight: "500", color: "var(--text-1)" }}>
                        {partAttachments.length ? `${partAttachments.length} image${partAttachments.length === 1 ? "" : "s"} selected` : "Capture a photo or upload existing images."}
                      </span>
                    </label>
                  </LayerTheme>
                </div>

                {partsValidationError && <div role="alert" style={{ fontSize: "13px", color: "var(--text-1)", backgroundColor: "var(--danger-surface)", borderRadius: "var(--radius-xs)", padding: "10px 14px" }}>
                  {partsValidationError}
                </div>}
                {partsFeedback && <div role="status" style={{ fontSize: "13px", color: "var(--text-1)", backgroundColor: partsFeedback.toLowerCase().includes("failed") || partsFeedback.toLowerCase().includes("unable") ? "var(--danger-surface)" : "var(--success-surface)", borderRadius: "var(--radius-xs)", padding: "10px 14px" }}>
                  {partsFeedback}
                </div>}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  <Button type="button" variant="secondary" onClick={clearPartRequestForm} disabled={partsSubmitting || partsUploadBusy}>Clear</Button>
                  <Button type="button" variant="primary" busy={partsSubmitting || partsUploadBusy} onClick={submitIndividualPartRequest}>
                    Send Request to Parts
                  </Button>
                </div>
              </LayerSurface>
            </DevLayoutSection>}

          {/* NOTES TAB */}
          {activeTab === "notes" && <DevLayoutSection as="div" className="app-page-stack" sectionKey="myjob-tab-notes" sectionType="content-card" parentKey="myjob-main-scroll" backgroundToken="none" data-dev-page="My job detail" data-dev-tab="Notes" data-dev-card-section="notes tab" data-dev-text-preview="Notes tab" data-dev-auto-outline="cards" style={{
            gap: "var(--space-4)"
          }}>
              {NotesTabNew && workspaceJobData ? <NotesTabNew
                jobData={workspaceJobData}
                canEdit={canEditWorkspace}
                actingUserNumericId={actingUserNumericId}
                onNotesChange={handleNotesChange}
                noteHistoryJobs={[]}
              /> : <>
              <DevLayoutSection as="div" sectionKey="myjob-notes-toolbar" sectionType="toolbar" parentKey="myjob-tab-notes" backgroundToken="none" style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
                <h3 style={{
              fontSize: "18px",
              fontWeight: "600",
              margin: 0
            }}>
                  Technician Notes
                </h3>
                <span style={{
              fontSize: "13px",
              color: "var(--text-1)"
            }}>
                  {notes.length} note{notes.length === 1 ? "" : "s"}
                </span>
                <button onClick={() => setShowAddNote(true)} style={{
              padding: "10px 20px",
              backgroundColor: "var(--primary)",
              color: "var(--text-2)",
              borderRadius: "var(--radius-xs)",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}>
                  + Add Note
                </button>
              </DevLayoutSection>

              {showAddNote && <DevLayoutSection as="div" sectionKey="myjob-notes-compose" sectionType="content-card" parentKey="myjob-tab-notes" backgroundToken="layer-section-level-3" style={{
            padding: "20px",
            backgroundColor: "var(--layer-section-level-3)",
            borderRadius: "var(--radius-sm)",
            border: "none"
          }}>
                  <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note about the job..." style={{
              width: "100%",
              padding: "12px 14px",
              border: "none",
              borderRadius: "var(--control-radius-xs)",
              resize: "vertical",
              minHeight: "110px",
              fontSize: "14px",
              marginBottom: "12px",
              backgroundColor: "var(--surface)"
            }} />
                  <div style={{
              display: "flex",
              gap: "10px",
              justifyContent: "flex-end"
            }}>
                    <button onClick={() => setShowAddNote(false)} style={{
                padding: "10px 18px",
                backgroundColor: "var(--surface)",
                color: "var(--text-1)",
                border: "none",
                borderRadius: "var(--radius-xs)",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500"
              }}>
                      Cancel
                    </button>
                    <button onClick={handleAddNote} disabled={notesSubmitting} style={{
                padding: "10px 18px",
                backgroundColor: notesSubmitting ? "var(--primary-border)" : "var(--info)",
                color: "var(--text-2)",
                border: "none",
                borderRadius: "var(--radius-xs)",
                cursor: notesSubmitting ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "600"
              }}>
                      {notesSubmitting ? "Saving..." : "Save Note"}
                    </button>
                  </div>
                </DevLayoutSection>}

              {notesLoading ? <DevLayoutSection as="div" sectionKey="myjob-notes-loading" sectionType="content-card" parentKey="myjob-tab-notes" backgroundToken="none" style={{
            padding: "32px",
            textAlign: "center",
            color: "var(--text-1)"
          }}>
                  Loading notes…
                </DevLayoutSection> : notes.length === 0 ? <DevLayoutSection as="div" sectionKey="myjob-notes-empty" sectionType="content-card" parentKey="myjob-tab-notes" backgroundToken="layer-section-level-3" style={{
            textAlign: "center",
            padding: "40px",
            color: "var(--text-1)",
            backgroundColor: "var(--layer-section-level-3)",
            borderRadius: "var(--radius-sm)",
            border: "none"
          }}>
                  <p style={{
              fontSize: "16px",
              fontWeight: "600",
              marginBottom: "4px"
            }}>No notes added yet</p>
                  <p style={{
              fontSize: "14px",
              color: "var(--text-1)"
            }}>
                    Keep technicians aligned by logging progress, issues and next steps.
                  </p>
                </DevLayoutSection> : <DevLayoutSection as="div" sectionKey="myjob-notes-list" sectionType="section-shell" parentKey="myjob-tab-notes" backgroundToken="none" style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
                  {notes.map((note, index) => {
              const noteId = note.noteId || note.note_id || note.id;
              const creatorName = note.createdBy || "Unknown";
              const createdAt = formatDateTime(note.createdAt || note.created_at);
              const updatedLabel = note.updatedAt && note.updatedAt !== note.createdAt ? ` • Updated ${formatDateTime(note.updatedAt)}` : "";
              return <DevLayoutSection as="div" key={noteId} sectionKey={`myjob-note-${noteId}`} sectionType="content-card" parentKey="myjob-notes-list" backgroundToken="layer-section-level-3" style={{
                border: "none",
                borderRadius: "var(--control-radius-xs)",
                padding: "16px",
                backgroundColor: "var(--layer-section-level-3)"
              }}>
                        <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: "8px"
                }}>
                          <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                            <span style={{
                      padding: "4px 10px",
                      borderRadius: "var(--control-radius)",
                      backgroundColor: "var(--theme)",
                      color: "var(--text-1)",
                      fontSize: "11px",
                      fontWeight: 700
                    }}>
                              Note {index + 1}
                            </span>
                            <span style={{
                      fontWeight: 600
                    }}>{creatorName}</span>
                          </div>
                          <div style={{
                    fontSize: "12px",
                    color: "var(--text-1)"
                  }}>
                            {createdAt}
                            {updatedLabel}
                          </div>
                        </div>
                        <p style={{
                  margin: 0,
                  color: "var(--text-1)",
                  whiteSpace: "pre-wrap"
                }}>
                          {note.noteText || note.note_text}
                        </p>
                      </DevLayoutSection>;
            })}
                </DevLayoutSection>}
              </>}
            </DevLayoutSection>}

          {/* WRITE-UP TAB */}
          <DevLayoutSection
            as="div"
            className="app-page-stack"
            sectionKey="myjob-tab-writeup"
            sectionType="content-card"
            parentKey="myjob-main-scroll"
            backgroundToken="none"
            data-dev-page="My job detail"
            data-dev-tab="Write-up"
            data-dev-card-section="write-up tab"
            data-dev-text-preview="Write-up tab"
            data-dev-auto-outline="cards"
            style={{
              display: activeTab === "write-up" ? undefined : "none"
            }}
          >
            {WriteUpWorkspace && workspaceJobData ? <WriteUpWorkspace
              jobData={workspaceJobData}
              equalSplit
              canEdit={canEditWorkspace}
              onUpdate={handleUpdateRequests}
              onUpdateRequestStatus={handleUpdateRequestStatus}
              onSaveRequestWorkDetails={handleSaveRequestWorkDetails}
              onMarkAllRequestsComplete={handleMarkAllRequestsComplete}
              onSaveWriteUp={handleSaveWriteUp}
              onCompletionChange={nextStatus => {
                setJobData(prev => {
                  if (!prev?.jobCard) return prev;
                  const nextWriteUp = {
                    ...(prev.jobCard.writeUp || {}),
                    completion_status: nextStatus
                  };
                  return {
                    ...prev,
                    jobCard: {
                      ...prev.jobCard,
                      completionStatus: nextStatus,
                      writeUp: nextWriteUp
                    }
                  };
                });
              }}
              onTasksSnapshotChange={nextTasks => {
                setLiveWriteUpTasks(Array.isArray(nextTasks) ? nextTasks : []);
              }}
              onNavigateTab={setActiveTab}
              clockingEntries={workspaceClockingEntries}
              overallStatusId={workspaceOverallStatusId}
              vhcChecks={vhcChecks}
              notes={notes}
              partsJobItems={workspaceJobData.parts_job_items || []}
            /> : <WriteUpForm jobNumber={jobNumber} jobCardData={jobData} showHeader={false} onCompletionChange={nextStatus => {
              setJobData(prev => {
                if (!prev?.jobCard) return prev;
                const nextWriteUp = {
                  ...(prev.jobCard.writeUp || {}),
                  completion_status: nextStatus
                };
                return {
                  ...prev,
                  jobCard: {
                    ...prev.jobCard,
                    completionStatus: nextStatus,
                    writeUp: nextWriteUp
                  }
                };
              });
            }} onTasksSnapshotChange={nextTasks => {
              setLiveWriteUpTasks(Array.isArray(nextTasks) ? nextTasks : []);
            }} />}
          </DevLayoutSection>

          {/* DOCUMENTS TAB */}
          {activeTab === "documents" && <DevLayoutSection as="div" className="app-page-stack" sectionKey="myjob-tab-documents" sectionType="content-card" parentKey="myjob-main-scroll" backgroundToken="none" data-dev-page="My job detail" data-dev-tab="Documents" data-dev-card-section="documents tab" data-dev-text-preview="Documents tab" data-dev-auto-outline="cards">
              <DocumentsTab documents={jobDocuments} canDelete={canManageDocuments} onDelete={handleDeleteDocument} onManageDocuments={canManageDocuments ? () => setShowDocumentsPopup(true) : undefined} onRenameDocument={handleRenameDocument} onReplaceDocument={canManageDocuments ? handleReplaceDocument : undefined} />
            </DevLayoutSection>}
          </DevLayoutSection>
        </TechnicianJobContentShell>

        {/* Bottom Action Bar */}
      <DocumentsUploadPopup open={showDocumentsPopup} onClose={() => setShowDocumentsPopup(false)} jobId={jobData?.jobCard?.id ? String(jobData.jobCard.id) : null} userId={user?.user_id || dbUserId || null} onAfterUpload={fetchJobData} existingDocuments={jobDocuments} />
      {LocationUpdateModal && trackerQuickModalOpen && <LocationUpdateModal
        entry={{
          jobNumber: jobCard?.jobNumber || jobNumber || "",
          reg: vehicle?.reg || "",
          customer: customerName,
          serviceType: jobCard?.type || jobCard?.serviceType || "",
          vehicleLocation: trackerEntry?.vehicleLocation || "N/A",
          keyLocation: trackerEntry?.keyLocation || "N/A"
        }}
        onClose={() => setTrackerQuickModalOpen(false)}
        onSave={handleTrackerSave}
      />}
      {showJobTypesPopup && <ModalPortal>
          <div className="popup-backdrop" onClick={event => {
      if (event.target === event.currentTarget) {
        setShowJobTypesPopup(false);
      }
    }}>
            <div className="popup-card" style={{
        borderRadius: "var(--radius-xl)",
        width: "100%",
        maxWidth: "560px",
        maxHeight: "88vh",
        overflowY: "auto",
        border: "none"
      }} onClick={event => event.stopPropagation()}>
              <div style={{
          padding: "28px"
        }}>
                <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px"
          }}>
                  <h3 style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--text-1)",
              letterSpacing: "0.02em"
            }}>
                    Job Requests
                  </h3>
                  <button type="button" onClick={() => setShowJobTypesPopup(false)} style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "22px",
              lineHeight: 1,
              color: "var(--text-1)"
            }} aria-label="Close job requests popup">
                    ×
                  </button>
                </div>

                <div style={{
            display: "grid",
            gap: "10px"
          }}>
                  {detectedJobTypes.map((jobType, index) => <LayerTheme
                    key={`${jobType}-${index}`}
                    radius="var(--radius-sm)"
                    padding="12px 14px"
                    gap="12px"
                    style={{
              flexDirection: "row",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
                      <span style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-1)"
              }}>
                        {jobType}
                      </span>
                      <span style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--text-1)",
                letterSpacing: "0.05em",
                textTransform: "uppercase"
              }}>
                        Type {index + 1}
                      </span>
                    </LayerTheme>)}
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>}
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
