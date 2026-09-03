// file location: src/pages/job-cards/[jobNumber].js
// Imports converted to use absolute alias "@/"
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import { usePolling } from "@/hooks/usePolling"; // shared visibility-gated poller
import dynamic from "next/dynamic";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { useConfirmation } from "@/context/ConfirmationContext";
// Loaded on demand - 213 KB of @supabase/supabase-js.
//
// This is the heaviest route in the app. Every use of the client here runs
// after mount: 29 queries inside async handlers and effects, and one realtime
// channel that mirrors staff edits into the open job card. None of it is
// needed to render, so none of it belongs in the first load.
import { loadSupabaseClient, subscribeWithDeferredClient } from "@/lib/database/realtimeClient";
import { buildCustomerReportUrl } from "@/lib/vhc/shareCode";
// Loaded on demand - each resolves the Supabase browser client. Every function
// they export is called from a save, clock or tab-open handler on this page,
// never during render.
const loadJobsDb = () => import("@/lib/database/jobs");
const loadJobStatusService = () => import("@/lib/services/jobStatusService");
const loadCustomersDb = () => import("@/lib/database/customers");
const loadJobClockingDb = () => import("@/lib/database/jobClocking");
import { logJobActivityClient } from "@/lib/jobs/logActivityClient";
const loadNotesDb = () => import("@/lib/database/notes"); // deferred - notes tab only
import { createCustomerDisplaySlug } from "@/lib/customers/slug";
// Redesigned Service History tab (summary / tree / detail / mileage trend).
// Replaces the legacy inline ServiceHistoryTab that lived in this file.
// Non-default tab bodies, code-split.
//
// The job card opens on "customer-requests". Everything below belongs to a tab
// or popup the user has to choose before it can render, yet all of it was in the
// route's first-load bundle: 476 KB of source across Parts, Invoice, Notes,
// Service history, Contact, the documents upload popup and the clocking history
// section. That is paid on every job card opened, by every user, whether or not
// they ever leave the first tab — and this page is opened dozens of times a day.
//
// ssr:false matches the tabs that were already dynamic here (VHC panel, write-up
// form, photo/video editors): these are client-only, and the page itself is
// behind auth and renders from client-side data.
//
// Each keeps a skeleton of roughly the right height so opening a tab for the
// first time shows the same shaped placeholder the rest of the app uses, not a
// collapse-and-jump. After the first open the chunk is cached for the session.
const tabChunkLoading = () => (
  <>
    <SkeletonKeyframes />
    <SkeletonBlock height="320px" />
  </>
);

const ServiceHistoryTab = dynamic(() => import("@/components/page-ui/job-cards/ServiceHistoryTab"), {
  ssr: false,
  loading: tabChunkLoading,
});
import {
  normalizeRequests,
  mapCustomerJobsToHistory } from
"@/lib/jobCards/utils";
import {
  getJobRequests,
  getVehicleRegistration,
  pickMileageValue as canonicalPickMileageValue } from
"@/lib/canonical/fields";
import { summarizePartsPipeline } from "@/lib/parts/pipeline";
import { STATUSES as JOB_STATUSES } from "@/lib/status/catalog/job";
import { resolveMainStatusId } from "@/lib/status/statusFlow";
// VhcDetailsPanel is the largest component in the app (~511KB of source, plus
// the fault taxonomy it pulls in). Loading it through next/dynamic moves it out
// of the job card's first-load bundle; the VHC tab is gated behind the
// vhcTabMounted latch (activation or idle), so it is requested off the critical
// path rather than during hydration. ssr:false because the panel is client-only
// (it opens realtime channels and reads the DOM on mount).
const VhcDetailsPanel = dynamic(() => import("@/components/VHC/VhcDetailsPanel"), {
  ssr: false,
  loading: () => (
    <>
      <SkeletonKeyframes />
      <SkeletonBlock height="320px" />
    </>
  ),
});
const InvoiceSection = dynamic(() => import("@/components/Invoices/InvoiceSection"), {
  ssr: false,
  loading: tabChunkLoading,
});
import { calculateVhcFinancialTotals } from "@/lib/vhc/calculateVhcTotals";
// Phase 1 of the VHC refactor: route all VHC status reads through the canonical
// engine. normaliseDecisionStatus is re-exported from the engine (legacy-permissive
// wrapper) so behaviour is unchanged.
import {
  projectVhcItem,
  getDisplayStatus,
  resolveVhcItemState,
  normaliseDecisionStatus } from
"@/features/vhc/vhcStatusEngine";
import { isValidUuid, sanitizeNumericId } from "@/lib/utils/ids";
import { fetchApprovedStaffAbsences } from "@/lib/hr/staffAbsences";
const PartsTabNew = dynamic(() => import("@/components/PartsTab"), {
  ssr: false,
  loading: tabChunkLoading,
});
const NotesTabNew = dynamic(() => import("@/components/NotesTab"), {
  ssr: false,
  loading: tabChunkLoading,
});
const DocumentsUploadPopup = dynamic(() => import("@/components/popups/DocumentsUploadPopup"), { ssr: false });
// Media editors: heavy, and only ever used after a user picks a document to
// edit. They were mounted unconditionally with `isOpen={false}` (VHCModalShell
// returns null when closed), so they shipped and mounted on every job card.
// Loaded dynamically and rendered only while actually open — VHCModalShell
// already rendered nothing in the closed state, so this is behaviour-neutral.
const PhotoEditorModal = dynamic(() => import("@/components/VHC/PhotoEditorModal"), { ssr: false });
const VideoEditorModal = dynamic(() => import("@/components/VHC/VideoEditorModal"), { ssr: false });
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { JobCardPageShellSkeleton } from "@/components/ui/JobCardShellSkeleton";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { CalendarField } from "@/components/ui/calendarAPI";
import { TimePickerField } from "@/components/ui/timePickerAPI";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import PopupModal from "@/components/popups/popupStyleApi";
// Scheduling dashboard sections (Scheduling tab redesign) — one file per tab (CLAUDE.md §4.3).
import {
  TechnicianAssignmentSection,
  JobProgressSection,
  CustomerUpdatesSection,
} from "@/components/page-ui/job-cards/SchedulingTab";
const ClockingHistorySection = dynamic(() => import("@/components/JobCards/ClockingHistorySection"), {
  ssr: false,
  loading: tabChunkLoading,
});
import RequestPresetAutosuggestInput from "@/components/JobCards/RequestPresetAutosuggestInput";
import {
  ensureJobCustomerThread,
  fetchThreadMessages,
  sendThreadMessage,
} from "@/lib/api/messages";
import { buildApiUrl } from "@/utils/apiClient";
import { popupCardStyles, popupOverlayStyles } from "@/styles/appTheme";
import { isDiagnosticRequestText } from "@/lib/jobRequestPresets/constants";
import {
  collectLinkedPartRows,
  normalizePrePickLocation,
  resolveLinkedPrePickLocation } from
"@/lib/prePickLocations";
import { revalidateJob, revalidateAllJobs } from "@/lib/swr/mutations"; // SWR cache invalidation after mutations
import { useJob, buildJobCardKey } from "@/hooks/useJob"; // SWR-powered job card data with caching and revalidation
import {
  WORKSHOP_APPOINTMENT_TIME_OPTIONS,
  toAppointmentTimestamp,
} from "@/lib/appointments/dateTime";
import { resolveJobCardPermissions } from "@/features/jobCards/workflow/permissions";
import {
  getClockingAwareJobStatus,
  getCustomerRequestEffectiveStatus,
  getCustomerRequestWorkflowStatus,
  getWriteUpChecklistTasks,
  getWriteUpCompletionState,
  getInvoiceWorkflowState,
  isCustomerRequestCompleteInWriteUp,
} from "@/features/jobCards/workflow/selectors";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";

// Dynamic import loading state renders a structured skeleton that mirrors the
// real WriteUpForm shape (tab bar + content grid) so switching tabs never
// flashes a plain text loader.
import JobCardDetailPageUi from "@/components/page-ui/job-cards/job-cards-job-number-ui"; // Extracted presentation layer.
// Contact tab — one file per tab (CLAUDE.md §4.3), code-split with the others.
const ContactTab = dynamic(() => import("@/components/page-ui/job-cards/ContactTab"), {
  ssr: false,
  loading: tabChunkLoading,
});
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)

// Shared job-card building blocks. These used to be declared in this file; they
// were moved into their own modules so /tech/[jobNumber] can reuse them without
// statically importing this page (see docs/perf/tech-job-card-extraction.md).
import CustomerRequestsTab from "@/components/JobCards/CustomerRequestsTab";
import WriteUpWorkspace from "@/components/JobCards/WriteUpWorkspace";
import LocationUpdateModal from "@/components/JobCards/LocationUpdateModal";
import { resolveVhcSeverity } from "@/lib/jobCards/vhcSeverity";
import {
  normalizeStatusId,
  normalizeWriteUpCompletionStatus,
  isRemovedPartsRow,
  isBookedPartsRow,
  isPartsRowAllocated,
} from "@/lib/jobCards/requestHelpers";
import {
  CAR_LOCATIONS,
  KEY_LOCATIONS,
  CAR_LOCATION_OPTIONS,
  KEY_LOCATION_OPTIONS,
  normalizeKeyLocationLabel,
  ensureDropdownOption,
  emptyTrackingForm,
} from "@/lib/jobCards/locations";
import { logFailure } from "@/lib/utils/logFailure";

const WriteUpForm = dynamic(() => import("@/components/JobCards/WriteUpForm"), { ssr: false,
  loading: () => {
    return (
      <div
        style={{
          padding: "12px 0",
          display: "flex",
          flexDirection: "column",
          gap: 14
        }}>

        <SkeletonKeyframes />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Array.from({ length: 5 }).map((_, i) =>
          <SkeletonBlock key={i} width="90px" height="32px" borderRadius="999px" />
          )}
        </div>
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
          }}>

          {Array.from({ length: 4 }).map((_, i) =>
          <LayerSurface
            key={i}
            radius="var(--radius-md)"
            padding={16}
            gap={10}>

              <SkeletonBlock width="50%" height="12px" />
              <SkeletonBlock width="90%" height="14px" />
              <SkeletonBlock width="70%" height="14px" />
            </LayerSurface>
          )}
        </div>
      </div>);

  }
});

const sanitizeFileName = (value = "") => {
  const trimmed = value || "";
  const safe = trimmed.replace(/[^a-z0-9._-]/gi, "_");
  return safe || `document-${Date.now()}`;
};

const mapJobFileRecord = (record = {}) => ({
  id: record.file_id ?? record.id ?? null,
  name: record.file_name || record.name || "Document",
  url: record.file_url || record.url || "",
  type: record.file_type || record.type || "",
  folder: (record.folder || "general").toLowerCase(),
  uploadedBy: record.uploaded_by || record.uploadedBy || null,
  uploadedAt: record.uploaded_at || record.uploadedAt || null
});

const deriveStoragePathFromUrl = (url = "") => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = "/job-documents/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx >= 0) {
      return decodeURIComponent(parsed.pathname.substring(idx + marker.length));
    }
    const storageIdx = parsed.pathname.indexOf("/storage/v1/object/public/");
    if (storageIdx >= 0) {
      const segment = parsed.pathname.substring(storageIdx + "/storage/v1/object/public/".length);
      if (segment.startsWith("job-documents/")) {
        return decodeURIComponent(segment.substring("job-documents/".length));
      }
    }
  } catch (_err) {


    // fallback to string parsing
  }const fallbackMarker = "/job-documents/";const fallbackIdx = url.indexOf(fallbackMarker);
  if (fallbackIdx >= 0) {
    return decodeURIComponent(url.substring(fallbackIdx + fallbackMarker.length));
  }
  return null;
};

const JOB_DOCUMENT_BUCKET = "job-documents";

const parseRequestIdentityFromTask = (task = {}) => {
  const explicitRequestIdRaw = task?.requestId ?? task?.request_id ?? null;
  const explicitRequestId = Number(explicitRequestIdRaw);
  if (Number.isInteger(explicitRequestId) && explicitRequestId > 0) {
    return { requestId: explicitRequestId, sortOrder: null };
  }

  const explicitSortOrderRaw = task?.sortOrder ?? task?.sort_order ?? null;
  const explicitSortOrder = Number(explicitSortOrderRaw);
  if (Number.isInteger(explicitSortOrder) && explicitSortOrder > 0) {
    return { requestId: null, sortOrder: explicitSortOrder };
  }

  const sourceKey = String(task?.sourceKey || "").trim();
  if (!sourceKey) return { requestId: null, sortOrder: null };

  const requestIdMatch = sourceKey.match(/^reqid[-_:]?(\d+)$/i);
  if (requestIdMatch?.[1]) {
    return { requestId: Number(requestIdMatch[1]), sortOrder: null };
  }

  const sortOrderDirectMatch = sourceKey.match(/^req[-_:]?(\d+)$/i);
  if (sortOrderDirectMatch?.[1]) {
    return { requestId: null, sortOrder: Number(sortOrderDirectMatch[1]) };
  }

  const requestSuffixMatch = sourceKey.match(/(?:^|[-_:])request[-_:]?(\d+)$/i);
  if (requestSuffixMatch?.[1]) {
    return { requestId: null, sortOrder: Number(requestSuffixMatch[1]) };
  }

  const numericTailMatch = sourceKey.match(/(\d+)$/);
  if (numericTailMatch?.[1]) {
    return { requestId: null, sortOrder: Number(numericTailMatch[1]) };
  }

  return { requestId: null, sortOrder: null };
};

const normalizeRequestProgressStatus = (value = "") => {
  const normalized = String(value || "").
  trim().
  toLowerCase();
  return normalized === "complete" || normalized === "completed" || normalized === "done" ?
  "complete" :
  "inprogress";
};

const isTaskSnapshotChecked = (task = {}) => {
  if (typeof task?.checked === "boolean") return task.checked;
  const normalized = String(task?.status || "").
  trim().
  toLowerCase();
  return normalized === "complete" || normalized === "completed" || normalized === "done";
};

const extractWriteUpChecklistTasks = (rawChecklist) => {
  if (Array.isArray(rawChecklist)) return rawChecklist;
  if (rawChecklist && typeof rawChecklist === "object") {
    return Array.isArray(rawChecklist.tasks) ? rawChecklist.tasks : [];
  }
  if (typeof rawChecklist === "string") {
    try {
      const parsed = JSON.parse(rawChecklist);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") {
        return Array.isArray(parsed.tasks) ? parsed.tasks : [];
      }
    } catch (_error) {
      return [];
    }
  }
  return [];
};

const buildRequestStatusLookupFromTasks = (tasks = []) => {
  const byId = {};
  const bySortOrder = {};
  (Array.isArray(tasks) ? tasks : []).
  filter((task) => task?.source === "request").
  forEach((task) => {
    const ref = parseRequestIdentityFromTask(task);
    const status = isTaskSnapshotChecked(task) ? "complete" : "inprogress";
    if (ref.requestId) {
      byId[String(ref.requestId)] = status;
    } else if (ref.sortOrder) {
      bySortOrder[String(ref.sortOrder)] = status;
    }
  });
  return { byId, bySortOrder };
};

const buildRequestStatusLookupFromRows = (rows = []) => {
  const byId = {};
  const bySortOrder = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const status = normalizeRequestProgressStatus(row?.status);
    const requestId = Number(row?.requestId ?? row?.request_id ?? null);
    const sortOrder = Number(row?.sortOrder ?? row?.sort_order ?? null);
    if (Number.isInteger(requestId) && requestId > 0) {
      byId[String(requestId)] = status;
      return;
    }
    if (Number.isInteger(sortOrder) && sortOrder > 0) {
      bySortOrder[String(sortOrder)] = status;
    }
  });
  return { byId, bySortOrder };
};

const mergeRequestStatusLookup = (baseLookup = {}, incomingLookup = {}) => ({
  byId: {
    ...(baseLookup?.byId || {}),
    ...(incomingLookup?.byId || {})
  },
  bySortOrder: {
    ...(baseLookup?.bySortOrder || {}),
    ...(incomingLookup?.bySortOrder || {})
  }
});

const applyRequestLookupToRows = (rows = [], lookup = {}) =>
(Array.isArray(rows) ? rows : []).map((row) => {
  const requestId = row?.requestId ?? row?.request_id ?? null;
  const sortOrder = row?.sortOrder ?? row?.sort_order ?? null;
  const nextStatus =
  (requestId !== null && requestId !== undefined ?
  lookup?.byId?.[String(requestId)] :
  null) || (
  sortOrder !== null && sortOrder !== undefined ?
  lookup?.bySortOrder?.[String(sortOrder)] :
  null);
  if (!nextStatus) return row;
  return {
    ...row,
    status: nextStatus
  };
});

const mergeChecklistTasks = (rawChecklist, tasks = []) => {
  if (rawChecklist && typeof rawChecklist === "object" && !Array.isArray(rawChecklist)) {
    return {
      ...rawChecklist,
      tasks
    };
  }
  if (Array.isArray(rawChecklist)) {
    return {
      version: 2,
      tasks
    };
  }
  if (typeof rawChecklist === "string") {
    try {
      const parsed = JSON.parse(rawChecklist);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return {
          ...parsed,
          tasks
        };
      }
    } catch (_error) {
      return { version: 2, tasks };
    }
  }
  return { version: 2, tasks };
};

const applyWriteUpOptimisticOverlay = (jobCard, overlay) => {
  if (!jobCard || !overlay) return jobCard;

  const hasCompletion = typeof overlay.completionStatus === "string";
  const tasks = Array.isArray(overlay.tasks) ? overlay.tasks : null;
  const lookup = overlay.requestStatusLookup || { byId: {}, bySortOrder: {} };
  const hasRequestLookup =
  Object.keys(lookup.byId || {}).length > 0 || Object.keys(lookup.bySortOrder || {}).length > 0;
  if (!hasCompletion && !tasks && !hasRequestLookup) {
    return jobCard;
  }

  const nextWriteUp = {
    ...(jobCard.writeUp || {}),
    ...(hasCompletion ? { completion_status: normalizeWriteUpCompletionStatus(overlay.completionStatus) } : {}),
    ...(tasks ? { task_checklist: mergeChecklistTasks(jobCard.writeUp?.task_checklist, tasks) } : {})
  };

  return {
    ...jobCard,
    ...(hasCompletion ? { completionStatus: normalizeWriteUpCompletionStatus(overlay.completionStatus) } : {}),
    writeUp: nextWriteUp,
    ...(hasRequestLookup ?
    {
      jobRequests: applyRequestLookupToRows(jobCard.jobRequests, lookup),
      job_requests: applyRequestLookupToRows(jobCard.job_requests, lookup)
    } :
    {})
  };
};

const isWriteUpOverlayAcknowledgedByServer = (jobCard, overlay) => {
  if (!overlay) return true;
  if (!jobCard) return false;

  if (typeof overlay.completionStatus === "string") {
    const serverCompletion = normalizeWriteUpCompletionStatus(
      jobCard.writeUp?.completion_status || jobCard.completionStatus || ""
    );
    const optimisticCompletion = normalizeWriteUpCompletionStatus(overlay.completionStatus);
    if (serverCompletion !== optimisticCompletion) return false;
  }

  const lookup = overlay.requestStatusLookup || { byId: {}, bySortOrder: {} };
  const byIdEntries = Object.entries(lookup.byId || {});
  const bySortEntries = Object.entries(lookup.bySortOrder || {});
  if (byIdEntries.length > 0 || bySortEntries.length > 0) {
    const allRequests = Array.isArray(jobCard.jobRequests) ?
    jobCard.jobRequests :
    Array.isArray(jobCard.job_requests) ?
    jobCard.job_requests :
    [];
    const requestIndex = new Map();
    const sortIndex = new Map();
    allRequests.forEach((row) => {
      const requestId = Number(row?.requestId ?? row?.request_id ?? null);
      const sortOrder = Number(row?.sortOrder ?? row?.sort_order ?? null);
      const status = normalizeRequestProgressStatus(row?.status);
      if (Number.isInteger(requestId) && requestId > 0) requestIndex.set(String(requestId), status);
      if (Number.isInteger(sortOrder) && sortOrder > 0) sortIndex.set(String(sortOrder), status);
    });
    for (const [key, status] of byIdEntries) {
      if (requestIndex.get(String(key)) !== normalizeRequestProgressStatus(status)) return false;
    }
    for (const [key, status] of bySortEntries) {
      if (sortIndex.get(String(key)) !== normalizeRequestProgressStatus(status)) return false;
    }
  }

  if (Array.isArray(overlay.tasks) && overlay.tasks.length > 0) {
    const serverTasks = extractWriteUpChecklistTasks(jobCard.writeUp?.task_checklist);
    if (!Array.isArray(serverTasks) || serverTasks.length === 0) return false;

    const serverMap = new Map(
      serverTasks.map((task) => [
      `${task?.source || "request"}:${task?.sourceKey || ""}`,
      isTaskSnapshotChecked(task)]
      )
    );
    for (const task of overlay.tasks) {
      const key = `${task?.source || "request"}:${task?.sourceKey || ""}`;
      if (!serverMap.has(key)) return false;
      if (serverMap.get(key) !== isTaskSnapshotChecked(task)) return false;
    }
  }

  return true;
};

const isStatusReadyForInvoicing = (status, statusId) => {
  if (statusId) return statusId === JOB_STATUSES.IN_PROGRESS;
  return normalizeStatusId(status) === JOB_STATUSES.IN_PROGRESS;
};

/** @deprecated Use canonicalPickMileageValue from @/lib/canonical/fields */
const pickMileageValue = canonicalPickMileageValue;

const isRemovedAllocation = (item = {}) => normalizeStatusId(item?.status) === "removed";

const arePartsPricedAndAssigned = (allocations = []) => {
  const parts = Array.isArray(allocations) ? allocations : [];
  const active = parts.filter((item) => item && !isRemovedAllocation(item)); // Skip removed parts
  if (active.length === 0) {
    return true;
  }

  return active.every((item) => {
    const requestedQty = Number(item.quantityRequested ?? 0);
    const allocatedQty = Number(item.quantityAllocated ?? 0);
    const hasAllocated =
    requestedQty > 0 ? allocatedQty >= requestedQty : allocatedQty > 0;
    const unitPrice =
    Number(item.unitPrice ?? 0) || Number(item.part?.unitPrice ?? 0);
    return hasAllocated && unitPrice > 0;
  });
};

const getPartsValidationIssues = (allocations = []) => {
  const parts = Array.isArray(allocations) ? allocations : [];
  const issues = [];
  parts.forEach((item) => {
    if (!item || isRemovedAllocation(item)) return; // Skip removed parts
    const requestedQty = Number(item.quantityRequested ?? 0);
    const allocatedQty = Number(item.quantityAllocated ?? 0);
    const hasAllocated =
    requestedQty > 0 ? allocatedQty >= requestedQty : allocatedQty > 0;
    const unitPrice =
    Number(item.unitPrice ?? 0) || Number(item.part?.unitPrice ?? 0);
    const partLabel = item.part?.partNumber || item.partNumber || `Part #${item.partId || "unknown"}`;
    if (!hasAllocated && unitPrice <= 0) {
      issues.push(`${partLabel}: missing quantity and pricing`);
    } else if (!hasAllocated) {
      issues.push(`${partLabel}: allocated qty (${allocatedQty}) is less than requested (${requestedQty})`);
    } else if (unitPrice <= 0) {
      issues.push(`${partLabel}: no unit price set`);
    }
  });
  return issues;
};

const areAllPartsAllocated = (allocations = []) => {
  const parts = Array.isArray(allocations) ? allocations : [];
  const active = parts.filter((item) => item && !isRemovedAllocation(item)); // Skip removed parts
  if (active.length === 0) {
    return true;
  }

  return active.every((item) => {
    const assignedToRequest = item.allocatedToRequestId ?? item.allocated_to_request_id ?? null;
    const assignedToVhc = item.vhcItemId ?? item.vhc_item_id ?? null;
    return Boolean(assignedToRequest) || Boolean(assignedToVhc); // VHC-allocated parts count as allocated
  });
};

const buildDateTimeFromInputs = (dateValue = "", timeValue = "") => {
  if (!dateValue || !timeValue) return null;
  const [year, month, day] = dateValue.split("-").map((segment) => parseInt(segment, 10));
  const [hours, minutes] = timeValue.split(":").map((segment) => parseInt(segment, 10));
  if (
  [year, month, day, hours, minutes].some(
    (part) => Number.isNaN(part) || part === null || part === undefined
  ))
  {
    return null;
  }
  const date = new Date();
  date.setFullYear(year, month - 1, day);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const formatBookingDescriptionInput = (value = "") => {
  const normalized = String(value || "").replace(/\r/g, "");
  if (!normalized.trim()) {
    return "";
  }

  return normalized.
  split("\n").
  map((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return "- ";
    }
    const withoutPrefix = trimmed.startsWith("- ") ?
    trimmed.slice(2).trimStart() :
    trimmed.replace(/^-+\s*/, "").trimStart();
    return `- ${withoutPrefix}`;
  }).
  join("\n");
};

export default function JobCardDetailPage({ forcedJobNumber = null, valetMode = false } = {}) {
  const router = useRouter();
  const routeJobNumber = forcedJobNumber ?? router.query.jobNumber ?? router.query.jobnumber ?? null;
  const jobNumber = Array.isArray(routeJobNumber) ? routeJobNumber[0] : routeJobNumber;
  const { user, dbUserId } = useUser();
  const { confirm } = useConfirmation();
  const isValetMode = Boolean(valetMode || router.query.valet === "1");

  const actingUserId = useMemo(() => {
    if (typeof user?.authUuid === "string" && isValidUuid(user.authUuid)) {
      return user.authUuid;
    }
    if (typeof user?.id === "string" && isValidUuid(user.id)) {
      return user.id;
    }
    return null;
  }, [user?.authUuid, user?.id]);

  const actingUserNumericId = useMemo(() => sanitizeNumericId(dbUserId), [dbUserId]);

  const isArchiveMode = router.query.archive === "1"; // moved up so useJob can reference it

  // SWR-powered initial data — provides cached data instantly on revisit or prefetch
  // revalidateOnMount: false — fetchJobData() below is the authoritative loader
  // for this page and seeds this cache via mutateSwrJob(). Without this the hook
  // fired its own /api/jobcards/[jobNumber] request alongside that one on every
  // cold visit, and the whole dependent chain doubled with it. The cache read is
  // unchanged, so a prefetch-on-hover or a previous visit still paints instantly.
  const { jobResponse: swrJobResponse, mutate: mutateSwrJob } = useJob(jobNumber, {
    archive: isArchiveMode,
    revalidateOnMount: false,
  });

  // State Management
  const [jobData, setJobData] = useState(null);
  // Per-request clocking entries (job_clocking rows with request_id + hoursWorked).
  // Loaded for the Customer Requests tab so each request can show its total
  // clocked time. Refreshed whenever the job id changes or a status update lands.
  const [clockingEntries, setClockingEntries] = useState([]);
  const [statusSnapshot, setStatusSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("customer-requests");
  const [logisticsWaitingStatusOverride, setLogisticsWaitingStatusOverride] = useState(null);
  const [writeUpTabMounted, setWriteUpTabMounted] = useState(false);
  // Same deferred-mount latch as writeUpTabMounted below. The VHC tab pulls in
  // VhcDetailsPanel (the single largest component in the app) plus the fault
  // taxonomy, ~892KB of the job card's first-load JS. Mounting it on activation
  // or on idle — instead of during the initial render of every job card — keeps
  // that off the hydration critical path. The tab still ends up mounted on every
  // job card, so nothing downstream changes; the card's authorised/declined
  // totals already have an explicit "without loading VHC tab" fallback computed
  // from jobData.vhcChecks (see vhcFinancialTotals).
  const [vhcTabMounted, setVhcTabMounted] = useState(false);
  const tabsScrollRef = useRef(null);
  const tabsDragScrollRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });
  const prefetchedJobTabsRef = useRef(new Set());
  const [tabsOverflowing, setTabsOverflowing] = useState(false);
  const [sharedNote, setSharedNote] = useState("");
  const [sharedNoteMeta, setSharedNoteMeta] = useState(null);
  const [sharedNoteSaving, setSharedNoteSaving] = useState(false);
  const [jobNotes, setJobNotes] = useState([]);
  const [pendingNewNoteIds, setPendingNewNoteIds] = useState([]);
  const [highlightedNoteIds, setHighlightedNoteIds] = useState([]);
  const sharedNoteSaveRef = useRef(null);
  const mileageAutoSaveRef = useRef(null);
  const mileageInputDirtyRef = useRef(false);
  const notesHighlightTimeoutRef = useRef(null);
  const jobRealtimeRefreshRef = useRef(null);
  const lastRealtimeFetchAtRef = useRef(0);
  const lastJobFetchAtRef = useRef(0);
  const jobFetchInFlightRef = useRef(false);
  const writeUpOptimisticSyncRef = useRef(null);
  const [vehicleJobHistory, setVehicleJobHistory] = useState([]);
  const [customerVehicles, setCustomerVehicles] = useState([]);
  const [customerVehiclesLoading, setCustomerVehiclesLoading] = useState(false);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [bookingFlowSaving, setBookingFlowSaving] = useState(false);
  const [vehicleMileageInput, setVehicleMileageInput] = useState("");
  const [bookingApprovalSaving, setBookingApprovalSaving] = useState(false);
  const [jobDocuments, setJobDocuments] = useState([]);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [invoiceViewState, setInvoiceViewState] = useState({
    exists: false,
    isProforma: true,
    paymentStatus: "",
    paymentCaptured: false,
    invoiceId: null
  });
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false);
  const [vhcFinancialTotalsFromPanel, setVhcFinancialTotalsFromPanel] = useState(null);
  // Customer-facing VHC delivery status (Pending / Sent / Viewed). Lifted out of
  // VHCTab so the badge can render in the job-card customer summary card.
  const [vhcCustomerStatus, setVhcCustomerStatus] = useState({
    status: "pending",
    label: "Pending",
    sentAt: null,
    viewedAt: null,
    readyAt: null,
  });
  const [checkingIn, setCheckingIn] = useState(false);
  const [trackerEntry, setTrackerEntry] = useState(null);
  const [trackerQuickModalOpen, setTrackerQuickModalOpen] = useState(false);
  const trackerUpdateRef = useRef(null);

  // Related Jobs (Prime/Sub-job) State
  const [relatedJobs, setRelatedJobs] = useState([]);
  const [relatedJobsLoading, setRelatedJobsLoading] = useState(false);
  const [isLinkPopupOpen, setIsLinkPopupOpen] = useState(false);
  const [linkJobInput, setLinkJobInput] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState(null);

  const applyWriteUpOptimisticState = useCallback(
    ({ completionStatus, tasks, requestStatuses } = {}) => {
      const now = Date.now();
      const requestLookupFromTasks = Array.isArray(tasks) ?
      buildRequestStatusLookupFromTasks(tasks) :
      { byId: {}, bySortOrder: {} };
      const requestLookupFromRows = Array.isArray(requestStatuses) ?
      buildRequestStatusLookupFromRows(requestStatuses) :
      { byId: {}, bySortOrder: {} };

      const previousOverlay = writeUpOptimisticSyncRef.current || {};
      const nextOverlay = {
        ...previousOverlay,
        ...(typeof completionStatus === "string" ?
        { completionStatus: normalizeWriteUpCompletionStatus(completionStatus) } :
        {}),
        ...(Array.isArray(tasks) ? { tasks } : {}),
        requestStatusLookup: mergeRequestStatusLookup(
          previousOverlay.requestStatusLookup || { byId: {}, bySortOrder: {} },
          mergeRequestStatusLookup(requestLookupFromTasks, requestLookupFromRows)
        ),
        updatedAt: now,
        expiresAt: now + 20000
      };

      writeUpOptimisticSyncRef.current = nextOverlay;
      setJobData((prev) => applyWriteUpOptimisticOverlay(prev, nextOverlay));
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const el = tabsScrollRef.current;
    if (!el) return;

    const compute = () => {
      const next = el.scrollWidth > el.clientWidth + 2;
      setTabsOverflowing(next);
    };

    compute();

    let resizeObserver;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => compute());
      resizeObserver.observe(el);
    } else {
      window.addEventListener("resize", compute);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();else
      window.removeEventListener("resize", compute);
    };
  }, [jobData, activeTab]);

  // Permission Check (centralized shared model)
  const userRoles = user?.roles?.map((r) => r.toLowerCase()) || [];
  const permissions = useMemo(
    () =>
    resolveJobCardPermissions({
      userRoles,
      jobStatus: jobData?.status,
      isArchiveMode,
      isValetMode,
      vhcRequired: jobData?.vhcRequired
    }),
    [userRoles, jobData?.status, jobData?.vhcRequired, isArchiveMode, isValetMode]
  );
  const {
    isWorkshopManager,
    canEditBase,
    mainStatusForEditLock,
    isInvoiceOrBeyondReadOnly,
    canEdit,
    canManageDocuments,
    canUseReleaseAction,
    canViewPartsTab,
    isPartsWriteUpVhcLockedByStatus,
    canEditPartsWriteUpVhc,
    isClockingLockedByStatus,
    clockingLockDescription,
    generalReadOnlyLockDescription,
    partsWriteUpVhcLockDescription,
    lockedTabIds
  } = permissions;
  const canEditTrackingLocations =
  !isArchiveMode &&
  String(jobData?.status || "").trim().toLowerCase() !== "archived";
  const lockAlertStyle = {
    padding: "12px 14px",
    borderRadius: "var(--radius-sm)",
    border: "none",
    backgroundColor: "var(--warning-surface)",
    color: "var(--warning-dark)",
    marginBottom: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  };

  const vhcDecisionSummary = useMemo(() => {
    const checks = Array.isArray(jobData?.vhcChecks) ? jobData.vhcChecks : [];
    const decisionChecks = checks.filter((check) => {
      const section = (check?.section || "").toString().trim();
      return section !== "VHC_CHECKSHEET" && section !== "VHC Checksheet";
    });
    if (decisionChecks.length === 0) {
      return { total: 0, decided: 0, allDecided: false };
    }
    const decided = decisionChecks.filter((check) => {
      return resolveVhcItemState(check).isDecided; // Canonical state resolver handles field priority.
    }).length;
    return {
      total: decisionChecks.length,
      decided,
      allDecided: decided === decisionChecks.length
    };
  }, [jobData?.vhcChecks]);
  const vhcDecisionComplete = vhcDecisionSummary.allDecided;
  const vhcTabReadyByRedAmberDecisions = useMemo(() => {
    const checks = Array.isArray(jobData?.vhcChecks) ? jobData.vhcChecks : [];
    const redAmberChecks = checks.filter((check) => {
      const section = (check?.section || "").toString().trim();
      if (section === "VHC_CHECKSHEET" || section === "VHC Checksheet") {
        return false;
      }
      const severity = resolveVhcSeverity(check);
      return severity === "red" || severity === "amber";
    });

    if (redAmberChecks.length === 0) {
      return false;
    }

    return redAmberChecks.every((check) => {
      const { decision } = resolveVhcItemState(check); // Canonical state resolver handles field priority.
      return decision === "authorized" || decision === "declined";
    });
  }, [jobData?.vhcChecks]);
  const vhcRowsMarkedCompleted = useMemo(() => {
    const checks = Array.isArray(jobData?.vhcChecks) ? jobData.vhcChecks : [];
    const redAmberChecks = checks.filter((check) => {
      const section = (check?.section || "").toString().trim();
      if (section === "VHC_CHECKSHEET" || section === "VHC Checksheet") return false;
      const severity = resolveVhcSeverity(check);
      return severity === "red" || severity === "amber";
    });

    if (redAmberChecks.length === 0) return false;

    return redAmberChecks.every((check) => {
      const decision = normaliseDecisionStatus(
        check?.authorization_state ??
        check?.authorizationState ??
        check?.approval_status ??
        check?.approvalStatus ??
        check?.display_status ??
        check?.status
      );
      return decision === "completed";
    });
  }, [jobData?.vhcChecks]);
  const vhcResolutionSnapshot = useMemo(() => {
    const checks = Array.isArray(jobData?.vhcChecks) ? jobData.vhcChecks : [];
    const summaryRows = checks.filter((check) => {
      const section = (check?.section || "").toString().trim();
      return section !== "VHC_CHECKSHEET" && section !== "VHC Checksheet";
    });
    if (summaryRows.length === 0) {
      return { total: 0, resolved: 0, unresolved: 0, unresolvedRedAmberOrAuthorised: 0 };
    }

    let resolved = 0;
    let unresolved = 0;
    let unresolvedRedAmberOrAuthorised = 0;

    summaryRows.forEach((check) => {
      const decisions = [
      check?.display_status,
      check?.approval_status,
      check?.approvalStatus,
      check?.authorization_state,
      check?.authorizationState,
      check?.status].

      map((value) => normaliseDecisionStatus(value)).
      filter(Boolean);

      const completeFlagRaw = check?.Complete ?? check?.complete;
      const isCompletedByFlag =
      completeFlagRaw === true ||
      completeFlagRaw === 1 ||
      typeof completeFlagRaw === "string" &&
      ["true", "1", "yes", "y", "completed", "complete"].includes(
        completeFlagRaw.trim().toLowerCase()
      );
      const hasCompleted = decisions.includes("completed") || isCompletedByFlag;
      const hasDeclined = decisions.includes("declined");
      const hasNotApplicable = decisions.includes("n/a");
      const severity = resolveVhcSeverity(check);
      const isAuthorised = decisions.includes("authorized");
      const isResolved = hasDeclined || hasNotApplicable || isAuthorised && hasCompleted;

      if (isResolved) {
        resolved += 1;
      } else {
        unresolved += 1;
      }

      if (severity === "red" || severity === "amber" || isAuthorised && !hasCompleted) {
        if (!isResolved) {
          unresolvedRedAmberOrAuthorised += 1;
        }
      }
    });
    return {
      total: summaryRows.length,
      resolved,
      unresolved,
      unresolvedRedAmberOrAuthorised
    };
  }, [jobData?.vhcChecks]);
  const hasRedAmberRepairRows = vhcResolutionSnapshot.unresolvedRedAmberOrAuthorised > 0;
  const vhcAllRedAmberRowsAwaitingDecision = useMemo(() => {
    const checks = Array.isArray(jobData?.vhcChecks) ? jobData.vhcChecks : [];
    const redAmberRows = checks.filter((check) => {
      const section = String(check?.section || "").trim();
      if (section === "VHC_CHECKSHEET" || section === "VHC Checksheet") return false;
      const severity = resolveVhcSeverity(check);
      return severity === "red" || severity === "amber";
    });

    return (
      redAmberRows.length > 0 &&
      redAmberRows.every((check) => {
        const item = projectVhcItem(check, { job: jobData });
        return getDisplayStatus(item)?.dotStateKey === "awaiting";
      })
    );
  }, [jobData]);
  const vhcAuthorizedWorkCompleted = vhcRowsMarkedCompleted;
  const vhcTabComplete =
  vhcResolutionSnapshot.total > 0 &&
  vhcResolutionSnapshot.unresolvedRedAmberOrAuthorised === 0;
  // Keep a dedicated summary-row completion flag for invoice gating compatibility.
  const vhcSummaryRowsCompleted = vhcTabComplete;
  const vhcTabAmberReady = hasRedAmberRepairRows;

  // Invoice tab is visible for anyone who can open this page to make review easier
  const canViewInvoice = true;

  const rawOverallStatusId =
  statusSnapshot?.job?.overallStatus || resolveMainStatusId(jobData?.status);
  const rawOverallStatusLabel =
  statusSnapshot?.job?.statusLabel || jobData?.status || "";

  // The status badge must reflect actual workshop progress: once any
  // technician has clocked onto this job (currently or previously), the
  // job is past the Checked In stage and should read as "In Progress" until
  // the next stage advances it. The persisted jobs.status row is sometimes
  // still "Checked In" because the auto-promotion in jobStatusService runs on
  // the sub-status path, not on every clocking event — so we promote here
  // for display whenever clocking activity exists for the job.
  const clockingSummary = statusSnapshot?.clockingSummary || null;
  const techHasClockedOnThisJob = Boolean(
    clockingSummary && (
    Array.isArray(clockingSummary.activeClockIns) && clockingSummary.activeClockIns.length > 0 ||
    typeof clockingSummary.completedSeconds === "number" && clockingSummary.completedSeconds > 0)

  );
  const clockingAwareJobStatus = getClockingAwareJobStatus({
    jobStatus: rawOverallStatusId || jobData?.status,
    statusLabel: rawOverallStatusLabel,
    hasClockingActivity: techHasClockedOnThisJob
  });
  const overallStatusId = clockingAwareJobStatus.statusId;
  const overallStatusLabel = clockingAwareJobStatus.statusLabel;
  const isBookedStatus = overallStatusId ?
  overallStatusId === JOB_STATUSES.BOOKED :
  typeof jobData?.status === "string" &&
  jobData.status.trim().toLowerCase() === "booked";
  // "Open" is a raw jobs.status DB value that bypasses the canonical catalog
  // (see src/lib/status/_baseline/currentStatusOutputs.md). Walk-in / unbooked
  // jobs land here and need the same Check-in flow as Booked appointments.
  const isOpenStatus =
  typeof jobData?.status === "string" &&
  jobData.status.trim().toLowerCase() === "open";
  // Treat the job as Checked In for button visibility only when the status
  // genuinely sits at CHECKED_IN. The legacy fallback to checkedInAt /
  // appointment.status was matching jobs that had progressed past Check In
  // (because those timestamps survive once the tech clocks on), causing the
  // header badge to show Checked In even though work is in progress.
  const isCheckedIn = Boolean(
    overallStatusId === JOB_STATUSES.CHECKED_IN ||

    // Only fall back to the timestamps when we don't know the canonical
    // status yet — i.e. before the status snapshot has loaded.
    !overallStatusId && (
    jobData?.checkedInAt ||
    jobData?.appointment?.status === "checked_in")


  );
  const loanCarWaitingStatus = String(
    logisticsWaitingStatusOverride || jobData?.waitingStatus || jobData?.bookingRequest?.waitingStatus || ""
  )
    .trim()
    .toLowerCase();
  const isLoanCarLogisticsSelected = loanCarWaitingStatus === "loan car";

  // Sync active tab from query parameter, default to customer-requests
  useEffect(() => {
    const tabParam = String(router.query.tab || "").trim();
    const allowedTabIds = isValetMode ?
    new Set(["customer-requests", "documents"]) :
    new Set([
    "customer-requests",
    "contact",
    "scheduling",
    ...(isLoanCarLogisticsSelected ? ["loan-car"] : []),
    "service-history",
    "parts",
    "notes",
    "write-up",
    "vhc",
    "warranty",
    "clocking",
    "messages",
    "documents",
    "invoice"]
    );
    if (allowedTabIds.has(tabParam)) {
      setActiveTab(tabParam);
      return;
    }
    if (!allowedTabIds.has(activeTab)) {
      setActiveTab(activeTab === "loan-car" ? "scheduling" : "customer-requests");
      return;
    }
    if (!tabParam) return;
    setActiveTab("customer-requests");
  }, [router.query.tab, isValetMode, isLoanCarLogisticsSelected, activeTab]);

  useEffect(() => {
    if (activeTab === "write-up") {
      setWriteUpTabMounted(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "vhc") {
      setVhcTabMounted(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (vhcTabMounted || typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    let idleId = null;
    let timeoutId = null;
    const mountVhcTab = () => {
      if (!cancelled) {
        setVhcTabMounted(true);
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(mountVhcTab, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(mountVhcTab, 1200);
    }

    return () => {
      cancelled = true;
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [vhcTabMounted, jobNumber]);

  useEffect(() => {
    if (writeUpTabMounted || typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    let idleId = null;
    let timeoutId = null;
    const mountWriteUpTab = () => {
      if (!cancelled) {
        setWriteUpTabMounted(true);
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(mountWriteUpTab, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(mountWriteUpTab, 1200);
    }

    return () => {
      cancelled = true;
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [writeUpTabMounted, jobNumber]);

  useEffect(() => {
    if (!router.isReady || !jobNumber) {
      return;
    }
    if (prefetchedJobTabsRef.current.has(jobNumber)) {
      return;
    }

    prefetchedJobTabsRef.current.add(jobNumber);

    const safeJobNumber = encodeURIComponent(jobNumber);
    const baseRoute = `/job-cards/${safeJobNumber}`;
    const deferredRoutes = [
    `${baseRoute}?tab=write-up`];


    let cancelled = false;
    let idleId = null;
    let timeoutId = null;
    const prefetchDeferredRoutes = () => {
      if (cancelled) return;
      deferredRoutes.forEach((route) => {
        router.prefetch(route).catch(() => {


          // Ignore prefetch errors; navigation still works with standard loading.
        });});};

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(prefetchDeferredRoutes, { timeout: 3000 });
    } else if (typeof window !== "undefined") {
      timeoutId = window.setTimeout(prefetchDeferredRoutes, 1500);
    } else {
      prefetchDeferredRoutes();
    }

    return () => {
      cancelled = true;
      if (idleId !== null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null && typeof window !== "undefined") {
        window.clearTimeout(timeoutId);
      }
    };
  }, [router, router.isReady, jobNumber]);

  const triggerNewNotesHighlight = useCallback((options = {}) => {
    const { clearBadgeAfterMs = 3000 } = options;
    setPendingNewNoteIds((currentIds) => {
      if (!currentIds.length) return currentIds;
      const idsToHighlight = [...currentIds];
      setHighlightedNoteIds(idsToHighlight);
      if (notesHighlightTimeoutRef.current) {
        clearTimeout(notesHighlightTimeoutRef.current);
      }
      notesHighlightTimeoutRef.current = setTimeout(() => {
        setHighlightedNoteIds([]);
        setPendingNewNoteIds((latestIds) =>
        latestIds.filter((id) => !idsToHighlight.includes(id))
        );
      }, clearBadgeAfterMs);
      return currentIds;
    });
  }, []);

  const handleNoteAdded = useCallback((noteId) => {
    if (!noteId) return;
    setPendingNewNoteIds((currentIds) =>
    currentIds.includes(noteId) ? currentIds : [noteId, ...currentIds]
    );
  }, []);

  const handleSchedulingLogisticsChange = useCallback((nextStatus) => {
    setLogisticsWaitingStatusOverride(nextStatus || null);
  }, []);

  const handleNotesChange = useCallback((nextNotes) => {
    const normalizedNotes = nextNotes || [];
    setJobNotes(normalizedNotes);
    setSharedNote(normalizedNotes?.[0]?.noteText || "");
    setSharedNoteMeta(normalizedNotes?.[0] || null);
  }, []);

  const handleTabClick = useCallback((tabId) => {
    setActiveTab(tabId);
    if (tabId === "write-up") {
      setWriteUpTabMounted(true);
    }
    if (tabId === "notes") {
      triggerNewNotesHighlight({ clearBadgeAfterMs: 3000 });
    }
  }, [triggerNewNotesHighlight]);

  const handleTabsDragStart = useCallback((event) => {
    const target = event.currentTarget;
    tabsDragScrollRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: target.scrollLeft
    };
    target.style.cursor = "grabbing";
  }, []);

  const handleTabsDragMove = useCallback((event) => {
    const drag = tabsDragScrollRef.current;
    if (!drag.active) return;
    const target = event.currentTarget;
    const delta = event.clientX - drag.startX;
    target.scrollLeft = drag.startScrollLeft - delta;
  }, []);

  const handleTabsDragEnd = useCallback((event) => {
    tabsDragScrollRef.current.active = false;
    if (event?.currentTarget) {
      event.currentTarget.style.cursor = tabsOverflowing ? "grab" : "default";
    }
  }, [tabsOverflowing]);

  useEffect(() => {
    setPendingNewNoteIds([]);
    setHighlightedNoteIds([]);
    if (notesHighlightTimeoutRef.current) {
      clearTimeout(notesHighlightTimeoutRef.current);
      notesHighlightTimeoutRef.current = null;
    }
  }, [jobData?.id]);

  // Watch for job completion and redirect to invoice tab
  const previousStatusRef = useRef(null);
  useEffect(() => {
    if (!jobData) return;

    const currentStatus = overallStatusLabel || jobData.status;
    const previousStatus = previousStatusRef.current;

    // Check if job was just marked as Complete
    if (
    currentStatus === "Complete" &&
    previousStatus !== null &&
    previousStatus !== "Complete")
    {
      // Redirect to invoice tab when job is completed
      router.push(`/job-cards/${jobData.jobNumber}?tab=invoice`);
    }

    // Update the ref for next comparison
    previousStatusRef.current = currentStatus;
  }, [jobData?.status, jobData?.jobNumber, router]);


  const fetchSharedNote = useCallback(async (jobId) => {
    if (!jobId) return null;

    try {
      const notes = await (await loadNotesDb()).getNotesByJob(jobId);
      setJobNotes(notes || []);
      return notes[0] || null;
    } catch (noteError) {
      logFailure("Failed to load shared note:", noteError);
      setJobNotes([]);
      return null;
    }
  }, []);

  const refreshSharedNote = useCallback(async (jobId) => {
    if (!jobId) return null;
    const latest = await fetchSharedNote(jobId);
    setSharedNote(latest?.noteText || "");
    setSharedNoteMeta(latest);
    return latest;
  }, [fetchSharedNote]);

  const fetchJobData = useCallback(
    async (options = { silent: false, force: false }) => {
      if (!jobNumber) return;

      const { silent, force } = options;
      const throttleMs = process.env.NODE_ENV === "production" ? 1200 : 2000;
      const now = Date.now();

      if (silent && !force) {
        if (jobFetchInFlightRef.current) {
          return;
        }
        if (now - lastJobFetchAtRef.current < throttleMs) {
          return;
        }
      }

      try {
        if (!silent) {
          setLoading(true);
        }
        jobFetchInFlightRef.current = true;
        setError(null);

        // ONE authoritative source for the card.
        //
        // This used to call getJobByNumber() directly from the browser — a
        // second full fetch of the same job that useJob() had already requested
        // through /api/jobcards/[jobNumber], followed by two more sequential
        // browser round trips (fetchSharedNote, getCustomerJobs). The API route
        // resolves all of that in ONE request whose queries run in parallel next
        // to the database, and it already returns notes, shared note, customer,
        // vehicle, job history and warranty data.
        //
        // The response is written straight into the SWR cache, so the hook and
        // this page can never disagree, and a revisit renders from cache while
        // revalidating underneath.
        const shouldForceFresh = Boolean(force);
        const key = buildJobCardKey(jobNumber, { archive: isArchiveMode });
        const requestUrl = shouldForceFresh
          ? `${key}${key.includes("?") ? "&" : "?"}force=1`
          : key;

        const response = await fetch(requestUrl, { credentials: "include" });
        if (!response.ok) {
          setError(
            response.status === 404 ? "Job card not found" : `Failed to load job card (${response.status})`
          );
          return;
        }
        const payload = await response.json();
        const jobCard = payload?.job || payload?.jobCard || null;
        if (!jobCard) {
          setError("Job card not found");
          return;
        }
        // Seed SWR with what we just fetched rather than letting it re-request.
        mutateSwrJob(payload, { revalidate: false });

        const data = payload;
        const mappedFiles = (jobCard.files || []).map(mapJobFileRecord);
        const resolvedHydratedMileage = pickMileageValue(
          jobCard?.mileage,
          jobCard?.milage,
          data?.vehicle?.mileage
        );
        const hydratedJobCard = {
          ...jobCard,
          files: mappedFiles,
          mileage: resolvedHydratedMileage ?? "",
          milage: pickMileageValue(jobCard?.milage, resolvedHydratedMileage)
        };
        const optimisticOverlay = writeUpOptimisticSyncRef.current;
        if (optimisticOverlay && typeof optimisticOverlay.expiresAt === "number" && Date.now() > optimisticOverlay.expiresAt) {
          writeUpOptimisticSyncRef.current = null;
        }
        const activeOverlay = writeUpOptimisticSyncRef.current;
        if (activeOverlay && isWriteUpOverlayAcknowledgedByServer(hydratedJobCard, activeOverlay)) {
          writeUpOptimisticSyncRef.current = null;
        }
        const overlayToApply = writeUpOptimisticSyncRef.current;
        setJobData(overlayToApply ? applyWriteUpOptimisticOverlay(hydratedJobCard, overlayToApply) : hydratedJobCard);
        // Do NOT set jobDocuments here — fetchDocuments() is the authoritative source
        // and runs independently. Setting from the embedded join (which can silently
        // return [] when the PostgREST schema cache is stale) would overwrite correctly
        // fetched files and cause them to disappear from the gallery.

        // Notes, the shared note and the customer's job history all arrive in
        // the same response now (the API resolves them in parallel server-side).
        // These were three extra sequential browser round trips.
        const notesFromApi = Array.isArray(data.notes)
          ? data.notes
          : Array.isArray(jobCard.notes)
            ? jobCard.notes
            : [];
        setJobNotes(notesFromApi);
        const resolvedSharedNote = data.sharedNote || notesFromApi[0] || null;
        setSharedNote(resolvedSharedNote?.noteText || "");
        setSharedNoteMeta(resolvedSharedNote);

        setVehicleJobHistory(
          Array.isArray(data.vehicleJobHistory) ? data.vehicleJobHistory : []
        );
      } catch (err) {
        logFailure("Exception fetching job:", err);
        setError(err?.message || "Failed to load job card");
      } finally {
        lastJobFetchAtRef.current = Date.now();
        jobFetchInFlightRef.current = false;
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [jobNumber, isArchiveMode, mutateSwrJob]
  );

  useEffect(() => {
    fetchJobData();
  }, [fetchJobData]);

  // Stable callbacks for WriteUpForm — avoids re-creating on every parent render
  const handleWriteUpSaveSuccess = useCallback(() => {
    fetchJobData({ silent: true, force: true });
  }, [fetchJobData]);
  const handleWriteUpCompletionChange = useCallback((nextStatus) => {
    applyWriteUpOptimisticState({ completionStatus: nextStatus });
  }, [applyWriteUpOptimisticState]);
  const handleWriteUpRequestStatusesChange = useCallback((requestStatuses = []) => {
    applyWriteUpOptimisticState({ requestStatuses });
  }, [applyWriteUpOptimisticState]);
  const handleWriteUpTasksSnapshotChange = useCallback((tasksSnapshot = []) => {
    applyWriteUpOptimisticState({
      tasks: Array.isArray(tasksSnapshot) ? tasksSnapshot : []
    });
  }, [applyWriteUpOptimisticState]);

  const handleRenameDocument = useCallback(async (fileId, newName) => {
    if (!fileId || !newName) return;
    try {
      await fetch(`/api/jobcards/${encodeURIComponent(jobNumber)}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, fileName: newName })
      });
      // Update local state immediately so the gallery reflects the change
      setJobDocuments((prev) =>
      prev.map((doc) =>
      (doc.id || doc.file_id) === fileId ? { ...doc, name: newName, file_name: newName } : doc
      )
      );
    } catch {


      // silently ignore — the gallery will refresh on next fetchDocuments
    }}, [jobNumber]);
  const handleDocumentFileUploaded = useCallback((fileData) => {
    if (!fileData) return;
    const newDoc = mapJobFileRecord({
      file_id: fileData.fileId || null,
      file_name: fileData.filename || fileData.originalName || "Document",
      file_url: fileData.path || "",
      file_type: fileData.mimetype || "",
      folder: "documents",
      uploaded_by: dbUserId || null,
      uploaded_at: fileData.uploadedAt || new Date().toISOString()
    });
    setJobDocuments((prev) => [...prev, newDoc]);
  }, [dbUserId]);

  const handleReplaceDocument = useCallback(async (oldDoc, editedFile) => {
    if (!oldDoc?.id || !editedFile) return;
    const jobIdNum = jobData?.id;
    if (!jobIdNum) return;
    try {
      const formData = new FormData();
      formData.append("file", editedFile);
      formData.append("jobId", String(jobIdNum));
      formData.append("userId", String(actingUserNumericId || ""));
      const res = await fetch("/api/jobcards/upload-document", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      const storagePath = deriveStoragePathFromUrl(oldDoc.url);
      if (storagePath) {
        await (await loadSupabaseClient()).storage.from(JOB_DOCUMENT_BUCKET).remove([storagePath]).catch(() => {});
      }
      await (await loadJobsDb()).deleteJobFile(oldDoc.id).catch(() => {});

      const newDoc = mapJobFileRecord({
        file_id: data.file?.fileId || null,
        file_name: data.file?.filename || data.file?.originalName || editedFile.name || "Document",
        file_url: data.file?.path || "",
        file_type: data.file?.mimetype || editedFile.type || "",
        folder: "documents",
        uploaded_by: actingUserNumericId || null,
        uploaded_at: data.file?.uploadedAt || new Date().toISOString()
      });
      setJobDocuments((prev) => prev.map((d) => d.id === oldDoc.id ? newDoc : d));
    } catch (err) {
      alert(err?.message || "Failed to replace document");
    }
  }, [jobData?.id, actingUserNumericId]);

  // Fetch job files directly from job_files table (bypasses embedded-join cache issues)
  const fetchDocuments = useCallback(async () => {
    if (!jobNumber) return;
    try {
      const response = await fetch(`/api/jobcards/${encodeURIComponent(jobNumber)}/files`, {
        cache: "no-store"
      });
      if (!response.ok) return;
      const payload = await response.json();
      const files = Array.isArray(payload.files) ? payload.files : [];
      setJobDocuments(files.map(mapJobFileRecord));
    } catch {


      // silently ignore — the embedded-join fallback already ran
    }}, [jobNumber]);
  // Always fetch documents directly on page load and job-number changes.
  // This is the authoritative source: a direct query against job_files avoids
  // any PostgREST embedded-join schema-cache misses.
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Hydrate local state from SWR cache (prefetch or previous visit) for instant
  // rendering. This is the stale-while-revalidate path: the card paints from
  // cache while fetchJobData revalidates underneath.
  useEffect(() => {
    if (!swrJobResponse) return; // no cached data available yet
    if (jobData) return; // already have local data, don't overwrite
    const jobCard = swrJobResponse.job || swrJobResponse.jobCard; // handle both API response shapes
    if (!jobCard) return; // no job card in the response
    // Only accept a cached response that belongs to the job in the URL. Without
    // this, any future SWR option that serves another key's data (or a race
    // while switching between two cards) could paint the wrong job.
    const cachedNumber = String(jobCard.jobNumber ?? jobCard.job_number ?? "").trim();
    if (cachedNumber && String(jobNumber || "").trim() && cachedNumber !== String(jobNumber).trim()) return;
    setJobData(jobCard); // hydrate local state from SWR cache
    setLoading(false); // remove loading state since we have data
  }, [swrJobResponse, jobData, jobNumber]);

  useEffect(() => {
    writeUpOptimisticSyncRef.current = null;
  }, [jobNumber]);

  useEffect(() => {
    setInvoiceViewState({
      exists: false,
      isProforma: true,
      paymentStatus: "",
      paymentCaptured: false,
      invoiceId: null
    });
  }, [jobNumber]);

  const loadStatusSnapshot = useCallback(async (jobId, options = {}) => {
    if (!jobId || isArchiveMode) {
      setStatusSnapshot(null);
      return null;
    }

    try {
      const response = await fetch(`/api/status/snapshot?jobId=${jobId}`);
      const payload = await response.json();
      if (payload?.success && payload?.snapshot) {
        if (options.apply !== false) {
          setStatusSnapshot(payload.snapshot);
        }
        return payload.snapshot;
      }
    } catch (snapshotError) {
      logFailure("Failed to load status snapshot:", snapshotError);
    }

    return null;
  }, [isArchiveMode]);

  useEffect(() => {
    if (!jobData?.id || isArchiveMode) {
      setStatusSnapshot(null);
      return;
    }
    let isActive = true;
    const loadSnapshot = async () => {
      const snapshot = await loadStatusSnapshot(jobData.id, { apply: false });
      if (!isActive || !snapshot) return;
      setStatusSnapshot(snapshot);
    };
    loadSnapshot();
    return () => {
      isActive = false;
    };
  }, [jobData?.id, isArchiveMode, loadStatusSnapshot]);

  useEffect(() => {
    if (!jobData?.id || isArchiveMode) return;
    if (!jobData.vhcRequired) return;
    if (!vhcAuthorizedWorkCompleted) return;
    if (jobData.vhcCompletedAt) return;
    if (!canEdit) return;

    let isActive = true;
    const markVhcComplete = async () => {
      const result = await (await loadJobsDb()).updateJob(jobData.id, {
        vhc_completed_at: new Date().toISOString()
      });
      if (!isActive) return;
      if (result?.success && result?.data) {
        setJobData((prev) =>
        prev ?
        { ...prev, vhcCompletedAt: result.data.vhcCompletedAt } :
        prev
        );
      }
    };
    markVhcComplete();
    return () => {
      isActive = false;
    };
  }, [jobData?.id, jobData?.vhcRequired, jobData?.vhcCompletedAt, vhcAuthorizedWorkCompleted, canEdit]);

  // Fetch related jobs when job data loads
  useEffect(() => {
    const primeJobNumber = jobData?.primeJobNumber;
    if (!primeJobNumber) {
      setRelatedJobs([]);
      return;
    }

    let isActive = true;
    const fetchRelatedJobs = async () => {
      setRelatedJobsLoading(true);
      try {
        const result = await (await loadJobsDb()).getJobsByPrimeGroup(primeJobNumber);
        if (!isActive) return;
        if (result.success && result.data?.allJobs) {
          // Filter out the current job from the list
          const others = result.data.allJobs.filter(
            (job) => job.jobNumber !== jobData.jobNumber
          );
          setRelatedJobs(others);
        }
      } catch (err) {
        logFailure("Failed to fetch related jobs:", err);
      } finally {
        if (isActive) setRelatedJobsLoading(false);
      }
    };

    fetchRelatedJobs();
    return () => {
      isActive = false;
    };
  }, [jobData?.primeJobNumber, jobData?.jobNumber]);

  const handleLinkJob = useCallback(async () => {
    const trimmed = linkJobInput.trim();
    if (!trimmed) {setLinkError("Please enter a job number.");return;}
    setIsLinking(true);
    setLinkError(null);
    try {
      const result = await (await loadJobsDb()).getJobByNumber(trimmed, { noCache: true });
      if (!result?.data?.jobCard) {
        setLinkError("Job not found. Check the job number and try again.");
        return;
      }
      const targetJob = result.data.jobCard;
      if (targetJob.id === jobData.id) {
        setLinkError("Cannot link a job to itself.");
        return;
      }
      let primeJobId = jobData.isPrimeJob ? jobData.id : jobData.primeJobId;
      let primeJobNumber = jobData.primeJobNumber || jobData.jobNumber;
      if (!jobData.isPrimeJob && !jobData.primeJobId) {
        const convertResult = await (await loadJobsDb()).convertToPrimeJob(jobData.id);
        if (!convertResult?.success) {
          setLinkError(convertResult?.error?.message || "Failed to make current job a prime job.");
          return;
        }
        primeJobId = jobData.id;
        primeJobNumber = jobData.jobNumber;
      }
      const linkResult = await (await loadJobsDb()).updateJob(targetJob.id, {
        prime_job_id: primeJobId,
        prime_job_number: primeJobNumber,
        is_prime_job: false
      });
      if (!linkResult?.success) {
        setLinkError(linkResult?.error?.message || "Failed to link job.");
        return;
      }
      const refreshResult = await (await loadJobsDb()).getJobsByPrimeGroup(primeJobNumber);
      if (refreshResult.success && refreshResult.data?.allJobs) {
        setRelatedJobs(refreshResult.data.allJobs.filter((j) => j.jobNumber !== jobData.jobNumber));
      }
      setIsLinkPopupOpen(false);
      setLinkJobInput("");
    } catch (err) {
      setLinkError("An unexpected error occurred.");
      logFailure("Link job error:", err);
    } finally {
      setIsLinking(false);
    }
  }, [linkJobInput, jobData, setRelatedJobs]);

  // Read through /api/tracking/snapshot rather than calling
  // `fetchTrackingSnapshot()` in the browser.
  //
  // The direct call ran the tracking-event queries from this page under the
  // public anon key, pulled the whole of lib/database/tracking.js into the job
  // card's bundle, and pulled back every entry in the workshop just to find one
  // job. It was also the last browser-side read keeping key_tracking_events and
  // vehicle_tracking_events open to anon. The route is role-guarded, runs the
  // identical match server-side under the service role
  // (`fetchTrackingEntryForJob`) and returns the same entry shape.
  const loadTrackerEntry = useCallback(async () => {
    const targetJobNumber = jobData?.jobNumber || jobNumber;
    if (!targetJobNumber) return;
    try {
      const params = new URLSearchParams();
      if (jobData?.id) params.set("jobId", String(jobData.id));
      params.set("jobNumber", String(targetJobNumber));
      if (jobData?.reg) params.set("vehicleReg", String(jobData.reg));

      const response = await fetch(buildApiUrl(`/api/tracking/snapshot?${params.toString()}`));
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to load tracking data");
      }
      const match = payload.data || null;

      if (match && trackerUpdateRef.current) {
        // A save this page just made can be newer than the snapshot it reads
        // back; don't let a stale read overwrite it.
        const snapshotTime = new Date(match.updatedAt || 0).getTime();
        const localTime = new Date(trackerUpdateRef.current).getTime();
        if (snapshotTime && localTime && snapshotTime < localTime) {
          return;
        }
      }
      setTrackerEntry(match);
    } catch (loadError) {
      logFailure("Failed to load tracking entry", loadError);
      setTrackerEntry(null);
    }
  }, [jobData?.id, jobData?.jobNumber, jobData?.reg, jobNumber]);

  useEffect(() => {
    if (!jobData?.jobNumber && !jobNumber) return;
    loadTrackerEntry();
  }, [jobData?.jobNumber, jobNumber, loadTrackerEntry]);


  const handleTrackerSave = useCallback(
    async (form) => {
      try {
        const resolvedJobNumber =
        (jobData?.jobNumber || form.jobNumber || "").trim().toUpperCase();
        const resolvedReg = (jobData?.reg || form.reg || "").trim().toUpperCase();
        const payload = {
          actionType: form.actionType || "job_checked_in",
          jobId: jobData?.id || null,
          jobNumber: resolvedJobNumber,
          vehicleId: jobData?.vehicleId || jobData?.vehicle_id || null,
          vehicleReg: resolvedReg,
          keyLocation: form.keyLocation,
          vehicleLocation: form.vehicleLocation,
          notes: form.notes,
          performedBy: dbUserId || null,
          vehicleStatus: form.vehicleStatus || form.status
        };
        // Debug logs removed after troubleshooting.

        const response = await fetch(buildApiUrl("/api/tracking/next-action"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const responsePayload = await response.
        json().
        catch(() => ({ message: "Failed to read tracking response" }));

        if (!response.ok) {
          logFailure("Tracking update failed", responsePayload, { status: response.status });
          throw new Error(responsePayload?.message || "Failed to save tracking entry");
        }

        const keyEvent = responsePayload?.data?.keyEvent;
        const vehicleEvent = responsePayload?.data?.vehicleEvent;
        // Debug logs removed after troubleshooting.
        const localUpdatedAt =
        vehicleEvent?.occurred_at || keyEvent?.occurred_at || new Date().toISOString();
        trackerUpdateRef.current = localUpdatedAt;
        setTrackerEntry((prev) => ({
          ...prev,
          jobId: jobData?.id ?? prev?.jobId ?? null,
          jobNumber: resolvedJobNumber || prev?.jobNumber,
          vehicleReg: resolvedReg || prev?.vehicleReg,
          reg: resolvedReg || prev?.reg,
          customer: jobData?.customer || prev?.customer,
          serviceType: jobData?.type || jobData?.serviceType || prev?.serviceType,
          makeModel: jobData?.makeModel || prev?.makeModel,
          status: vehicleEvent?.status || form.vehicleStatus || form.status || prev?.status,
          vehicleLocation: vehicleEvent?.location || form.vehicleLocation,
          keyLocation: keyEvent?.action || form.keyLocation,
          updatedAt: localUpdatedAt
        }));
        // Debug logs removed after troubleshooting.
        await loadTrackerEntry();
        setTrackerQuickModalOpen(false);
      } catch (saveError) {
        logFailure("Failed to save tracking entry", saveError);
      }
    },
    [dbUserId, jobData, loadTrackerEntry]
  );

  const handleCheckIn = useCallback(async () => {
    if (!jobData?.id) {
      alert("Unable to check in this job because it is missing an ID.");
      return;
    }

    // Structured payload renders the modern themed-tile layout in
    // ConfirmationDialog (see src/components/popups/ConfirmationDialog.js).
    const confirmed = await confirm({
      title: null, // Suppress the eyebrow — the prompt is enough on its own.
      message: "Check in this customer?",
      details: [
      { label: "Job", value: jobData.jobNumber || jobData.id || "—", tone: "info" },
      { label: "Customer", value: jobData.customer || "N/A", tone: "success" },
      { label: "Vehicle", value: jobData.reg || "N/A", tone: "warning" },
      { label: "Appointment", value: jobData.appointment?.time || "N/A", tone: "accent" }],

      confirmLabel: "Check In",
      cancelLabel: "Cancel"
    });

    if (!confirmed) return;

    setCheckingIn(true);

    try {
      const result = await (await loadJobStatusService()).autoSetCheckedInStatus(
        jobData.id,
        dbUserId || user?.user_id || user?.id || "SYSTEM"
      );

      if (!result?.success) {
        logFailure("Check-in failed:", result?.error);
        alert(`Failed to check in: ${result?.error?.message || "Unknown error"}`);
        return;
      }

      setJobData((prev) =>
      prev ?
      {
        ...prev,
        status: "Checked In", // optimistic: update status immediately so UI reflects the change
        checkedInAt: prev.checkedInAt || new Date().toISOString(),
        appointment: prev.appointment ?
        { ...prev.appointment, status: "checked_in" } :
        prev.appointment
      } :
      prev
      );

      alert(
        `Customer checked in.\n\n` +
        `Job: ${jobData.jobNumber || jobData.id}\n` +
        `Customer: ${jobData.customer || "N/A"}\n` +
        `Time: ${new Date().toLocaleTimeString()}`
      );

      await fetchJobData({ silent: true, force: true });
      revalidateAllJobs(); // tell other pages (appointments, dashboard) to refresh
    } catch (error) {
      logFailure("Error checking in:", error);
      alert("Error checking in customer. Please try again.");
    } finally {
      setCheckingIn(false);
    }
  }, [confirm, dbUserId, fetchJobData, jobData, user?.id, user?.user_id]);

  const scheduleRealtimeRefresh = useCallback(() => {
    const MIN_REFRESH_INTERVAL_MS = process.env.NODE_ENV === "production" ? 800 : 1200;
    const now = Date.now();

    if (typeof document !== "undefined" && document.hidden) {
      return;
    }

    if (jobRealtimeRefreshRef.current) {
      clearTimeout(jobRealtimeRefreshRef.current);
    }

    const nextDelay = Math.max(180, MIN_REFRESH_INTERVAL_MS - (now - lastRealtimeFetchAtRef.current));

    jobRealtimeRefreshRef.current = setTimeout(() => {
      lastRealtimeFetchAtRef.current = Date.now();
      fetchJobData({ silent: true, force: true });
    }, nextDelay);
  }, [fetchJobData]);

  const refreshCustomerVehicles = useCallback(
    async (customerId) => {
      if (!customerId) {
        setCustomerVehicles([]);
        return;
      }

      setCustomerVehiclesLoading(true);
      try {
        const vehicles = await (await loadCustomersDb()).getCustomerVehicles(customerId);
        setCustomerVehicles(Array.isArray(vehicles) ? vehicles : []);
      } catch (vehicleError) {
        logFailure("Failed to load customer vehicles:", vehicleError);
        setCustomerVehicles([]);
      } finally {
        setCustomerVehiclesLoading(false);
      }
    },
    []
  );

  // jobDocuments is driven solely by fetchDocuments() — not by jobData.files —
  // so that the embedded-join result (which can be empty due to schema-cache issues)
  // never overwrites the correct direct-query result.

  useEffect(() => {
    if (!jobData?.customerId) {
      setCustomerVehicles([]);
      return;
    }
    refreshCustomerVehicles(jobData.customerId);
  }, [jobData?.customerId, refreshCustomerVehicles]);

  const linkedVehicleMileage = useMemo(() => {
    const targetVehicleId = Number(jobData?.vehicleId);
    if (!Number.isFinite(targetVehicleId)) return null;
    const match = (Array.isArray(customerVehicles) ? customerVehicles : []).find(
      (vehicle) => Number(vehicle?.vehicle_id) === targetVehicleId
    );
    return match?.mileage ?? null;
  }, [customerVehicles, jobData?.vehicleId]);

  useEffect(() => {
    const resolvedMileage = pickMileageValue(jobData?.mileage, jobData?.milage, linkedVehicleMileage);
    const nextMileage =
    resolvedMileage === null || resolvedMileage === undefined ? "" : String(resolvedMileage);
    mileageInputDirtyRef.current = false;
    setVehicleMileageInput(nextMileage);
  }, [jobData?.mileage, jobData?.milage, jobData?.vehicleId, linkedVehicleMileage]);

  useEffect(() => {
    return () => {
      if (mileageAutoSaveRef.current) {
        clearTimeout(mileageAutoSaveRef.current);
      }
      if (sharedNoteSaveRef.current) {
        clearTimeout(sharedNoteSaveRef.current);
      }
      if (notesHighlightTimeoutRef.current) {
        clearTimeout(notesHighlightTimeoutRef.current);
      }
      if (jobRealtimeRefreshRef.current) {
        clearTimeout(jobRealtimeRefreshRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!jobData?.id) return;

    const shouldIgnoreRealtimePayload = (payload, tableName) => {
      if (!payload) return false;
      if (tableName === "job_progress") return true;

      if (payload.eventType !== "UPDATE") return false;
      const oldRow = payload.old && typeof payload.old === "object" ? payload.old : {};
      const newRow = payload.new && typeof payload.new === "object" ? payload.new : {};

      const changedKeys = Object.keys(newRow).filter((key) => oldRow[key] !== newRow[key]);
      if (!changedKeys.length) return true;

      const trivialKeys = new Set([
      "updated_at",
      "updatedAt",
      "modified_at",
      "modifiedAt",
      "last_modified",
      "lastModified",
      "last_updated_at",
      "lastUpdatedAt",
      "synced_at",
      "syncedAt"]
      );

      const nonTrivialChanges = changedKeys.filter((key) => !trivialKeys.has(key));
      return nonTrivialChanges.length === 0;
    };

    const tablesToWatch = [
    { table: "jobs", filter: `id=eq.${jobData.id}` },
    { table: "appointments", filter: `job_id=eq.${jobData.id}` },
    { table: "parts_job_items", filter: `job_id=eq.${jobData.id}` },
    { table: "parts_requests", filter: `job_id=eq.${jobData.id}` },
    { table: "vhc_checks", filter: `job_id=eq.${jobData.id}` },
    { table: "job_clocking", filter: `job_id=eq.${jobData.id}` },
    { table: "job_writeups", filter: `job_id=eq.${jobData.id}` },
    { table: "job_requests", filter: `job_id=eq.${jobData.id}` },
    { table: "job_files", filter: `job_id=eq.${jobData.id}`, shouldRefresh: false, onPayload: () => fetchDocuments() },
    { table: "job_cosmetic_damage", filter: `job_id=eq.${jobData.id}` },
    { table: "job_customer_statuses", filter: `job_id=eq.${jobData.id}` },
    // job_progress can be extremely noisy (e.g. frequent heartbeat updates) and
    // should not trigger full job-card refetches.
    { table: "job_progress", filter: `job_id=eq.${jobData.id}`, shouldRefresh: false },
    { table: "job_booking_requests", filter: `job_id=eq.${jobData.id}` },
    {
      table: "job_notes",
      filter: `job_id=eq.${jobData.id}`,
      shouldRefresh: false,
      onPayload: () => refreshSharedNote(jobData.id)
    }];


    return subscribeWithDeferredClient((supabase) => {
    const channel = supabase.channel(`job-card-sync-${jobData.id}`);

    tablesToWatch.forEach(({ table, filter, shouldRefresh = true, onPayload }) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter
        },
        (payload) => {
          if (shouldIgnoreRealtimePayload(payload, table)) {
            return;
          }
          if (typeof onPayload === "function") {
            onPayload();
          }
          if (shouldRefresh) {
            scheduleRealtimeRefresh();
          }
        }
      );
    });

    channel.subscribe();
    return channel;
    });
  }, [jobData?.id, fetchDocuments, refreshSharedNote, scheduleRealtimeRefresh, isArchiveMode]);

  const handleCustomerDetailsSave = useCallback(
    async (updatedDetails) => {
      if (!jobData?.customerId) {
        alert("No customer is linked to this job card.");
        return { success: false, error: { message: "Missing customer record" } };
      }

      setCustomerSaving(true);

      try {
        // Only write keys the caller actually provided, so the Contact-details
        // edit form and the Notes & Preferences section can share this handler
        // without each one wiping the other's fields.
        const payload = {};
        const setIf = (key, present, value) => {
          if (present) payload[key] = value;
        };
        setIf("firstname", "firstName" in updatedDetails, updatedDetails.firstName?.trim() || null);
        setIf("lastname", "lastName" in updatedDetails, updatedDetails.lastName?.trim() || null);
        setIf("email", "email" in updatedDetails, updatedDetails.email?.trim() || null);
        setIf("mobile", "mobile" in updatedDetails, updatedDetails.mobile?.trim() || null);
        setIf("telephone", "telephone" in updatedDetails, updatedDetails.telephone?.trim() || null);
        setIf("address", "address" in updatedDetails, updatedDetails.address?.trim() || null);
        setIf("postcode", "postcode" in updatedDetails, updatedDetails.postcode?.trim() || null);
        setIf("contact_preference", "contactPreference" in updatedDetails, updatedDetails.contactPreference || null);
        // Contact-tab redesign fields.
        setIf("preferences", "preferences" in updatedDetails, Array.isArray(updatedDetails.preferences) ? updatedDetails.preferences : []);
        setIf("notes", "notes" in updatedDetails, updatedDetails.notes?.trim() || null);
        setIf("work_address", "workAddress" in updatedDetails, updatedDetails.workAddress?.trim() || null);
        setIf("work_postcode", "workPostcode" in updatedDetails, updatedDetails.workPostcode?.trim() || null);

        const { error: customerError } = await (await loadSupabaseClient()).
        from("customers").
        update(payload).
        eq("id", jobData.customerId);

        if (customerError) {
          throw customerError;
        }

        // Only resync the denormalised jobs.customer name when the name changed.
        if ("firstName" in updatedDetails || "lastName" in updatedDetails) {
          const updatedName = `${updatedDetails.firstName ?? jobData.customerFirstName ?? ""} ${updatedDetails.lastName ?? jobData.customerLastName ?? ""}`.trim();

          const { error: jobError } = await (await loadSupabaseClient()).
          from("jobs").
          update({
            customer: updatedName || null
          }).
          eq("id", jobData.id);

          if (jobError) {
            throw jobError;
          }
        }

        await fetchJobData({ silent: true, force: true });
        revalidateAllJobs(); // sync customer changes to other pages
        return { success: true };
      } catch (saveError) {
        logFailure("Failed to update customer:", saveError);
        alert(saveError?.message || "Failed to update customer details");
        return { success: false, error: saveError };
      } finally {
        setCustomerSaving(false);
      }
    },
    [jobData, fetchJobData]
  );

  const handleAppointmentSave = useCallback(
    async (appointmentDetails) => {
      if (!canEdit || !jobData?.id) return { success: false };

      if (appointmentDetails?.cancelJob) {
        if (!jobData.appointment) {
          return { success: false, error: "Appointment not found" };
        }

        const confirmed = await confirm({
          title: null,
          message: "Cancel this appointment?",
          description: "The job will be marked as Cancelled and moved to the archived jobs section.",
          details: [
            { label: "Job", value: jobData.jobNumber || jobNumber, tone: "info" },
            { label: "Customer", value: jobData.customer || "N/A", tone: "success" },
            { label: "Vehicle", value: jobData.reg || "N/A", tone: "warning" },
            {
              label: "Appointment",
              value: [jobData.appointment.date, jobData.appointment.time].filter(Boolean).join(" at ") || "N/A",
              tone: "accent"
            }
          ],
          confirmLabel: "Confirm cancellation",
          cancelLabel: "Keep appointment"
        });

        if (!confirmed) return { success: false, cancelled: true };

        setAppointmentSaving(true);
        try {
          const cancelResult = await (await loadJobsDb()).cancelJobAppointment(
            jobData.id,
            jobData.appointment.appointmentId,
            dbUserId || user?.user_id || user?.id || null
          );
          if (!cancelResult?.success) {
            throw new Error(cancelResult?.error?.message || "Failed to cancel appointment");
          }

          const archiveResponse = await fetch("/api/jobcards/archive/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobNumber: jobData.jobNumber || jobNumber })
          });
          const archivePayload = await archiveResponse.json();
          if (!archiveResponse.ok || !archivePayload?.success) {
            throw new Error(archivePayload?.error || "Appointment cancelled, but the job could not be moved to archived jobs");
          }

          revalidateAllJobs();
          await router.push("/archive");
          return { success: true };
        } catch (cancelError) {
          logFailure("Failed to cancel appointment:", cancelError);
          alert(cancelError?.message || "Failed to cancel appointment");
          await fetchJobData({ silent: true, force: true });
          return { success: false, error: cancelError };
        } finally {
          setAppointmentSaving(false);
        }
      }

      if (!appointmentDetails.date || !appointmentDetails.time) {
        alert("Please provide both date and time.");
        return { success: false };
      }

      setAppointmentSaving(true);

      try {
        const scheduledTime = toAppointmentTimestamp(
          appointmentDetails.date,
          appointmentDetails.time
        );

        const payload = {
          scheduled_time: scheduledTime,
          status: appointmentDetails.status || "booked",
          notes: appointmentDetails.notes || null,
          updated_at: new Date().toISOString()
        };

        if (jobData.appointment?.appointmentId) {
          const { error } = await (await loadSupabaseClient()).
          from("appointments").
          update(payload).
          eq("appointment_id", jobData.appointment.appointmentId);

          if (error) {
            throw error;
          }
        } else {
          const insertPayload = {
            ...payload,
            job_id: jobData.id,
            customer_id: jobData.customerId || null
          };

          const { error } = await (await loadSupabaseClient()).
          from("appointments").
          insert([insertPayload]);

          if (error) {
            throw error;
          }
        }

        // When prime job (job 1) saves an appointment, sync to all sub-jobs
        if (jobData.isPrimeJob && Array.isArray(jobData.subJobs) && jobData.subJobs.length > 0) {
          for (const subJob of jobData.subJobs) {
            if (!subJob?.id) continue;
            try {
              const { data: existingAppt } = await (await loadSupabaseClient()).
              from("appointments").
              select("appointment_id").
              eq("job_id", subJob.id).
              maybeSingle();

              if (existingAppt?.appointment_id) {
                await (await loadSupabaseClient()).
                from("appointments").
                update(payload).
                eq("appointment_id", existingAppt.appointment_id);
              } else {
                await (await loadSupabaseClient()).
                from("appointments").
                insert([{
                  ...payload,
                  job_id: subJob.id,
                  customer_id: jobData.customerId || null
                }]);
              }
            } catch (subErr) {
              console.warn(`Warning: Failed to sync appointment to sub-job ${subJob.id}:`, subErr);
            }
          }
        }

        // Sync the job's status to "Booked" once the appointment row has been
        // written. Without this, jobs created with the legacy default status
        // "Open" stay on "Open" even after they're put on the appointment
        // calendar, which is why such a job appears in /appointments but its
        // header badge still reads "Open". Only fire this transition for jobs
        // that haven't moved past the pre-booked stage — autoSetBookedStatus
        // would otherwise overwrite Checked-In / In-Progress / Invoiced jobs.
        const currentJobStatus = String(jobData?.status || "").trim().toLowerCase();
        const PRE_BOOKED_STATUSES = new Set(["", "open", "pending", "new", "booked"]);
        if (PRE_BOOKED_STATUSES.has(currentJobStatus)) {
          try {
            const bookingActorId = dbUserId || user?.user_id || user?.id || null;
            await (await loadJobStatusService()).autoSetBookedStatus(jobData.id, bookingActorId);
            // Mirror the transition onto sub-jobs the prime job created
            // appointments for, so they stay in lockstep with the prime.
            if (jobData.isPrimeJob && Array.isArray(jobData.subJobs) && jobData.subJobs.length > 0) {
              for (const subJob of jobData.subJobs) {
                if (!subJob?.id) continue;
                const subStatus = String(subJob?.status || "").trim().toLowerCase();
                if (PRE_BOOKED_STATUSES.has(subStatus)) {
                  try {
                    await (await loadJobStatusService()).autoSetBookedStatus(subJob.id, bookingActorId);
                  } catch (subStatusErr) {
                    console.warn(`Warning: Failed to sync Booked status to sub-job ${subJob.id}:`, subStatusErr);
                  }
                }
              }
            }
          } catch (statusError) {
            console.warn("Warning: Failed to auto-set Booked status after appointment save:", statusError);
          }
        }

        await fetchJobData({ silent: true, force: true });
        revalidateAllJobs(); // sync appointment changes to other pages
        return { success: true };
      } catch (appointmentError) {
        logFailure("Failed to update appointment:", appointmentError);
        alert(appointmentError?.message || "Failed to update appointment");
        return { success: false, error: appointmentError };
      } finally {
        setAppointmentSaving(false);
      }
    },
    [canEdit, confirm, dbUserId, fetchJobData, jobData, jobNumber, router, user?.id, user?.user_id]
  );

  const handleAppointmentRebook = useCallback(
    async (appointmentDetails) => {
      if (!canEdit || !jobData?.id) return { success: false };

      if (!appointmentDetails.date || !appointmentDetails.time) {
        alert("Please provide both date and time before rebooking.");
        return { success: false };
      }

      const result = await handleAppointmentSave({
        ...appointmentDetails,
        status: appointmentDetails.status || "booked"
      });

      if (!result?.success) {
        return result;
      }

      const noteText = [
        `Rebooked job as a new appointment for ${appointmentDetails.date} at ${appointmentDetails.time}.`,
        jobData.appointment?.date && jobData.appointment?.time
          ? `Previous appointment was ${jobData.appointment.date} at ${jobData.appointment.time}.`
          : null,
        "Created from the Scheduling appointment panel."
      ].filter(Boolean).join(" ");

      const noteResult = await (await loadNotesDb()).createJobNote({
        job_id: jobData.id,
        user_id: dbUserId || user?.user_id || user?.id || null,
        note_text: noteText,
        hidden_from_customer: true
      });

      if (!noteResult?.success) {
        alert(noteResult?.error?.message || "Appointment booked, but the rebook note could not be saved.");
      } else {
        await refreshSharedNote(jobData.id);
        handleNoteAdded(noteResult.data?.note_id);
      }

      const query = new URLSearchParams({
        jobNumber: String(jobData.jobNumber || jobNumber),
        date: appointmentDetails.date,
        time: appointmentDetails.time,
        rebook: "1"
      });

      router.push(`/appointments?${query.toString()}`);
      return { success: true };
    },
    [
      canEdit,
      dbUserId,
      handleAppointmentSave,
      handleNoteAdded,
      jobData,
      jobNumber,
      refreshSharedNote,
      router,
      user?.id,
      user?.user_id
    ]
  );

  const handleBookingFlowSave = useCallback(
    async ({ vehicleId, description, waitingStatus }) => {
      if (!canEdit || !jobData?.id) return { success: false };

      setBookingFlowSaving(true);

      try {
        const normalizedVehicleId =
        typeof vehicleId === "string" ? Number(vehicleId) : vehicleId;

        const selectedVehicle =
        customerVehicles.find(
          (vehicle) => vehicle.vehicle_id === normalizedVehicleId
        ) || (
        jobData.vehicleId && jobData.vehicleId === normalizedVehicleId ?
        {
          vehicle_id: jobData.vehicleId,
          registration: jobData.reg,
          reg_number: jobData.reg,
          make_model: jobData.makeModel,
          make: jobData.make,
          model: jobData.model
        } :
        null);

        const updates = {
          description:
          description && description.trim().length > 0 ? description : null,
          waiting_status: waitingStatus || "Neither"
        };

        if (normalizedVehicleId && normalizedVehicleId !== jobData.vehicleId) {
          updates.vehicle_id = normalizedVehicleId;
          if (selectedVehicle) {
            const regValue = getVehicleRegistration(selectedVehicle) || null;
            if (regValue) {
              updates.vehicle_reg = regValue;
            }
            const derivedMakeModel =
            selectedVehicle.make_model ||
            [selectedVehicle.make, selectedVehicle.model].
            filter(Boolean).
            join(" ").
            trim();
            if (derivedMakeModel) {
              updates.vehicle_make_model = derivedMakeModel;
            }
          }
        }

        const result = await (await loadJobsDb()).updateJob(jobData.id, updates);

        if (!result?.success) {
          throw (
            result?.error || new Error("Failed to update booking details"));

        }

        setJobData((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            description: description || "",
            waitingStatus: updates.waiting_status || prev.waitingStatus
          };
          if (updates.vehicle_id) {
            next.vehicleId = updates.vehicle_id;
          }
          if (updates.vehicle_reg) {
            next.reg = updates.vehicle_reg;
          }
          if (selectedVehicle) {
            next.make = selectedVehicle.make || next.make;
            next.model = selectedVehicle.model || next.model;
            next.makeModel =
            updates.vehicle_make_model ||
            selectedVehicle.make_model ||
            next.makeModel;
          }
          return next;
        });

        if (
        normalizedVehicleId &&
        normalizedVehicleId !== jobData.vehicleId)
        {
          await fetchJobData({ silent: true, force: true });
        }

        try {
          const response = await fetch(
            `/api/job-cards/${jobData.jobNumber}/booking-request`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                vehicleId: normalizedVehicleId || jobData.vehicleId || null,
                waitingStatus: updates.waiting_status || "Neither",
                description,
                submittedBy: dbUserId || null,
                submittedByName:
                user?.username ||
                user?.name ||
                user?.fullName ||
                user?.email ||
                "Workshop User"
              })
            }
          );

          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload?.error || "Failed to log booking request");
          }

          if (payload?.bookingRequest) {
            setJobData((prev) =>
            prev ? { ...prev, bookingRequest: payload.bookingRequest } : prev
            );
          }
        } catch (requestError) {
          logFailure(
            "Warning: Booking request notifications failed:",
            requestError
          );
        }

        return { success: true };
      } catch (bookingError) {
        logFailure("Failed to save booking details:", bookingError);
        alert(bookingError?.message || "Failed to save booking details");
        return { success: false, error: bookingError };
      } finally {
        setBookingFlowSaving(false);
      }
    },
    [canEdit, jobData, customerVehicles, fetchJobData, dbUserId, user]
  );

  const handleMileageSave = useCallback(
    async ({ vehicleId, mileage }) => {
      if (!canEdit || !jobData?.id) return { success: false };

      const normalizedVehicleId =
      typeof vehicleId === "string" ? Number(vehicleId) : vehicleId;
      const targetVehicleId = normalizedVehicleId || jobData.vehicleId || null;

      if (!targetVehicleId) {
        return {
          success: false,
          error: new Error("No vehicle selected for mileage update.")
        };
      }

      try {
        const normalizedInput =
        mileage === null || mileage === undefined ?
        "" :
        String(mileage).trim();
        const resolvedCurrentMileage = pickMileageValue(jobData?.mileage, jobData?.milage, linkedVehicleMileage);
        const currentDbMileageValue =
        resolvedCurrentMileage === null || resolvedCurrentMileage === undefined ?
        "" :
        String(resolvedCurrentMileage).trim();

        if (normalizedInput === currentDbMileageValue) {
          return { success: true, skipped: true };
        }

        let normalizedMileage = null;
        if (normalizedInput !== "") {
          const parsedMileage = Number(normalizedInput);
          if (!Number.isInteger(parsedMileage) || parsedMileage < 0) {
            throw new Error("Mileage must be a whole number greater than or equal to 0.");
          }
          normalizedMileage = parsedMileage;

          const resolvedRegRaw =
          jobData?.reg ||
          jobData?.vehicleReg ||
          jobData?.vehicle_reg ||
          "";
          const resolvedReg = String(resolvedRegRaw).trim().toUpperCase();
          const compactReg = resolvedReg.replace(/\s+/g, "");
          let latestPreviousJobMileage = null;

          if (compactReg) {
            const regCandidates = Array.from(
              new Set([resolvedReg, compactReg].map((value) => String(value || "").trim()).filter(Boolean))
            );
            const { data: historicalRows, error: historicalError } = await (await loadSupabaseClient()).
            from("jobs").
            select("id, vehicle_reg, milage, created_at").
            in("vehicle_reg", regCandidates).
            not("milage", "is", null).
            neq("id", jobData.id).
            order("created_at", { ascending: false });

            if (historicalError) {
              throw historicalError;
            }

            const matchedRows = (Array.isArray(historicalRows) ? historicalRows : []).filter((row) => {
              const rowReg = String(row?.vehicle_reg || "").replace(/\s+/g, "").toUpperCase();
              return rowReg === compactReg;
            });

            for (const row of matchedRows) {
              const parsed = Number(row?.milage);
              if (!Number.isFinite(parsed)) continue;
              latestPreviousJobMileage = parsed;
              break;
            }
          }

          const minimumAllowedMileage = Number.isFinite(latestPreviousJobMileage) ?
          latestPreviousJobMileage :
          null;

          if (minimumAllowedMileage !== null && normalizedMileage < minimumAllowedMileage) {
            return {
              success: false,
              error: new Error(
                `Mileage cannot be lower than the last recorded mileage (${minimumAllowedMileage}) for this registration.`
              ),
              minimumMileage: minimumAllowedMileage
            };
          }
        }

        const { data: updatedVehicleRow, error: vehicleUpdateError } = await (await loadSupabaseClient()).
        from("vehicles").
        update({
          mileage: normalizedMileage,
          updated_at: new Date().toISOString()
        }).
        eq("vehicle_id", targetVehicleId).
        select("mileage").
        single();

        if (vehicleUpdateError) {
          throw vehicleUpdateError;
        }

        const persistedMileage =
        updatedVehicleRow?.mileage === null || updatedVehicleRow?.mileage === undefined ?
        null :
        Number(updatedVehicleRow.mileage);

        const { error: jobMileageError } = await (await loadSupabaseClient()).
        from("jobs").
        update({ milage: persistedMileage }).
        eq("id", jobData.id);

        if (jobMileageError) {
          logFailure("Failed to update milage on job:", jobMileageError);
        }

        setJobData((prev) =>
        prev ?
        { ...prev, mileage: persistedMileage ?? "", milage: persistedMileage } :
        prev
        );

        setCustomerVehicles((prev) =>
        (Array.isArray(prev) ? prev : []).map((vehicle) =>
        vehicle?.vehicle_id === targetVehicleId ?
        { ...vehicle, mileage: persistedMileage } :
        vehicle
        )
        );

        setVehicleMileageInput(persistedMileage === null ? "" : String(persistedMileage));

        return { success: true };
      } catch (mileageError) {
        logFailure("Failed to save mileage:", mileageError);
        return { success: false, error: mileageError };
      }
    },
    [
    canEdit,
    jobData?.id,
    jobData?.vehicleId,
    jobData?.reg,
    jobData?.vehicleReg,
    jobData?.vehicle_reg,
    linkedVehicleMileage]

  );

  useEffect(() => {
    if (!canEdit || !jobData?.vehicleId) return;
    if (!mileageInputDirtyRef.current) return;

    const trimmed = vehicleMileageInput.trim();
    const resolvedSavedMileage = pickMileageValue(jobData?.mileage, jobData?.milage, linkedVehicleMileage);
    const savedMileageValue =
    resolvedSavedMileage === null || resolvedSavedMileage === undefined ?
    "" :
    String(resolvedSavedMileage).trim();

    if (trimmed === savedMileageValue) return;

    if (trimmed !== "") {
      const parsedMileage = Number(trimmed);
      if (!Number.isInteger(parsedMileage) || parsedMileage < 0) {
        return;
      }
    }

    if (mileageAutoSaveRef.current) {
      clearTimeout(mileageAutoSaveRef.current);
    }

    mileageAutoSaveRef.current = setTimeout(async () => {
      const result = await handleMileageSave({
        vehicleId: jobData?.vehicleId || null,
        mileage: trimmed
      });
      if (result?.success) {
        mileageInputDirtyRef.current = false;
        return;
      }
      if (result?.minimumMileage !== undefined && result?.minimumMileage !== null) {
        alert(result?.error?.message || "Mileage cannot be lower than the last recorded value.");
        setVehicleMileageInput(String(result.minimumMileage));
        mileageInputDirtyRef.current = false;
      }
    }, 450);
  }, [canEdit, vehicleMileageInput, jobData?.mileage, jobData?.milage, jobData?.vehicleId, linkedVehicleMileage, handleMileageSave]);

  const handleBookingApproval = useCallback(
    async ({
      priceEstimate,
      estimatedCompletion,
      loanCarDetails,
      confirmationMessage
    }) => {
      if (!canEdit || !jobData?.jobNumber) return { success: false };

      setBookingApprovalSaving(true);

      try {
        const response = await fetch(
          `/api/job-cards/${jobData.jobNumber}/booking-request`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              priceEstimate,
              estimatedCompletion,
              loanCarDetails,
              confirmationMessage,
              approvedBy: dbUserId || null,
              approvedByName:
              user?.username ||
              user?.name ||
              user?.fullName ||
              user?.email ||
              "Workshop User"
            })
          }
        );

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to approve booking");
        }

        if (payload?.bookingRequest) {
          setJobData((prev) =>
          prev ? { ...prev, bookingRequest: payload.bookingRequest } : prev
          );
        }

        return { success: true };
      } catch (approvalError) {
        logFailure("Failed to approve booking:", approvalError);
        alert(approvalError?.message || "Failed to approve booking");
        return { success: false, error: approvalError };
      } finally {
        setBookingApprovalSaving(false);
      }
    },
    [canEdit, jobData?.jobNumber, dbUserId, user]
  );

  const handleCreateInvoice = useCallback(async () => {
    if (!canEdit || !jobData?.id) return;
    setCreatingInvoice(true);
    try {
      const detailResponse = await fetch(
        `/api/invoices/by-job/${encodeURIComponent(jobData.jobNumber)}`,
        { credentials: "include", cache: "no-store" }
      );
      const detailPayload = await detailResponse.json();
      if (!detailResponse.ok || !detailPayload?.success || !detailPayload?.data) {
        throw new Error(detailPayload?.message || "Failed to load proforma data");
      }

      if (!detailPayload.data?.meta?.isProforma) {
        await fetchJobData({ silent: true, force: true });
        await loadStatusSnapshot(jobData.id);
        return;
      }

      const liveInvoiceData = detailPayload.data;
      const structuredRequests = Array.isArray(liveInvoiceData?.requests) ?
      liveInvoiceData.requests :
      [];
      const totals = liveInvoiceData?.invoice?.totals || {};
      const derivedPartsTotal = structuredRequests.reduce((sum, request) => {
        const requestNet = Number(request?.totals?.request_total_net || 0);
        const labourNet = Number(request?.labour?.net || 0);
        return sum + Math.max(requestNet - labourNet, 0);
      }, 0);
      const derivedLabourTotal = structuredRequests.reduce(
        (sum, request) => sum + Number(request?.labour?.net || 0),
        0
      );

      const response = await fetch("/api/invoices/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jobId: jobData.id,
          jobNumber: jobData.jobNumber,
          customerId: jobData.customerId,
          customerEmail: jobData.customerEmail,
          totals: {
            partsTotal: derivedPartsTotal,
            labourTotal: derivedLabourTotal,
            vatTotal: Number(totals.vat_total || 0),
            total: Number(totals.invoice_total || 0)
          },
          structuredRequests
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to create invoice");
      }

      await (await loadJobStatusService()).logJobSubStatus(
        jobData.id,
        "Pricing Completed",
        dbUserId || null,
        "Invoice created"
      );
      await (await loadJobStatusService()).logJobSubStatus(
        jobData.id,
        "Ready for Invoice",
        dbUserId || null,
        "Live invoice created"
      );
      const statusResult = await (await loadJobsDb()).updateJobStatus(jobData.id, "Invoiced");
      if (!statusResult?.success) {
        throw new Error(
          statusResult?.error?.message ||
          statusResult?.error ||
          "Invoice created but failed to update job status"
        );
      }
      await fetchJobData({ silent: true, force: true });
      await loadStatusSnapshot(jobData.id);
      setInvoiceViewState((prev) => ({
        ...prev,
        exists: true,
        isProforma: false
      }));

      // Redirect to invoice tab after successful invoice creation
      router.push(`/job-cards/${jobData.jobNumber}?tab=invoice`);
    } catch (createError) {
      logFailure("Failed to trigger invoice creation:", createError);
      alert(createError?.message || "Failed to trigger invoice creation");
    } finally {
      setCreatingInvoice(false);
    }
  }, [canEdit, fetchJobData, jobData, loadStatusSnapshot, dbUserId, router]);

  const handleInvoicePaymentCompleted = useCallback(async () => {
    if (!jobData?.id) {
      return { success: false, error: "Job not found" };
    }
    await fetchJobData({ silent: true, force: true });
    revalidateAllJobs(); // sync status changes to other pages
    await loadStatusSnapshot(jobData.id);
    return { success: true };
  }, [fetchJobData, jobData?.id, loadStatusSnapshot]);

  const handleReleaseJob = useCallback(async () => {
    if (!jobData?.id) {
      return { success: false, error: "Job not found" };
    }

    const statusResult = await (await loadJobsDb()).updateJobStatus(jobData.id, "Released");
    if (!statusResult?.success) {
      return {
        success: false,
        error:
        statusResult?.error?.message ||
        statusResult?.error ||
        "Failed to release job"
      };
    }

    setJobData((prev) => prev ? { ...prev, status: "Released" } : prev);
    setStatusSnapshot((prev) =>
    prev ?
    {
      ...prev,
      job: prev.job ?
      {
        ...prev.job,
        overallStatus: JOB_STATUSES.RELEASED,
        statusLabel: "Released",
        updatedAt: new Date().toISOString()
      } :
      prev.job
    } :
    prev
    );

    await fetchJobData({ silent: true, force: true });
    revalidateAllJobs(); // sync release to other pages
    await loadStatusSnapshot(jobData.id);
    await router.push("/newsfeed");
    return { success: true };
  }, [fetchJobData, jobData?.id, loadStatusSnapshot, router]);

  const handleArchiveJob = useCallback(async () => {
    if (!jobData?.jobNumber) {
      return { success: false, error: "Job number missing" };
    }
    const confirmed = await confirm({
      title: null,
      message: `Archive job ${jobData.jobNumber}?`,
      details: [
      { label: "Customer", value: jobData.customer || "N/A", tone: "info" },
      { label: "Vehicle", value: jobData.reg || "N/A", tone: "warning" }],

      confirmLabel: "Archive Job",
      cancelLabel: "Cancel",
      tone: "warning"
    });
    if (!confirmed) return { success: false, cancelled: true };
    try {
      const response = await fetch("/api/jobcards/archive/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobNumber: jobData.jobNumber })
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        const message = payload?.error || "Failed to archive job";
        alert(message);
        return { success: false, error: message };
      }
      revalidateAllJobs(); // sync archive to other pages
      await router.push("/newsfeed");
      return { success: true };
    } catch (error) {
      logFailure("Archive job failed:", error);
      alert(error.message || "Failed to archive job");
      return { success: false, error: error.message };
    }
  }, [alert, confirm, jobData?.customer, jobData?.jobNumber, jobData?.reg, router]);

  const handleDeleteDocument = useCallback(
    async (file) => {
      if (!canManageDocuments || !file?.id) return;
      const confirmDelete = await confirm(`Delete ${file.name || "this file"}?`);
      if (!confirmDelete) return;

      try {
        const storagePath = deriveStoragePathFromUrl(file.url);
        if (storagePath) {
          const { error: removeError } = await (await loadSupabaseClient()).storage.
          from(JOB_DOCUMENT_BUCKET).
          remove([storagePath]);
          if (removeError) {
            console.warn("Warning: Failed to remove file from storage:", removeError);
          }
        }

        const result = await (await loadJobsDb()).deleteJobFile(file.id);
        if (!result?.success) {
          alert(result?.error?.message || "Failed to delete document");
          return;
        }

        // Job tracker logging — non-blocking.
        try {
          const mime = String(file.type || file.mimeType || file.name || "").toLowerCase();
          const kind = mime.startsWith("image") || /\.(jpe?g|png|gif|webp|heic)$/.test(mime) ?
          "Photo" :
          mime.startsWith("video") || /\.(mp4|mov|avi|mkv|webm)$/.test(mime) ?
          "Video" :
          "Document";
          await logJobActivityClient({
            jobId: jobData?.id || null,
            jobNumber,
            category: "files",
            action: "deleted",
            summary: `${kind} deleted: ${file.name || "(unnamed)"}`,
            targetType: "job_file",
            targetId: String(file.id),
            payload: { fileName: file.name || null, fileType: file.type || null }
          });
        } catch {}

        setJobDocuments((prev) => prev.filter((doc) => doc.id !== file.id));
        setJobData((prev) =>
        prev ?
        { ...prev, files: (prev.files || []).filter((doc) => doc.id !== file.id) } :
        prev
        );
      } catch (deleteError) {
        logFailure("Failed to delete document:", deleteError);
        alert(deleteError?.message || "Failed to delete document");
      }
    },
    [canManageDocuments, confirm, jobData?.id, jobNumber]
  );

  const saveSharedNote = useCallback(
    async (value) => {
      if (!jobData?.id) return;

      try {
        setSharedNoteSaving(true);
        const draftValue = typeof value === "string" ? value : "";
        const isEmpty = draftValue.trim().length === 0;

        if (isEmpty && sharedNoteMeta?.noteId) {
          const deleteResult = await (await loadNotesDb()).deleteJobNote(
            sharedNoteMeta.noteId,
            user?.user_id || null
          );
          if (!deleteResult?.success) {
            throw deleteResult?.error || new Error("Failed to delete note");
          }
          setSharedNote("");
          setSharedNoteMeta(null);
          return;
        }

        if (isEmpty) {
          return;
        }

        if (sharedNoteMeta?.noteId) {
          const updateResult = await (await loadNotesDb()).updateJobNote(
            sharedNoteMeta.noteId,
            draftValue,
            user?.user_id || null
          );

          if (!updateResult?.success) {
            throw updateResult?.error || new Error("Failed to update note");
          }
        } else {
          const createResult = await (await loadNotesDb()).createJobNote({
            job_id: jobData.id,
            user_id: user?.user_id || null,
            note_text: draftValue
          });

          if (!createResult?.success) {
            throw createResult?.error || new Error("Failed to create note");
          }
        }

        const latest = await fetchSharedNote(jobData.id);
        setSharedNote(latest?.noteText || "");
        setSharedNoteMeta(latest);
      } catch (saveError) {
        logFailure("Failed to save note:", saveError);
        alert(saveError?.message || "Failed to save note");
      } finally {
        setSharedNoteSaving(false);
      }
    },
    [jobData?.id, sharedNoteMeta?.noteId, user?.user_id, fetchSharedNote]
  );

  const handleSharedNoteChange = useCallback((value) => {
    if (!canEdit) return;
    setSharedNote(value);

    if (sharedNoteSaveRef.current) {
      clearTimeout(sharedNoteSaveRef.current);
    }

    sharedNoteSaveRef.current = setTimeout(() => {
      if (value === (sharedNoteMeta?.noteText || "")) {
        return;
      }
      saveSharedNote(value);
    }, 300);
  }, [canEdit, saveSharedNote, sharedNoteMeta?.noteText]);

  // Update Job Request Handler
  const handleUpdateRequests = async (updatedRequests) => {
    if (!canEdit || !jobData?.id) return;

    try {
      const customerRequestInput = Array.isArray(updatedRequests) ?
      updatedRequests :
      Array.isArray(updatedRequests?.customerRequests) ?
      updatedRequests.customerRequests :
      [];
      const authorisedRequestInput = Array.isArray(updatedRequests?.authorisedRows) ?
      updatedRequests.authorisedRows :
      [];

      const normalized = customerRequestInput.map((entry, index) => ({
        requestId: entry.requestId ?? entry.request_id ?? null,
        presetId: entry.presetId ?? entry.job_request_preset_id ?? null,
        text: entry.text ?? entry.description ?? "",
        time: entry.time ?? entry.hours ?? "",
        paymentType: entry.paymentType ?? entry.jobType ?? "Customer",
        noteText: entry.noteText ?? entry.note_text ?? null,
        prePickLocation: entry.prePickLocation ?? entry.pre_pick_location ?? null,
        labourPrice: entry.labourPrice ?? "",
        menuPrice: entry.menuPrice ?? "",
        setPrice: entry.setPrice ?? entry.price ?? "",
        discount: entry.discount ?? "",
        specialRate: Boolean(entry.specialRate),
        sortOrder: index + 1
      }));

      const syncResult = await (await loadJobsDb()).upsertJobRequestsForJob(jobData.id, normalized);
      if (!syncResult?.success) {
        throw syncResult?.error || new Error("Failed to update job requests");
      }

      const authorisedRowsToUpdate = authorisedRequestInput.
      map((entry) => ({
        requestId: entry.requestId ?? entry.request_id ?? null,
        vhcItemId: entry.vhcItemId ?? entry.vhc_item_id ?? null,
        text: entry.text ?? entry.description ?? "",
        time: entry.time ?? entry.hours ?? null,
        noteText: entry.noteText ?? entry.note_text ?? null,
        prePickLocation: entry.prePickLocation ?? entry.pre_pick_location ?? null,
        paymentType: entry.paymentType ?? entry.jobType ?? "Customer"
      })).
      filter((row) => row.requestId || row.vhcItemId);

      if (authorisedRowsToUpdate.length > 0) {
        const vhcItemIds = authorisedRowsToUpdate.
        map((row) => row.vhcItemId).
        filter((value) => value !== null && value !== undefined);

        let existingVhcRequestRows = [];
        if (vhcItemIds.length > 0) {
          const { data: existingRows, error: existingRowsError } = await (await loadSupabaseClient()).
          from("job_requests").
          select("request_id, vhc_item_id").
          eq("job_id", jobData.id).
          in("vhc_item_id", vhcItemIds);

          if (existingRowsError) throw existingRowsError;
          existingVhcRequestRows = Array.isArray(existingRows) ? existingRows : [];
        }

        const existingByVhcItemId = new Map();
        existingVhcRequestRows.forEach((row) => {
          if (row?.vhc_item_id === null || row?.vhc_item_id === undefined) return;
          existingByVhcItemId.set(String(row.vhc_item_id), row);
        });

        for (const row of authorisedRowsToUpdate) {
          const timestamp = new Date().toISOString();
          const resolvedRequestId =
          row.requestId ?? (
          row.vhcItemId !== null && row.vhcItemId !== undefined ?
          existingByVhcItemId.get(String(row.vhcItemId))?.request_id ?? null :
          null);

          if (resolvedRequestId) {
            const { error: updateVhcRequestError } = await (await loadSupabaseClient()).
            from("job_requests").
            update({
              job_type: row.paymentType,
              updated_at: timestamp
            }).
            eq("job_id", jobData.id).
            eq("request_id", resolvedRequestId);

            if (updateVhcRequestError) throw updateVhcRequestError;
            continue;
          }

          if (row.vhcItemId === null || row.vhcItemId === undefined) {
            continue;
          }

          const insertPayload = {
            job_id: jobData.id,
            description: row.text || `VHC authorised item ${row.vhcItemId}`,
            hours:
            row.time === null || row.time === undefined || row.time === "" ?
            null :
            row.time,
            job_type: row.paymentType,
            status: "inprogress",
            request_source: "vhc_authorised",
            vhc_item_id: row.vhcItemId,
            note_text: row.noteText || null,
            pre_pick_location: row.prePickLocation || null,
            created_at: timestamp,
            updated_at: timestamp
          };

          const { data: insertedVhcRequest, error: insertVhcRequestError } = await (await loadSupabaseClient()).
          from("job_requests").
          insert([insertPayload]).
          select("request_id").
          single();

          if (insertVhcRequestError) throw insertVhcRequestError;

          if (insertedVhcRequest?.request_id) {
            await (await loadSupabaseClient()).
            from("vhc_checks").
            update({ request_id: insertedVhcRequest.request_id, updated_at: timestamp }).
            eq("job_id", jobData.id).
            eq("vhc_id", row.vhcItemId);
          }
        }
      }

      const requestPayload = normalized.map((entry) => ({
        text: entry.text,
        time: entry.time,
        paymentType: entry.paymentType,
        labourPrice: entry.labourPrice,
        menuPrice: entry.menuPrice,
        setPrice: entry.setPrice,
        discount: entry.discount,
        specialRate: entry.specialRate,
        noteText: entry.noteText
      }));

      const result = await (await loadJobsDb()).updateJob(jobData.id, {
        requests: requestPayload
      });

      if (!result?.success) {
        throw result?.error || new Error("Failed to update job requests");
      }

      setJobData((prev) =>
      prev ? { ...prev, requests: requestPayload } : prev
      );
      await fetchJobData({ silent: true, force: true });
      await loadClockingEntries();
      alert("Job requests updated successfully");
    } catch (error) {
      logFailure("Error updating requests:", error);
      alert("Failed to update job requests");
    }
  };

  // Load per-request clocking totals for the Customer Requests tab.
  const loadClockingEntries = useCallback(async () => {
    if (!jobData?.id) {
      setClockingEntries([]);
      return;
    }
    try {
      const entries = await (await loadJobClockingDb()).getJobClockingEntries(jobData.id);
      setClockingEntries(Array.isArray(entries) ? entries : []);
    } catch (error) {
      logFailure("Failed to load clocking entries", error);
      setClockingEntries([]);
    }
  }, [jobData?.id]);

  useEffect(() => {
    loadClockingEntries();
  }, [loadClockingEntries]);

  // Mark a single request complete / change its status (Customer Requests tab).
  // upsertJobRequestsForJob never writes `status`, so this uses the dedicated
  // single-row updater and then refreshes the job + clocking data.
  const handleUpdateRequestStatus = async (requestId, nextStatus) => {
    if (!canEdit || !requestId) return;
    try {
      const result = await (await loadJobsDb()).updateJobRequestStatus(requestId, nextStatus);
      if (!result?.success) {
        throw result?.error || new Error("Failed to update request status");
      }
      await revalidateAllJobs();
      await fetchJobData({ silent: true, force: true });
      await loadClockingEntries();
    } catch (error) {
      logFailure("Error updating request status:", error);
      alert("Failed to update request status");
    }
  };

  // Inline save for the per-request Fault Reported / Diagnosis / Rectification
  // text boxes and the Customer Approved toggle on the Customer Requests tab
  // detail panel. Only the changed fields are passed through.
  const handleSaveRequestWorkDetails = async (requestId, fields = {}) => {
    if (!canEdit || !requestId) return;
    try {
      const result = await (await loadJobsDb()).updateJobRequestWorkDetails(requestId, fields);
      if (!result?.success) {
        throw result?.error || new Error("Failed to save request details");
      }
      await fetchJobData({ silent: true, force: true });
    } catch (error) {
      logFailure("Error saving request work details:", error);
      alert("Failed to save request details");
    }
  };

  // "Mark All Complete" on the Customer Requests tab summary — sets every
  // request row for this job to completed in one write.
  const handleMarkAllRequestsComplete = async () => {
    if (!canEdit || !jobData?.id) return;
    try {
      const result = await (await loadJobsDb()).markAllJobRequestsComplete(jobData.id);
      if (!result?.success) {
        throw result?.error || new Error("Failed to mark all requests complete");
      }
      await revalidateAllJobs();
      await fetchJobData({ silent: true, force: true });
      await loadClockingEntries();
    } catch (error) {
      logFailure("Error marking all requests complete:", error);
      alert("Failed to mark all requests complete");
    }
  };

  // Write-up tab save bridge. The WriteUpWorkspace (which replaced WriteUpForm)
  // routes request completion through job_writeups so invoice gating and the
  // per-request "Completed" status keep working. saveWriteUpToDatabase writes
  // both job_writeups (completion_status + task_checklist + aggregated
  // fault/cause/rectification) and job_requests.status, then we refetch.
  const handleSaveWriteUp = async (writeUpData) => {
    if (!canEdit || !jobData?.id) {
      return { success: false, error: "Write-up editing is unavailable" };
    }
    try {
      const result = await (await loadJobsDb()).saveWriteUpToDatabase(jobData?.jobNumber || jobNumber, writeUpData);
      if (!result?.success) {
        throw result?.error || new Error("Failed to save write-up");
      }
      // The /jobs page uses its own jobs-list cache. Clear it immediately so
      // navigating back shows the exact request status just persisted here.
      await revalidateAllJobs();
      await fetchJobData({ silent: true, force: true });
      await loadClockingEntries();
      return result;
    } catch (error) {
      logFailure("Error saving write-up:", error);
      throw error instanceof Error ? error : new Error(String(error || "Failed to save write-up"));
    }
  };

  const handleUpdateRequestPrePickLocation = async (requestRow, prePickLocation) => {
    // DEPRECATED / RETIRED. Pre-pick location is now a single source of truth on
    // parts_job_items.pre_pick_location, set per-part from the Parts tab "Part
    // Details" popup (/api/parts/update-status). Request rows are read-only
    // mirrors, so this request-level writer (which used to fan out to
    // job_requests / vhc_checks via /api/vhc/pre-pick-location) is no longer
    // wired to any UI. Kept as a no-op to preserve the prop contract through the
    // page shell without reintroducing a second write path. The original
    // request-level fan-out below is retained (unreachable) for reference only.
    return;

    if (!canEdit || !jobData?.id) return;

    const requestId = requestRow?.requestId ?? requestRow?.request_id ?? null;
    const vhcItemId = requestRow?.vhcItemId ?? requestRow?.vhc_item_id ?? null;
    const normalizedRequestId =
    requestId === null || requestId === undefined || requestId === "" ?
    null :
    String(requestId).trim();
    const normalizedPrePickLocation = normalizePrePickLocation(prePickLocation);

    if (!normalizedRequestId && (vhcItemId === null || vhcItemId === undefined || vhcItemId === "")) {
      return;
    }

    try {
      const response = await fetch("/api/vhc/pre-pick-location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: jobData.id,
          requestId: normalizedRequestId,
          vhcItemId,
          prePickLocation: normalizedPrePickLocation
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || payload?.details || "Failed to update pre-pick location");
      }

      const linkedVhcIds = new Set(
        (Array.isArray(payload?.linkedVhcItemIds) ? payload.linkedVhcItemIds : []).
        map((value) => String(value).trim()).
        filter(Boolean)
      );
      const normalizedVhcItemId =
      vhcItemId === null || vhcItemId === undefined || vhcItemId === "" ?
      "" :
      String(vhcItemId).trim();
      if (normalizedVhcItemId) {
        linkedVhcIds.add(normalizedVhcItemId);
      }
      const nextRequestId =
      payload?.requestId === null || payload?.requestId === undefined || payload?.requestId === "" ?
      normalizedRequestId :
      String(payload.requestId).trim();
      const nextPartStatus =
      normalizedPrePickLocation === "on_order" ?
      "on_order" :
      normalizedPrePickLocation ?
      "pre_picked" :
      "pending";
      const nextStockStatus =
      normalizedPrePickLocation === "on_order" ?
      "no_stock" :
      normalizedPrePickLocation ?
      "in_stock" :
      null;

      setJobData((prev) => {
        if (!prev) return prev;
        const updateRequestList = (rows) =>
        Array.isArray(rows) ?
        (() => {
          let matchedAny = false;
          const nextRows = rows.map((row) => {
            const rowRequestId = row?.requestId ?? row?.request_id ?? null;
            const rowVhcId = row?.vhcItemId ?? row?.vhc_item_id ?? null;
            const matchesRequest =
            nextRequestId !== null &&
            nextRequestId !== undefined &&
            nextRequestId !== "" &&
            String(rowRequestId) === String(nextRequestId);
            const matchesVhc =
            rowVhcId !== null &&
            rowVhcId !== undefined &&
            linkedVhcIds.has(String(rowVhcId).trim());
            if (!matchesRequest && !matchesVhc) return row;
            matchedAny = true;
            return {
              ...row,
              requestId: row?.requestId ?? row?.request_id ?? nextRequestId ?? null,
              request_id: row?.request_id ?? row?.requestId ?? nextRequestId ?? null,
              vhcItemId: row?.vhcItemId ?? row?.vhc_item_id ?? normalizedVhcItemId ?? null,
              vhc_item_id: row?.vhc_item_id ?? row?.vhcItemId ?? normalizedVhcItemId ?? null,
              prePickLocation: normalizedPrePickLocation,
              pre_pick_location: normalizedPrePickLocation
            };
          });

          if (matchedAny || nextRequestId === null || nextRequestId === undefined || nextRequestId === "") {
            return nextRows;
          }

          return [
          ...nextRows,
          {
            requestId: nextRequestId,
            request_id: nextRequestId,
            jobId: jobData.id,
            job_id: jobData.id,
            description:
            requestRow?.description ||
            requestRow?.label ||
            requestRow?.text ||
            `VHC Item ${normalizedVhcItemId || ""}`,
            hours: null,
            jobType: requestRow?.jobType ?? requestRow?.job_type ?? "Customer",
            job_type: requestRow?.jobType ?? requestRow?.job_type ?? "Customer",
            sortOrder: 0,
            sort_order: 0,
            status: requestRow?.status || "inprogress",
            requestSource: "vhc_authorised",
            request_source: "vhc_authorised",
            vhcItemId: normalizedVhcItemId || null,
            vhc_item_id: normalizedVhcItemId || null,
            prePickLocation: normalizedPrePickLocation,
            pre_pick_location: normalizedPrePickLocation,
            noteText: requestRow?.noteText ?? requestRow?.note_text ?? "",
            note_text: requestRow?.noteText ?? requestRow?.note_text ?? ""
          }];

        })() :
        rows;

        const updateAuthorised = (rows) =>
        Array.isArray(rows) ?
        rows.map((row) => {
          const rowVhcId = row?.vhcItemId ?? row?.vhc_item_id ?? null;
          const matchesVhc =
          rowVhcId !== null &&
          rowVhcId !== undefined &&
          linkedVhcIds.has(String(rowVhcId).trim());
          const matchesRequest =
          nextRequestId !== null &&
          nextRequestId !== undefined &&
          nextRequestId !== "" &&
          String(row?.requestId ?? row?.request_id ?? "") === String(nextRequestId);
          if (!matchesVhc && !matchesRequest) return row;
          return {
            ...row,
            requestId: row?.requestId ?? row?.request_id ?? nextRequestId ?? null,
            request_id: row?.request_id ?? row?.requestId ?? nextRequestId ?? null,
            prePickLocation: normalizedPrePickLocation,
            pre_pick_location: normalizedPrePickLocation
          };
        }) :
        rows;
        const updateVhcChecks = (rows) =>
        Array.isArray(rows) ?
        rows.map((row) => {
          const rowVhcId = row?.vhc_id ?? row?.vhcItemId ?? row?.vhc_item_id ?? null;
          const rowRequestId = row?.request_id ?? row?.requestId ?? null;
          const matchesRequest =
          nextRequestId !== null &&
          nextRequestId !== undefined &&
          nextRequestId !== "" &&
          String(rowRequestId) === String(nextRequestId);
          const matchesVhc =
          rowVhcId !== null &&
          rowVhcId !== undefined &&
          linkedVhcIds.has(String(rowVhcId).trim());
          if (!matchesRequest && !matchesVhc) return row;
          return {
            ...row,
            requestId: row?.requestId ?? row?.request_id ?? nextRequestId ?? null,
            request_id: row?.request_id ?? row?.requestId ?? nextRequestId ?? null,
            prePickLocation: normalizedPrePickLocation,
            pre_pick_location: normalizedPrePickLocation
          };
        }) :
        rows;
        const updatePartsJobItems = (rows) =>
        Array.isArray(rows) ?
        rows.map((row) => {
          const rowVhcId = row?.vhc_item_id ?? row?.vhcItemId ?? null;
          const rowRequestId =
          row?.allocatedToRequestId ??
          row?.allocated_to_request_id ??
          row?.request_id ??
          row?.requestId ??
          null;
          const matchesRequest =
          nextRequestId !== null &&
          nextRequestId !== undefined &&
          nextRequestId !== "" &&
          String(rowRequestId) === String(nextRequestId);
          const matchesVhc =
          rowVhcId !== null &&
          rowVhcId !== undefined &&
          linkedVhcIds.has(String(rowVhcId).trim());
          if (!matchesRequest && !matchesVhc) return row;
          return {
            ...row,
            requestId: row?.requestId ?? row?.request_id ?? nextRequestId ?? null,
            request_id: row?.request_id ?? row?.requestId ?? nextRequestId ?? null,
            vhcItemId: row?.vhcItemId ?? row?.vhc_item_id ?? normalizedVhcItemId ?? null,
            vhc_item_id: row?.vhc_item_id ?? row?.vhcItemId ?? normalizedVhcItemId ?? null,
            prePickLocation: normalizedPrePickLocation,
            pre_pick_location: normalizedPrePickLocation,
            status: nextPartStatus,
            stockStatus: nextStockStatus,
            stock_status: nextStockStatus
          };
        }) :
        rows;

        return {
          ...prev,
          jobRequests: updateRequestList(prev.jobRequests),
          job_requests: updateRequestList(prev.job_requests),
          authorizedVhcItems: updateAuthorised(prev.authorizedVhcItems),
          vhcChecks: updateVhcChecks(prev.vhcChecks),
          partsJobItems: updatePartsJobItems(prev.partsJobItems),
          parts_job_items: updatePartsJobItems(prev.parts_job_items),
          partsAllocations: updatePartsJobItems(prev.partsAllocations)
        };
      });

      await fetchJobData({ silent: true, force: true });
    } catch (error) {
      logFailure("Error updating request pre-pick location:", error);
      throw error;
    }
  };

  const handleToggleVhcRequired = async (nextValue) => {
    if (!canEdit || !jobData?.id) return;

    if (!nextValue) {
      const confirmed = await confirm(
        "Mark the VHC as not required for this job? Technicians will see this immediately."
      );
      if (!confirmed) return;
    }

    try {
      const result = await (await loadJobsDb()).updateJob(jobData.id, {
        vhc_required: nextValue
      });

      if (result.success) {
        setJobData((prev) => prev ? { ...prev, vhcRequired: nextValue } : prev);
        alert(nextValue ? "VHC marked as required" : "VHC marked as not required");
      } else {
        alert(result?.error?.message || "Failed to update VHC requirement");
      }
    } catch (toggleError) {
      logFailure("Error updating VHC requirement:", toggleError);
      alert("Failed to update VHC requirement");
    }
  };

  // VHC Financial Totals (calculated from vhcChecks or received from VhcDetailsPanel)
  const vhcFinancialTotals = useMemo(() => {
    // Return null values if jobData is not loaded yet
    if (!jobData) {
      return { authorized: null, declined: null };
    }

    // If VHC tab has been loaded and sent totals, use those (more accurate with real-time updates)
    // Otherwise, calculate from jobData.vhcChecks (allows showing totals before VHC tab is loaded)
    if (vhcFinancialTotalsFromPanel !== null) {
      // Use the totals from VhcDetailsPanel (will reflect real-time updates)
      return vhcFinancialTotalsFromPanel;
    }

    // Calculate from vhcChecks and parts_job_items data (allows showing totals without loading VHC tab)
    if (jobData.vhcChecks && Array.isArray(jobData.vhcChecks)) {
      return calculateVhcFinancialTotals(jobData.vhcChecks, jobData.parts_job_items || []);
    }

    // Default to 0 if no vhcChecks data
    return { authorized: 0, declined: 0 };
  }, [jobData, vhcFinancialTotalsFromPanel]);

  // Customer VHC delivery status — fetched + polled here so both the VHC tab
  // (Send action) and the customer summary card badge share one source of truth.
  const loadVhcCustomerStatus = useCallback(async () => {
    if (!jobNumber) return;
    try {
      const response = await fetch(
        `/api/job-cards/${encodeURIComponent(jobNumber)}/vhc-customer-status`
      );
      const payload = await response.json();
      if (response.ok && payload?.success) {
        setVhcCustomerStatus({
          status: payload.status || "pending",
          label: payload.label || "Pending",
          sentAt: payload.sentAt || null,
          viewedAt: payload.viewedAt || null,
          readyAt: payload.readyAt || null,
        });
      }
    } catch (statusError) {
      logFailure("Failed to load VHC customer status:", statusError);
    }
  }, [jobNumber]);

  // Poll the customer's VHC delivery status.
  //
  // This was a blind `setInterval(..., 15000)` that ran for as long as the page
  // was open, whether or not the tab was visible and whether or not the status
  // could still change — it was the single most-requested endpoint in a dev
  // session (358 calls). Two changes, no behavioural loss:
  //   * usePolling is visibility-gated (the shared hook already used by
  //     PartsTab): it stops while the tab is hidden and fetches immediately on
  //     return, so a user looking at the page sees the same freshness.
  //   * Once the customer has viewed the report there is no further transition
  //     to observe, so polling stops. Any staff action that changes the status
  //     (Send) already calls loadVhcCustomerStatus directly via
  //     onVhcCustomerStatusReload.
  useEffect(() => {
    loadVhcCustomerStatus();
  }, [loadVhcCustomerStatus]);

  const vhcCustomerStatusIsTerminal =
    String(vhcCustomerStatus?.status || "").toLowerCase() === "viewed";

  usePolling(loadVhcCustomerStatus, 15000, Boolean(jobNumber) && !vhcCustomerStatusIsTerminal);

  const vhcCustomerStatusMeta = useMemo(() => {
    const status = String(vhcCustomerStatus?.status || "pending").toLowerCase();
    if (status === "viewed") {
      return {
        label: "Viewed",
        detail: vhcCustomerStatus?.viewedAt
          ? `Viewed ${new Date(vhcCustomerStatus.viewedAt).toLocaleString("en-GB", { hour12: false })}`
          : "Customer opened the VHC link",
        background: "var(--success-surface)",
        color: "var(--success-dark)",
      };
    }
    if (status === "sent") {
      return {
        label: "Sent",
        detail: vhcCustomerStatus?.sentAt
          ? `Sent ${new Date(vhcCustomerStatus.sentAt).toLocaleString("en-GB", { hour12: false })}`
          : "VHC sent to customer",
        background: "var(--theme)",
        color: "var(--accent-purple)",
      };
    }
    return {
      label: "Pending",
      detail: vhcCustomerStatus?.readyAt ? "Ready to send" : "Not sent to customer",
      background: "var(--warning-surface)",
      color: "var(--warning)",
    };
  }, [vhcCustomerStatus]);

  const formatCurrency = (value) => {
    // Show N/A only when value is null or undefined (jobData not loaded)
    if (value === null || value === undefined) {
      return "N/A";
    }
    // Show £0.00 for zero values, or the actual amount
    if (!Number.isFinite(value)) {
      return "N/A";
    }
    return `£${value.toFixed(2)}`;
  };

  // Loading State
  if (loading) {
    return <JobCardDetailPageUi view="section1" JobCardPageShellSkeleton={JobCardPageShellSkeleton} jobNumber={jobNumber} />;
  }

  // Error State
  if (error || !jobData) {
    return <JobCardDetailPageUi view="section2" error={error} jobNumber={jobNumber} router={router} />;









































  }

  try {
    const writeUpCompletionStatus = String(
      jobData.writeUp?.completion_status || jobData.completionStatus || ""
    ).
    trim().
    toLowerCase();
    const writeUpChecklistTasksRaw = jobData.writeUp?.task_checklist;
    let writeUpChecklistTasks = [];
    if (Array.isArray(writeUpChecklistTasksRaw)) {
      writeUpChecklistTasks = writeUpChecklistTasksRaw;
    } else if (writeUpChecklistTasksRaw && typeof writeUpChecklistTasksRaw === "object") {
      writeUpChecklistTasks = Array.isArray(writeUpChecklistTasksRaw.tasks) ?
      writeUpChecklistTasksRaw.tasks :
      [];
    } else if (typeof writeUpChecklistTasksRaw === "string") {
      try {
        const parsedChecklist = JSON.parse(writeUpChecklistTasksRaw);
        if (Array.isArray(parsedChecklist)) {
          writeUpChecklistTasks = parsedChecklist;
        } else if (parsedChecklist && typeof parsedChecklist === "object") {
          writeUpChecklistTasks = Array.isArray(parsedChecklist.tasks) ?
          parsedChecklist.tasks :
          [];
        }
      } catch (_error) {
        writeUpChecklistTasks = [];
      }
    }
    const writeUpState = getWriteUpCompletionState({
      completionStatus: writeUpCompletionStatus,
      checklistTasks: writeUpChecklistTasks,
      requestRows:
      Array.isArray(jobData.jobRequests) ?
      jobData.jobRequests :
      Array.isArray(jobData.job_requests) ?
      jobData.job_requests :
      []
    });
    const vhcQualified = !jobData.vhcRequired || Boolean(jobData.vhcCompletedAt);
    const mileageRecorded = pickMileageValue(jobData.mileage, jobData.milage) !== null;
    const partsReadyBase = arePartsPricedAndAssigned(jobData.partsAllocations);
    const partsAllocatedBase = areAllPartsAllocated(jobData.partsAllocations);
    const partsAddedRowsForTab = Array.isArray(jobData.parts_job_items) ? jobData.parts_job_items : [];
    const visiblePartsAddedRows = partsAddedRowsForTab.filter((item) => isBookedPartsRow(item) || isRemovedPartsRow(item));
    const activePartsAddedRows = visiblePartsAddedRows.filter((item) => !isRemovedPartsRow(item));
    const partsTabComplete =
    activePartsAddedRows.length > 0 && activePartsAddedRows.every((item) => isPartsRowAllocated(item));
    const partsAllocated = partsTabComplete || partsAllocatedBase;
    const partsReady = partsTabComplete || partsReadyBase;
    const partsTabCompleteInstant =
    partsTabComplete ||
    Array.isArray(jobData.partsAllocations) &&
    jobData.partsAllocations.length > 0 &&
    partsAllocatedBase &&
    partsReadyBase;
    const writeUpCompleteInstant = writeUpState.isCompleteInstant;
    const writeUpPartiallyCompleteInstant = writeUpState.isPartiallyComplete;
    const vhcTechnicianCompleteInstant = Boolean(jobData.vhcCompletedAt);
    const vhcTabCompleteInstant = vhcTechnicianCompleteInstant && vhcTabComplete;
    const vhcTabAmberReadyInstant =
    vhcTechnicianCompleteInstant &&
    vhcAllRedAmberRowsAwaitingDecision &&
    !vhcTabCompleteInstant;
    const vhcTabDangerReadyInstant =
    vhcTechnicianCompleteInstant &&
    !vhcTabAmberReadyInstant &&
    !vhcTabCompleteInstant;
    const statusReadyForInvoicing = isStatusReadyForInvoicing(
      jobData.status,
      overallStatusId
    );
    const partsIssues = getPartsValidationIssues(jobData.partsAllocations);
    // Invoice gate matches the tab indicator — if every checklist row is
    // ticked the write-up is "done" for prerequisite purposes, even if the
    // 800ms autosave hasn't yet rewritten writeUp.completion_status in the
    // DB. Without this, ticking the final box flips the tab green but the
    // invoice tab still shows "Complete and mark the write up as finished."
    const writeUpCompleteForInvoice = writeUpCompleteInstant;
    const invoiceWorkflow = getInvoiceWorkflowState({
      writeUpComplete: writeUpCompleteForInvoice,
      vhcRequired: Boolean(jobData.vhcRequired),
      vhcQualified,
      vhcSummaryRowsCompleted,
      mileageRecorded,
      partsAllocated,
      partsReady,
      partsIssues,
      statusReadyForInvoicing
    });
    const invoicePrerequisitesMet = invoiceWorkflow.invoicePrerequisitesMet;
    const invoiceBlockingReasons = invoiceWorkflow.invoiceBlockingReasons;
    const showProformaCompleteSection = invoiceWorkflow.showProformaCompleteSection;
    const statusSnapshotInvoice = statusSnapshot?.workflows?.invoice || null;
    const invoiceExists =
    Boolean(statusSnapshotInvoice?.invoiceId) || Boolean(invoiceViewState?.exists);
    const invoicePaymentStatus = String(
      invoiceViewState?.paymentStatus || statusSnapshotInvoice?.status || ""
    ).trim();
    const invoicePaymentComplete =
    invoiceViewState?.paymentCaptured === true ||
    invoicePaymentStatus.toLowerCase() === "paid";
    const jobReleased =
    overallStatusId === JOB_STATUSES.RELEASED ||
    overallStatusId === JOB_STATUSES.CANCELLED ||
    String(overallStatusLabel || "").trim().toLowerCase() === "cancelled" ||
    String(overallStatusLabel || "").trim().toLowerCase() === "released";
    const showCreateInvoiceButton =
    canEdit &&
    activeTab === "invoice" &&
    !invoiceExists &&
    showProformaCompleteSection;
    const showReleaseButton =
    canUseReleaseAction &&
    activeTab === "invoice" &&
    invoiceExists &&
    invoicePaymentComplete &&
    !jobReleased;

    const jobVhcChecks = Array.isArray(jobData.vhcChecks) ? jobData.vhcChecks : [];
    const redIssues = jobVhcChecks.filter((check) => resolveVhcSeverity(check) === "red");
    const amberIssues = jobVhcChecks.filter((check) => resolveVhcSeverity(check) === "amber");
    const greyIssues = jobVhcChecks.filter((check) => resolveVhcSeverity(check) === "grey");
    const vhcSummaryCounts = {
      total: jobVhcChecks.length,
      red: redIssues.length,
      amber: amberIssues.length,
      grey: greyIssues.length
    };
    const notesTabBadge = pendingNewNoteIds.length ?
    pendingNewNoteIds.length > 9 ?
    "9+" :
    String(pendingNewNoteIds.length) :
    undefined;
    const jobDivisionLabel =
    typeof jobData.jobDivision === "string" ?
    jobData.jobDivision :
    jobData.jobDivision ?
    String(jobData.jobDivision) :
    "";
    const jobDivisionLower = jobDivisionLabel.toLowerCase();

    // Job group position (X/Y Job Cards badge)
    const isInPrimeGroup = jobData.isPrimeJob || Boolean(jobData.primeJobId);
    const jobGroupPosition = jobData.isPrimeJob ?
    1 :
    (jobData.subJobSequence ?? 0) + 1;
    const jobGroupTotal = jobData.isPrimeJob ?
    1 + (jobData.subJobs?.length || 0) :
    relatedJobs.length + 1;
    const showJobGroupBadge = isInPrimeGroup && jobGroupTotal > 1;

    // Tab Configuration (from shared permission model)
    const permissionTabs = permissions?.tabs || [];
    const tabsWithLoanCar = isLoanCarLogisticsSelected && !isValetMode ?
    permissionTabs.reduce((acc, tab) => {
      acc.push(tab);
      if (tab.id === "scheduling") {
        acc.push({ id: "loan-car", label: "Loan Car" });
      }
      return acc;
    }, []) :
    permissionTabs;
    const tabs = tabsWithLoanCar.map((tab) => {
      if (tab.id === "notes") {
        return { ...tab, badge: notesTabBadge };
      }
      return tab;
    });

    const pageStackStyle = {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      rowGap: "10px"
    };
    const sharedJobCardShellBackground = "var(--tab-container-bg)";
    const summaryPrimaryTextStyle = {
      fontSize: "16px",
      fontWeight: "600",
      color: "var(--text-1)",
      marginBottom: "4px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    };
    const summarySecondaryTextStyle = {
      fontSize: "13px",
      color: "var(--grey-accent)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    };

    // Main Render
    return <JobCardDetailPageUi view="section3" actingUserId={actingUserId} actingUserNumericId={actingUserNumericId} activeTab={activeTab} alert={alert} appointmentSaving={appointmentSaving} bookingApprovalSaving={bookingApprovalSaving} bookingFlowSaving={bookingFlowSaving} canEdit={canEdit} canEditPartsWriteUpVhc={canEditPartsWriteUpVhc} canEditTrackingLocations={canEditTrackingLocations} canManageDocuments={canManageDocuments} canViewPartsTab={canViewPartsTab} CAR_LOCATIONS={CAR_LOCATIONS} checkingIn={checkingIn} clockingLockDescription={clockingLockDescription} ClockingTab={ClockingTab} ContactTab={ContactTab} createCustomerDisplaySlug={createCustomerDisplaySlug} creatingInvoice={creatingInvoice} CustomerRequestsTab={CustomerRequestsTab} customerSaving={customerSaving} customerVehicles={customerVehicles} customerVehiclesLoading={customerVehiclesLoading} dbUserId={dbUserId} DocumentsTab={DocumentsTab} DocumentsUploadPopup={DocumentsUploadPopup} emptyTrackingForm={emptyTrackingForm} fetchDocuments={fetchDocuments} fetchJobData={fetchJobData} formatCurrency={formatCurrency} generalReadOnlyLockDescription={generalReadOnlyLockDescription} handleAppointmentRebook={handleAppointmentRebook} handleAppointmentSave={handleAppointmentSave} handleBookingApproval={handleBookingApproval} handleBookingFlowSave={handleBookingFlowSave} handleCheckIn={handleCheckIn} handleCreateInvoice={handleCreateInvoice} handleCustomerDetailsSave={handleCustomerDetailsSave} handleDeleteDocument={handleDeleteDocument} handleDocumentFileUploaded={handleDocumentFileUploaded} handleInvoicePaymentCompleted={handleInvoicePaymentCompleted} handleLinkJob={handleLinkJob} handleNoteAdded={handleNoteAdded} handleNotesChange={handleNotesChange} handleReleaseJob={handleReleaseJob} handleArchiveJob={handleArchiveJob} jobReleased={jobReleased} handleRenameDocument={handleRenameDocument} handleReplaceDocument={handleReplaceDocument} handleSchedulingLogisticsChange={handleSchedulingLogisticsChange} handleTabClick={handleTabClick} handleTabsDragEnd={handleTabsDragEnd} handleTabsDragMove={handleTabsDragMove} handleTabsDragStart={handleTabsDragStart} handleToggleVhcRequired={handleToggleVhcRequired} handleTrackerSave={handleTrackerSave} handleUpdateRequestPrePickLocation={handleUpdateRequestPrePickLocation} handleUpdateRequests={handleUpdateRequests} handleUpdateRequestStatus={handleUpdateRequestStatus} handleSaveRequestWorkDetails={handleSaveRequestWorkDetails} handleMarkAllRequestsComplete={handleMarkAllRequestsComplete} handleSaveWriteUp={handleSaveWriteUp} WriteUpWorkspace={WriteUpWorkspace} clockingEntries={clockingEntries} handleWriteUpCompletionChange={handleWriteUpCompletionChange} handleWriteUpRequestStatusesChange={handleWriteUpRequestStatusesChange} handleWriteUpSaveSuccess={handleWriteUpSaveSuccess} handleWriteUpTasksSnapshotChange={handleWriteUpTasksSnapshotChange} highlightedNoteIds={highlightedNoteIds} invoiceBlockingReasons={invoiceBlockingReasons} invoicePrerequisitesMet={invoicePrerequisitesMet} InvoiceSection={InvoiceSection} isArchiveMode={isArchiveMode} isBookedStatus={isBookedStatus} isOpenStatus={isOpenStatus} isCheckedIn={isCheckedIn} isClockingLockedByStatus={isClockingLockedByStatus} isInPrimeGroup={isInPrimeGroup} isInvoiceOrBeyondReadOnly={isInvoiceOrBeyondReadOnly} isLinking={isLinking} isLinkPopupOpen={isLinkPopupOpen} isPartsWriteUpVhcLockedByStatus={isPartsWriteUpVhcLockedByStatus} isValetMode={isValetMode} JobCardErrorBoundary={JobCardErrorBoundary} jobData={jobData} jobDivisionLabel={jobDivisionLabel} jobDivisionLower={jobDivisionLower} jobDocuments={jobDocuments} jobNotes={jobNotes} jobNumber={jobNumber} jobVhcChecks={jobVhcChecks} KEY_LOCATIONS={KEY_LOCATIONS} linkError={linkError} linkJobInput={linkJobInput} LocationUpdateModal={LocationUpdateModal} lockAlertStyle={lockAlertStyle} lockedTabIds={lockedTabIds} MessagesTab={MessagesTab} mileageInputDirtyRef={mileageInputDirtyRef} normalizeKeyLocationLabel={normalizeKeyLocationLabel} NotesTabNew={NotesTabNew} overallStatusId={overallStatusId} overallStatusLabel={overallStatusLabel} pageStackStyle={pageStackStyle} partsTabCompleteInstant={partsTabCompleteInstant} PartsTabNew={PartsTabNew} partsWriteUpVhcLockDescription={partsWriteUpVhcLockDescription} popupCardStyles={popupCardStyles} popupOverlayStyles={popupOverlayStyles} relatedJobs={relatedJobs} relatedJobsLoading={relatedJobsLoading} router={router} SchedulingTab={SchedulingTab} ServiceHistoryTab={ServiceHistoryTab} setInvoiceViewState={setInvoiceViewState} setIsLinkPopupOpen={setIsLinkPopupOpen} setLinkError={setLinkError} setLinkJobInput={setLinkJobInput} setShowDocumentsPopup={setShowDocumentsPopup} setTrackerQuickModalOpen={setTrackerQuickModalOpen} setVehicleMileageInput={setVehicleMileageInput} setVhcFinancialTotalsFromPanel={setVhcFinancialTotalsFromPanel} sharedJobCardShellBackground={sharedJobCardShellBackground} showCreateInvoiceButton={showCreateInvoiceButton} showDocumentsPopup={showDocumentsPopup} showProformaCompleteSection={showProformaCompleteSection} showReleaseButton={showReleaseButton} summaryPrimaryTextStyle={summaryPrimaryTextStyle} summarySecondaryTextStyle={summarySecondaryTextStyle} tabs={tabs} tabsOverflowing={tabsOverflowing} tabsScrollRef={tabsScrollRef} trackerEntry={trackerEntry} trackerQuickModalOpen={trackerQuickModalOpen} user={user} vehicleJobHistory={vehicleJobHistory} vehicleMileageInput={vehicleMileageInput} vhcCustomerStatusMeta={vhcCustomerStatusMeta} reloadVhcCustomerStatus={loadVhcCustomerStatus} vhcFinancialTotals={vhcFinancialTotals} vhcSummaryCounts={vhcSummaryCounts} VHCTab={VHCTab} vhcTabAmberReadyInstant={vhcTabAmberReadyInstant} vhcTabCompleteInstant={vhcTabCompleteInstant} vhcTabDangerReadyInstant={vhcTabDangerReadyInstant} writeUpCompleteInstant={writeUpCompleteInstant} writeUpPartiallyCompleteInstant={writeUpPartiallyCompleteInstant} WriteUpForm={WriteUpForm} writeUpTabMounted={writeUpTabMounted} vhcTabMounted={vhcTabMounted} />;












































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































  } catch (renderError) {
    logFailure("Job card render error:", renderError);
    return <JobCardDetailPageUi view="section4" renderError={renderError} />;























  }
}

class JobCardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    logFailure("Job card render error:", error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const message = this.state.error?.message || String(this.state.error);

    return (
      <>
        <div style={{
          padding: "40px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh"
        }}>
          <div style={{ fontSize: "60px", marginBottom: "20px" }}>Warning</div>
          <h2 style={{ color: "var(--primary)", marginBottom: "10px" }}>
            Job card failed to render
          </h2>
          <p style={{ color: "var(--grey-accent)", marginBottom: "18px" }}>
            {message}
          </p>
          <p style={{ color: "var(--grey-accent)", marginBottom: "30px", fontSize: "13px" }}>
            Check the console for the stack trace.
          </p>
        </div>
      </>);

  }
}

// ============================================
// TAB COMPONENTS
// ============================================

function LocationEntryModal({ context, entry, mode = "edit", onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    ...emptyTrackingForm,
    ...entry,
    vehicleLocation: entry?.vehicleLocation || CAR_LOCATIONS[0].label,
    keyLocation: normalizeKeyLocationLabel(entry?.keyLocation) || KEY_LOCATIONS[0].label,
    status: entry?.status || "Waiting For Collection"
  }));
  const isEdit = mode === "edit";
  const vehicleLocationOptions = useMemo(
    () => ensureDropdownOption(CAR_LOCATION_OPTIONS, form.vehicleLocation),
    [form.vehicleLocation]
  );
  const keyLocationOptions = useMemo(
    () => ensureDropdownOption(KEY_LOCATION_OPTIONS, form.keyLocation),
    [form.keyLocation]
  );

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const hasJobNumber = form.jobNumber && form.jobNumber.trim();
    const hasReg = form.reg && form.reg.trim();
    const hasCustomer = form.customer && form.customer.trim();

    if (!hasJobNumber && !hasReg && !hasCustomer) {
      alert("Please fill in at least one of: Job Number, Registration, or Customer name");
      return;
    }

    const actionType = context === "car" ? "job_checked_in" : "job_complete";
    onSave({ ...form, actionType, context });
  };

  return (
    <PopupModal
      isOpen
      onClose={onClose}
      ariaLabel={isEdit ? "Edit existing tracking entry" : "Log new tracking entry"}
      cardStyle={{
        width: "min(100%, 500px)",
        maxHeight: "96vh",
        overflowY: "visible",
        padding: "var(--section-card-padding)",
      }}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "18px"
        }}>

        <header className="app-popup-compact-header">
          <h2>{isEdit ? "Edit existing" : "Log new"}</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="submit" variant="primary">Update</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "10px"
          }}>

          {[
          { label: "Job Number", field: "jobNumber", placeholder: "HNP-4821", required: false },
          { label: "Registration", field: "reg", placeholder: "GY21 HNP", required: false },
          { label: "Customer", field: "customer", placeholder: "Customer name", required: false },
          { label: "Service Type", field: "serviceType", placeholder: "MOT, Service...", required: false }].
          map((input) =>
          <div key={input.field} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
                {input.label}
                {["jobNumber", "reg", "customer"].includes(input.field) &&
              <span style={{ fontSize: "0.75rem", color: "var(--info)", fontWeight: 400 }}>
                    {" "}
                    (at least one required)
                  </span>
              }
              </label>
              <input
              className="app-input"
              value={form[input.field]}
              onChange={(event) => handleChange(input.field, event.target.value)}
              placeholder={input.placeholder}
              style={{ width: "100%" }} />

            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "10px"
          }}>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
              Vehicle Location
            </label>
            <DropdownField
              options={vehicleLocationOptions}
              value={form.vehicleLocation}
              onValueChange={(value) => handleChange("vehicleLocation", value)}
              placeholder="Select location"
              size="md"
              usePortal={false}
              menuStyle={{ maxHeight: "220px", overflowY: "auto" }} />

          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
              Key Location
            </label>
            <DropdownField
              options={keyLocationOptions}
              value={form.keyLocation}
              onValueChange={(value) => handleChange("keyLocation", value)}
              placeholder="Select key location"
              size="md"
              usePortal={false}
              menuStyle={{ maxHeight: "220px", overflowY: "auto" }} />

          </div>
        </div>

      </form>
    </PopupModal>);

}

// Scheduling Tab
function SchedulingTab({
  jobData,
  canEdit,
  jobNumber,
  customerVehicles = [],
  customerVehiclesLoading = false,
  bookingRequest = null,
  onBookingFlowSave = () => {},
  bookingFlowSaving = false,
  onBookingApproval = () => {},
  bookingApprovalSaving = false,
  onAppointmentSave = () => {},
  onAppointmentRebook = () => {},
  appointmentSaving = false,
  onLogisticsSelectionChange = () => {},
  onNavigateTab = () => {},
  onRefreshJob = () => {}
}) {
  const router = useRouter();
  const waitingOptions = ["Waiting", "Loan Car", "Collection", "Neither"];
  const [appointmentForm, setAppointmentForm] = useState({
    date: jobData.appointment?.date || "",
    time: jobData.appointment?.time || "",
    status: jobData.appointment?.status || "booked",
    notes: jobData.appointment?.notes || ""
  });
  const [appointmentDirty, setAppointmentDirty] = useState(false);
  const [appointmentMessage, setAppointmentMessage] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState(
    jobData.vehicleId || null
  );
  const [confirmCustomerDetails, setConfirmCustomerDetails] = useState(false);
  const [bookingDescription, setBookingDescription] = useState(() =>
  formatBookingDescriptionInput(jobData.description || "")
  );
  const [bookingWaitingStatus, setBookingWaitingStatus] = useState(
    jobData.waitingStatus || "Neither"
  );
  const [bookingMessage, setBookingMessage] = useState("");
  const [approvalMessage, setApprovalMessage] = useState("");
  const formatDateInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const formatTimeInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };
  const [approvalForm, setApprovalForm] = useState({
    priceEstimate: bookingRequest?.priceEstimate ?
    String(bookingRequest.priceEstimate) :
    "",
    etaDate: formatDateInput(bookingRequest?.estimatedCompletion),
    etaTime: formatTimeInput(bookingRequest?.estimatedCompletion),
    loanCarDetails: bookingRequest?.loanCarDetails || "",
    confirmationMessage: bookingRequest?.confirmationNotes || ""
  });

  useEffect(() => {
    setAppointmentForm({
      date: jobData.appointment?.date || "",
      time: jobData.appointment?.time || "",
      status: jobData.appointment?.status || "booked",
      notes: jobData.appointment?.notes || ""
    });
    setAppointmentDirty(false);
    setAppointmentMessage("");
  }, [jobData.appointment]);

  useEffect(() => {
    setSelectedVehicleId(jobData.vehicleId || null);
    setBookingDescription(
      formatBookingDescriptionInput(jobData.description || "")
    );
    setBookingWaitingStatus(jobData.waitingStatus || "Neither");
    setConfirmCustomerDetails(false);
    setBookingMessage("");
  }, [jobData.vehicleId, jobData.description, jobData.waitingStatus]);

  useEffect(() => {
    setApprovalForm({
      priceEstimate: bookingRequest?.priceEstimate ?
      String(bookingRequest.priceEstimate) :
      "",
      etaDate: formatDateInput(bookingRequest?.estimatedCompletion),
      etaTime: formatTimeInput(bookingRequest?.estimatedCompletion),
      loanCarDetails: bookingRequest?.loanCarDetails || "",
      confirmationMessage: bookingRequest?.confirmationNotes || ""
    });
    setApprovalMessage("");
  }, [bookingRequest]);

  const vehicleOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    const pushVehicle = (vehicle) => {
      if (!vehicle || !vehicle.vehicle_id) return;
      if (seen.has(vehicle.vehicle_id)) return;
      seen.add(vehicle.vehicle_id);
      options.push(vehicle);
    };

    if (jobData.vehicleId) {
      pushVehicle({
        vehicle_id: jobData.vehicleId,
        registration: jobData.reg,
        reg_number: jobData.reg,
        make_model: jobData.makeModel,
        make: jobData.make,
        model: jobData.model,
        mileage: pickMileageValue(jobData.mileage, jobData.milage)
      });
    }

    (customerVehicles || []).forEach((vehicle) => pushVehicle(vehicle));

    return options;
  }, [
  jobData.vehicleId,
  jobData.reg,
  jobData.makeModel,
  jobData.make,
  jobData.model,
  jobData.mileage,
  jobData.milage,
  customerVehicles]
  );

  const descriptionLines = useMemo(() => {
    if (!bookingRequest?.description) return [];
    return bookingRequest.description.
    split("\n").
    map((line) => line.replace(/^-+\s*/, "").trim()).
    filter(Boolean);
  }, [bookingRequest?.description]);

  const handleVehicleChange = (value) => {
    const parsed = value ? Number(value) : null;
    setSelectedVehicleId(Number.isNaN(parsed) ? null : parsed);
    setBookingMessage("");
  };

  const handleAppointmentFieldChange = (field, value) => {
    setAppointmentForm((prev) => ({ ...prev, [field]: value }));
    setAppointmentDirty(true);
    setAppointmentMessage("");
  };

  const handleAppointmentSubmit = async () => {
    if (!appointmentDirty || !canEdit) return;
    const result = await onAppointmentSave(appointmentForm);
    if (result?.success) {
      setAppointmentDirty(false);
      setAppointmentMessage("Appointment saved");
      setTimeout(() => setAppointmentMessage(""), 3000);
    }
  };

  const handleAppointmentRebook = async () => {
    if (!canEdit || appointmentSaving) return;
    const result = await onAppointmentRebook(appointmentForm);
    if (result?.success) {
      setAppointmentDirty(false);
      setAppointmentMessage("Appointment rebooked");
      setTimeout(() => setAppointmentMessage(""), 3000);
    }
  };

  const handleAppointmentCancel = async () => {
    if (!canEdit || appointmentSaving || !jobData.appointment) return;
    await onAppointmentSave({ cancelJob: true });
  };

  const handleBookingDescriptionChange = (value) => {
    setBookingDescription(
      value ? formatBookingDescriptionInput(value) : ""
    );
    setBookingMessage("");
  };

  const bookingRequestLines = useMemo(() => {
    const normalized = normalizeRequests(jobData?.requests);
    return (Array.isArray(normalized) ? normalized : []).
    map((req) => (req?.description || req?.text || "").toString().trim()).
    filter(Boolean);
  }, [jobData?.requests]);

  const bookingRequestDescription = useMemo(() => {
    return bookingRequestLines.
    map((line) => `- ${line.replace(/^-+\s*/, "").trim()}`).
    join("\n");
  }, [bookingRequestLines]);

  const handleBookingWaitingSelect = (value) => {
    setBookingWaitingStatus(value);
    onLogisticsSelectionChange(value);
    setBookingMessage("");
  };

  const handleBookingSubmit = async () => {
    if (!canEdit || !selectedVehicleId || !confirmCustomerDetails) return;
    if (!bookingRequestDescription.trim()) return;
    const payload = {
      vehicleId: selectedVehicleId,
      description: bookingRequestDescription,
      waitingStatus: bookingWaitingStatus
    };
    const result = await onBookingFlowSave(payload);
    if (result?.success) {
      setBookingMessage("Booking request submitted");
      setTimeout(() => setBookingMessage(""), 3000);
    }
  };

  const handleApprovalFieldChange = (field, value) => {
    setApprovalForm((prev) => ({ ...prev, [field]: value }));
    setApprovalMessage("");
  };

  const handleApprovalSubmit = async () => {
    if (!canEdit || !bookingRequest) return;
    if (
    !approvalForm.priceEstimate.trim() ||
    !approvalForm.etaDate ||
    !approvalForm.etaTime)
    {
      return;
    }
    const etaCandidate = new Date(
      `${approvalForm.etaDate}T${approvalForm.etaTime}`
    );
    if (Number.isNaN(etaCandidate.getTime())) {
      return;
    }
    const payload = {
      priceEstimate: approvalForm.priceEstimate,
      estimatedCompletion: etaCandidate.toISOString(),
      loanCarDetails: approvalForm.loanCarDetails?.trim() || "",
      confirmationMessage: approvalForm.confirmationMessage?.trim() || ""
    };
    const result = await onBookingApproval(payload);
    if (result?.success) {
      setApprovalMessage("Confirmation sent to customer");
      setTimeout(() => setApprovalMessage(""), 3000);
    }
  };

  const selectedVehicleIdValue =
  selectedVehicleId != null ? String(selectedVehicleId) : "";
  const bookingButtonDisabled =
  !canEdit ||
  bookingFlowSaving ||
  !confirmCustomerDetails ||
  !selectedVehicleId ||
  bookingRequestLines.length === 0;

  const approvalButtonDisabled =
  !canEdit ||
  !bookingRequest ||
  bookingApprovalSaving ||
  !approvalForm.priceEstimate.trim() ||
  !approvalForm.etaDate ||
  !approvalForm.etaTime;
  const rebookButtonDisabled =
  !canEdit ||
  appointmentSaving ||
  !appointmentForm.date ||
  !appointmentForm.time;

  const appointmentCreatedAt = jobData.appointment?.createdAt ?
  new Date(jobData.appointment.createdAt).toLocaleString() :
  "Not created yet";
  const bookingStatus = bookingRequest?.status || "pending";
  const statusColor =
  bookingStatus === "approved" ?
  { background: "var(--success-surface)", color: "var(--success-dark)" } :
  { background: "var(--warning-surface)", color: "var(--danger-dark)" };
  const submittedAt = bookingRequest?.submittedAt ?
  new Date(bookingRequest.submittedAt).toLocaleString() :
  "Awaiting submission";
  const approvedAt = bookingRequest?.approvedAt ?
  new Date(bookingRequest.approvedAt).toLocaleString() :
  null;
  const etaDisplay = bookingRequest?.estimatedCompletion ?
  new Date(bookingRequest.estimatedCompletion).toLocaleString() :
  null;

  const panelStyle = {
    background: "var(--surface)",
    border: "none",
    borderRadius: "var(--radius-md)",
    padding: "18px"
  };
  const panelHeaderStyle = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "14px",
    flexWrap: "wrap"
  };
  const headerBadgeStyle = {
    padding: "4px 10px",
    borderRadius: "var(--control-radius)",
    background: "var(--surface)",
    border: "none",
    color: "var(--text-1)",
    fontSize: "12px",
    fontWeight: "700",
    width: "fit-content"
  };
  const cardStyle = {
    padding: "18px",
    backgroundColor: "var(--surface)",
    borderRadius: "var(--radius-md)",
    border: "none"
  };
  const subPanelStyle = {
    padding: "12px",
    backgroundColor: "var(--surface)",
    borderRadius: "var(--radius-sm)",
    border: "none"
  };
  const cardTitleStyle = {
    margin: 0,
    fontSize: "16px",
    fontWeight: "700",
    color: "var(--text-1)"
  };
  const cardSubtitleStyle = {
    margin: "4px 0 0 0",
    color: "var(--text-1)",
    fontSize: "13px"
  };
  const inputStyle = {
    width: "100%",
    padding: "var(--control-padding)",
    borderRadius: "var(--control-radius)",
    border: "none",
    fontSize: "var(--control-font-size)",
    backgroundColor: "var(--control-bg)",
    color: "var(--text-1)",
    minHeight: "var(--control-height)"
  };

  const sectionCardStyle = {
    ...cardStyle,
    marginBottom: 0
  };
  const sectionTitleRow = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "16px"
  };
  const schedulingRowSubtitleStyle = {
    fontSize: "10px",
    color: "var(--accent-purple)",
    fontWeight: "700",
    letterSpacing: "0.12em",
    textTransform: "uppercase"
  };
  const reportedIssueRowStyle = {
    padding: "10px 12px",
    backgroundColor: "var(--theme)",
    borderRadius: "var(--control-radius)"
  };
  const schedulingThreeColumnRowStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: "16px",
    alignItems: "stretch"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* ── Dashboard Row 1: Technician Assignment | Job Progress | Appointment Information ── */}
      <div style={schedulingThreeColumnRowStyle}>
        <TechnicianAssignmentSection jobData={jobData} canEdit={canEdit} jobNumber={jobNumber} onRefreshJob={onRefreshJob} />
        <JobProgressSection jobData={jobData} />
        {/* Section: Appointment Information (moved here from the bottom row) */}
        <DevLayoutSection
          sectionKey="jobcard-tab-scheduling-appointment"
          sectionType="content-card"
          parentKey="jobcard-tab-scheduling"
          backgroundToken="surface"
          style={{ ...sectionCardStyle, marginBottom: 0 }}>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
            flexWrap: "wrap"
          }}>
            <h3 style={cardTitleStyle}>Appointment Information</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={handleAppointmentRebook}
                disabled={rebookButtonDisabled}
                title={
                !appointmentForm.date || !appointmentForm.time ?
                "Choose a date and time first" :
                undefined
                }
                style={{
                  padding: "var(--control-padding)",
                  borderRadius: "var(--control-radius)",
                  border: "none",
                  backgroundColor: rebookButtonDisabled ? "rgba(var(--primary-rgb), 0.04)" : "rgba(var(--primary-rgb), 0.12)",
                  color: rebookButtonDisabled ? "var(--text-1)" : "var(--primary-selected)",
                  fontSize: "var(--control-font-size)",
                  fontWeight: "600",
                  minHeight: "var(--control-height)",
                  cursor: rebookButtonDisabled ? "not-allowed" : "pointer",
                  opacity: rebookButtonDisabled ? 0.6 : 1,
                  whiteSpace: "nowrap"
                }}>

                {appointmentSaving ? "Rebooking..." : "Reschedule as New Appointment"}
              </button>
            </div>
          </div>

          {/* Linked job cards appointment note */}
          {jobData.isPrimeJob && Array.isArray(jobData.subJobs) && jobData.subJobs.length > 0 &&
          <div style={{
            marginBottom: "12px",
            padding: "8px 12px",
            backgroundColor: "var(--theme)",
            borderRadius: "var(--radius-sm)",
            border: "none",
            fontSize: "12px",
            color: "var(--accent-strong)",
            fontWeight: "500"
          }}>
              Saving this appointment will also apply to {jobData.subJobs.length} linked job card{jobData.subJobs.length > 1 ? "s" : ""} ({jobData.subJobs.map((s) => `#${s.jobNumber}`).join(", ")}).
            </div>
          }
          {jobData.primeJobId && !jobData.isPrimeJob &&
          <div style={{
            marginBottom: "12px",
            padding: "8px 12px",
            backgroundColor: "var(--theme)",
            borderRadius: "var(--radius-sm)",
            border: "none",
            fontSize: "12px",
            color: "var(--accent-strong)",
            fontWeight: "500"
          }}>
              Appointment synced from Host Job #{jobData.primeJobNumber}. Update the appointment on the host job to apply to all linked cards.
            </div>
          }

          {/* auto-fit: Date/Time fields stay in a row on desktop, stack on narrow screens (CLAUDE.md §3.6) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: "12px" }}>
            <div>
              <CalendarField
                label="Date"
                value={appointmentForm.date}
                onChange={(event) => handleAppointmentFieldChange("date", event.target.value)}
                disabled={!canEdit || appointmentSaving}
                className="compact-picker" />

            </div>
            <div>
              <DropdownField
                label="Time"
                value={appointmentForm.time}
                onChange={(event) => handleAppointmentFieldChange("time", event.target.value)}
                disabled={!canEdit || appointmentSaving}
                className="compact-picker"
                placeholder="Select time"
                options={WORKSHOP_APPOINTMENT_TIME_OPTIONS}
                style={{ ...inputStyle }} />

            </div>
            <div>
              <DropdownField
                label="Status"
                value={String(appointmentForm.status || "booked")}
                defaultValue="booked"
                placeholder="Select status"
                onChange={(event) => handleAppointmentFieldChange("status", event.target.value)}
                disabled={!canEdit || appointmentSaving}
                className="compact-picker"
                options={[
                { value: "booked", label: "Booked" },
                { value: "confirmed", label: "Confirmed" },
                { value: "checked_in", label: "Checked In" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" }]
                } />

            </div>
            <div>
              <DropdownField
                label="Collection Type"
                value={bookingWaitingStatus || "Neither"}
                defaultValue="Neither"
                placeholder="Select collection type"
                onChange={(event) => handleBookingWaitingSelect(event.target.value)}
                disabled={!canEdit || appointmentSaving}
                className="compact-picker"
                options={waitingOptions.map((option) => ({ value: option, label: option }))} />

            </div>
          </div>

          <div
            style={{
              marginTop: "14px",
              padding: "10px 12px",
              backgroundColor: "var(--surface)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontSize: "12px",
              color: "var(--grey-accent)"
            }}>

            Appointment created: <strong style={{ color: "var(--text-1)" }}>{appointmentCreatedAt}</strong>
          </div>

          {canEdit &&
          <div style={{
            display: "grid",
            gridTemplateColumns:
              jobData.appointment && String(jobData.appointment.status || "").toLowerCase() !== "cancelled" ?
              "repeat(2, minmax(0, 1fr))" :
              "minmax(0, 1fr)",
            gap: "var(--layout-card-gap)",
            marginTop: "var(--layout-card-gap)"
          }}>
            <Button
              type="button"
              variant="primary"
              onClick={handleAppointmentSubmit}
              disabled={!appointmentDirty || appointmentSaving}
              style={{ width: "100%" }}>

              {appointmentSaving ?
              "Saving..." :
              jobData.appointment ?
              "Update Appointment" :
              "Schedule Appointment"}
            </Button>
            {jobData.appointment &&
            String(jobData.appointment.status || "").toLowerCase() !== "cancelled" &&
            <Button
              type="button"
              variant="secondary"
              onClick={handleAppointmentCancel}
              disabled={appointmentSaving}
              style={{ width: "100%" }}>

              Cancel appointment
            </Button>
            }
          </div>
          }
        </DevLayoutSection>
      </div>

      {/* ── Row: Customer Updates | Customer Reported Issues | Customer & Vehicle ── */}
      {/* auto-fit keeps the row three-up on wide desktop and stacks it on narrow screens (CLAUDE.md §3.6) */}
      <div style={schedulingThreeColumnRowStyle}>
        <CustomerUpdatesSection jobData={jobData} jobNumber={jobNumber} canEdit={canEdit} onRefreshJob={onRefreshJob} />

        {/* ── Section 2: Customer Reported Issues ── */}
        <DevLayoutSection
          sectionKey="jobcard-tab-scheduling-reported-issues"
          sectionType="content-card"
          parentKey="jobcard-tab-scheduling"
          backgroundToken="surface"
          style={{ ...sectionCardStyle, marginBottom: 0, display: "flex", flexDirection: "column" }}>

          <div style={sectionTitleRow}>
            <h3 style={cardTitleStyle}>Customer Reported Issues</h3>
          </div>
          <div
            style={{
              ...subPanelStyle,
              flex: 1,
              minHeight: "120px",
              maxHeight: bookingRequestLines.length >= 5 ? "292px" : "none",
              overflowY: "auto",
              color: "var(--text-1)",
              fontSize: "13px",
              lineHeight: "18px"
            }}>

            {bookingRequestLines.length > 0 ?
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {bookingRequestLines.map((line, index) =>
              <div
                key={`${index}-${line}`}
                style={{
                  ...reportedIssueRowStyle,
                  marginBottom: 0
                }}>

                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={schedulingRowSubtitleStyle}>Reported Issue {index + 1}</span>
                      <span style={{ color: "var(--text-1)", fontSize: "13px" }}>{line}</span>
                    </div>
                  </div>
              )}
              </div> :

            <div style={{ padding: "8px 6px", color: "var(--grey-accent)" }}>No reported issues found.</div>
            }
          </div>
        </DevLayoutSection>

        {/* Section: Customer & Vehicle (moved here from the full-width row) */}
        <DevLayoutSection
          sectionKey="jobcard-tab-scheduling-customer-vehicle"
          sectionType="content-card"
          parentKey="jobcard-tab-scheduling"
          backgroundToken="surface"
          style={{ ...sectionCardStyle, marginBottom: 0 }}>

          <div style={sectionTitleRow}>
            <div style={{ flex: 1 }}>
              <h3 style={cardTitleStyle}>Customer &amp; Vehicle</h3>
            </div>
            {bookingRequest ?
            <span style={{ ...headerBadgeStyle, backgroundColor: statusColor.background, color: statusColor.color }}>
                {bookingStatus === "approved" ? "Approved" : "Awaiting Approval"}
              </span> :
            null}
            <button
              onClick={() => {
                const slug = createCustomerDisplaySlug(jobData.customerFirstName || "", jobData.customerLastName || "");
                const target = slug || jobData.customerId;
                if (target) router.push(`/customers/${target}`);
              }}
              disabled={!jobData.customerFirstName && !jobData.customerLastName && !jobData.customerId}
              style={{
                padding: "var(--control-padding)",
                borderRadius: "var(--control-radius)",
                border: "none",
                backgroundColor: "rgba(var(--primary-rgb), 0.08)",
                color: "var(--primary-selected)",
                fontSize: "var(--control-font-size)",
                fontWeight: "600",
                minHeight: "var(--control-height)",
                cursor: jobData.customerFirstName || jobData.customerLastName || jobData.customerId ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
                opacity: !jobData.customerFirstName && !jobData.customerLastName && !jobData.customerId ? 0.5 : 1
              }}>

              View Profile
            </button>
          </div>

          {/* Vehicle selector */}
          <div>
            {customerVehiclesLoading ?
            <div style={{ fontSize: "13px", color: "var(--text-1)", padding: "8px 0" }}>
                Loading stored vehicles...
              </div> :
            vehicleOptions.length > 0 ?
            <DropdownField
              label="Vehicle"
              placeholder="Select stored vehicle"
              value={selectedVehicleIdValue}
              onChange={(event) => handleVehicleChange(event.target.value)}
              disabled={!canEdit}
              className="compact-picker"
              options={vehicleOptions.map((vehicle) => ({
                value: String(vehicle.vehicle_id),
                label: `${getVehicleRegistration(vehicle, "Vehicle")} · ${
                vehicle.make_model ||
                [vehicle.make, vehicle.model].filter(Boolean).join(" ")}`

              }))} /> :


            <div style={{ fontSize: "13px", color: "var(--danger)", padding: "8px 0" }}>
                No stored vehicles found for this customer.
              </div>
            }
          </div>
        </DevLayoutSection>
      </div>

      {/* ── Section 5: Actions ── */}
      <DevLayoutSection
        sectionKey="jobcard-tab-scheduling-actions"
        sectionType="toolbar"
        parentKey="jobcard-tab-scheduling"
        backgroundToken="surface"
        style={{ ...sectionCardStyle, display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: "14px", marginBottom: 0 }}>

        <DevLayoutSection
          sectionKey="jobcard-tab-scheduling-confirmation"
          sectionType="content-card"
          parentKey="jobcard-tab-scheduling-actions"
          style={{
            flex: "1 1 360px",
            minWidth: "280px",
            padding: "14px",
            backgroundColor: "var(--surface)",
            borderRadius: "var(--radius-sm)",
            border: "none"
          }}>

          <label
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
              fontSize: "13px",
              color: "var(--text-1)",
              cursor: canEdit ? "pointer" : "default"
            }}>

            <input
              type="checkbox"
              checked={confirmCustomerDetails}
              onChange={(event) => setConfirmCustomerDetails(event.target.checked)}
              disabled={!canEdit}
              style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0 }} />

            <span>
              I confirm {jobData.customer || "the customer"}&apos;s contact details for this booking.
              <br />
              <span style={{ fontSize: "11px", color: "var(--grey-accent)", fontWeight: "400" }}>
                Required for booking updates and collection notifications.
              </span>
            </span>
          </label>
          {!confirmCustomerDetails && canEdit &&
          <div style={{ marginTop: "8px", marginLeft: "26px", fontSize: "12px", color: "var(--text-1)", fontWeight: "500" }}>
              Please confirm customer details before saving.
            </div>
          }
        </DevLayoutSection>

        <DevLayoutSection
          sectionKey="jobcard-tab-scheduling-action-buttons"
          sectionType="toolbar"
          parentKey="jobcard-tab-scheduling-actions"
          style={{ display: "flex", flex: "1 1 320px", flexWrap: "wrap", alignItems: "center", alignContent: "center", gap: "12px" }}>

        {/* Primary: Save Booking */}
        <button
            onClick={handleBookingSubmit}
            disabled={bookingButtonDisabled || vehicleOptions.length === 0}
            title={
            !confirmCustomerDetails ?
            "Confirm customer details first" :
            !selectedVehicleId ?
            "Select a vehicle first" :
            bookingRequestLines.length === 0 ?
            "No job requests to submit" :
            undefined
            }
            style={{
              padding: "var(--control-padding)",
              backgroundColor: bookingButtonDisabled ? "rgba(var(--primary-rgb), 0.08)" : "var(--primary)",
              color: bookingButtonDisabled ? "var(--primary-selected)" : "var(--text-2)",
              border: "none",
              borderRadius: "var(--control-radius)",
              cursor: bookingButtonDisabled ? "not-allowed" : "pointer",
              fontWeight: "600",
              fontSize: "var(--control-font-size)",
              minHeight: "var(--control-height)",
              opacity: bookingButtonDisabled ? 0.65 : 1,
              transition: "opacity 0.15s, background-color 0.15s"
            }}>

          {bookingFlowSaving ? "Saving..." : "Save Booking Details"}
        </button>

        {/* Feedback messages */}
        {bookingMessage &&
          <span style={{ fontSize: "13px", color: "var(--success)", fontWeight: "500" }}>
            {bookingMessage}
          </span>
          }
        {appointmentMessage &&
          <span style={{ fontSize: "13px", color: "var(--success)", fontWeight: "500" }}>
            {appointmentMessage}
          </span>
          }
        </DevLayoutSection>
      </DevLayoutSection>

    </div>);

}


function GoodsInPartsPanel({ goodsInParts = [], onAllocateParts, canAllocate }) {
  const hasParts = Array.isArray(goodsInParts) && goodsInParts.length > 0;
  const sortedParts = hasParts ?
  [...goodsInParts].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  }) :
  [];
  const allocateDisabled = !hasParts;

  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        style={{
          marginBottom: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap"
        }}>

        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "var(--text-1)" }}>
          PARTS ADDED TO JOB
        </h3>
        <button
          type="button"
          disabled={!canAllocate || allocateDisabled}
          onClick={() => {
            if (canAllocate && !allocateDisabled) {
              onAllocateParts?.();
            }
          }}
          title={
          !canAllocate ?
          "You do not have permission to allocate parts." :
          allocateDisabled ?
          "No parts have been added to this job yet." :
          ""
          }
          style={{
            padding: "var(--control-padding)",
            borderRadius: "var(--control-radius)",
            border: "none",
            background: !canAllocate || allocateDisabled ? "rgba(var(--primary-rgb), 0.06)" : "var(--primary)",
            color: !canAllocate || allocateDisabled ? "var(--text-1)" : "var(--text-2)",
            fontSize: "var(--control-font-size)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            minHeight: "var(--control-height)",
            cursor: !canAllocate || allocateDisabled ? "not-allowed" : "pointer",
            transition: "background 0.2s ease, color 0.2s ease"
          }}>

          Allocate to Request
        </button>
      </div>
      {!hasParts ?
      <div
        style={{
          padding: "20px",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface)",
          color: "var(--text-1)",
          fontSize: "14px",
          textAlign: "center"
        }}>

          No parts have been added to this job yet.
        </div> :

      <div
        style={{
          borderRadius: "var(--radius-md)",
          border: "none",
          background: "var(--surface)",
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: "300px"
        }}>

          <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: "0"
          }}>

            <thead>
              <tr style={{ background: "var(--surface)", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.08em" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Goods in #</th>
                <th style={{ textAlign: "left", padding: "12px 16px", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Part number</th>
                <th style={{ textAlign: "left", padding: "12px 16px", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Description</th>
                <th style={{ textAlign: "center", padding: "12px 16px", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Qty</th>
                <th style={{ textAlign: "right", padding: "12px 16px", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Retail</th>
                <th style={{ textAlign: "right", padding: "12px 16px", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Cost</th>
                <th style={{ textAlign: "left", padding: "12px 16px", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Invoice</th>
                <th style={{ textAlign: "left", padding: "12px 16px", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Added</th>
              </tr>
            </thead>
            <tbody>
              {sortedParts.map((line) =>
            <tr key={line.id} style={{ borderTop: "var(--separating-line)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                    {line.goodsInNumber || "GIN"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>{line.partNumber || "—"}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-1)" }}>{line.description || "No description"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>{line.quantity ?? 0}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>{formatMoney(line.retailPrice)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>{formatMoney(line.costPrice)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {line.invoiceNumber || "—"}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-1)" }}>
                    {formatDateTime(line.createdAt)}
                  </td>
                </tr>
            )}
            </tbody>
          </table>
        </div>
      }
    </div>);

}

// Parts Tab (TODO)
const normalizePartStatus = (status = "") => {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  if (["pending"].includes(normalized)) return "pending";
  if (["priced"].includes(normalized)) return "priced";
  if (["pre_pick", "pre-pick", "picked"].includes(normalized)) return "pre_pick";
  if (["on_order", "on-order", "awaiting_stock"].includes(normalized)) return "on_order";
  if (["stock", "allocated", "fitted"].includes(normalized)) return "stock";
  return "pending";
};

const PART_STATUS_META = {
  pending: { label: "Pending", color: "var(--danger-dark)", background: "var(--warning-surface)" },
  priced: { label: "Priced", color: "var(--accent-purple)", background: "var(--theme)" },
  pre_pick: { label: "Pre Pick", color: "var(--success-dark)", background: "var(--success-surface)" },
  on_order: { label: "On Order", color: "var(--warning)", background: "var(--warning-surface)" },
  stock: { label: "Stock", color: "var(--accent-purple)", background: "var(--theme)" }
};

const getPartStatusMeta = (status) => {
  const normalized = normalizePartStatus(status || "pending");
  return PART_STATUS_META[normalized] || PART_STATUS_META.pending;
};

const formatDateTime = (value) => {
  if (!value) return "Not recorded";
  try {
    return new Date(value).toLocaleString();
  } catch (_err) {
    return value;
  }
};

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP"
});

const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (Number.isNaN(amount)) return "—";
  return moneyFormatter.format(amount);
};

function PartsTab({ jobData, canEdit, onRefreshJob, actingUserId, actingUserNumericId }) {
  const jobId = jobData?.id;
  const jobNumber = jobData?.jobNumber;

  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [selectedCatalogPart, setSelectedCatalogPart] = useState(null);
  const [catalogQuantity, setCatalogQuantity] = useState(1);
  const [catalogSubmitError, setCatalogSubmitError] = useState("");
  const [catalogSuccessMessage, setCatalogSuccessMessage] = useState("");
  const [allocatingPart, setAllocatingPart] = useState(false);

  const canAllocateParts = Boolean(canEdit && jobId);
  const allocationDisabledReason = !canEdit ?
  "You don't have permission to add parts." :
  !jobId ?
  "Job must be loaded before allocating parts." :
  "";

  const searchStockCatalog = useCallback(async (term) => {
    const rawTerm = (term || "").trim();
    if (!rawTerm) {
      setCatalogResults([]);
      setCatalogError("");
      return;
    }

    setCatalogLoading(true);
    try {
      let query = (await loadSupabaseClient()).
      from("parts_catalog").
      select(
        "id, part_number, name, description, supplier, category, storage_location, qty_in_stock, qty_reserved, qty_on_order, unit_cost, unit_price"
      ).
      order("name", { ascending: true }).
      limit(25);

      const sanitised = rawTerm.replace(/[%]/g, "").replace(/,/g, "");
      const pattern = `%${sanitised}%`;
      const clauses = [
      `name.ilike.${pattern}`,
      `part_number.ilike.${pattern}`,
      `supplier.ilike.${pattern}`,
      `category.ilike.${pattern}`,
      `description.ilike.${pattern}`,
      `oem_reference.ilike.${pattern}`,
      `storage_location.ilike.${pattern}`];

      if (/^\d+(?:\.\d+)?$/.test(sanitised)) {
        const numericValue = Number.parseFloat(sanitised);
        if (!Number.isNaN(numericValue)) {
          clauses.push(`unit_price.eq.${numericValue}`);
          clauses.push(`unit_cost.eq.${numericValue}`);
        }
      }
      query = query.or(clauses.join(","));

      const { data, error } = await query;
      if (error) throw error;
      setCatalogResults(data || []);
      if (!data || data.length === 0) {
        setCatalogError("No parts found in stock catalogue.");
      } else {
        setCatalogError("");
      }
    } catch (error) {
      logFailure("Stock search failed", error);
      setCatalogResults([]);
      setCatalogError(error.message || "Unable to search stock catalogue");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canAllocateParts) {
      setCatalogResults([]);
      setCatalogError("");
      return;
    }
    const trimmed = (catalogSearch || "").trim();
    if (!trimmed) {
      setCatalogResults([]);
      setCatalogError("");
      return;
    }
    if (trimmed.length < 2) {
      setCatalogResults([]);
      setCatalogError("Enter at least 2 characters to search stock.");
      return;
    }
    const timer = setTimeout(() => searchStockCatalog(trimmed), 300);
    return () => clearTimeout(timer);
  }, [catalogSearch, canAllocateParts, searchStockCatalog]);

  const handleCatalogSelect = useCallback((part) => {
    if (!part) return;
    setSelectedCatalogPart(part);
    setCatalogQuantity(1);
    setCatalogSubmitError("");
    setCatalogSuccessMessage("");
  }, []);

  const clearSelectedCatalogPart = useCallback(() => {
    setSelectedCatalogPart(null);
    setCatalogQuantity(1);
    setCatalogSubmitError("");
    setCatalogSuccessMessage("");
  }, []);

  useEffect(() => {
    if (!canAllocateParts) {
      setCatalogSearch("");
      clearSelectedCatalogPart();
      setCatalogSuccessMessage("");
      setCatalogSubmitError("");
    }
  }, [canAllocateParts, clearSelectedCatalogPart]);

  const handleAddPartFromStock = useCallback(async () => {
    if (!canAllocateParts || !selectedCatalogPart || !jobId) {
      setCatalogSubmitError("Select a part to allocate from stock.");
      return;
    }
    if (catalogQuantity <= 0) {
      setCatalogSubmitError("Quantity must be at least 1.");
      return;
    }
    const availableStock = Number(selectedCatalogPart.qty_in_stock || 0);
    if (catalogQuantity > availableStock) {
      setCatalogSubmitError(`Only ${availableStock} in stock for this part.`);
      return;
    }

    setAllocatingPart(true);
    setCatalogSubmitError("");
    setCatalogSuccessMessage("");
    try {
      const response = await fetch("/api/parts/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          partId: selectedCatalogPart.id,
          quantityRequested: catalogQuantity,
          allocateFromStock: true,
          storageLocation: selectedCatalogPart.storage_location || null,
          requestNotes: jobNumber ? `Added via job card ${jobNumber}` : "Added via job card",
          origin: "job_card",
          userId: actingUserId,
          userNumericId: actingUserNumericId
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to allocate part from stock");
      }

      setCatalogSuccessMessage(`${selectedCatalogPart.part_number || selectedCatalogPart.name} added to job.`);
      clearSelectedCatalogPart();
      if (typeof onRefreshJob === "function") {
        onRefreshJob();
      }
      if ((catalogSearch || "").trim().length >= 2) {
        searchStockCatalog(catalogSearch.trim());
      }
    } catch (error) {
      logFailure("Unable to add part from stock", error);
      setCatalogSubmitError(error.message || "Unable to add part to job");
    } finally {
      setAllocatingPart(false);
    }
  }, [
  actingUserId,
  actingUserNumericId,
  canAllocateParts,
  catalogQuantity,
  catalogSearch,
  clearSelectedCatalogPart,
  jobId,
  jobNumber,
  onRefreshJob,
  searchStockCatalog,
  selectedCatalogPart]
  );
  const vhcParts = (Array.isArray(jobData.partsAllocations) ? jobData.partsAllocations : []).map((item) => ({
    id: item.id,
    partNumber: item.part?.partNumber || "N/A",
    name: item.part?.name || "Part",
    description: item.part?.description || "",
    status: item.status || "pending",
    quantityRequested: item.quantityRequested ?? 0,
    quantityAllocated: item.quantityAllocated ?? 0,
    quantityFitted: item.quantityFitted ?? 0,
    source: item.origin && item.origin.toLowerCase() === "vhc" ? "VHC" : "Manual",
    prePickLocation: item.prePickLocation || "Not assigned",
    storageLocation: item.storageLocation || "Not assigned",
    notes: item.requestNotes || "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));

  const pipelineSummary = useMemo(
    () => summarizePartsPipeline(vhcParts, { quantityField: "quantityRequested" }),
    [vhcParts]
  );
  const pipelineStages = pipelineSummary.stageSummary || [];

  const manualRequests = (Array.isArray(jobData.partsRequests) ? jobData.partsRequests : []).map((request) => ({
    requestId: request.requestId,
    partNumber: request.part?.partNumber || "Custom",
    name: request.part?.name || request.description || "Part",
    description: request.description || "",
    status: request.status || "pending",
    quantity: request.quantity ?? 0,
    requestedBy: request.requestedBy || "Technician",
    approvedBy: request.approvedBy || null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt
  }));

  const hasParts = vhcParts.length > 0 || manualRequests.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div
        style={{
          background: "var(--surface)",
          border: "none",
          borderRadius: "var(--control-radius)",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <div>
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "var(--primary)",
                letterSpacing: "0.06em",
                textTransform: "uppercase"
              }}>

              Add Part From Stock
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info-dark)" }}>
              Search the catalogue and allocate parts directly to this job. Allocation immediately reduces stock.
            </p>
          </div>
          {!canAllocateParts && allocationDisabledReason &&
          <span style={{ fontSize: "0.75rem", color: "var(--info)" }}>{allocationDisabledReason}</span>
          }
        </div>
        <SearchBar
          value={catalogSearch}
          disabled={!canAllocateParts}
          onChange={(event) => {
            setCatalogSearch(event.target.value);
            setCatalogSuccessMessage("");
            setCatalogSubmitError("");
          }}
          onClear={() => {
            setCatalogSearch("");
            setCatalogSuccessMessage("");
            setCatalogSubmitError("");
          }}
          placeholder={canAllocateParts ? "Search by part number or description" : "Stock allocation disabled"}
          style={{
            width: "100%",
            opacity: canAllocateParts ? 1 : 0.7
          }} />

        {catalogLoading &&
        <div style={{ fontSize: "0.85rem", color: "var(--info)" }}>Searching stock...</div>
        }
        {!catalogLoading && catalogError &&
        <div style={{ fontSize: "0.8rem", color: "var(--danger)" }}>{catalogError}</div>
        }
        {canAllocateParts && !catalogLoading && catalogResults.length > 0 &&
        <div
          style={{
            maxHeight: "220px",
            overflowY: "auto",
            border: "none",
            borderRadius: "var(--radius-sm)"
          }}>

            {catalogResults.map((part) => {
            const isSelected = selectedCatalogPart?.id === part.id;
            return (
              <button
                key={part.id}
                type="button"
                onClick={() => handleCatalogSelect(part)}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "none",
                  borderBottom: "var(--separating-line)",
                  textAlign: "left",
                  background: isSelected ? "var(--theme)" : "transparent",
                  cursor: "pointer"
                }}>

                  <div style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{part.name}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--info-dark)" }}>
                    Part #: {part.part_number} · Supplier: {part.supplier || "Unknown"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--info)" }}>
                    Stock: {part.qty_in_stock ?? 0} · £{Number(part.unit_price || 0).toFixed(2)} · {part.category || "Uncategorised"}
                  </div>
                </button>);

          })}
          </div>
        }
        {selectedCatalogPart &&
        <div
          style={{
            border: "none",
            borderRadius: "var(--radius-sm)",
            padding: "12px",
            background: "var(--theme)"
          }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--accent-purple)", fontSize: "1rem" }}>{selectedCatalogPart.name}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--info-dark)" }}>
                  Part #: {selectedCatalogPart.part_number} · Location: {selectedCatalogPart.storage_location || "Unassigned"}
                </div>
              </div>
              <button
              type="button"
              onClick={clearSelectedCatalogPart}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--info)",
                cursor: "pointer",
                fontWeight: 600
              }}>

                Clear
              </button>
            </div>
            <div
            style={{
              marginTop: "12px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
              gap: "12px"
            }}>

              <label style={{ fontSize: "0.8rem", color: "var(--info-dark)" }}>
                Quantity
                <input
                type="number"
                min="1"
                max={selectedCatalogPart.qty_in_stock || undefined}
                value={catalogQuantity}
                onChange={(event) =>
                setCatalogQuantity(Math.max(1, Number.parseInt(event.target.value, 10) || 1))
                }
                style={{
                  width: "100%",
                  padding: "var(--control-padding)",
                  borderRadius: "var(--control-radius)",
                  border: "none",
                  marginTop: "4px",
                  minHeight: "var(--control-height)",
                  fontSize: "var(--control-font-size)"
                }} />

              </label>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--info-dark)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Available
                </div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--accent-purple)" }}>
                  {selectedCatalogPart.qty_in_stock ?? 0}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--info)" }}>
                  Reserved: {selectedCatalogPart.qty_reserved ?? 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--info-dark)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Sell Price
                </div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--accent-purple)" }}>
                  £{Number(selectedCatalogPart.unit_price || 0).toFixed(2)}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--info)" }}>
                  Cost £{Number(selectedCatalogPart.unit_cost || 0).toFixed(2)}
                </div>
              </div>
            </div>
            {catalogSubmitError &&
          <div style={{ marginTop: "10px", padding: "10px", borderRadius: "var(--control-radius)", background: "var(--warning-surface)", color: "var(--danger)" }}>
                {catalogSubmitError}
              </div>
          }
            {catalogSuccessMessage &&
          <div style={{ marginTop: "10px", padding: "10px", borderRadius: "var(--control-radius)", background: "var(--success-surface)", color: "var(--success-dark)" }}>
                {catalogSuccessMessage}
              </div>
          }
            <button
            type="button"
            onClick={handleAddPartFromStock}
            disabled={!canAllocateParts || allocatingPart}
            style={{
              marginTop: "12px",
              padding: "var(--control-padding)",
              borderRadius: "var(--control-radius)",
              border: "none",
              background: !canAllocateParts ? "rgba(var(--primary-rgb), 0.08)" : "var(--primary)",
              color: !canAllocateParts ? "var(--primary-selected)" : "var(--text-2)",
              fontWeight: 600,
              fontSize: "var(--control-font-size)",
              minHeight: "var(--control-height)",
              cursor: !canAllocateParts ? "not-allowed" : "pointer"
            }}>

              {allocatingPart ? "Adding..." : `Add to Job ${jobNumber || ""}`}
            </button>
          </div>
        }
      </div>
      {hasParts ?
      <>
          <div
          style={{
            background: "var(--surface)",
            border: "none",
            borderRadius: "var(--control-radius)",
            padding: "16px"
          }}>

            <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "var(--primary)",
              letterSpacing: "0.05em",
              textTransform: "uppercase"
            }}>

              Parts Pipeline
            </div>
            <div
            style={{
              marginTop: "12px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "10px"
            }}>

              {pipelineStages.map((stage) =>
            <div
              key={stage.id}
              style={{
                padding: "10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: stage.count > 0 ? "var(--surface)" : "var(--theme)"
              }}>

                  <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--primary)" }}>
                    {stage.count}
                  </div>
                  <div style={{ fontWeight: 600 }}>{stage.label}</div>
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--info-dark)" }}>
                    {stage.description}
                  </p>
                </div>
            )}
            </div>
            <p style={{ marginTop: "12px", fontSize: "0.85rem", color: "var(--info-dark)" }}>
              {pipelineSummary.totalCount} part line
              {pipelineSummary.totalCount === 1 ? "" : "s"} currently tracked across these stages.
            </p>
          </div>
          <div>
            <h2 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "600", color: "var(--info-dark)" }}>
              VHC Linked Parts
            </h2>
            {vhcParts.length === 0 ?
          <div style={{
            padding: "20px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            backgroundColor: "var(--theme)",
            fontSize: "14px",
            color: "var(--info)"
          }}>
                No VHC items have been converted into parts for this job yet.
              </div> :

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {vhcParts.map((part) => {
              const statusMeta = getPartStatusMeta(part.status);
              return (
                <div
                  key={part.id}
                  style={{
                    padding: "16px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    backgroundColor: "var(--surface)"
                  }}>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div>
                          <div style={{ fontSize: "12px", color: "var(--info)" }}>{part.partNumber}</div>
                          <h3 style={{ margin: "2px 0", fontSize: "16px", fontWeight: "600", color: "var(--accent-purple)" }}>
                            {part.name}
                          </h3>
                          {part.description &&
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--info-dark)" }}>{part.description}</p>
                      }
                        </div>
                        <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: "var(--control-radius)",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: statusMeta.color,
                        backgroundColor: statusMeta.background
                      }}>

                          {statusMeta.label}
                        </span>
                      </div>

                      <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
                    gap: "12px",
                    marginTop: "12px",
                    fontSize: "13px",
                    color: "var(--info-dark)"
                  }}>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Qty Requested</strong>
                          <div style={{ fontWeight: "700", fontSize: "16px" }}>{part.quantityRequested}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Qty Allocated</strong>
                          <div style={{ fontWeight: "700", fontSize: "16px" }}>{part.quantityAllocated}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Qty Fitted</strong>
                          <div style={{ fontWeight: "700", fontSize: "16px" }}>{part.quantityFitted}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Source</strong>
                          <div>{part.source}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Pre Pick Location</strong>
                          <div>{part.prePickLocation}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Storage</strong>
                          <div>{part.storageLocation}</div>
                        </div>
                      </div>

                      <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "20px", fontSize: "12px", color: "var(--info)" }}>
                        <span>Created: {formatDateTime(part.createdAt)}</span>
                        <span>Updated: {formatDateTime(part.updatedAt)}</span>
                      </div>

                      {part.notes &&
                  <div style={{
                    marginTop: "12px",
                    padding: "10px 12px",
                    borderRadius: "var(--control-radius)",
                    backgroundColor: "var(--warning-surface)",
                    color: "var(--danger-dark)",
                    fontSize: "13px"
                  }}>
                          <strong style={{ fontSize: "12px", textTransform: "uppercase" }}>Technician Note:</strong>
                          <div>{part.notes}</div>
                        </div>
                  }
                    </div>);

            })}
              </div>
          }
          </div>

          <div>
            <h2 style={{ margin: "12px 0", fontSize: "18px", fontWeight: "600", color: "var(--info-dark)" }}>
              Manual Requests (Write-up)
            </h2>
            {manualRequests.length === 0 ?
          <div style={{
            padding: "20px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            backgroundColor: "var(--theme)",
            fontSize: "14px",
            color: "var(--info)"
          }}>
                No manual part requests have been logged.
              </div> :

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {manualRequests.map((request) => {
              const statusMeta = getPartStatusMeta(request.status);
              return (
                <div
                  key={request.requestId}
                  style={{
                    padding: "16px",
                    borderRadius: "var(--radius-sm)",
                                        backgroundColor: "var(--surface)"
                  }}>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div>
                          <div style={{ fontSize: "12px", color: "var(--info)" }}>{request.partNumber}</div>
                          <h3 style={{ margin: "2px 0", fontSize: "16px", fontWeight: "600", color: "var(--accent-purple)" }}>
                            {request.name}
                          </h3>
                          {request.description &&
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--info-dark)" }}>{request.description}</p>
                      }
                        </div>
                        <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: "var(--control-radius)",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: statusMeta.color,
                        backgroundColor: statusMeta.background
                      }}>

                          {statusMeta.label}
                        </span>
                      </div>

                      <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
                    gap: "12px",
                    marginTop: "12px",
                    fontSize: "13px",
                    color: "var(--info-dark)"
                  }}>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Quantity</strong>
                          <div style={{ fontWeight: "700", fontSize: "16px" }}>{request.quantity}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Requested By</strong>
                          <div>{request.requestedBy}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Approved By</strong>
                          <div>{request.approvedBy || "Awaiting approval"}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Created</strong>
                          <div>{formatDateTime(request.createdAt)}</div>
                        </div>
                      </div>
                    </div>);

            })}
              </div>
          }
          </div>

          <p style={{ marginTop: "4px", color: "var(--info)", fontSize: "12px" }}>
            All data shown is read-only. Updates must be made from the VHC parts workflow or technician write-up form.
          </p>
        </> :

      <div>
          <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "var(--text-1)" }}>
            Parts Overview
          </h2>
          <div style={{
          padding: "40px",
          textAlign: "center",
          backgroundColor: "var(--theme)",
          borderRadius: "var(--radius-sm)",
        }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>ðŸ§°</div>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--accent-purple)", marginBottom: "8px" }}>
              No Parts Linked
            </h3>
            <p style={{ color: "var(--info)", fontSize: "14px", margin: 0 }}>
              VHC authorizations and manual write-up requests will appear here automatically.
            </p>
          </div>
        </div>
      }
    </div>);

}

// Notes Tab
function NotesTab({ value, onChange, canEdit, saving, meta }) {
  const lastUpdated =
  meta?.updatedAt || meta?.createdAt ?
  new Date(meta?.updatedAt || meta?.createdAt).toLocaleString("en-GB", {
    hour12: false,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }) :
  null;
  const updatedBy =
  meta?.lastUpdatedBy || meta?.createdBy || "Unassigned";

  return (
    <div>
      <div style={{
        padding: "20px",
        backgroundColor: "var(--surface)",
        borderRadius: "var(--radius-sm)",
      }}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={!canEdit}
          placeholder="Type job notes here. Changes are saved automatically."
          style={{
            width: "100%",
            minHeight: "360px",
            maxHeight: "65vh",
            padding: "18px",
            borderRadius: "var(--control-radius)",
            border: "none",
            fontSize: "16px",
            lineHeight: 1.7,
            resize: "vertical",
            backgroundColor: canEdit ? "var(--surface)" : "rgba(var(--primary-rgb), 0.04)",
            color: "var(--info-dark)"
          }} />

        <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "13px", color: "var(--info)", gap: "16px" }}>
          <div>
            {lastUpdated ?
            <>
                Last updated by <strong style={{ color: "var(--accent-purple)" }}>{updatedBy}</strong> on{" "}
                <strong style={{ color: "var(--accent-purple)" }}>{lastUpdated}</strong>
                {meta?.lastUpdatedByEmail ?
              <div style={{ fontSize: "11px", color: "var(--info)", marginTop: "2px" }}>
                    {meta.lastUpdatedByEmail}
                  </div> :
              null}
              </> :

            "No notes recorded yet."
            }
          </div>
          <div style={{ fontSize: "12px", color: saving ? "var(--warning)" : "var(--info)" }}>
            {saving ? "Saving..." : "Synced"}
          </div>
        </div>
      </div>
    </div>);

}

// VHC Tab
function VHCTab({
  jobNumber,
  jobData,
  canEdit = true,
  canShowCustomerActions = false,
  actingUserId = null,
  actingUserNumericId = null,
  actingUserName = "",
  onFinancialTotalsChange,
  onJobDataRefresh,
  onVhcCustomerStatusReload = async () => {},
  onUpdateRequestPrePickLocation = async () => {},
  onToggleVhcRequired = () => {},
  canToggleVhcRequired = false
}) {
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [previewOpened, setPreviewOpened] = useState(false);
  const [sendingVhc, setSendingVhc] = useState(false);
  const [sendVhcMessage, setSendVhcMessage] = useState("");

  // Enable actions only when all Summary tab tickboxes are complete.
  const [allCheckboxesComplete, setAllCheckboxesComplete] = useState(false);
  const [checkboxesLockReason, setCheckboxesLockReason] = useState("");
  const actionsEnabled = canEdit && allCheckboxesComplete;
  const hasAwaitingCustomerDecision = useMemo(() => {
    // Routed through the engine in Phase 1: projectVhcItem normalises the row,
    // getDisplayStatus computes the same dotStateKey buildVhcRowStatusView used
    // to compute inline. Behaviour is byte-identical — "awaiting" still means
    // pending decision with labour AND parts filled in (the gate for "Send VHC").
    const checks = Array.isArray(jobData?.vhcChecks) ? jobData.vhcChecks : [];
    return checks.some((check) => {
      const section = (check?.section || "").toString().trim();
      if (section === "VHC_CHECKSHEET" || section === "VHC Checksheet") return false;
      const item = projectVhcItem(check, { job: jobData });
      return getDisplayStatus(item)?.dotStateKey === "awaiting";
    });
  }, [jobData?.vhcChecks, jobData?.vhc_sent_at]);
  // Send button enables once any row has a decided/awaiting status (awaiting,
  // approved/authorised/completed, or declined). Stays clickable after rows
  // move out of "awaiting" so users can re-send post-decision.
  const sendVhcEnabled = useMemo(() => {
    const checks = Array.isArray(jobData?.vhcChecks) ? jobData.vhcChecks : [];
    return checks.some((check) => {
      const section = (check?.section || "").toString().trim();
      if (section === "VHC_CHECKSHEET" || section === "VHC Checksheet") return false;
      const item = projectVhcItem(check, { job: jobData });
      const key = getDisplayStatus(item)?.dotStateKey;
      return key === "awaiting" || key === "approved" || key === "declined";
    });
  }, [jobData?.vhcChecks, jobData?.vhc_sent_at]);
  const customerViewUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/vhc/customer-preview/${jobNumber}`;
  }, [jobNumber]);

  useEffect(() => {
    if (typeof window === "undefined" || !jobNumber) return;
    const stored = window.localStorage.getItem(`vhc-preview-opened-${jobNumber}`);
    if (stored === "1") {
      setPreviewOpened(true);
    }
  }, [jobNumber]);

  const handleCustomerViewClick = () => {
    setPreviewOpened(true);
    if (typeof window !== "undefined" && jobNumber) {
      window.localStorage.setItem(`vhc-preview-opened-${jobNumber}`, "1");
    }
    window.location.assign(customerViewUrl);
  };

  // Generate a shareable link (24-hour expiry) and copy to clipboard.
  const handleCopyToClipboard = async () => {
    setGeneratingLink(true);
    try {
      const response = await fetch(`/api/job-cards/${jobNumber}/share-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate share link");
      }

      const { linkCode } = await response.json();
      // Match send-vhc: customers must always receive a publicly reachable URL,
      // never localhost. Override via NEXT_PUBLIC_VHC_BASE_URL / NEXT_PUBLIC_APP_URL
      // when developing against a tunnel.
      const publicOrigin = (
      process.env.NEXT_PUBLIC_VHC_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL || (
      typeof window !== "undefined" && !/localhost|127\.0\.0\.1/.test(window.location.origin) ?
      window.location.origin :
      "https://hnpsystem.vercel.app")).
      replace(/\/+$/, "");
      const shareUrl = buildCustomerReportUrl(linkCode, publicOrigin);

      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logFailure("Failed to copy to clipboard", error);
      alert("Failed to copy link to clipboard: " + error.message);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleSendVhc = async () => {
    if (!sendVhcEnabled || sendingVhc) return;

    setSendingVhc(true);
    setSendVhcMessage("");
    try {
      const response = await fetch(`/api/job-cards/${jobNumber}/send-vhc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: jobData?.id ?? null,
          customerEmail: jobData?.customerEmail || null,
          sentBy: actingUserNumericId ?? actingUserId ?? null,
          sentByName: actingUserName || null
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to send VHC");
      }

      setSendVhcMessage("VHC sent");
      await onVhcCustomerStatusReload();
      if (typeof onJobDataRefresh === "function") {
        onJobDataRefresh();
      }
    } catch (error) {
      logFailure("Failed to send VHC", error);
      setSendVhcMessage(error?.message || "Failed to send VHC");
    } finally {
      setSendingVhc(false);
    }
  };

  const customActions = (activeVhcTab) =>
  activeVhcTab === "summary" ?
  <>
      {/* "Customer VHC: <status>" badge now lives in the job-card customer */}
      {/* summary card — see JobCardDetailPageUi jobcard-summary-customer. */}
      {/* VHC required toggle — moved here from the Customer Requests tab so it */}
      {/* lives alongside the VHC tabs and stays reachable even when VHC is */}
      {/* marked Not Required (the tab no longer hides). */}
      {canToggleVhcRequired &&
      <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => onToggleVhcRequired(!jobData?.vhcRequired)}
      title={jobData?.vhcRequired ? "Mark VHC as not required for this job" : "Mark VHC as required for this job"}>
        {jobData?.vhcRequired ? "Mark VHC Not Required" : "Mark VHC Required"}
      </Button>}
      <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleCustomerViewClick}
      title="Open customer preview">
        View
      </Button>
      <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleCopyToClipboard}
      disabled={generatingLink}
      title={copied ? "Copied!" : "Copy shareable link (expires in 24 hours)"}>
        {generatingLink ? "..." : copied ? "Copied" : "Copy"}
      </Button>
      {/* TODO: After testing, lock the Send button to fire only once per job — */}
      {/* relabel to "Sent" and disable after a successful first send (track via */}
      {/* jobData.vhc_sent_at or a local state mirror) so the same email can't */}
      {/* be re-sent. For now multiple sends are allowed for debugging. */}
      <Button
      type="button"
      variant="primary"
      size="sm"
      busy={sendingVhc}
      onClick={handleSendVhc}
      disabled={!sendVhcEnabled}
      title={!sendVhcEnabled ? "Awaiting customer decision must be set on a Red or Amber row before sending." : "Send interactive VHC to customer"}>
        {sendingVhc ? "Sending..." : "Send"}
      </Button>
      {sendVhcMessage ?
    <span
      style={{
        fontSize: "12px",
        fontWeight: 600,
        color: sendVhcMessage === "VHC sent" ? "var(--success)" : "var(--danger)"
      }}>

          {sendVhcMessage}
        </span> :
    null}
    </> :
  null;


  return (
    <DevLayoutSection
      sectionKey="jobcard-tab-vhc-panel"
      sectionType="section-shell"
      parentKey="jobcard-tab-vhc"
      backgroundToken="surface"
      shell>

      <VhcDetailsPanel
        jobNumber={jobNumber}
        readOnly={!canEdit}
        showNavigation={false}
        customActions={customActions}
        onCheckboxesComplete={setAllCheckboxesComplete}
        onCheckboxesLockReason={setCheckboxesLockReason}
        onFinancialTotalsChange={onFinancialTotalsChange}
        onJobDataRefresh={onJobDataRefresh}
        onUpdateRequestPrePickLocation={onUpdateRequestPrePickLocation}
        devOverlayAutoOutline
        devOverlayPageContext="Job card detail"
        devOverlayTabContext="VHC"
        devOverlayCardContext="VHC panel"
        enableTabs />

    </DevLayoutSection>);

}

// Messages Tab
// Helper function to render message content with clickable slash commands
const renderMessageContentWithLinks = (content) => {
  if (!content) return null;

  const parts = [];
  let lastIndex = 0;
  const regex = /\/(job)?(\d+)|\/cust([a-zA-Z]+)|\/customer|\/vehicle/gi;

  let match;
  while ((match = regex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    const fullMatch = match[0];
    const isJob = match[1] !== undefined || /^\/\d+/.test(fullMatch);
    const jobNumber = match[2];
    const custName = match[3];

    if (isJob && jobNumber) {
      // /job[number] or /[number]
      parts.push(
        <a
          key={match.index}
          href={`/job-cards/${jobNumber}?tab=messages`}
          style={{
            color: "var(--primary)",
            textDecoration: "underline",
            fontWeight: 600
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}>

          {fullMatch}
        </a>
      );
    } else if (custName) {
      // /cust[name]
      parts.push(
        <span
          key={match.index}
          style={{
            fontWeight: 600,
            textDecoration: "underline",
            color: "var(--accent-purple)"
          }}
          title={`Customer: ${custName}`}>

          {fullMatch}
        </span>
      );
    } else {
      // /customer or /vehicle
      parts.push(
        <span
          key={match.index}
          style={{
            fontWeight: 600,
            color: "var(--info-dark)"
          }}>

          {fullMatch}
        </span>
      );
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length > 0 ? parts : content;
};

function MessagesTab({ thread, jobId, jobNumber, customerEmail, customerName, dbUserId }) {
  const [activeCustomerThread, setActiveCustomerThread] = useState(thread || null);
  const [chatMessages, setChatMessages] = useState(() => Array.isArray(thread?.messages) ? thread.messages : []);
  const [messageDraft, setMessageDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const customerScrollerRef = useRef(null);
  const normalizedJobNumber = String(jobNumber || "").trim();

  const loadCustomerConversation = useCallback(async () => {
    if (!dbUserId || !normalizedJobNumber) return;
    setChatLoading(true);
    setChatError("");
    try {
      const threadPayload = await ensureJobCustomerThread({
        jobId,
        jobNumber: normalizedJobNumber,
        actorId: dbUserId,
        customerEmail,
        customerName
      });
      const nextThread = threadPayload?.thread || threadPayload?.data || null;
      if (!nextThread?.id) {
        throw new Error("Customer conversation could not be loaded.");
      }
      setActiveCustomerThread(nextThread);
      const messagesPayload = await fetchThreadMessages(nextThread.id, {
        userId: dbUserId,
        limit: 80
      });
      setChatMessages(messagesPayload?.data || messagesPayload?.messages || []);
    } catch (err) {
      logFailure("Failed to load job customer conversation:", err);
      setChatError(err?.message || "Unable to load the customer conversation.");
    } finally {
      setChatLoading(false);
    }
  }, [customerEmail, customerName, dbUserId, jobId, normalizedJobNumber]);

  useEffect(() => {
    loadCustomerConversation();
  }, [loadCustomerConversation]);

  useEffect(() => {
    if (!customerScrollerRef.current) return;
    customerScrollerRef.current.scrollTop = customerScrollerRef.current.scrollHeight;
  }, [chatMessages.length, chatLoading]);

  const handleSendCustomerMessage = useCallback(async (event) => {
    event?.preventDefault();
    const content = messageDraft.trim();
    if (!content || !activeCustomerThread?.id || !dbUserId || chatSending) return;

    setChatSending(true);
    setChatError("");
    try {
      const payload = await sendThreadMessage(activeCustomerThread.id, {
        senderId: dbUserId,
        content,
        metadata: {
          audience: "customer",
          customerVisible: true,
          jobNumber: normalizedJobNumber
        }
      });
      const nextMessage = payload?.data || payload?.message || null;
      setMessageDraft("");
      if (nextMessage) {
        setChatMessages((prev) => [...prev, nextMessage]);
      }
      await loadCustomerConversation();
    } catch (err) {
      logFailure("Failed to send job customer message:", err);
      setChatError(err?.message || "Unable to send the message.");
    } finally {
      setChatSending(false);
    }
  }, [activeCustomerThread?.id, chatSending, dbUserId, loadCustomerConversation, messageDraft, normalizedJobNumber]);

  return (
    <DevLayoutSection
      data-presentation="messages-conversation"
      sectionKey="jobcard-customer-conversation-panel"
      parentKey="jobcard-tab-messages"
      sectionType="section-shell"
      shell
      backgroundToken="surface"
      style={{
        minHeight: "520px",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}>

      <DevLayoutSection
        sectionKey="jobcard-customer-conversation-header"
        parentKey="jobcard-customer-conversation-panel"
        sectionType="section-header-row"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap"
        }}>
        <div>
          <h3 style={{ margin: 0, color: "var(--accentText)", fontSize: "18px", fontWeight: 700 }}>
            {activeCustomerThread?.title || `Job #${normalizedJobNumber} customer messages`}
          </h3>
          <p style={{ margin: "4px 0 0", color: "var(--grey-accent)", fontSize: "0.9rem" }}>
            {customerEmail ? `Customer: ${customerEmail}` : "Customer email required before messages can be sent."}
          </p>
        </div>
        {chatLoading &&
        <span style={{ color: "var(--grey-accent)", fontSize: "0.85rem", fontWeight: 600 }}>
            Loading...
          </span>
        }
      </DevLayoutSection>

      <DevLayoutSection
        ref={customerScrollerRef}
        sectionKey="jobcard-customer-conversation-feed"
        parentKey="jobcard-customer-conversation-panel"
        sectionType="section-shell"
        shell
        backgroundToken="theme"
        style={{
          flex: 1,
          minHeight: "300px",
          maxHeight: "min(58vh, 560px)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          padding: "18px 12px",
          borderRadius: "var(--radius-md)",
          background: "var(--theme)"
        }}>
        {chatLoading && chatMessages.length === 0 &&
        <p style={{ margin: 0, color: "var(--grey-accent)", textAlign: "center" }}>
            Loading messages...
          </p>
        }
        {!chatLoading && chatMessages.length === 0 &&
        <p style={{ margin: 0, color: "var(--grey-accent)", textAlign: "center" }}>
            No messages yet.
          </p>
        }
        {chatMessages.map((message) => {
          const isMine = Number(message.senderId) === Number(dbUserId);
          return (
            <div
              key={message.id || `${message.createdAt}-${message.content}`}
              data-dev-section="1"
              data-dev-section-key={`jobcard-customer-message-${message.id}`}
              data-dev-section-type="content-card"
              data-dev-section-parent="jobcard-customer-conversation-feed"
              data-dev-background-token={isMine ? "messages-bubble-mine" : "messages-bubble-peer"}
              style={{
                display: "flex",
                justifyContent: isMine ? "flex-end" : "flex-start"
              }}>
              <div
                style={{
                  maxWidth: "min(76%, 720px)",
                  padding: "10px 14px",
                  borderRadius: isMine ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
                  backgroundColor: isMine ? "rgba(var(--accent-purple-rgb), 0.14)" : "var(--surface)",
                  color: "var(--text-1)",
                  boxShadow: "var(--shadow-md)"
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "baseline" }}>
                  <strong style={{ color: "var(--accentText)", fontSize: "0.86rem" }}>
                    {message.sender?.name || "Team Member"}
                  </strong>
                  <span style={{ color: "var(--grey-accent)", fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                    {message.createdAt ? new Date(message.createdAt).toLocaleString("en-GB") : ""}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.45, fontSize: "0.94rem" }}>
                  {renderMessageContentWithLinks(message.content)}
                </p>
              </div>
            </div>
          );
        })}
      </DevLayoutSection>

      <DevLayoutSection
        as="form"
        sectionKey="jobcard-customer-conversation-composer"
        parentKey="jobcard-customer-conversation-panel"
        sectionType="toolbar"
        onSubmit={handleSendCustomerMessage}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}>
        <textarea
          rows={3}
          value={messageDraft}
          onChange={(event) => setMessageDraft(event.target.value)}
          placeholder="Write a message to the customer..."
          disabled={!activeCustomerThread?.id || chatSending || chatLoading}
          style={{
            width: "100%",
            borderRadius: "var(--control-radius)",
            border: "none",
            outline: "none",
            padding: "12px 14px",
            resize: "vertical",
            minHeight: "92px",
            backgroundColor: "var(--surface)",
            color: "var(--text-1)"
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: chatError ? "var(--danger)" : "var(--grey-accent)", fontSize: "0.85rem" }}>
            {chatError}
          </span>
          <button
            type="submit"
            disabled={!messageDraft.trim() || !activeCustomerThread?.id || chatSending || chatLoading}
            style={{
              minHeight: "44px",
              padding: "10px 18px",
              borderRadius: "var(--control-radius)",
              border: "none",
              backgroundColor: "var(--primary)",
              color: "var(--text-2)",
              fontWeight: 700,
              cursor: !messageDraft.trim() || !activeCustomerThread?.id || chatSending || chatLoading ? "not-allowed" : "pointer",
              opacity: !messageDraft.trim() || !activeCustomerThread?.id || chatSending || chatLoading ? 0.65 : 1
            }}>
            {chatSending ? "Sending..." : "Send"}
          </button>
        </div>
      </DevLayoutSection>
    </DevLayoutSection>);

  /* Legacy summary/CTA UI removed in favour of the embedded customer conversation panel.
  const participants = Array.isArray(thread?.participants) ? thread.participants : [];
  const normalizeRole = (value = "") => (value || "").toLowerCase().trim();
  const customerMember = participants.find((member) =>
  normalizeRole(member.role).includes("customer")
  );
  const allowedStaffRoleKeywords = [
  "service",
  "service advisor",
  "service manager",
  "workshop manager",
  "after-sales manager",
  "after sales manager",
  "after-sales",
  "after sales"];

  const isAllowedStaff = (member = {}) => {
    const role = normalizeRole(member.role);
    return allowedStaffRoleKeywords.some((keyword) => role.includes(keyword));
  };
  const staffMembers = participants.filter(
    (member) => !normalizeRole(member.role).includes("customer") && isAllowedStaff(member)
  );
  const customerLinked = Boolean(customerEmail && customerMember);
  const messages = (Array.isArray(thread?.messages) ? thread.messages : []).filter((message) => {
    const role = normalizeRole(message.sender?.role);
    const isCustomerMessage = role.includes("customer") || message.audience === "customer";
    const isStaffMessage = isAllowedStaff(message.sender || {});
    return isCustomerMessage || isStaffMessage;
  });

  const handleOpenMessagingHub = () => {
    const params = new URLSearchParams(); // Build query params for messages page
    if (jobNumber) params.set("jobNumber", jobNumber); // Pass the job number for /job prefix
    if (customerEmail) params.set("customerEmail", customerEmail); // Pass customer email to find/create thread
    if (customerName) params.set("customerName", customerName); // Customer display name for thread lookup
    const qs = params.toString(); // Assemble query string
    router.push(qs ? `/messages?${qs}` : "/messages"); // Navigate with params
  };

  return (
    <div>
      {!thread ?
      <div style={{
        padding: "28px",
        borderRadius: "var(--radius-sm)",
        border: "none",
        backgroundColor: "var(--danger-surface)",
        textAlign: "center"
      }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "17px", fontWeight: "600", color: "var(--danger)" }}>
            No conversation linked yet
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--info)" }}>
            Open the Messaging hub to start a thread for Job #{jobNumber}. Customers see the thread
            once their email is on file and they are added as a participant.
          </p>
          <button
          onClick={handleOpenMessagingHub}
          style={{
            padding: "10px 18px",
            borderRadius: "var(--control-radius)",
            border: "none",
            backgroundColor: "var(--primary)",
            color: "var(--text-2)",
            fontWeight: "600",
            cursor: "pointer"
          }}>

            Open Messaging Hub
          </button>
        </div> :

      <>
          <div style={{
          padding: "20px",
          borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--surface)",
          marginBottom: "16px"
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--info)", letterSpacing: "0.2em" }}>
                  Thread
                </p>
                <h3 style={{ margin: "4px 0 0 0", fontSize: "17px", fontWeight: "600", color: "var(--accent-purple)" }}>
                  {thread.title}
                </h3>
              </div>
              <button
              onClick={handleOpenMessagingHub}
              style={{
                padding: "8px 14px",
                backgroundColor: "var(--primary)",
                color: "var(--text-2)",
                border: "none",
                borderRadius: "var(--control-radius)",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer"
              }}>

                Open in Messaging Hub
              </button>
            </div>
            <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {staffMembers.map((member, index) =>
            <span
              key={member.userId || `staff-${index}`}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--control-radius)",
                fontSize: "12px",
                backgroundColor: "var(--theme)",
                color: "var(--info-dark)"
              }}>

                  {member.name} · {member.role || "Team"}
                </span>
            )}
              {customerMember &&
            <span
              style={{
                padding: "6px 12px",
                borderRadius: "var(--control-radius)",
                fontSize: "12px",
                backgroundColor: "var(--theme)",
                color: "var(--accent-purple)"
              }}>

                  {customerMember.name || "Customer"} · Customer
                </span>
            }
            </div>
          </div>

          <div style={{
          padding: "16px",
          borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--surface)",
          marginBottom: "16px"
        }}>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "var(--accent-purple)" }}>
              Customer delivery status
            </h4>
            <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "var(--info)" }}>
              {customerEmail ?
            customerLinked ?
            `Messages are shared with ${customerEmail}.` :
            `Email on file (${customerEmail}) is not yet linked to this thread. Add them in Messaging to share updates.` :
            "No customer email is linked yet. Add one to start messaging the customer."}
            </p>
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "var(--info)" }}>
              Staff-only messages remain hidden from the customer portal.
            </p>
          </div>

          <div style={{
          padding: "0 0 4px 0",
          borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--surface)",
          maxHeight: "360px",
          overflowY: "auto"
        }}>
            {messages.length === 0 ?
          <div style={{ padding: "24px", textAlign: "center", color: "var(--info)", fontSize: "14px" }}>
                No messages have been posted in this thread yet.
              </div> :

          messages.map((message) => {
            const isStaffOnly = message.customerVisible === false || message.audience === "staff";
            return (
              <div
                key={message.id || `${message.createdAt}-${message.content.slice(0, 20)}`}
                style={{
                  padding: "16px",
                  borderBottom: "var(--separating-line)",
                  backgroundColor: isStaffOnly ? "var(--danger-surface)" : "var(--theme)"
                }}>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong style={{ color: "var(--accent-purple)", fontSize: "14px" }}>
                          {message.sender?.name || "Team Member"}
                        </strong>
                        {message.sender?.role &&
                    <span style={{ marginLeft: "8px", fontSize: "12px", color: "var(--info)" }}>
                            {message.sender.role}
                          </span>
                    }
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--info)" }}>
                        {message.createdAt ? new Date(message.createdAt).toLocaleString() : ""}
                      </span>
                    </div>
                    <p style={{ margin: "8px 0 0 0", color: "var(--info-dark)", fontSize: "14px", whiteSpace: "pre-wrap" }}>
                      {renderMessageContentWithLinks(message.content)}
                    </p>
                    <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "var(--control-radius)",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: isStaffOnly ? "var(--danger)" : "var(--info-dark)",
                      backgroundColor: isStaffOnly ? "var(--danger-surface)" : "var(--success)"
                    }}>

                        {isStaffOnly ? "Internal only" : "Shared with customer"}
                      </span>
                      {message.metadata?.jobNumber &&
                  <span style={{ fontSize: "11px", color: "var(--info)" }}>
                          Linked job #{message.metadata.jobNumber}
                        </span>
                  }
                    </div>
                  </div>);

          })
          }
          </div>
        </>
      }
    </div>);
*/
}

function ClockingTab({ jobData, canEdit, disabledMessageOverride = "" }) {
  const { confirm } = useConfirmation();
  const jobNumberValue = jobData?.jobNumber ?? jobData?.job_number ?? "";
  const normalizedJobNumber = jobNumberValue ? String(jobNumberValue).trim() : "";
  const getTodayInputValue = () => new Date().toISOString().split("T")[0];
  const [technicians, setTechnicians] = useState([]);
  const [techniciansLoading, setTechniciansLoading] = useState(false);
  const [techniciansError, setTechniciansError] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [clockInDate, setClockInDate] = useState(() => getTodayInputValue());
  const [clockOutDate, setClockOutDate] = useState(() => getTodayInputValue());
  const [clockInTime, setClockInTime] = useState("");
  const [clockOutTime, setClockOutTime] = useState("");
  const [selectedRequest, setSelectedRequest] = useState("job");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [techAbsences, setTechAbsences] = useState([]); // today's approved absences for tech roles
  const [showTechsPopup, setShowTechsPopup] = useState(false); // staff-off style popup toggle
  const [clockingSummary, setClockingSummary] = useState(null); // headline totals lifted from ClockingHistorySection for the KPI strip

  const jobId = useMemo(() => {
    if (jobData?.id === undefined || jobData?.id === null) {
      return null;
    }
    const numeric = typeof jobData.id === "number" ? jobData.id : Number(jobData.id);
    return Number.isNaN(numeric) ? null : numeric;
  }, [jobData?.id]);

  useEffect(() => {
    let isMounted = true;
    const loadTechnicians = async () => {
      setTechniciansLoading(true);
      setTechniciansError("");
      try {
        const { data, error } = await (await loadSupabaseClient()).
        from("users").
        select("user_id, first_name, last_name, role, email").
        ilike("role", "%tech%").
        order("first_name", { ascending: true }).
        order("last_name", { ascending: true });

        if (error) {
          throw error;
        }

        if (isMounted) {
          setTechnicians(data || []);
        }
      } catch (err) {
        logFailure("Failed to load technicians:", err);
        if (isMounted) {
          setTechniciansError(err?.message || "Unable to load technicians.");
        }
      } finally {
        if (isMounted) {
          setTechniciansLoading(false);
        }
      }
    };

    loadTechnicians();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch today's approved absences for tech roles (mirrors appointment page Staff Off section)
  useEffect(() => {
    let isMounted = true;
    const loadTechAbsences = async () => {
      try {
        const todayIso = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        const data = await fetchApprovedStaffAbsences({
          startDate: todayIso,
          endDate: todayIso,
        });

        // Filter to tech-related roles only
        const techRoles = new Set(["technician", "techs", "technician lead", "lead technician", "mot tester", "tester"]);
        const filtered = (data || []).filter((absence) => {
          const role = (absence?.user?.role || "").trim().toLowerCase();
          return techRoles.has(role);
        }).map((absence) => {
          const user = absence.user || {};
          const first = (user.first_name || "").trim();
          const last = (user.last_name || "").trim();
          return {
            id: absence.absence_id,
            userId: user.user_id || null,
            name: [first, last].filter(Boolean).join(" ") || user.email || "Staff Member",
            role: (user.role || "Staff").split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "),
            type: absence.type || "Holiday"
          };
        });

        if (isMounted) setTechAbsences(filtered);
      } catch (err) {
        logFailure("Failed to load tech absences for clocking tab:", err);
        if (isMounted) setTechAbsences([]);
      }
    };

    loadTechAbsences();
    return () => {isMounted = false;};
  }, []);

  // Build a set of userId values that are off today for quick lookup
  const techsOffTodayIds = useMemo(
    () => new Set(techAbsences.map((a) => a.userId).filter(Boolean)),
    [techAbsences]
  );

  // Live tech-clocking status (Waiting for Job / In Progress / Tea Break / Not Clocked In)
  // Loaded only while the Technicians popup is open so the standard Clocking tab
  // form does not have to wait on extra queries.
  const [techStatuses, setTechStatuses] = useState({});
  const [techStatusesLoading, setTechStatusesLoading] = useState(false);
  const [popupClockingUserId, setPopupClockingUserId] = useState(null);
  const [popupClockingError, setPopupClockingError] = useState("");

  useEffect(() => {
    if (!showTechsPopup) return undefined;
    let isMounted = true;
    const loadStatuses = async () => {
      setTechStatusesLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        const [{ data: jobClocking, error: jobError }, { data: timeRecords, error: timeError }] =
        await (async () => { const sb = await loadSupabaseClient(); return Promise.all([
        sb.
        from("job_clocking").
        select("user_id, job_id, job_number, clock_in").
        is("clock_out", null),
        sb.
        from("time_records").
        select("user_id, clock_in, notes").
        eq("date", today).
        is("clock_out", null)]
        ); })();
        if (jobError) throw jobError;
        if (timeError) throw timeError;

        const map = {};
        (jobClocking || []).forEach((entry) => {
          if (!entry?.user_id) return;
          if (!map[entry.user_id]) {
            map[entry.user_id] = {
              status: "In Progress",
              jobNumber: entry.job_number || null,
              jobId: entry.job_id || null
            };
          }
        });
        (timeRecords || []).forEach((record) => {
          if (!record?.user_id) return;
          if (map[record.user_id]) return; // active job_clocking already wins
          const note = (record.notes || "").toString().toLowerCase();
          map[record.user_id] = {
            status: note.includes("tea") || note.includes("break") ?
            "Tea Break" :
            "Waiting for Job",
            jobNumber: null,
            jobId: null
          };
        });
        if (isMounted) setTechStatuses(map);
      } catch (err) {
        logFailure("Failed to load tech clocking statuses:", err);
        if (isMounted) setTechStatuses({});
      } finally {
        if (isMounted) setTechStatusesLoading(false);
      }
    };
    loadStatuses();
    return () => {
      isMounted = false;
    };
  }, [showTechsPopup, refreshSignal]);

  const handleClockTechFromPopup = useCallback(async (userId) => {
    if (!jobId || !normalizedJobNumber) return;
    setPopupClockingError("");
    setPopupClockingUserId(userId);
    try {
      const result = await (await loadJobClockingDb()).clockInToJob({
        userId,
        jobId,
        jobNumber: normalizedJobNumber,
        workType: "initial"
      });
      if (!result?.success) {
        throw new Error(result?.error || "Unable to clock the technician onto this job.");
      }
      setRefreshSignal((prev) => prev + 1);
      setShowTechsPopup(false);
    } catch (err) {
      logFailure("Popup clock-on failed:", err);
      setPopupClockingError(err?.message || "Unable to clock the technician onto this job.");
    } finally {
      setPopupClockingUserId(null);
    }
  }, [jobId, normalizedJobNumber]);

  const technicianOptions = useMemo(
    () =>
    (technicians || []).map((tech) => ({
      key: tech.user_id,
      value: String(tech.user_id),
      label:
      `${tech.first_name || ""} ${tech.last_name || ""}`.trim() ||
      tech.email ||
      "Technician",
      description: tech.role || "Technician"
    })),
    [technicians]
  );

  const normalizedRequests = useMemo(
    () => normalizeRequests(jobData?.requests || []),
    [jobData?.requests]
  );

  const requestLookup = useMemo(() => {
    return normalizedRequests.reduce((map, req, index) => {
      const value = String(
        req?.request_id ?? req?.requestId ?? req?.key ?? `request-${index}`
      );
      const label = req?.text || req?.title || req?.description || `Request ${index + 1}`;
      const hoursRaw = req?.hours ?? req?.time ?? null;
      const hours = Number(hoursRaw);
      map.set(value, {
        value,
        requestId:
        req?.request_id !== undefined && req?.request_id !== null ?
        Number(req.request_id) :
        req?.requestId !== undefined && req?.requestId !== null ?
        Number(req.requestId) :
        null,
        title: label,
        label,
        hours: Number.isFinite(hours) ? hours : null
      });
      return map;
    }, new Map());
  }, [normalizedRequests]);

  const requestOptions = useMemo(() => {
    const normalized = normalizedRequests;

    // Calculate total allocated hours for all requests
    const totalAllocatedHours = normalized.reduce((sum, req) => {
      const hours = parseFloat(req?.time ?? req?.hours) || 0;
      return sum + hours;
    }, 0);

    const options = [
    {
      key: "job",
      value: "job",
      label: `Job #${normalizedJobNumber || ""}`,
      description: normalized.length === 1 ?
      `${normalized[0].time || 0}h allocated` :
      totalAllocatedHours > 0 ?
      `${totalAllocatedHours}h total allocated` :
      "Clock onto the main job"
    }];


    normalized.forEach((req, index) => {
      const optionValue = String(
        req?.request_id ?? req?.requestId ?? req?.key ?? `request-${index}`
      );
      const requestText = req?.text || req?.title || req?.description || "Request";
      const allocatedTime = req?.time ?? req?.hours ?? 0;
      options.push({
        key: optionValue,
        value: optionValue,
        label: requestText,
        description: `${allocatedTime}h allocated`
      });
    });

    return options;
  }, [normalizedJobNumber, normalizedRequests]);

  const selectedTechnician = useMemo(
    () =>
    (technicians || []).find(
      (tech) => String(tech.user_id) === String(selectedTechnicianId)
    ) || null,
    [technicians, selectedTechnicianId]
  );

  const selectedRequestMeta = useMemo(() => {
    if (!selectedRequest || selectedRequest === "job") {
      return {
        requestId: null,
        requestKey: "job",
        requestLabel: `Job #${normalizedJobNumber}`,
        requestTitle: `Job #${normalizedJobNumber}`,
        requestHours: null
      };
    }

    const match = requestLookup.get(String(selectedRequest));
    return {
      requestId:
      match?.requestId !== null && Number.isInteger(match?.requestId) && match.requestId > 0 ?
      match.requestId :
      null,
      requestKey: match?.value || String(selectedRequest),
      requestLabel: match?.label || String(selectedRequest),
      requestTitle: match?.title || String(selectedRequest),
      requestHours: match?.hours ?? null
    };
  }, [normalizedJobNumber, requestLookup, selectedRequest]);

  const isJustClockState = useMemo(() => {
    const today = getTodayInputValue();
    return (
      selectedRequest === "job" &&
      clockInDate === today &&
      clockOutDate === today &&
      !clockInTime &&
      !clockOutTime);

  }, [clockInDate, clockOutDate, clockInTime, clockOutTime, selectedRequest]);

  const resetClockingForm = useCallback(() => {
    const today = getTodayInputValue();
    setSelectedTechnicianId("");
    setClockInDate(today);
    setClockOutDate(today);
    setClockInTime("");
    setClockOutTime("");
    setSelectedRequest("job");
  }, []);

  const handleClockingSuccess = useCallback((message) => {
    setFormError("");
    setFormSuccess(message);
    resetClockingForm();
    setRefreshSignal((prev) => prev + 1);
  }, [resetClockingForm]);

  const handleJustClock = useCallback(async () => {
    if (!canEdit) return;
    setFormError("");
    setFormSuccess("");

    if (!jobId || !normalizedJobNumber) {
      setFormError("Job details are unavailable for clocking.");
      return;
    }

    if (!selectedTechnicianId) {
      setFormError("Select a technician to clock onto this job.");
      return;
    }

    const technicianId = Number(selectedTechnicianId);
    if (Number.isNaN(technicianId) || technicianId <= 0) {
      setFormError("Select a valid technician.");
      return;
    }

    setSubmitting(true);

    try {
      const activeResult = await (await loadJobClockingDb()).getUserActiveJobs(technicianId);
      if (!activeResult?.success) {
        throw new Error(activeResult?.error || "Unable to check the technician's current clocking.");
      }

      const activeJobs = Array.isArray(activeResult.data) ? activeResult.data : [];
      const sameJobClocking = activeJobs.find(
        (entry) =>
        Number(entry?.jobId) === Number(jobId) &&
        String(entry?.jobNumber || "") === normalizedJobNumber
      );

      if (sameJobClocking) {
        const techName =
        selectedTechnician?.first_name || selectedTechnician?.last_name ?
        `${selectedTechnician?.first_name || ""} ${selectedTechnician?.last_name || ""}`.trim() :
        "This technician";
        handleClockingSuccess(
          `${techName} is already clocked onto Job #${normalizedJobNumber}.`
        );
        return;
      }

      const currentClocking = activeJobs[0] || null;
      if (currentClocking) {
        const confirmed = await confirm({
          title: "Technician already clocked on",
          message: `${selectedTechnician?.first_name || selectedTechnician?.last_name ? `${selectedTechnician.first_name || ""} ${selectedTechnician.last_name || ""}`.trim() : "This technician"} is already clocked onto Job #${currentClocking.jobNumber || currentClocking.jobId || "current"}.`,
          description: `Press Yes to clock them off their current job and onto Job #${normalizedJobNumber}. Press No to keep their current clocking.`,
          confirmLabel: "Yes",
          cancelLabel: "No"
        });

        if (!confirmed) {
          setFormSuccess("Technician stayed on their current job.");
          return;
        }

        const switchResult = await (await loadJobClockingDb()).switchJob({
          userId: technicianId,
          currentJobId: currentClocking.jobId,
          newJobId: jobId,
          newJobNumber: normalizedJobNumber,
          workType: "initial"
        });

        if (!switchResult?.success) {
          throw new Error(switchResult?.error || "Unable to switch technician onto this job.");
        }

        handleClockingSuccess(
          `${selectedTechnician?.first_name || selectedTechnician?.last_name ? `${selectedTechnician.first_name || ""} ${selectedTechnician.last_name || ""}`.trim() : "Technician"} clocked onto Job #${normalizedJobNumber}.`
        );
        return;
      }

      const clockInResult = await (await loadJobClockingDb()).clockInToJob({
        userId: technicianId,
        jobId,
        jobNumber: normalizedJobNumber,
        workType: "initial"
      });

      if (!clockInResult?.success) {
        throw new Error(clockInResult?.error || "Unable to clock technician onto this job.");
      }

      handleClockingSuccess(
        `${selectedTechnician?.first_name || selectedTechnician?.last_name ? `${selectedTechnician.first_name || ""} ${selectedTechnician.last_name || ""}`.trim() : "Technician"} clocked onto Job #${normalizedJobNumber}.`
      );
    } catch (err) {
      logFailure("Just clock error:", err);
      setFormError(err?.message || "Unable to clock the technician onto this job.");
    } finally {
      setSubmitting(false);
    }
  }, [
  canEdit,
  confirm,
  handleClockingSuccess,
  jobId,
  normalizedJobNumber,
  selectedTechnician,
  selectedTechnicianId]
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!canEdit) return;
      setFormError("");
      setFormSuccess("");

      if (!jobId || !normalizedJobNumber) {
        setFormError("Job details are unavailable for manual clocking.");
        return;
      }

      if (!selectedTechnicianId) {
        setFormError("Select a technician to create a clocking entry.");
        return;
      }

      if (!clockInDate || !clockOutDate) {
        setFormError("Choose dates for the manual entry.");
        return;
      }

      if (!clockInTime || !clockOutTime) {
        setFormError("Provide both start and finish times.");
        return;
      }

      const technicianId = Number(selectedTechnicianId);
      if (Number.isNaN(technicianId) || technicianId <= 0) {
        setFormError("Select a valid technician.");
        return;
      }

      const startDate = buildDateTimeFromInputs(clockInDate, clockInTime);
      const finishDate = buildDateTimeFromInputs(clockOutDate, clockOutTime);

      if (!startDate || !finishDate) {
        setFormError("Provide valid start and finish values.");
        return;
      }

      if (finishDate <= startDate) {
        setFormError("Clock-out must be after clock-in.");
        return;
      }

      const durationMs = finishDate.getTime() - startDate.getTime();
      if (durationMs <= 0) {
        setFormError("Finish time must come after the start time.");
        return;
      }

      const hoursWorked = Number((durationMs / (1000 * 60 * 60)).toFixed(2));
      setSubmitting(true);

      try {
        const nowIso = new Date().toISOString();
        const notesPayload = JSON.stringify({
          requestKey: selectedRequestMeta.requestKey,
          requestLabel: selectedRequestMeta.requestLabel,
          requestTitle: selectedRequestMeta.requestTitle,
          requestHours: selectedRequestMeta.requestHours
        });

        const timeRecordPayload = {
          user_id: technicianId,
          job_id: jobId,
          job_number: normalizedJobNumber,
          clock_in: startDate.toISOString(),
          clock_out: finishDate.toISOString(),
          date: clockInDate,
          hours_worked: hoursWorked,
          notes: notesPayload,
          created_at: nowIso,
          updated_at: nowIso
        };

        const { error: timeRecordsError } = await (await loadSupabaseClient()).
        from("time_records").
        insert([timeRecordPayload]);

        if (timeRecordsError) {
          throw timeRecordsError;
        }

        const { error: jobClockingError } = await (await loadSupabaseClient()).from("job_clocking").insert([
        {
          user_id: technicianId,
          job_id: jobId,
          job_number: normalizedJobNumber,
          request_id: selectedRequestMeta.requestId,
          clock_in: startDate.toISOString(),
          clock_out: finishDate.toISOString(),
          work_type: "manual",
          created_at: nowIso,
          updated_at: nowIso
        }]
        );

        if (jobClockingError) {
          throw jobClockingError;
        }

        const { error: jobUpdateError } = await (await loadSupabaseClient()).
        from("jobs").
        update({ updated_at: nowIso }).
        eq("id", jobId);

        if (jobUpdateError) {
          throw jobUpdateError;
        }

        handleClockingSuccess("Manual clocking entry saved for this job.");
      } catch (err) {
        logFailure("Manual clocking error:", err);
        setFormError(err?.message || "Unable to save the clocking entry.");
      } finally {
        setSubmitting(false);
      }
    },
    [
    canEdit,
    jobId,
    normalizedJobNumber,
    selectedTechnicianId,
    clockInDate,
    clockOutDate,
    clockInTime,
    clockOutTime,
    selectedRequestMeta,
    handleClockingSuccess]

  );

  const handleReset = () => {
    resetClockingForm();
    setFormError("");
    setFormSuccess("");
  };

  const inputControlStyle = {
    width: "100%",
    borderRadius: "var(--control-radius)",
    border: "none",
    backgroundColor: "var(--surface)",
    padding: "12px 14px",
    fontSize: "0.95rem",
    color: "var(--text-1)"
  };

  const infoPillStyle = {
    padding: "8px 14px",
    borderRadius: "var(--radius-xs)", // button-style rectangle instead of rounded bubble
    backgroundColor: "var(--theme)",
    color: "var(--info-dark)",
    fontWeight: 600,
    fontSize: "0.85rem",
    border: "none",
    lineHeight: 1.4
  };

  const disabledMessage =
  !canEdit && (
  disabledMessageOverride ||
  "This job card is read-only. Clocking entries can only be added by staff with edit access.");

  // Headline KPI figures derived from the totals ClockingHistorySection lifts up.
  // "Sold vs actual" model: clocked = hours worked, allocated = sold/budget,
  // remaining = sold − clocked, efficiency = sold ÷ clocked.
  const summary = clockingSummary || {};
  const clockedHours = Number.isFinite(summary.clockedHours) ? summary.clockedHours : 0;
  const allocatedHours =
    summary.allocatedHours !== null && summary.allocatedHours !== undefined ?
    summary.allocatedHours :
    null;
  const remainingHours =
    summary.remainingHours !== null && summary.remainingHours !== undefined ?
    summary.remainingHours :
    null;
  const efficiency =
    summary.efficiency !== null && summary.efficiency !== undefined ? summary.efficiency : null;
  const formatHours = (value) =>
  value === null || value === undefined ? "—" : `${Number(value).toFixed(2)}h`;

  const clockingKpiCards = [
  {
    key: "clocked",
    label: "Clocked time & cost",
    value: formatHours(clockedHours),
    valueColor: "var(--accentText)"
  },
  {
    key: "remaining",
    label: "Time remaining",
    value: formatHours(remainingHours),
    valueColor: "var(--accentText)"
  },
  {
    key: "allocated",
    label: "Allocated time",
    value: formatHours(allocatedHours),
    valueColor: "var(--accentText)"
  },
  {
    key: "efficiency",
    label: "Labour efficiency",
    value: efficiency === null ? "—" : `${efficiency}%`,
    valueColor: "var(--accentText)"
  }];


  return (
    <DevLayoutSection
      sectionKey="jobcard-tab-clocking-panel"
      sectionType="content-card"
      parentKey="jobcard-tab-clocking"
      data-dev-text-preview="Clocking entry form and history"
      backgroundToken="surface"
      className="app-layout-card"
      style={{
        gap: "18px"
      }}>

      {/* Top section: headline clocking KPIs (sold vs actual). */}
      {jobId && normalizedJobNumber &&
      <DevLayoutSection
        sectionKey="jobcard-tab-clocking-summary"
        sectionType="stat-card"
        parentKey="jobcard-tab-clocking-panel"
        data-dev-text-preview="Clocking summary KPIs"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px"
        }}>

          {clockingKpiCards.map((card) =>
        <div
          key={card.key}
          className="app-layout-stat-card"
          style={{
            padding: "8px 10px",
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            columnGap: "8px",
            rowGap: "2px",
            minWidth: 0,
            minHeight: "44px"
          }}>
              <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              lineHeight: 1,
              color: "var(--grey-accent)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>

                {card.label}
              </span>
              <span
            style={{
              fontSize: "18px",
              fontWeight: 700,
              lineHeight: 1,
              color: card.valueColor
            }}>

                {card.value}
              </span>
            </div>
        )}
        </DevLayoutSection>
      }

      {techniciansError &&
      <div
        style={{
          borderRadius: "var(--radius-sm)",
          border: "none",
          backgroundColor: "var(--danger-surface)",
          padding: "12px 14px",
          color: "var(--danger-dark)",
          fontSize: "0.9rem"
        }}>

          {techniciansError}
        </div>
      }

      {disabledMessage &&
      <div
        style={{
          borderRadius: "var(--radius-sm)",
          border: "none",
          backgroundColor: "var(--warning-surface)",
          padding: "12px 14px",
          color: "var(--warning-dark)",
          fontSize: "0.9rem"
        }}>

          {disabledMessage}
        </div>
      }

      {formError &&
      <div
        style={{
          borderRadius: "var(--radius-sm)",
          border: "none",
          backgroundColor: "var(--danger-surface)",
          padding: "12px 14px",
          color: "var(--danger-dark)",
          fontSize: "0.9rem"
        }}>

          {formError}
        </div>
      }

      {formSuccess &&
      <div
        style={{
          borderRadius: "var(--radius-sm)",
          border: "none",
          backgroundColor: "var(--success-surface)",
          padding: "12px 14px",
          color: "var(--success-dark)",
          fontSize: "0.9rem"
        }}>

          {formSuccess}
        </div>
      }

      <DevLayoutSection
        as="form"
        sectionKey="jobcard-tab-clocking-form"
        sectionType="content-card"
        parentKey="jobcard-tab-clocking-panel"
        data-dev-text-preview="Clocking entry form"
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Row 1: Clock-in date, Clock-out date, Clock-in time, Clock-out time */}
        <DevLayoutSection
          sectionKey="jobcard-tab-clocking-date-time-fields"
          sectionType="filter-row"
          parentKey="jobcard-tab-clocking-form"
          data-dev-text-preview="Clock-in and clock-out date/time fields"
          style={{
            display: "grid",
            // auto-fit keeps 4 fields across on desktop, reflows to fewer columns on smaller screens (CLAUDE.md §3.6)
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
            gap: "16px"
          }}>

          <CalendarField
            id="clocking-in-date"
            label="Clock-in date"
            value={clockInDate}
            onChange={(event) => {
              setClockInDate(event.target.value);
              // Auto-set clock-out date to match clock-in date
              if (!clockOutDate || clockOutDate < event.target.value) {
                setClockOutDate(event.target.value);
              }
            }}
            required
            disabled={!canEdit} />

          <CalendarField
            id="clocking-out-date"
            label="Clock-out date"
            value={clockOutDate}
            onChange={(event) => setClockOutDate(event.target.value)}
            required
            disabled={!canEdit} />

          <TimePickerField
            id="clocking-start-time"
            label="Clock-in time"
            value={clockInTime}
            onChange={(event) => setClockInTime(event.target.value)}
            required
            disabled={!canEdit} />

          <TimePickerField
            id="clocking-finish-time"
            label="Clock-out time"
            value={clockOutTime}
            onChange={(event) => setClockOutTime(event.target.value)}
            required
            disabled={!canEdit} />

        </DevLayoutSection>

        {/* Row 2: Request selector, Tech selector */}
        <DevLayoutSection
          sectionKey="jobcard-tab-clocking-assignment-fields"
          sectionType="filter-row"
          parentKey="jobcard-tab-clocking-form"
          data-dev-text-preview="Job request and technician selectors"
          style={{
            display: "grid",
            // auto-fit keeps the two selectors side-by-side on desktop, stacks on narrow screens (CLAUDE.md §3.6)
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
            gap: "16px"
          }}>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="clocking-request-selector"
              style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-1)" }}>

              Job / Request
            </label>
            <DropdownField
              id="clocking-request-selector"
              placeholder="Select job or request"
              options={requestOptions}
              value={selectedRequest}
              onChange={(event) => setSelectedRequest(event.target.value)}
              disabled={!canEdit}
              required
              style={{ width: "100%" }} />

          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="clocking-tech-selector"
              style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-1)" }}>

              Technician
            </label>
            <DropdownField
              id="clocking-tech-selector"
              placeholder={techniciansLoading ? "Loading technicians..." : "Select technician"}
              options={technicianOptions}
              value={selectedTechnicianId}
              onChange={(event) => {
                setSelectedTechnicianId(event.target.value);
                setFormError("");
                setFormSuccess("");
              }}
              disabled={!canEdit || techniciansLoading}
              required
              style={{ width: "100%" }} />

          </div>
        </DevLayoutSection>

        <DevLayoutSection
          sectionKey="jobcard-tab-clocking-actions"
          sectionType="toolbar"
          parentKey="jobcard-tab-clocking-form"
          data-dev-text-preview="Clocking form actions and status badges"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between"
          }}>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {isJustClockState && selectedTechnicianId ?
            <Button
              type="button"
              variant="secondary"
              onClick={handleJustClock}
              disabled={!canEdit || submitting}
              busy={submitting}>

                {submitting ? "Clocking..." : "Just clock"}
              </Button> :
            null}
            <Button
              type="submit"
              variant="primary"
              disabled={!canEdit}
              busy={submitting}>

              {submitting ? "Saving..." : "Save clocking entry"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleReset}
              disabled={submitting}>

              Reset form
            </Button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setShowTechsPopup(true)}
              className="app-badge app-badge--uppercase app-badge--accent-soft"
              style={{ border: "none", cursor: "pointer" }}>
              {techniciansLoading ? "Loading technicians..." : `${technicianOptions.length} techs`}
              {techAbsences.length > 0 &&
              <span className="app-badge app-badge--uppercase app-badge--warning" style={{ marginLeft: "6px" }}>
                  {techAbsences.length} off
                </span>
              }
            </button>
            {normalizedJobNumber ?
            <span className="app-badge app-badge--uppercase app-badge--success">
                Job #{normalizedJobNumber}
              </span> :
            null}
          </div>
        </DevLayoutSection>
      </DevLayoutSection>

      {jobId && normalizedJobNumber &&
      <DevLayoutSection
        id="clocking-history"
        sectionKey="jobcard-tab-clocking-history"
        sectionType="content-card"
        parentKey="jobcard-tab-clocking-panel"
        data-dev-text-preview="Clocking history">
          <ClockingHistorySection
          jobId={jobId}
          jobNumber={normalizedJobNumber}
          requests={normalizedRequests}
          jobAllocatedHours={jobData?.labour_hours || null}
          refreshSignal={refreshSignal}
          enableRequestClick={false}
          onSummaryChange={setClockingSummary}
          title="Clocking history"
          backgroundLayer="theme" />

        </DevLayoutSection>
      }

      {/* Techs / Staff Off popup — portal-rendered so it centers on the viewport, not the tab */}
      {showTechsPopup && typeof document !== "undefined" && createPortal(
        <div
          style={popupOverlayStyles}
          onClick={() => setShowTechsPopup(false)}>

          <div
            role="dialog"
            aria-modal="true"
            style={{
              ...popupCardStyles,
              width: "min(560px, 100%)",
              maxWidth: "min(560px, calc(100vw - 24px))",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "18px"
            }}
            onClick={(event) => event.stopPropagation()}>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--text-1)" }}>
                Technicians · {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
              </h3>
              <p style={{ margin: 0, color: "var(--grey-accent)", fontSize: "13px" }}>
                Click an available technician to clock them onto Job #{normalizedJobNumber || "—"}.
                {techAbsences.length > 0 ? ` ${techAbsences.length} with approved time off today.` : ""}
              </p>
            </div>

            {popupClockingError ?
            <div
              style={{
                borderRadius: "var(--control-radius-xs)",
                backgroundColor: "var(--danger-surface)",
                color: "var(--danger-dark)",
                padding: "8px 12px",
                fontSize: "0.85rem"
              }}>

                {popupClockingError}
              </div> :
            null}

            {techniciansLoading || techStatusesLoading ?
            <div style={{ color: "var(--grey-accent)", padding: "12px 0" }}>Loading technicians...</div> :

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "60vh", overflowY: "auto" }}>
                {technicianOptions.map((tech) => {
                const userIdNum = Number(tech.value);
                const absence = techAbsences.find((a) => a.userId === userIdNum);
                const isOff = Boolean(absence);
                const statusEntry = techStatuses[userIdNum] || null;
                const rawStatus = isOff ?
                `On ${absence.type}` :
                statusEntry?.status || "Not Clocked In";
                const isOnThisJob =
                !isOff &&
                statusEntry?.status === "In Progress" &&
                Number(statusEntry?.jobId) === Number(jobId);
                const isOnAnotherJob =
                !isOff &&
                statusEntry?.status === "In Progress" &&
                !isOnThisJob;
                const canClockOn = !isOff && rawStatus === "Waiting for Job";
                const isThisRowSubmitting = popupClockingUserId === userIdNum;

                // Pick a tone class from global.css so every row's pill shares
                // the same shape/size and only the colour changes.
                let toneClass = "app-badge--neutral";
                let pillLabel = rawStatus;
                if (isOff) {
                  toneClass = "app-badge--warning";
                } else if (isOnThisJob) {
                  toneClass = "app-badge--success";
                  pillLabel = "On this job";
                } else if (isOnAnotherJob) {
                  toneClass = "app-badge--danger";
                  pillLabel = `On Job #${statusEntry?.jobNumber || statusEntry?.jobId || "—"}`;
                } else if (canClockOn) {
                  toneClass = "app-badge--success-strong";
                  pillLabel = isThisRowSubmitting ? "Clocking on..." : "Clock on";
                } else if (rawStatus === "Tea Break") {
                  toneClass = "app-badge--warning";
                }

                const pillBaseClass = "app-badge app-badge--uppercase";
                const pillStyle = { minWidth: "120px", justifyContent: "center" };

                // Row background follows the same tone as the right-side pill,
                // sourced from the theme's surface tokens.
                let rowBackground = "var(--theme)";
                if (isOff) {
                  rowBackground = "var(--warning-surface)";
                } else if (isOnThisJob) {
                  rowBackground = "var(--success-surface)";
                } else if (isOnAnotherJob) {
                  rowBackground = "var(--danger-surface)";
                } else if (canClockOn) {
                  rowBackground = "var(--success-surface)";
                } else if (rawStatus === "Tea Break") {
                  rowBackground = "var(--warning-surface)";
                }

                const rightLabel = canClockOn ?
                <button
                  type="button"
                  disabled={isThisRowSubmitting}
                  onClick={() => handleClockTechFromPopup(userIdNum)}
                  className={`${pillBaseClass} ${toneClass}`}
                  style={{
                    ...pillStyle,
                    border: "none",
                    cursor: isThisRowSubmitting ? "wait" : "pointer"
                  }}>

                      {pillLabel}
                    </button> :

                <span className={`${pillBaseClass} ${toneClass}`} style={pillStyle}>
                      {pillLabel}
                    </span>;


                const secondaryLine = isOff ?
                absence.role :
                isOnAnotherJob ?
                `Currently on Job #${statusEntry?.jobNumber || statusEntry?.jobId || "—"}` :
                tech.description || "Technician";

                return (
                  <div
                    key={tech.key}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: rowBackground,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px"
                    }}>

                      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-1)" }}>
                          {tech.label}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--grey-accent)" }}>
                          {secondaryLine}
                        </span>
                      </div>
                      {rightLabel}
                    </div>);

              })}
                {technicianOptions.length === 0 &&
              <div style={{ color: "var(--grey-accent)", padding: "8px 0" }}>No technicians found.</div>
              }
              </div>
            }

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
              <button
                type="button"
                onClick={() => setShowTechsPopup(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "var(--control-radius-xs)",
                  border: "1px solid var(--ghostbutton-ring-color)",
                  backgroundColor: "transparent",
                  color: "var(--text-1)",
                  fontWeight: 600,
                  cursor: "pointer"
                }}>

                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </DevLayoutSection>);

}

function ValetClockingPanel({ jobId, jobNumber, userId, clockingLocked = false, lockMessage = "" }) {
  const [activeClocking, setActiveClocking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshActiveValetClocking = useCallback(async () => {
    if (!jobId || !userId) {
      setActiveClocking(null);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await (await loadSupabaseClient()).
      from("job_clocking").
      select("id, user_id, job_id, job_number, clock_in, clock_out, work_type").
      eq("job_id", Number(jobId)).
      eq("user_id", Number(userId)).
      eq("work_type", "valet").
      is("clock_out", null).
      order("clock_in", { ascending: false }).
      maybeSingle();

      if (queryError && queryError.code !== "PGRST116") {
        throw queryError;
      }
      setActiveClocking(data || null);
    } catch (clockingError) {
      setError(clockingError?.message || "Unable to load valet clocking.");
    } finally {
      setLoading(false);
    }
  }, [jobId, userId]);

  useEffect(() => {
    void refreshActiveValetClocking();
  }, [refreshActiveValetClocking]);

  const handleClockIn = useCallback(async () => {
    if (clockingLocked) {
      setError(lockMessage || "This job can no longer be clocked onto.");
      return;
    }
    if (!jobId || !userId || !jobNumber) return;
    setLoading(true);
    setError("");
    try {
      const nowIso = new Date().toISOString();
      const { data: insertedRow, error: insertError } = await (await loadSupabaseClient()).
      from("job_clocking").
      insert([
      {
        user_id: Number(userId),
        job_id: Number(jobId),
        job_number: String(jobNumber),
        clock_in: nowIso,
        clock_out: null,
        work_type: "valet",
        created_at: nowIso,
        updated_at: nowIso
      }]
      ).
      select("id, user_id, job_id, job_number, clock_in, clock_out, work_type").
      single();

      if (insertError) throw insertError;

      const notesPayload = JSON.stringify({
        source: "valet_job_clocking",
        workType: "valet",
        clockingId: insertedRow.id,
        requestKey: "job",
        requestLabel: `Valet Job #${jobNumber}`,
        requestTitle: `Valet Job #${jobNumber}`
      });

      const { error: timeRecordError } = await (await loadSupabaseClient()).from("time_records").insert([
      {
        user_id: Number(userId),
        job_id: Number(jobId),
        job_number: String(jobNumber),
        date: nowIso.split("T")[0],
        clock_in: nowIso,
        clock_out: null,
        hours_worked: null,
        break_minutes: 0,
        notes: notesPayload,
        created_at: nowIso,
        updated_at: nowIso
      }]
      );
      if (timeRecordError) {
        logFailure("Failed to create valet time record:", timeRecordError);
      }

      setActiveClocking(insertedRow);
    } catch (clockInError) {
      setError(clockInError?.message || "Unable to clock onto valet job.");
    } finally {
      setLoading(false);
    }
  }, [clockingLocked, lockMessage, jobId, jobNumber, userId]);

  const handleClockOut = useCallback(async () => {
    if (!activeClocking?.id || !jobId || !userId) return;
    setLoading(true);
    setError("");
    try {
      const nowIso = new Date().toISOString();
      const { error: updateError } = await (await loadSupabaseClient()).
      from("job_clocking").
      update({
        clock_out: nowIso,
        updated_at: nowIso
      }).
      eq("id", activeClocking.id).
      eq("work_type", "valet");
      if (updateError) throw updateError;

      const { data: openTimeRows, error: timeFetchError } = await (await loadSupabaseClient()).
      from("time_records").
      select("id, clock_in, notes").
      eq("user_id", Number(userId)).
      eq("job_id", Number(jobId)).
      is("clock_out", null).
      order("clock_in", { ascending: false });
      if (!timeFetchError) {
        const target = (openTimeRows || []).find((row) => {
          const notes = String(row?.notes || "");
          return notes.includes('"source":"valet_job_clocking"');
        });
        if (target?.id) {
          const start = Date.parse(target.clock_in || nowIso);
          const end = Date.parse(nowIso);
          const hoursWorked =
          Number.isFinite(start) && Number.isFinite(end) && end > start ?
          Number(((end - start) / (1000 * 60 * 60)).toFixed(2)) :
          0;

          await (await loadSupabaseClient()).
          from("time_records").
          update({
            clock_out: nowIso,
            hours_worked: hoursWorked,
            updated_at: nowIso
          }).
          eq("id", target.id);
        }
      }

      setActiveClocking(null);
    } catch (clockOutError) {
      setError(clockOutError?.message || "Unable to clock out from valet job.");
    } finally {
      setLoading(false);
    }
  }, [activeClocking?.id, jobId, userId]);

  const isClockedOn = Boolean(activeClocking?.id);
  const clockedSinceText = activeClocking?.clock_in ?
  new Date(activeClocking.clock_in).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }) :
  null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
      <button
        type="button"
        onClick={isClockedOn ? handleClockOut : handleClockIn}
        disabled={loading || !jobId || !userId || clockingLocked && !isClockedOn}
        style={{
          padding: "8px 14px",
          borderRadius: "var(--radius-sm)",
          border: "none",
          backgroundColor: isClockedOn ? "var(--danger)" : "var(--primary)",
          color: "var(--text-2)",
          fontWeight: 700,
          cursor: loading || !jobId || !userId || clockingLocked && !isClockedOn ? "not-allowed" : "pointer",
          opacity: loading || !jobId || !userId || clockingLocked && !isClockedOn ? 0.7 : 1,
          whiteSpace: "nowrap"
        }}>

        {loading ? "Updating..." : isClockedOn ? "Clock Out (Valet)" : clockingLocked ? "Clocking Locked" : "Clock On To Job (Valet)"}
      </button>
      {clockedSinceText &&
      <span style={{ fontSize: "12px", color: "var(--text-1)" }}>
          Clocked on since {clockedSinceText}
        </span>
      }
      {(error || clockingLocked && lockMessage) &&
      <span style={{ fontSize: "12px", color: "var(--danger)" }}>
          {error || lockMessage}
        </span>
      }
    </div>);

}

const DOC_TYPE_META = {
  pdf: { label: "PDF", bg: "var(--danger-surface)", color: "var(--danger)" },
  png: { label: "PNG", bg: "var(--theme)", color: "var(--accent-strong)" },
  jpg: { label: "JPG", bg: "var(--theme)", color: "var(--accent-strong)" },
  jpeg: { label: "JPG", bg: "var(--theme)", color: "var(--accent-strong)" },
  gif: { label: "GIF", bg: "var(--theme)", color: "var(--accent-strong)" },
  webp: { label: "WEBP", bg: "var(--theme)", color: "var(--accent-strong)" },
  svg: { label: "SVG", bg: "var(--theme)", color: "var(--accent-strong)" },
  doc: { label: "DOC", bg: "var(--warning-surface)", color: "var(--warning)" },
  docx: { label: "DOCX", bg: "var(--warning-surface)", color: "var(--warning)" },
  xls: { label: "XLS", bg: "var(--success-surface)", color: "var(--success)" },
  xlsx: { label: "XLSX", bg: "var(--success-surface)", color: "var(--success)" }
};

function getDocTypeMeta(mimeOrExt = "") {
  const ext = mimeOrExt.split("/").pop().split(".").pop().toLowerCase();
  return DOC_TYPE_META[ext] || { label: ext.slice(0, 4).toUpperCase() || "FILE", bg: "var(--surface)", color: "var(--text-1)" };
}

function isImageMime(mime = "") {
  return /^image\/(png|jpe?g|gif|webp|svg\+xml|bmp)$/i.test(mime);
}

function isVideoMime(mime = "") {
  return /^video\//i.test(mime);
}

function isImageDocument(doc = {}) {
  const type = doc.type || doc.file_type || "";
  const name = doc.name || doc.file_name || "";
  return isImageMime(type) || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name);
}

function isVideoDocument(doc = {}) {
  const type = doc.type || doc.file_type || "";
  const name = doc.name || doc.file_name || "";
  return isVideoMime(type) || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(name);
}

function getPreviewHeading(doc = {}) {
  if (isImageDocument(doc)) return "Photo preview";
  if (isVideoDocument(doc)) return "Video preview";
  return "Document preview";
}

function DocumentsTab({
  documents = [],
  canDelete,
  onDelete,
  onManageDocuments,
  valetMode = false,
  valetJobId = null,
  valetJobNumber = "",
  valetUserId = null,
  clockingLocked = false,
  clockingLockDescription = "",
  onValetUploadComplete = () => {},
  onRenameDocument,
  onReplaceDocument
}) {
  const [valetUploadFile, setValetUploadFile] = useState(null);
  const [valetUploading, setValetUploading] = useState(false);
  const [valetUploadError, setValetUploadError] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);
  const [isRenamingPreview, setIsRenamingPreview] = useState(false);
  const [previewRenameValue, setPreviewRenameValue] = useState("");
  const [editingDoc, setEditingDoc] = useState(null);
  const [searchQuery, setSearchQuery] = useState(""); // filters the document grid by file name

  const sortedDocuments = useMemo(() => {
    return [...(documents || [])].sort((a, b) => {
      const aTime = new Date(a.uploadedAt || a.uploaded_at || 0).getTime();
      const bTime = new Date(b.uploadedAt || b.uploaded_at || 0).getTime();
      return bTime - aTime;
    });
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedDocuments;
    return sortedDocuments.filter((doc) =>
    (doc.name || doc.file_name || "").toLowerCase().includes(query)
    );
  }, [sortedDocuments, searchQuery]);

  const formatDate = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  };

  const handleValetPhotoUpload = useCallback(async () => {
    if (!valetMode) return;
    if (!valetJobId) {setValetUploadError("Job details unavailable for valet upload.");return;}
    if (!valetUploadFile) {setValetUploadError("Choose a photo to upload.");return;}
    setValetUploading(true);
    setValetUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", valetUploadFile);
      formData.append("jobId", String(valetJobId));
      formData.append("userId", String(valetUserId || "system"));
      const response = await fetch("/api/jobcards/upload-document", { method: "POST", body: formData });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Photo upload failed.");
      }
      setValetUploadFile(null);
      if (typeof onValetUploadComplete === "function") onValetUploadComplete();
    } catch (error) {
      setValetUploadError(error?.message || "Photo upload failed.");
    } finally {
      setValetUploading(false);
    }
  }, [valetMode, valetJobId, valetUploadFile, valetUserId, onValetUploadComplete]);

  return (
    <div>
      {/* Document preview popup — portalled to document.body so position:fixed is
            always relative to the viewport, not any transformed ancestor */}
      {previewDoc ? (
        <PopupModal
          isOpen
          onClose={() => { setPreviewDoc(null); setIsRenamingPreview(false); }}
          ariaLabel={getPreviewHeading(previewDoc)}
          cardClassName="app-settings-popup-card"
          cardStyle={{ width: "min(1000px, 100%)", overflow: "hidden" }}
        >
          <div className="app-settings-popup app-media-editor-popup">
            <header className="app-popup-compact-header">
              {isRenamingPreview ? (
                <>
                  <input
                    autoFocus
                    value={previewRenameValue}
                    onChange={(e) => setPreviewRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const trimmed = previewRenameValue.trim();
                        if (trimmed && typeof onRenameDocument === "function") {
                          onRenameDocument(previewDoc.id || previewDoc.file_id, trimmed);
                          setPreviewDoc((prev) => ({ ...prev, name: trimmed, file_name: trimmed }));
                        }
                        setIsRenamingPreview(false);
                      }
                      if (e.key === "Escape") setIsRenamingPreview(false);
                    }}
                    aria-label="Document name"
                    style={{ flex: "1 1 auto", minWidth: 0 }}
                  />
                  <div className="app-popup-compact-header__actions">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        const trimmed = previewRenameValue.trim();
                        if (trimmed && typeof onRenameDocument === "function") {
                          onRenameDocument(previewDoc.id || previewDoc.file_id, trimmed);
                          setPreviewDoc((prev) => ({ ...prev, name: trimmed, file_name: trimmed }));
                        }
                        setIsRenamingPreview(false);
                      }}
                    >
                      Save
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setIsRenamingPreview(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h2>{getPreviewHeading(previewDoc)}</h2>
                  <div className="app-popup-compact-header__actions">
                    {typeof onReplaceDocument === "function" &&
                    (isImageMime(previewDoc.type || previewDoc.file_type || "") ||
                      isVideoMime(previewDoc.type || previewDoc.file_type || "")) ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => { setEditingDoc(previewDoc); setPreviewDoc(null); }}
                        >
                          Edit
                        </Button>
                      ) : null}
                    {typeof onRenameDocument === "function" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setPreviewRenameValue(previewDoc.name || previewDoc.file_name || "");
                          setIsRenamingPreview(true);
                        }}
                      >
                        Rename
                      </Button>
                    ) : null}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { setPreviewDoc(null); setIsRenamingPreview(false); }}
                    >
                      Close
                    </Button>
                  </div>
                </>
              )}
            </header>

            <LayerTheme
              radius="var(--radius-md)"
              padding="0"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "1 1 auto",
                minHeight: 0,
                overflow: "auto",
              }}
            >
              {isImageDocument(previewDoc) ? (
                <img
                  src={previewDoc.url || previewDoc.file_url || ""}
                  alt="Document preview"
                  style={{ display: "block", maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              ) : isVideoDocument(previewDoc) ? (
                <video
                  src={previewDoc.url || previewDoc.file_url || ""}
                  controls
                  title="Video preview"
                  style={{ display: "block", width: "100%", maxHeight: "100%" }}
                />
              ) : (
                <iframe
                  src={previewDoc.url || previewDoc.file_url || ""}
                  title="Document preview"
                  style={{ width: "100%", height: "100%", minHeight: "60vh", display: "block" }}
                />
              )}
            </LayerTheme>
          </div>
        </PopupModal>
      ) : null}

      {/* Valet upload strip */}
      {valetMode &&
      <div
        style={{
          padding: "14px",
          borderRadius: "var(--radius-sm)",
          backgroundColor: "var(--theme)",
          marginBottom: "16px"
        }}>

          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", color: "var(--accent-strong)" }}>Valet Upload Picture</h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-1)" }}>
                Upload wash/valet photos for Job #{valetJobNumber || "—"}.
              </p>
            </div>
            <ValetClockingPanel
            jobId={valetJobId}
            jobNumber={valetJobNumber}
            userId={valetUserId}
            clockingLocked={clockingLocked}
            lockMessage={clockingLockDescription} />

          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <input type="file" accept="image/*" onChange={(e) => setValetUploadFile(e.target.files?.[0] || null)} style={{ fontSize: "13px" }} />
            <button
            type="button"
            onClick={handleValetPhotoUpload}
            disabled={valetUploading || !valetUploadFile}
            style={{
              padding: "8px 14px", borderRadius: "var(--radius-sm)", border: "none",
              backgroundColor: "var(--primary)", color: "var(--text-2)", fontWeight: 600,
              cursor: valetUploading || !valetUploadFile ? "not-allowed" : "pointer",
              opacity: valetUploading || !valetUploadFile ? 0.7 : 1
            }}>

              {valetUploading ? "Uploading..." : "Upload Valet Photo"}
            </button>
            {valetUploadError && <span style={{ color: "var(--danger)", fontSize: "12px", fontWeight: 600 }}>{valetUploadError}</span>}
          </div>
        </div>
      }

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "13px", color: "var(--text-1)", fontWeight: 500 }}>
          {sortedDocuments.length > 0 ? `${sortedDocuments.length} file${sortedDocuments.length !== 1 ? "s" : ""}` : "No documents yet"}
        </span>
        {/* Search bar — shares the toolbar row with the Upload Documents button.
            Styling inherited from staffglobal.css input[type="search"] rules. */}
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search documents…"
          aria-label="Search documents"
          style={{ flex: "1 1 200px", minWidth: "160px", maxWidth: "360px", padding: "var(--control-padding)", fontSize: "14px" }} />

        {typeof onManageDocuments === "function" ? (
          <Button variant="primary" size="sm" onClick={onManageDocuments}>
            Upload Documents
          </Button>
        ) : null}
      </div>

      {/* Empty state */}
      {sortedDocuments.length === 0 ?
      <div
        style={{
          padding: "48px 24px",
          borderRadius: "var(--radius-md)",
          textAlign: "center",
          color: "var(--text-1)",
          fontSize: "14px",
          lineHeight: 1.6
        }}>

          <div aria-hidden="true" style={{ fontSize: "32px", marginBottom: "10px", opacity: 0.4 }}>&#x1F4C4;</div>
          <div style={{ fontWeight: 600, marginBottom: "4px", color: "var(--text-1)" }}>No documents attached</div>
          Upload check-sheets, signed paperwork, or photos to keep everything in one place.
        </div> :
      filteredDocuments.length === 0 ?
      <div
        style={{
          padding: "48px 24px",
          borderRadius: "var(--radius-md)",
          textAlign: "center",
          color: "var(--text-1)",
          fontSize: "14px",
          lineHeight: 1.6
        }}>

          <div style={{ fontWeight: 600, marginBottom: "4px", color: "var(--text-1)" }}>No matching documents</div>
          No documents match “{searchQuery.trim()}”.
        </div> : (

      /* Gallery grid */
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "14px"
        }}>

          {filteredDocuments.map((doc) => {
          const docName = doc.name || doc.file_name || "Document";
          const docType = doc.type || doc.file_type || "";
          const docUrl = doc.url || doc.file_url || "";
          const isImage = isImageMime(docType);
          const typeMeta = getDocTypeMeta(docType || docName);
          const dateStr = formatDate(doc.uploadedAt || doc.uploaded_at);

          return (
            <div
              key={doc.id || doc.file_id || docUrl}
              style={{
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                backgroundColor: "var(--surface)",
                display: "flex",
                flexDirection: "column",
                transition: "box-shadow 0.15s ease"
              }}
              onMouseEnter={(e) => {e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.12)";}}
              onMouseLeave={(e) => {e.currentTarget.style.boxShadow = "none";}}>

                {/* Thumbnail / type icon */}
                <button
                type="button"
                onClick={() => docUrl && setPreviewDoc(doc)}
                title={`Open ${docName}`}
                style={{
                  display: "block",
                  width: "100%",
                  height: "130px",
                  border: "none",
                  padding: 0,
                  cursor: docUrl ? "pointer" : "default",
                  backgroundColor: isImage ? "var(--media-letterbox-bg)" : typeMeta.bg,
                  flexShrink: 0
                }}>

                  {isImage && docUrl ?
                <img
                  src={docUrl}
                  alt={docName}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  loading="lazy" /> :


                <div
                  style={{
                    width: "100%", height: "100%",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: "6px"
                  }}>

                      <span style={{ fontSize: "36px", lineHeight: 1, opacity: 0.7 }}>
                        {docType.includes("pdf") ? "\u{1F4D5}" : docType.includes("sheet") || docName.match(/\.xls/i) ? "\u{1F4D7}" : docType.includes("word") || docName.match(/\.doc/i) ? "\u{1F4D8}" : "\u{1F4C4}"}
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", color: typeMeta.color }}>
                        {typeMeta.label}
                      </span>
                    </div>
                }
                </button>

                {/* Card body */}
                <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div
                  title={docName}
                  style={{
                    fontSize: "13px", fontWeight: 600, color: "var(--text-1)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                  }}>

                    {docName}
                  </div>
                  {dateStr &&
                <div style={{ fontSize: "11px", color: "var(--text-1)" }}>{dateStr}</div>
                }
                </div>

                {/* Action row */}
                <div
                style={{
                  display: "flex", gap: "6px", padding: "8px 12px",
                  backgroundColor: "var(--surface)"
                }}>

                  <button
                  type="button"
                  onClick={() => docUrl && setPreviewDoc(doc)}
                  disabled={!docUrl}
                  style={{
                    flex: 1, padding: "5px 0",
                    borderRadius: "var(--radius-xs)", border: "none",
                    backgroundColor: "var(--theme)", color: "var(--accent-strong)",
                    fontSize: "12px", fontWeight: 600, cursor: docUrl ? "pointer" : "not-allowed",
                    opacity: docUrl ? 1 : 0.5
                  }}>

                    View
                  </button>
                  {canDelete &&
                <button
                  type="button"
                  onClick={() => typeof onDelete === "function" && onDelete(doc)}
                  style={{
                    flex: 1, padding: "5px 0",
                    borderRadius: "var(--radius-xs)", border: "none",
                    backgroundColor: "var(--danger-surface)", color: "var(--danger)",
                    fontSize: "12px", fontWeight: 600, cursor: "pointer"
                  }}>

                      Delete
                    </button>
                }
                </div>
              </div>);

        })}
        </div>)
      }

      {editingDoc !== null && isImageMime(editingDoc?.type || editingDoc?.file_type || "") ? (
      <PhotoEditorModal
        isOpen
        photoFile={editingDoc?.url || editingDoc?.file_url || ""}
        onSave={(editedFile) => {
          if (typeof onReplaceDocument === "function") onReplaceDocument(editingDoc, editedFile);
          setEditingDoc(null);
        }}
        onCancel={() => {setPreviewDoc(editingDoc);setEditingDoc(null);}}
        onSkip={() => {setPreviewDoc(editingDoc);setEditingDoc(null);}} />
      ) : null}

      {editingDoc !== null && isVideoMime(editingDoc?.type || editingDoc?.file_type || "") ? (
      <VideoEditorModal
        isOpen
        videoFile={editingDoc?.url || editingDoc?.file_url || ""}
        onSave={(editedFile) => {
          if (typeof onReplaceDocument === "function") onReplaceDocument(editingDoc, editedFile);
          setEditingDoc(null);
        }}
        onCancel={() => {setPreviewDoc(editingDoc);setEditingDoc(null);}}
        onSkip={() => {setPreviewDoc(editingDoc);setEditingDoc(null);}} />
      ) : null}

    </div>);

}

JobCardDetailPage.getLayout = (page) => <Layout requiresLandscape>{page}</Layout>;
