// file location: src/pages/job-cards/myjobs/index.js
// ✅ Imports converted to use absolute alias "@/"
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";
import { getAllJobs } from "@/lib/database/jobs";
import JobCardModal from "@/components/JobCards/JobCardModal"; // Import Start Job modal
import { getUserActiveJobs } from "@/lib/database/jobClocking";
import { supabase } from "@/lib/database/supabaseClient";
import { summarizePartsPipeline } from "@/lib/parts/pipeline";
import { compareJobsForBoard } from "@/lib/jobCards/utils";
import { normalizeDisplayName } from "@/utils/nameUtils";
import { deriveJobTypeDisplay } from "@/lib/jobType/display";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { prefetchJob } from "@/lib/swr/prefetch";
import {
  InlineLoading,
  SkeletonBlock,
  SkeletonKeyframes } from
"@/components/ui/LoadingSkeleton";
import MyJobsPageUi from "@/components/page-ui/job-cards/myjobs/job-cards-myjobs-ui"; // Extracted presentation layer.

const STATUS_BADGE_STYLES = {
  Waiting: { background: "var(--warning-surface)", color: "var(--danger-dark)" },
  "In Progress": { background: "var(--theme)", color: "var(--accent-purple)" },
  Complete: { background: "var(--success-surface)", color: "var(--success-dark)" }
};

const getStatusBadgeStyle = (status) =>
STATUS_BADGE_STYLES[status] || { background: "var(--theme)", color: "var(--info-dark)" };

const normalizeStatusKey = (status) =>
typeof status === "string" ? status.trim().toLowerCase() : "";

const resolveTechStatusLabel = (job, { isClockedOn = false } = {}) => {
  const rawStatus = normalizeStatusKey(job?.rawStatus || job?.status);
  const completionStatus = normalizeStatusKey(
    job?.techCompletionStatus || job?.tech_completion_status
  );
  if (
  rawStatus.includes("tech complete") ||
  rawStatus.includes("technician work completed") ||
  rawStatus.includes("invoiced") ||
  rawStatus === "complete" ||
  rawStatus === "completed" ||
  completionStatus === "tech_complete" ||
  completionStatus === "complete")
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
  const completionStatus = normalizeStatusKey(
    job?.techCompletionStatus || job?.tech_completion_status
  );
  const missing = [];

  if (!writeUpComplete) {
    missing.push("Write-up incomplete");
  }
  if (requiresVhc && !vhcComplete) {
    missing.push("VHC incomplete");
  }

  const statusLabel =
  completionStatus === "tech_complete" || completionStatus === "complete" ?
  "Complete" :
  resolveTechStatusLabel(job, { isClockedOn });
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
  return (
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
  const { user, status: techStatus, currentJob, dbUserId } = useUser();
  const { usersByRole, isLoading: rosterLoading } = useRoster();

  const [jobs, setJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, in-progress, pending, complete
  const [searchTerm, setSearchTerm] = useState("");
  const [showStartJobModal, setShowStartJobModal] = useState(false); // Control Start Job modal visibility
  const [prefilledJobNumber, setPrefilledJobNumber] = useState(""); // Prefill job number in modal
  const [activeJobIds, setActiveJobIds] = useState(new Set());

  const username = user?.username?.trim();
  const techsList = usersByRole?.["Techs"] || [];
  const motTestersList = usersByRole?.["MOT Tester"] || [];
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

  const hasRoleAccess = userRoles.some((roleName) => {
    const normalized = String(roleName).toLowerCase();
    return normalized.includes("tech") || normalized.includes("mot");
  });
  const hasMotRoleAccess = userRoles.some((roleName) =>
  String(roleName).toLowerCase().includes("mot")
  );
  const hasTechnicianAccess =
  username && allowedTechNames.has(username) || hasRoleAccess;
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

  const fetchOpenClockingByJob = useCallback(async (jobIds = []) => {
    const numericIds = Array.from(
      new Set(
        (Array.isArray(jobIds) ? jobIds : []).
        map((id) => Number(id)).
        filter((id) => Number.isInteger(id))
      )
    );

    if (numericIds.length === 0) {
      return new Map();
    }

    try {
      const { data, error } = await supabase.
      from("job_clocking").
      select("id, job_id, user_id, request_id, work_type, clock_in, clock_out").
      in("job_id", numericIds).
      is("clock_out", null);

      if (error) {
        throw error;
      }

      const nextMap = new Map();
      (data || []).forEach((row) => {
        const jobId = Number(row?.job_id);
        if (!Number.isInteger(jobId)) {
          return;
        }
        if (!nextMap.has(jobId)) {
          nextMap.set(jobId, []);
        }
        nextMap.get(jobId).push(row);
      });
      return nextMap;
    } catch (error) {
      console.error("[MyJobs] failed to fetch open job clocking:", error);
      return new Map();
    }
  }, []);

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

  const fetchJobsForTechnician = useCallback(async () => {
    if (!hasTechnicianAccess || !dbUserId) return;

    setLoading(true);

    try {
      const fetchedJobs = await getAllJobs();
      console.log("[MyJobs] fetched jobs:", fetchedJobs);
      setJobs(fetchedJobs);
      const clockingMap = await fetchOpenClockingByJob(
        fetchedJobs.map((job) => job?.id).filter(Boolean)
      );

      const assignedJobs = fetchedJobs.filter(
        (job) => isAssignedToTechnician(job) || shouldShowMotHandoffJob(job, clockingMap)
      );

      // Order matches the board panel on Next Jobs (position → checkedInAt → createdAt)
      const sortedJobs = assignedJobs.sort(compareJobsForBoard);

      setMyJobs(sortedJobs);
      setFilteredJobs(sortedJobs);
    } catch (error) {
      console.error("[MyJobs] error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  }, [
  hasTechnicianAccess,
  dbUserId,
  isAssignedToTechnician,
  fetchOpenClockingByJob,
  shouldShowMotHandoffJob,
  activeJobIds]
  );

  useEffect(() => {
    if (!hasTechnicianAccess || !dbUserId) return;
    fetchJobsForTechnician();
  }, [hasTechnicianAccess, dbUserId, fetchJobsForTechnician]);

  const fetchActiveJobs = useCallback(async () => {
    if (!dbUserId) {
      setActiveJobIds(new Set());
      return;
    }

    try {
      const result = await getUserActiveJobs(dbUserId);
      if (result.success) {
        const ids = new Set(result.data.map((entry) => Number(entry.jobId)));
        setActiveJobIds(ids);
      } else {
        setActiveJobIds(new Set());
      }
    } catch (error) {
      console.error("❌ Failed to fetch active jobs:", error);
      setActiveJobIds(new Set());
    }
  }, [dbUserId]);

  const jobIdsFilterString = useMemo(() => {
    const ids = myJobs.
    map((job) => {
      if (Number.isInteger(job?.id)) return job.id;
      if (job?.id) return Number(job.id);
      return null;
    }).
    filter((id) => Number.isInteger(id));
    return ids.length > 0 ? ids.join(",") : "";
  }, [myJobs]);

  const statusRefetchGuard = useRef(false);
  const previousFetchRef = useRef(fetchJobsForTechnician);

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

    const channel = supabase.
    channel(`myjobs-jobs-${dbUserId}`).
    on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "jobs"
      },
      (payload) => {
        const nextAssigned = payload?.new?.assigned_to;
        const previousAssigned = payload?.old?.assigned_to;
        if (
        isMotTester ||
        matchesUserAssignment(nextAssigned) ||
        matchesUserAssignment(previousAssigned))
        {
          fetchJobsForTechnician();
        }
      }
    ).
    subscribe();

    return () => {
      channel.unsubscribe();
      if (typeof supabase.removeChannel === "function") {
        supabase.removeChannel(channel);
      }
    };
  }, [dbUserId, fetchJobsForTechnician, normalizedUserNames, isMotTester]);

  useEffect(() => {
    if (!dbUserId || !jobIdsFilterString) return;

    const channel = supabase.
    channel(`myjobs-requests-${dbUserId}-${jobIdsFilterString}`).
    on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "job_requests",
        filter: `job_id=in.(${jobIdsFilterString})`
      },
      () => {
        fetchJobsForTechnician();
      }
    ).
    on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "parts_requests",
        filter: `job_id=in.(${jobIdsFilterString})`
      },
      () => {
        fetchJobsForTechnician();
      }
    ).
    subscribe();

    return () => {
      channel.unsubscribe();
      if (typeof supabase.removeChannel === "function") {
        supabase.removeChannel(channel);
      }
    };
  }, [dbUserId, jobIdsFilterString, fetchJobsForTechnician]);

  useEffect(() => {
    if (!dbUserId) return;

    const channel = supabase.
    channel(`myjobs-clocking-${dbUserId}-${jobIdsFilterString || "none"}`).
    on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "job_clocking"
      },
      () => {
        fetchActiveJobs();
        fetchJobsForTechnician();
      }
    ).
    subscribe();

    return () => {
      channel.unsubscribe();
      if (typeof supabase.removeChannel === "function") {
        supabase.removeChannel(channel);
      }
    };
  }, [dbUserId, jobIdsFilterString, fetchActiveJobs, fetchJobsForTechnician]);

  useEffect(() => {
    if (previousFetchRef.current !== fetchJobsForTechnician) {
      statusRefetchGuard.current = false;
      previousFetchRef.current = fetchJobsForTechnician;
    }

    if (!statusRefetchGuard.current) {
      statusRefetchGuard.current = true;
      return;
    }

    fetchJobsForTechnician();
  }, [techStatus, currentJob?.jobNumber, fetchJobsForTechnician]);

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
  }, [filter, searchTerm, myJobs]);

  if (rosterLoading) {
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
