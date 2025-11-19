// file location: src/pages/job-cards/myjobs/[jobNumber].js

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { useNextAction } from "@/context/NextActionContext";
import { useRoster } from "@/context/RosterContext";
import { getJobByNumber, updateJobStatus } from "@/lib/database/jobs";
import { getVHCChecksByJob } from "@/lib/database/vhc";
import { getClockingStatus } from "@/lib/database/clocking";
import { clockInToJob, clockOutFromJob, getUserActiveJobs } from "@/lib/database/jobClocking";

// Status color mapping for consistency
const STATUS_COLORS = {
  "Outstanding": "#9ca3af",
  "Accepted": "#d10000",
  "In Progress": "#3b82f6",
  "Awaiting Authorization": "#fbbf24",
  "Authorized": "#9333ea",
  "Ready": "#10b981",
  "Carry Over": "#f97316",
  "Complete": "#06b6d4",
  "Sent": "#8b5cf6",
  "Viewed": "#06b6d4",
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

  const jobCardId = jobData?.jobCard?.id ?? null;
  const jobCardNumber = jobData?.jobCard?.jobNumber ?? jobNumber;
  const username = user?.username?.trim();

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

    const confirmed = confirm(`Clock out from Job ${jobCardNumber}?`);
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

  // ✅ NOW all useEffects come AFTER all callbacks are defined

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

  // Effect: Fetch job data on component mount
  useEffect(() => {
    if (!jobNumber) return;

    const fetchData = async () => {
      setLoading(true);

      try {
        // Fetch job details
        const { data: job, error: jobError } = await getJobByNumber(jobNumber);

        if (jobError || !job) {
          alert("Job not found");
          router.push("/job-cards/myjobs");
          return;
        }

        setJobData(job);

        // Fetch VHC checks for this job
        const jobCardId = job?.jobCard?.id;
        if (jobCardId) {
          const checks = await getVHCChecksByJob(jobCardId);
          setVhcChecks(checks);
        } else {
          setVhcChecks([]);
        }

        await refreshClockingStatus();

      } catch (fetchError) {
        console.error("❌ Error fetching job:", fetchError);
        alert("Failed to load job");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jobNumber, router, refreshClockingStatus]);

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

    const confirmed = confirm(`Update job status to "${newStatus}"?`);
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
    if (!newNote.trim()) {
      alert("Please enter a note");
      return;
    }

    // TODO: Implement notes system with database integration
    alert("Note saved: " + newNote);
    setNewNote("");
    setShowAddNote(false);
  };

  // Handler: VHC button click - only navigate if VHC is required
  const handleVhcClick = () => {
    if (!jobData?.jobCard?.vhcRequired) {
      alert("VHC is not required for this job.");
      return;
    }
    // Navigate to VHC builder page
    const targetJobNumber = jobData?.jobCard?.jobNumber || jobNumber;
    router.push(`/job-cards/${targetJobNumber}/vhc`);
  };

  // Helper: Get dynamic VHC button text based on job status
  const getVhcButtonText = () => {
    const jobCardStatus = jobData?.jobCard?.status;
    if (!jobData?.jobCard?.vhcRequired) return "VHC Not Required";
    if (["VHC Complete", "VHC Sent"].includes(jobCardStatus)) return "✅ VHC Complete";
    if (vhcChecks.length === 0) return "🚀 Start VHC";
    return "📋 Continue VHC";
  };

  // Helper: Get VHC status message
  const getVhcStatusMessage = () => {
    const jobCardStatus = jobData?.jobCard?.status;
    if (!jobData?.jobCard?.vhcRequired) return "This job does not require a Vehicle Health Check.";
    if (["VHC Complete", "VHC Sent"].includes(jobCardStatus)) {
      return "VHC completed. Review or resend if required.";
    }
    if (vhcChecks.length === 0) return "Ready to start the Vehicle Health Check.";
    return "Continue working through the outstanding VHC items.";
  };

  // Helper: Calculate VHC summary (red and amber items)
  const getVhcSummary = () => {
    const redItems = vhcChecks.filter(c => 
      c.section === "Brakes" || c.severity === "Red"
    );
    const amberItems = vhcChecks.filter(c => 
      c.section === "Tyres" || c.severity === "Amber"
    );
    
    return { redCount: redItems.length, amberCount: amberItems.length };
  };

  const vhcSummary = getVhcSummary();

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
      <Layout>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2 style={{ color: "#d10000" }}>Access Denied</h2>
          <p>This page is only for Technicians.</p>
        </div>
      </Layout>
    );
  }

  // Loading state with spinner animation
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
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #d10000",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ color: "#666" }}>Loading job...</p>
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
      <Layout>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2 style={{ color: "#d10000" }}>Job Not Found</h2>
          <button
            onClick={() => router.push("/job-cards/myjobs")}
            style={{
              padding: "12px 24px",
              backgroundColor: "#d10000",
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
  const jobCardStatus = jobCard?.status || "Unknown";
  const jobStatusColor = STATUS_COLORS[jobCardStatus] || "#9ca3af";
  const partsCount = jobCard.partsRequests?.length || 0;
  const clockedHours = clockingStatus?.clock_in
    ? `${calculateHoursWorked(clockingStatus.clock_in)}h`
    : "0.0h";

  // Quick stats data for display
  const quickStats = [
    {
      label: "Status",
      value: jobCardStatus,
      accent: jobStatusColor,
      pill: true,
    },
    {
      label: "Job Type",
      value: jobCard.type || "General",
      accent: "#1f2937",
      pill: false,
    },
    {
      label: "VHC Checks",
      value: vhcChecks.length,
      accent: "#0369a1",
      pill: false,
    },
    {
      label: "Parts Requests",
      value: partsCount,
      accent: "#f97316",
      pill: false,
    },
    {
      label: "Clocked Hours",
      value: clockedHours,
      accent: "#16a34a",
      pill: false,
    },
  ];

  // Check if additional contents are available
  const hasAdditionalContents = () => {
    const filesCount = jobCard.files?.length || 0;
    const notesCount = jobCard.notes?.length || 0;
    const partsCount = jobCard.partsRequests?.length || 0;
    const hasWriteUp = Boolean(jobCard.writeUp);
    return filesCount > 0 || notesCount > 0 || partsCount > 0 || hasWriteUp;
  };

  const additionalAvailable = hasAdditionalContents();

  if (rosterLoading) {
    return (
      <Layout>
        <div style={{ padding: "24px", color: "#6B7280" }}>Loading roster…</div>
      </Layout>
    );
  }

  return (
    <Layout>
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
          backgroundColor: "#fff",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
          flexShrink: 0
        }}>
          <button
            onClick={() => router.push("/job-cards/myjobs")}
            style={{
              padding: "10px 24px",
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 4px 10px rgba(209,0,0,0.16)",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a60a0a")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d10000")}
          >
            ← Back
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ 
              color: "#d10000", 
              fontSize: "28px", 
              fontWeight: "700",
              margin: "0 0 4px 0"
            }}>
              Job #{jobCard.jobNumber}
            </h1>
            <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
              {customer.firstName} {customer.lastName} | {vehicle.reg}
            </p>
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            backgroundColor: "white",
            border: "1px solid #ffe5e5",
            borderRadius: "12px",
            padding: "10px 18px",
            boxShadow: "0 4px 12px rgba(209,0,0,0.08)"
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
            <span style={{ fontSize: "12px", color: "#6b7280" }}>
              Updated {formatDateTime(jobCard.updatedAt)}
            </span>
          </div>
        </div>

        {/* Job Summary Card */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 24px",
          borderRadius: "8px",
          backgroundColor: "white",
          border: "1px solid #ffe5e5",
          boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
          gap: "24px",
          marginBottom: "12px",
          flexShrink: 0
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "#d10000", fontWeight: "600", letterSpacing: "0.06em" }}>
              JOB SUMMARY
            </span>
            <h2 style={{
              color: "#1f2937",
              fontSize: "28px",
              fontWeight: "700",
              margin: 0
            }}>
              #{jobCard.jobNumber} • {vehicle.reg}
            </h2>
            <span style={{ fontSize: "15px", color: "#6b7280" }}>
              {customer.firstName} {customer.lastName} • {vehicle.makeModel}
            </span>
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            borderLeft: "1px solid #ffe5e5",
            paddingLeft: "20px"
          }}>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600" }}>Booked</span>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#1f2937" }}>
                {formatDateTime(jobCard.createdAt)}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600" }}>Advisor</span>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#1f2937" }}>
                {jobCard.serviceAdvisor || "TBC"}
              </div>
            </div>
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
                backgroundColor: "white",
                border: "1px solid #ffe5e5",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
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
              <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em" }}>
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
                backgroundColor: activeTab === tab ? "#d10000" : "white",
                color: activeTab === tab ? "white" : "#d10000",
                border: activeTab === tab ? "2px solid #d10000" : "1px solid #ffe5e5",
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
            boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
            border: "1px solid #ffe5e5",
            background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
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
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(209,0,0,0.08)",
                border: "1px solid #ffe5e5"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
                  Job Details
                </h3>
                {jobCard.requests && jobCard.requests.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <strong style={{ fontSize: "14px", color: "#6b7280", letterSpacing: "0.04em" }}>Customer Requests:</strong>
                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      {jobCard.requests.map((req, i) => (
                        <div key={i} style={{
                          padding: "14px 16px",
                          backgroundColor: "#fff5f5",
                          borderLeft: "4px solid #d10000",
                          borderRadius: "10px",
                          color: "#1f2937",
                          boxShadow: "0 2px 6px rgba(209,0,0,0.08)"
                        }}>
                          {req.text || req}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {jobCard.cosmeticNotes && (
                  <div>
                    <strong style={{ fontSize: "14px", color: "#6b7280", letterSpacing: "0.04em" }}>Cosmetic Notes:</strong>
                    <p style={{ marginTop: "10px", color: "#374151", lineHeight: 1.6 }}>{jobCard.cosmeticNotes}</p>
                  </div>
                )}
              </div>

              {/* Vehicle Info */}
              <div style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(209,0,0,0.08)",
                border: "1px solid #ffe5e5"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
                  Vehicle Information
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                  <div>
                    <span style={{ fontSize: "13px", color: "#666" }}>Registration:</span>
                    <p style={{ fontSize: "16px", fontWeight: "600", color: "#d10000", margin: "4px 0 0 0" }}>
                      {vehicle.reg}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: "13px", color: "#666" }}>Make & Model:</span>
                    <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                      {vehicle.makeModel}
                    </p>
                  </div>
                  {vehicle.mileage && (
                    <div>
                      <span style={{ fontSize: "13px", color: "#666" }}>Mileage:</span>
                      <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                        {vehicle.mileage.toLocaleString()} miles
                      </p>
                    </div>
                  )}
                  {vehicle.colour && (
                    <div>
                      <span style={{ fontSize: "13px", color: "#666" }}>Colour:</span>
                      <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                        {vehicle.colour}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Info */}
              <div style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(209,0,0,0.08)",
                border: "1px solid #ffe5e5"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
                  Customer Information
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                  <div>
                    <span style={{ fontSize: "13px", color: "#666" }}>Name:</span>
                    <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                      {customer.firstName} {customer.lastName}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: "13px", color: "#666" }}>Mobile:</span>
                    <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                      {customer.mobile}
                    </p>
                  </div>
                  {customer.email && (
                    <div>
                      <span style={{ fontSize: "13px", color: "#666" }}>Email:</span>
                      <p style={{ fontSize: "16px", fontWeight: "600", color: "#007bff", margin: "4px 0 0 0" }}>
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
            <div style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(209,0,0,0.08)",
              border: "1px solid #ffe5e5",
              display: "flex",
              flexDirection: "column",
              gap: "20px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>
                  Vehicle Health Check
                </h3>
                
                {/* Start/Continue VHC Button */}
                <button
                  onClick={handleVhcClick}
                  disabled={!jobRequiresVhc}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: jobRequiresVhc ? "#d10000" : "#e0e0e0",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: jobRequiresVhc ? "pointer" : "not-allowed",
                    fontSize: "14px",
                    fontWeight: "600",
                    boxShadow: jobRequiresVhc ? "0 4px 12px rgba(209,0,0,0.2)" : "none",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    if (jobRequiresVhc) {
                      e.currentTarget.style.backgroundColor = "#b00000";
                      e.currentTarget.style.boxShadow = "0 6px 16px rgba(209,0,0,0.3)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (jobRequiresVhc) {
                      e.currentTarget.style.backgroundColor = "#d10000";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(209,0,0,0.2)";
                    }
                  }}
                >
                  {getVhcButtonText()}
                </button>
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                {getVhcStatusMessage()}
              </div>

              {/* VHC Not Required Message */}
              {!jobRequiresVhc && (
                <div style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#9ca3af",
                  backgroundColor: "#f9fafb",
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb"
                }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>ℹ️</div>
                  <p style={{ fontSize: "16px", fontWeight: "600", color: "#6b7280" }}>
                    VHC Not Required
                  </p>
                  <p style={{ fontSize: "14px", color: "#9ca3af", marginTop: "8px" }}>
                    A Vehicle Health Check was not added to this job.
                  </p>
                </div>
              )}

              {/* VHC Required - Show Summary */}
              {jobRequiresVhc && (
                <>
                  {/* VHC Summary Stats */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "16px",
                    marginBottom: "16px"
                  }}>
                    <div style={{
                      padding: "20px",
                      backgroundColor: "#fef2f2",
                      borderRadius: "12px",
                      border: "1px solid #fecaca",
                      textAlign: "center"
                    }}>
                      <div style={{ fontSize: "32px", fontWeight: "700", color: "#dc2626" }}>
                        {vhcSummary.redCount}
                      </div>
                      <div style={{ fontSize: "13px", color: "#991b1b", fontWeight: "600", marginTop: "4px" }}>
                        RED ITEMS
                      </div>
                    </div>
                    <div style={{
                      padding: "20px",
                      backgroundColor: "#fffbeb",
                      borderRadius: "12px",
                      border: "1px solid #fde68a",
                      textAlign: "center"
                    }}>
                      <div style={{ fontSize: "32px", fontWeight: "700", color: "#d97706" }}>
                        {vhcSummary.amberCount}
                      </div>
                      <div style={{ fontSize: "13px", color: "#92400e", fontWeight: "600", marginTop: "4px" }}>
                        AMBER ITEMS
                      </div>
                    </div>
                    <div style={{
                      padding: "20px",
                      backgroundColor: "#f0f9ff",
                      borderRadius: "12px",
                      border: "1px solid #bfdbfe",
                      textAlign: "center"
                    }}>
                      <div style={{ fontSize: "32px", fontWeight: "700", color: "#0369a1" }}>
                        {vhcChecks.length}
                      </div>
                      <div style={{ fontSize: "13px", color: "#075985", fontWeight: "600", marginTop: "4px" }}>
                        TOTAL CHECKS
                      </div>
                    </div>
                  </div>

                  {/* VHC Checks List */}
                  {vhcChecks.length === 0 ? (
                    <div style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "#9ca3af",
                      backgroundColor: "#fff5f5",
                      borderRadius: "12px",
                      border: "1px solid #ffd6d6"
                    }}>
                      <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
                      <p style={{ fontSize: "16px", fontWeight: "600" }}>No VHC Checks Added Yet</p>
                      <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "8px" }}>
                        Click &quot;Start VHC&quot; above to begin the vehicle health check.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <h4 style={{ 
                        fontSize: "14px", 
                        fontWeight: "600", 
                        color: "#6b7280", 
                        textTransform: "uppercase", 
                        letterSpacing: "0.05em",
                        marginBottom: "8px"
                      }}>
                        Items Found ({vhcChecks.length})
                      </h4>
                      {vhcChecks.map(check => {
                        const isRed = check.section === "Brakes" || check.severity === "Red";
                        const isAmber = check.section === "Tyres" || check.severity === "Amber";
                        const badgeColor = isRed ? "#dc2626" : isAmber ? "#d97706" : "#6b7280";
                        const bgColor = isRed ? "#fef2f2" : isAmber ? "#fffbeb" : "#f9fafb";
                        const borderColor = isRed ? "#fecaca" : isAmber ? "#fde68a" : "#e5e7eb";

                        return (
                          <div key={check.vhc_id} style={{
                            padding: "16px",
                            border: `1px solid ${borderColor}`,
                            borderLeft: `4px solid ${badgeColor}`,
                            borderRadius: "12px",
                            backgroundColor: bgColor,
                            boxShadow: "0 2px 6px rgba(0,0,0,0.06)"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                                  <span style={{
                                    padding: "4px 10px",
                                    backgroundColor: badgeColor,
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    fontWeight: "700",
                                    color: "white",
                                    letterSpacing: "0.05em",
                                    textTransform: "uppercase"
                                  }}>
                                    {isRed ? "RED" : isAmber ? "AMBER" : "INFO"}
                                  </span>
                                  <span style={{
                                    fontSize: "12px",
                                    color: "#6b7280",
                                    fontWeight: "600"
                                  }}>
                                    {check.section}
                                  </span>
                                </div>
                                <p style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 6px 0", color: "#1f2937" }}>
                                  {check.issue_title}
                                </p>
                                <p style={{ fontSize: "14px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                                  {check.issue_description}
                                </p>
                              </div>
                              {check.measurement && (
                                <div style={{
                                  padding: "10px 18px",
                                  backgroundColor: "white",
                                  color: badgeColor,
                                  borderRadius: "10px",
                                  fontSize: "18px",
                                  fontWeight: "700",
                                  border: `2px solid ${badgeColor}`,
                                  marginLeft: "16px"
                                }}>
                                  £{parseFloat(check.measurement).toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* PARTS TAB */}
          {activeTab === "parts" && (
            <div style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(209,0,0,0.08)",
              border: "1px solid #ffe5e5",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              alignItems: "center"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "8px" }}>⚙️</div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>
                Parts Requests
              </h3>
              <p style={{ color: "#6b7280", margin: 0 }}>
                Track, raise and monitor parts needed to complete the job.
              </p>
              <button
                onClick={() => alert("Parts request feature coming soon")}
                style={{
                  padding: "12px 26px",
                  backgroundColor: "#d10000",
                  color: "white",
                  border: "1px solid #b91c1c",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: "600",
                  boxShadow: "0 4px 12px rgba(209,0,0,0.18)"
                }}
              >
                + Request Parts
              </button>
              <div style={{
                width: "100%",
                padding: "24px",
                backgroundColor: "#fff5f5",
                borderRadius: "12px",
                border: "1px solid #ffd6d6",
                color: "#9ca3af"
              }}>
                <p style={{ margin: 0 }}>No parts requested yet</p>
              </div>
            </div>
          )}

          {/* NOTES TAB */}
          {activeTab === "notes" && (
            <div style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(209,0,0,0.08)",
              border: "1px solid #ffe5e5",
              display: "flex",
              flexDirection: "column",
              gap: "20px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>
                  Technician Notes
                </h3>
                <button
                  onClick={() => setShowAddNote(true)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#d10000",
                    color: "white",
                    border: "1px solid #b91c1c",
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
                  backgroundColor: "#fff5f5",
                  borderRadius: "12px",
                  border: "1px solid #ffd6d6"
                }}>
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note about the job..."
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      border: "1px solid #fca5a5",
                      borderRadius: "10px",
                      resize: "vertical",
                      minHeight: "110px",
                      fontSize: "14px",
                      marginBottom: "12px",
                      backgroundColor: "white"
                    }}
                  />
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setShowAddNote(false)}
                      style={{
                        padding: "10px 18px",
                        backgroundColor: "white",
                        color: "#6b7280",
                        border: "1px solid #d1d5db",
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
                      style={{
                        padding: "10px 18px",
                        backgroundColor: "#10b981",
                        color: "white",
                        border: "1px solid #0f766e",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "600",
                        boxShadow: "0 4px 10px rgba(16,185,129,0.2)"
                      }}
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              )}

              <div style={{
                textAlign: "center",
                padding: "40px",
                color: "#9ca3af",
                backgroundColor: "#fff5f5",
                borderRadius: "12px",
                border: "1px solid #ffd6d6"
              }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📝</div>
                <p style={{ fontSize: "16px", fontWeight: "600", marginBottom: "4px" }}>No notes added yet</p>
                <p style={{ fontSize: "14px", color: "#6b7280" }}>
                  Keep technicians aligned by logging progress, issues and next steps.
                </p>
              </div>
            </div>
          )}

          {/* WRITE-UP TAB */}
          {activeTab === "write-up" && (
            <div style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(209,0,0,0.08)",
              border: "1px solid #ffe5e5",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              alignItems: "center"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "8px" }}>📄</div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>
                Job Write-Up
              </h3>
              <p style={{ color: "#6b7280", margin: 0, maxWidth: "520px" }}>
                Complete the job write-up form to document all work performed and capture handover notes for the service advisor.
              </p>
              <button
                onClick={() => router.push(`/job-cards/${jobNumber}/write-up`)}
                style={{
                  padding: "14px 28px",
                  backgroundColor: "#d10000",
                  color: "white",
                  border: "1px solid #b91c1c",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: "600",
                  boxShadow: "0 6px 16px rgba(209,0,0,0.18)"
                }}
              >
                Open Write-Up Form →
              </button>
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
          borderTop: "2px solid #ffd6d6",
          flexShrink: 0
        }}>
          {/* Back to My Jobs Button */}
          <button
            onClick={() => router.push("/job-cards/myjobs")}
            style={{
              padding: "14px",
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 2px 8px rgba(209,0,0,0.18)"
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
                backgroundColor: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: clockOutLoading || clockInLoading ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "600",
                boxShadow: "0 2px 8px rgba(239,68,68,0.18)",
                opacity: clockOutLoading ? 0.8 : 1,
                transition: "background-color 0.2s ease"
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
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: clockInLoading || clockOutLoading ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "600",
                boxShadow: "0 2px 8px rgba(16,185,129,0.18)",
                opacity: clockInLoading ? 0.8 : 1,
                transition: "background-color 0.2s ease"
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
              backgroundColor: "#f5f3ff",
              color: "#5b21b6",
              border: "1px solid #ddd6fe",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 2px 8px rgba(91,33,182,0.16)"
            }}
          >
            ✍️ Write-Up
          </button>

          {/* Complete Job Button - Dynamic based on availability */}
          <button
            onClick={() => {
              if (additionalAvailable) {
                setShowAdditionalContents(true);
              }
            }}
            disabled={!additionalAvailable}
            style={{
              padding: "14px",
              backgroundColor: additionalAvailable ? "#10b981" : "#d1fae5",
              color: additionalAvailable ? "white" : "#6b7280",
              border: "none",
              borderRadius: "8px",
              cursor: additionalAvailable ? "pointer" : "not-allowed",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: additionalAvailable ? "0 2px 8px rgba(16,185,129,0.18)" : "none"
            }}
          >
            ✓ Complete Job
          </button>
        </div>
      </div>
    </Layout>
  );
}