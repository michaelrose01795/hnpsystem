// file location: src/components/JobCards/CustomerRequestsTab.js
//
// The Customer Requests tab, shared by /job-cards/[jobNumber] and
// /tech/[jobNumber] (where it is the technician's default tab). Moved verbatim
// out of the job-card page so the technician route no longer has to import it.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import RequestPresetAutosuggestInput from "@/components/JobCards/RequestPresetAutosuggestInput";
import { DropdownField } from "@/components/ui/dropdownAPI";
import {
  getCustomerRequestEffectiveStatus,
  getCustomerRequestWorkflowStatus,
  getWriteUpChecklistTasks,
  getWriteUpCompletionState,
  isCustomerRequestCompleteInWriteUp,
} from "@/features/jobCards/workflow/selectors";
import { sumJobClockingHours } from "@/lib/jobClocking/totals"; // pure helper - avoids pulling the Supabase client into render
import { normalizeRequests } from "@/lib/jobCards/utils";
import { isDiagnosticRequestText } from "@/lib/jobRequestPresets/constants";
import { collectLinkedPartRows, resolveLinkedPrePickLocation } from "@/lib/prePickLocations";
import { resolveMainStatusId } from "@/lib/status/statusFlow";
import { resolveVhcSeverity } from "@/lib/jobCards/vhcSeverity";
import {
  normalizeStatusId,
  SERVICE_CHOICE_LABELS,
  safeJsonParse,
  normalizeWriteUpCompletionStatus,
  isRemovedPartsRow,
  preferLatestPartRow,
} from "@/lib/jobCards/requestHelpers";

// Customer Requests Tab
export function CustomerRequestsTab({
  jobData,
  canEdit,
  onUpdate,
  onUpdateRequestPrePickLocation = async () => {},
  onUpdateRequestStatus = async () => {},
  onNavigateTab = () => {},
  clockingEntries = [],
  overallStatusId = null,
  vhcSummary = { total: 0, red: 0, amber: 0 },
  vhcChecks = [],
  notes = [],
  partsJobItems = []
}) {
  const buildEditRequests = useCallback(() => {
    const source = Array.isArray(jobData?.jobRequests) ?
    jobData.jobRequests :
    Array.isArray(jobData?.job_requests) ?
    jobData.job_requests :
    [];
    if (source.length > 0) {
      const legacyDetails = normalizeRequests(jobData.requests);
      return source.map((row, index) => ({
        ...(legacyDetails[row.sortOrder ? Number(row.sortOrder) - 1 : index] || {}),
        requestId: row.requestId ?? row.request_id ?? null,
        presetId: row.presetId ?? row.job_request_preset_id ?? null,
        text: row.description ?? row.text ?? "",
        time: row.hours ?? row.time ?? "",
        paymentType: row.jobType ?? row.job_type ?? row.paymentType ?? "Customer",
        noteText: row.noteText ?? row.note_text ?? "",
        prePickLocation: row.prePickLocation ?? row.pre_pick_location ?? null
      }));
    }
    return normalizeRequests(jobData.requests).map((req) => ({
      requestId: null,
      text: req?.text || req?.description || req || "",
      time: req?.time ?? req?.hours ?? "",
      paymentType: req?.paymentType || req?.jobType || "Customer",
      noteText: "",
      prePickLocation: null,
      labourPrice: req?.labourPrice ?? "",
      menuPrice: req?.menuPrice ?? "",
      setPrice: req?.setPrice ?? req?.price ?? "",
      discount: req?.discount ?? "",
      specialRate: Boolean(req?.specialRate)
    }));
  }, [jobData]);
  const [requests, setRequests] = useState(buildEditRequests);
  const [editableAuthorisedRows, setEditableAuthorisedRows] = useState([]);
  const [editing, setEditing] = useState(false);
  const [moreEditRequestIndex, setMoreEditRequestIndex] = useState(null);
  // Selected request key for the 60/40 detail panel. Null falls back to the
  // first row, so the panel always shows something.
  const [selectedRequestKey, setSelectedRequestKey] = useState(null);
  const smallPrintStyle = { fontSize: "11px", color: "var(--info)" };
  const indentedNoteStyle = {
    ...smallPrintStyle,
    marginLeft: "14px",
    display: "block"
  };
  const requestSubtitleStyle = {
    fontSize: "11px",
    color: "var(--grey-accent)",
    fontWeight: "700",
    letterSpacing: "0.12em",
    textTransform: "uppercase"
  };
  const requestRowBaseStyle = {
    padding: "14px",
    color: "var(--text-2)",
    border: "none",
    borderRadius: "var(--control-radius)",
    marginBottom: "12px",
    transition: "var(--control-transition)"
  };
  const requestRowButtonStyle = {
    ...requestRowBaseStyle,
    backgroundColor: "var(--warning-surface)"
  };
  const authorisedRowButtonStyle = {
    ...requestRowBaseStyle,
    backgroundColor: "var(--success-surface)"
  };
  // Read-only pre-pick display, styled as a staffglobal `.app-input` text field.
  // Pre-pick is now set per-part from the Parts tab "Part Details" popup; these
  // request rows only mirror the linked part's saved location, so they render a
  // label rather than an editable dropdown (single source of truth).
  const prePickLabelStyle = {
    height: "var(--control-height)",
    minHeight: "var(--control-height)",
    padding: "var(--control-padding)",
    display: "flex",
    alignItems: "center",
    fontSize: "var(--control-font-size)",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  };
  const requestColumnGridStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 190px 90px 180px 150px",
    columnGap: "8px",
    rowGap: "12px",
    alignItems: "center"
  };
  const requestColumnBaseStyle = {
    minWidth: 0,
    display: "flex",
    alignItems: "center"
  };
  const requestValueColumnStyle = {
    ...requestColumnBaseStyle,
    justifyContent: "stretch"
  };
  const requestFullWidthValueStyle = {
    width: "100%"
  };
  const requestMoneyInputStyle = {
    width: "118px",
    flexShrink: 0
  };
  const requestDetailsFieldStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0
  };
  const requestDetailsLabelStyle = {
    fontSize: "12px",
    // --text-1 = surface body-text tone; --text-2 is the on-accent tone and
    // would render invisible against the popup's surface card.
    color: "var(--text-1)",
    fontWeight: 700
  };
  const requestDetailsGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px"
  };
  const paymentTypeOptions = [
    { value: "Customer", label: "Customer" },
    { value: "Warranty", label: "Warranty" },
    { value: "Sales Goodwill", label: "Sales Goodwill" },
    { value: "Service Goodwill", label: "Service Goodwill" },
    { value: "Internal", label: "Internal" },
    { value: "Insurance", label: "Insurance" },
    { value: "Lease Company", label: "Lease Company" },
    { value: "Staff", label: "Staff" }
  ];
  const getPaymentTypePillStyle = useCallback((paymentType = "") => {
    const normalizedType = String(paymentType || "").trim().toLowerCase();
    const isCustomer = normalizedType === "customer";
    const isWarranty = normalizedType === "warranty";
    const isGoodwill = normalizedType.includes("goodwill");
    const isInternal = normalizedType === "internal";
    const isDanger = normalizedType === "insurance" || normalizedType === "lease company";
    return {
      backgroundColor: isCustomer ? "var(--success-surface)" : isWarranty || isInternal ? "var(--warning-surface)" : isDanger ? "var(--danger-surface)" : isGoodwill ? "var(--theme)" : "var(--control-bg)",
      color: isCustomer ? "var(--success-text)" : isWarranty || isInternal ? "var(--warning-text)" : isDanger ? "var(--danger-text)" : isGoodwill ? "var(--info)" : "var(--accentText)"
    };
  }, []);
  const getStatusPillStyle = useCallback((normalizedStatus = "") => {
    // "Authorised" deliberately omitted here so it falls through to the default
    // pill style (var(--theme) bg / var(--info) text) — i.e. the same styling as
    // the "In Progress" status, per request.
    const isSuccess = ["added_to_job", "completed", "done"].includes(normalizedStatus);
    const isDanger = ["removed", "declined", "cancelled", "canceled"].includes(normalizedStatus);
    const isWarning = ["not_started", "on_hold", "hold", "pending"].includes(normalizedStatus);
    return {
      backgroundColor: isSuccess ? "var(--success-surface)" : isDanger ? "var(--danger-surface)" : isWarning ? "var(--warning-surface)" : "var(--theme)",
      color: isSuccess ? "var(--success-text)" : isDanger ? "var(--danger-text)" : isWarning ? "var(--warning-text)" : "var(--info)"
    };
  }, []);
  const formatPrePickLabel = (value = "") => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    return trimmed.
    split("_").
    map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).
    join(" ");
  };
  const formatHoursDisplay = (value) => {
    const numeric = Number(value);
    const safe = Number.isFinite(numeric) ? numeric : 0;
    return `${safe.toFixed(1)}h`;
  };
  const unifiedRequests = useMemo(() => {
    const source = Array.isArray(jobData?.jobRequests) ?
    jobData.jobRequests :
    Array.isArray(jobData?.job_requests) ?
    jobData.job_requests :
    [];

    if (source.length === 0) {
      return normalizeRequests(jobData.requests).map((req, index) => ({
        requestId: null,
        presetId: null,
        description: req?.text || req?.description || req || "",
        hours: req?.time ?? req?.hours ?? "",
        jobType: req?.paymentType || req?.jobType || "Customer",
        sortOrder: index + 1,
        status: null,
        requestSource: "customer_request",
        prePickLocation: null,
        noteText: "",
        vhcItemId: null
      }));
    }

    return source.map((row, index) => ({
      requestId: row.requestId ?? row.request_id ?? null,
      presetId: row.presetId ?? row.job_request_preset_id ?? null,
      description: row.description ?? row.text ?? "",
      hours: row.hours ?? row.time ?? "",
      jobType: row.jobType ?? row.job_type ?? row.paymentType ?? "Customer",
      sortOrder:
      row.sortOrder ?? row.sort_order ?? index + 1,
      status: row.status ?? null,
      requestSource: row.requestSource ?? row.request_source ?? "customer_request",
      prePickLocation: row.prePickLocation ?? row.pre_pick_location ?? null,
      noteText: row.noteText ?? row.note_text ?? "",
      vhcItemId: row.vhcItemId ?? row.vhc_item_id ?? null
    }));
  }, [jobData?.jobRequests, jobData?.job_requests, jobData?.requests]);

  const customerRequestRows = useMemo(() => {
    return unifiedRequests.
    filter((row) => (row.requestSource || "customer_request") === "customer_request").
    sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [unifiedRequests]);

  const linkedNotesByRequestIndex = useMemo(() => {
    const sourceNotes = Array.isArray(notes) ? notes : [];
    const map = new Map();

    sourceNotes.forEach((note) => {
      const noteText = (note?.noteText || "").toString().trim();
      if (!noteText) return;

      const indices = Array.isArray(note?.linkedRequestIndices) ?
      note.linkedRequestIndices :
      Number.isInteger(note?.linkedRequestIndex) ?
      [note.linkedRequestIndex] :
      [];

      indices.forEach((value) => {
        const index = Number(value);
        if (!Number.isInteger(index) || index <= 0) return;
        const existing = map.get(index) || [];
        if (!existing.includes(noteText)) {
          map.set(index, [...existing, noteText]);
        }
      });
    });

    return map;
  }, [notes]);

  const linkedPrePickPartsSource = useMemo(
    () => [
    ...(Array.isArray(jobData?.partsAllocations) ? jobData.partsAllocations : []),
    ...(Array.isArray(jobData?.parts_job_items) ? jobData.parts_job_items : [])],

    [jobData?.partsAllocations, jobData?.parts_job_items]
  );

  const vhcAliasMap = useMemo(() => {
    const rows = Array.isArray(jobData?.vhcItemAliases) ?
    jobData.vhcItemAliases :
    [];
    const map = new Map();
    rows.forEach((row) => {
      const displayId = row?.display_id ?? row?.displayId ?? null;
      const vhcItemId = row?.vhc_item_id ?? row?.vhcItemId ?? null;
      if (displayId === null || displayId === undefined) return;
      if (vhcItemId === null || vhcItemId === undefined) return;
      map.set(String(displayId), String(vhcItemId));
    });
    return map;
  }, [jobData?.vhcItemAliases]);

  const resolveCanonicalVhcId = useCallback(
    (value) => {
      if (value === null || value === undefined) return "";
      const key = String(value);
      return vhcAliasMap.get(key) || key;
    },
    [vhcAliasMap]
  );

  const getLinkedPartsForRequestRow = useCallback(
    (row) => {
      const requestId = row?.requestId ?? row?.request_id ?? null;
      const canonicalVhcId = resolveCanonicalVhcId(row?.vhcItemId ?? row?.vhc_item_id ?? null);
      const normalizedRequestId =
      requestId === null || requestId === undefined || requestId === "" ?
      null :
      String(requestId).trim();
      const normalizedVhcId =
      canonicalVhcId === null || canonicalVhcId === undefined || canonicalVhcId === "" ?
      null :
      String(canonicalVhcId).trim();

      const matchedRows = linkedPrePickPartsSource.filter((item) => {
        if (!item) return false;
        const itemRequestId = item?.allocatedToRequestId ?? item?.allocated_to_request_id ?? item?.requestId ?? item?.request_id ?? null;
        const itemVhcId = resolveCanonicalVhcId(item?.vhcItemId ?? item?.vhc_item_id ?? null);
        const matchesRequest =
        normalizedRequestId &&
        itemRequestId !== null &&
        itemRequestId !== undefined &&
        String(itemRequestId).trim() === normalizedRequestId;
        const matchesVhc =
        normalizedVhcId &&
        itemVhcId !== null &&
        itemVhcId !== undefined &&
        String(itemVhcId).trim() === normalizedVhcId;
        return Boolean(matchesRequest || matchesVhc);
      });

      const deduped = new Map();
      matchedRows.forEach((item) => {
        const itemRequestId = item?.allocatedToRequestId ?? item?.allocated_to_request_id ?? item?.requestId ?? item?.request_id ?? null;
        const itemVhcId = resolveCanonicalVhcId(item?.vhcItemId ?? item?.vhc_item_id ?? null);
        const itemKey =
        item?.id !== null && item?.id !== undefined ?
        `id:${item.id}` :
        `link:${String(itemRequestId || "")}:${String(itemVhcId || "")}:${String(item?.part_id ?? item?.partId ?? item?.part?.id ?? "")}`;
        deduped.set(itemKey, preferLatestPartRow(deduped.get(itemKey) || null, item));
      });

      return Array.from(deduped.values());
    },
    [linkedPrePickPartsSource, resolveCanonicalVhcId]
  );

  const vhcChecksheetPayload = useMemo(() => {
    const checks = Array.isArray(jobData?.vhcChecks) ? jobData.vhcChecks : [];
    const builderRecord = checks.find((check) => {
      const section = (check?.section || "").toString().trim();
      return section === "VHC_CHECKSHEET" || section === "VHC Checksheet";
    });
    return safeJsonParse(builderRecord?.issue_description || builderRecord?.data) || null;
  }, [jobData?.vhcChecks]);

  const serviceChoiceLabel = useMemo(() => {
    const choiceKey = vhcChecksheetPayload?.serviceIndicator?.serviceChoice || "";
    return SERVICE_CHOICE_LABELS[choiceKey] || choiceKey || "";
  }, [vhcChecksheetPayload]);

  const normaliseServiceText = useCallback(
    (value = "") =>
    value.
    toString().
    toLowerCase().
    replace(/[^a-z0-9]+/g, " ").
    replace(/\s+/g, " ").
    trim(),
    []
  );

  const normaliseAuthorizationState = useCallback((value) => {
    const lower = String(value || "").toLowerCase().trim();
    if (!lower) return "";
    if (lower.includes("added_to_job")) return "added_to_job";
    if (lower === "authorised" || lower === "approved") return "authorized";
    if (lower === "complete") return "completed";
    if (lower === "rejected") return "declined";
    return lower;
  }, []);

  const writeUpCompletionStatus = normalizeWriteUpCompletionStatus(
    jobData?.writeUp?.completion_status || jobData?.completionStatus || ""
  );

  // Pull the write-up checklist tasks so per-request completion can flow
  // through to this tab. Tasks are stored either as an array directly, an
  // object with a .tasks array, or a JSON string of either shape.
  const writeUpChecklistTasksRaw = jobData?.writeUp?.task_checklist;
  const writeUpChecklistTasks = useMemo(
    () => getWriteUpChecklistTasks(writeUpChecklistTasksRaw),
    [writeUpChecklistTasksRaw]
  );

  // Reuse the canonical write-up completion selector. isCompleteInstant is
  // true when EITHER the completion_status is set to a complete-like value
  // OR every checklist row is checked — which is what the user expects when
  // they tick off every row but haven't yet hit the explicit "Mark Complete"
  // button.
  const writeUpStateForRequests = getWriteUpCompletionState({
    completionStatus: writeUpCompletionStatus,
    checklistTasks: writeUpChecklistTasks,
    requestRows: customerRequestRows
  });
  const writeUpMarkedComplete = writeUpStateForRequests.isCompleteInstant;

  const isRequestRowCompleteFromWriteUp = useCallback(
    (request, requestIndex = -1) => isCustomerRequestCompleteInWriteUp({
      request,
      requestIndex,
      checklistTasks: writeUpChecklistTasks,
    }),
    [writeUpChecklistTasks]
  );

  const mainJobStatusId = overallStatusId || resolveMainStatusId(jobData?.status);
  const customerRequestStatusByWorkflow = getCustomerRequestWorkflowStatus({
    jobStatus: mainJobStatusId,
    writeUpComplete: writeUpMarkedComplete
  });

  const getRequestStatusPresentation = useCallback((statusValue, fallbackStatus = "inprogress") => {
    const normalizedStatusValue = String(statusValue || fallbackStatus || "inprogress").
    trim().
    toLowerCase().
    replace(/\s+/g, "_");
    const normalizedStatus =
      normalizedStatusValue === "complete" || normalizedStatusValue === "done" ?
      "completed" :
      normalizedStatusValue;

    const UK_LABELS = {
      authorized: "Authorised",
      authorised: "Authorised",
      added_to_job: "Added to Job",
      removed: "Removed",
      completed: "Completed",
      not_started: "Not Started",
      declined: "Declined",
      inprogress: "In Progress",
      pending: "Pending",
      cancelled: "Cancelled",
      on_hold: "On Hold"
    };
    const statusLabel =
    UK_LABELS[normalizedStatus] ||
    normalizedStatus.
    split("_").
    filter(Boolean).
    map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).
    join(" ") || "In Progress";

    const statusBadgeStyle = {
      ...getStatusPillStyle(normalizedStatus)
    };

    return { normalizedStatus, statusLabel, statusBadgeStyle };
  }, [getStatusPillStyle]);

  // Authorised VHC items (source: vhc_checks where approval_status is authorized/completed)
  const authorisedRows = useMemo(() => {
    const authorisedRequestRows = unifiedRequests.filter((row) => {
      const requestSource = (row?.requestSource || row?.request_source || "").toString().toLowerCase().trim();
      const status = normaliseAuthorizationState(row?.status);
      const hasVhcLink = row?.vhcItemId !== null && row?.vhcItemId !== undefined;
      return (
        requestSource === "vhc_authorised" ||
        requestSource === "vhc_authorized" ||
        hasVhcLink && (status === "authorized" || status === "completed" || status === "added_to_job"));

    });
    const authorisedRequestRowByRequestId = new Map();
    const authorisedRequestRowByVhcId = new Map();
    authorisedRequestRows.forEach((row) => {
      const requestId = row?.requestId ?? row?.request_id ?? null;
      const rawVhcItemId = row?.vhcItemId ?? row?.vhc_item_id ?? null;
      const canonicalVhcId =
      rawVhcItemId !== null && rawVhcItemId !== undefined && String(rawVhcItemId).trim() !== "" ?
      resolveCanonicalVhcId(rawVhcItemId) :
      null;
      if (requestId !== null && requestId !== undefined) {
        authorisedRequestRowByRequestId.set(String(requestId), row);
      }
      if (canonicalVhcId !== null && canonicalVhcId !== undefined && String(canonicalVhcId).trim() !== "") {
        authorisedRequestRowByVhcId.set(String(canonicalVhcId), row);
      }
    });
    const vhcChecksList = Array.isArray(vhcChecks) ? vhcChecks : [];
    const vhcCheckByVhcId = new Map();
    const vhcCheckByRequestId = new Map();
    vhcChecksList.forEach((check) => {
      const vhcId = check?.vhc_id ?? check?.vhcId ?? null;
      const requestId = check?.request_id ?? check?.requestId ?? null;
      if (vhcId !== null && vhcId !== undefined) vhcCheckByVhcId.set(String(vhcId), check);
      if (requestId !== null && requestId !== undefined) vhcCheckByRequestId.set(String(requestId), check);
    });
    const canonicalAuthorized = Array.isArray(jobData?.authorizedVhcItems) ?
    jobData.authorizedVhcItems :
    [];
    const requestFallbackAuthorized = authorisedRequestRows.map((row) => {
      const matchedCheck =
      (row?.vhcItemId !== null && row?.vhcItemId !== undefined ?
      vhcCheckByVhcId.get(String(row.vhcItemId)) :
      null) || (
      row?.requestId !== null && row?.requestId !== undefined ?
      vhcCheckByRequestId.get(String(row.requestId)) :
      null) ||
      null;
      const checkDecision = matchedCheck ?
      normaliseAuthorizationState(matchedCheck.authorization_state || matchedCheck.approval_status) :
      null;
      const checkIsComplete = checkDecision === "completed" || matchedCheck?.Complete === true || matchedCheck?.complete === true;
      return {
        request_id: row?.requestId ?? matchedCheck?.request_id ?? null,
        vhc_item_id: row?.vhcItemId ?? matchedCheck?.vhc_id ?? null,
        label: matchedCheck?.issue_title || row?.description || "",
        description: matchedCheck?.issue_title || row?.description || "",
        text: matchedCheck?.issue_title || row?.description || "",
        issue_title: matchedCheck?.issue_title ?? null,
        issue_description: matchedCheck?.issue_description ?? null,
        note_text: row?.noteText ?? matchedCheck?.note_text ?? "",
        noteText: row?.noteText ?? matchedCheck?.note_text ?? "",
        section: matchedCheck?.section ?? "",
        labour_hours: matchedCheck?.labour_hours ?? row?.hours ?? null,
        parts_cost: matchedCheck?.parts_cost ?? null,
        approved_at: matchedCheck?.approved_at ?? null,
        approved_by: matchedCheck?.approved_by ?? null,
        pre_pick_location: row?.prePickLocation ?? matchedCheck?.pre_pick_location ?? null,
        hours: row?.hours ?? matchedCheck?.labour_hours ?? null,
        time: row?.hours ?? matchedCheck?.labour_hours ?? null,
        job_type: row?.jobType ?? "Customer",
        paymentType: row?.jobType ?? "Customer",
        status: row?.status ?? (checkIsComplete ? "completed" : checkDecision) ?? null,
        approval_status: matchedCheck?.approval_status ?? null,
        authorization_state: matchedCheck?.authorization_state ?? null,
        complete: checkIsComplete,
        request_source: "vhc_authorised",
        sort_order: row?.sortOrder ?? null
      };
    });
    const checksFallbackAuthorized = (Array.isArray(vhcChecks) ? vhcChecks : []).
    filter((row) => {
      const section = String(row?.section || "").trim();
      if (section === "VHC_CHECKSHEET" || section === "VHC Checksheet") return false;
      const decision = normaliseAuthorizationState(row?.authorization_state || row?.approval_status);
      return (
        decision === "authorized" ||
        decision === "completed" ||
        decision === "added_to_job");

    }).
    map((row) => {
      const decision = normaliseAuthorizationState(row?.authorization_state || row?.approval_status);
      const isComplete = decision === "completed" || row?.Complete === true || row?.complete === true;
      return {
        vhc_item_id: row?.vhc_id ?? null,
        issue_title: row?.issue_title ?? null,
        issue_description: row?.issue_description ?? null,
        note_text: row?.note_text ?? null,
        section: row?.section ?? "",
        labour_hours: row?.labour_hours ?? null,
        parts_cost: row?.parts_cost ?? null,
        approved_at: row?.approved_at ?? null,
        approved_by: row?.approved_by ?? null,
        pre_pick_location: row?.pre_pick_location ?? null,
        request_id: row?.request_id ?? null,
        request_source: "vhc_authorised",
        status: isComplete ? "completed" : decision || null,
        approval_status: row?.approval_status ?? null,
        authorization_state: row?.authorization_state ?? null,
        complete: isComplete
      };
    });

    // Merge all sources so authorised rows remain visible even if one source is stale/partial.
    const mergedAuthorized = [];
    const seenAuthorizedKeys = new Set();
    const pushUniqueAuthorised = (row) => {
      if (!row) return;
      const requestId = row?.requestId ?? row?.request_id ?? null;
      const rawVhcItemId = row?.vhcItemId ?? row?.vhc_item_id ?? null;
      const vhcItemId =
      rawVhcItemId !== null && rawVhcItemId !== undefined ?
      resolveCanonicalVhcId(rawVhcItemId) :
      null;
      const label = row?.label || row?.description || row?.text || row?.issue_title || row?.section || "";
      const key =
      vhcItemId !== null && vhcItemId !== undefined && String(vhcItemId).trim() !== "" ?
      `vhc:${vhcItemId}` :
      requestId !== null && requestId !== undefined ?
      `req:${requestId}` :
      `txt:${normaliseServiceText(label)}`;
      if (!key || seenAuthorizedKeys.has(key)) return;
      seenAuthorizedKeys.add(key);
      mergedAuthorized.push(row);
    };
    canonicalAuthorized.forEach(pushUniqueAuthorised);
    requestFallbackAuthorized.forEach(pushUniqueAuthorised);
    checksFallbackAuthorized.forEach(pushUniqueAuthorised);
    const toWheelPositionOrder = (text) => {
      const value = normaliseServiceText(text);
      if (value.includes("nsf")) return 1;
      if (value.includes("osf")) return 2;
      if (value.includes("nsr")) return 3;
      if (value.includes("osr")) return 4;
      if (value.includes("front")) return 5;
      if (value.includes("rear")) return 6;
      return 99;
    };

    const deriveAuthorisedGroupKey = (row, label, baseLabel) => {
      const sectionKey = normaliseServiceText(row.section || "");
      if (sectionKey) return sectionKey;

      const labelKey = normaliseServiceText(label || baseLabel || "");
      if (!labelKey) return "zzz_other";
      if (labelKey.includes("wheel") || labelKey.includes("tyre") || labelKey.includes("tire")) {
        return "wheels_tyres";
      }
      if (labelKey.includes("wiper") || labelKey.includes("washer") || labelKey.includes("horn")) {
        return "wipers_washers_horn";
      }
      return labelKey;
    };

    const mappedRows = mergedAuthorized.map((row, rowIndex) => {
      const rawRequestId = row?.requestId ?? row?.request_id ?? null;
      const rawVhcItemId = row?.vhcItemId ?? row?.vhc_item_id ?? null;
      const canonicalVhcItemId =
      rawVhcItemId !== null && rawVhcItemId !== undefined && String(rawVhcItemId).trim() !== "" ?
      resolveCanonicalVhcId(rawVhcItemId) :
      null;
      const linkedRequestRow =
      (rawRequestId !== null && rawRequestId !== undefined ?
      authorisedRequestRowByRequestId.get(String(rawRequestId)) :
      null) || (
      canonicalVhcItemId !== null && canonicalVhcItemId !== undefined ?
      authorisedRequestRowByVhcId.get(String(canonicalVhcItemId)) :
      null) ||
      null;
      const matchedCheck =
      (rawRequestId !== null && rawRequestId !== undefined ?
      vhcCheckByRequestId.get(String(rawRequestId)) :
      null) || (
      canonicalVhcItemId !== null && canonicalVhcItemId !== undefined ?
      vhcCheckByVhcId.get(String(canonicalVhcItemId)) :
      null) ||
      null;
      const resolvedRequestId =
      rawRequestId ??
      linkedRequestRow?.requestId ??
      linkedRequestRow?.request_id ??
      matchedCheck?.request_id ??
      matchedCheck?.requestId ??
      null;
      const linkedPartRows = collectLinkedPartRows({
        parts: linkedPrePickPartsSource,
        requestId: resolvedRequestId,
        vhcItemId: canonicalVhcItemId ?? rawVhcItemId ?? null,
        resolveCanonicalVhcId
      });
      const resolvedPrePickLocation =
      resolveLinkedPrePickLocation({
        linkedPartRows,
        fallbackValues: [
        row?.prePickLocation,
        row?.pre_pick_location,
        linkedRequestRow?.prePickLocation,
        linkedRequestRow?.pre_pick_location,
        matchedCheck?.pre_pick_location,
        matchedCheck?.prePickLocation]

      });
      const rawSection = row.section || "";
      const rawLabel =
      row.label ||
      row.description ||
      row.text ||
      row.section ||
      "Authorised item";
      const detail =
      row.issueDescription ||
      row.noteText ||
      row.issue_description ||
      row.issueDescription ||
      "";
      const cleanedDetail =
      detail && rawLabel.toLowerCase().includes(detail.toLowerCase()) ? "" : detail;
      const baseLabel = cleanedDetail ? `${rawLabel} - ${cleanedDetail}` : rawLabel;
      const labelKey = normaliseServiceText(baseLabel);
      const sectionKey = normaliseServiceText(rawSection);
      const isServiceIndicatorRow =
      sectionKey.includes("service indicator") ||
      sectionKey.includes("under bonnet") ||
      labelKey.includes("service indicator") ||
      labelKey.includes("under bonnet");
      const isServiceReminderOil =
      labelKey.includes("service reminder") &&
      labelKey.includes("oil");
      const isServiceReminder =
      labelKey.includes("service reminder") || sectionKey.includes("service reminder");
      const serviceDetail = serviceChoiceLabel || "";

      const computedLabel =
      isServiceIndicatorRow && (isServiceReminderOil || isServiceReminder) ?
      "Service Reminder" :
      baseLabel;
      const computedDetail =
      isServiceIndicatorRow && (isServiceReminderOil || isServiceReminder) ?
      serviceDetail :
      null;

      return {
        requestId: resolvedRequestId,
        description: row.description ?? row.text ?? row.section ?? "",
        label: computedLabel,
        detail: computedDetail,
        hours: row.hours ?? row.time ?? row.labourHours ?? "",
        jobType: row.jobType ?? row.job_type ?? row.paymentType ?? "Customer",
        sortOrder: row.sortOrder ?? row.sort_order ?? null,
        status: row.status ?? null,
        requestSource: row.requestSource ?? row.request_source ?? "vhc_authorised",
        prePickLocation: resolvedPrePickLocation,
        noteText: row.noteText ?? row.note_text ?? "",
        vhcItemId: canonicalVhcItemId ?? rawVhcItemId ?? null,
        labourHours: row.labourHours ?? row.labour_hours ?? null,
        partsCost: row.partsCost ?? row.parts_cost ?? null,
        complete: Boolean(row.complete ?? row.Complete ?? false),
        approvalStatus: row.approvalStatus ?? row.approval_status ?? null,
        authorizationState: row.authorizationState ?? row.authorization_state ?? null,
        approvedAt: row.approvedAt ?? row.approved_at ?? null,
        approvedBy: row.approvedBy ?? row.approved_by ?? null,
        _groupKey: deriveAuthorisedGroupKey(row, computedLabel, baseLabel),
        _wheelOrder: toWheelPositionOrder(`${computedLabel || ""} ${computedDetail || ""}`),
        _originalIndex: rowIndex,
        // Resolve VHC severity for the row so it can drive red/amber row backgrounds + ordering in Authorised/Completed/Declined sections. Merge every available source — the matched VHC check, the linked request row, and the row itself — so the severity field is found regardless of which shape the row arrived as.
        severity: resolveVhcSeverity({ ...(row || {}), ...(linkedRequestRow || {}), ...(matchedCheck || {}) })
      };
    });

    const baseSorted = mappedRows.
    sort((a, b) => {
      const groupCompare = String(a._groupKey || "").localeCompare(String(b._groupKey || ""));
      if (groupCompare !== 0) return groupCompare;

      const wheelCompare = (a._wheelOrder ?? 99) - (b._wheelOrder ?? 99);
      if (wheelCompare !== 0) return wheelCompare;

      const sortOrderA = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : Number.POSITIVE_INFINITY;
      const sortOrderB = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : Number.POSITIVE_INFINITY;
      if (sortOrderA !== sortOrderB) return sortOrderA - sortOrderB;

      const approvedAtA = a.approvedAt ? new Date(a.approvedAt).getTime() : Number.POSITIVE_INFINITY;
      const approvedAtB = b.approvedAt ? new Date(b.approvedAt).getTime() : Number.POSITIVE_INFINITY;
      if (approvedAtA !== approvedAtB) return approvedAtA - approvedAtB;

      return (a._originalIndex ?? 0) - (b._originalIndex ?? 0);
    });

    // Stable severity-priority pass: red rows first, then amber, others retain prior relative order.
    const severityRank = (sev) => sev === "red" ? 0 : sev === "amber" ? 1 : 2;
    return baseSorted.
    map((row, idx) => ({ row, idx })).
    sort((a, b) => {
      const sevDiff = severityRank(a.row.severity) - severityRank(b.row.severity);
      if (sevDiff !== 0) return sevDiff;
      return a.idx - b.idx;
    }).
    map(({ row }) => row).
    map(({ _groupKey, _wheelOrder, _originalIndex, ...row }) => row);
  }, [jobData?.authorizedVhcItems, linkedPrePickPartsSource, unifiedRequests, vhcChecks, normaliseAuthorizationState, normaliseServiceText, serviceChoiceLabel, resolveCanonicalVhcId]);

  const authorisedColumns = useMemo(() => {
    const columns = [[], [], []];
    authorisedRows.forEach((item, index) => {
      const baseColumn = Math.floor(index / 3);
      const columnIndex = baseColumn < 3 ? baseColumn : index % 3;
      columns[columnIndex].push(item);
    });
    return columns.filter((column) => column.length > 0);
  }, [authorisedRows]);

  const buildEditableRequests = useCallback(
    (rows) => {
      const legacyDetails = normalizeRequests(jobData.requests);
      return (Array.isArray(rows) ? rows : []).map((row, index) => {
        const legacy = legacyDetails[row.sortOrder ? Number(row.sortOrder) - 1 : index] || {};
        return {
      ...legacy,
      requestId: row.requestId ?? null,
      presetId: row.presetId ?? row.job_request_preset_id ?? null,
      text: row.description || "",
      time: row.hours ?? "",
      paymentType: row.jobType || "Customer",
      noteText: row.noteText || "",
      prePickLocation: row.prePickLocation ?? null,
      sortOrder: row.sortOrder ?? index + 1,
      labourPrice: legacy.labourPrice ?? "",
      menuPrice: legacy.menuPrice ?? "",
      setPrice: legacy.setPrice ?? legacy.price ?? "",
      discount: legacy.discount ?? "",
      specialRate: Boolean(legacy.specialRate)
    };
      });
    },
    [jobData.requests]
  );

  const buildEditableAuthorisedRows = useCallback(
    (rows) =>
    (Array.isArray(rows) ? rows : []).map((row, index) => ({
      requestId: row.requestId ?? null,
      vhcItemId: row.vhcItemId ?? null,
      text: row.label || row.description || "Authorised item",
      time: row.labourHours ?? row.hours ?? "",
      paymentType: row.jobType || "Customer",
      noteText: row.noteText || "",
      prePickLocation: row.prePickLocation ?? null,
      sortOrder: row.sortOrder ?? index + 1,
      severity: row.severity || "grey" // Carry severity for red/amber row tinting in edit mode.
    })),
    []
  );

  useEffect(() => {
    setRequests(buildEditableRequests(customerRequestRows));
  }, [buildEditableRequests, customerRequestRows]);

  useEffect(() => {
    setEditableAuthorisedRows(buildEditableAuthorisedRows(authorisedRows));
  }, [authorisedRows, buildEditableAuthorisedRows]);

  const handleSave = () => {
    onUpdate({
      customerRequests: requests,
      authorisedRows: editableAuthorisedRows
    });
    setEditing(false);
  };

  const handleAddRequest = () => {
    setRequests([
    ...requests,
    { text: "", time: "", paymentType: "Customer", noteText: "", prePickLocation: null, presetId: null, labourPrice: "", menuPrice: "", setPrice: "", discount: "", specialRate: false }]
    );
  };

  const handleRemoveRequest = (index) => {
    setRequests(requests.filter((_, i) => i !== index));
  };

  const handleUpdateRequest = (index, field, value) => {
    const updated = [...requests];
    updated[index][field] = value;
    if (field === "text") {
      if (
      updated[index]?.presetId &&
      String(value || "").trim() !== String(updated[index]?.selectedPresetLabel || "").trim())
      {
        updated[index].presetId = null;
      }
      if (isDiagnosticRequestText(value)) {
        updated[index].time = 1;
      }
    }
    setRequests(updated);
  };

  const persistPresetHoursFromRow = async (row = {}) => {
    const requestText = String(row?.text || "").trim();
    const parsedHours = Number(row?.time);
    if (!requestText) return;
    if (!Number.isFinite(parsedHours) || parsedHours < 0) return;

    try {
      await fetch("/api/job-requests/presets/update-default-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId: row?.presetId || null,
          requestText,
          hours: parsedHours
        })
      });
    } catch (error) {
      console.error("Failed to persist request preset hours", error);
    }
  };

  const handleUpdateAuthorisedEditRow = (index, field, value) => {
    const updated = [...editableAuthorisedRows];
    if (!updated[index]) return;
    updated[index][field] = value;
    setEditableAuthorisedRows(updated);
  };

  // Pre-pick is set per-part from the Parts tab "Part Details" popup (writes
  // parts_job_items.pre_pick_location via /api/parts/update-status). The request
  // rows here are read-only mirrors of that location, so the previous editable
  // dropdown, its options list, and the /api/vhc/pre-pick-location writer have
  // been retired in favour of a single source of truth.

  // Selected request index while editing (drives the right-hand editor panel).
  const [selectedEditIndex, setSelectedEditIndex] = useState(0);

  // ---- Unified rows + stats for the redesigned 60/40 layout ----
  // Per-request clocked hours, summed from job_clocking entries by request_id.
  const clockedHoursByRequestId = useMemo(() => {
    const map = new Map();
    (Array.isArray(clockingEntries) ? clockingEntries : []).forEach((entry) => {
      const requestId = entry?.requestId ?? entry?.request_id ?? null;
      if (requestId === null || requestId === undefined) return;
      const hours = Number(entry?.hoursWorked ?? entry?.hours_worked ?? 0);
      if (!Number.isFinite(hours) || hours <= 0) return;
      const key = String(requestId);
      map.set(key, (map.get(key) || 0) + hours);
    });
    return map;
  }, [clockingEntries]);

  const getClockedHoursForRequestId = useCallback(
    (requestId) => {
      if (requestId === null || requestId === undefined) return 0;
      return clockedHoursByRequestId.get(String(requestId)) || 0;
    },
    [clockedHoursByRequestId]
  );

  const totalJobClockedHours = useMemo(
    () => sumJobClockingHours(clockingEntries),
    [clockingEntries]
  );

  // Combined customer + authorised rows, each fully resolved for table + detail.
  const combinedRequestRows = useMemo(() => {
    const rows = [];
    customerRequestRows.forEach((req, index) => {
      const linkedNoteTexts = linkedNotesByRequestIndex.get(index + 1) || [];
      const resolvedRequestPrePick = resolveLinkedPrePickLocation({
        linkedPartRows: collectLinkedPartRows({
          parts: linkedPrePickPartsSource,
          requestId: req.requestId ?? req.request_id ?? null,
          vhcItemId: req.vhcItemId ?? req.vhc_item_id ?? null,
          resolveCanonicalVhcId
        }),
        fallbackValues: [req.prePickLocation, req.pre_pick_location]
      });
      const rowCompletedInWriteUp = isRequestRowCompleteFromWriteUp(req, index);
      // Honour an explicit job_requests.status of completed (set by the
      // "Mark Complete" action) so the DB write is reflected in the read view;
      // otherwise fall back to the write-up / workflow-derived status.
      const effectiveRowStatus = getCustomerRequestEffectiveStatus({
        requestStatus: req.status,
        completedInWriteUp: rowCompletedInWriteUp,
        workflowStatus: customerRequestStatusByWorkflow
      });
      const { normalizedStatus, statusLabel, statusBadgeStyle } = getRequestStatusPresentation(effectiveRowStatus, "inprogress");
      const requestId = req.requestId ?? req.request_id ?? null;
      rows.push({
        key: `customer-${requestId ?? `idx-${index}`}`,
        kind: "customer",
        numberLabel: String(index + 1),
        title: `Request ${index + 1}`,
        requestId,
        description: req.description || req.text || "",
        detailLine: "",
        noteText: (req.noteText || "").trim(),
        linkedNoteTexts,
        jobType: req.jobType || "",
        hours: req.hours,
        hoursValue: Number(req.hours) || 0,
        prePick: resolvedRequestPrePick || null,
        normalizedStatus,
        statusLabel,
        statusBadgeStyle,
        linkedParts: getLinkedPartsForRequestRow(req),
        severity: null,
        clockedHours: getClockedHoursForRequestId(requestId)
      });
    });
    authorisedRows.forEach((row, index) => {
      const linkedParts = getLinkedPartsForRequestRow(row);
      const hasActiveLinkedPart = linkedParts.some((item) => !isRemovedPartsRow(item));
      const hasOnlyRemovedLinkedParts = linkedParts.length > 0 && linkedParts.every((item) => isRemovedPartsRow(item));
      const authorisedStatusSource =
        (hasActiveLinkedPart ? "added_to_job" : null) ||
        (hasOnlyRemovedLinkedParts ? "removed" : null) ||
        row.status ||
        (row.complete ? "completed" : null) ||
        normaliseAuthorizationState(row.approvalStatus || row.authorizationState) ||
        "authorized";
      const { normalizedStatus, statusLabel, statusBadgeStyle } = getRequestStatusPresentation(authorisedStatusSource, "authorized");
      const labourHoursValue =
        row.labourHours !== null && row.labourHours !== undefined && row.labourHours !== ""
          ? Number(row.labourHours)
          : Number(row.hours) || 0;
      const requestId = row.requestId ?? row.request_id ?? null;
      rows.push({
        key: `authorised-${requestId ?? row.vhcItemId ?? `idx-${index}`}`,
        kind: "authorised",
        numberLabel: `A${index + 1}`,
        title: `Authorised ${index + 1}`,
        requestId,
        vhcItemId: row.vhcItemId ?? row.vhc_item_id ?? null,
        description: row.label || row.description || "Authorised item",
        detailLine: row.detail || "",
        noteText: (row.noteText || "").trim(),
        linkedNoteTexts: [],
        jobType: row.jobType || "",
        hours: labourHoursValue,
        hoursValue: Number(labourHoursValue) || 0,
        prePick: row.prePickLocation || null,
        normalizedStatus,
        statusLabel,
        statusBadgeStyle,
        linkedParts,
        severity: row.severity || null,
        clockedHours: getClockedHoursForRequestId(requestId)
      });
    });
    return rows;
  }, [
    customerRequestRows,
    authorisedRows,
    linkedNotesByRequestIndex,
    linkedPrePickPartsSource,
    resolveCanonicalVhcId,
    isRequestRowCompleteFromWriteUp,
    customerRequestStatusByWorkflow,
    getRequestStatusPresentation,
    getLinkedPartsForRequestRow,
    getClockedHoursForRequestId
  ]);

  const requestStats = useMemo(() => {
    const totalRequests = combinedRequestRows.length;
    const totalHours = combinedRequestRows.reduce((sum, r) => sum + (Number(r.hoursValue) || 0), 0);
    const clockedHours = totalJobClockedHours;
    const prePicked = combinedRequestRows.filter((r) => r.prePick).length;
    const inProgress = combinedRequestRows.filter((r) => r.normalizedStatus === "inprogress").length;
    const complete = combinedRequestRows.filter((r) => r.normalizedStatus === "completed").length;
    return { totalRequests, totalHours, clockedHours, prePicked, inProgress, complete };
  }, [combinedRequestRows, totalJobClockedHours]);

  const selectedRow = useMemo(() => {
    if (!combinedRequestRows.length) return null;
    return combinedRequestRows.find((r) => r.key === selectedRequestKey) || combinedRequestRows[0];
  }, [combinedRequestRows, selectedRequestKey]);

  // Plain token-backed, borderless detail surfaces for the new layout.
  const detailPanelStyle = { backgroundColor: "var(--surface)", borderRadius: "var(--radius-md)", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 };
  const detailCardStyle = { backgroundColor: "var(--theme)", borderRadius: "var(--radius-sm)", padding: "12px 14px" };
  const detailCardLabelStyle = { fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--grey-accent)", marginBottom: "6px" };

  return (
    <div className="jc-customer-requests">
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Stats + actions row. The stat tiles live in a responsive equal-width
            grid (.jc-request-overview-statgrid) that fills all the width up to the
            left of the Edit/Save controls. Each tile shows its title and counter on
            one line when wide enough and wraps the counter below the title when the
            tile gets too narrow. */}
        <div className="app-summary-section">
          <div className="app-summary-grid jc-req-statgrid jc-request-overview-statgrid">
            <div className="app-summary-item"><span className="app-summary-label">Total Requests</span><span className="app-summary-value">{requestStats.totalRequests}</span></div>
            <div className="app-summary-item"><span className="app-summary-label">Total Hours</span><span className="app-summary-value">{formatHoursDisplay(requestStats.totalHours)}</span></div>
            <div className="app-summary-item"><span className="app-summary-label">Clocked Hrs</span><span className="app-summary-value">{formatHoursDisplay(requestStats.clockedHours)}</span></div>
            <div className="app-summary-item"><span className="app-summary-label">Pre-picked</span><span className="app-summary-value">{requestStats.prePicked}</span></div>
            <div className="app-summary-item"><span className="app-summary-label">In Progress</span><span className="app-summary-value">{requestStats.inProgress}</span></div>
            <div className="app-summary-item"><span className="app-summary-label">Complete</span><span className="app-summary-value">{requestStats.complete}</span></div>
          </div>
          {canEdit && !editing &&
          <button
            onClick={() => setEditing(true)}
            style={{
              marginLeft: "auto", // push Edit Requests to the right of the stats row
              alignSelf: "center",
              padding: "var(--control-padding)",
              backgroundColor: "var(--primary)",
              color: "var(--text-2)",
              border: "none",
              borderRadius: "var(--control-radius)",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "var(--control-font-size)",
              height: "44px",
              minHeight: "44px"
            }}>

              Edit Requests
            </button>
          }
          {editing &&
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginLeft: "auto" }}>
              <button
              onClick={handleSave}
              style={{
                padding: "var(--control-padding)",
                backgroundColor: "var(--primary)",
                color: "var(--text-2)",
                border: "none",
                borderRadius: "var(--control-radius)",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "var(--control-font-size)",
                minHeight: "var(--control-height)"
              }}>

                Save
              </button>
              <button
              onClick={() => {
                setRequests(buildEditRequests());
                setEditableAuthorisedRows(buildEditableAuthorisedRows(authorisedRows));
                setEditing(false);
              }}
              style={{
                padding: "var(--control-padding)",
                backgroundColor: "rgba(var(--primary-rgb), 0.08)",
                color: "var(--primary-selected)",
                border: "none",
                borderRadius: "var(--control-radius)",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "var(--control-font-size)",
                minHeight: "var(--control-height)"
              }}>

                Cancel
              </button>
            </div>
          }
        </div>

        {editing ?
        /* ---------- EDIT MODE: 60/40 list + per-request editor ---------- */
        <div className="jc-req-split">
          <div className="jc-req-table-wrap">
            <table className="app-data-table app-data-table--rounded">
              <thead>
                <tr>
                  <th style={{ width: "44px" }}>#</th>
                  <th>Request</th>
                  <th style={{ width: "130px" }}>Billed To</th>
                  <th style={{ width: "80px" }}>Hours</th>
                  <th style={{ width: "96px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req, index) => {
                  const hasHours = req.time !== "" && req.time !== null && req.time !== undefined;
                  return (
                    <tr key={index} className="jc-req-row" style={{ cursor: "pointer", ...(selectedEditIndex === index ? { backgroundColor: "var(--secondary-pressed)" } : null) }} onClick={() => setSelectedEditIndex(index)}>
                      <td style={{ fontWeight: 600 }}>{index + 1}</td>
                      <td className="jc-req-desc-cell" style={{ color: "var(--text-1)" }}><div className="jc-req-desc-clip">{req.text || <span style={{ color: "var(--grey-accent)", fontStyle: "italic" }}>New request...</span>}</div></td>
                      <td>{req.paymentType ? <span className="app-badge" style={getPaymentTypePillStyle(req.paymentType)}>{req.paymentType}</span> : "—"}</td>
                      <td>{hasHours ? `${Number(req.time).toFixed(1)}h` : "—"}</td>
                      <td><button type="button" className="app-btn app-btn--danger app-btn--sm" onClick={(e) => { e.stopPropagation(); handleRemoveRequest(index); setSelectedEditIndex(0); }}>Remove</button></td>
                    </tr>
                  );
                })}
                {requests.length === 0 &&
                <tr><td colSpan={5} style={{ color: "var(--grey-accent)", fontStyle: "italic" }}>No requests yet.</td></tr>}
              </tbody>
            </table>
            <div style={{ marginTop: "12px", paddingInline: "var(--layout-card-gap)" }}>
              <button type="button" className="app-btn app-btn--primary" onClick={handleAddRequest}>Add Request</button>
            </div>

            {editableAuthorisedRows.length > 0 &&
            <div style={{ marginTop: "18px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--success-dark)", marginBottom: "10px", paddingInline: "var(--layout-card-gap)" }}>Authorised VHC</div>
              <table className="app-data-table app-data-table--rounded">
                <thead>
                  <tr><th>Item</th><th style={{ width: "80px" }}>Hours</th><th style={{ width: "150px" }}>Billed To</th></tr>
                </thead>
                <tbody>
                  {editableAuthorisedRows.map((req, index) => {
                    const hasHours = req.time !== "" && req.time !== null && req.time !== undefined;
                    return (
                      <tr key={`authorised-edit-${req.requestId || req.vhcItemId || index}`}>
                        <td className="jc-req-desc-cell" style={{ color: "var(--text-1)" }}><div className="jc-req-desc-clip">{req.text}</div></td>
                        <td>{hasHours ? `${Number(req.time).toFixed(1)}h` : "—"}</td>
                        <td><DropdownField value={req.paymentType} onChange={(e) => handleUpdateAuthorisedEditRow(index, "paymentType", e.target.value)} options={paymentTypeOptions} className="edit-requests-payment-dropdown" disabled={!req.requestId && !req.vhcItemId} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>}
          </div>

          {/* RIGHT: per-request editor */}
          <div style={detailPanelStyle}>
            {requests[selectedEditIndex] ?
            <>
              <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-1)" }}>Request {selectedEditIndex + 1}</h3>
              <div style={requestDetailsFieldStyle}>
                <label style={requestDetailsLabelStyle}>Request Description</label>
                <RequestPresetAutosuggestInput
                  value={requests[selectedEditIndex].text || ""}
                  onChange={(nextValue) => handleUpdateRequest(selectedEditIndex, "text", nextValue)}
                  onPresetSelect={(preset) => {
                    const updated = [...requests];
                    updated[selectedEditIndex] = {
                      ...updated[selectedEditIndex],
                      text: preset.label,
                      time: Number(preset.defaultHours) > 0 ? Number(preset.defaultHours) : "",
                      presetId: preset.id,
                      selectedPresetLabel: preset.label
                    };
                    setRequests(updated);
                  }}
                  inputClassName="app-input" />
              </div>
              <div style={requestDetailsGridStyle}>
                <div style={requestDetailsFieldStyle}><label style={requestDetailsLabelStyle}>Labour Time (h)</label><input type="number" min="0" step="0.01" value={requests[selectedEditIndex].time || ""} onChange={(e) => handleUpdateRequest(selectedEditIndex, "time", e.target.value)} onBlur={() => persistPresetHoursFromRow(requests[selectedEditIndex])} className="app-input" /></div>
                <div style={requestDetailsFieldStyle}><label style={requestDetailsLabelStyle}>Account Type</label><DropdownField value={requests[selectedEditIndex].paymentType || "Customer"} onChange={(e) => handleUpdateRequest(selectedEditIndex, "paymentType", e.target.value)} options={paymentTypeOptions} className="edit-requests-payment-dropdown" /></div>
                <div style={requestDetailsFieldStyle}><label style={requestDetailsLabelStyle}>Labour Price</label><input type="number" min="0" step="0.01" value={requests[selectedEditIndex].labourPrice || ""} onChange={(e) => handleUpdateRequest(selectedEditIndex, "labourPrice", e.target.value)} className="app-input" /></div>
                <div style={requestDetailsFieldStyle}><label style={requestDetailsLabelStyle}>Menu Price</label><input type="number" min="0" step="0.01" value={requests[selectedEditIndex].menuPrice || ""} onChange={(e) => handleUpdateRequest(selectedEditIndex, "menuPrice", e.target.value)} className="app-input" /></div>
                <div style={requestDetailsFieldStyle}><label style={requestDetailsLabelStyle}>Set Price</label><input type="number" min="0" step="0.01" value={requests[selectedEditIndex].setPrice ?? requests[selectedEditIndex].price ?? ""} onChange={(e) => handleUpdateRequest(selectedEditIndex, "setPrice", e.target.value)} className="app-input" /></div>
                <div style={requestDetailsFieldStyle}><label style={requestDetailsLabelStyle}>Discount</label><input type="number" min="0" step="0.01" value={requests[selectedEditIndex].discount || ""} onChange={(e) => handleUpdateRequest(selectedEditIndex, "discount", e.target.value)} className="app-input" /></div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "44px", color: "var(--text-1)", fontWeight: 700 }}>
                <input type="checkbox" checked={Boolean(requests[selectedEditIndex].specialRate)} onChange={(e) => handleUpdateRequest(selectedEditIndex, "specialRate", e.target.checked)} />
                Special labour rate
              </label>
              <div style={requestDetailsFieldStyle}>
                <label style={requestDetailsLabelStyle}>Internal Notes</label>
                <textarea value={requests[selectedEditIndex].noteText || ""} onChange={(e) => handleUpdateRequest(selectedEditIndex, "noteText", e.target.value)} className="app-input app-input--textarea" />
              </div>
              <div>
                <button type="button" className="app-btn app-btn--danger" onClick={() => { handleRemoveRequest(selectedEditIndex); setSelectedEditIndex(0); }}>Remove Request</button>
              </div>
            </> :
            <p style={{ color: "var(--grey-accent)", fontStyle: "italic", margin: 0 }}>Select a request to edit, or add a new one.</p>}
          </div>
        </div> :

        (combinedRequestRows.length > 0 ?
        <div className="jc-req-split">
          <DevLayoutSection
            sectionKey={`job-cards-${jobData?.jobNumber || "unknown"}-customer-requests-table`}
            sectionType="data-table"
            parentKey="jobcard-tab-customer-requests"
            className="jc-req-table-wrap"
            disableFallback>
            <table className="app-data-table app-data-table--rounded">
              <thead>
                <tr>
                  <th style={{ width: "44px" }}>#</th>
                  <th>Request</th>
                  <th style={{ width: "130px" }}>Billed To</th>
                  <th style={{ width: "80px" }}>Hours</th>
                  <th style={{ width: "140px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {combinedRequestRows.map((row) => {
                  const isSel = selectedRow && selectedRow.key === row.key;
                  return (
                    <tr key={row.key} className="jc-req-row" style={{ cursor: "pointer", ...(isSel ? { backgroundColor: "var(--secondary-pressed)" } : null) }} onClick={() => setSelectedRequestKey(row.key)}>
                      <td style={{ fontWeight: 600 }}>{row.numberLabel}</td>
                      <td className="jc-req-desc-cell" style={{ color: "var(--text-1)" }}><div className="jc-req-desc-clip">{row.description || "—"}</div></td>
                      <td>{row.jobType ? <span className="app-badge" style={getPaymentTypePillStyle(row.jobType)}>{row.jobType}</span> : "—"}</td>
                      <td>{formatHoursDisplay(row.hours)}</td>
                      {/* Authorised (additional work) rows display only "Authorised"
                          in this section — not the derived workflow status. Declined/
                          reported VHC items never reach here (see authorisedRows). */}
                      <td>{row.kind === "authorised"
                        ? <span className="app-badge app-badge--success">Authorised</span>
                        : <span className="app-badge" style={row.statusBadgeStyle}>{row.statusLabel}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DevLayoutSection>

          {/* RIGHT: selected request detail */}
          <div style={detailPanelStyle}>
            {selectedRow ?
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "18px", color: "var(--text-1)" }}>{selectedRow.title}</h3>
                {/* Authorised (additional work) rows show only the 44px-high
                    "Authorised" status chip — never the small workflow status
                    pill. Customer-request rows keep their normal status pill. */}
                {selectedRow.kind === "authorised"
                  ? <span className="app-badge app-badge--uppercase app-badge--success">Authorised</span>
                  : <span className="app-badge" style={selectedRow.statusBadgeStyle}>{selectedRow.statusLabel}</span>}
              </div>

              {/* Meta line */}
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "13px", color: "var(--text-1)" }}>
                <span><strong>Hours:</strong> {formatHoursDisplay(selectedRow.hours)}</span>
                <span><strong>Pre-pick:</strong> {selectedRow.prePick ? formatPrePickLabel(selectedRow.prePick) : "Not set"}</span>
                {selectedRow.jobType && <span><strong>Billed to:</strong> {selectedRow.jobType}</span>}
              </div>

              {/* Description */}
              <div style={detailCardStyle}>
                <div style={detailCardLabelStyle}>Description</div>
                <div style={{ fontSize: "14px", color: "var(--text-1)" }}>{selectedRow.description || "—"}{selectedRow.detailLine ? ` — ${selectedRow.detailLine}` : ""}</div>
              </div>

              {/* Internal notes */}
              <div style={detailCardStyle}>
                <div style={detailCardLabelStyle}>Internal Notes</div>
                {selectedRow.noteText || selectedRow.linkedNoteTexts.length > 0 ?
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {selectedRow.noteText && <div style={{ fontSize: "13px", color: "var(--text-1)" }}>{selectedRow.noteText}</div>}
                  {selectedRow.linkedNoteTexts.map((t, i) => <div key={i} style={{ fontSize: "13px", color: "var(--text-1)" }}>{t}</div>)}
                </div> :
                <div style={{ fontSize: "13px", color: "var(--grey-accent)", fontStyle: "italic" }}>No notes added.</div>}
              </div>

              {/* Linked parts */}
              <div style={detailCardStyle}>
                <div style={detailCardLabelStyle}>Linked Parts</div>
                {selectedRow.linkedParts.length > 0 ?
                <div className="app-table-shell-scroll">
                  <table className="app-data-table app-data-table--rounded app-table-shell app-table-shell--with-headings">
                    <thead>
                      <tr>
                        <th>Part No</th>
                        <th>Description</th>
                        <th style={{ textAlign: "right" }}>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRow.linkedParts.map((item, i) =>
                      <tr key={item.id || i}>
                        <td>{item.part?.partNumber || item.parts_catalog?.part_number || item.part_number_snapshot || item.part_number || "—"}</td>
                        <td>{item.part?.name || item.part?.description || item.parts_catalog?.name || item.parts_catalog?.description || item.part_name_snapshot || item.row_description || "—"}</td>
                        <td style={{ textAlign: "right" }}>{item.quantityAllocated ?? item.quantity_allocated ?? item.quantityRequested ?? item.quantity_requested ?? 0}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </div> :
                <div style={{ fontSize: "13px", color: "var(--grey-accent)", fontStyle: "italic" }}>No linked parts.</div>}
              </div>

              {/* Total clocked time */}
              <div style={detailCardStyle}>
                <div style={detailCardLabelStyle}>Time Clocked</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-1)" }}>{formatHoursDisplay(selectedRow.clockedHours)}</div>
                <div style={{ fontSize: "12px", color: "var(--grey-accent)" }}>of {formatHoursDisplay(selectedRow.hours)} assigned</div>
              </div>
            </> :
            <p style={{ color: "var(--grey-accent)", fontStyle: "italic", margin: 0 }}>Select a request to view details.</p>}
          </div>
        </div> :
        <p style={{ color: "var(--surfaceTextMuted)", fontStyle: "italic" }}>No requests logged.</p>)
        }

        <style jsx global>{`
          html.staff-scope .jc-req-statgrid {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 10px;
          }
          html.staff-scope .jc-req-statgrid.jc-request-overview-statgrid {
            /* Equal-width tiles that fill the available width and reflow with the
               screen: as many >=130px columns as fit, each sharing the leftover
               space (1fr), wrapping to new rows when they no longer fit. Grid
               stretch keeps every tile in a row the same height. */
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            grid-auto-flow: row;
            gap: 8px;
            overflow-x: visible;
            padding-bottom: 0;
          }
          html.staff-scope .jc-customer-requests .jc-req-split {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 16px;
            align-items: start;
          }
          html.staff-scope .jc-req-table-wrap {
            min-width: 0;
            overflow-x: auto;
          }
          /* Keep the requests table inside its card: fixed layout means the
             explicit per-column widths are honoured and the unsized "Request"
             column absorbs the remaining width and wraps, instead of the table
             growing wider than the card. */
          html.staff-scope .jc-req-table-wrap table.app-data-table {
            width: 100%;
            table-layout: fixed;
          }
          /* Long request/description text wraps but is capped at exactly two
             lines; past two lines the cell scrolls internally so the row height
             never changes. Two full lines stay visible before the scroll. */
          html.staff-scope .jc-req-desc-cell {
            white-space: normal;
            vertical-align: top;
          }
          html.staff-scope .jc-req-desc-clip {
            line-height: 1.4;
            max-height: 2.8em; /* 2 lines × 1.4 line-height — both lines fully shown */
            overflow-y: auto;
            overflow-x: hidden;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          html.staff-scope .jc-req-row {
            transition: background-color 0.15s ease;
          }
          html.staff-scope .jc-req-row:hover {
            background-color: var(--secondary-pressed);
          }
          @media (max-width: 1280px) {
            html.staff-scope .jc-req-split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
          }
          @media (max-width: 1100px) {
            html.staff-scope .jc-req-statgrid:not(.jc-request-overview-statgrid) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          }
          @media (max-width: 900px) {
            html.staff-scope .jc-customer-requests .jc-req-split { grid-template-columns: minmax(0, 1fr); }
          }
          @media (max-width: 560px) {
            html.staff-scope .jc-req-statgrid:not(.jc-request-overview-statgrid) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }
        `}</style>
      </div>

      {/* Cosmetic damage belongs only to the first/customer-requests tab. */}
      <div style={{ marginTop: "0", paddingTop: "0", borderTop: "none" }}>
        {jobData.cosmeticNotes &&
        <div style={{ marginBottom: "16px" }}>
            <strong style={{ fontSize: "14px", color: "var(--grey-accent)", display: "block", marginBottom: "8px" }}>
              Cosmetic Damage Notes:
            </strong>
            <div style={{
            padding: "12px",
            backgroundColor: "var(--warning-surface)",
            borderRadius: "var(--control-radius)"
          }}>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--text-1)" }}>
                {jobData.cosmeticNotes}
              </p>
            </div>
          </div>
        }
      </div>
    </div>);

}

export default CustomerRequestsTab;
