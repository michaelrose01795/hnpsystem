// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/job-cards/[jobNumber].js
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import InvoiceBuilderPopup from "@/components/popups/InvoiceBuilderPopup";
import { useUser } from "@/context/UserContext";
import { useConfirmation } from "@/context/ConfirmationContext";
import { supabase } from "@/lib/supabaseClient";
import { getJobByNumber, updateJob, updateJobStatus, addJobFile, deleteJobFile, upsertJobRequestsForJob, getJobsByPrimeGroup, convertToPrimeJob } from "@/lib/database/jobs";
import { fetchTrackingSnapshot } from "@/lib/database/tracking";
import { logJobSubStatus } from "@/lib/services/jobStatusService";
import { autoSetCheckedInStatus } from "@/lib/services/jobStatusService";
import {
  getNotesByJob,
  createJobNote,
  deleteJobNote,
  updateJobNote
} from "@/lib/database/notes";
import { getCustomerJobs, getCustomerVehicles } from "@/lib/database/customers";
import { createCustomerDisplaySlug } from "@/lib/customers/slug";
import {
  normalizeRequests,
  mapCustomerJobsToHistory
} from "@/lib/jobcards/utils";
import { summarizePartsPipeline } from "@/lib/partsPipeline";
import { STATUSES as JOB_STATUSES } from "@/lib/status/catalog/job";
import { resolveMainStatusId } from "@/lib/status/statusFlow";
import VhcDetailsPanel from "@/components/VHC/VhcDetailsPanel";
import InvoiceSection from "@/components/Invoices/InvoiceSection";
import { calculateVhcFinancialTotals } from "@/lib/vhc/calculateVhcTotals";
import { normaliseDecisionStatus } from "@/lib/vhc/summaryStatus";
import { isValidUuid, sanitizeNumericId } from "@/lib/utils/ids";
import PartsTabNew from "@/components/PartsTab_New";
import NotesTabNew from "@/components/NotesTab_New";
import DocumentsUploadPopup from "@/components/popups/DocumentsUploadPopup";
import WriteUpForm from "@/components/JobCards/WriteUpForm";
import { DropdownField } from "@/components/dropdownAPI";
import { CalendarField } from "@/components/calendarAPI";
import { TimePickerField } from "@/components/timePickerAPI";
import ClockingHistorySection from "@/components/JobCards/ClockingHistorySection";
import { buildApiUrl } from "@/utils/apiClient";
import { popupCardStyles, popupOverlayStyles } from "@/styles/appTheme";

const deriveVhcSeverity = (check = {}) => {
  const fields = [
    check.severity,
    check.traffic_light,
    check.trafficLight,
    check.status,
    check.section,
    check.issue_title,
    check.issueDescription,
    check.issue_description
  ];

  for (const field of fields) {
    if (!field || typeof field !== "string") continue;
    const lower = field.toLowerCase();
    if (lower.includes("red")) return "red";
    if (lower.includes("amber") || lower.includes("orange")) return "amber";
    if (lower.includes("grey") || lower.includes("gray") || lower.includes("green")) return "grey";
  }

  return null;
};

const resolveVhcSeverity = (check = {}) => deriveVhcSeverity(check) || "grey";

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
  }
  const fallbackMarker = "/job-documents/";
  const fallbackIdx = url.indexOf(fallbackMarker);
  if (fallbackIdx >= 0) {
    return decodeURIComponent(url.substring(fallbackIdx + fallbackMarker.length));
  }
  return null;
};

const JOB_DOCUMENT_BUCKET = "job-documents";

const normalizeStatusId = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

const SERVICE_CHOICE_LABELS = {
  reset: "Service Reminder Reset",
  not_required: "Service Reminder Not Required",
  no_reminder: "Doesn't Have a Service Reminder",
  indicator_on: "Service Indicator On",
};

const safeJsonParse = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const isStatusReadyForInvoicing = (status, statusId) => {
  if (statusId) return statusId === JOB_STATUSES.IN_PROGRESS;
  return normalizeStatusId(status) === JOB_STATUSES.IN_PROGRESS;
};

const arePartsPricedAndAssigned = (allocations = []) => {
  const parts = Array.isArray(allocations) ? allocations : [];
  if (parts.length === 0) {
    return true;
  }

  return parts.every((item) => {
    if (!item) return false;
    const requestedQty = Number(item.quantityRequested ?? 0);
    const allocatedQty = Number(item.quantityAllocated ?? 0);
    const hasAllocated =
      requestedQty > 0 ? allocatedQty >= requestedQty : allocatedQty > 0;
    const unitPrice =
      Number(item.unitPrice ?? 0) || Number(item.part?.unitPrice ?? 0);
    return hasAllocated && unitPrice > 0;
  });
};

const areAllPartsAllocated = (allocations = []) => {
  const parts = Array.isArray(allocations) ? allocations : [];
  if (parts.length === 0) {
    return true;
  }

  return parts.every((item) => {
    if (!item) return false;
    const assigned = item.allocatedToRequestId ?? item.allocated_to_request_id ?? null;
    return Boolean(assigned);
  });
};

const buildDateTimeFromInputs = (dateValue = "", timeValue = "") => {
  if (!dateValue || !timeValue) return null;
  const [year, month, day] = dateValue.split("-").map((segment) => parseInt(segment, 10));
  const [hours, minutes] = timeValue.split(":").map((segment) => parseInt(segment, 10));
  if (
    [year, month, day, hours, minutes].some(
      (part) => Number.isNaN(part) || part === null || part === undefined
    )
  ) {
    return null;
  }
  const date = new Date();
  date.setFullYear(year, month - 1, day);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const CAR_LOCATIONS = [
  { id: "na", label: "N/A" },
  { id: "service", label: "Service" },
  { id: "sales-1", label: "Sales 1" },
  { id: "sales-2", label: "Sales 2" },
  { id: "sales-3", label: "Sales 3" },
  { id: "sales-4", label: "Sales 4" },
  { id: "sales-5", label: "Sales 5" },
  { id: "sales-6", label: "Sales 6" },
  { id: "sales-7", label: "Sales 7" },
  { id: "sales-8", label: "Sales 8" },
  { id: "sales-9", label: "Sales 9" },
  { id: "sales-10", label: "Sales 10" },
  { id: "staff", label: "Staff" },
  { id: "trade", label: "Trade" },
];

const KEY_LOCATION_GROUPS = [
  {
    title: "General",
    options: [{ id: "na", label: "N/A" }],
  },
  {
    title: "Key Locations",
    options: [
      { id: "service-showroom", label: "Service showroom" },
      { id: "sales-show-room", label: "Sales show room" },
      { id: "red-board", label: "Red board" },
      { id: "workshop", label: "Workshop" },
      { id: "valet", label: "Valet" },
      { id: "paint", label: "Paint" },
      { id: "sales", label: "Sales" },
      { id: "prep", label: "Prep" },
    ],
  },
];

const KEY_LOCATIONS = KEY_LOCATION_GROUPS.flatMap((group) =>
  group.options.map((option) => ({
    id: option.id,
    label: option.label,
    group: group.title,
  }))
);

const CAR_LOCATION_OPTIONS = CAR_LOCATIONS.map((location) => ({
  key: location.id,
  value: location.label,
  label: location.label,
}));

const KEY_LOCATION_OPTIONS = KEY_LOCATIONS.map((location) => ({
  key: location.id,
  value: location.label,
  label: location.label,
  description: location.group,
}));

const normalizeKeyLocationLabel = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  return text
    .replace(/^Keys (received|hung|updated)\s*[-–]\s*/i, "")
    .replace(/^Key location\s*[-:–]\s*/i, "")
    .replace(/^Key locations?\s*[-:–]\s*/i, "");
};

const ensureDropdownOption = (options = [], value = "") => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return options;
  const match = options.some((option) => {
    const optionValue = option?.value ?? option?.label ?? option;
    return String(optionValue || "").trim().toLowerCase() === normalizedValue.toLowerCase();
  });
  if (match) return options;
  return [
    { key: `current-${normalizedValue}`, value: normalizedValue, label: normalizedValue },
    ...options,
  ];
};

const emptyTrackingForm = {
  id: null,
  jobNumber: "",
  reg: "",
  customer: "",
  serviceType: "",
  vehicleLocation: "N/A",
  keyLocation: "N/A",
  keyTip: "",
  status: "Waiting For Collection",
  notes: "",
};

const formatBookingDescriptionInput = (value = "") => {
  const normalized = String(value || "").replace(/\r/g, "");
  if (!normalized.trim()) {
    return "";
  }

  return normalized
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return "- ";
      }
      const withoutPrefix = trimmed.startsWith("- ")
        ? trimmed.slice(2).trimStart()
        : trimmed.replace(/^-+\s*/, "").trimStart();
      return `- ${withoutPrefix}`;
    })
    .join("\n");
};

export default function JobCardDetailPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const { user, dbUserId } = useUser();
  const { confirm } = useConfirmation();

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

  // ✅ State Management
  const [jobData, setJobData] = useState(null);
  const [statusSnapshot, setStatusSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("customer-requests");
  const tabsScrollRef = useRef(null);
  const [tabsOverflowing, setTabsOverflowing] = useState(false);
  const [sharedNote, setSharedNote] = useState("");
  const [sharedNoteMeta, setSharedNoteMeta] = useState(null);
  const [sharedNoteSaving, setSharedNoteSaving] = useState(false);
  const [jobNotes, setJobNotes] = useState([]);
  const sharedNoteSaveRef = useRef(null);
  const jobRealtimeRefreshRef = useRef(null);
  const lastRealtimeFetchAtRef = useRef(0);
  const lastJobFetchAtRef = useRef(0);
  const jobFetchInFlightRef = useRef(false);
  const [vehicleJobHistory, setVehicleJobHistory] = useState([]);
  const [customerVehicles, setCustomerVehicles] = useState([]);
  const [customerVehiclesLoading, setCustomerVehiclesLoading] = useState(false);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [bookingFlowSaving, setBookingFlowSaving] = useState(false);
  const [bookingApprovalSaving, setBookingApprovalSaving] = useState(false);
  const [jobDocuments, setJobDocuments] = useState([]);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [invoicePopupOpen, setInvoicePopupOpen] = useState(false);
  const [invoiceResponse, setInvoiceResponse] = useState(null);
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false);
  const [vhcFinancialTotalsFromPanel, setVhcFinancialTotalsFromPanel] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [trackerEntry, setTrackerEntry] = useState(null);
  const [trackerQuickModalOpen, setTrackerQuickModalOpen] = useState(false);
  const trackerUpdateRef = useRef(null);

  // ✅ Related Jobs (Prime/Sub-job) State
  const [relatedJobs, setRelatedJobs] = useState([]);
  const [relatedJobsLoading, setRelatedJobsLoading] = useState(false);

  const isArchiveMode = router.query.archive === "1";

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
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", compute);
    };
  }, [jobData, activeTab]);

  // ✅ Permission Check
  const userRoles = user?.roles?.map((r) => r.toLowerCase()) || [];
  const isWorkshopManager = userRoles.includes("workshop manager");
  const canEditBase = [
    "service",
    "service manager",
    "workshop manager",
    "admin",
    "admin manager",
    "parts",
    "parts manager"
  ].some((role) => userRoles.includes(role));
  const canManageDocumentsBase = [
    "service manager",
    "workshop manager",
    "after-sales manager",
    "admin",
    "admin manager"
  ].some((role) => userRoles.includes(role));
  const canEdit = !isArchiveMode && canEditBase;
  const canManageDocuments = !isArchiveMode && canManageDocumentsBase;
  const canViewPartsTab = [
    "workshop manager",
    "service manager",
    "parts",
    "parts manager",
    "after-sales manager"
  ].some((role) => userRoles.includes(role));
  const canViewVhcTab = Boolean(jobData?.vhcRequired || isWorkshopManager);

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
      const decision = normaliseDecisionStatus(
        check?.approval_status ??
          check?.approvalStatus ??
          check?.display_status ??
          check?.status
      );
      return (
        decision === "authorized" ||
        decision === "declined" ||
        decision === "completed"
      );
    }).length;
    return {
      total: decisionChecks.length,
      decided,
      allDecided: decided === decisionChecks.length,
    };
  }, [jobData?.vhcChecks]);
  const vhcDecisionComplete = vhcDecisionSummary.allDecided;
  const vhcTabComplete = vhcDecisionComplete || Boolean(jobData?.vhcCompletedAt);

  // Invoice tab is visible for anyone who can open this page to make review easier
  const canViewInvoice = true;

  const overallStatusId =
    statusSnapshot?.job?.overallStatus || resolveMainStatusId(jobData?.status);
  const overallStatusLabel =
    statusSnapshot?.job?.statusLabel || jobData?.status || "";
  const isBookedStatus = overallStatusId
    ? overallStatusId === JOB_STATUSES.BOOKED
    : typeof jobData?.status === "string" &&
      jobData.status.trim().toLowerCase() === "booked";

  // Sync active tab from query parameter, default to customer-requests
  useEffect(() => {
    const tabParam = router.query.tab;
    if (tabParam === "invoice" || tabParam === "clocking" || tabParam === "vhc") {
      setActiveTab(tabParam);
    } else {
      setActiveTab("customer-requests");
    }
  }, [router.query.tab]);

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
      previousStatus !== "Complete"
    ) {
      // Redirect to invoice tab when job is completed
      router.push(`/job-cards/${jobData.jobNumber}?tab=invoice`);
    }

    // Update the ref for next comparison
    previousStatusRef.current = currentStatus;
  }, [jobData?.status, jobData?.jobNumber, router]);


  const fetchSharedNote = useCallback(async (jobId) => {
    if (!jobId) return null;

    try {
      const notes = await getNotesByJob(jobId);
      setJobNotes(notes || []);
      return notes[0] || null;
    } catch (noteError) {
      console.error("❌ Failed to load shared note:", noteError);
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
      const throttleMs = process.env.NODE_ENV === "production" ? 5000 : 10000;
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

        const { data, error } = await getJobByNumber(jobNumber, { archive: isArchiveMode });

        if (error || !data?.jobCard) {
          setError(error?.message || "Job card not found");
          return;
        }

        const jobCard = data.jobCard;
        console.log("🔍 jobCard.jobRequests hours:", (jobCard.jobRequests || []).map((r) => ({ desc: (r.description || "").slice(0, 30), hours: r.hours })));
        const mappedFiles = (jobCard.files || []).map(mapJobFileRecord);
        const hydratedJobCard = { ...jobCard, files: mappedFiles };
        setJobData(hydratedJobCard);
        setJobDocuments(mappedFiles);

        if (isArchiveMode) {
          const archivedNotes = Array.isArray(jobCard.notes) ? jobCard.notes : [];
          setJobNotes(archivedNotes);
          const archivedShared = archivedNotes[0] || null;
          setSharedNote(archivedShared?.noteText || "");
          setSharedNoteMeta(archivedShared);
        } else {
          const latestSharedNote = jobCard.id
            ? await fetchSharedNote(jobCard.id)
            : null;
          setSharedNote(latestSharedNote?.noteText || "");
          setSharedNoteMeta(latestSharedNote);
        }

        const customerJobs = jobCard.customerId
          ? await getCustomerJobs(jobCard.customerId)
          : [];
        setVehicleJobHistory(
          mapCustomerJobsToHistory(customerJobs, jobCard.reg)
        );
      } catch (err) {
        console.error("❌ Exception fetching job:", err);
        setError(err?.message || "Failed to load job card");
      } finally {
        lastJobFetchAtRef.current = Date.now();
        jobFetchInFlightRef.current = false;
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [jobNumber, fetchSharedNote, isArchiveMode]
  );

  useEffect(() => {
    fetchJobData();
  }, [fetchJobData]);

  useEffect(() => {
    if (!jobData?.id || isArchiveMode) {
      setStatusSnapshot(null);
      return;
    }
    let isActive = true;
    const loadSnapshot = async () => {
      try {
        const response = await fetch(`/api/status/snapshot?jobId=${jobData.id}`);
        const payload = await response.json();
        if (!isActive) return;
        if (payload?.success && payload?.snapshot) {
          setStatusSnapshot(payload.snapshot);
        }
      } catch (snapshotError) {
        if (!isActive) return;
        console.error("Failed to load status snapshot:", snapshotError);
      }
    };
    loadSnapshot();
    return () => {
      isActive = false;
    };
  }, [jobData?.id, isArchiveMode]);

  useEffect(() => {
    if (!jobData?.id || isArchiveMode) return;
    if (!jobData.vhcRequired) return;
    if (!vhcDecisionComplete) return;
    if (jobData.vhcCompletedAt) return;
    if (!canEdit) return;

    let isActive = true;
    const markVhcComplete = async () => {
      const result = await updateJob(jobData.id, {
        vhc_completed_at: new Date().toISOString(),
      });
      if (!isActive) return;
      if (result?.success && result?.data) {
        setJobData((prev) =>
          prev
            ? { ...prev, vhcCompletedAt: result.data.vhcCompletedAt }
            : prev
        );
      }
    };
    markVhcComplete();
    return () => {
      isActive = false;
    };
  }, [jobData?.id, jobData?.vhcRequired, jobData?.vhcCompletedAt, vhcDecisionComplete, canEdit]);

  // ✅ Fetch related jobs when job data loads
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
        const result = await getJobsByPrimeGroup(primeJobNumber);
        if (!isActive) return;
        if (result.success && result.data?.allJobs) {
          // Filter out the current job from the list
          const others = result.data.allJobs.filter(
            (job) => job.jobNumber !== jobData.jobNumber
          );
          setRelatedJobs(others);
        }
      } catch (err) {
        console.error("Failed to fetch related jobs:", err);
      } finally {
        if (isActive) setRelatedJobsLoading(false);
      }
    };

    fetchRelatedJobs();
    return () => {
      isActive = false;
    };
  }, [jobData?.primeJobNumber, jobData?.jobNumber]);

  const loadTrackerEntry = useCallback(async () => {
    const targetJobNumber = jobData?.jobNumber || jobNumber;
    if (!targetJobNumber) return;
    try {
      const snapshot = await fetchTrackingSnapshot();
      if (!snapshot.success) {
        throw new Error(snapshot.error?.message || "Failed to load tracking data");
      }
      const summary = Array.isArray(snapshot.data)
        ? snapshot.data.map((entry) => ({
            jobId: entry?.jobId ?? null,
            jobNumber: entry?.jobNumber ?? "",
            reg: entry?.vehicleReg ?? entry?.reg ?? "",
            keyLocation: entry?.keyLocation ?? "",
            vehicleLocation: entry?.vehicleLocation ?? "",
            updatedAt: entry?.updatedAt ?? "",
          }))
        : [];
      // Debug logs removed after troubleshooting.
      const normalizedTarget = String(targetJobNumber).trim().toLowerCase();
      const normalizedReg = String(jobData?.reg || "").trim().toLowerCase();
      const normalizedJobId = jobData?.id ? String(jobData.id) : "";
      const matches = (snapshot.data || []).filter((entry) => {
        if (!entry) return false;
        const entryJobId = entry.jobId !== null && entry.jobId !== undefined ? String(entry.jobId) : "";
        const entryJobNumber = String(entry.jobNumber || "").trim().toLowerCase();
        const entryReg = String(entry.vehicleReg || entry.reg || "").trim().toLowerCase();
        return (
          (normalizedJobId && entryJobId === normalizedJobId) ||
          (normalizedTarget && entryJobNumber === normalizedTarget) ||
          (normalizedReg && entryReg === normalizedReg)
        );
      });
      const match = matches.sort((a, b) => {
        const aTime = new Date(a?.updatedAt || 0).getTime();
        const bTime = new Date(b?.updatedAt || 0).getTime();
        return bTime - aTime;
      })[0];
      // Debug logs removed after troubleshooting.
      if (match && trackerUpdateRef.current) {
        const snapshotTime = new Date(match.updatedAt || 0).getTime();
        const localTime = new Date(trackerUpdateRef.current).getTime();
        if (snapshotTime && localTime && snapshotTime < localTime) {
          // Debug logs removed after troubleshooting.
          return;
        }
      }
      setTrackerEntry(match || null);
    } catch (loadError) {
      console.error("Failed to load tracking entry", loadError);
      setTrackerEntry(null);
    }
  }, [jobData?.jobNumber, jobData?.reg, jobNumber]);

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
          vehicleStatus: form.vehicleStatus || form.status,
        };
        // Debug logs removed after troubleshooting.

        const response = await fetch(buildApiUrl("/api/tracking/next-action"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const responsePayload = await response
          .json()
          .catch(() => ({ message: "Failed to read tracking response" }));

        if (!response.ok) {
          console.error("Tracking update failed", response.status, responsePayload);
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
          updatedAt: localUpdatedAt,
        }));
        // Debug logs removed after troubleshooting.
        await loadTrackerEntry();
        setTrackerQuickModalOpen(false);
      } catch (saveError) {
        console.error("Failed to save tracking entry", saveError);
      }
    },
    [dbUserId, jobData, loadTrackerEntry]
  );

  const handleCheckIn = useCallback(async () => {
    if (!jobData?.id) {
      alert("Unable to check in this job because it is missing an ID.");
      return;
    }

    const confirmed = await confirm(
      `Check in customer?\n\n` +
        `Job: ${jobData.jobNumber || jobData.id}\n` +
        `Customer: ${jobData.customer || "N/A"}\n` +
        `Vehicle: ${jobData.reg || "N/A"}\n` +
        `Appointment: ${jobData.appointment?.time || "N/A"}`
    );

    if (!confirmed) return;

    setCheckingIn(true);

    try {
      const result = await autoSetCheckedInStatus(
        jobData.id,
        user?.id || user?.user_id || "SYSTEM"
      );

      if (!result?.success) {
        console.error("❌ Check-in failed:", result?.error);
        alert(`❌ Failed to check in: ${result?.error?.message || "Unknown error"}`);
        return;
      }

      alert(
        `✅ Customer Checked In!\n\n` +
          `Job: ${jobData.jobNumber || jobData.id}\n` +
          `Customer: ${jobData.customer || "N/A"}\n` +
          `Time: ${new Date().toLocaleTimeString()}`
      );

      await fetchJobData({ silent: true, force: true });
    } catch (error) {
      console.error("❌ Error checking in:", error);
      alert("❌ Error checking in customer. Please try again.");
    } finally {
      setCheckingIn(false);
    }
  }, [confirm, fetchJobData, jobData, user?.id, user?.user_id]);

  const scheduleRealtimeRefresh = useCallback(() => {
    const MIN_REFRESH_INTERVAL_MS = process.env.NODE_ENV === "production" ? 5000 : 30000;
    const now = Date.now();

    if (typeof document !== "undefined" && document.hidden) {
      return;
    }

    if (jobRealtimeRefreshRef.current) {
      clearTimeout(jobRealtimeRefreshRef.current);
    }

    const nextDelay = Math.max(750, MIN_REFRESH_INTERVAL_MS - (now - lastRealtimeFetchAtRef.current));

    jobRealtimeRefreshRef.current = setTimeout(() => {
      lastRealtimeFetchAtRef.current = Date.now();
      fetchJobData({ silent: true });
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
        const vehicles = await getCustomerVehicles(customerId);
        setCustomerVehicles(Array.isArray(vehicles) ? vehicles : []);
      } catch (vehicleError) {
        console.error("❌ Failed to load customer vehicles:", vehicleError);
        setCustomerVehicles([]);
      } finally {
        setCustomerVehiclesLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (jobData?.files) {
      const mapped = (jobData.files || []).map(mapJobFileRecord);
      setJobDocuments(mapped);
    }
  }, [jobData?.files]);

  useEffect(() => {
    if (!jobData?.customerId) {
      setCustomerVehicles([]);
      return;
    }
    refreshCustomerVehicles(jobData.customerId);
  }, [jobData?.customerId, refreshCustomerVehicles]);

  useEffect(() => {
    return () => {
      if (sharedNoteSaveRef.current) {
        clearTimeout(sharedNoteSaveRef.current);
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
        "syncedAt",
      ]);

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
      { table: "job_files", filter: `job_id=eq.${jobData.id}` },
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
      }
    ];

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobData?.id, refreshSharedNote, scheduleRealtimeRefresh, isArchiveMode]);

  const handleCustomerDetailsSave = useCallback(
    async (updatedDetails) => {
      if (!jobData?.customerId) {
        alert("No customer is linked to this job card.");
        return { success: false, error: { message: "Missing customer record" } };
      }

      setCustomerSaving(true);

      try {
        const payload = {
          firstname: updatedDetails.firstName?.trim() || null,
          lastname: updatedDetails.lastName?.trim() || null,
          email: updatedDetails.email?.trim() || null,
          mobile: updatedDetails.mobile?.trim() || null,
          telephone: updatedDetails.telephone?.trim() || null,
          address: updatedDetails.address?.trim() || null,
          postcode: updatedDetails.postcode?.trim() || null,
          contact_preference: updatedDetails.contactPreference || null
        };

        const { error: customerError } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", jobData.customerId);

        if (customerError) {
          throw customerError;
        }

        const updatedName = `${updatedDetails.firstName || ""} ${updatedDetails.lastName || ""}`.trim();

        const { error: jobError } = await supabase
          .from("jobs")
          .update({
            customer: updatedName || null
          })
          .eq("id", jobData.id);

        if (jobError) {
          throw jobError;
        }

        await fetchJobData({ silent: true, force: true });

        return { success: true };
      } catch (saveError) {
        console.error("❌ Failed to update customer:", saveError);
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

      if (!appointmentDetails.date || !appointmentDetails.time) {
        alert("Please provide both date and time.");
        return { success: false };
      }

      setAppointmentSaving(true);

      try {
        const scheduledTime = new Date(
          `${appointmentDetails.date}T${appointmentDetails.time}`
        );

        if (Number.isNaN(scheduledTime.getTime())) {
          throw new Error("Invalid appointment date or time");
        }

        const payload = {
          scheduled_time: scheduledTime.toISOString(),
          status: appointmentDetails.status || "booked",
          notes: appointmentDetails.notes || null,
          updated_at: new Date().toISOString()
        };

        if (jobData.appointment?.appointmentId) {
          const { error } = await supabase
            .from("appointments")
            .update(payload)
            .eq("appointment_id", jobData.appointment.appointmentId);

          if (error) {
            throw error;
          }
        } else {
          const insertPayload = {
            ...payload,
            job_id: jobData.id,
            customer_id: jobData.customerId || null
          };

          const { error } = await supabase
            .from("appointments")
            .insert([insertPayload]);

          if (error) {
            throw error;
          }
        }

        await fetchJobData({ silent: true, force: true });
        return { success: true };
      } catch (appointmentError) {
        console.error("❌ Failed to update appointment:", appointmentError);
        alert(appointmentError?.message || "Failed to update appointment");
        return { success: false, error: appointmentError };
      } finally {
        setAppointmentSaving(false);
      }
    },
    [canEdit, jobData, fetchJobData]
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
          ) ||
          (jobData.vehicleId && jobData.vehicleId === normalizedVehicleId
            ? {
                vehicle_id: jobData.vehicleId,
                registration: jobData.reg,
                reg_number: jobData.reg,
                make_model: jobData.makeModel,
                make: jobData.make,
                model: jobData.model
              }
            : null);

        const updates = {
          description:
            description && description.trim().length > 0 ? description : null,
          waiting_status: waitingStatus || "Neither"
        };

        if (normalizedVehicleId && normalizedVehicleId !== jobData.vehicleId) {
          updates.vehicle_id = normalizedVehicleId;
          if (selectedVehicle) {
            const regValue =
              (selectedVehicle.registration ||
                selectedVehicle.reg_number ||
                "")?.toString().toUpperCase() || null;
            if (regValue) {
              updates.vehicle_reg = regValue;
            }
            const derivedMakeModel =
              selectedVehicle.make_model ||
              [selectedVehicle.make, selectedVehicle.model]
                .filter(Boolean)
                .join(" ")
                .trim();
            if (derivedMakeModel) {
              updates.vehicle_make_model = derivedMakeModel;
            }
          }
        }

        const result = await updateJob(jobData.id, updates);

        if (!result?.success) {
          throw (
            result?.error || new Error("Failed to update booking details")
          );
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
          normalizedVehicleId !== jobData.vehicleId
        ) {
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
          console.error(
            "⚠️ Booking request notifications failed:",
            requestError
          );
        }

        return { success: true };
      } catch (bookingError) {
        console.error("❌ Failed to save booking details:", bookingError);
        alert(bookingError?.message || "Failed to save booking details");
        return { success: false, error: bookingError };
      } finally {
        setBookingFlowSaving(false);
      }
    },
    [canEdit, jobData, customerVehicles, fetchJobData, dbUserId, user]
  );

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
        console.error("❌ Failed to approve booking:", approvalError);
        alert(approvalError?.message || "Failed to approve booking");
        return { success: false, error: approvalError };
      } finally {
        setBookingApprovalSaving(false);
      }
    },
    [canEdit, jobData?.jobNumber, dbUserId, user]
  );

  const handleInvoiceBuilderConfirm = useCallback(async (builderPayload) => {
    if (!canEdit || !jobData?.id) return;
    setCreatingInvoice(true);
    try {
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
          providerId: builderPayload.providerId,
          totals: builderPayload.totals,
          requests: builderPayload.requests,
          partLines: builderPayload.partLines,
          sendEmail: builderPayload.sendEmail,
          sendPortal: builderPayload.sendPortal
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to create invoice");
      }

      await logJobSubStatus(
        jobData.id,
        "Pricing Completed",
        dbUserId || null,
        "Invoice created"
      );
      await logJobSubStatus(
        jobData.id,
        "Ready for Invoice",
        dbUserId || null,
        "Invoice ready"
      );
      const statusResult = await updateJobStatus(jobData.id, "Invoiced");
      if (!statusResult?.success) {
        console.warn("Invoice created but failed to update status:", statusResult?.error);
      }
      alert(
        `✅ Invoice created. Payment link ready: ${payload.paymentLink?.checkout_url || ""}`
      );
      setInvoiceResponse(payload);
      await fetchJobData({ silent: true, force: true });

      // Redirect to invoice tab after successful invoice creation
      router.push(`/job-cards/${jobData.jobNumber}?tab=invoice`);
    } catch (createError) {
      console.error("❌ Failed to trigger invoice creation:", createError);
      alert(createError?.message || "Failed to trigger invoice creation");
    } finally {
      setCreatingInvoice(false);
    }
  }, [
    canEdit,
    fetchJobData,
    jobData?.id,
    jobData?.jobNumber,
    jobData?.customerId,
    jobData?.customerEmail,
    updateJobStatus
  ]);

  const handleDeleteDocument = useCallback(
    async (file) => {
      if (!canManageDocuments || !file?.id) return;
      const confirmDelete = await confirm(`Delete ${file.name || "this file"}?`);
      if (!confirmDelete) return;

      try {
        const storagePath = deriveStoragePathFromUrl(file.url);
        if (storagePath) {
          const { error: removeError } = await supabase.storage
            .from(JOB_DOCUMENT_BUCKET)
            .remove([storagePath]);
          if (removeError) {
            console.warn("⚠️ Failed to remove file from storage:", removeError);
          }
        }

        const result = await deleteJobFile(file.id);
        if (!result?.success) {
          alert(result?.error?.message || "Failed to delete document");
          return;
        }

        setJobDocuments((prev) => prev.filter((doc) => doc.id !== file.id));
        setJobData((prev) =>
          prev
            ? { ...prev, files: (prev.files || []).filter((doc) => doc.id !== file.id) }
            : prev
        );
      } catch (deleteError) {
        console.error("❌ Failed to delete document:", deleteError);
        alert(deleteError?.message || "Failed to delete document");
      }
    },
    [canManageDocuments, confirm]
  );

  const saveSharedNote = useCallback(
    async (value) => {
      if (!jobData?.id) return;

      try {
        setSharedNoteSaving(true);
        const draftValue = typeof value === "string" ? value : "";
        const isEmpty = draftValue.trim().length === 0;

        if (isEmpty && sharedNoteMeta?.noteId) {
          const deleteResult = await deleteJobNote(
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
          const updateResult = await updateJobNote(
            sharedNoteMeta.noteId,
            draftValue,
            user?.user_id || null
          );

          if (!updateResult?.success) {
            throw updateResult?.error || new Error("Failed to update note");
          }
        } else {
          const createResult = await createJobNote({
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
        console.error("❌ Failed to save note:", saveError);
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

  // ✅ Update Job Request Handler
  const handleUpdateRequests = async (updatedRequests) => {
    if (!canEdit || !jobData?.id) return;

    try {
      const normalized = (Array.isArray(updatedRequests) ? updatedRequests : []).map((entry, index) => ({
        requestId: entry.requestId ?? entry.request_id ?? null,
        text: entry.text ?? entry.description ?? "",
        time: entry.time ?? entry.hours ?? "",
        paymentType: entry.paymentType ?? entry.jobType ?? "Customer",
        noteText: entry.noteText ?? entry.note_text ?? null,
        sortOrder: index + 1,
      }));

      const syncResult = await upsertJobRequestsForJob(jobData.id, normalized);
      if (!syncResult?.success) {
        throw syncResult?.error || new Error("Failed to update job requests");
      }

      const requestPayload = normalized.map((entry) => ({
        text: entry.text,
        time: entry.time,
        paymentType: entry.paymentType,
      }));

      const result = await updateJob(jobData.id, {
        requests: requestPayload,
      });

      if (!result?.success) {
        throw result?.error || new Error("Failed to update job requests");
      }

      setJobData((prev) =>
        prev ? { ...prev, requests: requestPayload } : prev
      );
      await fetchJobData({ silent: true, force: true });
      alert("✅ Job requests updated successfully");
    } catch (error) {
      console.error("Error updating requests:", error);
      alert("Failed to update job requests");
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
      const result = await updateJob(jobData.id, {
        vhc_required: nextValue
      });

      if (result.success) {
        setJobData((prev) => (prev ? { ...prev, vhcRequired: nextValue } : prev));
        alert(nextValue ? "✅ VHC marked as required" : "✅ VHC marked as not required");
      } else {
        alert(result?.error?.message || "Failed to update VHC requirement");
      }
    } catch (toggleError) {
      console.error("Error updating VHC requirement:", toggleError);
      alert("Failed to update VHC requirement");
    }
  };

  // ✅ VHC Financial Totals (calculated from vhcChecks or received from VhcDetailsPanel)
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

  // ✅ Loading State
  if (loading) {
    return (
      <Layout>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "80vh",
          flexDirection: "column",
          gap: "16px"
        }}>
          <div style={{
            width: "60px",
            height: "60px",
            border: "4px solid var(--surface)",
            borderTop: "4px solid var(--primary)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ color: "var(--grey-accent)" }}>Loading job card #{jobNumber}...</p>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </Layout>
    );
  }

  // ✅ Error State
  if (error || !jobData) {
    return (
      <Layout>
        <div style={{ 
          padding: "40px", 
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh"
        }}>
          <div style={{ fontSize: "60px", marginBottom: "20px" }}>⚠️</div>
          <h2 style={{ color: "var(--primary)", marginBottom: "10px" }}>
            {error || "Job card not found"}
          </h2>
          <p style={{ color: "var(--grey-accent)", marginBottom: "30px" }}>
            Job #{jobNumber} could not be loaded from the database.
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => router.push("/job-cards/view")}
              style={{
                padding: "12px 24px",
                backgroundColor: "var(--primary)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "var(--primary-dark)"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "var(--primary)"}
            >
              View All Job Cards
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  try {
  const writeUpComplete =
    jobData.completionStatus === "complete" ||
    jobData.writeUp?.completion_status === "complete";
  const vhcQualified = !jobData.vhcRequired || Boolean(jobData.vhcCompletedAt);
  const partsReady = arePartsPricedAndAssigned(jobData.partsAllocations);
  const partsAllocated = areAllPartsAllocated(jobData.partsAllocations);
  const statusReadyForInvoicing = isStatusReadyForInvoicing(
    jobData.status,
    overallStatusId
  );
  const invoicePrerequisitesMet = writeUpComplete && vhcQualified && partsReady && partsAllocated;
  const invoiceBlockingReasons = [];
  if (!writeUpComplete) {
    invoiceBlockingReasons.push("Complete and mark the write up as finished.");
  }
  if (!vhcQualified) {
    invoiceBlockingReasons.push("Complete the Vehicle Health Check or mark it as not required.");
  }
  if (!partsAllocated) {
    invoiceBlockingReasons.push("Allocate every booked part to a request or additional request.");
  }
  if (!partsReady) {
    invoiceBlockingReasons.push("Ensure all allocated parts have quantities and pricing.");
  }
  const showCreateInvoiceButton =
    canEdit && invoicePrerequisitesMet && statusReadyForInvoicing;

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
  const vhcTabBadge = vhcSummaryCounts.red || vhcSummaryCounts.amber ? "⚠" : undefined;
  const jobDivisionLabel =
    typeof jobData.jobDivision === "string"
      ? jobData.jobDivision
      : jobData.jobDivision
      ? String(jobData.jobDivision)
      : "";
  const jobDivisionLower = jobDivisionLabel.toLowerCase();

  // ✅ Tab Configuration
  const tabs = [
    { id: "customer-requests", label: "Customer Requests"},
    { id: "contact", label: "Contact"},
    { id: "scheduling", label: "Scheduling"},
    { id: "service-history", label: "Service History"},
    ...(canViewPartsTab ? [{ id: "parts", label: "Parts"}] : []),
    { id: "notes", label: "Notes"},
    { id: "write-up", label: "Write Up"},
    ...(canViewVhcTab ? [{ id: "vhc", label: "VHC", badge: vhcTabBadge}] : []),
    { id: "warranty", label: "Warranty"},
    { id: "clocking", label: "Clocking"},
    { id: "messages", label: "Messages"},
    { id: "documents", label: "Documents"},
    { id: "invoice", label: "Invoice"}
  ];

  const pageStackStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };

  // ✅ Main Render
  return (
    <JobCardErrorBoundary>
      <Layout>
      <div style={pageStackStyle}>
        {isArchiveMode && (
          <section
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              border: "1px solid var(--danger-surface)",
              backgroundColor: "var(--surface-light)",
              color: "var(--danger-dark)",
              fontSize: "0.95rem",
              fontWeight: 600,
            }}
          >
            Archived copy &middot; Job #{jobData.jobNumber} is read-only. VHC, notes, and documents are preserved for audit.
          </section>
        )}

        {/* ✅ Header Section */}
        <section style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px",
          backgroundColor: "var(--layer-section-level-1)",
          borderRadius: "12px",
          boxShadow: "none",
          border: "1px solid var(--surface-light)",
          flexShrink: 0
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <h1 style={{ 
                margin: 0, 
                color: "var(--primary)", 
                fontSize: "28px", 
                fontWeight: "700" 
              }}>
                Job Card #{jobData.jobNumber}
              </h1>
              <span style={{
                padding: "6px 14px",
                backgroundColor: 
                  overallStatusLabel === "Open" ? "var(--success-surface)" : 
                  overallStatusLabel === "Complete" ? "var(--info-surface)" : 
                  "var(--warning-surface)",
                color: 
                  overallStatusLabel === "Open" ? "var(--success-dark)" : 
                  overallStatusLabel === "Complete" ? "var(--info)" : 
                  "var(--danger)",
                borderRadius: "20px",
                fontWeight: "600",
                fontSize: "13px"
              }}>
                {overallStatusLabel}
              </span>
              {jobData.jobSource === "Warranty" && (
                <span style={{
                  padding: "6px 14px",
                  backgroundColor: "var(--warning-surface)",
                  color: "var(--danger)",
                  borderRadius: "20px",
                  fontWeight: "600",
                  fontSize: "13px"
                }}>
                  {jobData.jobSource}
                </span>
              )}
              {jobDivisionLabel && (
                <span
                  style={{
                    padding: "6px 14px",
                    backgroundColor:
                      jobDivisionLower === "sales"
                        ? "var(--info-surface)"
                        : "var(--success-surface)",
                    color:
                      jobDivisionLower === "sales"
                        ? "var(--info)"
                        : "var(--success-dark)",
                    borderRadius: "20px",
                    fontWeight: "600",
                    fontSize: "13px",
                  }}
                >
                  {jobDivisionLabel}
                </span>
              )}
              {/* ✅ Prime/Sub-job badge */}
              {jobData.isPrimeJob && (
                <span
                  style={{
                    padding: "6px 14px",
                    backgroundColor: "var(--primary-surface)",
                    color: "var(--primary)",
                    borderRadius: "20px",
                    fontWeight: "600",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  🔗 Prime Job
                </span>
              )}
              {jobData.primeJobId && !jobData.isPrimeJob && (
                <span
                  style={{
                    padding: "6px 14px",
                    backgroundColor: "var(--primary-surface)",
                    color: "var(--primary)",
                    borderRadius: "20px",
                    fontWeight: "600",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                  onClick={() => router.push(`/job-cards/${jobData.primeJobNumber}`)}
                  title={`Go to prime job ${jobData.primeJobNumber}`}
                >
                  Sub-job of #{jobData.primeJobNumber}
                </span>
              )}
            </div>
            <p style={{ margin: 0, color: "var(--grey-accent)", fontSize: "14px" }}>
              Created: {new Date(jobData.createdAt).toLocaleString()} |
              Last Updated: {new Date(jobData.updatedAt).toLocaleString()}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* ✅ Add Sub-Job button for prime jobs */}
            {jobData.isPrimeJob && (
              <button
                onClick={() => router.push(`/job-cards/create?primeJob=${jobData.jobNumber}`)}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "var(--primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                + Add Sub-Job
              </button>
            )}
            {isBookedStatus && (
              <button
                onClick={handleCheckIn}
                disabled={checkingIn || !canEdit}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "var(--success)",
                  color: "var(--info-dark)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: checkingIn || !canEdit ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  fontSize: "14px",
                  transition: "background-color 0.2s",
                  opacity: checkingIn || !canEdit ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!checkingIn && canEdit) {
                    e.target.style.backgroundColor = "var(--success-dark)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!checkingIn && canEdit) {
                    e.target.style.backgroundColor = "var(--success)";
                  }
                }}
              >
                {checkingIn ? "Checking In..." : "Check In"}
              </button>
            )}
            {showCreateInvoiceButton && (
              <button
                onClick={() => setInvoicePopupOpen(true)}
                disabled={creatingInvoice}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "var(--info-dark)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: creatingInvoice ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  fontSize: "14px",
                  transition: "background-color 0.2s, transform 0.2s",
                  opacity: creatingInvoice ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!creatingInvoice) {
                    e.target.style.backgroundColor = "var(--info-dark)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!creatingInvoice) {
                    e.target.style.backgroundColor = "var(--info-dark)";
                  }
                }}
              >
                Create Invoice
              </button>
            )}
            <button
              onClick={() => router.push("/job-cards/view")}
              style={{
                padding: "10px 20px",
                backgroundColor: "var(--grey-accent)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "var(--grey-accent)"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "var(--grey-accent)"}
            >
              Back
            </button>
          </div>
        </section>

        {/* ✅ Related Jobs Panel */}
        {(relatedJobs.length > 0 || jobData.isPrimeJob) && (
          <section
            style={{
              padding: "12px 20px",
              backgroundColor: "var(--primary-surface)",
              borderRadius: "12px",
              border: "1px solid var(--primary-light)",
              marginBottom: "0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--primary)" }}>
                  🔗 {jobData.isPrimeJob ? "Linked Jobs" : "Related Jobs"} ({relatedJobs.length + 1} total)
                </span>
                {relatedJobsLoading && (
                  <span style={{ fontSize: "12px", color: "var(--grey-accent)" }}>Loading...</span>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {/* Current job indicator */}
                <span
                  style={{
                    padding: "4px 12px",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    borderRadius: "16px",
                    fontSize: "12px",
                    fontWeight: "600",
                  }}
                >
                  #{jobData.jobNumber} (current)
                </span>
                {/* Related jobs links */}
                {relatedJobs.map((rJob) => (
                  <button
                    key={rJob.id}
                    onClick={() => router.push(`/job-cards/${rJob.jobNumber}`)}
                    style={{
                      padding: "4px 12px",
                      backgroundColor: "var(--surface)",
                      color: "var(--text-primary)",
                      borderRadius: "16px",
                      fontSize: "12px",
                      fontWeight: "500",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    #{rJob.jobNumber}
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor:
                          rJob.status === "Open" ? "var(--success-surface)" :
                          rJob.status === "Complete" ? "var(--info-surface)" :
                          "var(--warning-surface)",
                        color:
                          rJob.status === "Open" ? "var(--success-dark)" :
                          rJob.status === "Complete" ? "var(--info)" :
                          "var(--danger)",
                      }}
                    >
                      {rJob.status}
                    </span>
                  </button>
                ))}
                {jobData.isPrimeJob && (
                  <button
                    onClick={() => router.push(`/job-cards/create?primeJob=${jobData.jobNumber}`)}
                    style={{
                      padding: "4px 12px",
                      backgroundColor: "var(--primary)",
                      color: "white",
                      borderRadius: "16px",
                      fontSize: "12px",
                      fontWeight: "600",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ✅ Vehicle & Customer Info Bar */}
        <section style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 0.9fr 1fr",
          gap: "16px",
          flexShrink: 0
        }}>
          <div style={{
            padding: "16px 20px",
            backgroundColor: "var(--surface)",
            borderRadius: "12px",
            boxShadow: "none",
            border: "1px solid var(--surface-muted)"
          }}>
            <div style={{ fontSize: "12px", color: "var(--grey-accent)", marginBottom: "4px" }}>VEHICLE</div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--primary)", marginBottom: "4px" }}>
              {jobData.reg || "N/A"}
            </div>
            <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              {jobData.makeModel || `${jobData.make} ${jobData.model}`}
            </div>
          </div>

          <div style={{
            padding: "16px 20px",
            backgroundColor: "var(--surface)",
            borderRadius: "12px",
            boxShadow: "none",
            border: "1px solid var(--surface-muted)"
          }}>
            <div style={{ fontSize: "12px", color: "var(--grey-accent)", marginBottom: "4px" }}>CUSTOMER</div>
            <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "4px" }}>
              {jobData.customer || "N/A"}
            </div>
            <div style={{ fontSize: "14px", color: "var(--grey-accent)" }}>
              {jobData.customerPhone || jobData.customerEmail || "No contact info"}
            </div>
          </div>

          <div style={{
            padding: "16px 20px",
            backgroundColor: "var(--surface)",
            borderRadius: "12px",
            boxShadow: "none",
            border: "1px solid var(--surface-muted)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", color: "var(--danger)", marginBottom: "4px" }}>DECLINED</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--danger)", marginBottom: "4px" }}>
                  {formatCurrency(vhcFinancialTotals.declined)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--grey-accent)" }}>
                  VHC Total
                </div>
              </div>
              <div style={{ width: "1px", backgroundColor: "var(--surface-light)" }} />
              <div style={{ flex: 1, textAlign: "right" }}>
                <div style={{ fontSize: "12px", color: "var(--success)", marginBottom: "4px" }}>AUTHORISED</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--success)", marginBottom: "4px" }}>
                  {formatCurrency(vhcFinancialTotals.authorized)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--grey-accent)" }}>
                  VHC Total
                </div>
              </div>
            </div>
          </div>

          <div
            onClick={() => setTrackerQuickModalOpen(true)}
            style={{
              padding: "16px 20px",
              backgroundColor: "var(--surface)",
              borderRadius: "12px",
              boxShadow: "none",
              border: "1px solid var(--surface-muted)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              cursor: "pointer"
            }}
          >
            <div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
                Key location
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                {normalizeKeyLocationLabel(trackerEntry?.keyLocation) || KEY_LOCATIONS[0].label}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
                Car location
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                {trackerEntry?.vehicleLocation || CAR_LOCATIONS[0].label}
              </div>
            </div>
          </div>
        </section>

        {/* ✅ Tabs Navigation */}
        <section
          style={{
            borderRadius: "999px",
            border: "1px solid var(--surface-light)",
            background: "var(--surface)",
            padding: "6px",
            width: "100%",
            flexShrink: 0,
            overflow: "hidden",
            minHeight: "44px",
            display: "flex",
            alignItems: "center",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "6px",
              width: "100%",
              overflowX: "auto",
              overflowY: "hidden",
              scrollbarWidth: "thin",
              scrollbarColor: "var(--scrollbar-thumb) transparent",
              scrollBehavior: "smooth",
              WebkitOverflowScrolling: "touch",
              alignItems: "center",
              justifyContent: tabsOverflowing ? "flex-start" : "center",
              flexWrap: "nowrap",
              flex: 1,
              paddingBottom: tabsOverflowing ? "6px" : 0,
            }}
            className="jobcard-tabs-scroll-container"
            ref={tabsScrollRef}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const isWriteUpTab = tab.id === "write-up";
              const isVhcTab = tab.id === "vhc";
              const isCompleteHighlight =
                (isWriteUpTab && writeUpComplete) ||
                (isVhcTab && vhcTabComplete);
              const tabBackground = isCompleteHighlight
                ? isActive
                  ? "var(--success)"
                  : "var(--success-surface)"
                : isActive
                ? "var(--primary)"
                : "transparent";
              const tabColor = isCompleteHighlight
                ? isActive
                  ? "var(--text-inverse)"
                  : "var(--success-dark)"
                : isActive
                ? "var(--text-inverse)"
                : "var(--text-primary)";
              const tabBorder = isCompleteHighlight
                ? "1px solid var(--success)"
                : "1px solid transparent";

              return (
                <button
                  key={tab.id}
                  onClick={(e) => {
                    setActiveTab(tab.id);
                    e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                  }}
                  style={{
                    flex: "0 0 auto",
                    borderRadius: "999px",
                    border: tabBorder,
                    padding: "10px 20px",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: tabBackground,
                    color: tabColor,
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                    height: "auto",
                    minHeight: "38px",
                  }}
                >
                  {tab.icon && <span>{tab.icon}</span>}
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      style={{
                        padding: "3px 8px",
                        backgroundColor: isActive ? "rgba(255, 255, 255, 0.3)" : "var(--primary)",
                        color: "white",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontWeight: "600",
                      }}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
        <style jsx global>{`
          .jobcard-tabs-scroll-container::-webkit-scrollbar {
            height: 6px;
          }
          .jobcard-tabs-scroll-container::-webkit-scrollbar-track {
            background: transparent;
          }
          .jobcard-tabs-scroll-container::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 999px;
          }
          .jobcard-tabs-scroll-container::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
          }
        `}</style>

        {/* ✅ Tab Content */}
        <section style={{
          backgroundColor: "var(--layer-section-level-2)",
          borderRadius: "12px",
          boxShadow: "none",
          border: "1px solid var(--surface-light)",
          padding: "24px"
        }}>
          {/* Preload all tabs on page load; switch by display only. */}
          <div style={{ display: activeTab === "customer-requests" ? "block" : "none" }}>
            <CustomerRequestsTab
              jobData={jobData}
              canEdit={canEdit}
              onUpdate={handleUpdateRequests}
              onToggleVhcRequired={handleToggleVhcRequired}
              vhcSummary={vhcSummaryCounts}
              vhcChecks={jobVhcChecks}
              notes={jobNotes}
              partsJobItems={jobData?.parts_job_items || []}
            />
          </div>

          <div style={{ display: activeTab === "contact" ? "block" : "none" }}>
            <ContactTab
              jobData={jobData}
              canEdit={canEdit}
              onSaveCustomerDetails={handleCustomerDetailsSave}
              customerSaving={customerSaving}
            />
          </div>

          <div style={{ display: activeTab === "scheduling" ? "block" : "none" }}>
            <SchedulingTab
              jobData={jobData}
              canEdit={canEdit}
              customerVehicles={customerVehicles}
              customerVehiclesLoading={customerVehiclesLoading}
              bookingRequest={jobData?.bookingRequest}
              onBookingFlowSave={handleBookingFlowSave}
              bookingFlowSaving={bookingFlowSaving}
              onBookingApproval={handleBookingApproval}
              bookingApprovalSaving={bookingApprovalSaving}
              onAppointmentSave={handleAppointmentSave}
              appointmentSaving={appointmentSaving}
            />
          </div>

          <div style={{ display: activeTab === "service-history" ? "block" : "none" }}>
            <ServiceHistoryTab vehicleJobHistory={vehicleJobHistory} />
          </div>

          {canViewPartsTab && (
            <div style={{ display: activeTab === "parts" ? "block" : "none" }}>
              <PartsTabNew
                jobData={jobData}
                canEdit={canEdit}
                onRefreshJob={() => fetchJobData({ silent: true, force: true })}
                actingUserId={actingUserId}
                actingUserNumericId={actingUserNumericId}
                invoiceReady={invoicePrerequisitesMet}
              />
            </div>
          )}

          <div style={{ display: activeTab === "notes" ? "block" : "none" }}>
            <NotesTabNew
              jobData={jobData}
              canEdit={canEdit}
              actingUserNumericId={actingUserNumericId}
              onNotesChange={(nextNotes) => {
                setJobNotes(nextNotes || []);
                setSharedNote(nextNotes?.[0]?.noteText || "");
                setSharedNoteMeta(nextNotes?.[0] || null);
              }}
            />
          </div>

          <div style={{ display: activeTab === "write-up" ? "block" : "none", height: "100%" }}>
            <div
              style={{
                height: "100%",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <WriteUpForm
                jobNumber={jobData?.jobNumber || jobNumber}
                jobCardData={jobData}
                showHeader={false}
                onSaveSuccess={() => fetchJobData({ silent: true, force: true })}
              />
            </div>
          </div>

          <div style={{ display: activeTab === "vhc" ? "block" : "none" }}>
            <VHCTab
              jobNumber={jobNumber}
              jobData={jobData}
              onFinancialTotalsChange={setVhcFinancialTotalsFromPanel}
              onJobDataRefresh={() => fetchJobData({ silent: true, force: true })}
            />
          </div>

          <div style={{ display: activeTab === "warranty" ? "block" : "none" }}>
            <WarrantyTab
              jobData={jobData}
              canEdit={canEdit}
              onLinkComplete={() => fetchJobData({ silent: true, force: true })}
            />
          </div>

          <div style={{ display: activeTab === "clocking" ? "block" : "none" }}>
            <ClockingTab jobData={jobData} canEdit={canEdit} />
          </div>

          <div style={{ display: activeTab === "messages" ? "block" : "none" }}>
            <MessagesTab
              thread={jobData?.messagingThread}
              jobNumber={jobData?.jobNumber || jobNumber}
              customerEmail={jobData?.customerEmail}
            />
          </div>

          <div style={{ display: activeTab === "documents" ? "block" : "none" }}>
            <DocumentsTab
              documents={jobDocuments}
              canDelete={canManageDocuments}
              onDelete={handleDeleteDocument}
              onManageDocuments={canManageDocuments ? () => setShowDocumentsPopup(true) : undefined}
            />
          </div>

          <div data-invoice-print-area style={{ display: activeTab === "invoice" ? "block" : "none" }}>
            {!invoicePrerequisitesMet && (
              <div
                style={{
                  padding: "24px",
                  border: "1px dashed var(--warning)",
                  borderRadius: "16px",
                  backgroundColor: "var(--warning-surface)",
                  color: "var(--warning-dark)",
                  marginBottom: "16px",
                }}
              >
                <h3 style={{ marginTop: 0, color: "var(--warning-dark)" }}>Invoice prerequisites incomplete</h3>
                <p style={{ marginBottom: "12px" }}>
                  Review the invoice layout below, but complete these tasks before sharing with the customer:
                </p>
                <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--danger-dark)", fontWeight: 600 }}>
                  {invoiceBlockingReasons.map((reason) => (
                    <li key={reason} style={{ marginBottom: "6px" }}>
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <InvoiceSection jobData={jobData} />
          </div>
        </section>
        <InvoiceBuilderPopup
          isOpen={invoicePopupOpen}
          onClose={() => {
            setInvoicePopupOpen(false);
            setInvoiceResponse(null);
          }}
          jobData={jobData}
          onConfirm={handleInvoiceBuilderConfirm}
          invoiceResponse={invoiceResponse}
          isSubmitting={creatingInvoice}
        />
        <DocumentsUploadPopup
          open={showDocumentsPopup}
          onClose={() => setShowDocumentsPopup(false)}
          jobId={jobData?.id ? String(jobData.id) : null}
          userId={user?.user_id || actingUserId || null}
          onAfterUpload={() => fetchJobData({ silent: true, force: true })}
          existingDocuments={jobDocuments}
        />
        {trackerQuickModalOpen && (
          <LocationUpdateModal
            entry={{
              ...emptyTrackingForm,
              jobNumber: jobData?.jobNumber || "",
              reg: jobData?.reg || "",
              customer: jobData?.customer || "",
              serviceType: jobData?.type || jobData?.serviceType || "",
              vehicleLocation: trackerEntry?.vehicleLocation
                ? trackerEntry.vehicleLocation
                : emptyTrackingForm.vehicleLocation,
              keyLocation: trackerEntry?.keyLocation
                ? normalizeKeyLocationLabel(trackerEntry.keyLocation)
                : emptyTrackingForm.keyLocation,
            }}
            onClose={() => setTrackerQuickModalOpen(false)}
            onSave={handleTrackerSave}
          />
        )}

      </div>

      </Layout>
    </JobCardErrorBoundary>
  );
  } catch (renderError) {
    console.error("Job card render error:", renderError);
    return (
      <Layout>
        <div style={{
          padding: "40px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh"
        }}>
          <div style={{ fontSize: "60px", marginBottom: "20px" }}>⚠️</div>
          <h2 style={{ color: "var(--primary)", marginBottom: "10px" }}>
            Job card failed to render
          </h2>
          <p style={{ color: "var(--grey-accent)", marginBottom: "18px" }}>
            {renderError?.message || String(renderError)}
          </p>
          <p style={{ color: "var(--grey-accent)", marginBottom: "30px", fontSize: "13px" }}>
            Check the console for the stack trace.
          </p>
        </div>
      </Layout>
    );
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
    console.error("Job card render error:", error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const message = this.state.error?.message || String(this.state.error);

    return (
      <Layout>
        <div style={{
          padding: "40px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh"
        }}>
          <div style={{ fontSize: "60px", marginBottom: "20px" }}>⚠️</div>
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
      </Layout>
    );
  }
}

// ============================================
// TAB COMPONENTS
// ============================================

// ✅ Customer Requests Tab
function CustomerRequestsTab({
  jobData,
  canEdit,
  onUpdate,
  onToggleVhcRequired = () => {},
  vhcSummary = { total: 0, red: 0, amber: 0 },
  vhcChecks = [],
  notes = [],
  partsJobItems = []
}) {
  const buildEditRequests = useCallback(() => {
    const source = Array.isArray(jobData?.jobRequests)
      ? jobData.jobRequests
      : Array.isArray(jobData?.job_requests)
      ? jobData.job_requests
      : [];
    if (source.length > 0) {
      return source.map((row) => ({
        requestId: row.requestId ?? row.request_id ?? null,
        text: row.description ?? row.text ?? "",
        time: row.hours ?? row.time ?? "",
        paymentType: row.jobType ?? row.job_type ?? row.paymentType ?? "Customer",
        noteText: row.noteText ?? row.note_text ?? "",
      }));
    }
    return normalizeRequests(jobData.requests).map((req) => ({
      requestId: null,
      text: req?.text || req?.description || req || "",
      time: req?.time ?? req?.hours ?? "",
      paymentType: req?.paymentType || req?.jobType || "Customer",
      noteText: "",
    }));
  }, [jobData]);
  const [requests, setRequests] = useState(buildEditRequests);
  const [editing, setEditing] = useState(false);
  const smallPrintStyle = { fontSize: "11px", color: "var(--info)" };
  const requestSubtitleStyle = {
    fontSize: "11px",
    color: "var(--grey-accent)",
    fontWeight: "700",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  };
  const formatPrePickLabel = (value = "") => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    return trimmed
      .split("_")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  };
  const unifiedRequests = useMemo(() => {
    const source = Array.isArray(jobData?.jobRequests)
      ? jobData.jobRequests
      : Array.isArray(jobData?.job_requests)
      ? jobData.job_requests
      : [];

    if (source.length === 0) {
      return normalizeRequests(jobData.requests).map((req, index) => ({
        requestId: null,
        description: req?.text || req?.description || req || "",
        hours: req?.time ?? req?.hours ?? "",
        jobType: req?.paymentType || req?.jobType || "Customer",
        sortOrder: index + 1,
        status: null,
        requestSource: "customer_request",
        prePickLocation: null,
        noteText: "",
        vhcItemId: null,
        partsJobItemId: null,
      }));
    }

    return source.map((row, index) => ({
      requestId: row.requestId ?? row.request_id ?? null,
      description: row.description ?? row.text ?? "",
      hours: row.hours ?? row.time ?? "",
      jobType: row.jobType ?? row.job_type ?? row.paymentType ?? "Customer",
      sortOrder:
        row.sortOrder ?? row.sort_order ?? (index + 1),
      status: row.status ?? null,
      requestSource: row.requestSource ?? row.request_source ?? "customer_request",
      prePickLocation: row.prePickLocation ?? row.pre_pick_location ?? null,
      noteText: row.noteText ?? row.note_text ?? "",
      vhcItemId: row.vhcItemId ?? row.vhc_item_id ?? null,
      partsJobItemId: row.partsJobItemId ?? row.parts_job_item_id ?? null,
    }));
  }, [jobData?.jobRequests, jobData?.job_requests, jobData?.requests]);

  const customerRequestRows = useMemo(() => {
    return unifiedRequests
      .filter((row) => (row.requestSource || "customer_request") === "customer_request")
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [unifiedRequests]);

  const partsByRequestId = useMemo(() => {
    const allocations = Array.isArray(jobData?.partsAllocations) ? jobData.partsAllocations : [];
    const map = {};
    allocations.forEach((item) => {
      const reqId = item.allocatedToRequestId ?? item.allocated_to_request_id ?? null;
      if (!reqId) return;
      const key = String(reqId);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [jobData?.partsAllocations]);

  const vhcAliasMap = useMemo(() => {
    const rows = Array.isArray(jobData?.vhcItemAliases)
      ? jobData.vhcItemAliases
      : Array.isArray(jobData?.vhc_item_aliases)
      ? jobData.vhc_item_aliases
      : [];
    const map = new Map();
    rows.forEach((row) => {
      const displayId = row?.display_id ?? row?.displayId ?? null;
      const vhcItemId = row?.vhc_item_id ?? row?.vhcItemId ?? null;
      if (displayId === null || displayId === undefined) return;
      if (vhcItemId === null || vhcItemId === undefined) return;
      map.set(String(displayId), String(vhcItemId));
    });
    return map;
  }, [jobData?.vhcItemAliases, jobData?.vhc_item_aliases]);

  const resolveCanonicalVhcId = useCallback(
    (value) => {
      if (value === null || value === undefined) return "";
      const key = String(value);
      return vhcAliasMap.get(key) || key;
    },
    [vhcAliasMap]
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
      value
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    []
  );

  // Authorised VHC items (single source of truth: vhc_authorized_items -> jobData.authorizedVhcItems)
  const authorisedRows = useMemo(() => {
    const canonicalAuthorized = Array.isArray(jobData?.authorizedVhcItems)
      ? jobData.authorizedVhcItems
      : [];
    return canonicalAuthorized.map((row) => {
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

      return {
        requestId: row.requestId ?? row.request_id ?? null,
        description: row.description ?? row.text ?? row.section ?? "",
        label:
          isServiceIndicatorRow && (isServiceReminderOil || isServiceReminder)
            ? "Service Reminder"
            : baseLabel,
        detail:
          isServiceIndicatorRow && (isServiceReminderOil || isServiceReminder)
            ? serviceDetail
            : null,
        hours: row.hours ?? row.time ?? row.labourHours ?? "",
        jobType: row.jobType ?? row.job_type ?? row.paymentType ?? "Customer",
        sortOrder: row.sortOrder ?? row.sort_order ?? null,
        status: row.status ?? null,
        requestSource: row.requestSource ?? row.request_source ?? "vhc_authorised",
        prePickLocation: row.prePickLocation ?? row.pre_pick_location ?? null,
        noteText: row.noteText ?? row.note_text ?? "",
        vhcItemId: row.vhcItemId ?? row.vhc_item_id ?? null,
        partsJobItemId: row.partsJobItemId ?? row.parts_job_item_id ?? null,
        labourHours: row.labourHours ?? row.labour_hours ?? null,
        partsCost: row.partsCost ?? row.parts_cost ?? null,
        approvedAt: row.approvedAt ?? row.approved_at ?? null,
        approvedBy: row.approvedBy ?? row.approved_by ?? null,
      };
    });
  }, [jobData?.authorizedVhcItems, normaliseServiceText, serviceChoiceLabel]);

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
    (rows) =>
      (Array.isArray(rows) ? rows : []).map((row, index) => ({
        requestId: row.requestId ?? null,
        text: row.description || "",
        time: row.hours ?? "",
        paymentType: row.jobType || "Customer",
        noteText: row.noteText || "",
        sortOrder: row.sortOrder ?? index + 1,
      })),
    []
  );

  useEffect(() => {
    setRequests(buildEditableRequests(customerRequestRows));
  }, [buildEditableRequests, customerRequestRows]);

  const handleSave = () => {
    onUpdate(requests);
    setEditing(false);
  };

  const handleAddRequest = () => {
    setRequests([...requests, { text: "", time: "", paymentType: "Customer", noteText: "" }]);
  };

  const handleRemoveRequest = (index) => {
    setRequests(requests.filter((_, i) => i !== index));
  };

  const handleUpdateRequest = (index, field, value) => {
    const updated = [...requests];
    updated[index][field] = value;
    setRequests(updated);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "var(--text-primary)" }}>
          Customer Requests
        </h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {canEdit && !editing && (
            <button
              onClick={() => onToggleVhcRequired(!jobData.vhcRequired)}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                border: jobData.vhcRequired ? "1px solid rgba(var(--danger-rgb), 0.45)" : "1px solid rgba(var(--success-rgb), 0.45)",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                backgroundColor: jobData.vhcRequired ? "rgba(var(--danger-rgb), 0.14)" : "rgba(var(--success-rgb), 0.14)",
                color: jobData.vhcRequired ? "var(--danger)" : "var(--success)",
                boxShadow: "none"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              {jobData.vhcRequired ? "Mark VHC Not Required" : "Mark VHC Required"}
            </button>
          )}
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              style={{
                padding: "8px 16px",
                backgroundColor: "var(--primary)",
                color: "var(--text-inverse)",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px"
              }}
            >
              Edit Requests
            </button>
          )}
        </div>
        {editing && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleSave}
              style={{
                padding: "8px 16px",
                backgroundColor: "var(--primary)",
                color: "var(--text-inverse)",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px"
              }}
            >
              Save
            </button>
            <button
              onClick={() => {
                setRequests(buildEditRequests());
                setEditing(false);
              }}
              style={{
                padding: "8px 16px",
                backgroundColor: "var(--surface-light)",
                color: "var(--text-primary)",
                border: "1px solid rgba(var(--grey-accent-rgb), 0.45)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px"
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div>
          {requests.map((req, index) => (
            <div key={index} style={{
              padding: "14px",
              backgroundColor: "var(--surface)",
              borderLeft: "4px solid var(--primary)",
              borderRadius: "6px",
              marginBottom: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap"
            }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", minWidth: "260px" }}>
                <span style={requestSubtitleStyle}>Request {index + 1}</span>
                <span style={smallPrintStyle}>Request Description</span>
                  <input
                    type="text"
                    value={req.text}
                    onChange={(e) => handleUpdateRequest(index, "text", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 0",
                      border: "none",
                      borderBottom: "1px solid rgba(var(--grey-accent-rgb), 0.45)",
                      borderRadius: "0",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "var(--text-secondary)",
                      backgroundColor: "transparent"
                    }}
                  />

              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ width: "120px" }}>
                  <label style={{ fontSize: "12px", color: "var(--grey-accent)", display: "block", marginBottom: "4px" }}>
                    Est. Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={req.time}
                    onChange={(e) => handleUpdateRequest(index, "time", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--surface-light)",
                      borderRadius: "6px",
                      fontSize: "14px"
                    }}
                  />
                </div>
                <div style={{ width: "160px" }}>
                  <label style={{ fontSize: "12px", color: "var(--grey-accent)", display: "block", marginBottom: "4px" }}>
                    Payment Type
                  </label>
                  <select
                    value={req.paymentType}
                    onChange={(e) => handleUpdateRequest(index, "paymentType", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--surface-light)",
                      borderRadius: "6px",
                      fontSize: "14px",
                      cursor: "pointer"
                    }}
                  >
                    <option value="Customer">Customer</option>
                    <option value="Warranty">Warranty</option>
                    <option value="Sales Goodwill">Sales Goodwill</option>
                    <option value="Service Goodwill">Service Goodwill</option>
                    <option value="Internal">Internal</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Lease Company">Lease Company</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>
                <button
                  onClick={() => handleRemoveRequest(index)}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "var(--danger)",
                    color: "var(--text-inverse)",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "600",
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
            </div>
          ))}
          <button
            onClick={handleAddRequest}
            style={{
              padding: "10px 20px",
              backgroundColor: "var(--primary)",
              color: "var(--text-inverse)",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px"
            }}
          >
            Add Request
          </button>
        </div>
      ) : (
        <div>
      {customerRequestRows && customerRequestRows.length > 0 ? (
            customerRequestRows.map((req, index) => {
              const linkedParts = req.requestId ? (partsByRequestId[String(req.requestId)] || []) : [];
              return (
              <div key={index} style={{
                padding: "14px",
                backgroundColor: "var(--surface)",
                borderLeft: "4px solid var(--primary)",
                borderRadius: "6px",
                marginBottom: "12px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={requestSubtitleStyle}>Request {index + 1}</span>
                    <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                      {req.description || req.text || req}
                    </span>
                    {(() => {
                      const prePickLabel = req.prePickLocation
                        ? formatPrePickLabel(req.prePickLocation)
                        : "";
                      const noteText = (req.noteText || "").trim();
                      if (prePickLabel) {
                        return (
                          <span style={smallPrintStyle}>
                            Pre-picked: {prePickLabel}
                          </span>
                        );
                      }
                      if (noteText) {
                        return (
                          <span style={smallPrintStyle}>
                            Note: {noteText}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <span style={{
                      padding: "4px 10px",
                      backgroundColor: "var(--info-surface)",
                      color: "var(--info)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}>
                      {Number(req.hours) || 0}h
                    </span>
                    {req.jobType && (
                      <span style={{
                        padding: "4px 10px",
                        backgroundColor:
                          req.jobType === "Warranty" ? "var(--warning-surface)" :
                          req.jobType === "Customer" ? "var(--success)" :
                          "var(--danger-surface)",
                        color:
                          req.jobType === "Warranty" ? "var(--warning-dark)" :
                          req.jobType === "Customer" ? "var(--success-dark)" :
                          "var(--danger-dark)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: "600"
                      }}>
                        {req.jobType}
                      </span>
                    )}
                  </div>
                </div>
                {linkedParts.length > 0 && (
                  <div style={{ marginTop: "10px", borderTop: "1px solid var(--surface-light)", paddingTop: "10px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ color: "var(--grey-accent)", textAlign: "left", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          <th style={{ padding: "4px 8px 6px 0" }}>Part No</th>
                          <th style={{ padding: "4px 8px 6px" }}>Description</th>
                          <th style={{ padding: "4px 8px 6px", textAlign: "right" }}>Qty</th>
                          <th style={{ padding: "4px 8px 6px", textAlign: "right" }}>Price</th>
                          <th style={{ padding: "4px 8px 6px", textAlign: "right" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedParts.map((item, pIdx) => (
                          <tr key={item.id || pIdx} style={{ color: "var(--text-secondary)" }}>
                            <td style={{ padding: "4px 8px 4px 0", fontWeight: "500", color: "var(--text-primary)" }}>{item.part?.partNumber || "\u2014"}</td>
                            <td style={{ padding: "4px 8px" }}>{item.part?.name || item.part?.description || "\u2014"}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right" }}>{item.quantityAllocated ?? item.quantityRequested ?? 0}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right" }}>{item.unitPrice != null ? `\u00A3${Number(item.unitPrice).toFixed(2)}` : "\u2014"}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right" }}>
                              <span style={{
                                padding: "2px 8px",
                                borderRadius: "8px",
                                fontSize: "11px",
                                fontWeight: "600",
                                backgroundColor:
                                  item.status === "fitted" ? "var(--success-surface)" :
                                  item.status === "allocated" || item.status === "pre_picked" || item.status === "picked" ? "var(--info-surface)" :
                                  item.status === "on_order" ? "var(--warning-surface)" :
                                  "var(--surface-light)",
                                color:
                                  item.status === "fitted" ? "var(--success-dark)" :
                                  item.status === "allocated" || item.status === "pre_picked" || item.status === "picked" ? "var(--info-dark)" :
                                  item.status === "on_order" ? "var(--warning-dark)" :
                                  "var(--grey-accent-dark)",
                              }}>
                                {(item.status || "pending").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              );
            })
          ) : (
            <p style={{ color: "var(--grey-accent-light)", fontStyle: "italic" }}>No requests logged.</p>
          )}
        </div>
      )}

      {/* Additional Job Info */}
      <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "2px solid var(--surface)" }}>
        {/* Authorised VHC Items */}
        {authorisedRows.length > 0 && (
          <div style={{
            padding: "16px",
            backgroundColor: "var(--success-surface)",
            borderRadius: "12px",
            border: "1px solid var(--success)",
            marginBottom: "16px"
          }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--success-dark)", marginBottom: "10px" }}>
              Authorised VHC Items
            </div>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {authorisedColumns.map((column, columnIndex) => (
                <ul
                  key={`authorized-column-${columnIndex}`}
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    flex: "1 1 180px",
                    minWidth: "180px",
                  }}
                >
                  {column.map((row, rowIndex) => (
                    <li
                      key={row.requestId || row.vhcItemId || rowIndex}
                      style={{
                        fontSize: "13px",
                        color: "var(--text-primary)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ fontWeight: "600", color: "var(--success)" }}>
                        {row.detail
                          ? `${row.label || row.description || "Authorised item"} - ${row.detail}`
                          : row.label || row.description || "Authorised item"}
                      </div>
                      {/* Labour hours and parts cost */}
                      {(row.labourHours || row.partsCost) && (
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                          {row.labourHours && <span>Labour: {row.labourHours}h</span>}
                          {row.labourHours && row.partsCost && <span> | </span>}
                          {row.partsCost && <span>Parts: £{Number(row.partsCost).toFixed(2)}</span>}
                        </div>
                      )}
                      {/* Pre-pick location */}
                      {row.prePickLocation && (
                        <div style={smallPrintStyle}>
                          Pre-pick: {formatPrePickLabel(row.prePickLocation)}
                        </div>
                      )}
                      {/* Linked notes */}
                      {row.noteText && (
                        <div style={smallPrintStyle}>
                          Note: {row.noteText}
                        </div>
                      )}
                      {/* Linked parts */}
                      {(() => {
                        const linkedParts = row.requestId ? (partsByRequestId[String(row.requestId)] || []) : [];
                        if (linkedParts.length === 0) return null;
                        return (
                          <div style={{ marginTop: "8px", borderTop: "1px solid var(--success)", paddingTop: "8px", width: "100%" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid var(--success)" }}>
                                  <th style={{ textAlign: "left", padding: "4px 8px 4px 0", color: "var(--success-dark)", fontWeight: "600" }}>Part No</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--success-dark)", fontWeight: "600" }}>Description</th>
                                  <th style={{ textAlign: "center", padding: "4px 8px", color: "var(--success-dark)", fontWeight: "600" }}>Qty</th>
                                  <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--success-dark)", fontWeight: "600" }}>Price</th>
                                  <th style={{ textAlign: "center", padding: "4px 0 4px 8px", color: "var(--success-dark)", fontWeight: "600" }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {linkedParts.map((item, pIdx) => {
                                  const status = item.status || item.allocationStatus || "allocated";
                                  return (
                                    <tr key={item.id || pIdx} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                                      <td style={{ padding: "4px 8px 4px 0", fontFamily: "monospace" }}>{item.part?.partNumber || "—"}</td>
                                      <td style={{ padding: "4px 8px" }}>{item.part?.name || item.part?.description || "—"}</td>
                                      <td style={{ padding: "4px 8px", textAlign: "center" }}>{item.quantityAllocated ?? item.quantityRequested ?? 0}</td>
                                      <td style={{ padding: "4px 8px", textAlign: "right" }}>{item.unitPrice != null ? `£${Number(item.unitPrice).toFixed(2)}` : "—"}</td>
                                      <td style={{ padding: "4px 0 4px 8px", textAlign: "center" }}>
                                        <span style={{
                                          display: "inline-block",
                                          padding: "2px 6px",
                                          borderRadius: "4px",
                                          fontSize: "10px",
                                          fontWeight: "600",
                                          textTransform: "capitalize",
                                          backgroundColor: status === "fitted" ? "var(--success-surface)" : status === "ordered" ? "var(--warning-surface)" : "var(--info-surface)",
                                          color: status === "fitted" ? "var(--success-dark)" : status === "ordered" ? "var(--warning-dark)" : "var(--info-dark)",
                                        }}>
                                          {status}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        )}

        {jobData.cosmeticNotes && (
          <div style={{ marginBottom: "16px" }}>
            <strong style={{ fontSize: "14px", color: "var(--grey-accent)", display: "block", marginBottom: "8px" }}>
              Cosmetic Damage Notes:
            </strong>
            <div style={{
              padding: "12px",
              backgroundColor: "var(--warning-surface)",
              borderLeft: "4px solid var(--warning)",
              borderRadius: "6px"
            }}>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--text-secondary)" }}>
                {jobData.cosmeticNotes}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LocationUpdateModal({ entry, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    ...emptyTrackingForm,
    ...entry,
    vehicleLocation: entry?.vehicleLocation || CAR_LOCATIONS[0].label,
    keyLocation: normalizeKeyLocationLabel(entry?.keyLocation) || KEY_LOCATIONS[0].label,
    status: entry?.status || "Waiting For Collection",
  }));
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
    onSave({ ...form, actionType: "location_update", context: "update" });
  };

  return (
    <div className="popup-backdrop">
      <form
        onSubmit={handleSubmit}
        className="popup-card"
        style={{
          borderRadius: "32px",
          width: "100%",
          maxWidth: "520px",
          maxHeight: "90vh",
          overflowY: "auto",
          border: "1px solid var(--surface-light)",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Edit existing</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
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
            />
          </div>

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
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid var(--accent-purple-surface)",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            Close
          </button>
          <button
            type="submit"
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "none",
              background: "var(--primary)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Update
          </button>
        </div>
      </form>
    </div>
  );
}

function LocationEntryModal({ context, entry, mode = "edit", onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    ...emptyTrackingForm,
    ...entry,
    vehicleLocation: entry?.vehicleLocation || CAR_LOCATIONS[0].label,
    keyLocation: normalizeKeyLocationLabel(entry?.keyLocation) || KEY_LOCATIONS[0].label,
    status: entry?.status || "Waiting For Collection",
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
    <div className="popup-backdrop">
      <form
        onSubmit={handleSubmit}
        style={{
          ...popupCardStyles,
          width: "min(640px, 100%)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>{isEdit ? "Edit existing" : "Log new"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "var(--surface)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "10px",
          }}
        >
          {[
            { label: "Job Number", field: "jobNumber", placeholder: "HNP-4821", required: false },
            { label: "Registration", field: "reg", placeholder: "GY21 HNP", required: false },
            { label: "Customer", field: "customer", placeholder: "Customer name", required: false },
            { label: "Service Type", field: "serviceType", placeholder: "MOT, Service...", required: false },
          ].map((input) => (
            <div key={input.field} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
                {input.label}
                {["jobNumber", "reg", "customer"].includes(input.field) && (
                  <span style={{ fontSize: "0.75rem", color: "var(--info)", fontWeight: 400 }}>
                    {" "}
                    (at least one required)
                  </span>
                )}
              </label>
              <input
                value={form[input.field]}
                onChange={(event) => handleChange(input.field, event.target.value)}
                placeholder={input.placeholder}
                style={{
                  padding: "10px 12px",
                  borderRadius: "12px",
                  border: "1px solid var(--accent-purple-surface)",
                  fontSize: "0.95rem",
                }}
              />
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "10px",
          }}
        >
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
            />
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
            />
          </div>
        </div>

        <button
          type="submit"
          style={{
            padding: "12px 20px",
            borderRadius: "12px",
            border: "none",
            background: "var(--success)",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.95rem",
          }}
        >
          Update
        </button>
      </form>
    </div>
  );
}

// ✅ Contact Tab
function ContactTab({ jobData, canEdit, onSaveCustomerDetails, customerSaving }) {
  const [editing, setEditing] = useState(false);
  const [approvalChecked, setApprovalChecked] = useState(false);
  const [formState, setFormState] = useState({
    firstName: jobData.customerFirstName || "",
    lastName: jobData.customerLastName || "",
    email: jobData.customerEmail || "",
    mobile: jobData.customerMobile || jobData.customerPhone || "",
    telephone: jobData.customerTelephone || "",
    address: jobData.customerAddress || "",
    postcode: jobData.customerPostcode || "",
    contactPreference: jobData.customerContactPreference || "Email"
  });
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!editing) {
      setFormState({
        firstName: jobData.customerFirstName || "",
        lastName: jobData.customerLastName || "",
        email: jobData.customerEmail || "",
        mobile: jobData.customerMobile || jobData.customerPhone || "",
        telephone: jobData.customerTelephone || "",
        address: jobData.customerAddress || "",
        postcode: jobData.customerPostcode || "",
        contactPreference: jobData.customerContactPreference || "Email"
      });
      setSaveError("");
      setApprovalChecked(false);
    }
  }, [jobData, editing]);

  const handleFieldChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const startEditing = () => {
    setEditing(true);
    setApprovalChecked(false);
    setSaveError("");
  };

  const cancelEditing = () => {
    setEditing(false);
    setApprovalChecked(false);
  };

  const handleSave = async () => {
    if (!approvalChecked || !onSaveCustomerDetails) return;
    setSaveError("");
    const result = await onSaveCustomerDetails(formState);
    if (result?.success) {
      alert("✅ Customer details updated");
      setEditing(false);
      setApprovalChecked(false);
    } else if (result?.error?.message) {
      setSaveError(result.error.message);
    }
  };

  const contactOptions = ["Email", "Phone", "SMS", "WhatsApp", "No Preference"];
  const labelStyle = { fontSize: "12px", color: "var(--grey-accent)", display: "block", marginBottom: "6px", fontWeight: "600" };
  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(var(--grey-accent-rgb), 0.45)",
    backgroundColor: "var(--surface)",
    color: "var(--text-secondary)",
    fontSize: "13px",
  };
  const readOnlyStyle = {
    padding: "8px 10px",
    backgroundColor: "var(--surface)",
    borderRadius: "8px",
    border: "1px solid var(--surface-light)",
    fontSize: "13px",
    color: "var(--text-secondary)",
    fontWeight: "500",
  };
  const panelStyle = {
    background: "var(--surface)",
    border: "1px solid var(--surface-light)",
    borderRadius: "16px",
    padding: "18px",
  };
  const panelHeaderStyle = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "14px",
    flexWrap: "wrap",
  };
  const badgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "4px 10px",
    borderRadius: "999px",
    background: "var(--surface-light)",
    border: "1px solid rgba(var(--grey-accent-rgb), 0.35)",
    color: "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: "600",
    width: "fit-content",
  };
  const actionsStyle = { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" };
  const primaryButtonStyle = (disabled) => ({
    padding: "10px 16px",
    backgroundColor: "var(--primary)",
    color: "var(--text-inverse)",
    border: "none",
    borderRadius: "10px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: "700",
    fontSize: "13px",
    opacity: disabled ? 0.6 : 1,
  });
  const secondaryButtonStyle = (disabled) => ({
    padding: "10px 16px",
    backgroundColor: "var(--surface-light)",
    color: "var(--text-primary)",
    border: "1px solid rgba(var(--grey-accent-rgb), 0.45)",
    borderRadius: "10px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: "700",
    fontSize: "13px",
    opacity: disabled ? 0.7 : 1,
  });
  const isSaveDisabled = customerSaving || !approvalChecked;

  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {editing ? <div style={badgeStyle}>Editing</div> : null}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <label style={labelStyle}>
              CUSTOMER NAME
            </label>
            {canEdit && (
              <div style={actionsStyle}>
                {editing ? (
                  <>
                    <button onClick={handleSave} disabled={isSaveDisabled} style={primaryButtonStyle(isSaveDisabled)}>
                      {customerSaving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={cancelEditing} disabled={customerSaving} style={secondaryButtonStyle(customerSaving)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button onClick={startEditing} style={primaryButtonStyle(false)}>
                    Edit Customer Details
                  </button>
                )}
              </div>
            )}
          </div>
          {editing ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="First name"
                value={formState.firstName}
                onChange={(e) => handleFieldChange("firstName", e.target.value)}
                style={{
                  flex: 1,
                  ...inputStyle,
                }}
                disabled={customerSaving}
              />
              <input
                type="text"
                placeholder="Last name"
                value={formState.lastName}
                onChange={(e) => handleFieldChange("lastName", e.target.value)}
                style={{
                  flex: 1,
                  ...inputStyle,
                }}
                disabled={customerSaving}
              />
            </div>
          ) : (
            <div style={readOnlyStyle}>
              {jobData.customer || "N/A"}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>
            EMAIL ADDRESS
          </label>
          {editing ? (
            <input
              type="email"
              value={formState.email}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              style={inputStyle}
              disabled={customerSaving}
            />
          ) : (
            <div style={{ ...readOnlyStyle, color: "var(--info)" }}>
              {jobData.customerEmail || "N/A"}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>
            MOBILE PHONE
          </label>
          {editing ? (
            <input
              type="tel"
              value={formState.mobile}
              onChange={(e) => handleFieldChange("mobile", e.target.value)}
              style={inputStyle}
              disabled={customerSaving}
            />
          ) : (
            <div style={readOnlyStyle}>
              {jobData.customerMobile || jobData.customerPhone || "N/A"}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>
            LANDLINE PHONE
          </label>
          {editing ? (
            <input
              type="tel"
              value={formState.telephone}
              onChange={(e) => handleFieldChange("telephone", e.target.value)}
              style={inputStyle}
              disabled={customerSaving}
            />
          ) : (
            <div style={readOnlyStyle}>
              {jobData.customerTelephone || "N/A"}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>
            CONTACT PREFERENCE
          </label>
          {editing ? (
            <select
              value={formState.contactPreference}
              onChange={(e) => handleFieldChange("contactPreference", e.target.value)}
              style={inputStyle}
              disabled={customerSaving}
            >
              {contactOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <div style={readOnlyStyle}>
              {jobData.customerContactPreference || "Email"}
            </div>
          )}
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>
            ADDRESS
          </label>
          {editing ? (
            <textarea
              value={formState.address}
              onChange={(e) => handleFieldChange("address", e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid rgba(var(--grey-accent-rgb), 0.45)",
                backgroundColor: "var(--surface)",
                color: "var(--text-secondary)",
                fontSize: "13px",
                resize: "vertical"
              }}
              disabled={customerSaving}
            />
          ) : (
            <div style={readOnlyStyle}>
              {jobData.customerAddress || "N/A"}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div style={{
          marginTop: "20px",
          padding: "16px",
          backgroundColor: "var(--layer-section-level-2)",
          borderRadius: "12px",
          border: "1px solid rgba(var(--grey-accent-rgb), 0.35)",
          borderLeft: `4px solid ${approvalChecked ? "var(--success)" : "var(--warning)"}`
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px", color: "var(--text-primary)", fontWeight: "700" }}>
            <input
              type="checkbox"
              checked={approvalChecked}
              onChange={(e) => setApprovalChecked(e.target.checked)}
              disabled={customerSaving}
              style={{ width: "16px", height: "16px" }}
            />
            Customer has approved updated details
          </label>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px", marginBottom: 0 }}>
            Regulatory requirement: customer confirmation must be recorded before saving.
          </p>
        </div>
      )}

      {saveError && (
        <div style={{ marginTop: "12px", padding: "10px", borderRadius: "6px", backgroundColor: "var(--danger-surface)", color: "var(--danger)", fontSize: "13px" }}>
          {saveError}
        </div>
      )}
    </div>
  );
}
// ✅ Scheduling Tab
function SchedulingTab({
  jobData,
  canEdit,
  customerVehicles = [],
  customerVehiclesLoading = false,
  bookingRequest = null,
  onBookingFlowSave = () => {},
  bookingFlowSaving = false,
  onBookingApproval = () => {},
  bookingApprovalSaving = false,
  onAppointmentSave = () => {},
  appointmentSaving = false
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
    priceEstimate: bookingRequest?.priceEstimate
      ? String(bookingRequest.priceEstimate)
      : "",
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
      priceEstimate: bookingRequest?.priceEstimate
        ? String(bookingRequest.priceEstimate)
        : "",
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
        model: jobData.model
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
    customerVehicles
  ]);

  const selectedVehicle = useMemo(
    () =>
      vehicleOptions.find(
        (vehicle) => vehicle.vehicle_id === selectedVehicleId
      ) || null,
    [vehicleOptions, selectedVehicleId]
  );

  const descriptionLines = useMemo(() => {
    if (!bookingRequest?.description) return [];
    return bookingRequest.description
      .split("\n")
      .map((line) => line.replace(/^-+\s*/, "").trim())
      .filter(Boolean);
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

  const handleBookingDescriptionChange = (value) => {
    setBookingDescription(
      value ? formatBookingDescriptionInput(value) : ""
    );
    setBookingMessage("");
  };

  const bookingRequestLines = useMemo(() => {
    const normalized = normalizeRequests(jobData?.requests);
    return (Array.isArray(normalized) ? normalized : [])
      .map((req) => (req?.description || req?.text || "").toString().trim())
      .filter(Boolean);
  }, [jobData?.requests]);

  const bookingRequestDescription = useMemo(() => {
    return bookingRequestLines
      .map((line) => `- ${line.replace(/^-+\s*/, "").trim()}`)
      .join("\n");
  }, [bookingRequestLines]);

  const handleBookingWaitingSelect = (value) => {
    setBookingWaitingStatus(value);
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
      !approvalForm.etaTime
    ) {
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

  const appointmentCreatedAt = jobData.appointment?.createdAt
    ? new Date(jobData.appointment.createdAt).toLocaleString()
    : "Not created yet";
  const bookingStatus = bookingRequest?.status || "pending";
  const statusColor =
    bookingStatus === "approved"
      ? { background: "var(--success-surface)", color: "var(--success-dark)" }
      : { background: "var(--warning-surface)", color: "var(--danger-dark)" };
  const submittedAt = bookingRequest?.submittedAt
    ? new Date(bookingRequest.submittedAt).toLocaleString()
    : "Awaiting submission";
  const approvedAt = bookingRequest?.approvedAt
    ? new Date(bookingRequest.approvedAt).toLocaleString()
    : null;
  const etaDisplay = bookingRequest?.estimatedCompletion
    ? new Date(bookingRequest.estimatedCompletion).toLocaleString()
    : null;

  const panelStyle = {
    background: "var(--surface)",
    border: "1px solid var(--surface-light)",
    borderRadius: "16px",
    padding: "18px",
  };
  const panelHeaderStyle = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "14px",
    flexWrap: "wrap",
  };
  const headerBadgeStyle = {
    padding: "4px 10px",
    borderRadius: "999px",
    background: "var(--surface-light)",
    border: "1px solid rgba(var(--grey-accent-rgb), 0.35)",
    color: "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: "700",
    width: "fit-content",
  };
  const cardStyle = {
    padding: "18px",
    backgroundColor: "var(--surface)",
    borderRadius: "16px",
    border: "1px solid var(--surface-light)"
  };
  const subPanelStyle = {
    padding: "12px",
    backgroundColor: "var(--surface)",
    borderRadius: "12px",
    border: "1px solid var(--surface-light)",
  };
  const cardTitleStyle = {
    margin: 0,
    fontSize: "16px",
    fontWeight: "700",
    color: "var(--text-primary)"
  };
  const cardSubtitleStyle = {
    margin: "4px 0 0 0",
    color: "var(--text-secondary)",
    fontSize: "13px"
  };
  const fieldLabelStyle = {
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--grey-accent)",
    display: "block",
    marginBottom: "6px"
  };
  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(var(--grey-accent-rgb), 0.45)",
    fontSize: "13px",
    backgroundColor: "var(--surface)",
    color: "var(--text-secondary)"
  };

  const sectionCardStyle = {
    ...cardStyle,
    marginBottom: "16px",
  };
  const sectionTitleRow = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "16px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* ── Section 1: Customer & Vehicle ── */}
      <div style={sectionCardStyle}>
        <div style={sectionTitleRow}>
          <div style={{ flex: 1 }}>
            <h3 style={cardTitleStyle}>Customer &amp; Vehicle</h3>
          </div>
          {bookingRequest ? (
            <span style={{ ...headerBadgeStyle, backgroundColor: statusColor.background, color: statusColor.color }}>
              {bookingStatus === "approved" ? "Approved" : "Awaiting Approval"}
            </span>
          ) : null}
          <button
            onClick={() => {
              const slug = createCustomerDisplaySlug(jobData.customerFirstName || "", jobData.customerLastName || "");
              const target = slug || jobData.customerId;
              if (target) router.push(`/customers/${target}`);
            }}
            disabled={!jobData.customerFirstName && !jobData.customerLastName && !jobData.customerId}
            style={{
              padding: "7px 12px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "var(--layer-section-level-1)",
              color: "var(--primary-dark)",
              fontSize: "12px",
              fontWeight: "600",
              cursor: jobData.customerFirstName || jobData.customerLastName || jobData.customerId ? "pointer" : "not-allowed",
              whiteSpace: "nowrap",
              opacity: !jobData.customerFirstName && !jobData.customerLastName && !jobData.customerId ? 0.5 : 1,
            }}
          >
            View Profile
          </button>
        </div>

        {/* Vehicle selector */}
        <div>
          {customerVehiclesLoading ? (
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", padding: "8px 0" }}>
              Loading stored vehicles...
            </div>
          ) : vehicleOptions.length > 0 ? (
            <DropdownField
              label="Vehicle"
              placeholder="Select stored vehicle"
              value={selectedVehicleIdValue}
              onChange={(event) => handleVehicleChange(event.target.value)}
              disabled={!canEdit}
              className="compact-picker"
              options={vehicleOptions.map((vehicle) => ({
                value: String(vehicle.vehicle_id),
                label: `${vehicle.registration || vehicle.reg_number || "Vehicle"} \u00B7 ${
                  vehicle.make_model ||
                  [vehicle.make, vehicle.model].filter(Boolean).join(" ")
                }`,
              }))}
            />
          ) : (
            <div style={{ fontSize: "13px", color: "var(--danger)", padding: "8px 0" }}>
              No stored vehicles found for this customer.
            </div>
          )}
        </div>

        {/* Confirm customer contact details */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            backgroundColor: "var(--surface-light)",
            borderRadius: "12px",
            border: "1px solid var(--surface-light)",
            borderLeft: `4px solid ${confirmCustomerDetails ? "var(--success)" : "var(--warning)"}`,
          }}
        >
          <label
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
              fontSize: "13px",
              color: "var(--text-primary)",
              cursor: canEdit ? "pointer" : "default",
            }}
          >
            <input
              type="checkbox"
              checked={confirmCustomerDetails}
              onChange={(event) => setConfirmCustomerDetails(event.target.checked)}
              disabled={!canEdit}
              style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0 }}
            />
            <span>
              I confirm {jobData.customer || "the customer"}&apos;s contact details for this booking.
              <br />
              <span style={{ fontSize: "11px", color: "var(--grey-accent)", fontWeight: "400" }}>
                Required for booking updates and collection notifications.
              </span>
            </span>
          </label>
          {!confirmCustomerDetails && canEdit && (
            <div style={{ marginTop: "8px", marginLeft: "26px", fontSize: "12px", color: "var(--danger)", fontWeight: "500" }}>
              Please confirm customer details before saving.
            </div>
          )}
        </div>
      </div>

      {/* ── Row: Customer Reported Issues (left) + Appointment Information (right) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "stretch" }}>

        {/* ── Section 2: Customer Reported Issues ── */}
        <div style={{ ...sectionCardStyle, marginBottom: 0, display: "flex", flexDirection: "column" }}>
          <div style={sectionTitleRow}>
            <h3 style={cardTitleStyle}>Customer Reported Issues</h3>
          </div>
          <div
            style={{
              ...subPanelStyle,
              flex: 1,
              minHeight: "120px",
              overflowY: "auto",
              color: "var(--text-secondary)",
              fontSize: "13px",
              lineHeight: "22px",
            }}
          >
            {bookingRequestLines.length > 0 ? (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {bookingRequestLines.map((line, index) => (
                  <li
                    key={`${index}-${line}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "8px 6px",
                      borderBottom: index < bookingRequestLines.length - 1 ? "1px solid var(--surface-light)" : "none",
                    }}
                  >
                    <span style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "var(--warning)",
                      flexShrink: 0,
                      marginTop: "8px",
                    }} />
                    <span style={{ color: "var(--text-primary)", fontWeight: "500" }}>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ padding: "8px 6px", color: "var(--grey-accent)" }}>No reported issues found.</div>
            )}
          </div>
        </div>

        {/* ── Section 3: Appointment Information ── */}
        <div style={{ ...sectionCardStyle, marginBottom: 0 }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}>
            <h3 style={cardTitleStyle}>Appointment Information</h3>
            <button
              onClick={() => router.push(`/appointments?job=${jobData.jobNumber}`)}
              style={{
                padding: "7px 12px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "var(--layer-section-level-1)",
                color: "var(--primary-dark)",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Open Appointment Calendar
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <div>
              <CalendarField
                label="Date"
                value={appointmentForm.date}
                onChange={(event) => handleAppointmentFieldChange("date", event.target.value)}
                disabled={!canEdit || appointmentSaving}
                className="compact-picker"
              />
            </div>
            <div>
              <TimePickerField
                label="Time"
                value={appointmentForm.time}
                onChange={(event) => handleAppointmentFieldChange("time", event.target.value)}
                disabled={!canEdit || appointmentSaving}
                className="compact-picker"
                style={{ ...inputStyle }}
              />
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
                  { value: "cancelled", label: "Cancelled" },
                ]}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: "14px",
              padding: "10px 12px",
              backgroundColor: "var(--surface-light)",
              border: "1px solid var(--surface-light)",
              borderRadius: "10px",
              fontSize: "12px",
              color: "var(--grey-accent)",
            }}
          >
            Appointment created: <strong style={{ color: "var(--text-secondary)" }}>{appointmentCreatedAt}</strong>
          </div>
        </div>
      </div>

      {/* ── Section 4: Customer Logistics ── */}
      <div style={sectionCardStyle}>
        <div style={sectionTitleRow}>
          <h3 style={cardTitleStyle}>Customer Logistics</h3>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0",
            border: "1px solid rgba(var(--grey-accent-rgb), 0.35)",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          {waitingOptions.map((option, idx) => {
            const isActive =
              bookingWaitingStatus === option ||
              (!bookingWaitingStatus && option === "Neither");
            return (
              <button
                key={option}
                onClick={() => handleBookingWaitingSelect(option)}
                disabled={!canEdit}
                style={{
                  padding: "14px 8px",
                  border: "none",
                  borderRight: idx < waitingOptions.length - 1 ? "1px solid rgba(var(--grey-accent-rgb), 0.35)" : "none",
                  backgroundColor: isActive ? "var(--primary)" : "var(--surface)",
                  color: isActive ? "var(--text-inverse)" : "var(--text-primary)",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: canEdit ? "pointer" : "default",
                  transition: "background-color 0.15s, color 0.15s",
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
        {/* Placeholder for future conditional fields (loan car details, collection time, etc.) */}
        <div style={{ minHeight: "0px" }} />
      </div>

      {/* ── Section 5: Actions ── */}
      <div style={{ ...sectionCardStyle, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", marginBottom: 0 }}>
        {/* Primary: Save Booking */}
        <button
          onClick={handleBookingSubmit}
          disabled={bookingButtonDisabled || vehicleOptions.length === 0}
          title={
            !confirmCustomerDetails
              ? "Confirm customer details first"
              : !selectedVehicleId
                ? "Select a vehicle first"
                : bookingRequestLines.length === 0
                  ? "No job requests to submit"
                  : undefined
          }
          style={{
            padding: "10px 24px",
            backgroundColor: bookingButtonDisabled ? "var(--grey-accent)" : "var(--primary)",
            color: "var(--text-inverse)",
            border: "none",
            borderRadius: "8px",
            cursor: bookingButtonDisabled ? "not-allowed" : "pointer",
            fontWeight: "600",
            fontSize: "14px",
            opacity: bookingButtonDisabled ? 0.65 : 1,
            transition: "opacity 0.15s, background-color 0.15s",
          }}
        >
          {bookingFlowSaving ? "Saving..." : "Save Booking Details"}
        </button>

        {/* Secondary: Update / Schedule Appointment */}
        {canEdit && (
          <button
            onClick={handleAppointmentSubmit}
            disabled={!appointmentDirty || appointmentSaving}
            style={{
              padding: "10px 20px",
              backgroundColor: appointmentDirty ? "var(--layer-section-level-1)" : "var(--surface-light)",
              color: appointmentDirty ? "var(--primary-dark)" : "var(--grey-accent)",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: appointmentDirty && !appointmentSaving ? "pointer" : "not-allowed",
              opacity: !appointmentDirty ? 0.6 : 1,
              transition: "opacity 0.15s, background-color 0.15s, color 0.15s",
            }}
          >
            {appointmentSaving
              ? "Saving..."
              : jobData.appointment
                ? "Update Appointment"
                : "Schedule Appointment"}
          </button>
        )}

        {/* Feedback messages */}
        {bookingMessage && (
          <span style={{ fontSize: "13px", color: "var(--success)", fontWeight: "500" }}>
            {bookingMessage}
          </span>
        )}
        {appointmentMessage && (
          <span style={{ fontSize: "13px", color: "var(--success)", fontWeight: "500" }}>
            {appointmentMessage}
          </span>
        )}
      </div>
    </div>
  );
}

// ✅ Service History Tab
function ServiceHistoryTab({ vehicleJobHistory }) {
  const history = Array.isArray(vehicleJobHistory)
    ? vehicleJobHistory
    : [];

  const handleInvoiceOpen = (job) => {
    if (job.invoiceAvailable && job.invoiceUrl) {
      window.open(job.invoiceUrl, "_blank");
    } else {
      alert("No invoice document stored for this job yet.");
    }
  };

  return (
    <div>
      {history.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {history.map((job) => (
            <div
              key={job.id}
              onClick={() => handleInvoiceOpen(job)}
              style={{
                padding: "16px",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--accent-purple-surface)",
                borderRadius: "10px",
                cursor: job.invoiceAvailable ? "pointer" : "default",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--info-surface)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(var(--shadow-rgb),0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--surface)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "16px", fontWeight: "600", color: "var(--primary)" }}>
                    Job #{job.jobNumber}
                  </span>
                  <span style={{
                    padding: "4px 10px",
                    backgroundColor: "var(--info-surface)",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "var(--info-dark)"
                  }}>
                    {job.serviceDateFormatted}
                  </span>
                </div>
                {job.invoiceAvailable ? (
                  <span style={{ fontSize: "12px", color: "var(--info)", fontWeight: "600" }}>
                    Invoice Available
                  </span>
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--info)", fontWeight: "600" }}>
                    No Invoice
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "13px", color: "var(--info-dark)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <strong>Mileage:</strong>
                  <span>{job.mileage ? `${job.mileage} miles` : "Not recorded"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <strong>Requests:</strong>
                  <span>{job.requests.length}</span>
                </div>
              </div>

              {job.requests.length > 0 && (
                <ul style={{ margin: "12px 0 0 0", paddingLeft: "18px", color: "var(--info-dark)", fontSize: "13px" }}>
                  {job.requests.slice(0, 3).map((req, index) => (
                    <li key={`${job.id}-req-${index}`}>
                      {req.text || req.description || "Request"}
                    </li>
                  ))}
                  {job.requests.length > 3 && (
                    <li style={{ listStyle: "none", color: "var(--info)" }}>
                      +{job.requests.length - 3} more request{job.requests.length - 3 === 1 ? "" : "s"}
                    </li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: "40px",
          textAlign: "center",
          backgroundColor: "var(--surface)",
          borderRadius: "8px"
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
          <p style={{ fontSize: "14px", color: "var(--grey-accent)" }}>
            No previous service history for this vehicle
          </p>
        </div>
      )}
    </div>
  );
}

function GoodsInPartsPanel({ goodsInParts = [], onAllocateParts, canAllocate }) {
  const hasParts = Array.isArray(goodsInParts) && goodsInParts.length > 0;
  const sortedParts = hasParts
    ? [...goodsInParts].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
    : [];
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
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "var(--text-primary)" }}>
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
            !canAllocate
              ? "You do not have permission to allocate parts."
              : allocateDisabled
              ? "No parts have been added to this job yet."
              : ""
          }
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid var(--accent-purple)",
            background: !canAllocate || allocateDisabled ? "var(--surface-light)" : "var(--accent-purple)",
            color: !canAllocate || allocateDisabled ? "var(--text-secondary)" : "#fff",
            fontSize: "12px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            cursor: !canAllocate || allocateDisabled ? "not-allowed" : "pointer",
            transition: "background 0.2s ease, color 0.2s ease",
          }}
        >
          Allocate to Request
        </button>
      </div>
      {!hasParts ? (
        <div
          style={{
            padding: "20px",
            borderRadius: "12px",
            border: "1px dashed var(--surface-light)",
            background: "var(--layer-section-level-1)",
            color: "var(--text-secondary)",
            fontSize: "14px",
            textAlign: "center",
          }}
        >
          No parts have been added to this job yet.
        </div>
      ) : (
        <div
          style={{
            borderRadius: "16px",
            border: "1px solid var(--surface-light)",
            background: "var(--surface)",
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: "300px",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "0",
            }}
          >
            <thead>
              <tr style={{ background: "var(--layer-section-level-2)", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.08em" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", position: "sticky", top: 0, background: "var(--layer-section-level-2)", zIndex: 1 }}>Goods in #</th>
                <th style={{ textAlign: "left", padding: "12px 16px", position: "sticky", top: 0, background: "var(--layer-section-level-2)", zIndex: 1 }}>Part number</th>
                <th style={{ textAlign: "left", padding: "12px 16px", position: "sticky", top: 0, background: "var(--layer-section-level-2)", zIndex: 1 }}>Description</th>
                <th style={{ textAlign: "center", padding: "12px 16px", position: "sticky", top: 0, background: "var(--layer-section-level-2)", zIndex: 1 }}>Qty</th>
                <th style={{ textAlign: "right", padding: "12px 16px", position: "sticky", top: 0, background: "var(--layer-section-level-2)", zIndex: 1 }}>Retail</th>
                <th style={{ textAlign: "right", padding: "12px 16px", position: "sticky", top: 0, background: "var(--layer-section-level-2)", zIndex: 1 }}>Cost</th>
                <th style={{ textAlign: "left", padding: "12px 16px", position: "sticky", top: 0, background: "var(--layer-section-level-2)", zIndex: 1 }}>Invoice</th>
                <th style={{ textAlign: "left", padding: "12px 16px", position: "sticky", top: 0, background: "var(--layer-section-level-2)", zIndex: 1 }}>Added</th>
              </tr>
            </thead>
            <tbody>
              {sortedParts.map((line) => (
                <tr key={line.id} style={{ borderTop: "1px solid var(--surface-light)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                    {line.goodsInNumber || "GIN"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>{line.partNumber || "—"}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{line.description || "No description"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>{line.quantity ?? 0}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>{formatMoney(line.retailPrice)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>{formatMoney(line.costPrice)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {line.invoiceNumber || "—"}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>
                    {formatDateTime(line.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ✅ Parts Tab (TODO)
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
  priced: { label: "Priced", color: "var(--accent-purple)", background: "var(--accent-purple-surface)" },
  pre_pick: { label: "Pre Pick", color: "var(--success-dark)", background: "var(--success-surface)" },
  on_order: { label: "On Order", color: "var(--warning)", background: "var(--warning-surface)" },
  stock: { label: "Stock", color: "var(--accent-purple)", background: "var(--info-surface)" },
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
  currency: "GBP",
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
  const allocationDisabledReason = !canEdit
    ? "You don't have permission to add parts."
    : !jobId
    ? "Job must be loaded before allocating parts."
    : "";

  const searchStockCatalog = useCallback(async (term) => {
    const rawTerm = (term || "").trim();
    if (!rawTerm) {
      setCatalogResults([]);
      setCatalogError("");
      return;
    }

    setCatalogLoading(true);
    try {
      let query = supabase
        .from("parts_catalog")
        .select(
          "id, part_number, name, description, supplier, category, storage_location, qty_in_stock, qty_reserved, qty_on_order, unit_cost, unit_price"
        )
        .order("name", { ascending: true })
        .limit(25);

      const sanitised = rawTerm.replace(/[%]/g, "").replace(/,/g, "");
      const pattern = `%${sanitised}%`;
      const clauses = [
        `name.ilike.${pattern}`,
        `part_number.ilike.${pattern}`,
        `supplier.ilike.${pattern}`,
        `category.ilike.${pattern}`,
        `description.ilike.${pattern}`,
        `oem_reference.ilike.${pattern}`,
        `storage_location.ilike.${pattern}`,
      ];
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
      console.error("Stock search failed", error);
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
          userNumericId: actingUserNumericId,
        }),
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
      console.error("Unable to add part from stock", error);
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
    selectedCatalogPart,
  ]);
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
          border: "1px solid var(--surface-light)",
          borderRadius: "14px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <div>
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "var(--primary)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Add Part From Stock
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info-dark)" }}>
              Search the catalogue and allocate parts directly to this job. Allocation immediately reduces stock.
            </p>
          </div>
          {!canAllocateParts && allocationDisabledReason && (
            <span style={{ fontSize: "0.75rem", color: "var(--info)" }}>{allocationDisabledReason}</span>
          )}
        </div>
        <input
          type="search"
          value={catalogSearch}
          disabled={!canAllocateParts}
          onChange={(event) => {
            setCatalogSearch(event.target.value);
            setCatalogSuccessMessage("");
            setCatalogSubmitError("");
          }}
          placeholder={canAllocateParts ? "Search by part number, name, supplier, or price" : "Stock allocation disabled"}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid var(--surface-light)",
            fontSize: "0.95rem",
            backgroundColor: canAllocateParts ? "var(--surface)" : "var(--info-surface)",
            color: "var(--info-dark)",
          }}
        />
        {catalogLoading && (
          <div style={{ fontSize: "0.85rem", color: "var(--info)" }}>Searching stock…</div>
        )}
        {!catalogLoading && catalogError && (
          <div style={{ fontSize: "0.8rem", color: "var(--danger)" }}>{catalogError}</div>
        )}
        {canAllocateParts && !catalogLoading && catalogResults.length > 0 && (
          <div
            style={{
              maxHeight: "220px",
              overflowY: "auto",
              border: "1px solid var(--surface-light)",
              borderRadius: "12px",
            }}
          >
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
                    borderBottom: "1px solid var(--surface-light)",
                    textAlign: "left",
                    background: isSelected ? "var(--accent-purple-surface)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{part.name}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--info-dark)" }}>
                    Part #: {part.part_number} · Supplier: {part.supplier || "Unknown"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--info)" }}>
                    Stock: {part.qty_in_stock ?? 0} · £{Number(part.unit_price || 0).toFixed(2)} · {part.category || "Uncategorised"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {selectedCatalogPart && (
          <div
            style={{
              border: "1px solid var(--accent-purple-surface)",
              borderRadius: "12px",
              padding: "12px",
              background: "var(--accent-purple-surface)",
            }}
          >
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
                  fontWeight: 600,
                }}
              >
                Clear
              </button>
            </div>
            <div
              style={{
                marginTop: "12px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
                gap: "12px",
              }}
            >
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
                    padding: "8px",
                    borderRadius: "8px",
                    border: "1px solid var(--surface-light)",
                    marginTop: "4px",
                  }}
                />
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
            {catalogSubmitError && (
              <div style={{ marginTop: "10px", padding: "10px", borderRadius: "8px", background: "var(--warning-surface)", color: "var(--danger)" }}>
                {catalogSubmitError}
              </div>
            )}
            {catalogSuccessMessage && (
              <div style={{ marginTop: "10px", padding: "10px", borderRadius: "8px", background: "var(--success-surface)", color: "var(--success-dark)" }}>
                {catalogSuccessMessage}
              </div>
            )}
            <button
              type="button"
              onClick={handleAddPartFromStock}
              disabled={!canAllocateParts || allocatingPart}
              style={{
                marginTop: "12px",
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                background: !canAllocateParts ? "var(--surface-light)" : "var(--primary)",
                color: !canAllocateParts ? "var(--info)" : "var(--surface)",
                fontWeight: 600,
                cursor: !canAllocateParts ? "not-allowed" : "pointer",
              }}
            >
              {allocatingPart ? "Adding…" : `Add to Job ${jobNumber || ""}`}
            </button>
          </div>
        )}
      </div>
      {hasParts ? (
        <>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--surface-light)",
              borderRadius: "14px",
              padding: "16px",
              boxShadow: "none",
            }}
          >
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "var(--primary)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Parts Pipeline
            </div>
            <div
              style={{
                marginTop: "12px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "10px",
              }}
            >
              {pipelineStages.map((stage) => (
                <div
                  key={stage.id}
                  style={{
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid rgba(var(--primary-rgb),0.3)",
                    background: stage.count > 0 ? "var(--surface-light)" : "var(--info-surface)",
                  }}
                >
                  <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--primary)" }}>
                    {stage.count}
                  </div>
                  <div style={{ fontWeight: 600 }}>{stage.label}</div>
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--info-dark)" }}>
                    {stage.description}
                  </p>
                </div>
              ))}
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
            {vhcParts.length === 0 ? (
              <div style={{
                padding: "20px",
                borderRadius: "10px",
                border: "1px solid var(--accent-purple-surface)",
                backgroundColor: "var(--accent-purple-surface)",
                fontSize: "14px",
                color: "var(--info)"
              }}>
                No VHC items have been converted into parts for this job yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {vhcParts.map((part) => {
                  const statusMeta = getPartStatusMeta(part.status);
                  return (
                    <div
                      key={part.id}
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        border: "1px solid var(--accent-purple-surface)",
                        backgroundColor: "var(--surface)",
                        boxShadow: "none"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div>
                          <div style={{ fontSize: "12px", color: "var(--info)" }}>{part.partNumber}</div>
                          <h3 style={{ margin: "2px 0", fontSize: "16px", fontWeight: "600", color: "var(--accent-purple)" }}>
                            {part.name}
                          </h3>
                          {part.description && (
                            <p style={{ margin: 0, fontSize: "13px", color: "var(--info-dark)" }}>{part.description}</p>
                          )}
                        </div>
                        <span
                          style={{
                            padding: "6px 12px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: "600",
                            color: statusMeta.color,
                            backgroundColor: statusMeta.background
                          }}
                        >
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

                      {part.notes && (
                        <div style={{
                          marginTop: "12px",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          backgroundColor: "var(--warning-surface)",
                          color: "var(--danger-dark)",
                          fontSize: "13px"
                        }}>
                          <strong style={{ fontSize: "12px", textTransform: "uppercase" }}>Technician Note:</strong>
                          <div>{part.notes}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 style={{ margin: "12px 0", fontSize: "18px", fontWeight: "600", color: "var(--info-dark)" }}>
              Manual Requests (Write-up)
            </h2>
            {manualRequests.length === 0 ? (
              <div style={{
                padding: "20px",
                borderRadius: "10px",
                border: "1px solid var(--accent-purple-surface)",
                backgroundColor: "var(--accent-purple-surface)",
                fontSize: "14px",
                color: "var(--info)"
              }}>
                No manual part requests have been logged.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {manualRequests.map((request) => {
                  const statusMeta = getPartStatusMeta(request.status);
                  return (
                    <div
                      key={request.requestId}
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        border: "1px solid var(--accent-purple-surface)",
                        backgroundColor: "var(--surface)",
                        boxShadow: "none"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div>
                          <div style={{ fontSize: "12px", color: "var(--info)" }}>{request.partNumber}</div>
                          <h3 style={{ margin: "2px 0", fontSize: "16px", fontWeight: "600", color: "var(--accent-purple)" }}>
                            {request.name}
                          </h3>
                          {request.description && (
                            <p style={{ margin: 0, fontSize: "13px", color: "var(--info-dark)" }}>{request.description}</p>
                          )}
                        </div>
                        <span
                          style={{
                            padding: "6px 12px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: "600",
                            color: statusMeta.color,
                            backgroundColor: statusMeta.background
                          }}
                        >
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p style={{ marginTop: "4px", color: "var(--info)", fontSize: "12px" }}>
            All data shown is read-only. Updates must be made from the VHC parts workflow or technician write-up form.
          </p>
        </>
      ) : (
        <div>
          <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "var(--text-primary)" }}>
            Parts Overview
          </h2>
          <div style={{
            padding: "40px",
            textAlign: "center",
            backgroundColor: "var(--info-surface)",
            borderRadius: "12px",
            border: "1px solid var(--accent-purple-surface)"
          }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🧰</div>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--accent-purple)", marginBottom: "8px" }}>
              No Parts Linked
            </h3>
            <p style={{ color: "var(--info)", fontSize: "14px", margin: 0 }}>
              VHC authorizations and manual write-up requests will appear here automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ✅ Notes Tab
function NotesTab({ value, onChange, canEdit, saving, meta }) {
  const lastUpdated =
    meta?.updatedAt || meta?.createdAt
      ? new Date(meta?.updatedAt || meta?.createdAt).toLocaleString("en-GB", {
          hour12: false,
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
  const updatedBy =
    meta?.lastUpdatedBy || meta?.createdBy || "Unassigned";

  return (
    <div>
      <div style={{
        padding: "20px",
        backgroundColor: "var(--surface)",
        borderRadius: "12px",
        border: "1px solid var(--accent-purple-surface)",
        boxShadow: "none"
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
            borderRadius: "12px",
            border: canEdit ? "1px solid var(--info)" : "1px solid var(--accent-purple-surface)",
            fontSize: "16px",
            lineHeight: 1.7,
            resize: "vertical",
            backgroundColor: canEdit ? "var(--surface)" : "var(--info-surface)",
            color: "var(--info-dark)"
          }}
        />
        <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "13px", color: "var(--info)", gap: "16px" }}>
          <div>
            {lastUpdated ? (
              <>
                Last updated by <strong style={{ color: "var(--accent-purple)" }}>{updatedBy}</strong> on{" "}
                <strong style={{ color: "var(--accent-purple)" }}>{lastUpdated}</strong>
                {meta?.lastUpdatedByEmail ? (
                  <div style={{ fontSize: "11px", color: "var(--info)", marginTop: "2px" }}>
                    {meta.lastUpdatedByEmail}
                  </div>
                ) : null}
              </>
            ) : (
              "No notes recorded yet."
            )}
          </div>
          <div style={{ fontSize: "12px", color: saving ? "var(--warning)" : "var(--info)" }}>
            {saving ? "Saving…" : "Synced"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ VHC Tab
function VHCTab({ jobNumber, jobData, onFinancialTotalsChange, onJobDataRefresh }) {
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Check if customer view should be enabled
  // All checkboxes must be complete (parts and labour for each row)
  const [allCheckboxesComplete, setAllCheckboxesComplete] = useState(false);

  const hasPartsWithPrices = allCheckboxesComplete;

  const customerViewUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/vhc/customer-preview/${jobNumber}`;
  }, [jobNumber]);

  const handleCustomerViewClick = () => {
    window.open(customerViewUrl, '_blank');
  };

  // Generate a shareable link (24-hour expiry) and copy to clipboard
  const handleCopyToClipboard = async () => {
    setGeneratingLink(true);
    try {
      // Request a share link from the API
      const response = await fetch(`/api/job-cards/${jobNumber}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate share link');
      }

      const { linkCode } = await response.json();

      // Build the shareable URL
      const shareUrl = `${window.location.origin}/vhc/share/${jobNumber}/${linkCode}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard", error);
      alert("Failed to copy link to clipboard: " + error.message);
    } finally {
      setGeneratingLink(false);
    }
  };

  const customActions = (
    <>
      <button
        type="button"
        onClick={handleCustomerViewClick}
        disabled={!hasPartsWithPrices}
        style={{
          padding: "8px 16px",
          borderRadius: "8px",
          border: `1px solid ${hasPartsWithPrices ? "var(--primary)" : "var(--grey-accent)"}`,
          backgroundColor: hasPartsWithPrices ? "var(--primary)" : "var(--surface-light)",
          color: hasPartsWithPrices ? "var(--surface)" : "var(--grey-accent)",
          fontWeight: 600,
          cursor: hasPartsWithPrices ? "pointer" : "not-allowed",
          opacity: hasPartsWithPrices ? 1 : 0.5,
          fontSize: "13px",
        }}
        title={!hasPartsWithPrices ? "Add parts prices and labour time to enable customer preview" : "Open customer preview in new tab"}
      >
        Customer Preview
      </button>
      <button
        type="button"
        onClick={handleCopyToClipboard}
        disabled={!hasPartsWithPrices || generatingLink}
        style={{
          padding: "8px 12px",
          borderRadius: "8px",
          border: `1px solid ${hasPartsWithPrices ? "var(--info)" : "var(--grey-accent)"}`,
          backgroundColor: hasPartsWithPrices ? (copied ? "var(--success)" : "var(--info)") : "var(--surface-light)",
          color: hasPartsWithPrices ? "var(--surface)" : "var(--grey-accent)",
          fontWeight: 600,
          cursor: hasPartsWithPrices && !generatingLink ? "pointer" : "not-allowed",
          opacity: hasPartsWithPrices ? 1 : 0.5,
          fontSize: "13px",
          minWidth: "100px",
        }}
        title={!hasPartsWithPrices ? "Add parts prices and labour time to enable customer preview" : copied ? "Copied!" : "Copy shareable link (expires in 24 hours)"}
      >
        {generatingLink ? "..." : copied ? "✓ Copied" : "📋 Copy Link"}
      </button>
    </>
  );

  return (
    <div>
      <VhcDetailsPanel
        jobNumber={jobNumber}
        showNavigation={false}
        customActions={customActions}
        onCheckboxesComplete={setAllCheckboxesComplete}
        onFinancialTotalsChange={onFinancialTotalsChange}
        onJobDataRefresh={onJobDataRefresh}
        enableTabs
      />
    </div>
  );
}

// ✅ Messages Tab
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
            fontWeight: 600,
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
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
            color: "var(--accent-purple)",
          }}
          title={`Customer: ${custName}`}
        >
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
            color: "var(--info-dark)",
          }}
        >
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

function MessagesTab({ thread, jobNumber, customerEmail }) {
  const router = useRouter();
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
    "after sales",
  ];
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
    router.push("/messages");
  };

  return (
    <div>
      {!thread ? (
        <div style={{
          padding: "28px",
          borderRadius: "12px",
          border: "1px dashed var(--danger-surface)",
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
              borderRadius: "8px",
              border: "none",
              backgroundColor: "var(--primary)",
              color: "white",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            Open Messaging Hub
          </button>
        </div>
      ) : (
        <>
          <div style={{
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid var(--accent-purple-surface)",
            backgroundColor: "var(--surface)",
            marginBottom: "16px",
            boxShadow: "none"
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
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Open in Messaging Hub
              </button>
            </div>
            <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {staffMembers.map((member, index) => (
                <span
                  key={member.userId || `staff-${index}`}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    backgroundColor: "var(--info-surface)",
                    color: "var(--info-dark)"
                  }}
                >
                  {member.name} · {member.role || "Team"}
                </span>
              ))}
              {customerMember && (
                <span
                  style={{
                    padding: "6px 12px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    backgroundColor: "var(--info-surface)",
                    color: "var(--accent-purple)"
                  }}
                >
                  {customerMember.name || "Customer"} · Customer
                </span>
              )}
            </div>
          </div>

          <div style={{
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid var(--accent-purple-surface)",
            backgroundColor: "var(--surface)",
            marginBottom: "16px",
            boxShadow: "none"
          }}>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "var(--accent-purple)" }}>
              Customer delivery status
            </h4>
            <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "var(--info)" }}>
              {customerEmail
                ? customerLinked
                  ? `Messages are shared with ${customerEmail}.`
                  : `Email on file (${customerEmail}) is not yet linked to this thread. Add them in Messaging to share updates.`
                : "No customer email is linked yet. Add one to start messaging the customer."}
            </p>
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "var(--info)" }}>
              Staff-only messages remain hidden from the customer portal.
            </p>
          </div>

          <div style={{
            padding: "0 0 4px 0",
            borderRadius: "12px",
            border: "1px solid var(--accent-purple-surface)",
            backgroundColor: "var(--surface)",
            maxHeight: "360px",
            overflowY: "auto",
            boxShadow: "none"
          }}>
            {messages.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--info)", fontSize: "14px" }}>
                No messages have been posted in this thread yet.
              </div>
            ) : (
              messages.map((message) => {
                const isStaffOnly = message.customerVisible === false || message.audience === "staff";
                return (
                  <div
                    key={message.id || `${message.createdAt}-${message.content.slice(0, 20)}`}
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid var(--info-surface)",
                      backgroundColor: isStaffOnly ? "var(--danger-surface)" : "var(--info-surface)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong style={{ color: "var(--accent-purple)", fontSize: "14px" }}>
                          {message.sender?.name || "Team Member"}
                        </strong>
                        {message.sender?.role && (
                          <span style={{ marginLeft: "8px", fontSize: "12px", color: "var(--info)" }}>
                            {message.sender.role}
                          </span>
                        )}
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
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: "600",
                          color: isStaffOnly ? "var(--danger)" : "var(--info-dark)",
                          backgroundColor: isStaffOnly ? "var(--danger-surface)" : "var(--success)"
                        }}
                      >
                        {isStaffOnly ? "Internal only" : "Shared with customer"}
                      </span>
                      {message.metadata?.jobNumber && (
                        <span style={{ fontSize: "11px", color: "var(--info)" }}>
                          Linked job #{message.metadata.jobNumber}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ClockingTab({ jobData, canEdit }) {
  const jobNumberValue = jobData?.jobNumber ?? jobData?.job_number ?? "";
  const normalizedJobNumber = jobNumberValue ? String(jobNumberValue).trim() : "";
  const [technicians, setTechnicians] = useState([]);
  const [techniciansLoading, setTechniciansLoading] = useState(false);
  const [techniciansError, setTechniciansError] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [clockInDate, setClockInDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [clockOutDate, setClockOutDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [clockInTime, setClockInTime] = useState("");
  const [clockOutTime, setClockOutTime] = useState("");
  const [selectedRequest, setSelectedRequest] = useState("job");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

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
        const { data, error } = await supabase
          .from("users")
          .select("user_id, first_name, last_name, role, email")
          .ilike("role", "%tech%")
          .order("first_name", { ascending: true })
          .order("last_name", { ascending: true });

        if (error) {
          throw error;
        }

        if (isMounted) {
          setTechnicians(data || []);
        }
      } catch (err) {
        console.error("Failed to load technicians:", err);
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

  const technicianOptions = useMemo(
    () =>
      (technicians || []).map((tech) => ({
        key: tech.user_id,
        value: String(tech.user_id),
        label:
          `${tech.first_name || ""} ${tech.last_name || ""}`.trim() ||
          tech.email ||
          "Technician",
        description: tech.role || "Technician",
      })),
    [technicians]
  );

  const requestOptions = useMemo(() => {
    const normalized = normalizeRequests(jobData?.requests || []);

    // Calculate total allocated hours for all requests
    const totalAllocatedHours = normalized.reduce((sum, req) => {
      const hours = parseFloat(req.time) || 0;
      return sum + hours;
    }, 0);

    const options = [
      {
        key: "job",
        value: "job",
        label: `Job #${normalizedJobNumber || ""}`,
        description: normalized.length === 1
          ? `${normalized[0].time || 0}h allocated`
          : totalAllocatedHours > 0
            ? `${totalAllocatedHours}h total allocated`
            : "Clock onto the main job"
      }
    ];

    normalized.forEach((req, index) => {
      const requestText = req.text || req.title || "Request";
      const allocatedTime = req.time || req.hours || 0;
      options.push({
        key: req.key || `request-${index}`,
        value: req.key || `request-${index}`,
        label: requestText,
        description: `${allocatedTime}h allocated`
      });
    });

    return options;
  }, [jobData?.requests, normalizedJobNumber]);

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

        // Build request snapshot for notes field
        const normalized = normalizeRequests(jobData?.requests || []);
        const selectedRequestData = normalized.find(r => r.key === selectedRequest);
        let notesPayload = null;

        if (selectedRequest && selectedRequest !== "job") {
          notesPayload = JSON.stringify({
            requestKey: selectedRequest,
            requestLabel: selectedRequest,
            requestTitle: selectedRequestData?.title || selectedRequest,
            requestHours: selectedRequestData?.hours || null
          });
        } else {
          notesPayload = JSON.stringify({
            requestKey: "job",
            requestLabel: `Job #${normalizedJobNumber}`,
            requestTitle: `Job #${normalizedJobNumber}`
          });
        }

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
          updated_at: nowIso,
        };

        const { error: timeRecordsError } = await supabase
          .from("time_records")
          .insert([timeRecordPayload]);

        if (timeRecordsError) {
          throw timeRecordsError;
        }

        const { error: jobClockingError } = await supabase.from("job_clocking").insert([
          {
            user_id: technicianId,
            job_id: jobId,
            job_number: normalizedJobNumber,
            clock_in: startDate.toISOString(),
            clock_out: finishDate.toISOString(),
            work_type: "manual",
            created_at: nowIso,
            updated_at: nowIso,
          },
        ]);

        if (jobClockingError) {
          throw jobClockingError;
        }

        const { error: jobUpdateError } = await supabase
          .from("jobs")
          .update({ updated_at: nowIso })
          .eq("id", jobId);

        if (jobUpdateError) {
          throw jobUpdateError;
        }

        setFormSuccess("Manual clocking entry saved for this job.");
        setClockInTime("");
        setClockOutTime("");
        setClockInDate(new Date().toISOString().split("T")[0]);
        setClockOutDate(new Date().toISOString().split("T")[0]);
        setSelectedRequest("job");
        setSelectedTechnicianId("");
        setRefreshSignal((prev) => prev + 1);
      } catch (err) {
        console.error("Manual clocking error:", err);
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
      selectedRequest,
      jobData?.requests,
    ]
  );

  const handleReset = () => {
    setSelectedTechnicianId("");
    setClockInDate(new Date().toISOString().split("T")[0]);
    setClockOutDate(new Date().toISOString().split("T")[0]);
    setClockInTime("");
    setClockOutTime("");
    setSelectedRequest("job");
    setFormError("");
    setFormSuccess("");
  };

  const inputControlStyle = {
    width: "100%",
    borderRadius: "14px",
    border: "1px solid var(--surface-light)",
    backgroundColor: "var(--surface-light)",
    padding: "12px 14px",
    fontSize: "0.95rem",
    color: "var(--text-primary)",
    boxShadow: "none",
  };

  const infoPillStyle = {
    padding: "8px 14px",
    borderRadius: "999px",
    backgroundColor: "var(--info-surface)",
    color: "var(--info-dark)",
    fontWeight: 600,
    fontSize: "0.85rem",
  };

  const disabledMessage =
    !canEdit && "This job card is read-only. Clocking entries can only be added by staff with edit access.";

  return (
    <div
      style={{
        padding: "20px",
        borderRadius: "12px",
        border: "1px solid var(--accent-purple-surface)",
        backgroundColor: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      {techniciansError && (
        <div
          style={{
            borderRadius: "12px",
            border: "1px solid var(--danger)",
            backgroundColor: "var(--danger-surface)",
            padding: "12px 14px",
            color: "var(--danger-dark)",
            fontSize: "0.9rem",
          }}
        >
          {techniciansError}
        </div>
      )}

      {disabledMessage && (
        <div
          style={{
            borderRadius: "12px",
            border: "1px solid var(--warning)",
            backgroundColor: "var(--warning-surface)",
            padding: "12px 14px",
            color: "var(--warning-dark)",
            fontSize: "0.9rem",
          }}
        >
          {disabledMessage}
        </div>
      )}

      {formError && (
        <div
          style={{
            borderRadius: "12px",
            border: "1px solid var(--danger)",
            backgroundColor: "var(--danger-surface)",
            padding: "12px 14px",
            color: "var(--danger-dark)",
            fontSize: "0.9rem",
          }}
        >
          {formError}
        </div>
      )}

      {formSuccess && (
        <div
          style={{
            borderRadius: "12px",
            border: "1px solid var(--success)",
            backgroundColor: "var(--success-surface)",
            padding: "12px 14px",
            color: "var(--success-dark)",
            fontSize: "0.9rem",
          }}
        >
          {formSuccess}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Row 1: Clock-in date, Clock-out date, Clock-in time, Clock-out time */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px",
          }}
        >
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
            disabled={!canEdit}
          />
          <CalendarField
            id="clocking-out-date"
            label="Clock-out date"
            value={clockOutDate}
            onChange={(event) => setClockOutDate(event.target.value)}
            required
            disabled={!canEdit}
          />
          <TimePickerField
            id="clocking-start-time"
            label="Clock-in time"
            value={clockInTime}
            onChange={(event) => setClockInTime(event.target.value)}
            required
            disabled={!canEdit}
          />
          <TimePickerField
            id="clocking-finish-time"
            label="Clock-out time"
            value={clockOutTime}
            onChange={(event) => setClockOutTime(event.target.value)}
            required
            disabled={!canEdit}
          />
        </div>

        {/* Row 2: Request selector, Tech selector */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="clocking-request-selector"
              style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--info-dark)" }}
            >
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
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="clocking-tech-selector"
              style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--info-dark)" }}
            >
              Technician
            </label>
            <DropdownField
              id="clocking-tech-selector"
              placeholder={techniciansLoading ? "Loading technicians…" : "Select technician"}
              options={technicianOptions}
              value={selectedTechnicianId}
              onChange={(event) => setSelectedTechnicianId(event.target.value)}
              disabled={!canEdit || techniciansLoading}
              required
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <button
              type="submit"
              disabled={!canEdit || submitting}
              style={{
                borderRadius: "12px",
                border: "none",
                backgroundColor: "var(--primary)",
                color: "white",
                padding: "12px 20px",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: !canEdit || submitting ? "not-allowed" : "pointer",
                opacity: !canEdit || submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Saving…" : "Save clocking entry"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={submitting}
              style={{
                borderRadius: "12px",
                border: "1px solid var(--info)",
                backgroundColor: "transparent",
                color: "var(--info)",
                padding: "12px 20px",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              Reset form
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "flex-end" }}>
            <span style={infoPillStyle}>
              {techniciansLoading ? "Loading technicians…" : `${technicianOptions.length} techs`}
            </span>
            {normalizedJobNumber ? (
              <span
                style={{
                  ...infoPillStyle,
                  backgroundColor: "var(--success-surface)",
                  color: "var(--success-dark)",
                }}
              >
                Job #{normalizedJobNumber}
              </span>
            ) : null}
          </div>
        </div>
      </form>

      {jobId && normalizedJobNumber && (
        <div id="clocking-history">
          <ClockingHistorySection
            jobId={jobId}
            jobNumber={normalizedJobNumber}
            requests={normalizeRequests(jobData?.requests || [])}
            jobAllocatedHours={jobData?.labour_hours || null}
            refreshSignal={refreshSignal}
            enableRequestClick={false}
            title="Clocking history"
          />
        </div>
      )}
    </div>
  );
}

function WarrantyTab({ jobData, canEdit, onLinkComplete = () => {} }) {
  const router = useRouter();
  const [linkMode, setLinkMode] = useState(false);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const linkedJob = jobData?.linkedWarrantyJob || null;
  const sharedVhcJobNumber =
    jobData?.warrantyVhcMasterJobNumber || jobData?.jobNumber;
  const isLinked = Boolean(jobData?.linkedWarrantyJobId);

  const loadWarrantyJobs = useCallback(async () => {
    if (!canEdit) return;
    setLoadingJobs(true);
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "id, job_number, status, job_source, vehicle_reg, vehicle_make_model, warranty_linked_job_id"
        )
        .eq("job_source", "Warranty")
        .neq("id", jobData.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      const filtered = (data || []).filter(
        (record) =>
          !record.warranty_linked_job_id ||
          record.warranty_linked_job_id === jobData.id
      );
      setAvailableJobs(filtered);
      setLinkError(
        filtered.length ? "" : "No warranty jobs are available to link right now."
      );
    } catch (err) {
      console.error("❌ Failed to load warranty jobs:", err);
      setLinkError(err?.message || "Failed to load warranty jobs.");
    } finally {
      setLoadingJobs(false);
    }
  }, [canEdit, jobData?.id]);

  useEffect(() => {
    if (linkMode) {
      loadWarrantyJobs();
    } else {
      setAvailableJobs([]);
      setSelectedJobId("");
      setLinkError("");
    }
  }, [linkMode, loadWarrantyJobs]);

  const handleLinkJob = async () => {
    if (!selectedJobId) {
      setLinkError("Select a warranty job card to link.");
      return;
    }

    const numericJobId = Number(selectedJobId);
    if (Number.isNaN(numericJobId)) {
      setLinkError("Invalid job selection.");
      return;
    }

    const targetJob =
      availableJobs.find((job) => job.id === numericJobId) || null;

    if (!targetJob) {
      setLinkError("Selected warranty job is no longer available.");
      return;
    }

    const targetIsWarranty =
      (targetJob.job_source || "").toLowerCase() === "warranty";
    const currentIsWarranty =
      (jobData?.jobSource || "").toLowerCase() === "warranty";

    const masterJobId =
      !currentIsWarranty && targetIsWarranty
        ? jobData.id
        : currentIsWarranty && !targetIsWarranty
        ? targetJob.id
        : jobData.id;

    setLinking(true);
    setLinkError("");

    const currentUpdate = await updateJob(jobData.id, {
      warranty_linked_job_id: numericJobId,
      warranty_vhc_master_job_id: masterJobId
    });

    if (!currentUpdate?.success) {
      setLinkError(
        currentUpdate?.error?.message || "Failed to update primary job."
      );
      setLinking(false);
      return;
    }

    const targetUpdate = await updateJob(numericJobId, {
      warranty_linked_job_id: jobData.id,
      warranty_vhc_master_job_id: masterJobId,
      status: jobData.status
    });

    if (!targetUpdate?.success) {
      await updateJob(jobData.id, {
        warranty_linked_job_id: null,
        warranty_vhc_master_job_id: null
      });
      setLinkError(
        targetUpdate?.error?.message || "Failed to update warranty job."
      );
      setLinking(false);
      return;
    }

    alert("✅ Warranty job card linked successfully.");
    setLinkMode(false);
    setSelectedJobId("");
    setAvailableJobs([]);
    setLinking(false);
    if (typeof onLinkComplete === "function") {
      onLinkComplete();
    }
  };

  const handleOpenLinkedJob = () => {
    if (!linkedJob?.jobNumber) return;
    router.push(`/job-cards/${linkedJob.jobNumber}`);
  };

  const renderLinkControls = () => {
    if (!canEdit) {
      return null;
    }

    if (!linkMode) {
      return (
        <button
          type="button"
          onClick={() => setLinkMode(true)}
          style={{
            marginTop: "16px",
            padding: "10px 18px",
            borderRadius: "10px",
            border: "none",
            backgroundColor: "var(--primary)",
            color: "white",
            fontWeight: "600",
            cursor: "pointer"
          }}
        >
          {isLinked ? "Change Linked Warranty Job" : "Link Warranty Job Card"}
        </button>
      );
    }

    return (
      <div
        style={{
          marginTop: "20px",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid var(--accent-purple-surface)",
          backgroundColor: "var(--warning-surface)",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              color: "var(--info-dark)",
              fontWeight: "600",
              marginBottom: "6px"
            }}
          >
            Select Warranty Job
          </label>
          <select
            value={selectedJobId}
            onChange={(event) => setSelectedJobId(event.target.value)}
            disabled={loadingJobs || linking}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid var(--info)",
              fontSize: "14px",
              backgroundColor: "var(--surface)"
            }}
          >
            <option value="">
              {loadingJobs
                ? "Loading warranty jobs..."
                : "Choose a warranty job number"}
            </option>
            {availableJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.job_number} · {job.vehicle_reg || "No Reg"} ·{" "}
                {job.vehicle_make_model || "Warranty Job"}
              </option>
            ))}
          </select>
          {linkError && (
            <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--danger)" }}>
              {linkError}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={handleLinkJob}
            disabled={linking || !selectedJobId}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: linking ? "var(--accent-purple)" : "var(--info)",
              color: "white",
              fontWeight: "600",
              cursor: linking ? "not-allowed" : "pointer",
              minWidth: "140px"
            }}
          >
            {linking ? "Linking..." : "Link Job"}
          </button>
          <button
            type="button"
            onClick={() => setLinkMode(false)}
            disabled={linking}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "1px solid var(--info)",
              backgroundColor: "var(--surface)",
              fontWeight: "600",
              cursor: linking ? "not-allowed" : "pointer"
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div
        style={{
          padding: "18px",
          borderRadius: "12px",
          border: "1px solid var(--surface-muted)",
          backgroundColor: "var(--surface)",
          marginBottom: "16px"
        }}
      >
        <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "var(--accent-purple)" }}>
          Linked Warranty Job
        </h3>
        {linkedJob ? (
          <>
            <p style={{ margin: 0, color: "var(--info-dark)", fontSize: "14px" }}>
              Linked to Job #{linkedJob.jobNumber} ({linkedJob.status || "Open"})
            </p>
            <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={handleOpenLinkedJob}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--info)",
                  backgroundColor: "var(--surface)",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px"
                }}
              >
                View Linked Job
              </button>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, color: "var(--info)", fontSize: "14px" }}>
            No warranty job card is linked yet.
          </p>
        )}
      </div>

      <div
        style={{
          padding: "18px",
          borderRadius: "12px",
          border: "1px solid var(--surface-muted)",
          backgroundColor: "var(--surface)"
        }}
      >
        <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "var(--accent-purple)" }}>
          Shared VHC Source
        </h3>
        <p style={{ margin: "0 0 6px 0", color: "var(--accent-purple)", fontSize: "14px" }}>
          VHC checklist hosted on Job #{sharedVhcJobNumber}
        </p>
        <p style={{ margin: 0, color: "var(--info-dark)", fontSize: "13px" }}>
          Any VHC updates, approvals, or parts raised on the master job instantly
          reflect on both job cards. Clocking, labour, and invoicing remain
          separate per job.
        </p>
      </div>

      {renderLinkControls()}
    </div>
  );
}

function DocumentsTab({
  documents = [],
  canDelete,
  onDelete,
  onManageDocuments
}) {
  const sortedDocuments = useMemo(() => {
    return [...(documents || [])].sort((a, b) => {
      const aTime = new Date(a.uploadedAt || a.uploaded_at || 0).getTime();
      const bTime = new Date(b.uploadedAt || b.uploaded_at || 0).getTime();
      return bTime - aTime;
    });
  }, [documents]);

  const formatTimestamp = (value) => {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "Unknown";
    }
    return parsed.toLocaleString();
  };

  const handlePreview = (doc) => {
    if (!doc?.url) return;
    const targetUrl = doc.url.startsWith("http")
      ? doc.url
      : `${window.location.origin}${doc.url}`;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "12px"
        }}
      >
        <div />
        {typeof onManageDocuments === "function" && (
          <button
            type="button"
            onClick={onManageDocuments}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "var(--primary)",
              color: "white",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer"
            }}
          >
            Upload Documents
          </button>
        )}
      </div>

      {sortedDocuments.length === 0 ? (
        <div
          style={{
            padding: "28px",
            borderRadius: "12px",
            border: "1px dashed var(--accent-purple-surface)",
            textAlign: "center",
            color: "var(--info)",
            fontSize: "14px"
          }}
        >
          No stored documents yet. Upload check-sheets, signed paperwork, or customer photos to keep
          everything in one place.
        </div>
      ) : (
        <div
          style={{
            borderRadius: "12px",
            border: "1px solid var(--accent-purple-surface)",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2.5fr 1fr 1fr 0.8fr",
              gap: "12px",
              padding: "14px 18px",
              backgroundColor: "var(--accent-purple-surface)",
              fontSize: "12px",
              fontWeight: "600",
              color: "var(--accent-purple)"
            }}
          >
            <span>File</span>
            <span>Folder</span>
            <span>Uploaded</span>
            <span style={{ textAlign: "right" }}>Actions</span>
          </div>
          {sortedDocuments.map((doc) => (
            <div
              key={doc.id || doc.file_id || doc.url}
              style={{
                display: "grid",
                gridTemplateColumns: "2.5fr 1fr 1fr 0.8fr",
                gap: "12px",
                padding: "16px 18px",
                borderTop: "1px solid var(--accent-purple-surface)",
                alignItems: "center"
              }}
            >
              <div>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>
                  {doc.name || doc.file_name || "Document"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--info)" }}>
                  {(doc.type || doc.file_type || "unknown").split("/").pop()}
                </div>
                <div style={{ fontSize: "11px", color: "var(--info-dark)", marginTop: "4px" }}>
                  Uploaded by {doc.uploadedBy || doc.uploaded_by || "system"}
                </div>
              </div>
              <div style={{ fontSize: "13px", color: "var(--info)" }}>
                {(doc.folder || "general").replace(/-/g, " ")}
              </div>
              <div style={{ fontSize: "13px", color: "var(--info)" }}>
                {formatTimestamp(doc.uploadedAt || doc.uploaded_at)}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => handlePreview(doc)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--info)",
                    backgroundColor: "var(--surface)",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  View
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => typeof onDelete === "function" && onDelete(doc)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--danger-surface)",
                      backgroundColor: "var(--danger-surface)",
                      color: "var(--danger)",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer"
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

