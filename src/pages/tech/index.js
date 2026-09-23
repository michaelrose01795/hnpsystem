// file location: src/pages/tech/index.js
// ✅ Imports converted to use absolute alias "@/"
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { hasAllAccessRole } from "@/lib/auth/roles";
import { useRoster } from "@/context/RosterContext";
// Loaded on demand - these modules resolve the Supabase browser client.
//
// The job list read runs inside an async callback and both subscriptions run
// from effects after mount, so none of this is needed to render the page.
//
// NOTE: this page deliberately still reads the FULL job list rather than the
// technician-scoped workload query used by /tech/dashboard. Its filter is
// wider than "assigned to me": a mobile technician sees every mobile job
// booked for today whoever it belongs to, and a bench technician also sees MOT
// hand-off jobs. Scoping the query would silently drop both.
const loadJobsDb = () => import("@/lib/database/jobs");
const loadJobClockingDb = () => import("@/lib/database/jobClocking");
import { invalidateCache } from "@/lib/database/queryCache";
import { subscribeViaDeferredModule } from "@/lib/database/realtimeClient";
import JobCardModal from "@/components/JobCards/JobCardModal"; // Import Start Job modal
import { summarizePartsPipeline } from "@/lib/parts/pipeline";
import { compareJobsForBoard } from "@/lib/jobCards/utils";
import { normalizeDisplayName } from "@/utils/nameUtils";
import { deriveJobTypeDisplay } from "@/lib/jobType/display";
import {
  hasOutstandingAuthorisedVhcWork,
  projectVhcItems,
  TECH_JOB_STATUS
} from "@/features/vhc/vhcStatusEngine";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { prefetchJob } from "@/lib/swr/prefetch";
import {
  InlineLoading,
  SkeletonBlock,
  SkeletonKeyframes } from
"@/components/ui/LoadingSkeleton";
import MyJobsPageUi from "@/components/page-ui/job-cards/myjobs/job-cards-myjobs-ui"; // Extracted presentation layer.
import { logFailure } from "@/lib/utils/logFailure";

const STATUS_BADGE_STYLES = {
  Waiting: { background: "var(--warning-surface)", color: "var(--danger-dark)" },
  "In Progress": { background: "var(--theme)", color: "var(--accent-purple)" },
  Complete: { background: "var(--success-surface)", color: "var(--success-dark)" }
};

const getStatusBadgeStyle = (status) =>
STATUS_BADGE_STYLES[status] || { background: "var(--theme)", color: "var(--info-dark)" };

const MY_JOBS_CACHE_VERSION = 1;
const getMyJobsCacheKey = (userId) => `hnp:my-jobs:${userId}:v${MY_JOBS_CACHE_VERSION}`;

const readMyJobsSnapshot = (userId) => {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const stored = window.sessionStorage.getItem(getMyJobsCacheKey(userId));
    if (!stored) return null;
    const snapshot = JSON.parse(stored);
    if (!Array.isArray(snapshot?.jobs)) return null;
    return snapshot;
  } catch {
    return null;
  }
};

const persistMyJobsSnapshot = (userId, jobs, activeJobIds) => {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.sessionStorage.setItem(
      getMyJobsCacheKey(userId),
      JSON.stringify({
        jobs: Array.isArray(jobs) ? jobs : [],
        activeJobIds: Array.from(activeJobIds || []),
        savedAt: Date.now()
      })
    );
  } catch {
    // Storage can be unavailable or full; the live fetch remains the fallback.
  }
};

const isManualPageReload = () => {
  if (typeof window === "undefined" || typeof window.performance === "undefined") return false;
  return window.performance.getEntriesByType?.("navigation")?.[0]?.type === "reload";
};

const normalizeStatusKey = (status) =>
typeof status === "string" ? status.trim().toLowerCase() : "";

const hasOutstandingAuthorisedWork = (job) =>
hasOutstandingAuthorisedVhcWork(
  projectVhcItems(Array.isArray(job?.vhcChecks) ? job.vhcChecks : [], { job })
);

const resolveTechStatusLabel = (job, { isClockedOn = false } = {}) => {
  const rawStatus = normalizeStatusKey(job?.rawStatus || job?.status);
  const completionStatus = normalizeStatusKey(
    job?.techCompletionStatus || job?.tech_completion_status
  );
  if (completionStatus === TECH_JOB_STATUS.AUTHORISED_ITEMS) {
    return "Authorised";
  }
  const technicianPreviouslyCompleted =
  rawStatus.includes("tech complete") ||
  rawStatus.includes("technician work completed") ||
  rawStatus.includes("invoiced") ||
  rawStatus === "complete" ||
  rawStatus === "completed" ||
  completionStatus === TECH_JOB_STATUS.COMPLETED ||
  completionStatus === TECH_JOB_STATUS.AUTHORISED_ITEMS ||
  completionStatus === "complete" ||
  completionStatus === "completed";

  if (technicianPreviouslyCompleted && hasOutstandingAuthorisedWork(job)) {
    return "Authorised";
  }
  if (
  rawStatus.includes("tech complete") ||
  rawStatus.includes("technician work completed") ||
  rawStatus.includes("invoiced") ||
  rawStatus === "complete" ||
  rawStatus === "completed" ||
  completionStatus === "tech_complete" ||
  completionStatus === "complete" ||
  completionStatus === "completed")
  {
    return "Complete";
  }
  if (isClockedOn) {
    return "In Progress";
  }
  return "Waiting";
};

const resolveTechStatusTooltip = (job, { isClockedOn = false } = {}) => {
  const requiresVhc = job?.vhcRequired === true;
  const vhcComplete = Boolean(job?.vhcCompletedAt);
  const writeUpStatus = normalizeStatusKey(job?.writeUp?.completion_status);
  const writeUpComplete =
  job?.writeUpTaskSummary?.technicianTasksComplete === true ||
  writeUpStatus === "complete" ||
  writeUpStatus === "waiting_additional_work";
  const missing = [];

  if (!writeUpComplete) {
    missing.push("Write-up incomplete");
  }
  if (requiresVhc && !vhcComplete) {
    missing.push("VHC incomplete");
  }

  const statusLabel = resolveTechStatusLabel(job, { isClockedOn });
  if (statusLabel === "Authorised") {
    return "Authorised: VHC work has been approved and is waiting for technician completion.";
  }
  if (statusLabel === "Complete") {
    return "Complete: all criteria met.";
  }
  if (statusLabel === "In Progress") {
    return missing.length ?
    `In progress: ${missing.join(", ")}.` :
    "In progress: job clocked on.";
  }
  if (statusLabel === "Waiting") {
    const base = "Waiting: not clocked on.";
    return missing.length ? `${base} ${missing.join(", ")}.` : base;
  }
  return "";
};

const getTechStatusCategory = (statusLabel) => {
  const normalized = normalizeStatusKey(statusLabel);
  if (normalized === "complete") return "complete";
  if (normalized === "waiting") return "pending";
  return "in-progress";
};

const getMakeModel = (job) => {
  if (!job) return "N/A";
  if (job.makeModel) return job.makeModel;
  const combined = [job.make, job.model].filter(Boolean).join(" ");
  return combined || "N/A";
};

const isTechTaskComplete = (job = {}) => {
  const rawStatus = normalizeStatusKey(job?.rawStatus || job?.status);
  const completionStatus = normalizeStatusKey(
    job?.techCompletionStatus || job?.tech_completion_status
  );
  return !hasOutstandingAuthorisedWork(job) && (
    rawStatus.includes("tech complete") ||
    rawStatus.includes("technician work completed") ||
    rawStatus.includes("invoiced") ||
    rawStatus === "complete" ||
    rawStatus === "completed" ||
    completionStatus === "tech_complete" ||
    completionStatus === "complete");

};

export default function MyJobsPage() {
  const router = useRouter();
  const { user, dbUserId } = useUser();
  const { usersByRole, isLoading: rosterLoading } = useRoster();

  const [myJobs, setMyJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, in-progress, pending, complete
  const [searchTerm, setSearchTerm] = useState("");
  const [showStartJobModal, setShowStartJobModal] = useState(false); // Control Start Job modal visibility
  const [prefilledJobNumber, setPrefilledJobNumber] = useState(""); // Prefill job number in modal
  const [activeJobIds, setActiveJobIds] = useState(new Set());
  const myJobsRef = useRef([]);
  const activeJobIdsRef = useRef(new Set());
  const initialLoadKeyRef = useRef("");
  const queueRefreshTimerRef = useRef(null);

  const username = user?.username?.trim();
  const techsList = useMemo(() => usersByRole?.["Techs"] || [], [usersByRole]);
  const motTestersList = useMemo(() => usersByRole?.["MOT Tester"] || [], [usersByRole]);
  // ⚠️ Mock data found — replacing with Supabase query
  // ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)
  const allowedTechNames = useMemo(
    () => new Set([...techsList, ...motTestersList]),
    [techsList, motTestersList]
  );

  const normalizedUserNames = useMemo(() => {
    const candidates = new Set();
    if (user?.username) candidates.add(user.username);
    if (user?.email) candidates.add(user.email);
    if (user?.name) candidates.add(user.name);
    return new Set(
      Array.from(candidates).
      map((value) => normalizeDisplayName(value)).
      filter(Boolean)
    );
  }, [user]);

  // Some contexts store a single `role`, others expose an array of `roles`
  const userRoles = Array.isArray(user?.roles) ?
  user.roles :
  user?.role ?
  [user.role] :
  [];

  const hasFullAccess = hasAllAccessRole(userRoles); // All Access demo login
  const hasRoleAccess = hasFullAccess || userRoles.some((roleName) => {
    const normalized = String(roleName).toLowerCase();
    return normalized.includes("tech") || normalized.includes("mot");
  });
  const hasMotRoleAccess = hasFullAccess || userRoles.some((roleName) =>
  String(roleName).toLowerCase().includes("mot")
  );
  const isMobileTech = userRoles.some(
    (roleName) => String(roleName).toLowerCase().trim() === "mobile technician"
  );
  const hasTechnicianAccess =
  username && allowedTechNames.has(username) || hasRoleAccess || isMobileTech;
  const isMotTester =
  username && motTestersList.includes(username) || hasMotRoleAccess;

  const isAssignedToTechnician = useCallback(
    (job) => {
      if (!job) return false;

      const assignedNumeric =
      typeof job.assignedTo === "number" ?
      job.assignedTo :
      typeof job.assignedTo === "string" ?
      Number(job.assignedTo) :
      null;

      if (Number.isInteger(assignedNumeric) && assignedNumeric === dbUserId) {
        return true;
      }

      const assignedTechNumeric = Number(job.assignedTech?.id);
      if (Number.isFinite(assignedTechNumeric) && assignedTechNumeric === dbUserId) {
        return true;
      }

      const assignedNameRaw =
      job.assignedTech?.name ||
      job.technician || (
      typeof job.assignedTo === "string" ? job.assignedTo : "");
      const normalizedAssignedName = normalizeDisplayName(assignedNameRaw);
      if (normalizedAssignedName && normalizedUserNames.has(normalizedAssignedName)) {
        return true;
      }

      return false;
    },
    [dbUserId, normalizedUserNames]
  );

  const shouldShowMotHandoffJob = useCallback(
    (job, clockingMap) => {
      if (!isMotTester || !dbUserId || !job) {
        return false;
      }

      if (!job?.writeUpTaskSummary?.hasPendingMotOnly || !isTechTaskComplete(job)) {
        return false;
      }

      const openRows = clockingMap.get(Number(job.id)) || [];
      const technicianClocking = openRows.find(
        (row) => String(row?.work_type || "").trim().toLowerCase() !== "mot"
      );
      if (technicianClocking) {
        return false;
      }

      const motClaim = openRows.find(
        (row) => String(row?.work_type || "").trim().toLowerCase() === "mot"
      );
      if (!motClaim) {
        return true;
      }

      return Number(motClaim.user_id) === Number(dbUserId);
    },
    [isMotTester, dbUserId]
  );

  const fetchJobsForTechnician = useCallback(async ({ showLoading = true, forceFresh = false } = {}) => {
    if (!hasTechnicianAccess || !dbUserId) return;

    if (showLoading) setLoading(true);

    try {
      if (forceFresh) invalidateCache("jobs:");
      const fetchedJobs = await (await loadJobsDb()).getAllJobs();
      const clockingMap = await (await loadJobClockingDb()).getOpenJobClockingByJobIds(
        fetchedJobs.map((job) => job?.id).filter(Boolean)
      ).catch((error) => {
        logFailure("[MyJobs] failed to fetch open job clocking:", error);
        return new Map();
      });

      let assignedJobs;
      if (isMobileTech) {
        // Mobile Mechanic eligibility: any job for today with service_mode = "mobile",
        // regardless of who it's assigned to. "Today" is the local calendar date.
        const now = new Date();
        const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        assignedJobs = fetchedJobs.filter(
          (job) =>
            String(job?.serviceMode || "").toLowerCase() === "mobile" &&
            job?.appointment?.date === todayLocal
        );
      } else {
        assignedJobs = fetchedJobs.filter(
          (job) => isAssignedToTechnician(job) || shouldShowMotHandoffJob(job, clockingMap)
        );
      }

      // Order matches the board panel on Next Jobs (position → checkedInAt → createdAt)
      const sortedJobs = assignedJobs.sort(compareJobsForBoard);

      myJobsRef.current = sortedJobs;
      setMyJobs(sortedJobs);
      setFilteredJobs(sortedJobs);
      persistMyJobsSnapshot(dbUserId, sortedJobs, activeJobIdsRef.current);
    } catch (error) {
      logFailure("[MyJobs] error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  }, [
  hasTechnicianAccess,
  dbUserId,
  isMobileTech,
  isAssignedToTechnician,
  shouldShowMotHandoffJob]
  );

  useEffect(() => {
    if (!hasTechnicianAccess || !dbUserId) return;

    const loadKey = String(dbUserId);
    if (initialLoadKeyRef.current === loadKey) return;
    initialLoadKeyRef.current = loadKey;

    const cachedSnapshot = readMyJobsSnapshot(dbUserId);
    if (cachedSnapshot) {
      const cachedActiveJobIds = new Set(
        (cachedSnapshot.activeJobIds || []).map(Number).filter(Number.isInteger)
      );
      myJobsRef.current = cachedSnapshot.jobs;
      activeJobIdsRef.current = cachedActiveJobIds;
      setMyJobs(cachedSnapshot.jobs);
      setFilteredJobs(cachedSnapshot.jobs);
      setActiveJobIds(cachedActiveJobIds);
      setLoading(false);
    }

    const manualReload = isManualPageReload();
    if (!cachedSnapshot || manualReload) {
      void fetchJobsForTechnician({
        showLoading: !cachedSnapshot,
        forceFresh: manualReload
      });
    }
  }, [hasTechnicianAccess, dbUserId, fetchJobsForTechnician]);

  const fetchActiveJobs = useCallback(async () => {
    if (!dbUserId) {
      setActiveJobIds(new Set());
      return;
    }

    try {
      const result = await (await loadJobClockingDb()).getUserActiveJobs(dbUserId);
      if (result.success) {
        const ids = new Set(result.data.map((entry) => Number(entry.jobId)));
        activeJobIdsRef.current = ids;
        setActiveJobIds(ids);
        persistMyJobsSnapshot(dbUserId, myJobsRef.current, ids);
      } else {
        activeJobIdsRef.current = new Set();
        setActiveJobIds(new Set());
      }
    } catch (error) {
      logFailure("❌ Failed to fetch active jobs:", error);
      setActiveJobIds(new Set());
    }
  }, [dbUserId]);

  useEffect(() => {
    fetchActiveJobs();
  }, [fetchActiveJobs]);

  useEffect(() => {
    if (!dbUserId) return;

    const matchesUserAssignment = (value) => {
      if (value === null || value === undefined) return false;
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric === dbUserId) return true;
      const normalized = normalizeDisplayName(value);
      return normalized ? normalizedUserNames.has(normalized) : false;
    };

    const unsubscribe = subscribeViaDeferredModule(loadJobsDb, (m) =>
      m.subscribeToJobChanges(`myjobs-${dbUserId}`, (payload) => {
      const nextRow = payload?.new || {};
      const previousRow = payload?.old || {};
      const jobId = Number(nextRow.id ?? previousRow.id);
      const cachedJob = myJobsRef.current.find((job) => Number(job?.id) === jobId);
      const nextAssigned = nextRow.assigned_to;
      const previousAssigned = previousRow.assigned_to ?? cachedJob?.assignedTo;
      const assignmentChanged =
        matchesUserAssignment(nextAssigned) !== matchesUserAssignment(previousAssigned);
      const nextPosition = nextRow.queue_position;
      const cachedPosition = cachedJob?.position;
      const queuePositionChanged =
        nextPosition !== undefined && String(nextPosition ?? "") !== String(cachedPosition ?? "");
      const affectsSpecialistQueue = (isMotTester || isMobileTech) && queuePositionChanged;

      if (assignmentChanged || affectsSpecialistQueue || (cachedJob && queuePositionChanged)) {
        if (queueRefreshTimerRef.current) window.clearTimeout(queueRefreshTimerRef.current);
        queueRefreshTimerRef.current = window.setTimeout(() => {
          void fetchJobsForTechnician({ showLoading: false, forceFresh: true });
        }, 120);
      }
      })
    );

    return () => {
      if (queueRefreshTimerRef.current) window.clearTimeout(queueRefreshTimerRef.current);
      queueRefreshTimerRef.current = null;
      unsubscribe();
    };
  }, [dbUserId, fetchJobsForTechnician, normalizedUserNames, isMotTester, isMobileTech]);

  useEffect(() => {
    if (!dbUserId) return;
    return subscribeViaDeferredModule(loadJobClockingDb, (m) =>
      m.subscribeToUserClockingChanges(dbUserId, () => {
        void fetchActiveJobs();
      })
    );
  }, [dbUserId, fetchActiveJobs]);

  // Apply filters when filter or search changes
  useEffect(() => {
    let filtered = [...myJobs];

    // Apply status filter
    if (filter === "in-progress") {
      filtered = filtered.filter(
        (job) =>
        getTechStatusCategory(
          resolveTechStatusLabel(job, { isClockedOn: activeJobIds.has(job.id) })
        ) === "in-progress"
      );
    } else if (filter === "pending") {
      filtered = filtered.filter(
        (job) =>
        getTechStatusCategory(
          resolveTechStatusLabel(job, { isClockedOn: activeJobIds.has(job.id) })
        ) === "pending"
      );
    } else if (filter === "complete") {
      filtered = filtered.filter(
        (job) =>
        getTechStatusCategory(
          resolveTechStatusLabel(job, { isClockedOn: activeJobIds.has(job.id) })
        ) === "complete"
      );
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter((job) =>
      job.jobNumber?.toLowerCase().includes(lower) ||
      job.customer?.toLowerCase().includes(lower) ||
      job.reg?.toLowerCase().includes(lower) ||
      job.makeModel?.toLowerCase().includes(lower)
      );
    }

    setFilteredJobs(filtered);
  }, [filter, searchTerm, myJobs, activeJobIds]);

  if (rosterLoading && !hasRoleAccess && !isMobileTech) {
    return <MyJobsPageUi view="section1" InlineLoading={InlineLoading} />;




  }

  // ✅ Handle job click - open Start Job modal with job number prefilled
  const handleJobClick = (job) => {
    if (!job?.jobNumber) return;
    setPrefilledJobNumber(job.jobNumber); // Prefill the job number in the modal
    setShowStartJobModal(true); // Open the Start Job modal
  };

  // ✅ Access check
  if (!hasTechnicianAccess) {
    return <MyJobsPageUi view="section2" />;




















  }

  // NOTE: we intentionally do NOT early-return while `loading` is true.
  // Returning null leaves the page-card empty once the global overlay fades, so
  // the user sees a blank surface before real content arrives. Instead we render
  // the real shell always — header, filter toolbar (interactive during load),
  // results shell, summary grid — and swap the row contents + summary totals
  // for shaped skeleton placeholders. Result: the first visible frame already
  // matches the final layout, with zero layout jump when data arrives.
  const SKELETON_ROW_COUNT = 6;
  const rowSkeletonCells = [
  { width: "90px" }, // status badge
  { width: "70px" }, // job number
  { width: "60px" }, // reg
  { width: "120px" }, // customer
  { width: "140px" }, // make/model
  { width: "60px" } // type
  ];

  return <MyJobsPageUi view="section3" activeJobIds={activeJobIds} deriveJobTypeDisplay={deriveJobTypeDisplay} DevLayoutSection={DevLayoutSection} filter={filter} filteredJobs={filteredJobs} getMakeModel={getMakeModel} getStatusBadgeStyle={getStatusBadgeStyle} getTechStatusCategory={getTechStatusCategory} handleJobClick={handleJobClick} JobCardModal={JobCardModal} loading={loading} myJobs={myJobs} prefetchJob={prefetchJob} prefilledJobNumber={prefilledJobNumber} resolveTechStatusLabel={resolveTechStatusLabel} resolveTechStatusTooltip={resolveTechStatusTooltip} router={router} rowSkeletonCells={rowSkeletonCells} SearchBar={SearchBar} searchTerm={searchTerm} setFilter={setFilter} setPrefilledJobNumber={setPrefilledJobNumber} setSearchTerm={setSearchTerm} setShowStartJobModal={setShowStartJobModal} showStartJobModal={showStartJobModal} SKELETON_ROW_COUNT={SKELETON_ROW_COUNT} SkeletonBlock={SkeletonBlock} SkeletonKeyframes={SkeletonKeyframes} summarizePartsPipeline={summarizePartsPipeline} />;































































































































































































































































































































































































































































































































































































































}
