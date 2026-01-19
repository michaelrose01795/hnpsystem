// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/job-cards/myjobs/index.js
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";
import { getAllJobs } from "@/lib/database/jobs";
import { getClockingStatus } from "@/lib/database/clocking";
import JobCardModal from "@/components/JobCards/JobCardModal"; // Import Start Job modal
import { getUserActiveJobs } from "@/lib/database/jobClocking";
import { supabase } from "@/lib/supabaseClient";
import { summarizePartsPipeline } from "@/lib/partsPipeline";

const STATUS_BADGE_STYLES = {
  Waiting: { background: "var(--warning-surface)", color: "var(--danger-dark)" },
  "In Progress": { background: "var(--info-surface)", color: "var(--accent-purple)" },
  Complete: { background: "var(--success-surface)", color: "var(--success-dark)" },
};

const getStatusBadgeStyle = (status) =>
  STATUS_BADGE_STYLES[status] || { background: "var(--info-surface)", color: "var(--info-dark)" };

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
    completionStatus === "complete"
  ) {
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
  const writeUpComplete = writeUpStatus === "complete" || writeUpStatus === "waiting_additional_work";
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
    completionStatus === "tech_complete" || completionStatus === "complete"
      ? "Complete"
      : resolveTechStatusLabel(job, { isClockedOn });
  if (statusLabel === "Complete") {
    return "Complete: all criteria met.";
  }
  if (statusLabel === "In Progress") {
    return missing.length
      ? `In progress: ${missing.join(", ")}.`
      : "In progress: job clocked on.";
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

const formatCreatedAt = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export default function MyJobsPage() {
  const router = useRouter();
  const { user, status: techStatus, currentJob, dbUserId } = useUser();
  const { usersByRole, isLoading: rosterLoading } = useRoster();
  
  const [jobs, setJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [clockingStatus, setClockingStatus] = useState(null);
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

  // Some contexts store a single `role`, others expose an array of `roles`
  const userRoles = Array.isArray(user?.roles)
    ? user.roles
    : user?.role
      ? [user.role]
      : [];

  const hasRoleAccess = userRoles.some((roleName) => {
    const normalized = String(roleName).toLowerCase();
    return normalized.includes("tech") || normalized.includes("mot");
  });
  const hasTechnicianAccess =
    (username && allowedTechNames.has(username)) || hasRoleAccess;

  const isAssignedToTechnician = useCallback(
    (job) => {
      if (!dbUserId || !job) return false;

      const assignedNumeric =
        typeof job.assignedTo === "number"
          ? job.assignedTo
          : typeof job.assignedTo === "string"
          ? Number(job.assignedTo)
          : null;

      if (assignedNumeric === dbUserId) {
        return true;
      }

      if (job.assignedTech?.id && job.assignedTech.id === dbUserId) {
        return true;
      }

      return false;
    },
    [dbUserId]
  );

  const fetchJobsForTechnician = useCallback(async () => {
    if (!hasTechnicianAccess || !dbUserId) return;

    setLoading(true);

    try {
      const fetchedJobs = await getAllJobs();
      console.log("[MyJobs] fetched jobs:", fetchedJobs);
      setJobs(fetchedJobs);

      const assignedJobs = fetchedJobs.filter((job) => isAssignedToTechnician(job));

      const statusRank = {
        "in-progress": 0,
        pending: 1,
        complete: 2,
      };
      const sortedJobs = assignedJobs.sort((a, b) => {
        const rankA =
          statusRank[
            getTechStatusCategory(resolveTechStatusLabel(a, { isClockedOn: activeJobIds.has(a.id) }))
          ] ?? 1;
        const rankB =
          statusRank[
            getTechStatusCategory(resolveTechStatusLabel(b, { isClockedOn: activeJobIds.has(b.id) }))
          ] ?? 1;
        if (rankA !== rankB) return rankA - rankB;

        const aTimestamp = a.updatedAt || a.createdAt;
        const bTimestamp = b.updatedAt || b.createdAt;
        if (aTimestamp && bTimestamp) {
          return new Date(bTimestamp) - new Date(aTimestamp);
        }
        return 0;
      });

      setMyJobs(sortedJobs);
      setFilteredJobs(sortedJobs);
    } catch (error) {
      console.error("[MyJobs] error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  }, [hasTechnicianAccess, dbUserId, isAssignedToTechnician]);

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
    const ids = myJobs
      .map((job) => {
        if (Number.isInteger(job?.id)) return job.id;
        if (job?.id) return Number(job.id);
        return null;
      })
      .filter((id) => Number.isInteger(id));
    return ids.length > 0 ? ids.join(",") : "";
  }, [myJobs]);

  const statusRefetchGuard = useRef(false);
  const previousFetchRef = useRef(fetchJobsForTechnician);

  useEffect(() => {
    fetchActiveJobs();
  }, [fetchActiveJobs]);

  useEffect(() => {
    if (!dbUserId) return;

    const toAssignedId = (value) => {
      if (value === null || value === undefined) return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const channel = supabase
      .channel(`myjobs-jobs-${dbUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jobs"
        },
        (payload) => {
          const nextAssigned = toAssignedId(payload?.new?.assigned_to);
          const previousAssigned = toAssignedId(payload?.old?.assigned_to);
          if (nextAssigned === dbUserId || previousAssigned === dbUserId) {
            fetchJobsForTechnician();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      if (typeof supabase.removeChannel === "function") {
        supabase.removeChannel(channel);
      }
    };
  }, [dbUserId, fetchJobsForTechnician]);

  useEffect(() => {
    if (!dbUserId || !jobIdsFilterString) return;

    const channel = supabase
      .channel(`myjobs-parts-${dbUserId}-${jobIdsFilterString}`)
      .on(
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
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      if (typeof supabase.removeChannel === "function") {
        supabase.removeChannel(channel);
      }
    };
  }, [dbUserId, jobIdsFilterString, fetchJobsForTechnician]);

  useEffect(() => {
    if (!dbUserId) return;

    const channel = supabase
      .channel(`myjobs-clocking-${dbUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_clocking",
          filter: `user_id=eq.${dbUserId}`
        },
        () => {
          fetchActiveJobs();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      if (typeof supabase.removeChannel === "function") {
        supabase.removeChannel(channel);
      }
    };
  }, [dbUserId, fetchActiveJobs]);

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
      console.error("❌ Error refreshing clocking status:", error);
      setClockingStatus(null);
    }
  }, [dbUserId]);

  useEffect(() => {
    refreshClockingStatus();
  }, [refreshClockingStatus, techStatus, currentJob?.jobNumber]);

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
      filtered = filtered.filter(job =>
        job.jobNumber?.toLowerCase().includes(lower) ||
        job.customer?.toLowerCase().includes(lower) ||
        job.reg?.toLowerCase().includes(lower) ||
        job.makeModel?.toLowerCase().includes(lower)
      );
    }

    setFilteredJobs(filtered);
  }, [filter, searchTerm, myJobs]);

  if (rosterLoading) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center", color: "var(--info)" }}>
          Loading roster…
        </div>
      </Layout>
    );
  }

  // ✅ Handle job click - open Start Job modal with job number prefilled
  const handleJobClick = (job) => {
    if (!job?.jobNumber) return;
    setPrefilledJobNumber(job.jobNumber); // Prefill the job number in the modal
    setShowStartJobModal(true); // Open the Start Job modal
  };

  // ✅ Access check
  if (!hasTechnicianAccess) {
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
          <h2 style={{ color: "var(--primary)", marginBottom: "10px", fontWeight: "700" }}>
            Access Denied
          </h2>
          <p style={{ color: "var(--grey-accent)", fontSize: "16px" }}>
            This page is only accessible to Technicians and MOT Testers.
          </p>
        </div>
      </Layout>
    );
  }

  // ✅ Loading state
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
          <p style={{ color: "var(--grey-accent)", fontSize: "16px" }}>Loading your jobs...</p>
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

  return (
    <Layout>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "8px 16px",
          minHeight: "100vh"
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <h1 style={{
              color: "var(--primary)",
              fontSize: "32px",
              fontWeight: "700",
              margin: "0 0 8px 0"
            }}>
              My Assigned Jobs
            </h1>
            <p style={{ color: "var(--grey-accent)", fontSize: "14px", margin: 0 }}>
              {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""} assigned to you
            </p>
          </div>

        </div>

        {/* Clocking Status Banner */}
        {clockingStatus && (
          <div style={{
            backgroundColor: "var(--success-surface)",
            border: "1px solid var(--success)",
            borderRadius: "12px",
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: "var(--info)",
                animation: "pulse 2s infinite"
              }}></div>
              <div>
                <p style={{ fontSize: "14px", fontWeight: "600", color: "var(--success-dark)", margin: 0 }}>
                  Currently Clocked In
                </p>
                <p style={{ fontSize: "12px", color: "var(--success-dark)", margin: "4px 0 0 0" }}>
                  Since {new Date(clockingStatus.clock_in).toLocaleTimeString("en-GB", { 
                    hour: "2-digit", 
                    minute: "2-digit" 
                  })} • {calculateHoursWorked(clockingStatus.clock_in)} hours worked today
                </p>
              </div>
            </div>
            <style jsx>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}</style>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "12px",
          backgroundColor: "var(--search-surface)",
          borderRadius: "12px",
          color: "var(--search-text)"
        }}>
          {/* Search Input */}
          <input
            type="search"
            placeholder="Search by job number, customer, reg, or vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: "220px",
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid var(--search-surface-muted)",
              fontSize: "14px",
              outline: "none",
              transition: "border-color 0.2s",
              backgroundColor: "var(--search-surface)",
              color: "var(--search-text)"
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--primary)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--search-surface-muted)";
            }}
          />

          {/* Filter Buttons */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              { value: "all", label: "All Jobs" },
              { value: "in-progress", label: "In Progress" },
              { value: "pending", label: "Waiting" },
              { value: "complete", label: "Complete" }
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                style={{
                  padding: "10px 20px",
                  backgroundColor: filter === value ? "var(--primary)" : "var(--surface)",
                  color: filter === value ? "var(--surface)" : "var(--primary)",
                  border: "1px solid var(--primary)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: filter === value ? "600" : "500",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (filter !== value) {
                    e.target.style.backgroundColor = "var(--surface-light)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (filter !== value) {
                    e.target.style.backgroundColor = "var(--surface)";
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Jobs List */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRadius: "24px",
            border: "1px solid var(--surface-light)",
            background: "var(--surface)",
            padding: "24px",
            overflow: "hidden",
            minHeight: 0
          }}
        >
          {filteredJobs.length === 0 ? (
            <div style={{
              backgroundColor: "transparent",
              padding: "60px",
              borderRadius: "16px",
              border: "1px dashed var(--danger)",
              textAlign: "center",
              margin: "auto",
              maxWidth: "520px"
            }}>
              <div style={{ fontSize: "64px", marginBottom: "20px" }}>
                {searchTerm ? "🔍" : "📭"}
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "8px" }}>
                {searchTerm ? "No jobs found" : "No jobs assigned"}
              </h3>
              <p style={{ color: "var(--grey-accent)", fontSize: "14px" }}>
                {searchTerm
                  ? "Try adjusting your search or filter criteria"
                  : "You currently have no jobs assigned to you"
                }
              </p>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                paddingRight: "8px",
                minHeight: 0
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  backgroundColor: "var(--surface-light)",
                  border: "1px solid var(--surface-light)",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "var(--info)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em"
                }}
              >
                <div style={{ minWidth: "110px", textAlign: "center" }}>Status</div>
                <div style={{ minWidth: "90px" }}>Job</div>
                <div style={{ minWidth: "80px" }}>Reg</div>
                <div style={{ minWidth: "140px", flex: "0 0 auto" }}>Customer</div>
                <div style={{ minWidth: "160px", flex: "1 1 auto" }}>Make/Model</div>
                <div style={{ minWidth: "80px" }}>Type</div>
                <div style={{ minWidth: "90px", textAlign: "center" }}>Clocked</div>
                <div style={{ minWidth: "100px", textAlign: "center" }}>Created</div>
              </div>
              {filteredJobs.map((job) => {
                const isClockedOn = activeJobIds.has(job.id);
                const displayStatusLabel = resolveTechStatusLabel(job, { isClockedOn });
                const statusStyle = getStatusBadgeStyle(displayStatusLabel);
                const statusTooltip = resolveTechStatusTooltip(job, { isClockedOn });
                const createdAt = formatCreatedAt(job.createdAt);
                const description = job.description?.trim();
                const makeModel = getMakeModel(job);

                // ✅ VHC Status Indicator
                const vhcRequired = job.vhcRequired === true;
                const vhcColor = vhcRequired ? "var(--info)" : "var(--danger)"; // Green if required, Red if not
                const vhcBgColor = vhcRequired ? "var(--success)" : "var(--danger-surface)";
                const vhcText = vhcRequired ? "VHC Required" : "No VHC";

                const handleVhcBadgeClick = (event) => {
                  if (!vhcRequired || !job.jobNumber) return;
                  event.stopPropagation();
                  router.push(`/job-cards/myjobs/${job.jobNumber}?tab=vhc`);
                };

                const handleVhcBadgeKeyDown = (event) => {
                  if (!vhcRequired) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleVhcBadgeClick(event);
                  }
                };

                const jobType = job.type || "Service";
                const partsPending = (job.partsRequests || []).some((request) => {
                  const status = (request.status || "").toLowerCase();
                  return !["picked", "fitted", "cancelled"].includes(status);
                });
                const clockStateLabel = isClockedOn ? "Clocked On" : "Clocked Off";
                const partsIndicatorColor = partsPending ? "var(--danger)" : "var(--info)";
                const jobPipeline = summarizePartsPipeline(job.partsAllocations || [], {
                  quantityField: "quantityRequested",
                });
                const stageBadges = (jobPipeline.stageSummary || []).filter(
                  (stage) => stage.count > 0
                );

                return (
                  <div
                    key={job.id || job.jobNumber}
                    className="myjobs-row"
                    onClick={() => handleJobClick(job)}
                    style={{
                      border: "1px solid var(--border)",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      backgroundColor: "var(--surface)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.borderColor = "var(--primary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.borderColor = "var(--border)";
                    }}
                  >
                    {/* Status Badge */}
                    <div
                      className="myjobs-cell myjobs-status"
                      title={statusTooltip}
                      style={{
                        backgroundColor: statusStyle.background,
                        color: statusStyle.color,
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "700",
                        whiteSpace: "nowrap",
                        minWidth: "110px",
                        textAlign: "center"
                      }}
                    >
                      {displayStatusLabel}
                    </div>

                    {/* Job Number */}
                    <span
                      className="myjobs-cell myjobs-jobnumber"
                      style={{
                        fontSize: "16px",
                        fontWeight: "700",
                        color: "var(--text-primary)",
                        minWidth: "90px"
                      }}
                    >
                      {job.jobNumber || "No Job #"}
                    </span>

                    {/* Registration */}
                    <span
                      className="myjobs-cell myjobs-reg"
                      style={{
                        fontSize: "14px",
                        color: "var(--text-secondary)",
                        fontWeight: "600",
                        minWidth: "80px"
                      }}
                    >
                      {job.reg || "No Reg"}
                    </span>

                    {/* Customer */}
                    <span
                      className="myjobs-cell myjobs-customer"
                      style={{
                        fontSize: "13px",
                        color: "var(--text-primary)",
                        minWidth: "140px",
                        flex: "0 0 auto"
                      }}
                    >
                      {job.customer || "Unknown"}
                    </span>

                    {/* Make/Model */}
                    <span
                      className="myjobs-cell myjobs-make"
                      style={{
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                        minWidth: "160px",
                        flex: "1 1 auto"
                      }}
                    >
                      {makeModel}
                    </span>

                    {/* Job Type */}
                    <span
                      className="myjobs-cell myjobs-type"
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        minWidth: "80px"
                      }}
                    >
                      {jobType}
                    </span>

                    {/* Clocked Status */}
                    <div
                      className="myjobs-cell myjobs-clock"
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color: isClockedOn ? "var(--success)" : "var(--text-secondary)",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        backgroundColor: isClockedOn ? "var(--success-surface)" : "var(--surface-light)",
                        minWidth: "90px",
                        textAlign: "center"
                      }}
                    >
                      {isClockedOn ? "Clocked" : "Off"}
                    </div>

                    {/* Created Date */}
                    <span
                      className="myjobs-cell myjobs-date"
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        minWidth: "100px",
                        textAlign: "center"
                      }}
                    >
                      {createdAt || "N/A"}
                    </span>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Job Count Summary */}
        <div style={{
          backgroundColor: "var(--surface)",
          padding: "20px",
          borderRadius: "16px",
          border: "1px solid var(--surface-light)"
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "16px",
            textAlign: "center"
          }}>
            <div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--primary)", marginBottom: "4px" }}>
                {myJobs.length}
              </div>
              <div style={{ fontSize: "13px", color: "var(--grey-accent)" }}>Total Jobs</div>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--info)", marginBottom: "4px" }}>
                {myJobs.filter(
                  (j) =>
                    getTechStatusCategory(
                      resolveTechStatusLabel(j, { isClockedOn: activeJobIds.has(j.id) })
                    ) === "in-progress"
                ).length}
              </div>
              <div style={{ fontSize: "13px", color: "var(--grey-accent)" }}>In Progress</div>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--danger)", marginBottom: "4px" }}>
                {myJobs.filter(
                  (j) =>
                    getTechStatusCategory(
                      resolveTechStatusLabel(j, { isClockedOn: activeJobIds.has(j.id) })
                    ) === "pending"
                ).length}
              </div>
              <div style={{ fontSize: "13px", color: "var(--grey-accent)" }}>Waiting</div>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--info)", marginBottom: "4px" }}>
                {myJobs.filter(
                  (j) =>
                    getTechStatusCategory(
                      resolveTechStatusLabel(j, { isClockedOn: activeJobIds.has(j.id) })
                    ) === "complete"
                ).length}
              </div>
              <div style={{ fontSize: "13px", color: "var(--grey-accent)" }}>Completed</div>
            </div>
          </div>
        </div>

        {/* Quick Info Box */}
        <div style={{
          background: "var(--surface-light)",
          border: "1px solid var(--danger)",
          borderRadius: "12px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          boxShadow: "none"
        }}>
          <div style={{ fontSize: "24px" }}>💡</div>
          <div>
            <p style={{ fontSize: "14px", fontWeight: "600", color: "var(--danger)", margin: "0 0 4px 0" }}>
              VHC Status Legend
            </p>
            <p style={{ fontSize: "13px", color: "var(--danger-dark)", margin: 0 }}>
              🟢 <strong>Green Badge</strong> = VHC Required for this job | 
              🔴 <strong>Red Badge</strong> = VHC Not Required
            </p>
          </div>
        </div>
      </div>

      {/* Start Job Modal */}
      <JobCardModal 
        isOpen={showStartJobModal} 
        onClose={() => {
          setShowStartJobModal(false); // Close modal
          setPrefilledJobNumber(""); // Clear prefilled job number
        }}
        prefilledJobNumber={prefilledJobNumber} // Pass the prefilled job number to modal
      />
    </Layout>
  );
}

// ✅ Helper function to calculate hours worked
function calculateHoursWorked(clockInTime) {
  if (!clockInTime) return "0.0";
  const now = new Date();
  const clockIn = new Date(clockInTime);
  const hours = (now - clockIn) / (1000 * 60 * 60);
  return hours.toFixed(1);
}
