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
  "In Progress": { background: "var(--info-surface)", color: "var(--accent-purple)" },
  Started: { background: "var(--info-surface)", color: "var(--accent-purple)" },
  Pending: { background: "var(--warning-surface)", color: "var(--danger-dark)" },
  Waiting: { background: "var(--warning-surface)", color: "var(--danger-dark)" },
  Open: { background: "var(--warning-surface)", color: "var(--danger-dark)" },
  Complete: { background: "var(--success-surface)", color: "var(--success-dark)" },
  Completed: { background: "var(--success-surface)", color: "var(--success-dark)" },
};

const getStatusBadgeStyle = (status) =>
  STATUS_BADGE_STYLES[status] || { background: "var(--info-surface)", color: "var(--info-dark)" };

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

      const sortedJobs = assignedJobs.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt) - new Date(a.createdAt);
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

    const channel = supabase
      .channel(`myjobs-jobs-${dbUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jobs",
          filter: `assigned_to=eq.${dbUserId}`
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

  useEffect(() => {
    refreshClockingStatus();
  }, [refreshClockingStatus, techStatus, currentJob?.jobNumber]);

  // Apply filters when filter or search changes
  useEffect(() => {
    let filtered = [...myJobs];

    // Apply status filter
    if (filter === "in-progress") {
      filtered = filtered.filter(job =>
        job.status === "In Progress" || job.status === "Started"
      );
    } else if (filter === "pending") {
      filtered = filtered.filter(job =>
        job.status === "Pending" || job.status === "Waiting" || job.status === "Open"
      );
    } else if (filter === "complete") {
      filtered = filtered.filter(job =>
        job.status === "Complete" || job.status === "Completed"
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

          <button
            onClick={() => router.push("/tech/dashboard")}
            style={{
              padding: "12px 24px",
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = "var(--danger-dark)"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "var(--primary)"}
          >
            ← Back to Dashboard
          </button>
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
            boxShadow: "0 2px 6px rgba(var(--info-rgb), 0.12)"
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
          boxShadow: "0 2px 4px rgba(var(--shadow-rgb),0.08)",
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
              transition: "border-color 0.2s, box-shadow 0.2s",
              backgroundColor: "var(--search-surface)",
              color: "var(--search-text)"
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--primary)";
              e.target.style.boxShadow = "0 0 0 3px rgba(var(--primary-rgb),0.12)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--search-surface-muted)";
              e.target.style.boxShadow = "none";
            }}
          />

          {/* Filter Buttons */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              { value: "all", label: "All Jobs" },
              { value: "in-progress", label: "In Progress" },
              { value: "pending", label: "Pending" },
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
            boxShadow: "0 4px 12px rgba(var(--shadow-rgb),0.08)",
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
              boxShadow: "none",
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
              {filteredJobs.map((job) => {
                const statusLabel = job.status || "Pending";
                const statusStyle = getStatusBadgeStyle(statusLabel);
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
                  router.push(`/job-cards/${job.jobNumber}/vhc`);
                };

                const handleVhcBadgeKeyDown = (event) => {
                  if (!vhcRequired) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleVhcBadgeClick(event);
                  }
                };

                const jobType = job.type || "Service";
                const isClockedOn = activeJobIds.has(job.id);
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
                    onClick={() => handleJobClick(job)}
                    style={{
                      border: "1px solid var(--surface-light)",
                      padding: "16px 20px",
                      borderRadius: "12px",
                      backgroundColor: "var(--surface)",
                      boxShadow: "0 2px 4px rgba(var(--shadow-rgb),0.05)",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "16px"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 6px 18px rgba(var(--primary-rgb),0.16)";
                      e.currentTarget.style.borderColor = "var(--danger)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(var(--shadow-rgb),0.05)";
                      e.currentTarget.style.borderColor = "var(--surface-light)";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        width: "560px",
                        flexShrink: 0
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: statusStyle.background,
                          color: statusStyle.color,
                          padding: "8px 14px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: "600",
                          whiteSpace: "nowrap",
                          minWidth: "140px",
                          textAlign: "center"
                        }}
                      >
                        {statusLabel}
                      </div>

                      {/* ✅ NEW: VHC Status Indicator */}
                      <div
                        role={vhcRequired ? "button" : undefined}
                        tabIndex={vhcRequired ? 0 : -1}
                        onClick={handleVhcBadgeClick}
                        onKeyDown={handleVhcBadgeKeyDown}
                        title={
                          vhcRequired
                            ? "Open the VHC checklist for this job"
                            : "This job does not require a VHC"
                        }
                        style={{
                          backgroundColor: vhcBgColor,
                          color: vhcColor,
                          padding: "6px 12px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: "700",
                          whiteSpace: "nowrap",
                          border: `2px solid ${vhcColor}`,
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          cursor: vhcRequired ? "pointer" : "default",
                          opacity: vhcRequired ? 1 : 0.85,
                          transition: "transform 0.2s ease"
                        }}
                        onMouseEnter={(e) => {
                          if (!vhcRequired) return;
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          if (!vhcRequired) return;
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        <div
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: vhcColor
                          }}
                        />
                        {vhcText}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            flexWrap: "wrap"
                          }}
                        >
                          <span
                            style={{
                              fontSize: "18px",
                              fontWeight: "700",
                              color: "var(--text-primary)"
                            }}
                          >
                            {job.jobNumber || "No Job #"}
                          </span>
                          <span
                            style={{
                              fontSize: "14px",
                              color: "var(--grey-accent-dark)",
                              fontWeight: "600"
                            }}
                          >
                            {job.reg || "No Reg"}
                          </span>
                        </div>

                        {stageBadges.length > 0 && (
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {stageBadges.slice(0, 3).map((stage) => (
                              <span
                                key={stage.id}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "4px 10px",
                                  borderRadius: "999px",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  color: "var(--primary-dark)",
                                  border: "1px solid rgba(var(--primary-rgb),0.3)",
                                  background: "rgba(var(--primary-rgb), 0.08)",
                                }}
                              >
                                {stage.label.split(" ").slice(0, 2).join(" ")} · {stage.count}
                              </span>
                            ))}
                            {stageBadges.length > 3 && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "4px 10px",
                                  borderRadius: "999px",
                                  fontSize: "11px",
                                  color: "var(--info)",
                                  border: "1px solid var(--accent-purple-surface)",
                                  background: "var(--info-surface)",
                                }}
                              >
                                +{stageBadges.length - 3} more
                              </span>
                            )}
                          </div>
                        )}

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            flexWrap: "wrap"
                          }}
                        >
                          <span style={{ fontSize: "12px", color: "var(--grey-accent-dark)" }}>
                            Customer: {job.customer || "Unknown"}
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--grey-accent-dark)" }}>
                            Type: {jobType}
                          </span>
                          <span style={{ fontSize: "12px", color: vhcColor }}>
                            {vhcRequired ? "VHC Required" : "VHC Not Required"}
                          </span>
                          <span
                            style={{ fontSize: "12px", color: isClockedOn ? "var(--success)" : "var(--info)" }}
                          >
                            {clockStateLabel}
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "var(--surface)",
                              backgroundColor: partsIndicatorColor,
                              padding: "2px 10px",
                              borderRadius: "999px"
                            }}
                          >
                            {partsPending ? "Parts Pending" : "No Parts Waiting"}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--grey-accent-light)"
                          }}
                        >
                          {makeModel}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "20px",
                        flex: 1,
                        justifyContent: "flex-end"
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "260px",
                          minWidth: "220px",
                          fontSize: "12px",
                          color: "var(--grey-accent-dark)",
                          lineHeight: "1.4"
                        }}
                      >
                        {description ? (
                          <span
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden"
                            }}
                          >
                            {description}
                          </span>
                        ) : (
                          <span style={{ color: "var(--background)" }}>No notes added</span>
                        )}
                      </div>

                      <div
                        style={{
                          minWidth: "140px",
                          textAlign: "center",
                          fontSize: "12px",
                          color: "var(--grey-accent-dark)"
                        }}
                      >
                        {createdAt || "N/A"}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          minWidth: "190px",
                          justifyContent: "flex-end"
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!job.jobNumber) return;
                            router.push(`/job-cards/${job.jobNumber}/write-up`);
                          }}
                          style={{
                            padding: "8px 14px",
                            backgroundColor: "var(--accent-purple-surface)",
                            color: "var(--accent-purple)",
                            border: "1px solid var(--accent-purple-surface)",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "600",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "var(--accent-purple-surface)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "var(--accent-purple-surface)";
                          }}
                        >
                          ✍️ Write-Up
                        </button>
                      </div>
                    </div>
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
          boxShadow: "0 2px 6px rgba(var(--primary-rgb),0.08)",
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
                {myJobs.filter(j => j.status === "In Progress").length}
              </div>
              <div style={{ fontSize: "13px", color: "var(--grey-accent)" }}>In Progress</div>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--danger)", marginBottom: "4px" }}>
                {myJobs.filter(j => j.status === "Pending" || j.status === "Open").length}
              </div>
              <div style={{ fontSize: "13px", color: "var(--grey-accent)" }}>Pending</div>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--info)", marginBottom: "4px" }}>
                {myJobs.filter(j => j.status === "Complete" || j.status === "Completed").length}
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
          boxShadow: "0 2px 6px rgba(var(--primary-rgb),0.08)"
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
