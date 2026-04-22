// file location: src/pages/job-cards/myjobs/[jobNumber].js

"use client";

import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";
import { MyJobCardShellSkeleton } from "@/components/ui/JobCardShellSkeleton";
import { useUser } from "@/context/UserContext";
import { useNextAction } from "@/context/NextActionContext";
import { useRoster } from "@/context/RosterContext";
import { useConfirmation } from "@/context/ConfirmationContext";
import {
  getJobByNumber,
  updateJob,
  updateJobStatus,
  deleteJobFile,
  summarizeWriteUpTasks } from
"@/lib/database/jobs";
import { getVHCChecksByJob } from "@/lib/database/vhc";
import { getClockingStatus } from "@/lib/database/clocking";
import { clockInToJob, clockOutFromJob, getUserActiveJobs } from "@/lib/database/jobClocking";
import { supabase } from "@/lib/database/supabaseClient";
import WriteUpForm from "@/components/JobCards/WriteUpForm";
import DocumentsUploadPopup from "@/components/popups/DocumentsUploadPopup";
import ModalPortal from "@/components/popups/ModalPortal";
import { getJobByNumberOrReg, saveChecksheet } from "@/lib/database/jobs";
import { createJobNote, getNotesByJob } from "@/lib/database/notes";
import { logJobSubStatus } from "@/lib/services/jobStatusService";
import { deriveJobTypeDisplay, formatDetectedJobTypeLabel } from "@/lib/jobType/display";
import {
  getMainStatusMetadata,
  normalizeStatusId,
  resolveMainStatusId,
  resolveSubStatusId } from
"@/lib/status/statusFlow";
import { DISPLAY as TECH_DISPLAY } from "@/lib/status/catalog/tech";
import { revalidateAllJobs } from "@/lib/swr/mutations"; // SWR cache invalidation after mutations
import { buildVhcAssistantState } from "@/features/vhcAssistant/buildVhcAssistantState";
import VhcAssistantPanel from "@/features/vhcAssistant/components/VhcAssistantPanel";
import { normaliseDecisionStatus } from "@/lib/vhc/summaryStatus";

// VHC Section Modals
import WheelsTyresDetailsModal from "@/components/VHC/WheelsTyresDetailsModal";
import BrakesHubsDetailsModal from "@/components/VHC/BrakesHubsDetailsModal";
import ServiceIndicatorDetailsModal from "@/components/VHC/ServiceIndicatorDetailsModal";
import ExternalDetailsModal from "@/components/VHC/ExternalDetailsModal";
import InternalElectricsDetailsModal from "@/components/VHC/InternalElectricsDetailsModal";
import UndersideDetailsModal from "@/components/VHC/UndersideDetailsModal";
import VhcCameraButton from "@/components/VHC/VhcCameraButton";
import CustomerVideoButton from "@/components/VHC/CustomerVideoButton";
import Button from "@/components/ui/Button";
import PhotoEditorModal from "@/components/VHC/PhotoEditorModal";
import VideoEditorModal from "@/components/VHC/VideoEditorModal";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import themeConfig, {
  vhcCardStates // VHC section state colours — still comes from appTheme
} from "@/styles/appTheme";

// Page layout styles — moved inline from appTheme.js (this was the only consumer).
// Uses thin CSS variable wrapper aliases to keep the same token references.
import TechJobDetailPageUi from "@/components/page-ui/job-cards/myjobs/job-cards-myjobs-job-number-ui"; // Extracted presentation layer.
const _p = { // CSS variable token aliases for this layout (matches appTheme palette)
  accent: "var(--primary)", // primary brand colour
  accentSoft: "var(--surface-light)", // light accent surface
  accentSurface: "var(--surface-light)", // same as accentSoft in this context
  backgroundGradient: "var(--surface)", // page background
  modalGradient: "var(--surface)", // card/modal background
  surface: "var(--surface)", // default surface
  border: "var(--border)", // border colour
  textPrimary: "var(--text-primary)", // primary text colour
  textMuted: "var(--text-secondary)" // muted/secondary text colour
};const _r = { // CSS variable border radius aliases (matches appTheme radii)
  lg: "var(--radius-lg)", // large radius
  xl: "var(--radius-xl)", // extra large radius
  pill: "var(--control-radius)" // button-style radius
};
const vhcLayoutStyles = { // page layout style map — only used on this page
  page: { height: "100%", display: "flex", flexDirection: "column", padding: "var(--space-3) var(--space-md)", gap: "var(--space-md)", background: _p.backgroundGradient },
  headerCard: { background: _p.modalGradient, borderRadius: _r.xl, padding: "var(--space-lg)", boxShadow: "none", display: "flex", flexDirection: "column", gap: "var(--space-5)" },
  headerTopRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-lg)" },
  headerTitleBlock: { display: "flex", flexDirection: "column", gap: "var(--space-1)" },
  headerTitle: { fontSize: "28px", fontWeight: "700", color: _p.accent, margin: 0 },
  headerSubtitle: { fontSize: "14px", color: _p.textMuted, margin: 0 },
  progressWrapper: { minWidth: "220px", display: "flex", flexDirection: "column", gap: "var(--space-1)" },
  progressLabel: { fontSize: "12px", fontWeight: "600", color: _p.textMuted },
  progressTrack: { width: "100%", height: "10px", borderRadius: _r.pill, backgroundColor: _p.accentSoft, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: _r.pill, background: "var(--primary)", transition: "width 0.3s ease" },
  metaRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-md)" },
  metaItem: { backgroundColor: _p.accentSurface, borderRadius: _r.lg, padding: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-1)" },
  metaLabel: { fontSize: "11px", fontWeight: "700", color: "var(--danger-dark)", letterSpacing: "0.4px", textTransform: "uppercase" },
  metaValue: { fontSize: "16px", fontWeight: "600", color: _p.textPrimary },
  mainCard: { flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-lg)", padding: "var(--space-lg)", borderRadius: _r.xl, background: "var(--surface)", boxShadow: "none", overflow: "hidden" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: "18px", fontWeight: "700", color: _p.accent, margin: 0 },
  sectionSubtitle: { fontSize: "13px", color: _p.textMuted, margin: 0 },
  sectionsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-md)" },
  sectionCard: { position: "relative", textAlign: "left", backgroundColor: _p.surface, borderRadius: _r.lg, padding: "var(--space-6)", boxShadow: "none", cursor: "pointer", transition: "transform 0.2s ease, border-color 0.2s ease", display: "flex", flexDirection: "column", gap: "var(--space-3)" },
  sectionCardHover: { transform: "translateY(-3px)", boxShadow: "none", borderColor: _p.accent },
  cardTitle: { fontSize: "16px", fontWeight: "700", color: _p.textPrimary, margin: 0 },
  cardSubtitle: { fontSize: "13px", color: _p.textMuted, margin: 0, lineHeight: 1.4 },
  badge: { alignSelf: "flex-start", padding: "var(--space-xs) var(--space-3)", borderRadius: _r.pill, fontSize: "11px", fontWeight: "700", letterSpacing: "0.4px", textTransform: "uppercase", border: "1px solid transparent" },
  actionBar: { display: "flex", flexWrap: "wrap", gap: "var(--space-3)", justifyContent: "flex-end", paddingTop: "var(--space-3)" }
};

// VHC Section titles and constants
const SECTION_TITLES = {
  wheelsTyres: "Wheels & Tyres",
  brakesHubs: "Brakes & Hubs",
  serviceIndicator: "Service Indicator & Under Bonnet",
  externalInspection: "External",
  internalElectrics: "Internal",
  underside: "Underside"
};

const MANDATORY_SECTION_KEYS = ["wheelsTyres", "brakesHubs", "serviceIndicator"];
const trackedSectionKeys = new Set(MANDATORY_SECTION_KEYS);

const VHC_REOPENED_SUB_STATUS = "VHC Reopened";
const VHC_COMPLETED_SUB_STATUS = "VHC Completed";

const createDefaultSectionStatus = () =>
MANDATORY_SECTION_KEYS.reduce((acc, key) => {
  acc[key] = "pending";
  return acc;
}, {});

const hasServiceIndicatorEntries = (indicator = {}) =>
Boolean(indicator?.serviceChoice) ||
Boolean(indicator?.oilStatus) ||
Array.isArray(indicator?.concerns) && indicator.concerns.length > 0;

const deriveSectionStatusFromSavedData = (savedData = {}) => {
  // If we have explicit section status saved, use it
  if (savedData._sectionStatus && typeof savedData._sectionStatus === "object") {
    // Only use saved status for mandatory sections that are actually tracked
    const result = createDefaultSectionStatus();
    MANDATORY_SECTION_KEYS.forEach((key) => {
      if (savedData._sectionStatus[key]) {
        result[key] = savedData._sectionStatus[key];
      }
    });
    return result;
  }

  // Otherwise, derive status from data content (legacy support)
  const derived = createDefaultSectionStatus();
  if (savedData.wheelsTyres && typeof savedData.wheelsTyres === "object") {
    derived.wheelsTyres = "complete";
  }
  const brakesData = savedData.brakesHubs;
  const hasBrakesContent =
  brakesData &&
  typeof brakesData === "object" &&
  Object.keys(brakesData).length > 0;
  if (hasBrakesContent) {
    derived.brakesHubs = "complete";
  }
  if (hasServiceIndicatorEntries(savedData.serviceIndicator || {})) {
    derived.serviceIndicator = "complete";
  }
  return derived;
};

const deriveJobTypeLabel = (jobCard) => deriveJobTypeDisplay(jobCard, { includeExtraCount: true });

const isConcernLocked = (concern) => {
  if (!concern || typeof concern !== "object") return false;
  const status = (concern.status || "").toLowerCase();
  return status.includes("approved") || status.includes("declined") || status.includes("authorized");
};

const styles = vhcLayoutStyles;

// Status color mapping for consistency
const STATUS_COLORS = {
  "Waiting": "var(--warning)",
  "In Progress": "var(--info)",
  "VHC Complete": "var(--success)",
  "VHC Reopened": "var(--warning)",
  "Write Up Complete": "var(--info)",
  "Complete": "var(--success)",
  "Outstanding": "var(--info)",
  "Accepted": "var(--primary)",
  "Awaiting Authorisation": "var(--warning)",
  "Authorised": "var(--accent-purple)",
  "Ready": "var(--info)",
  "Carry Over": "var(--danger)",
  "Complete": "var(--info)",
  "Sent": "var(--accent-purple)",
  "Viewed": "var(--info)"
};

const STATUS_BADGE_STYLES = {
  "Waiting": { background: "var(--warning-surface)", color: "var(--danger-dark)" },
  "In Progress": { background: "var(--info-surface)", color: "var(--accent-purple)" },
  "VHC Complete": { background: "var(--success-surface)", color: "var(--success-dark)" },
  "VHC Reopened": { background: "var(--warning-surface)", color: "var(--warning)" },
  "Write Up Complete": { background: "var(--info-surface)", color: "var(--accent-purple)" },
  "Complete": { background: "var(--success-surface)", color: "var(--success-dark)" },
  "Started": { background: "var(--info-surface)", color: "var(--accent-purple)" }
};

const getStatusBadgeStyle = (status, fallbackColor) =>
STATUS_BADGE_STYLES[status] || { background: fallbackColor, color: "white" };

const IN_PROGRESS_STATUS = "In Progress";

// Format date and time helper
const formatDateTime = (date) => {
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "N/A";
  }
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
  }const fallbackMarker = "/job-documents/";
  const fallbackIdx = url.indexOf(fallbackMarker);
  if (fallbackIdx >= 0) {
    return decodeURIComponent(url.substring(fallbackIdx + fallbackMarker.length));
  }
  return null;
};

const JOB_DOCUMENT_BUCKET = "job-documents";

const PARTS_STATUS_STYLES = {
  pending: { background: "var(--warning-surface)", color: "var(--danger-dark)" },
  awaiting_stock: { background: "var(--danger-surface)", color: "var(--danger)" },
  priced: { background: "var(--accent-purple-surface)", color: "var(--accent-purple)" },
  "pre-pick": { background: "var(--success-surface)", color: "var(--success-dark)" },
  "pre_pick": { background: "var(--success-surface)", color: "var(--success-dark)" },
  "on-order": { background: "var(--warning-surface)", color: "var(--warning)" },
  "on_order": { background: "var(--warning-surface)", color: "var(--warning)" },
  allocated: { background: "var(--success-surface)", color: "var(--success-dark)" },
  picked: { background: "var(--success-surface)", color: "var(--success-dark)" },
  fitted: { background: "var(--info-surface)", color: "var(--accent-purple)" },
  cancelled: { background: "var(--info-surface)", color: "var(--info)" }
};

const getPartsStatusStyle = (status) => {
  if (!status) return { background: "var(--info-surface)", color: "var(--info-dark)" };
  return PARTS_STATUS_STYLES[status.toLowerCase()] || { background: "var(--info-surface)", color: "var(--info-dark)" };
};

// Helper to get status after clock out
const getStatusAfterClockOut = () => null;

const normalizeVhcStatus = (value) => {
  if (value === null || value === undefined) return "na";
  const raw = String(value).trim().toLowerCase();
  if (!raw || raw === "n/a" || raw === "na" || raw === "none") return "na";
  if (raw.includes("green") || raw === "good" || raw === "ok") return "green";
  if (raw.includes("amber") || raw.includes("advisory") || raw.includes("warning")) return "amber";
  if (raw.includes("red") || raw.includes("danger") || raw.includes("critical")) return "red";
  return "na";
};

const getVhcActionButtonStyle = ({ active = false, disabled = false } = {}) => ({
  minHeight: "unset",
  padding: "6px 12px",
  borderRadius: "var(--radius-xs)",
  border: "none",
  fontWeight: 600,
  fontSize: "12px",
  backgroundColor: active ? "var(--accent-purple)" : "var(--accent-purple-surface)",
  color: active ? "var(--surface)" : "var(--accent-purple)",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
  transition: "all 0.18s ease"
});

const resolveTechStatusLabel = (jobCard, { hasActiveClocking = false } = {}) => {
  const rawStatus = normalizeStatusId(jobCard?.rawStatus || jobCard?.status || "");
  const completionStatus = normalizeStatusId(jobCard?.techCompletionStatus || "");
  if (
  rawStatus?.includes("tech_complete") ||
  rawStatus?.includes("technician_work_completed") ||
  rawStatus?.includes("invoiced") ||
  rawStatus === "complete" ||
  rawStatus === "completed" ||
  completionStatus === "tech_complete" ||
  completionStatus === "complete")
  {
    return "Complete";
  }
  if (hasActiveClocking) {
    return "In Progress";
  }
  if (
  rawStatus?.includes("booked") ||
  rawStatus?.includes("checked_in") ||
  rawStatus?.includes("waiting") ||
  rawStatus?.includes("pending"))
  {
    return "Waiting";
  }
  if (rawStatus?.includes("in_progress")) {
    return "In Progress";
  }
  return "In Progress";
};

const isTechTaskComplete = (jobCard = {}) => {
  const rawStatus = normalizeStatusId(jobCard?.rawStatus || jobCard?.status || "");
  const completionStatus = normalizeStatusId(jobCard?.techCompletionStatus || "");
  return (
    rawStatus?.includes("tech_complete") ||
    rawStatus?.includes("technician_work_completed") ||
    rawStatus?.includes("invoiced") ||
    rawStatus === "complete" ||
    rawStatus === "completed" ||
    completionStatus === "tech_complete" ||
    completionStatus === "complete");

};

const calculateClockingMinutesTotal = (rows = [], now = Date.now()) => {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const totalMinutes = rows.reduce((sum, row) => {
    if (!row?.clock_in) return sum;
    const start = Date.parse(row.clock_in);
    const end = row.clock_out ? Date.parse(row.clock_out) : now;
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return sum;
    return sum + (end - start) / (1000 * 60);
  }, 0);
  return Math.max(0, Math.round(totalMinutes));
};

const formatClockingDuration = (totalMinutes) => {
  const safeMinutes = Number.isFinite(totalMinutes) ? Math.max(0, totalMinutes) : 0;
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  const minuteLabel = minutes === 1 ? "min" : "mins";
  return `${hours}h${minutes}${minuteLabel}`;
};

export default function TechJobDetailPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const { user, dbUserId, setStatus, refreshCurrentJob, setCurrentJob } = useUser();
  const { usersByRole, isLoading: rosterLoading } = useRoster();
  const { triggerNextAction } = useNextAction();
  const { confirm } = useConfirmation();

  // State management
  const [jobData, setJobData] = useState(null);
  const [statusSnapshot, setStatusSnapshot] = useState(null);
  const [vhcChecks, setVhcChecks] = useState([]);
  const [clockingStatus, setClockingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [showAdditionalContents, setShowAdditionalContents] = useState(false);
  const [jobClocking, setJobClocking] = useState(null);
  const [liveWriteUpTasks, setLiveWriteUpTasks] = useState(null);
  const [clockOutLoading, setClockOutLoading] = useState(false);
  const [clockInLoading, setClockInLoading] = useState(false);
  const [completeJobFeedback, setCompleteJobFeedback] = useState(null);
  const [clockingRows, setClockingRows] = useState([]);
  const [clockingNow, setClockingNow] = useState(() => Date.now());
  const [partsRequests, setPartsRequests] = useState([]);
  const [partsRequestsLoading, setPartsRequestsLoading] = useState(false);
  const [authorizedParts, setAuthorizedParts] = useState([]);
  const [authorizedPartsLoading, setAuthorizedPartsLoading] = useState(false);
  const [authorizedVhcRows, setAuthorizedVhcRows] = useState([]);
  const [authorizedVhcRowsLoading, setAuthorizedVhcRowsLoading] = useState(false);
  const formatPrePickLabel = useCallback((value = "") => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    return trimmed.
    split("_").
    map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).
    join(" ");
  }, []);
  const prePickByVhcId = useMemo(() => {
    const map = new Map();
    const items = Array.isArray(jobData?.jobCard?.parts_job_items) ?
    jobData.jobCard.parts_job_items :
    [];
    items.forEach((part) => {
      const vhcId = part?.vhc_item_id ?? part?.vhcItemId ?? part?.vhcId;
      const prePick = part?.pre_pick_location || part?.prePickLocation;
      if (!vhcId || !prePick) return;
      const key = String(vhcId);
      if (!map.has(key)) {
        map.set(key, new Set());
      }
      map.get(key).add(prePick);
    });
    return map;
  }, [jobData?.jobCard?.parts_job_items]);
  const [partRequestDescription, setPartRequestDescription] = useState("");
  const [partRequestQuantity, setPartRequestQuantity] = useState(1);
  const [partRequestVhcItemId, setPartRequestVhcItemId] = useState(null); // Optional VHC item link for tech requests.
  const [partsSubmitting, setPartsSubmitting] = useState(false);
  const [partsFeedback, setPartsFeedback] = useState("");
  const [jobDocuments, setJobDocuments] = useState([]);
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false);
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSubmitting, setNotesSubmitting] = useState(false);
  const [showJobTypesPopup, setShowJobTypesPopup] = useState(false);

  // VHC state management
  const [vhcData, setVhcData] = useState({
    wheelsTyres: null,
    brakesHubs: [],
    serviceIndicator: { serviceChoice: "", oilStatus: "", concerns: [] },
    externalInspection: [],
    internalElectrics: {
      "Lights Front": { concerns: [] },
      "Lights Rear": { concerns: [] },
      "Lights Interior": { concerns: [] },
      "Horn/Washers/Wipers": { concerns: [] },
      "Air Con/Heating/Ventilation": { concerns: [] },
      "Warning Lamps": { concerns: [] },
      Seatbelt: { concerns: [] },
      Miscellaneous: { concerns: [] }
    },
    underside: {
      "Exhaust System/Catalyst": { concerns: [] },
      Steering: { concerns: [] },
      "Front Suspension": { concerns: [] },
      "Rear Suspension": { concerns: [] },
      "Driveshafts/Oil Leaks": { concerns: [] },
      Miscellaneous: { concerns: [] }
    }
  });
  const [sectionStatus, setSectionStatus] = useState(createDefaultSectionStatus);
  const [activeSection, setActiveSection] = useState(null);
  const [isReopenMode, setIsReopenMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const saveTimeoutRef = useRef(null);
  const [showVhcSummary, setShowVhcSummary] = useState(false);
  const [showGreenItems, setShowGreenItems] = useState(false);
  const [vhcCompleteOverride, setVhcCompleteOverride] = useState(false);
  const [vhcStartedLogged, setVhcStartedLogged] = useState(false);

  const jobCardId = jobData?.jobCard?.id ?? null;
  const jobCardStatus = jobData?.jobCard?.status || "";
  const jobRequiresVhc = jobData?.jobCard?.vhcRequired === true;
  const visibleTabs = useMemo(() => {
    const tabs = ["overview"];
    if (jobRequiresVhc) {
      tabs.push("vhc");
    }
    tabs.push("write-up");
    tabs.push("parts");
    tabs.push("notes", "documents");
    return tabs;
  }, [jobRequiresVhc]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab("overview");
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (activeTab === "parts" && jobCardId) {
      setAuthorizedVhcRowsLoading(true);
      supabase.
      from("vhc_checks").
      select("vhc_id, job_id, section, issue_title, issue_description, approval_status, authorization_state, labour_hours, parts_cost, pre_pick_location, note_text, severity, approved_at, approved_by, Complete, request_id").
      eq("job_id", jobCardId).
      eq("approval_status", "authorized").
      then(({ data, error }) => {
        if (error) {
          console.error("Failed to refresh authorised VHC rows:", error);
        } else {
          setAuthorizedVhcRows(data || []);
        }
        setAuthorizedVhcRowsLoading(false);
      });
    }
  }, [activeTab, jobCardId]);

  const jobNumberForStatusFlow =
  jobNumber ||
  jobData?.jobCard?.jobNumber ||
  jobData?.job?.jobNumber ||
  null;
  const jobCardNumber = jobData?.jobCard?.jobNumber ?? jobNumber;
  const username = user?.username?.trim();

  const loadPartsRequests = useCallback(
    async (overrideJobId = null) => {
      const targetJobId = overrideJobId ?? jobCardId;
      if (!targetJobId) {
        setPartsRequests([]);
        return;
      }

      setPartsRequestsLoading(true);

      try {
        const { data, error } = await supabase.
        from("parts_requests").
        select(`
            request_id,
            job_id,
            quantity,
            status,
            description,
            created_at,
            part:part_id(
              id,
              part_number,
              name
            )
            requester:requested_by(
              user_id,
              first_name,
              last_name
            )
          `).
        eq("job_id", targetJobId).
        order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        setPartsRequests(data || []);
      } catch (loadError) {
        console.error("Failed to load parts requests:", loadError);
        setPartsRequests([]);
      } finally {
        setPartsRequestsLoading(false);
      }
    },
    [jobCardId]
  );

  const loadNotes = useCallback(
    async (overrideJobId = null) => {
      const targetJobId = overrideJobId ?? jobCardId;
      if (!targetJobId) {
        setNotes([]);
        return;
      }

      setNotesLoading(true);
      try {
        const fetchedNotes = await getNotesByJob(targetJobId);
        setNotes(Array.isArray(fetchedNotes) ? fetchedNotes : []);
      } catch (error) {
        console.error("Failed to load notes:", error);
        setNotes([]);
      } finally {
        setNotesLoading(false);
      }
    },
    [jobCardId]
  );

  const loadAuthorizedParts = useCallback(
    async (overrideJobId = null) => {
      const targetJobId = overrideJobId ?? jobCardId;
      if (!targetJobId) {
        setAuthorizedParts([]);
        return;
      }

      setAuthorizedPartsLoading(true);
      try {
        const { data: partsData, error: partsError } = await supabase.
        from("parts_job_items").
        select(
          `
            id,
            job_id,
            part_id,
            authorised,
            quantity_requested,
            unit_price,
            status,
            vhc_item_id,
            part:part_id(
              id,
              part_number,
              name
            )
          `
        ).
        eq("job_id", targetJobId).
        order("created_at", { ascending: false });

        if (partsError) {
          throw partsError;
        }

        const { data: vhcChecksData, error: vhcChecksError } = await supabase.
        from("vhc_checks").
        select("vhc_id, job_id, section, issue_title, issue_description, approval_status, authorization_state, labour_hours, parts_cost, pre_pick_location, note_text, severity, approved_at, approved_by, Complete, request_id").
        eq("job_id", targetJobId).
        eq("approval_status", "authorized");

        if (vhcChecksError) {
          throw vhcChecksError;
        }

        setAuthorizedVhcRows(vhcChecksData || []);

        const approvedVhcIds = new Set(
          (vhcChecksData || []).map((check) => String(check.vhc_id))
        );
        const filtered = (partsData || []).filter((part) => {
          if (part?.authorised === true) return true;
          if (part?.vhc_item_id && approvedVhcIds.has(String(part.vhc_item_id))) return true;
          return false;
        });

        setAuthorizedParts(filtered);
      } catch (loadError) {
        console.error("Failed to load authorised parts:", loadError);
        setAuthorizedParts([]);
        setAuthorizedVhcRows([]);
      } finally {
        setAuthorizedPartsLoading(false);
      }
    },
    [jobCardId]
  );

  const loadStatusSnapshot = useCallback(async (targetJobId) => {
    if (!targetJobId) {
      setStatusSnapshot(null);
      return;
    }

    try {
      const response = await fetch(`/api/status/snapshot?jobId=${targetJobId}`);
      const payload = await response.json();
      if (payload?.success && payload?.snapshot) {
        setStatusSnapshot(payload.snapshot);
      }
    } catch (snapshotError) {
      console.error("Failed to load status snapshot:", snapshotError);
    }
  }, []);

  // FIXED: Define all useCallback hooks FIRST before any useEffect that uses them

  // Callback: Refresh clocking status
  const refreshClockingStatus = useCallback(async () => {
    if (!dbUserId) {
      setClockingStatus(null);
      return;
    }

    try {
      const { success, data } = await getClockingStatus(dbUserId);
      if (success) {
        setClockingStatus(data);
      } else {
        setClockingStatus(null);
      }
    } catch (error) {
      console.error("Error refreshing clocking status:", error);
      setClockingStatus(null);
    }
  }, [dbUserId]);

  // Callback: Sync job status
  const syncJobStatus = useCallback(
    async (targetStatus, currentStatus, extraUpdates = {}) => {
      if (!targetStatus || !jobCardId) return null;

      const subStatusId = resolveSubStatusId(targetStatus);
      if (subStatusId) {
        try {
          const { status, status_updated_at, status_updated_by, ...restUpdates } = extraUpdates;
          const subStatusUpdates = { ...restUpdates };
          if (status) {
            const targetMeta = getMainStatusMetadata(status);
            subStatusUpdates.status = targetMeta?.label || status;
          }
          if (subStatusUpdates.status) {
            subStatusUpdates.status_updated_at =
            status_updated_at || subStatusUpdates.status_updated_at || new Date().toISOString();
            if (dbUserId) {
              subStatusUpdates.status_updated_by =
              status_updated_by || subStatusUpdates.status_updated_by || dbUserId;
            } else if (status_updated_by) {
              subStatusUpdates.status_updated_by = status_updated_by;
            }
          } else if (status_updated_at) {
            subStatusUpdates.status_updated_at = status_updated_at;
          }
          if (!subStatusUpdates.status_updated_by && status_updated_by) {
            subStatusUpdates.status_updated_by = status_updated_by;
          }

          if (Object.keys(subStatusUpdates).length > 0) {
            const response = await updateJob(jobCardId, subStatusUpdates);
            if (response?.success && response.data) {
              setJobData((prev) => {
                if (!prev?.jobCard) return prev;
                return {
                  ...prev,
                  jobCard: {
                    ...prev.jobCard,
                    ...response.data
                  }
                };
              });
            }
          }
          await logJobSubStatus(jobCardId, targetStatus, dbUserId, restUpdates?.status_change_reason);
          revalidateAllJobs(); // sync status change to other pages
          return { status: subStatusUpdates.status || targetStatus, subStatus: targetStatus };
        } catch (error) {
          console.error("syncJobStatus error:", error);
          return null;
        }
      }

      const targetMainId = resolveMainStatusId(targetStatus);
      if (!targetMainId) return null;
      const currentMainId = resolveMainStatusId(currentStatus);
      if (currentMainId && currentMainId === targetMainId) return null;

      try {
        const statusAuditUpdates = { ...extraUpdates };
        if (!Object.prototype.hasOwnProperty.call(statusAuditUpdates, "status_updated_at")) {
          statusAuditUpdates.status_updated_at = new Date().toISOString();
        }
        if (
        dbUserId &&
        !Object.prototype.hasOwnProperty.call(statusAuditUpdates, "status_updated_by"))
        {
          statusAuditUpdates.status_updated_by = dbUserId;
        }

        const targetMeta = getMainStatusMetadata(targetStatus);
        const targetLabel = targetMeta?.label || targetStatus;
        const response =
        statusAuditUpdates && Object.keys(statusAuditUpdates).length > 0 ?
        await updateJob(jobCardId, { status: targetLabel, ...statusAuditUpdates }) :
        await updateJobStatus(jobCardId, targetLabel);
        if (response?.success && response.data) {
          setJobData((prev) => {
            if (!prev?.jobCard) return prev;
            return {
              ...prev,
              jobCard: {
                ...prev.jobCard,
                ...response.data
              }
            };
          });
          revalidateAllJobs(); // sync status change to other pages
          return response.data;
        }
      } catch (error) {
        console.error("syncJobStatus error:", error);
      }

      return null;
    },
    [jobCardId, dbUserId]
  );

  // Callback: Refresh job clocking
  const refreshJobClocking = useCallback(async () => {
    const workshopUserId = dbUserId ?? user?.id;
    if (!workshopUserId || !jobCardId) {
      setJobClocking(null);
      return;
    }

    try {
      const result = await getUserActiveJobs(workshopUserId);
      if (result.success) {
        const match = result.data.find(
          (job) => Number(job.jobId) === Number(jobCardId)
        );
        setJobClocking(match || null);
      } else {
        setJobClocking(null);
      }
    } catch (refreshError) {
      console.error("Failed to refresh job clocking", refreshError);
      setJobClocking(null);
    }
  }, [dbUserId, user?.id, jobCardId]);

  const fetchClockedHoursTotal = useCallback(async () => {
    if (!jobCardId && !jobNumber) {
      setClockingRows([]);
      return;
    }

    try {
      let query = supabase.
      from("job_clocking").
      select("id, user_id, request_id, work_type, clock_in, clock_out");
      if (jobCardId) {
        query = query.eq("job_id", jobCardId);
      } else {
        query = query.eq("job_number", jobNumber);
      }
      const { data, error } = await query;
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      setClockingRows(rows);
    } catch (fetchError) {
      console.error("Failed to fetch clocked hours total:", fetchError);
      setClockingRows([]);
    }
  }, [jobCardId, jobNumber]);

  const fetchJobData = useCallback(async () => {
    if (!jobNumber) return;

    setLoading(true);
    try {
      const { data: job, error: jobError } = await getJobByNumber(jobNumber);

      if (jobError || !job) {
        alert("Job not found");
        router.push("/job-cards/myjobs");
        return;
      }

      setJobData(job);
      setLiveWriteUpTasks(null);
      const mappedFiles = (job?.jobCard?.files || job?.files || []).map(mapJobFileRecord);
      setJobDocuments(mappedFiles);

      const jobCardIdForFetch = job?.jobCard?.id;
      if (jobCardIdForFetch) {
        const checks = await getVHCChecksByJob(jobCardIdForFetch);
        setVhcChecks(checks);
        await loadStatusSnapshot(jobCardIdForFetch);
      } else {
        setVhcChecks([]);
        setNotes([]);
        setStatusSnapshot(null);
      }

      await refreshClockingStatus();
      await fetchClockedHoursTotal();
      await loadPartsRequests(jobCardIdForFetch);
      await loadAuthorizedParts(jobCardIdForFetch);
      await loadNotes(jobCardIdForFetch);
      return job;
    } catch (fetchError) {
      console.error("Error fetching job:", fetchError);
      alert("Failed to load job");
      return null;
    } finally {
      setLoading(false);
    }
  }, [
  jobNumber,
  router,
  refreshClockingStatus,
  loadPartsRequests,
  loadAuthorizedParts,
  loadNotes,
  loadStatusSnapshot,
  fetchClockedHoursTotal]
  );

  useEffect(() => {
    fetchJobData();
  }, [fetchJobData]);

  useEffect(() => {
    if (!jobCardId) {
      setStatusSnapshot(null);
      return;
    }
    void loadStatusSnapshot(jobCardId);
  }, [jobCardId, loadStatusSnapshot]);

  useEffect(() => {
    fetchClockedHoursTotal();
  }, [fetchClockedHoursTotal, jobClocking]);

  const hasActiveClocking = useMemo(
    () => clockingRows.some((row) => row && !row.clock_out),
    [clockingRows]
  );
  const activeClockingRows = useMemo(
    () => clockingRows.filter((row) => row && !row.clock_out),
    [clockingRows]
  );
  const workshopUserId = dbUserId ?? user?.id ?? null;
  const motWorkClaim = useMemo(
    () =>
    activeClockingRows.find(
      (row) => String(row?.work_type || "").trim().toLowerCase() === "mot"
    ) || null,
    [activeClockingRows]
  );
  const technicianWorkClocking = useMemo(
    () =>
    activeClockingRows.find(
      (row) => String(row?.work_type || "").trim().toLowerCase() !== "mot"
    ) || null,
    [activeClockingRows]
  );

  const clockedMinutesTotal = useMemo(
    () => calculateClockingMinutesTotal(clockingRows, clockingNow),
    [clockingRows, clockingNow]
  );

  useEffect(() => {
    if (!hasActiveClocking) return undefined;
    const intervalId = setInterval(() => {
      setClockingNow(Date.now());
    }, 1000);
    return () => clearInterval(intervalId);
  }, [hasActiveClocking]);

  useEffect(() => {
    if (!jobCardId) return undefined;
    const channel = supabase.channel(`job-clockings-${jobCardId}`);
    const handleClockingChange = () => {
      fetchClockedHoursTotal();
      refreshJobClocking();
      loadStatusSnapshot(jobCardId);
    };

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "job_clocking",
        filter: `job_id=eq.${jobCardId}`
      },
      handleClockingChange
    );

    void channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobCardId, fetchClockedHoursTotal, refreshJobClocking, loadStatusSnapshot]);

  useEffect(() => {
    if (!jobCardId) return undefined;

    const channel = supabase.channel(`myjob-live-${jobCardId}`);
    const handleJobRefresh = () => {
      fetchJobData();
    };

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "jobs",
        filter: `id=eq.${jobCardId}`
      },
      handleJobRefresh
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "job_writeups",
        filter: `job_id=eq.${jobCardId}`
      },
      handleJobRefresh
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "job_requests",
        filter: `job_id=eq.${jobCardId}`
      },
      handleJobRefresh
    );

    void channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobCardId, fetchJobData]);

  useEffect(() => {
    if (!jobCardId) {
      return undefined;
    }

    const channel = supabase.channel(`job-notes-${jobCardId}`);
    const handleChange = () => loadNotes(jobCardId);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "job_notes",
        filter: `job_id=eq.${jobCardId}`
      },
      handleChange
    );

    void channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobCardId, loadNotes]);

  // Callback: Handle job clock out
  const handleJobClockOut = useCallback(async () => {
    const workshopUserId = dbUserId ?? user?.id;
    if (!workshopUserId) {
      alert("Unable to clock out because your workshop profile is not linked.");
      return;
    }
    if (!jobClocking || !jobCardId) {
      alert("You are not clocked onto this job.");
      return;
    }

    const confirmed = await confirm(`Clock out from Job ${jobCardNumber}?`);
    if (!confirmed) return;

    setClockOutLoading(true);
    try {
      const result = await clockOutFromJob(workshopUserId, jobCardId, jobClocking.clockingId);
      if (result.success) {
        alert(`Clocked out from Job ${jobCardNumber}\n\nHours worked: ${result.hoursWorked}h`);
        setCurrentJob(null);
        const nextJob = await refreshCurrentJob();
        if (!nextJob) {
          setStatus("Waiting for Job");
        }
        setJobClocking(null);
        await refreshJobClocking();
        await fetchClockedHoursTotal();
        await refreshClockingStatus();
        const pausedStatus = getStatusAfterClockOut(jobData?.jobCard?.status);
        if (pausedStatus) {
          await syncJobStatus(pausedStatus, jobData?.jobCard?.status);
        }
      } else {
        alert(result.error || "Failed to clock out of this job.");
      }
    } catch (clockOutError) {
      console.error("Error clocking out from job:", clockOutError);
      alert(clockOutError.message || "Error clocking out. Please try again.");
    } finally {
      setClockOutLoading(false);
    }
  }, [
  dbUserId,
  user?.id,
  jobClocking,
  jobCardId,
  jobCardNumber,
  setCurrentJob,
  refreshCurrentJob,
  setStatus,
  refreshJobClocking,
  refreshClockingStatus,
  syncJobStatus,
  jobData?.jobCard?.status,
  confirm]
  );

  const handlePartsRequestSubmit = useCallback(async () => {
    if (!jobCardId) {
      alert("Unable to submit a part request before the job data is loaded.");
      return;
    }

    const requesterId = dbUserId ?? user?.id;
    if (!requesterId) {
      alert("Unable to resolve your workshop profile. Try refreshing the page.");
      return;
    }

    const trimmedDescription = partRequestDescription.trim();
    if (!trimmedDescription) {
      alert("Describe the part you need so the parts team can act on it.");
      return;
    }

    setPartsSubmitting(true);
    setPartsFeedback("");

    try {
      const insertPayload = { // Build request payload with optional VHC link.
        job_id: jobCardId,
        requested_by: requesterId,
        quantity: Math.max(1, Number(partRequestQuantity) || 1),
        description: trimmedDescription,
        status: "waiting_authorisation",
        source: "tech_request",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (partRequestVhcItemId) {// Attach VHC item link if tech selected one.
        insertPayload.vhc_item_id = partRequestVhcItemId;
      }

      const { error } = await supabase.from("parts_requests").insert(insertPayload);

      if (error) {
        throw error;
      }

      setPartRequestDescription("");
      setPartRequestQuantity(1);
      setPartRequestVhcItemId(null); // Reset VHC link after submission.
      setPartsFeedback("Part request submitted. Parts will review it alongside VHC items.");
      await fetchJobData();
    } catch (submitError) {
      console.error("Failed to submit part request:", submitError);
      alert(submitError.message || "Failed to raise the part request. Try again.");
    } finally {
      setPartsSubmitting(false);
    }
  }, [
  jobCardId,
  dbUserId,
  user?.id,
  partRequestDescription,
  partRequestQuantity,
  partRequestVhcItemId,
  fetchJobData]
  );

  // VHC Callbacks
  const markSectionState = useCallback((sectionKey, nextState) => {
    if (!trackedSectionKeys.has(sectionKey)) return;
    setSectionStatus((prev) => {
      const current = prev[sectionKey] || "pending";
      if (current === nextState) return prev;
      if (nextState === "inProgress" && current === "complete") {
        return prev;
      }
      return { ...prev, [sectionKey]: nextState };
    });
  }, []);

  const openSection = useCallback(
    (sectionKey) => {
      markSectionState(sectionKey, "inProgress");
      setActiveSection(sectionKey);
    },
    [markSectionState]
  );

  const persistVhcData = useCallback(
    async (payload, { quiet = false, updatedStatus = null } = {}) => {
      if (!jobNumber) {
        console.warn("Cannot save VHC: No job number");
        return false;
      }
      try {
        console.log("Saving VHC data for job:", jobNumber);
        setSaveStatus("saving");
        setSaveError("");

        // Include section status in the payload
        // Use updatedStatus if provided, otherwise use current sectionStatus
        const payloadWithStatus = {
          ...payload,
          _sectionStatus: updatedStatus || sectionStatus
        };

        const result = await saveChecksheet(jobNumber, payloadWithStatus);
        if (result.success) {
          console.log("VHC data saved successfully");
          if (!vhcStartedLogged && jobCardId) {
            await logJobSubStatus(jobCardId, "VHC Started", dbUserId, "VHC started");
            setVhcStartedLogged(true);
          }
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          if (quiet) {
            setSaveStatus("idle");
          } else {
            setSaveStatus("saved");
            saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2500);
          }
          return true;
        }
        console.error("VHC save failed:", result.error);
        setSaveStatus("error");
        setSaveError(result.error?.message || "Failed to save VHC data.");
        return false;
      } catch (err) {
        console.error("Error saving VHC:", err);
        setSaveStatus("error");
        setSaveError(err.message || "Unexpected error saving VHC data.");
        return false;
      }
    },
    [jobNumber, sectionStatus, vhcStartedLogged, jobCardId, dbUserId]
  );

  const handleSectionComplete = useCallback(async (sectionKey, sectionData, options = {}) => {
    const next = { ...vhcData, [sectionKey]: sectionData };
    setVhcData(next);
    setActiveSection(null);

    // Create updated status object for mandatory sections
    let updatedStatus = { ...sectionStatus };
    if (trackedSectionKeys.has(sectionKey)) {
      updatedStatus[sectionKey] = "complete";
      markSectionState(sectionKey, "complete");
    }

    const success = await persistVhcData(next, { quiet: true, updatedStatus, ...options });
    if (!success) {
      // If save failed, revert to inProgress
      if (trackedSectionKeys.has(sectionKey)) {
        markSectionState(sectionKey, "inProgress");
      }
    } else {
      // Reload VHC checks to ensure data is fresh
      if (jobCardId) {
        const checks = await getVHCChecksByJob(jobCardId);
        setVhcChecks(checks);
      }
    }
    return success;
  }, [vhcData, persistVhcData, markSectionState, jobCardId, sectionStatus]);

  const handleSectionDismiss = useCallback((sectionKey, draftData) => {
    setActiveSection(null);
    if (!draftData) return;
    setVhcData((prev) => ({ ...prev, [sectionKey]: draftData }));
  }, []);

  const getOptionalCount = useCallback((section) => {
    const value = vhcData[section];
    if (!value) return 0;
    if (Array.isArray(value)) return value.length;
    return Object.values(value).reduce(
      (sum, entry) => sum + (entry?.concerns?.length || 0),
      0
    );
  }, [vhcData]);

  const getBadgeState = useCallback((stateKey) =>
  vhcCardStates[stateKey] || vhcCardStates.pending, []);

  // Extract and categorize all VHC items
  const extractVhcSummary = useCallback(() => {
    const items = [];

    // 1. WHEELS & TYRES - Extract from wheelsTyres structure
    if (vhcData.wheelsTyres && typeof vhcData.wheelsTyres === "object") {
      const wheels = ["NSF", "OSF", "NSR", "OSR"];
      wheels.forEach((wheel) => {
        const wheelData = vhcData.wheelsTyres[wheel];
        if (wheelData && Array.isArray(wheelData.concerns)) {
          wheelData.concerns.forEach((concern) => {
            const status = normalizeVhcStatus(concern.status);
            if (status === "na") return;
            items.push({
              section: `Wheels & Tyres - ${wheel}`,
              status,
              text: concern.text || concern.description || concern.issue || "No description"
            });
          });
        }
      });
    }

    // 2. BRAKES & HUBS - Extract from brakesHubs array structure
    if (Array.isArray(vhcData.brakesHubs)) {
      vhcData.brakesHubs.forEach((axleData, axleIdx) => {
        if (!axleData) return;
        const axleName = axleIdx === 0 ? "Front" : "Rear";
        const sides = ["NSF", "OSF", "NSR", "OSR"];

        // Extract pad concerns
        if (axleData.pad) {
          sides.forEach((side) => {
            const padData = axleData.pad[side];
            if (padData && Array.isArray(padData.concerns)) {
              padData.concerns.forEach((concern) => {
                const status = normalizeVhcStatus(concern.status);
                if (status === "na") return;
                items.push({
                  section: `Brakes & Hubs - ${side} Pad`,
                  status,
                  text: concern.text || concern.description || concern.issue || "No description"
                });
              });
            }
          });
        }

        // Extract disc concerns
        if (axleData.disc) {
          sides.forEach((side) => {
            const discData = axleData.disc[side];
            if (discData && Array.isArray(discData.concerns)) {
              discData.concerns.forEach((concern) => {
                const status = normalizeVhcStatus(concern.status);
                if (status === "na") return;
                items.push({
                  section: `Brakes & Hubs - ${side} Disc`,
                  status,
                  text: concern.text || concern.description || concern.issue || "No description"
                });
              });
            }
          });
        }
      });
    }

    // 3. SERVICE INDICATOR - Extract from serviceIndicator structure
    if (vhcData.serviceIndicator && typeof vhcData.serviceIndicator === "object") {
      const serviceIndicator = vhcData.serviceIndicator;
      const serviceChoiceLabels = {
        reset: "Service Reminder Reset",
        not_required: "Service Reminder Not Required",
        no_reminder: "Doesn't Have a Service Reminder",
        indicator_on: "Service Indicator On"
      };
      const serviceChoiceKey = serviceIndicator.serviceChoice || "";
      const hasServiceChoice = Boolean(serviceChoiceKey);
      const normaliseServiceSource = (value = "") =>
      value.
      toString().
      toLowerCase().
      replace(/[^a-z0-9]+/g, " ").
      replace(/\s+/g, " ").
      trim();

      if (hasServiceChoice) {
        const normalizedChoice = serviceChoiceKey.toString().trim();
        items.push({
          section: "Service Reminder",
          status:
          normalizedChoice === "indicator_on" || normalizedChoice === "no_reminder" ?
          "amber" :
          "green",
          text: serviceChoiceLabels[normalizedChoice] || normalizedChoice
        });
      }

      if (Array.isArray(serviceIndicator.concerns)) {
        serviceIndicator.concerns.forEach((concern) => {
          const status = normalizeVhcStatus(concern.status);
          if (status === "na") return;
          const source = concern.source || "Under Bonnet";
          const normalizedSource = normaliseServiceSource(source);
          const isServiceReminderOil =
          normalizedSource.includes("service reminder") &&
          normalizedSource.includes("oil");
          if (hasServiceChoice && isServiceReminderOil) {
            return;
          }
          items.push({
            section:
            normalizedSource === "service" ?
            "Service Reminder" :
            normalizedSource === "oil" ?
            "Oil Level" :
            `Service Indicator - ${source}`,
            status,
            text: concern.text || concern.description || concern.issue || "No description"
          });
        });
      }
    }

    // 4. EXTERNAL INSPECTION - Extract from externalInspection array
    if (Array.isArray(vhcData.externalInspection)) {
      vhcData.externalInspection.forEach((category) => {
        if (category && Array.isArray(category.concerns)) {
          category.concerns.forEach((concern) => {
            const status = normalizeVhcStatus(concern.status);
            if (status === "na") return;
            items.push({
              section: `External - ${category.name || "General"}`,
              status,
              text: concern.text || concern.description || concern.issue || "No description"
            });
          });
        }
      });
    } else if (vhcData.externalInspection && typeof vhcData.externalInspection === "object") {
      Object.entries(vhcData.externalInspection).forEach(([categoryName, categoryData]) => {
        if (categoryData && Array.isArray(categoryData.concerns)) {
          categoryData.concerns.forEach((concern) => {
            const status = normalizeVhcStatus(concern.status);
            if (status === "na") return;
            items.push({
              section: `External - ${categoryName || "General"}`,
              status,
              text: concern.text || concern.description || concern.issue || "No description"
            });
          });
        }
      });
    }

    // 5. INTERNAL & ELECTRICS - Extract from internalElectrics object structure
    if (vhcData.internalElectrics && typeof vhcData.internalElectrics === "object") {
      Object.entries(vhcData.internalElectrics).forEach(([subsystem, subsystemData]) => {
        if (subsystemData && Array.isArray(subsystemData.concerns)) {
          subsystemData.concerns.forEach((concern) => {
            const status = normalizeVhcStatus(concern.status);
            if (status === "na") return;
            items.push({
              section: `Internal & Electrics - ${subsystem}`,
              status,
              text: concern.text || concern.description || concern.issue || "No description"
            });
          });
        }
      });
    }

    // 6. UNDERSIDE - Extract from underside object structure
    if (vhcData.underside && typeof vhcData.underside === "object") {
      Object.entries(vhcData.underside).forEach(([subsystem, subsystemData]) => {
        if (subsystemData && Array.isArray(subsystemData.concerns)) {
          subsystemData.concerns.forEach((concern) => {
            const status = normalizeVhcStatus(concern.status);
            if (status === "na") return;
            items.push({
              section: `Underside - ${subsystem}`,
              status,
              text: concern.text || concern.description || concern.issue || "No description"
            });
          });
        }
      });
    }

    // Categorize by status
    const buckets = { red: [], amber: [], green: [] };
    items.forEach((item) => {
      const status = normalizeVhcStatus(item.status);
      if (status === "red") {
        buckets.red.push(item);
      } else if (status === "amber") {
        buckets.amber.push(item);
      } else if (status === "green") {
        buckets.green.push(item);
      }
    });

    return buckets;
  }, [vhcData]);

  const vhcSummaryItems = useMemo(() => extractVhcSummary(), [extractVhcSummary]);

  // Check if VHC can be completed (all mandatory sections done)
  const canCompleteVhc = useMemo(() => {
    const mandatoryComplete = MANDATORY_SECTION_KEYS.every(
      (key) => sectionStatus[key] === "complete"
    );
    return mandatoryComplete;
  }, [sectionStatus]);

  // Compute VHC resolution state from actual check rows for accurate tab colour.
  const vhcResolutionSnapshot = useMemo(() => {
    const checks = Array.isArray(jobData?.jobCard?.vhcChecks) ? jobData.jobCard.vhcChecks : [];
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

      filter(Boolean).
      map((v) => normaliseDecisionStatus(v));

      const severity = (check?.severity || check?.traffic_light || "").toString().toLowerCase();
      const isRed = severity.includes("red");
      const isAmber = severity.includes("amber");
      const hasDeclined = decisions.includes("declined");
      const hasNotApplicable = decisions.includes("n/a");
      const isAuthorised = decisions.includes("authorized");
      const hasCompleted =
      decisions.includes("completed") ||
      check?.Complete === true ||
      check?.complete === true;

      const isResolved = hasDeclined || hasNotApplicable || isAuthorised && hasCompleted;

      if (isResolved) {
        resolved += 1;
      } else {
        unresolved += 1;
      }

      if (isRed || isAmber || isAuthorised && !hasCompleted) {
        if (!isResolved) {
          unresolvedRedAmberOrAuthorised += 1;
        }
      }
    });
    return { total: summaryRows.length, resolved, unresolved, unresolvedRedAmberOrAuthorised };
  }, [jobData?.jobCard?.vhcChecks]);

  const hasRedAmberRepairRows = vhcResolutionSnapshot.unresolvedRedAmberOrAuthorised > 0;
  const vhcTabComplete =
  vhcResolutionSnapshot.total > 0 &&
  vhcResolutionSnapshot.unresolvedRedAmberOrAuthorised === 0;
  const vhcTabCompleteInstant = vhcTabComplete || Boolean(jobData?.jobCard?.vhcCompletedAt);
  const vhcTabAmberReady = hasRedAmberRepairRows && !vhcTabCompleteInstant;

  const isVhcCompleted =
  vhcCompleteOverride || vhcTabCompleteInstant;
  const showVhcReopenButton = isVhcCompleted;

  const writeUpCompletion = (() => {
    const completionFromWriteUp =
    typeof jobData?.jobCard?.writeUp?.completion_status === "string" ?
    jobData.jobCard.writeUp.completion_status.toLowerCase() :
    "";
    if (completionFromWriteUp) return completionFromWriteUp;
    return typeof jobData?.jobCard?.completionStatus === "string" ?
    jobData.jobCard.completionStatus.toLowerCase() :
    "";
  })();
  const writeUpChecklistRowsComplete = (() => {
    const checklistRaw = jobData?.jobCard?.writeUp?.task_checklist;
    let checklistTasks = [];

    if (Array.isArray(checklistRaw)) {
      checklistTasks = checklistRaw;
    } else if (checklistRaw && typeof checklistRaw === "object") {
      checklistTasks = Array.isArray(checklistRaw.tasks) ? checklistRaw.tasks : [];
    } else if (typeof checklistRaw === "string") {
      try {
        const parsedChecklist = JSON.parse(checklistRaw);
        if (Array.isArray(parsedChecklist)) {
          checklistTasks = parsedChecklist;
        } else if (parsedChecklist && typeof parsedChecklist === "object") {
          checklistTasks = Array.isArray(parsedChecklist.tasks) ? parsedChecklist.tasks : [];
        }
      } catch (_error) {
        checklistTasks = [];
      }
    }

    if (checklistTasks.length === 0) {
      return null;
    }

    return checklistTasks.every((task) => {
      if (!task || typeof task !== "object") return false;
      if (typeof task.checked === "boolean") return task.checked;
      const normalizedTaskStatus = String(task.status || "").trim().toLowerCase();
      return normalizedTaskStatus === "complete" || normalizedTaskStatus === "completed";
    });
  })();
  const writeUpComplete =
  typeof writeUpChecklistRowsComplete === "boolean" ?
  writeUpChecklistRowsComplete :
  writeUpCompletion === "complete" || writeUpCompletion === "waiting_additional_work";
  const writeUpTaskSummary = useMemo(
    () => summarizeWriteUpTasks(liveWriteUpTasks || []),
    [liveWriteUpTasks]
  );
  const effectiveWriteUpTaskSummary =
  liveWriteUpTasks !== null ?
  writeUpTaskSummary :
  jobData?.jobCard?.writeUpTaskSummary || null;
  const writeUpTechComplete =
  effectiveWriteUpTaskSummary?.technicianTasksComplete === true || writeUpComplete;
  const pendingMotTasks = effectiveWriteUpTaskSummary?.pendingMotTasks || [];
  const hasPendingMotOnly = effectiveWriteUpTaskSummary?.hasPendingMotOnly === true;
  const rectificationsComplete = writeUpTechComplete;
  const vhcAssistantState = useMemo(
    () =>
    buildVhcAssistantState({
      checks: vhcChecks,
      partsRows: jobData?.jobCard?.parts_job_items || [],
      sectionStatus,
      vhcRequired: jobRequiresVhc,
      vhcCompletedAt: jobData?.jobCard?.vhcCompletedAt || null,
      sentToCustomer: false,
      canEdit: true,
      context: "internal",
      writeUpComplete: writeUpTechComplete
    }),
    [
    vhcChecks,
    jobData?.jobCard?.parts_job_items,
    jobData?.jobCard?.vhcCompletedAt,
    sectionStatus,
    jobRequiresVhc,
    writeUpTechComplete]

  );

  const handleCompleteVhcClick = useCallback(async () => {
    if (!jobCardId) return;
    if (!showVhcReopenButton && !canCompleteVhc) return;

    const targetStatus = showVhcReopenButton ?
    VHC_REOPENED_SUB_STATUS :
    VHC_COMPLETED_SUB_STATUS;
    const shouldShowCompleteCard = targetStatus === VHC_COMPLETED_SUB_STATUS;
    if (shouldShowCompleteCard) {
      setVhcCompleteOverride(true);
    }

    try {
      const vhcUpdate = shouldShowCompleteCard ?
      { vhc_completed_at: new Date().toISOString() } :
      { vhc_completed_at: null };
      const updated = await syncJobStatus(targetStatus, jobCardStatus, vhcUpdate);
      if (updated) {
        if (shouldShowCompleteCard) {
          setIsReopenMode(true);
          setShowVhcSummary(false);
          setShowGreenItems(false);
        } else {
          setIsReopenMode(false);
          setVhcCompleteOverride(false);
        }

        if (jobNumberForStatusFlow) {
          window.dispatchEvent(
            new CustomEvent("statusFlowRefresh", {
              detail: {
                jobNumber: String(jobNumberForStatusFlow),
                status: targetStatus
              }
            })
          );
        }
      } else {
        console.warn("Failed to update VHC status");
        if (shouldShowCompleteCard) {
          setVhcCompleteOverride(false);
        }
      }
    } catch (error) {
      console.error("Error updating VHC status:", error);
      if (shouldShowCompleteCard) {
        setVhcCompleteOverride(false);
      }
    }
  }, [
  jobCardId,
  showVhcReopenButton,
  canCompleteVhc,
  syncJobStatus,
  jobCardStatus,
  writeUpComplete,
  jobNumberForStatusFlow]
  );

  // NOW all useEffects come AFTER all callbacks are defined

  // Effect: Load VHC data when vhcChecks changes
  useEffect(() => {
    console.log("Loading VHC data, checks count:", vhcChecks?.length || 0);

    if (!vhcChecks || vhcChecks.length === 0) {
      console.log("No VHC checks found, initializing empty data");
      setVhcData({
        wheelsTyres: null,
        brakesHubs: [],
        serviceIndicator: { serviceChoice: "", oilStatus: "", concerns: [] },
        externalInspection: [],
        internalElectrics: {
          "Lights Front": { concerns: [] },
          "Lights Rear": { concerns: [] },
          "Lights Interior": { concerns: [] },
          "Horn/Washers/Wipers": { concerns: [] },
          "Air Con/Heating/Ventilation": { concerns: [] },
          "Warning Lamps": { concerns: [] },
          Seatbelt: { concerns: [] },
          Miscellaneous: { concerns: [] }
        },
        underside: {
          "Exhaust System/Catalyst": { concerns: [] },
          Steering: { concerns: [] },
          "Front Suspension": { concerns: [] },
          "Rear Suspension": { concerns: [] },
          "Driveshafts/Oil Leaks": { concerns: [] },
          Miscellaneous: { concerns: [] }
        }
      });
      setSectionStatus(createDefaultSectionStatus());
      return;
    }

    const vhcChecksheet = vhcChecks.find(
      (check) => check.section === "VHC_CHECKSHEET" || check.section === "VHC Checksheet"
    );

    if (vhcChecksheet && vhcChecksheet.data) {
      console.log("Found VHC checksheet data, loading...");
      setVhcData((prev) => ({
        ...prev,
        ...vhcChecksheet.data,
        serviceIndicator:
        vhcChecksheet.data.serviceIndicator || prev.serviceIndicator
      }));
      setSectionStatus(deriveSectionStatusFromSavedData(vhcChecksheet.data));

      // Detect reopen mode
      setIsReopenMode(Boolean(jobData?.jobCard?.vhcCompletedAt));
    } else {
      console.log("No VHC checksheet section found");
      setSectionStatus(createDefaultSectionStatus());
    }
  }, [vhcChecks, jobData]);

  useEffect(() => {
    if (vhcChecks?.length) {
      setVhcStartedLogged(true);
    }
  }, [vhcChecks]);

  // Effect: Refresh job clocking when jobCardId changes
  useEffect(() => {
    refreshJobClocking();
  }, [refreshJobClocking]);

  // Effect: Sync job status to "In Progress" when clocked in
  useEffect(() => {
    if (!jobClocking || !jobCardId) return;
    if (String(jobClocking?.workType || "").trim().toLowerCase() === "mot") {
      return;
    }
    const currentStatus = jobData?.jobCard?.status;
    if (isTechTaskComplete(jobData?.jobCard)) {
      return;
    }
    if ((currentStatus || "").trim() === IN_PROGRESS_STATUS) {
      return;
    }
    void syncJobStatus(IN_PROGRESS_STATUS, currentStatus);
  }, [jobClocking, jobCardId, jobData?.jobCard?.status, syncJobStatus]);

  // Helper: Resolve next action type from status
  const resolveNextActionType = (status) => {
    if (!status) return null;
    const normalized = String(status).toLowerCase();
    if (normalized.includes('vhc')) return 'vhc_complete';
    if (normalized.includes('complete') || normalized.includes('being washed')) return 'job_complete';
    return null;
  };

  // Handler: Update status
  const handleUpdateStatus = async (newStatus) => {
    const jobCardId = jobData?.jobCard?.id;
    if (!jobCardId) return;

    const confirmed = await confirm(`Update job status to "${newStatus}"?`);
    if (!confirmed) return;

    const result = await updateJobStatus(jobCardId, newStatus);

    if (result?.success && result.data) {
      alert("Status updated successfully!");
      setJobData((prev) => {
        if (!prev?.jobCard) return prev;
        return {
          ...prev,
          jobCard: {
            ...prev.jobCard,
            status: result.data.status
          }
        };
      });
      revalidateAllJobs(); // sync status change to other pages

      const actionType = resolveNextActionType(result.data.status);
      if (actionType) {
        const vehicleId = jobData?.vehicle?.vehicleId || jobData?.jobCard?.vehicleId || null;
        const vehicleReg =
        jobData?.vehicle?.reg ||
        jobData?.jobCard?.vehicleReg ||
        jobData?.jobCard?.vehicle?.reg ||
        "";
        triggerNextAction(actionType, {
          jobId: jobCardId,
          jobNumber: jobData?.jobCard?.jobNumber || jobCardNumber,
          vehicleId,
          vehicleReg,
          triggeredBy: user?.id || null
        });
      }
    } else {
      alert("Failed to update status");
    }
  };

  // Handler: Add note
  const handleAddNote = async () => {
    const trimmedNote = newNote.trim();
    if (!trimmedNote) {
      alert("Please enter a note");
      return;
    }

    if (!jobCardId) {
      alert("Unable to find this job reference. Please try again.");
      return;
    }

    setNotesSubmitting(true);
    try {
      const result = await createJobNote({
        job_id: jobCardId,
        user_id: dbUserId || null,
        note_text: trimmedNote,
        hidden_from_customer: true // Default: hidden from customer
      });

      if (!result?.success) {
        throw new Error(result?.error?.message || "Unable to save note");
      }

      setNewNote("");
      setShowAddNote(false);
      await loadNotes(jobCardId);
    } catch (error) {
      console.error("Failed to add note:", error);
      alert(error?.message || "Failed to add note");
    } finally {
      setNotesSubmitting(false);
    }
  };

  const handleDeleteDocument = useCallback(
    async (file) => {
      if (!file?.id) return;
      const confirmDelete = await confirm(`Delete ${file.name || "this file"}?`);
      if (!confirmDelete) return;

      try {
        const storagePath = deriveStoragePathFromUrl(file.url);
        if (storagePath) {
          const { error: removeError } = await supabase.storage.
          from(JOB_DOCUMENT_BUCKET).
          remove([storagePath]);
          if (removeError) {
            console.warn("Failed to remove file from storage:", removeError);
          }
        }

        const result = await deleteJobFile(file.id);
        if (!result?.success) {
          alert(result?.error?.message || "Failed to delete document");
          return;
        }

        setJobDocuments((prev) => prev.filter((doc) => doc.id !== file.id));
        setJobData((prev) => {
          if (!prev?.jobCard) return prev;
          const nextJobCardFiles = (prev.jobCard.files || []).filter(
            (doc) => (doc.file_id ?? doc.id) !== file.id
          );
          return {
            ...prev,
            jobCard: {
              ...prev.jobCard,
              files: nextJobCardFiles
            }
          };
        });
      } catch (deleteError) {
        console.error("Failed to delete document:", deleteError);
        alert(deleteError?.message || "Failed to delete document");
      }
    },
    [confirm]
  );

  const handleReplaceDocument = useCallback(async (oldDoc, editedFile) => {
    if (!oldDoc?.id || !editedFile) return;
    const jobIdNum = jobData?.id;
    if (!jobIdNum) return;
    try {
      const formData = new FormData();
      formData.append("file", editedFile);
      formData.append("jobId", String(jobIdNum));
      formData.append("userId", String(dbUserId || ""));
      const res = await fetch("/api/jobcards/upload-document", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      const storagePath = deriveStoragePathFromUrl(oldDoc.url);
      if (storagePath) {
        await supabase.storage.from(JOB_DOCUMENT_BUCKET).remove([storagePath]).catch(() => {});
      }
      await deleteJobFile(oldDoc.id).catch(() => {});

      const newDoc = mapJobFileRecord({
        file_id: data.file?.fileId || null,
        file_name: data.file?.filename || data.file?.originalName || editedFile.name || "Document",
        file_url: data.file?.path || "",
        file_type: data.file?.mimetype || editedFile.type || "",
        folder: "documents",
        uploaded_by: dbUserId || null,
        uploaded_at: data.file?.uploadedAt || new Date().toISOString()
      });
      setJobDocuments((prev) => prev.map((d) => d.id === oldDoc.id ? newDoc : d));
    } catch (err) {
      alert(err?.message || "Failed to replace document");
    }
  }, [jobData?.id, dbUserId]);

  const handleRenameDocument = useCallback(async (fileId, newName) => {
    if (!fileId || !newName) return;
    try {
      await fetch(`/api/jobcards/${encodeURIComponent(jobNumber)}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, fileName: newName })
      });
      setJobDocuments((prev) =>
      prev.map((doc) =>
      (doc.id || doc.file_id) === fileId ? { ...doc, name: newName, file_name: newName } : doc
      )
      );
    } catch {

      // silently ignore — gallery refreshes on next fetch
    }}, [jobNumber]);

  // Handler: VHC button click - only navigate if VHC is required
  const handleVhcClick = () => {
    if (!jobData?.jobCard?.vhcRequired) {
      alert("VHC is not required for this job.");
      return;
    }
    // Switch to VHC tab
    setSelectedTab("vhc");
  };

  // Helper: Get dynamic VHC button text based on job status
  const getVhcButtonText = () => {
    if (!jobData?.jobCard?.vhcRequired) return "VHC Not Required";

    // Reopen mode - VHC is complete or sent
    if (showVhcReopenButton) {
      return "Reopen VHC";
    }

    // In progress - checks exist but not complete
    if (vhcChecks.length > 0) {
      return "VHC in Progress";
    }

    // Fresh start - no checks exist
    return "Start VHC";
  };

  // Helper: Get VHC button color based on state
  const getVhcButtonColor = () => {
    if (!jobData?.jobCard?.vhcRequired) return "var(--surface-light)";

    if (showVhcReopenButton) {
      return "var(--warning)"; // Orange for reopen
    }

    if (vhcChecks.length > 0) {
      return "var(--primary)"; // Primary for in-progress
    }

    return "var(--info)"; // Blue for start
  };

  // Helper: Get VHC status message
  const getVhcStatusMessage = () => {
    if (!jobData?.jobCard?.vhcRequired) return "";

    if (showVhcReopenButton) {
      return "VHC completed. Click 'Reopen VHC' to view or make changes.";
    }

    if (vhcChecks.length > 0) {
      return "VHC in progress. Continue where you left off.";
    }

    return "VHC not started. Click to begin the vehicle health check.";
  };

  // Helper: Extract ALL concerns and measurements from VHC checksheet data
  const extractAllVhcItems = () => {
    const items = [];

    if (!jobData?.vhcChecks || jobData.vhcChecks.length === 0) {
      return { red: [], amber: [], green: [] };
    }

    // Find the VHC checksheet blob
    const vhcChecksheet = jobData.vhcChecks.find(
      (check) => check.section === "VHC_CHECKSHEET" || check.section === "VHC Checksheet"
    );

    if (!vhcChecksheet || !vhcChecksheet.data) {
      return { red: [], amber: [], green: [] };
    }

    const data = vhcChecksheet.data;

    // 1. EXTRACT TYRE MEASUREMENTS
    if (data.wheelsTyres) {
      const wheels = ["NSF", "OSF", "NSR", "OSR"];
      wheels.forEach((wheel) => {
        const wheelData = data.wheelsTyres[wheel];
        if (wheelData && wheelData.tread) {
          const { outer, middle, inner } = wheelData.tread;

          const measurements = [outer, middle, inner].filter(Boolean).map(Number);
          if (measurements.length > 0) {
            const minTread = Math.min(...measurements);
            let status = "green";
            if (minTread < 1.6) status = "red";else
            if (minTread < 3.0) status = "amber";

            items.push({
              section: "Wheels & Tyres",
              title: `${wheel} Tyre Tread Depth`,
              description: `Outer: ${outer}mm, Middle: ${middle}mm, Inner: ${inner}mm`,
              status,
              measurement: minTread,
              type: "measurement"
            });
          }
        }

        // Extract tyre concerns
        if (wheelData && Array.isArray(wheelData.concerns)) {
          wheelData.concerns.forEach((concern) => {
            items.push({
              section: "Wheels & Tyres",
              title: `${wheel} - ${concern.title || "Concern"}`,
              description: concern.text || concern.description || "",
              status: (concern.status || "green").toLowerCase(),
              type: "concern"
            });
          });
        }
      });
    }

    // 2. EXTRACT BRAKE MEASUREMENTS
    if (Array.isArray(data.brakesHubs)) {
      const sides = ["NSF", "OSF", "NSR", "OSR"];

      data.brakesHubs.forEach((axleData) => {
        if (!axleData) return;

        // Extract pad measurements
        if (axleData.pad) {
          sides.forEach((side) => {
            const padData = axleData.pad[side];
            if (padData && padData.measurement) {
              const measurement = Number(padData.measurement);
              let status = "green";
              if (measurement < 2) status = "red";else
              if (measurement < 4) status = "amber";

              items.push({
                section: "Brakes & Hubs",
                title: `${side} Brake Pad Thickness`,
                description: `${measurement}mm remaining`,
                status,
                measurement,
                type: "measurement"
              });
            }

            // Extract pad concerns
            if (padData && Array.isArray(padData.concerns)) {
              padData.concerns.forEach((concern) => {
                items.push({
                  section: "Brakes & Hubs",
                  title: `${side} Pad - ${concern.title || "Concern"}`,
                  description: concern.text || concern.description || "",
                  status: (concern.status || "green").toLowerCase(),
                  type: "concern"
                });
              });
            }
          });
        }

        // Extract disc measurements
        if (axleData.disc) {
          sides.forEach((side) => {
            const discData = axleData.disc[side];
            if (discData && discData.measurement) {
              const measurement = Number(discData.measurement);
              let status = "green";
              if (measurement < 22) status = "red";else
              if (measurement < 25) status = "amber";

              items.push({
                section: "Brakes & Hubs",
                title: `${side} Brake Disc Thickness`,
                description: `${measurement}mm remaining`,
                status,
                measurement,
                type: "measurement"
              });
            }

            // Extract disc concerns
            if (discData && Array.isArray(discData.concerns)) {
              discData.concerns.forEach((concern) => {
                items.push({
                  section: "Brakes & Hubs",
                  title: `${side} Disc - ${concern.title || "Concern"}`,
                  description: concern.text || concern.description || "",
                  status: (concern.status || "green").toLowerCase(),
                  type: "concern"
                });
              });
            }
          });
        }
      });
    }

    // 3. EXTRACT SERVICE INDICATOR & OIL STATUS
    if (data.serviceIndicator) {
      const si = data.serviceIndicator;

      if (si.serviceChoice) {
        const labels = {
          reset: "Service Reminder Reset",
          not_required: "Service Reminder Not Required",
          no_reminder: "Doesn't Have a Service Reminder",
          indicator_on: "Service Indicator On"
        };

        items.push({
          section: "Service Indicator",
          title: "Service Reminder Status",
          description: labels[si.serviceChoice] || si.serviceChoice,
          status: si.serviceChoice === "indicator_on" ? "amber" : "green",
          type: "info"
        });
      }

      if (si.oilStatus) {
        items.push({
          section: "Service Indicator",
          title: "Oil Status",
          description: `Oil level check: ${si.oilStatus}`,
          status: si.oilStatus === "Bad" ? "red" : "green",
          type: "info"
        });
      }

      if (Array.isArray(si.concerns)) {
        si.concerns.forEach((concern) => {
          items.push({
            section: "Service Indicator",
            title: concern.source || "Under Bonnet",
            description: concern.text || concern.description || "",
            status: (concern.status || "green").toLowerCase(),
            type: "concern"
          });
        });
      }
    }

    // 4-6. EXTRACT CONCERNS FROM OTHER SECTIONS
    const sections = [
    { key: 'externalInspection', name: 'External Inspection' },
    { key: 'internalElectrics', name: 'Internal & Electrics' },
    { key: 'underside', name: 'Underside' }];


    sections.forEach(({ key, name }) => {
      if (data[key]) {
        const sectionData = data[key];

        if (Array.isArray(sectionData)) {
          sectionData.forEach((category) => {
            if (category && Array.isArray(category.concerns)) {
              category.concerns.forEach((concern) => {
                items.push({
                  section: name,
                  title: category.name || name,
                  description: concern.text || concern.description || "",
                  status: (concern.status || "green").toLowerCase(),
                  type: "concern"
                });
              });
            }
          });
        } else if (typeof sectionData === "object") {
          Object.entries(sectionData).forEach(([subsystem, subsystemData]) => {
            if (subsystemData && Array.isArray(subsystemData.concerns)) {
              subsystemData.concerns.forEach((concern) => {
                items.push({
                  section: name,
                  title: subsystem,
                  description: concern.text || concern.description || "",
                  status: (concern.status || "green").toLowerCase(),
                  type: "concern"
                });
              });
            }
          });
        }
      }
    });

    // Categorize by status
    const buckets = { red: [], amber: [], green: [] };
    items.forEach((item) => {
      const status = (item.status || "green").toLowerCase();
      if (status.includes("red") || status === "danger") {
        buckets.red.push(item);
      } else if (status.includes("amber") || status === "advisory" || status === "warning") {
        buckets.amber.push(item);
      } else {
        buckets.green.push(item);
      }
    });

    return buckets;
  };

  const vhcItems = extractAllVhcItems();

  const techsList = usersByRole?.["Techs"] || [];
  const motTestersList = usersByRole?.["MOT Tester"] || [];
  const allowedTechNames = new Set([...techsList, ...motTestersList]);
  const userRoles = Array.isArray(user?.roles) ?
  user.roles :
  user?.role ?
  [user.role] :
  [];
  const hasRoleAccess = userRoles.some((roleName) => {
    const normalized = String(roleName).toLowerCase();
    return normalized.includes("tech") || normalized.includes("mot");
  });
  const hasMotRoleAccess = userRoles.some((roleName) =>
  String(roleName).toLowerCase().includes("mot")
  );
  const isTech =
  username && allowedTechNames.has(username) || hasRoleAccess;
  const isMotTester =
  username && motTestersList.includes(username) || hasMotRoleAccess;
  const canManageDocuments = isTech;

  useEffect(() => {
    if (!jobCardId || !jobData?.jobCard?.status) return;
    const currentStatusId = normalizeStatusId(jobData.jobCard.status);
    const completionStatusId = normalizeStatusId(jobData.jobCard.techCompletionStatus || "");
    const isMarkedComplete =
    currentStatusId === "complete" ||
    currentStatusId === "tech_complete" ||
    completionStatusId === "complete" ||
    completionStatusId === "tech_complete";
    if (!isMarkedComplete) return;

    const requiresVhc = jobData?.jobCard?.vhcRequired === true;
    const canCompleteJobLocal = writeUpTechComplete && (!requiresVhc || isVhcCompleted);
    if (canCompleteJobLocal) return;

    updateJob(jobCardId, { tech_completion_status: null }).then((statusResult) => {
      if (statusResult?.success && statusResult.data) {
        setJobData((prev) => {
          if (!prev?.jobCard) return prev;
          return {
            ...prev,
            jobCard: {
              ...prev.jobCard,
              ...statusResult.data
            }
          };
        });
      }
    });
  }, [
  jobCardId,
  jobData?.jobCard?.status,
  jobData?.jobCard?.techCompletionStatus,
  jobData?.jobCard?.vhcRequired,
  isVhcCompleted,
  writeUpTechComplete]
  );


  // Access check - only technicians can view this page
  if (!isTech) {
    return <TechJobDetailPageUi view="section1" />;







  }

  // Loading state
  if (loading) {
    return <TechJobDetailPageUi view="section2" jobNumber={jobNumber} MyJobCardShellSkeleton={MyJobCardShellSkeleton} />;
  }

  // Handle case where job is not found
  if (!jobData?.jobCard) {
    return <TechJobDetailPageUi view="section3" router={router} />;




















  }

  // Extract job data
  const { jobCard, customer, vehicle } = jobData;
  const snapshotTechStatus = statusSnapshot?.tech?.status || null;
  const techStatusDisplay =
  snapshotTechStatus && TECH_DISPLAY[snapshotTechStatus] ||
  resolveTechStatusLabel(jobCard, { hasActiveClocking: Boolean(jobClocking) });
  const isHeaderCompleteStatus = String(techStatusDisplay || "").trim().toLowerCase() === "complete";
  const jobStatusColor = STATUS_COLORS[techStatusDisplay] || "var(--info)";
  const jobStatusBadgeStyle = getStatusBadgeStyle(techStatusDisplay, jobStatusColor);
  // Count authorised VHC items for the quick stats
  const vhcSource = Array.isArray(jobData?.vhcChecks) && jobData.vhcChecks.length > 0 ?
  jobData.vhcChecks :
  vhcChecks;
  const authorisedVhcItems = vhcSource.filter((check) => {
    const status = String(check?.approval_status || check?.approvalStatus || "").toLowerCase();
    return status === "authorized";
  });
  const vhcAuthorisedCount = authorisedVhcItems.length;
  const clockedHours = formatClockingDuration(clockedMinutesTotal);
  const isWarrantyJob = (jobCard?.jobSource || "").toLowerCase() === "warranty";
  const categories = Array.isArray(jobCard?.jobCategories) ? jobCard.jobCategories : [];
  const detectedJobTypes =
  categories.length > 0 ?
  categories.map((entry) => {
    const label = formatDetectedJobTypeLabel(entry);
    // If the detection returned "Other" but the job clearly involves MOT, show "MOT".
    if (label === "Other") {
      const motHaystack = [
      jobCard?.type, jobCard?.description,
      ...(Array.isArray(jobCard?.requests) ? jobCard.requests.map((r) => typeof r === "string" ? r : r?.description || "") : [])].
      join(" ").toLowerCase();
      if (motHaystack.includes("mot")) return "MOT";
    }
    return label;
  }) :
  [deriveJobTypeLabel(jobCard)];

  // Quick stats data for display
  const quickStats = [
  {
    label: "Job Requests",
    value: deriveJobTypeLabel(jobCard),
    accent: "var(--info-dark)",
    pill: false,
    onClick: () => setShowJobTypesPopup(true)
  },
  {
    label: "Parts authorised",
    value: vhcAuthorisedCount,
    accent: "var(--danger)",
    pill: false
  },
  {
    label: "Clocked Hours",
    value: clockedHours,
    accent: "var(--success)",
    pill: false
  }];


  // Check if additional contents are available
  const hasAdditionalContents = () => {
    const filesCount = jobCard.files?.length || 0;
    const notesCount = notes.length;
    const partsCount = jobCard.partsRequests?.length || 0;
    const hasWriteUp = Boolean(jobCard.writeUp);
    return filesCount > 0 || notesCount > 0 || partsCount > 0 || hasWriteUp;
  };

  const additionalAvailable = hasAdditionalContents();
  const writeUp = jobCard?.writeUp || {};
  const faultText =
  writeUp.fault || "";
  const causeText =
  writeUp.caused ||
  writeUp.cause ||
  writeUp.task_checklist?.meta?.caused ||
  writeUp.recommendation ||
  "";
  const rectificationText =
  writeUp.rectification ||
  "";

  const isVhcCompleteForTech = !jobRequiresVhc || isVhcCompleted;
  const technicianWorkDone = isTechTaskComplete(jobCard);
  const pendingMotRequest = pendingMotTasks[0] || null;
  const motClockedByAnotherUser =
  Boolean(motWorkClaim) && Number(motWorkClaim?.user_id) !== Number(workshopUserId);
  const canClockIntoMotHandoff =
  isMotTester &&
  technicianWorkDone &&
  hasPendingMotOnly &&
  !technicianWorkClocking &&
  !motClockedByAnotherUser;
  const canCompleteJob = writeUpTechComplete && isVhcCompleteForTech;
  const completeJobLockedReasons = [];
  if (!writeUpTechComplete) {
    if (!rectificationsComplete) {
      completeJobLockedReasons.push("Complete all write-up checkboxes");
    }
  } else if (hasPendingMotOnly) {
    completeJobLockedReasons.push("MOT request will hand over to an MOT tester after tech completion");
  }
  if (!isVhcCompleteForTech) {
    completeJobLockedReasons.push("Complete mandatory VHC sections");
  }
  const completeJobLockedTitle = canCompleteJob ?
  "Mark job as Technician Work Completed" :
  completeJobLockedReasons.length > 0 ?
  completeJobLockedReasons.join(" • ") :
  "Complete the required steps to unlock";

  // Callback: Handle job clock in
  const handleJobClockIn = async () => {
    if (!workshopUserId) {
      alert("Unable to clock in because your workshop profile is not linked.");
      return;
    }
    if (!jobCardId) {
      alert("Unable to find job reference.");
      return;
    }
    if (jobClocking) {
      alert("You are already clocked onto this job.");
      return;
    }

    setClockInLoading(true);
    try {
      const isMotClockIn = canClockIntoMotHandoff && pendingMotRequest?.requestId;
      const result = await clockInToJob(
        workshopUserId,
        jobCardId,
        jobCardNumber,
        isMotClockIn ? "mot" : "initial",
        isMotClockIn ? pendingMotRequest.requestId : null
      );

      if (result.success) {
        alert(`Clocked in to Job ${jobCardNumber}`);
        if (!isMotClockIn) {
          setStatus("In Progress");
        }
        setCurrentJob(result.data);
        await refreshCurrentJob();
        setJobClocking(result.data);
        await refreshJobClocking();
        await fetchClockedHoursTotal();
        await refreshClockingStatus();
        if (!isMotClockIn) {
          await syncJobStatus(IN_PROGRESS_STATUS, jobData?.jobCard?.status);
        }
      } else {
        alert(result.error || "Failed to clock in to this job.");
      }
    } catch (clockInError) {
      console.error("Error clocking in to job:", clockInError);
      alert(clockInError.message || "Error clocking in. Please try again.");
    } finally {
      setClockInLoading(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!canCompleteJob) return;
    setCompleteJobFeedback(null);
    const workshopUserId = dbUserId ?? user?.id;
    if (jobClocking && jobCardId) {
      if (!workshopUserId) {
        alert("Unable to clock out because your workshop profile is not linked.");
        return;
      }
      setClockOutLoading(true);
      try {
        const result = await clockOutFromJob(
          workshopUserId,
          jobCardId,
          jobClocking.clockingId
        );
        if (!result.success) {
          alert(result.error || "Failed to clock out of this job.");
          return;
        }
        setCurrentJob(null);
        const nextJob = await refreshCurrentJob();
        if (!nextJob) {
          setStatus("Waiting for Job");
        }
        setJobClocking(null);
        await refreshJobClocking();
        await fetchClockedHoursTotal();
        await refreshClockingStatus();
      } catch (clockOutError) {
        console.error("Error clocking out from job:", clockOutError);
        alert(clockOutError.message || "Error clocking out. Please try again.");
        return;
      } finally {
        setClockOutLoading(false);
      }
    }

    const statusSyncResult = await syncJobStatus("Technician Work Completed", jobCardStatus, {
      status: "In Progress",
      status_change_reason: "Technician marked workshop work complete"
    });
    if (!statusSyncResult) {
      setCompleteJobFeedback({
        tone: "warning",
        title: "Tech completion saved, but the main job status did not update.",
        detail:
        'Fix: change the main job status to "In Progress", then press "Complete Job" again.'
      });
      await fetchJobData();
      return;
    }
    if (jobCardId) {
      const statusResult = await updateJob(jobCardId, { tech_completion_status: "tech_complete" });
      if (!statusResult?.success) {
        console.warn("Failed to set completion status");
      } else if (statusResult.data) {
        setJobData((prev) => {
          if (!prev?.jobCard) return prev;
          return {
            ...prev,
            jobCard: {
              ...prev.jobCard,
              ...statusResult.data,
              techCompletionStatus: statusResult.data.techCompletionStatus || "tech_complete"
            }
          };
        });
        revalidateAllJobs(); // sync completion status to other pages
      }
    }

    const refreshedJob = await fetchJobData();
    const refreshedMainStatus = resolveMainStatusId(
      refreshedJob?.jobCard?.status || refreshedJob?.status || null
    );
    if (refreshedMainStatus === "checked_in") {
      setCompleteJobFeedback({
        tone: "warning",
        title: 'Technician work is complete, but the main job status is still "Checked In".',
        detail:
        'Reason: the technician completion event was logged, but the main job status did not move forward. Fix: use the status control to change the main status to "In Progress", then press "Complete Job" again.'
      });
      return;
    }

    router.push("/job-cards/myjobs");
  };

  if (rosterLoading) {
    return <TechJobDetailPageUi view="section4" InlineLoading={InlineLoading} />;




  }

  return <TechJobDetailPageUi view="section5" activeSection={activeSection} activeTab={activeTab} authorisedVhcItems={authorisedVhcItems} authorizedVhcRows={authorizedVhcRows} authorizedVhcRowsLoading={authorizedVhcRowsLoading} BrakesHubsDetailsModal={BrakesHubsDetailsModal} Button={Button} canClockIntoMotHandoff={canClockIntoMotHandoff} canCompleteJob={canCompleteJob} canCompleteVhc={canCompleteVhc} canManageDocuments={canManageDocuments} clockInLoading={clockInLoading} clockOutLoading={clockOutLoading} completeJobFeedback={completeJobFeedback} completeJobLockedTitle={completeJobLockedTitle} customer={customer} CustomerVideoButton={CustomerVideoButton} dbUserId={dbUserId} detectedJobTypes={detectedJobTypes} DevLayoutSection={DevLayoutSection} DocumentsTab={DocumentsTab} DocumentsUploadPopup={DocumentsUploadPopup} ExternalDetailsModal={ExternalDetailsModal} fetchJobData={fetchJobData} formatDateTime={formatDateTime} formatPrePickLabel={formatPrePickLabel} getBadgeState={getBadgeState} getOptionalCount={getOptionalCount} getPartsStatusStyle={getPartsStatusStyle} handleAddNote={handleAddNote} handleCompleteJob={handleCompleteJob} handleCompleteVhcClick={handleCompleteVhcClick} handleDeleteDocument={handleDeleteDocument} handleJobClockIn={handleJobClockIn} handleJobClockOut={handleJobClockOut} handlePartsRequestSubmit={handlePartsRequestSubmit} handleRenameDocument={handleRenameDocument} handleReplaceDocument={handleReplaceDocument} handleSectionComplete={handleSectionComplete} handleSectionDismiss={handleSectionDismiss} InternalElectricsDetailsModal={InternalElectricsDetailsModal} isHeaderCompleteStatus={isHeaderCompleteStatus} isReopenMode={isReopenMode} isVhcCompleted={isVhcCompleted} jobCard={jobCard} jobClocking={jobClocking} jobData={jobData} jobDocuments={jobDocuments} jobNumber={jobNumber} jobStatusBadgeStyle={jobStatusBadgeStyle} ModalPortal={ModalPortal} newNote={newNote} notes={notes} notesLoading={notesLoading} notesSubmitting={notesSubmitting} openSection={openSection} partRequestDescription={partRequestDescription} partRequestQuantity={partRequestQuantity} partRequestVhcItemId={partRequestVhcItemId} partsFeedback={partsFeedback} partsRequests={partsRequests} partsRequestsLoading={partsRequestsLoading} partsSubmitting={partsSubmitting} prePickByVhcId={prePickByVhcId} quickStats={quickStats} saveError={saveError} saveStatus={saveStatus} sectionStatus={sectionStatus} ServiceIndicatorDetailsModal={ServiceIndicatorDetailsModal} setActiveTab={setActiveTab} setJobData={setJobData} setLiveWriteUpTasks={setLiveWriteUpTasks} setNewNote={setNewNote} setPartRequestDescription={setPartRequestDescription} setPartRequestQuantity={setPartRequestQuantity} setPartRequestVhcItemId={setPartRequestVhcItemId} setPartsFeedback={setPartsFeedback} setShowAddNote={setShowAddNote} setShowDocumentsPopup={setShowDocumentsPopup} setShowGreenItems={setShowGreenItems} setShowJobTypesPopup={setShowJobTypesPopup} setShowVhcSummary={setShowVhcSummary} showAddNote={showAddNote} showDocumentsPopup={showDocumentsPopup} showGreenItems={showGreenItems} showJobTypesPopup={showJobTypesPopup} showVhcReopenButton={showVhcReopenButton} showVhcSummary={showVhcSummary} techStatusDisplay={techStatusDisplay} UndersideDetailsModal={UndersideDetailsModal} user={user} vehicle={vehicle} VhcAssistantPanel={VhcAssistantPanel} vhcAssistantState={vhcAssistantState} VhcCameraButton={VhcCameraButton} vhcChecks={vhcChecks} vhcData={vhcData} vhcSummaryItems={vhcSummaryItems} vhcTabAmberReady={vhcTabAmberReady} visibleTabs={visibleTabs} WheelsTyresDetailsModal={WheelsTyresDetailsModal} WriteUpForm={WriteUpForm} writeUpTechComplete={writeUpTechComplete} />;























































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































}

export async function getServerSideProps() {
  return {
    props: {}
  };
}

const DOC_TYPE_META = {
  pdf: { label: "PDF", bg: "var(--danger-surface)", color: "var(--danger)" },
  png: { label: "PNG", bg: "var(--accent-surface)", color: "var(--accent-strong)" },
  jpg: { label: "JPG", bg: "var(--accent-surface)", color: "var(--accent-strong)" },
  jpeg: { label: "JPG", bg: "var(--accent-surface)", color: "var(--accent-strong)" },
  gif: { label: "GIF", bg: "var(--accent-surface)", color: "var(--accent-strong)" },
  webp: { label: "WEBP", bg: "var(--accent-surface)", color: "var(--accent-strong)" },
  svg: { label: "SVG", bg: "var(--accent-surface)", color: "var(--accent-strong)" },
  doc: { label: "DOC", bg: "var(--warning-surface)", color: "var(--warning)" },
  docx: { label: "DOCX", bg: "var(--warning-surface)", color: "var(--warning)" },
  xls: { label: "XLS", bg: "var(--success-surface)", color: "var(--success)" },
  xlsx: { label: "XLSX", bg: "var(--success-surface)", color: "var(--success)" }
};

function getDocTypeMeta(mimeOrExt = "") {
  const ext = mimeOrExt.split("/").pop().split(".").pop().toLowerCase();
  return DOC_TYPE_META[ext] || { label: ext.slice(0, 4).toUpperCase() || "FILE", bg: "var(--surface-light)", color: "var(--text-secondary)" };
}

function isImageMime(mime = "") {
  return /^image\/(png|jpe?g|gif|webp|svg\+xml|bmp)$/i.test(mime);
}

function isVideoMime(mime = "") {
  return /^video\//i.test(mime);
}

function DocumentsTab({
  documents = [],
  canDelete,
  onDelete,
  onManageDocuments,
  onRenameDocument,
  onReplaceDocument
}) {
  const [previewDoc, setPreviewDoc] = useState(null);
  const [isRenamingPreview, setIsRenamingPreview] = useState(false);
  const [previewRenameValue, setPreviewRenameValue] = useState("");
  const [editingDoc, setEditingDoc] = useState(null);

  const sortedDocuments = useMemo(() => {
    return [...(documents || [])].sort((a, b) => {
      const aTime = new Date(a.uploadedAt || a.uploaded_at || 0).getTime();
      const bTime = new Date(b.uploadedAt || b.uploaded_at || 0).getTime();
      return bTime - aTime;
    });
  }, [documents]);

  const formatDate = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <DevLayoutSection
      as="div"
      sectionKey="myjob-documents-panel"
      sectionType="section-shell"
      parentKey="myjob-tab-documents"
      backgroundToken="layer-section-level-1"
      style={{ backgroundColor: "var(--layer-section-level-1)" }}>
      
      {previewDoc && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => setPreviewDoc(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1400,
            backgroundColor: "var(--overlay)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px"
          }}>
          
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: "var(--radius-xl)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              maxWidth: "min(92vw, 1000px)",
              maxHeight: "90vh",
              width: "100%",
              boxShadow: "0 24px 64px rgba(0,0,0,0.4)"
            }}>
            
            <div
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "16px 20px",
                borderBottom: "1px solid var(--surface-light)",
                flexShrink: 0
              }}>
              
              {isRenamingPreview ?
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
                  style={{
                    flex: 1, padding: "6px 10px",
                    borderRadius: "var(--input-radius)",
                    border: "1px solid var(--primary)",
                    fontSize: "14px", fontWeight: 600,
                    color: "var(--text-primary)",
                    backgroundColor: "var(--surface)",
                    outline: "none"
                  }} />
                
                  <button
                  type="button"
                  onClick={() => {
                    const trimmed = previewRenameValue.trim();
                    if (trimmed && typeof onRenameDocument === "function") {
                      onRenameDocument(previewDoc.id || previewDoc.file_id, trimmed);
                      setPreviewDoc((prev) => ({ ...prev, name: trimmed, file_name: trimmed }));
                    }
                    setIsRenamingPreview(false);
                  }}
                  style={{
                    padding: "6px 14px", border: "none",
                    borderRadius: "var(--input-radius)",
                    backgroundColor: "var(--primary)", color: "var(--text-inverse)",
                    fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap"
                  }}>
                  
                    Save
                  </button>
                  <button
                  type="button"
                  onClick={() => setIsRenamingPreview(false)}
                  style={{
                    padding: "6px 10px", border: "none",
                    borderRadius: "var(--input-radius)",
                    backgroundColor: "var(--surface-light)", color: "var(--text-secondary)",
                    fontSize: "13px", fontWeight: 600, cursor: "pointer"
                  }}>
                  
                    Cancel
                  </button>
                </> :

              <>
                  <span style={{ flex: 1, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Document Preview
                  </span>
                  {typeof onReplaceDocument === "function" && (isImageMime(previewDoc.type || previewDoc.file_type || "") || isVideoMime(previewDoc.type || previewDoc.file_type || "")) &&
                <button
                  type="button"
                  onClick={() => {setEditingDoc(previewDoc);setPreviewDoc(null);}}
                  style={{
                    padding: "6px 14px", border: "1px solid var(--surface-light)",
                    borderRadius: "var(--input-radius)",
                    backgroundColor: "var(--surface)", color: "var(--text-primary)",
                    fontSize: "13px", fontWeight: 600, cursor: "pointer"
                  }}>
                  
                      Edit
                    </button>
                }
                  {typeof onRenameDocument === "function" &&
                <button
                  type="button"
                  onClick={() => {
                    const currentName = previewDoc.name || previewDoc.file_name || "";
                    setPreviewRenameValue(currentName);
                    setIsRenamingPreview(true);
                  }}
                  style={{
                    padding: "6px 14px", border: "1px solid var(--surface-light)",
                    borderRadius: "var(--input-radius)",
                    backgroundColor: "var(--surface)", color: "var(--text-primary)",
                    fontSize: "13px", fontWeight: 600, cursor: "pointer"
                  }}>
                  
                      Rename
                    </button>
                }
                </>
              }
              <button
                type="button"
                onClick={() => {setPreviewDoc(null);setIsRenamingPreview(false);}}
                style={{
                  width: "32px", height: "32px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "none", borderRadius: "var(--radius-xs)",
                  backgroundColor: "var(--surface-light)",
                  color: "var(--text-primary)",
                  fontSize: "18px", lineHeight: 1,
                  cursor: "pointer", fontWeight: 400, flexShrink: 0
                }}
                aria-label="Close preview">
                
                ×
              </button>
            </div>

            <div
              style={{
                flex: 1, overflow: "auto",
                display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: "var(--surface)",
                minHeight: "300px"
              }}>
              
              {isImageMime(previewDoc.type || previewDoc.file_type || "") ?
              <img
                src={previewDoc.url || previewDoc.file_url || ""}
                alt="Document preview"
                style={{
                  maxWidth: "100%", maxHeight: "80vh",
                  objectFit: "contain", display: "block"
                }} /> :


              <iframe
                src={previewDoc.url || previewDoc.file_url || ""}
                title="Document preview"
                style={{ width: "100%", height: "80vh", border: "none", display: "block" }} />

              }
            </div>
          </div>
        </div>,
        document.body
      )}

      <DevLayoutSection
        as="div"
        sectionKey="myjob-documents-toolbar"
        sectionType="toolbar"
        parentKey="myjob-documents-panel"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap"
        }}>
        
        <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>
          {sortedDocuments.length > 0 ? `${sortedDocuments.length} file${sortedDocuments.length !== 1 ? "s" : ""}` : "No documents yet"}
        </span>
        {typeof onManageDocuments === "function" &&
        <button
          type="button"
          onClick={onManageDocuments}
          style={{
            padding: "9px 18px", borderRadius: "var(--radius-sm)", border: "none",
            backgroundColor: "var(--primary)", color: "var(--text-inverse)",
            fontWeight: "600", fontSize: "14px", cursor: "pointer"
          }}>
          
            Upload Documents
          </button>
        }
      </DevLayoutSection>

      {sortedDocuments.length === 0 ?
      <DevLayoutSection
        as="div"
        sectionKey="myjob-documents-empty"
        sectionType="content-card"
        parentKey="myjob-documents-panel"
        style={{
          padding: "48px 24px",
          borderRadius: "var(--radius-md)",
          border: "2px dashed var(--surface-light)",
          textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: "14px",
          lineHeight: 1.6
        }}>
        
          <div style={{ fontSize: "32px", marginBottom: "10px", opacity: 0.4 }}>📄</div>
          <div style={{ fontWeight: 600, marginBottom: "4px", color: "var(--text-primary)" }}>No documents attached</div>
          Upload check-sheets, signed paperwork, or photos to keep everything in one place.
        </DevLayoutSection> :

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "14px"
        }}>
        
          {sortedDocuments.map((doc) => {
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
                border: "1px solid var(--surface-light)",
                overflow: "hidden",
                backgroundColor: "var(--surface)",
                display: "flex",
                flexDirection: "column",
                transition: "box-shadow 0.15s ease"
              }}
              onMouseEnter={(e) => {e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.12)";}}
              onMouseLeave={(e) => {e.currentTarget.style.boxShadow = "none";}}>
              
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
                  backgroundColor: isImage ? "var(--surface-dark, #111)" : typeMeta.bg,
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
                        {docType.includes("pdf") ? "📕" : docType.includes("sheet") || docName.match(/\.xls/i) ? "📗" : docType.includes("word") || docName.match(/\.doc/i) ? "📘" : "📄"}
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", color: typeMeta.color }}>
                        {typeMeta.label}
                      </span>
                    </div>
                }
                </button>

                <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div
                  title={docName}
                  style={{
                    fontSize: "13px", fontWeight: 600, color: "var(--text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                  }}>
                  
                    {docName}
                  </div>
                  {dateStr &&
                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{dateStr}</div>
                }
                </div>

                <div
                style={{
                  display: "flex", gap: "6px", padding: "8px 12px",
                  borderTop: "1px solid var(--surface-light)",
                  backgroundColor: "var(--surface-light)"
                }}>
                
                  <button
                  type="button"
                  onClick={() => docUrl && setPreviewDoc(doc)}
                  disabled={!docUrl}
                  style={{
                    flex: 1, padding: "5px 0",
                    borderRadius: "var(--radius-xs)", border: "none",
                    backgroundColor: "var(--accent-surface)", color: "var(--accent-strong)",
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
        </div>
      }

      <PhotoEditorModal
        isOpen={editingDoc !== null && isImageMime(editingDoc?.type || editingDoc?.file_type || "")}
        photoFile={editingDoc?.url || editingDoc?.file_url || ""}
        onSave={(editedFile) => {
          if (typeof onReplaceDocument === "function") onReplaceDocument(editingDoc, editedFile);
          setEditingDoc(null);
        }}
        onCancel={() => {setPreviewDoc(editingDoc);setEditingDoc(null);}}
        onSkip={() => {setPreviewDoc(editingDoc);setEditingDoc(null);}} />
      

      <VideoEditorModal
        isOpen={editingDoc !== null && isVideoMime(editingDoc?.type || editingDoc?.file_type || "")}
        videoFile={editingDoc?.url || editingDoc?.file_url || ""}
        onSave={(editedFile) => {
          if (typeof onReplaceDocument === "function") onReplaceDocument(editingDoc, editedFile);
          setEditingDoc(null);
        }}
        onCancel={() => {setPreviewDoc(editingDoc);setEditingDoc(null);}}
        onSkip={() => {setPreviewDoc(editingDoc);setEditingDoc(null);}} />
      
    </DevLayoutSection>);

}

TechJobDetailPage.getLayout = (page) => <Layout requiresLandscape>{page}</Layout>;
