// file location: src/pages/job-cards/myjobs/[jobNumber].js

"use client";

import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { useNextAction } from "@/context/NextActionContext";
import { useRoster } from "@/context/RosterContext";
import { useConfirmation } from "@/context/ConfirmationContext";
import { updateJobStatus, saveChecksheet } from "@/lib/database/jobs";
import { getVHCChecksByJob } from "@/lib/database/vhc";
import { getClockingStatus } from "@/lib/database/clocking";
import { clockInToJob, clockOutFromJob, getUserActiveJobs } from "@/lib/database/jobClocking";
import { supabase } from "@/lib/supabaseClient";
import WriteUpForm from "@/components/JobCards/WriteUpForm";
import { createJobNote, getNotesByJob } from "@/lib/database/notes";
import { fetchJobcardDetails } from "@/lib/api/jobcards";

// VHC Section Modals
import WheelsTyresDetailsModal from "@/components/VHC/WheelsTyresDetailsModal";
import BrakesHubsDetailsModal from "@/components/VHC/BrakesHubsDetailsModal";
import ServiceIndicatorDetailsModal from "@/components/VHC/ServiceIndicatorDetailsModal";
import ExternalDetailsModal from "@/components/VHC/ExternalDetailsModal";
import InternalElectricsDetailsModal from "@/components/VHC/InternalElectricsDetailsModal";
import UndersideDetailsModal from "@/components/VHC/UndersideDetailsModal";
import VhcCameraButton from "@/components/VHC/VhcCameraButton";
import themeConfig, {
  vhcLayoutStyles,
  createVhcButtonStyle,
  vhcCardStates,
} from "@/styles/appTheme";

// VHC Section titles and constants
const SECTION_TITLES = {
  wheelsTyres: "Wheels & Tyres",
  brakesHubs: "Brakes & Hubs",
  serviceIndicator: "Service Indicator & Under Bonnet",
  externalInspection: "External",
  internalElectrics: "Internal",
  underside: "Underside",
};

const MANDATORY_SECTION_KEYS = ["wheelsTyres", "brakesHubs", "serviceIndicator"];
const trackedSectionKeys = new Set(MANDATORY_SECTION_KEYS);

const VHC_REOPENED_STATUS = "VHC Reopened";
const VHC_REOPEN_ELIGIBLE_STATUSES = ["VHC Complete", "VHC Sent"];
const VHC_COMPLETED_STATUSES = [
  "VHC Complete",
  "VHC Sent",
  "VHC Approved",
  "VHC Declined",
  "Tech Complete",
];

const createDefaultSectionStatus = () =>
  MANDATORY_SECTION_KEYS.reduce((acc, key) => {
    acc[key] = "pending";
    return acc;
  }, {});

const hasServiceIndicatorEntries = (indicator = {}) =>
  Boolean(indicator?.serviceChoice) ||
  Boolean(indicator?.oilStatus) ||
  (Array.isArray(indicator?.concerns) && indicator.concerns.length > 0);

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

const isConcernLocked = (concern) => {
  if (!concern || typeof concern !== "object") return false;
  const status = (concern.status || "").toLowerCase();
  return status.includes("approved") || status.includes("declined") || status.includes("authorized");
};

const styles = vhcLayoutStyles;

// Status color mapping for consistency
const STATUS_COLORS = {
  "Outstanding": "var(--info)",
  "Accepted": "var(--primary)",
  "In Progress": "var(--info)",
  "Awaiting Authorization": "var(--warning)",
  "Authorized": "var(--accent-purple)",
  "Ready": "var(--info)",
  "Carry Over": "var(--danger)",
  "Complete": "var(--info)",
  "Sent": "var(--accent-purple)",
  "Viewed": "var(--info)",
};

const IN_PROGRESS_STATUS = "In Progress";
const WAITING_STATUS = "Waiting";
const STARTED_STATUS = "Started";
const PAUSE_ON_CLOCK_OUT_STATUSES = new Set([
  IN_PROGRESS_STATUS.toLowerCase(),
  STARTED_STATUS.toLowerCase(),
]);

// Format date and time helper
const formatDateTime = (date) => {
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "N/A";
  }
};

// Calculate hours worked helper
function calculateHoursWorked(clockInTime) {
  if (!clockInTime) return "0.0";
  const now = new Date();
  const clockIn = new Date(clockInTime);
  const hours = (now - clockIn) / (1000 * 60 * 60);
  return hours.toFixed(1);
}

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
  cancelled: { background: "var(--info-surface)", color: "var(--info)" },
};

const getPartsStatusStyle = (status) => {
  if (!status) return { background: "var(--info-surface)", color: "var(--info-dark)" };
  return PARTS_STATUS_STYLES[status.toLowerCase()] || { background: "var(--info-surface)", color: "var(--info-dark)" };
};

// Helper to get status after clock out
const getStatusAfterClockOut = (currentStatus) => {
  if (!currentStatus) return null;
  const normalized = currentStatus.trim().toLowerCase();
  if (PAUSE_ON_CLOCK_OUT_STATUSES.has(normalized)) {
    return WAITING_STATUS;
  }
  return null;
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
  const [vhcChecks, setVhcChecks] = useState([]);
  const [clockingStatus, setClockingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [showAdditionalContents, setShowAdditionalContents] = useState(false);
  const [jobClocking, setJobClocking] = useState(null);
  const [clockOutLoading, setClockOutLoading] = useState(false);
  const [clockInLoading, setClockInLoading] = useState(false);
  const [partsRequests, setPartsRequests] = useState([]);
  const [partsRequestsLoading, setPartsRequestsLoading] = useState(false);
  const [partRequestDescription, setPartRequestDescription] = useState("");
  const [partRequestQuantity, setPartRequestQuantity] = useState(1);
  const [partsSubmitting, setPartsSubmitting] = useState(false);
  const [partsFeedback, setPartsFeedback] = useState("");
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSubmitting, setNotesSubmitting] = useState(false);

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
      Miscellaneous: { concerns: [] },
    },
    underside: {
      "Exhaust System/Catalyst": { concerns: [] },
      Steering: { concerns: [] },
      "Front Suspension": { concerns: [] },
      "Rear Suspension": { concerns: [] },
      "Driveshafts/Oil Leaks": { concerns: [] },
      Miscellaneous: { concerns: [] },
    },
  });
  const [sectionStatus, setSectionStatus] = useState(createDefaultSectionStatus);
  const [activeSection, setActiveSection] = useState(null);
  const [isReopenMode, setIsReopenMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const saveTimeoutRef = useRef(null);
  const [showVhcSummary, setShowVhcSummary] = useState(false);
  const [showGreenItems, setShowGreenItems] = useState(false);

  const jobCardId = jobData?.jobCard?.id ?? null;
  const jobCardStatus = jobData?.jobCard?.status || "";
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
        const { data, error } = await supabase
          .from("parts_requests")
          .select(`
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
          `)
          .eq("job_id", targetJobId)
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        setPartsRequests(data || []);
      } catch (loadError) {
        console.error("❌ Failed to load parts requests:", loadError);
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
        console.error("❌ Failed to load notes:", error);
        setNotes([]);
      } finally {
        setNotesLoading(false);
      }
    },
    [jobCardId]
  );

  // ✅ FIXED: Define all useCallback hooks FIRST before any useEffect that uses them

  // Callback: Refresh clocking status
  const refreshClockingStatus = useCallback(async () => {
    if (!username) {
      setClockingStatus(null);
      return;
    }

    try {
      const { success, data } = await getClockingStatus(username);
      if (success) {
        setClockingStatus(data);
      } else {
        setClockingStatus(null);
      }
    } catch (error) {
      console.error("❌ Error refreshing clocking status:", error);
      setClockingStatus(null);
    }
  }, [username]);

  // Callback: Sync job status
  const syncJobStatus = useCallback(
    async (targetStatus, currentStatus) => {
      if (!targetStatus || !jobCardId) return null;

      const normalizedCurrent = (currentStatus || "").trim();
      if (!normalizedCurrent || normalizedCurrent === targetStatus) return null;

      try {
        const response = await updateJobStatus(jobCardId, targetStatus);
        if (response?.success && response.data) {
          setJobData((prev) => {
            if (!prev?.jobCard) return prev;
            return {
              ...prev,
              jobCard: {
                ...prev.jobCard,
                ...response.data,
              },
            };
          });
          return response.data;
        }
      } catch (error) {
        console.error("❌ syncJobStatus error:", error);
      }

      return null;
    },
    [jobCardId]
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
      console.error("❌ Failed to refresh job clocking", refreshError);
      setJobClocking(null);
    }
  }, [dbUserId, user?.id, jobCardId]);

  const fetchJobData = useCallback(async () => {
    if (!jobNumber) return;

    setLoading(true);
    try {
      const payload = await fetchJobcardDetails(jobNumber);
      const structured = payload?.structured;

      if (!structured?.jobCard) {
        alert("Job not found");
        router.push("/job-cards/myjobs");
        return;
      }

      setJobData(structured);

      const jobCardIdForFetch = structured.jobCard.id;
      if (jobCardIdForFetch) {
        const checks = await getVHCChecksByJob(jobCardIdForFetch);
        setVhcChecks(checks);
      } else {
        setVhcChecks([]);
        setNotes([]);
      }

      await refreshClockingStatus();
      await loadPartsRequests(jobCardIdForFetch);
      await loadNotes(jobCardIdForFetch);
    } catch (fetchError) {
      console.error("❌ Error fetching job:", fetchError);
      alert("Failed to load job");
    } finally {
      setLoading(false);
    }
  }, [jobNumber, router, refreshClockingStatus, loadPartsRequests, loadNotes]);

  useEffect(() => {
    fetchJobData();
  }, [fetchJobData]);

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
        filter: `job_id=eq.${jobCardId}`,
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
        alert(`✅ Clocked out from Job ${jobCardNumber}\n\nHours worked: ${result.hoursWorked}h`);
        setCurrentJob(null);
        const nextJob = await refreshCurrentJob();
        if (!nextJob) {
          setStatus("Waiting for Job");
        }
        setJobClocking(null);
        await refreshJobClocking();
        await refreshClockingStatus();
        const pausedStatus = getStatusAfterClockOut(jobData?.jobCard?.status);
        if (pausedStatus) {
          await syncJobStatus(pausedStatus, jobData?.jobCard?.status);
        }
      } else {
        alert(result.error || "Failed to clock out of this job.");
      }
    } catch (clockOutError) {
      console.error("❌ Error clocking out from job:", clockOutError);
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
    confirm,
  ]);

  // Callback: Handle job clock in
  const handleJobClockIn = useCallback(async () => {
    const workshopUserId = dbUserId ?? user?.id;
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
      const result = await clockInToJob(
        workshopUserId,
        jobCardId,
        jobCardNumber,
        "initial"
      );

      if (result.success) {
        alert(`✅ Clocked in to Job ${jobCardNumber}`);
        setStatus("In Progress");
        setCurrentJob(result.data);
        await refreshCurrentJob();
        setJobClocking(result.data);
        await refreshJobClocking();
        await refreshClockingStatus();
        await syncJobStatus(IN_PROGRESS_STATUS, jobData?.jobCard?.status);
      } else {
        alert(result.error || "Failed to clock in to this job.");
      }
    } catch (clockInError) {
      console.error("❌ Error clocking in to job:", clockInError);
      alert(clockInError.message || "Error clocking in. Please try again.");
    } finally {
      setClockInLoading(false);
    }
  }, [
    dbUserId,
    user?.id,
    jobCardId,
    jobCardNumber,
    jobClocking,
    setStatus,
    setCurrentJob,
    refreshCurrentJob,
    refreshJobClocking,
    refreshClockingStatus,
    syncJobStatus,
    jobData?.jobCard?.status,
  ]);

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
      const { error } = await supabase.from("parts_requests").insert({
        job_id: jobCardId,
        requested_by: requesterId,
        quantity: Math.max(1, Number(partRequestQuantity) || 1),
        description: trimmedDescription,
        status: "waiting_authorisation",
        source: "tech_request",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      setPartRequestDescription("");
      setPartRequestQuantity(1);
      setPartsFeedback("Part request submitted. Parts will review it alongside VHC items.");
      await fetchJobData();
    } catch (submitError) {
      console.error("❌ Failed to submit part request:", submitError);
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
    fetchJobData,
  ]);

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
        console.warn("⚠️ Cannot save VHC: No job number");
        return false;
      }
      try {
        console.log("💾 Saving VHC data for job:", jobNumber);
        setSaveStatus("saving");
        setSaveError("");

        // Include section status in the payload
        // Use updatedStatus if provided, otherwise use current sectionStatus
        const payloadWithStatus = {
          ...payload,
          _sectionStatus: updatedStatus || sectionStatus,
        };

        const result = await saveChecksheet(jobNumber, payloadWithStatus);
        if (result.success) {
          console.log("✅ VHC data saved successfully");
          setLastSavedAt(new Date());
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
        console.error("❌ VHC save failed:", result.error);
        setSaveStatus("error");
        setSaveError(result.error?.message || "Failed to save VHC data.");
        return false;
      } catch (err) {
        console.error("❌ Error saving VHC:", err);
        setSaveStatus("error");
        setSaveError(err.message || "Unexpected error saving VHC data.");
        return false;
      }
    },
    [jobNumber, sectionStatus]
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
      wheels.forEach(wheel => {
        const wheelData = vhcData.wheelsTyres[wheel];
        if (wheelData && Array.isArray(wheelData.concerns)) {
          wheelData.concerns.forEach(concern => {
            items.push({
              section: `Wheels & Tyres - ${wheel}`,
              status: (concern.status || "green").toLowerCase(),
              text: concern.text || concern.description || concern.issue || "No description",
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
          sides.forEach(side => {
            const padData = axleData.pad[side];
            if (padData && Array.isArray(padData.concerns)) {
              padData.concerns.forEach(concern => {
                items.push({
                  section: `Brakes & Hubs - ${side} Pad`,
                  status: (concern.status || "green").toLowerCase(),
                  text: concern.text || concern.description || concern.issue || "No description",
                });
              });
            }
          });
        }

        // Extract disc concerns
        if (axleData.disc) {
          sides.forEach(side => {
            const discData = axleData.disc[side];
            if (discData && Array.isArray(discData.concerns)) {
              discData.concerns.forEach(concern => {
                items.push({
                  section: `Brakes & Hubs - ${side} Disc`,
                  status: (concern.status || "green").toLowerCase(),
                  text: concern.text || concern.description || concern.issue || "No description",
                });
              });
            }
          });
        }
      });
    }

    // 3. SERVICE INDICATOR - Extract from serviceIndicator structure
    if (vhcData.serviceIndicator && typeof vhcData.serviceIndicator === "object") {
      if (Array.isArray(vhcData.serviceIndicator.concerns)) {
        vhcData.serviceIndicator.concerns.forEach(concern => {
          items.push({
            section: `Service Indicator - ${concern.source || "Under Bonnet"}`,
            status: (concern.status || "green").toLowerCase(),
            text: concern.text || concern.description || concern.issue || "No description",
          });
        });
      }
    }

    // 4. EXTERNAL INSPECTION - Extract from externalInspection array
    if (Array.isArray(vhcData.externalInspection)) {
      vhcData.externalInspection.forEach(category => {
        if (category && Array.isArray(category.concerns)) {
          category.concerns.forEach(concern => {
            items.push({
              section: `External - ${category.name || "General"}`,
              status: (concern.status || "green").toLowerCase(),
              text: concern.text || concern.description || concern.issue || "No description",
            });
          });
        }
      });
    }

    // 5. INTERNAL & ELECTRICS - Extract from internalElectrics object structure
    if (vhcData.internalElectrics && typeof vhcData.internalElectrics === "object") {
      Object.entries(vhcData.internalElectrics).forEach(([subsystem, subsystemData]) => {
        if (subsystemData && Array.isArray(subsystemData.concerns)) {
          subsystemData.concerns.forEach(concern => {
            items.push({
              section: `Internal & Electrics - ${subsystem}`,
              status: (concern.status || "green").toLowerCase(),
              text: concern.text || concern.description || concern.issue || "No description",
            });
          });
        }
      });
    }

    // 6. UNDERSIDE - Extract from underside object structure
    if (vhcData.underside && typeof vhcData.underside === "object") {
      Object.entries(vhcData.underside).forEach(([subsystem, subsystemData]) => {
        if (subsystemData && Array.isArray(subsystemData.concerns)) {
          subsystemData.concerns.forEach(concern => {
            items.push({
              section: `Underside - ${subsystem}`,
              status: (concern.status || "green").toLowerCase(),
              text: concern.text || concern.description || concern.issue || "No description",
            });
          });
        }
      });
    }

    // Categorize by status
    const buckets = { red: [], amber: [], green: [] };
    items.forEach(item => {
      const status = (item.status || "green").toLowerCase();
      if (status.includes("red") || status === "danger" || status === "critical") {
        buckets.red.push(item);
      } else if (status.includes("amber") || status === "advisory" || status === "warning") {
        buckets.amber.push(item);
      } else {
        buckets.green.push(item);
      }
    });

    return buckets;
  }, [vhcData]);

  const vhcSummaryItems = useMemo(() => extractVhcSummary(), [extractVhcSummary]);

  // Check if VHC can be completed (all mandatory sections done)
  const canCompleteVhc = useMemo(() => {
    const mandatoryComplete = MANDATORY_SECTION_KEYS.every(
      key => sectionStatus[key] === "complete"
    );
    return mandatoryComplete;
  }, [sectionStatus]);

  const showVhcReopenButton = VHC_REOPEN_ELIGIBLE_STATUSES.includes(jobCardStatus);

  const handleCompleteVhcClick = useCallback(async () => {
    if (!jobCardId) return;
    if (!showVhcReopenButton && !canCompleteVhc) return;

    const targetStatus = showVhcReopenButton ? VHC_REOPENED_STATUS : "VHC Complete";

    try {
      const updated = await syncJobStatus(targetStatus, jobCardStatus);
      if (updated) {
        if (targetStatus === "VHC Complete") {
          setIsReopenMode(true);
          setActiveTab("overview");
        } else {
          setIsReopenMode(false);
        }

        if (jobNumberForStatusFlow) {
          window.dispatchEvent(
            new CustomEvent("statusFlowRefresh", {
              detail: {
                jobNumber: String(jobNumberForStatusFlow),
                status: targetStatus,
              },
            })
          );
        }
      } else {
        console.warn("⚠️ Failed to update VHC status");
      }
    } catch (error) {
      console.error("❌ Error updating VHC status:", error);
    }
  }, [
    jobCardId,
    showVhcReopenButton,
    canCompleteVhc,
    syncJobStatus,
    jobCardStatus,
    setActiveTab,
    jobNumberForStatusFlow,
  ]);

  // ✅ NOW all useEffects come AFTER all callbacks are defined

  // Effect: Load VHC data when vhcChecks changes
  useEffect(() => {
    console.log("📥 Loading VHC data, checks count:", vhcChecks?.length || 0);

    if (!vhcChecks || vhcChecks.length === 0) {
      console.log("⚠️ No VHC checks found, initializing empty data");
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
          Miscellaneous: { concerns: [] },
        },
        underside: {
          "Exhaust System/Catalyst": { concerns: [] },
          Steering: { concerns: [] },
          "Front Suspension": { concerns: [] },
          "Rear Suspension": { concerns: [] },
          "Driveshafts/Oil Leaks": { concerns: [] },
          Miscellaneous: { concerns: [] },
        },
      });
      setSectionStatus(createDefaultSectionStatus());
      return;
    }

    const vhcChecksheet = vhcChecks.find(
      check => check.section === "VHC_CHECKSHEET" || check.section === "VHC Checksheet"
    );

    if (vhcChecksheet && vhcChecksheet.data) {
      console.log("✅ Found VHC checksheet data, loading...");
      setVhcData((prev) => ({
        ...prev,
        ...vhcChecksheet.data,
        serviceIndicator:
          vhcChecksheet.data.serviceIndicator || prev.serviceIndicator,
      }));
      setSectionStatus(deriveSectionStatusFromSavedData(vhcChecksheet.data));

      // Detect reopen mode
      const jobStatus = jobData?.jobCard?.status || "";
      setIsReopenMode(VHC_REOPEN_ELIGIBLE_STATUSES.includes(jobStatus));
    } else {
      console.log("⚠️ No VHC checksheet section found");
      setSectionStatus(createDefaultSectionStatus());
    }
  }, [vhcChecks, jobData]);

  // Effect: Refresh job clocking when jobCardId changes
  useEffect(() => {
    refreshJobClocking();
  }, [refreshJobClocking]);

  // Effect: Sync job status to "In Progress" when clocked in
  useEffect(() => {
    if (!jobClocking || !jobCardId) return;
    const currentStatus = jobData?.jobCard?.status;
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
    
    if (result) {
      alert("✅ Status updated successfully!");
      setJobData((prev) => {
        if (!prev?.jobCard) return prev;
        return {
          ...prev,
          jobCard: {
            ...prev.jobCard,
            status: newStatus,
          },
        };
      });

      const actionType = resolveNextActionType(newStatus);
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
          triggeredBy: user?.id || null,
        });
      }
    } else {
      alert("❌ Failed to update status");
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
        hidden_from_customer: true, // Default: hidden from customer
      });

      if (!result?.success) {
        throw new Error(result?.error?.message || "Unable to save note");
      }

      setNewNote("");
      setShowAddNote(false);
      await loadNotes(jobCardId);
    } catch (error) {
      console.error("❌ Failed to add note:", error);
      alert(error?.message || "Failed to add note");
    } finally {
      setNotesSubmitting(false);
    }
  };

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
    if (VHC_REOPEN_ELIGIBLE_STATUSES.includes(jobCardStatus)) {
      return "🔄 Reopen VHC";
    }

    // In progress - checks exist but not complete
    if (vhcChecks.length > 0) {
      return "📋 VHC in Progress";
    }

    // Fresh start - no checks exist
    return "🚀 Start VHC";
  };

  // Helper: Get VHC button color based on state
  const getVhcButtonColor = () => {
    if (!jobData?.jobCard?.vhcRequired) return "var(--surface-light)";

    if (VHC_REOPEN_ELIGIBLE_STATUSES.includes(jobCardStatus)) {
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

    if (VHC_REOPEN_ELIGIBLE_STATUSES.includes(jobCardStatus)) {
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
      check => check.section === "VHC_CHECKSHEET" || check.section === "VHC Checksheet"
    );

    if (!vhcChecksheet || !vhcChecksheet.data) {
      return { red: [], amber: [], green: [] };
    }

    const data = vhcChecksheet.data;

    // 1. EXTRACT TYRE MEASUREMENTS
    if (data.wheelsTyres) {
      const wheels = ["NSF", "OSF", "NSR", "OSR"];
      wheels.forEach(wheel => {
        const wheelData = data.wheelsTyres[wheel];
        if (wheelData && wheelData.tread) {
          const { outer, middle, inner } = wheelData.tread;

          const measurements = [outer, middle, inner].filter(Boolean).map(Number);
          if (measurements.length > 0) {
            const minTread = Math.min(...measurements);
            let status = "green";
            if (minTread < 1.6) status = "red";
            else if (minTread < 3.0) status = "amber";

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
          wheelData.concerns.forEach(concern => {
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

      data.brakesHubs.forEach(axleData => {
        if (!axleData) return;

        // Extract pad measurements
        if (axleData.pad) {
          sides.forEach(side => {
            const padData = axleData.pad[side];
            if (padData && padData.measurement) {
              const measurement = Number(padData.measurement);
              let status = "green";
              if (measurement < 2) status = "red";
              else if (measurement < 4) status = "amber";

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
              padData.concerns.forEach(concern => {
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
          sides.forEach(side => {
            const discData = axleData.disc[side];
            if (discData && discData.measurement) {
              const measurement = Number(discData.measurement);
              let status = "green";
              if (measurement < 22) status = "red";
              else if (measurement < 25) status = "amber";

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
              discData.concerns.forEach(concern => {
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
          status: si.oilStatus === "No" ? "red" : "green",
          type: "info"
        });
      }

      if (Array.isArray(si.concerns)) {
        si.concerns.forEach(concern => {
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
      { key: 'underside', name: 'Underside' }
    ];

    sections.forEach(({ key, name }) => {
      if (data[key]) {
        const sectionData = data[key];

        if (Array.isArray(sectionData)) {
          sectionData.forEach(category => {
            if (category && Array.isArray(category.concerns)) {
              category.concerns.forEach(concern => {
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
              subsystemData.concerns.forEach(concern => {
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
    items.forEach(item => {
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
  const userRoles = Array.isArray(user?.roles)
    ? user.roles
    : user?.role
      ? [user.role]
      : [];
  const hasRoleAccess = userRoles.some((roleName) => {
    const normalized = String(roleName).toLowerCase();
    return normalized.includes("tech") || normalized.includes("mot");
  });
  const isTech =
    (username && allowedTechNames.has(username)) || hasRoleAccess;

  // Access check - only technicians can view this page
  if (!isTech) {
    return (
      <Layout jobNumber={jobNumber}>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2 style={{ color: "var(--primary)" }}>Access Denied</h2>
          <p>This page is only for Technicians.</p>
        </div>
      </Layout>
    );
  }

  // Loading state with spinner animation
  if (loading) {
    return (
      <Layout jobNumber={jobNumber}>
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
          <p style={{ color: "var(--grey-accent)" }}>Loading job...</p>
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

  // Handle case where job is not found
  if (!jobData?.jobCard) {
    return (
      <Layout jobNumber={jobNumber}>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2 style={{ color: "var(--primary)" }}>Job Not Found</h2>
          <button
            onClick={() => router.push("/job-cards/myjobs")}
            style={{
              padding: "12px 24px",
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              marginTop: "20px"
            }}
          >
            Back to My Jobs
          </button>
        </div>
      </Layout>
    );
  }

  // Extract job data
  const { jobCard, customer, vehicle } = jobData;
  const jobRequiresVhc = jobCard?.vhcRequired === true;
  const jobStatusDisplay = jobCardStatus || "Unknown";
  const jobStatusColor = STATUS_COLORS[jobCardStatus] || "var(--info)";
  const partsCount = jobCard.partsRequests?.length || 0;
  const clockedHours = clockingStatus?.clock_in
    ? `${calculateHoursWorked(clockingStatus.clock_in)}h`
    : "0.0h";

  // Quick stats data for display
  const quickStats = [
    {
      label: "Status",
      value: jobStatusDisplay,
      accent: jobStatusColor,
      pill: true,
    },
    {
      label: "Job Type",
      value: jobCard.type || "General",
      accent: "var(--info-dark)",
      pill: false,
    },
    {
      label: "VHC Checks",
      value: vhcChecks.length,
      accent: "var(--info-dark)",
      pill: false,
    },
    {
      label: "Parts Requests",
      value: partsCount,
      accent: "var(--danger)",
      pill: false,
    },
    {
      label: "Clocked Hours",
      value: clockedHours,
      accent: "var(--success)",
      pill: false,
    },
  ];

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
    writeUp.fault ||
    writeUp.work_performed ||
    writeUp.job_description_snapshot ||
    "";
  const causeText =
    writeUp.caused ||
    writeUp.cause ||
    writeUp.recommendations ||
    writeUp.recommendation ||
    "";
  const rectificationText =
    writeUp.rectification ||
    writeUp.rectification_notes ||
    writeUp.ratification ||
    "";
  const writeUpCompletion =
    typeof writeUp.completion_status === "string"
      ? writeUp.completion_status.toLowerCase()
      : "";
  const rectificationsComplete = writeUpCompletion === "complete";
  const writeUpComplete =
    Boolean(faultText?.trim()) &&
    Boolean(causeText?.trim()) &&
    Boolean(rectificationText?.trim()) &&
    rectificationsComplete;

  const isVhcComplete =
    !jobRequiresVhc || VHC_COMPLETED_STATUSES.includes(jobCardStatus);

  const canCompleteJob = writeUpComplete && isVhcComplete;

  const handleCompleteJob = async () => {
    if (!canCompleteJob) return;
    await syncJobStatus("Tech Complete", jobCardStatus);
  };

  if (rosterLoading) {
    return (
      <Layout jobNumber={jobNumber}>
        <div style={{ padding: "24px", color: "var(--info)" }}>Loading roster…</div>
      </Layout>
    );
  }

  return (
    <Layout jobNumber={jobNumber}>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "8px 16px",
          overflowY: "auto",
          gap: "12px",
        }}
      >
        
        {/* Header Section */}
        <div style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          marginBottom: "12px",
          padding: "12px",
          backgroundColor: "var(--surface)",
          borderRadius: "8px",
          flexShrink: 0
        }}>
          <button
            onClick={() => router.push("/job-cards/myjobs")}
            style={{
              padding: "10px 24px",
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--danger-dark)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--primary)")}
          >
            ← Back
          </button>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
            <h1 style={{
              color: "var(--primary)",
              fontSize: "28px",
              fontWeight: "700",
              margin: "0"
            }}>
              Job #{jobCard.jobNumber}
            </h1>
            <p style={{ color: "var(--grey-accent)", fontSize: "14px", margin: 0 }}>
              {customer.firstName} {customer.lastName} • {vehicle.reg} • {vehicle.makeModel}
            </p>
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--surface-light)",
            borderRadius: "12px",
            padding: "10px 18px"
          }}>
            <span style={{
              backgroundColor: jobStatusColor,
              padding: "6px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              letterSpacing: "0.02em",
              color: "white",
              fontWeight: "600"
            }}>
              {jobCard.status}
            </span>
            <span style={{ fontSize: "12px", color: "var(--info)" }}>
              Updated {formatDateTime(jobCard.updatedAt)}
            </span>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: "12px",
          marginBottom: "12px",
          flexShrink: 0
        }}>
          {quickStats.map((stat) => (
            <div
              key={stat.label}
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--surface-light)",
                borderRadius: "8px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "108px"
              }}
            >
              <div style={{
                fontSize: stat.pill ? "15px" : "24px",
                fontWeight: "700",
                color: stat.accent,
                backgroundColor: stat.pill ? `${stat.accent}15` : "transparent",
                padding: stat.pill ? "6px 14px" : 0,
                borderRadius: stat.pill ? "999px" : 0,
                letterSpacing: stat.pill ? "0.04em" : 0,
                textTransform: stat.pill ? "uppercase" : "none"
              }}>
                {stat.value}
              </div>
              <span style={{ fontSize: "12px", color: "var(--info)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Tabs Navigation */}
        <div style={{
          display: "flex",
          gap: "12px",
          marginBottom: "12px",
          overflowX: "auto",
          paddingBottom: "4px",
          flexShrink: 0
        }}>
          {["overview", "vhc", "parts", "notes", "write-up"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 18px",
                backgroundColor: activeTab === tab ? "var(--primary)" : "var(--surface-light)",
                color: activeTab === tab ? "var(--text-inverse)" : "var(--text-primary)",
                border: activeTab === tab ? "2px solid var(--primary)" : "1px solid var(--border)",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: activeTab === tab ? "600" : "500",
                textTransform: "capitalize",
                transition: "all 0.2s",
                whiteSpace: "nowrap"
              }}
            >
              {tab.replace("-", " ")}
            </button>
          ))}
        </div>

        {/* Main Content Area with Scrolling */}
        <div
          style={{
            flex: 1,
            borderRadius: "8px",
            border: "1px solid var(--surface-light)",
            background: "var(--surface)",
            padding: "24px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          
          <div style={{ flex: 1, overflowY: "auto", paddingRight: "8px", minHeight: 0 }}>
          
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Job Details */}
              <div style={{
                backgroundColor: "var(--surface)",
                padding: "24px",
                borderRadius: "12px",
                border: "1px solid var(--surface-light)"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
                  Job Details
                </h3>
                {jobCard.requests && jobCard.requests.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <strong style={{ fontSize: "14px", color: "var(--info)", letterSpacing: "0.04em" }}>Customer Requests:</strong>
                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      {jobCard.requests.map((req, i) => (
                        <div key={i} style={{
                          padding: "14px 16px",
                          backgroundColor: "var(--surface-light)",
                          borderLeft: "4px solid var(--primary)",
                          borderRadius: "10px",
                          color: "var(--info-dark)",
                        }}>
                          {req.text || req}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {jobCard.cosmeticNotes && (
                  <div>
                    <strong style={{ fontSize: "14px", color: "var(--info)", letterSpacing: "0.04em" }}>Cosmetic Notes:</strong>
                    <p style={{ marginTop: "10px", color: "var(--info-dark)", lineHeight: 1.6 }}>{jobCard.cosmeticNotes}</p>
                  </div>
                )}
              </div>

              {/* Vehicle Info */}
              <div style={{
                backgroundColor: "var(--surface)",
                padding: "24px",
                borderRadius: "12px",
                border: "1px solid var(--surface-light)"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
                  Vehicle Information
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                  <div>
                    <span style={{ fontSize: "13px", color: "var(--grey-accent)" }}>Registration:</span>
                    <p style={{ fontSize: "16px", fontWeight: "600", color: "var(--primary)", margin: "4px 0 0 0" }}>
                      {vehicle.reg}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: "13px", color: "var(--grey-accent)" }}>Make & Model:</span>
                    <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                      {vehicle.makeModel}
                    </p>
                  </div>
                  {vehicle.mileage && (
                    <div>
                      <span style={{ fontSize: "13px", color: "var(--grey-accent)" }}>Mileage:</span>
                      <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                        {vehicle.mileage.toLocaleString()} miles
                      </p>
                    </div>
                  )}
                  {vehicle.colour && (
                    <div>
                      <span style={{ fontSize: "13px", color: "var(--grey-accent)" }}>Colour:</span>
                      <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                        {vehicle.colour}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Info */}
              <div style={{
                backgroundColor: "var(--surface)",
                padding: "24px",
                borderRadius: "12px",
                border: "1px solid var(--surface-light)"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
                  Customer Information
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                  <div>
                    <span style={{ fontSize: "13px", color: "var(--grey-accent)" }}>Name:</span>
                    <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                      {customer.firstName} {customer.lastName}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: "13px", color: "var(--grey-accent)" }}>Mobile:</span>
                    <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                      {customer.mobile}
                    </p>
                  </div>
                  {customer.email && (
                    <div>
                      <span style={{ fontSize: "13px", color: "var(--grey-accent)" }}>Email:</span>
                      <p style={{ fontSize: "16px", fontWeight: "600", color: "var(--info)", margin: "4px 0 0 0" }}>
                        {customer.email}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VHC TAB */}
          {activeTab === "vhc" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%" }}>

              {/* VHC Header with Save Status */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                backgroundColor: "var(--accent-purple-surface)",
                borderRadius: "12px",
                border: "1px solid var(--accent-purple)"
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "var(--accent-purple)" }}>
                    Vehicle Health Check
                  </h2>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--info)" }}>
                    Complete mandatory sections to finish VHC
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {saveStatus === "saving" && (
                    <span style={{ fontSize: "13px", color: "var(--info)" }}>💾 Saving...</span>
                  )}
                  {saveStatus === "saved" && (
                    <span style={{ fontSize: "13px", color: "var(--success)" }}>✅ Saved</span>
                  )}
                  {saveStatus === "error" && (
                    <span style={{ fontSize: "13px", color: "var(--danger)" }}>❌ {saveError || "Save failed"}</span>
                  )}
                  {lastSavedAt && (
                    <span style={{ fontSize: "12px", color: "var(--info)" }}>
                      Last saved: {formatDateTime(lastSavedAt)}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleCompleteVhcClick}
                    disabled={!showVhcReopenButton && !canCompleteVhc}
                    style={{
                      padding: "10px 18px",
                      borderRadius: "999px",
                      border: "1px solid var(--accent-purple)",
                      backgroundColor:
                        showVhcReopenButton || !canCompleteVhc
                          ? "transparent"
                          : "var(--accent-purple)",
                      color: showVhcReopenButton
                        ? "var(--accent-purple)"
                        : canCompleteVhc
                        ? "var(--surface)"
                        : "var(--accent-purple)",
                      fontWeight: 600,
                      fontSize: "13px",
                      cursor:
                        showVhcReopenButton || canCompleteVhc ? "pointer" : "not-allowed",
                      opacity: showVhcReopenButton || canCompleteVhc ? 1 : 0.5,
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!showVhcReopenButton && !canCompleteVhc) return;
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 6px 16px rgba(var(--info-rgb),0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(var(--info-rgb),0.3)";
                    }}
                    title={
                      showVhcReopenButton
                        ? "Reopen the Vehicle Health Check to make additional changes"
                        : canCompleteVhc
                        ? "Mark the Vehicle Health Check as complete"
                        : "Complete all mandatory sections to finish the VHC"
                    }
                  >
                    {showVhcReopenButton ? "Reopen" : "✓ Complete VHC"}
                  </button>

                  {/* Camera Button - Always visible for technicians */}
                  {jobNumber && (
                    <VhcCameraButton
                      jobNumber={jobNumber}
                      userId={dbUserId || user?.id}
                      onUploadComplete={() => {
                        console.log("📷 VHC media uploaded, refreshing job data...");
                        loadJobData();
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Mandatory Sections */}
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", color: "var(--accent-purple)" }}>
                  Mandatory Sections
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>

                  {/* Wheels & Tyres */}
                  <div style={{
                    backgroundColor: "var(--surface)",
                    border: `2px solid ${getBadgeState(sectionStatus.wheelsTyres).border}`,
                    borderRadius: "12px",
                    padding: "20px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => openSection("wheelsTyres")}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "var(--accent-purple)" }}>
                        🛞 Wheels & Tyres
                      </h4>
                      <span style={{
                        ...getBadgeState(sectionStatus.wheelsTyres),
                        padding: "4px 12px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}>
                        {sectionStatus.wheelsTyres}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--info)" }}>
                      Check tread depth, pressure, and condition
                    </p>
                  </div>

                  {/* Brakes & Hubs */}
                  <div style={{
                    backgroundColor: "var(--surface)",
                    border: `2px solid ${getBadgeState(sectionStatus.brakesHubs).border}`,
                    borderRadius: "12px",
                    padding: "20px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => openSection("brakesHubs")}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "var(--accent-purple)" }}>
                        🔧 Brakes & Hubs
                      </h4>
                      <span style={{
                        ...getBadgeState(sectionStatus.brakesHubs),
                        padding: "4px 12px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}>
                        {sectionStatus.brakesHubs}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--info)" }}>
                      Check pads, discs, and brake system
                    </p>
                  </div>

                  {/* Service Indicator & Under Bonnet */}
                  <div style={{
                    backgroundColor: "var(--surface)",
                    border: `2px solid ${getBadgeState(sectionStatus.serviceIndicator).border}`,
                    borderRadius: "12px",
                    padding: "20px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => openSection("serviceIndicator")}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "var(--accent-purple)" }}>
                        🔍 Service Indicator & Under Bonnet
                      </h4>
                      <span style={{
                        ...getBadgeState(sectionStatus.serviceIndicator),
                        padding: "4px 12px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}>
                        {sectionStatus.serviceIndicator}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--info)" }}>
                      Service reminder, oil level, under bonnet items
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Checks (Optional) */}
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", color: "var(--info)" }}>
                  Additional Checks
                  <span style={{ fontSize: "12px", fontWeight: "normal", marginLeft: "8px", color: "var(--grey-accent)" }}>
                    (Optional)
                  </span>
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>

                  {/* External */}
                  <div style={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--accent-purple-surface)",
                    borderRadius: "12px",
                    padding: "20px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => openSection("externalInspection")}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "var(--info)" }}>
                        🚗 External
                      </h4>
                      {getOptionalCount("externalInspection") > 0 && (
                        <span style={{
                          backgroundColor: "var(--info-surface)",
                          color: "var(--info)",
                          padding: "4px 12px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: "600"
                        }}>
                          {getOptionalCount("externalInspection")} items
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--info)" }}>
                      Body, lights, glass, mirrors
                    </p>
                  </div>

                  {/* Internal & Electrics */}
                  <div style={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--accent-purple-surface)",
                    borderRadius: "12px",
                    padding: "20px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => openSection("internalElectrics")}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "var(--info)" }}>
                        💡 Internal & Electrics
                      </h4>
                      {getOptionalCount("internalElectrics") > 0 && (
                        <span style={{
                          backgroundColor: "var(--info-surface)",
                          color: "var(--info)",
                          padding: "4px 12px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: "600"
                        }}>
                          {getOptionalCount("internalElectrics")} items
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--info)" }}>
                      Interior, lights, electrics, controls
                    </p>
                  </div>

                  {/* Underside */}
                  <div style={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--accent-purple-surface)",
                    borderRadius: "12px",
                    padding: "20px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => openSection("underside")}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "var(--info)" }}>
                        ⚙️ Underside
                      </h4>
                      {getOptionalCount("underside") > 0 && (
                        <span style={{
                          backgroundColor: "var(--info-surface)",
                          color: "var(--info)",
                          padding: "4px 12px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: "600"
                        }}>
                          {getOptionalCount("underside")} items
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--info)" }}>
                      Exhaust, suspension, steering, driveshafts
                    </p>
                  </div>
                </div>
              </div>

              {/* VHC Summary */}
              <div style={{
                backgroundColor: "var(--info-surface)",
                border: "1px solid var(--info)",
                borderRadius: "12px",
                padding: "20px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "var(--info)" }}>
                    📋 VHC Summary
                    <span style={{ fontSize: "12px", fontWeight: "normal", marginLeft: "8px" }}>
                      Review all items reported across sections
                    </span>
                  </h3>
                  <button
                    onClick={() => setShowVhcSummary(!showVhcSummary)}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "var(--info)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600"
                    }}
                  >
                    {showVhcSummary ? "Hide" : "Show"} Summary
                  </button>
                </div>

                {showVhcSummary && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Red Items */}
                    {vhcSummaryItems.red.length > 0 && (
                      <div>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "8px",
                          padding: "8px 12px",
                          backgroundColor: "var(--danger-surface)",
                          borderRadius: "8px"
                        }}>
                          <span style={{ fontSize: "16px" }}>🔴</span>
                          <strong style={{ fontSize: "14px", color: "var(--danger)" }}>
                            Critical Issues ({vhcSummaryItems.red.length})
                          </strong>
                        </div>
                        {vhcSummaryItems.red.map((item, idx) => (
                          <div key={idx} style={{
                            padding: "12px 16px",
                            backgroundColor: "var(--surface)",
                            borderLeft: "4px solid var(--danger)",
                            borderRadius: "8px",
                            marginBottom: "8px"
                          }}>
                            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--danger)", marginBottom: "4px" }}>
                              {item.section}
                            </div>
                            <div style={{ fontSize: "13px", color: "var(--info-dark)" }}>
                              {item.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Amber Items */}
                    {vhcSummaryItems.amber.length > 0 && (
                      <div>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "8px",
                          padding: "8px 12px",
                          backgroundColor: "var(--warning-surface)",
                          borderRadius: "8px"
                        }}>
                          <span style={{ fontSize: "16px" }}>🟡</span>
                          <strong style={{ fontSize: "14px", color: "var(--warning)" }}>
                            Advisory Items ({vhcSummaryItems.amber.length})
                          </strong>
                        </div>
                        {vhcSummaryItems.amber.map((item, idx) => (
                          <div key={idx} style={{
                            padding: "12px 16px",
                            backgroundColor: "var(--surface)",
                            borderLeft: "4px solid var(--warning)",
                            borderRadius: "8px",
                            marginBottom: "8px"
                          }}>
                            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--warning)", marginBottom: "4px" }}>
                              {item.section}
                            </div>
                            <div style={{ fontSize: "13px", color: "var(--info-dark)" }}>
                              {item.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Green Items (Toggle) */}
                    {vhcSummaryItems.green.length > 0 && (
                      <div>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "8px",
                          padding: "8px 12px",
                          backgroundColor: "var(--success-surface)",
                          borderRadius: "8px",
                          cursor: "pointer"
                        }}
                        onClick={() => setShowGreenItems(!showGreenItems)}
                        >
                          <span style={{ fontSize: "16px" }}>🟢</span>
                          <strong style={{ fontSize: "14px", color: "var(--success)" }}>
                            OK Items ({vhcSummaryItems.green.length})
                          </strong>
                          <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--info)" }}>
                            {showGreenItems ? "Hide" : "Show"}
                          </span>
                        </div>
                        {showGreenItems && vhcSummaryItems.green.map((item, idx) => (
                          <div key={idx} style={{
                            padding: "12px 16px",
                            backgroundColor: "var(--surface)",
                            borderLeft: "4px solid var(--success)",
                            borderRadius: "8px",
                            marginBottom: "8px"
                          }}>
                            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--success)", marginBottom: "4px" }}>
                              {item.section}
                            </div>
                            <div style={{ fontSize: "13px", color: "var(--info-dark)" }}>
                              {item.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {vhcSummaryItems.red.length === 0 && vhcSummaryItems.amber.length === 0 && vhcSummaryItems.green.length === 0 && (
                      <p style={{ margin: 0, fontSize: "14px", color: "var(--info)", textAlign: "center", padding: "20px" }}>
                        No items reported yet. Complete the VHC sections to add items.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* VHC Modals */}
              {activeSection === "wheelsTyres" && (
                <WheelsTyresDetailsModal
                  isOpen={true}
                  onClose={(data) => handleSectionDismiss("wheelsTyres", data)}
                  onComplete={(data) => handleSectionComplete("wheelsTyres", data)}
                  initialData={vhcData.wheelsTyres}
                  isReopenMode={isReopenMode}
                />
              )}

              {activeSection === "brakesHubs" && (
                <BrakesHubsDetailsModal
                  isOpen={true}
                  onClose={(data) => handleSectionDismiss("brakesHubs", data)}
                  onComplete={(data) => handleSectionComplete("brakesHubs", data)}
                  initialData={vhcData.brakesHubs}
                  isReopenMode={isReopenMode}
                />
              )}

              {activeSection === "serviceIndicator" && (
                <ServiceIndicatorDetailsModal
                  isOpen={true}
                  onClose={(data) => handleSectionDismiss("serviceIndicator", data)}
                  onComplete={(data) => handleSectionComplete("serviceIndicator", data)}
                  initialData={vhcData.serviceIndicator}
                  isReopenMode={isReopenMode}
                />
              )}

              {activeSection === "externalInspection" && (
                <ExternalDetailsModal
                  isOpen={true}
                  onClose={(data) => handleSectionDismiss("externalInspection", data)}
                  onComplete={(data) => handleSectionComplete("externalInspection", data)}
                  initialData={vhcData.externalInspection}
                  isReopenMode={isReopenMode}
                />
              )}

              {activeSection === "internalElectrics" && (
                <InternalElectricsDetailsModal
                  isOpen={true}
                  onClose={(data) => handleSectionDismiss("internalElectrics", data)}
                  onComplete={(data) => handleSectionComplete("internalElectrics", data)}
                  initialData={vhcData.internalElectrics}
                  isReopenMode={isReopenMode}
                />
              )}

              {activeSection === "underside" && (
                <UndersideDetailsModal
                  isOpen={true}
                  onClose={(data) => handleSectionDismiss("underside", data)}
                  onComplete={(data) => handleSectionComplete("underside", data)}
                  initialData={vhcData.underside}
                  isReopenMode={isReopenMode}
                />
              )}
            </div>
          )}

          {/* PARTS TAB */}
          {activeTab === "parts" && (
            <div style={{
              backgroundColor: "var(--surface)",
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid var(--surface-light)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              alignItems: "stretch"
            }}>
              <div style={{
                backgroundColor: "var(--warning-surface)",
                borderRadius: "12px",
                border: "1px solid var(--warning)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--warning)" }}>
                    Request a Part
                  </h3>
                  <span style={{ fontSize: "12px", color: "var(--danger-dark)" }}>
                    Surfaces in the VHC parts queue
                  </span>
                </div>
                <p style={{ margin: 0, color: "var(--info)", fontSize: "14px" }}>
                  Describe the specific part you need—the parts team will price, approve, and pre-pick it alongside other VHC requests.
                </p>
                <textarea
                  rows={3}
                  value={partRequestDescription}
                  onChange={(e) => {
                    setPartRequestDescription(e.target.value);
                    if (partsFeedback) {
                      setPartsFeedback("");
                    }
                  }}
                  placeholder="e.g. Front right brake pad set (OEM) for MK3 1.6 diesel."
                  style={{
                    width: "100%",
                    borderRadius: "10px",
                    border: "1px solid var(--accent-purple-surface)",
                    padding: "12px",
                    fontSize: "14px",
                    resize: "vertical",
                    minHeight: "88px",
                    fontFamily: "inherit",
                    outline: "none"
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--warning)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent-purple-surface)";
                  }}
                />
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", flexDirection: "column", fontSize: "12px", color: "var(--info)" }}>
                    Quantity
                    <input
                      type="number"
                      min={1}
                      value={partRequestQuantity}
                      onChange={(e) => {
                        let next = Number(e.target.value);
                        if (Number.isNaN(next) || next < 1) next = 1;
                        setPartRequestQuantity(next);
                      }}
                      style={{
                        marginTop: "4px",
                        width: "80px",
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: "1px solid var(--accent-purple-surface)",
                        fontSize: "14px"
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handlePartsRequestSubmit}
                    disabled={partsSubmitting}
                    style={{
                      padding: "10px 22px",
                      backgroundColor: partsSubmitting ? "var(--border)" : "var(--warning)",
                      color: "white",
                      border: "none",
                      borderRadius: "10px",
                      cursor: partsSubmitting ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    {partsSubmitting ? "Submitting…" : "Request Part"}
                  </button>
                </div>
                {partsFeedback && (
                  <div style={{
                    fontSize: "13px",
                    color: "var(--info-dark)",
                    backgroundColor: "var(--success-surface)",
                    borderRadius: "8px",
                    padding: "10px 14px"
                  }}>
                    {partsFeedback}
                  </div>
                )}
              </div>

              <div style={{
                backgroundColor: "var(--surface)",
                borderRadius: "12px",
                border: "1px solid var(--accent-purple-surface)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px" }}>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>Active Requests</h3>
                  <span style={{ fontSize: "12px", color: "var(--info)" }}>
                    {partsRequests.length} request{partsRequests.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--info)" }}>
                  These entries are visible to the parts team in the VHC parts tab for pricing, approval, and pre-picks.
                </p>
                {partsRequestsLoading ? (
                  <p style={{ margin: 0, fontSize: "14px", color: "var(--info)" }}>Loading requests…</p>
                ) : partsRequests.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "14px", color: "var(--info)" }}>
                    No parts have been requested yet.
                  </p>
                ) : (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    maxHeight: "340px",
                    overflowY: "auto",
                    paddingRight: "4px"
                  }}>
                    {partsRequests.map((request) => {
                      const statusLabel = (request.status || "pending").replace(/_/g, " ").toUpperCase();
                      const badgeStyle = getPartsStatusStyle(request.status);
                      const quantity = request.quantity ?? 1;
                      const partLabel = request.part
                        ? `${request.part.partNumber || "#"} • ${request.part.name || "Unnamed part"}`
                        : `Custom request #${request.request_id}`;
                      const requesterName = request.requester
                        ? `${request.requester.first_name || ""} ${request.requester.last_name || ""}`.trim()
                        : "";
                      const sourceLabel = request.requested_by
                        ? `Tech${requesterName ? ` (${requesterName})` : ""}`
                        : "VHC";

                      return (
                        <div
                          key={request.request_id}
                          style={{
                            padding: "16px",
                            border: "1px solid var(--accent-purple-surface)",
                            borderRadius: "10px",
                            backgroundColor: "var(--accent-purple-surface)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px"
                          }}
                        >
                          <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "12px"
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--accent-purple)" }}>
                                {partLabel}
                              </div>
                              <div style={{ fontSize: "13px", color: "var(--info-dark)", marginTop: "2px" }}>
                                {request.description || "No description provided."}
                              </div>
                              <div style={{ fontSize: "12px", color: "var(--info)", marginTop: "4px" }}>
                                Requested by {sourceLabel}
                              </div>
                              <div style={{ fontSize: "12px", color: "var(--info)", marginTop: "4px" }}>
                                Requested {formatDateTime(request.created_at)}
                              </div>
                            </div>
                            <span style={{
                              ...badgeStyle,
                              padding: "4px 14px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: "600"
                            }}>
                              {statusLabel}
                            </span>
                          </div>
                          <div style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            alignItems: "center",
                            gap: "12px",
                            fontSize: "13px",
                            color: "var(--info)"
                          }}>
                            <span>Qty: {quantity}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NOTES TAB */}
          {activeTab === "notes" && (
            <div style={{
              backgroundColor: "var(--surface)",
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid var(--surface-light)",
              display: "flex",
              flexDirection: "column",
              gap: "20px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>
                  Technician Notes
                </h3>
                <span style={{ fontSize: "13px", color: "var(--info)" }}>
                  {notes.length} note{notes.length === 1 ? "" : "s"}
                </span>
                <button
                  onClick={() => setShowAddNote(true)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    border: "1px solid var(--danger)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}
                >
                  + Add Note
                </button>
              </div>

              {showAddNote && (
                <div style={{
                  padding: "20px",
                  backgroundColor: "var(--surface-light)",
                  borderRadius: "12px",
                  border: "1px solid var(--surface-light)"
                }}>
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note about the job..."
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      border: "1px solid var(--danger)",
                      borderRadius: "10px",
                      resize: "vertical",
                      minHeight: "110px",
                      fontSize: "14px",
                      marginBottom: "12px",
                      backgroundColor: "var(--surface)"
                    }}
                  />
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setShowAddNote(false)}
                      style={{
                        padding: "10px 18px",
                        backgroundColor: "var(--surface)",
                        color: "var(--info)",
                        border: "1px solid var(--info)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "500"
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddNote}
                      disabled={notesSubmitting}
                      style={{
                        padding: "10px 18px",
                        backgroundColor: notesSubmitting ? "var(--border)" : "var(--info)",
                        color: "white",
                        border: "1px solid var(--info-dark)",
                        borderRadius: "8px",
                        cursor: notesSubmitting ? "not-allowed" : "pointer",
                        fontSize: "14px",
                        fontWeight: "600",
                      }}
                    >
                      {notesSubmitting ? "Saving..." : "Save Note"}
                    </button>
                  </div>
                </div>
              )}

              {notesLoading ? (
                <div style={{
                  padding: "32px",
                  textAlign: "center",
                  color: "var(--info)"
                }}>
                  Loading notes…
                </div>
              ) : notes.length === 0 ? (
                <div style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "var(--info)",
                  backgroundColor: "var(--surface-light)",
                  borderRadius: "12px",
                  border: "1px solid var(--surface-light)"
                }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>📝</div>
                  <p style={{ fontSize: "16px", fontWeight: "600", marginBottom: "4px" }}>No notes added yet</p>
                  <p style={{ fontSize: "14px", color: "var(--info)" }}>
                    Keep technicians aligned by logging progress, issues and next steps.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {notes.map((note) => {
                    const noteId = note.noteId || note.note_id || note.id;
                    const creatorName = note.createdBy || "Unknown";
                    const createdAt = formatDateTime(note.createdAt || note.created_at);
                    const updatedLabel =
                      note.updatedAt && note.updatedAt !== note.createdAt
                        ? ` • Updated ${formatDateTime(note.updatedAt)}`
                        : "";
                    return (
                      <div
                        key={noteId}
                        style={{
                          border: "1px solid var(--surface-light)",
                          borderRadius: "10px",
                          padding: "16px",
                          backgroundColor: "var(--surface-light)"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                          <div style={{ fontWeight: 600 }}>{creatorName}</div>
                          <div style={{ fontSize: "12px", color: "var(--info)" }}>
                            {createdAt}
                            {updatedLabel}
                          </div>
                        </div>
                        <p style={{ margin: 0, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
                          {note.noteText || note.note_text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* WRITE-UP TAB */}
          {activeTab === "write-up" && (
            <div style={{
              height: "100%",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column"
            }}>
              <WriteUpForm jobNumber={jobNumber} showHeader={false} />
            </div>
          )}
        </div>
        </div>

        {/* Bottom Action Bar */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "2px solid var(--surface-light)",
          flexShrink: 0
        }}>
          {/* Back to My Jobs Button */}
          <button
            onClick={() => router.push("/job-cards/myjobs")}
            style={{
              padding: "14px",
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            ← Back to My Jobs
          </button>

          {/* Clock Action Button */}
          {jobClocking ? (
            <button
              onClick={handleJobClockOut}
              disabled={clockOutLoading || clockInLoading}
              style={{
                padding: "14px",
                backgroundColor: "var(--accent-purple-surface)",
                color: "var(--accent-purple)",
                border: "1px solid var(--accent-purple-surface)",
                borderRadius: "8px",
                cursor: clockOutLoading || clockInLoading ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "600",
                opacity: clockOutLoading ? 0.8 : 1,
                transition: "all 0.2s ease"
              }}
            >
              {clockOutLoading ? "Clocking Out..." : "⏸️ Clock Out"}
            </button>
          ) : (
            <button
              onClick={handleJobClockIn}
              disabled={clockInLoading || clockOutLoading}
              style={{
                padding: "14px",
                backgroundColor: "var(--accent-purple-surface)",
                color: "var(--accent-purple)",
                border: "1px solid var(--accent-purple-surface)",
                borderRadius: "8px",
                cursor: clockInLoading || clockOutLoading ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "600",
                opacity: clockInLoading ? 0.8 : 1,
                transition: "all 0.2s ease"
              }}
            >
              {clockInLoading ? "Clocking In..." : "▶️ Clock In"}
            </button>
          )}

          {/* Write-Up Button */}
          <button
            onClick={() => router.push(`/job-cards/${jobNumber}/write-up`)}
            style={{
              padding: "14px",
              backgroundColor: "var(--accent-purple-surface)",
              color: "var(--accent-purple)",
              border: "1px solid var(--accent-purple-surface)",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            ✍️ Write-Up
          </button>

          {/* Complete Job Button - gated by write-up + VHC completion */}
          <button
            onClick={handleCompleteJob}
            disabled={!canCompleteJob || clockInLoading || clockOutLoading}
            style={{
              padding: "14px",
              backgroundColor: canCompleteJob ? "var(--info)" : "var(--success)",
              color: canCompleteJob ? "white" : "var(--info)",
              border: "none",
              borderRadius: "8px",
              cursor: canCompleteJob ? "pointer" : "not-allowed",
              fontSize: "14px",
              fontWeight: "600",
              opacity: clockInLoading || clockOutLoading ? 0.8 : 1
            }}
            title={
              canCompleteJob
                ? "Mark job as Tech Complete"
                : "Complete write-up (fault, cause, rectification) and finish VHC first"
            }
          >
            {canCompleteJob ? "✓ Complete Job" : "Complete Job (locked)"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
