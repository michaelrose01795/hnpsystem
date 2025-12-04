// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/workshop/check-in.js

"use client"; // Enable client-side rendering for Next.js

import React, { useState, useEffect, useCallback } from "react"; // React hooks
import Layout from "@/components/Layout"; // Main layout wrapper
import { useUser } from "@/context/UserContext"; // Get logged-in user
import { useNextAction } from "@/context/NextActionContext"; // Next action dispatcher
import { getAllJobs } from "@/lib/database/jobs"; // Get all jobs
import { autoSetCheckedInStatus } from "@/lib/services/jobStatusService"; // Auto check-in function
import { supabaseClient } from "@/lib/supabaseClient"; // Supabase client for live counters

export default function CheckInPage() {
  const { user } = useUser(); // Get logged-in user
  const { triggerNextAction } = useNextAction(); // Hook to queue next action prompts
  const [jobs, setJobs] = useState([]); // All jobs for today
  const [loading, setLoading] = useState(true); // Loading state
  const [searchTerm, setSearchTerm] = useState(""); // Search filter
  const [checkingIn, setCheckingIn] = useState(null); // Job currently being checked in
  const [showCheckedIn, setShowCheckedIn] = useState(false); // Toggle to show already checked in jobs
  const [displayDate, setDisplayDate] = useState("Loading date..."); // Friendly header date label
  const [appointmentCounts, setAppointmentCounts] = useState({
    total: 0,
    checkedIn: 0,
    awaiting: 0,
  });
  const [countsLoading, setCountsLoading] = useState(true); // Loading state for counters

  // ✅ Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const today = getTodayDate();

  // ✅ Fetch appointment counters for today
  const fetchAppointmentCounters = useCallback(async () => {
    setCountsLoading(true);

    try {
      const { data, error } = await supabaseClient
        .from("appointments")
        .select(
          `
            appointment_id,
            scheduled_time,
            job:job_id(status)
          `
        )
        .gte("scheduled_time", `${today}T00:00:00`)
        .lte("scheduled_time", `${today}T23:59:59`);

      if (error) {
        console.error("❌ Error fetching appointment counters:", error);
        setAppointmentCounts({ total: 0, checkedIn: 0, awaiting: 0 });
        return;
      }

      const total = data?.length || 0;
      const checkedIn = (data || []).filter((entry) => {
        const status = (entry.job?.status || "").trim().toLowerCase();
        return status && status !== "booked";
      }).length;
      const awaiting = (data || []).filter((entry) => {
        const status = (entry.job?.status || "").trim().toLowerCase();
        return status === "booked";
      }).length;

      setAppointmentCounts({
        total,
        checkedIn,
        awaiting,
      });
    } catch (err) {
      console.error("❌ Unexpected error fetching appointment counters:", err);
      setAppointmentCounts({ total: 0, checkedIn: 0, awaiting: 0 });
    } finally {
      setCountsLoading(false);
    }
  }, [today]);

  // ✅ Fetch all jobs and filter for today's appointments
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    console.log("📅 Fetching today's appointments...");
    
    try {
      const allJobs = await getAllJobs(); // Get all jobs
      
      // Filter for jobs with appointments today
      const todaysJobs = allJobs.filter(job => {
        // Check if job has an appointment for today
        if (!job.appointment || !job.appointment.date) return false;
        
        return job.appointment.date === today;
      });
      
      console.log(`✅ Found ${todaysJobs.length} appointments for today`);
      
      // Sort by appointment time
      todaysJobs.sort((a, b) => {
        const timeA = a.appointment?.time || "00:00";
        const timeB = b.appointment?.time || "00:00";
        return timeA.localeCompare(timeB);
      });
      
      setJobs(todaysJobs);
      
    } catch (error) {
      console.error("❌ Error fetching jobs:", error);
      alert("Failed to load appointments. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [today]);

  // ✅ Fetch jobs on component mount
  useEffect(() => {
    fetchJobs();
    fetchAppointmentCounters();
  }, [fetchJobs, fetchAppointmentCounters]);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    setDisplayDate(formatter.format(new Date()));
  }, []);

  // ✅ Subscribe for live counter updates
  useEffect(() => {
    const channel = supabaseClient
      .channel("check-in-counters")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          fetchAppointmentCounters();
          fetchJobs();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs" },
        () => {
          fetchAppointmentCounters();
          fetchJobs(); // keep local list in sync with status changes elsewhere
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [fetchAppointmentCounters, fetchJobs]);

  // ✅ Handle check-in
  const handleCheckIn = async (job) => {
    // Confirm check-in
    const confirmed = confirm(
      `Check in customer?\n\n` +
      `Job: ${job.jobNumber}\n` +
      `Customer: ${job.customer}\n` +
      `Vehicle: ${job.reg}\n` +
      `Appointment: ${job.appointment.time}`
    );
    
    if (!confirmed) return;
    
    setCheckingIn(job.id); // Set loading state for this job
    
    try {
      console.log(`👤 Checking in job ${job.jobNumber}...`);
      
      // Call auto check-in function
      const result = await autoSetCheckedInStatus(job.id, user?.id || "SYSTEM");
      
      if (result.success) {
        console.log("✅ Customer checked in successfully");
        
        // Success notification
        alert(
          `✅ Customer Checked In!\n\n` +
          `Job: ${job.jobNumber}\n` +
          `Customer: ${job.customer}\n` +
          `Time: ${new Date().toLocaleTimeString()}`
        );
        
        triggerNextAction('job_checked_in', {
          jobId: job.id || null,
          jobNumber: job.jobNumber || '',
          vehicleId: job.vehicleId || job.vehicle_id || null,
          vehicleReg: job.reg || job.vehicleReg || job.vehicle_reg || '',
          triggeredBy: user?.id || null,
        });

        // Refresh jobs list
        await fetchJobs();
        await fetchAppointmentCounters();
      } else {
        console.error("❌ Check-in failed:", result.error);
        alert(`❌ Failed to check in: ${result.error?.message || "Unknown error"}`);
      }
      
    } catch (error) {
      console.error("❌ Error checking in:", error);
      alert("❌ Error checking in customer. Please try again.");
    } finally {
      setCheckingIn(null); // Clear loading state
    }
  };

  // ✅ Filter jobs based on search term and check-in status
  const filteredJobs = jobs.filter(job => {
    // Filter by check-in status
    const isCheckedIn = job.status === "Checked In" || 
                        job.status === "Workshop/MOT" || 
                        job.status === "VHC Complete" ||
                        job.status === "VHC Sent" ||
                        job.status === "Being Washed" ||
                        job.status === "Complete";
    
    if (showCheckedIn) {
      // Show only checked in
      if (!isCheckedIn) return false;
    } else {
      // Show only not checked in
      if (isCheckedIn) return false;
    }
    
    // Filter by search term
    if (!searchTerm.trim()) return true;
    
    const lower = searchTerm.toLowerCase();
    return (
      job.jobNumber?.toString().toLowerCase().includes(lower) ||
      job.reg?.toLowerCase().includes(lower) ||
      job.customer?.toLowerCase().includes(lower) ||
      job.makeModel?.toLowerCase().includes(lower)
    );
  });

  // ✅ Count stats
  const totalAppointments = appointmentCounts.total;
  const checkedInCount = appointmentCounts.checkedIn;
  const awaitingCheckIn = appointmentCounts.awaiting;

  // ✅ Loading state
  if (loading) {
    return (
      <Layout>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
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
          <p style={{ color: "var(--grey-accent)", fontSize: "16px" }}>Loading appointments...</p>
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
      <div style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "20px",
        overflow: "hidden"
      }}>
        {/* ✅ Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          flexShrink: 0
        }}>
          <div>
            <p style={{ fontSize: "16px", color: "var(--grey-accent)", margin: 0 }}>
              {displayDate}
            </p>
          </div>

          <button
            onClick={() => {
              fetchJobs();
              fetchAppointmentCounters();
            }}
            disabled={loading}
            style={{
              padding: "12px 24px",
              backgroundColor: loading ? "var(--background)" : "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = "var(--primary-dark)")}
            onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = "var(--primary)")}
          >
            🔄 Refresh
          </button>
        </div>

        {/* ✅ Stats Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          marginBottom: "24px",
          flexShrink: 0
        }}>
          <div style={{
            backgroundColor: "var(--surface)",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid var(--surface-light)",
            boxShadow: "0 2px 4px rgba(var(--shadow-rgb),0.05)"
          }}>
            <p style={{ fontSize: "13px", color: "var(--grey-accent)", margin: "0 0 8px 0" }}>
              Total Appointments
            </p>
            <p style={{ fontSize: "32px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
              {countsLoading ? "…" : totalAppointments}
            </p>
          </div>

          <div style={{
            backgroundColor: "var(--surface)",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid var(--surface-light)",
            boxShadow: "0 2px 4px rgba(var(--shadow-rgb),0.05)"
          }}>
            <p style={{ fontSize: "13px", color: "var(--grey-accent)", margin: "0 0 8px 0" }}>
              Checked In
            </p>
            <p style={{ fontSize: "32px", fontWeight: "700", color: "var(--info)", margin: 0 }}>
              {countsLoading ? "…" : checkedInCount}
            </p>
          </div>

          <div style={{
            backgroundColor: "var(--surface)",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid var(--surface-light)",
            boxShadow: "0 2px 4px rgba(var(--shadow-rgb),0.05)"
          }}>
            <p style={{ fontSize: "13px", color: "var(--grey-accent)", margin: "0 0 8px 0" }}>
              Awaiting Check-In
            </p>
            <p style={{ fontSize: "32px", fontWeight: "700", color: "var(--warning)", margin: 0 }}>
              {countsLoading ? "…" : awaitingCheckIn}
            </p>
          </div>
        </div>

        {/* ✅ Controls Bar */}
        <div style={{
          display: "flex",
          gap: "12px",
          marginBottom: "20px",
          flexShrink: 0
        }}>
          <input
            type="text"
            placeholder="🔍 Search by job number, reg, customer, or vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid var(--surface-light)",
              fontSize: "14px",
              outline: "none"
            }}
            onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
            onBlur={(e) => e.target.style.borderColor = "var(--surface-light)"}
          />

          <button
            onClick={() => setShowCheckedIn(!showCheckedIn)}
            style={{
              padding: "12px 20px",
              backgroundColor: showCheckedIn ? "var(--primary)" : "var(--surface)",
              color: showCheckedIn ? "white" : "var(--grey-accent)",
              border: "1px solid var(--surface-light)",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "all 0.2s"
            }}
          >
            {showCheckedIn ? "Show Awaiting" : "Show Checked In"}
          </button>
        </div>

        {/* ✅ No Appointments Message */}
        {jobs.length === 0 ? (
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--surface)",
            borderRadius: "12px",
            border: "1px solid var(--surface-light)"
          }}>
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div style={{ fontSize: "64px", marginBottom: "16px" }}>📅</div>
              <p style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)", margin: "0 0 8px 0" }}>
                No Appointments Today
              </p>
              <p style={{ fontSize: "14px", color: "var(--grey-accent)", margin: 0 }}>
                There are no scheduled appointments for today
              </p>
            </div>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--surface)",
            borderRadius: "12px",
            border: "1px solid var(--surface-light)"
          }}>
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div style={{ fontSize: "64px", marginBottom: "16px" }}>🔍</div>
              <p style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)", margin: "0 0 8px 0" }}>
                No Results Found
              </p>
              <p style={{ fontSize: "14px", color: "var(--grey-accent)", margin: 0 }}>
                {searchTerm.trim() 
                  ? "Try adjusting your search terms"
                  : showCheckedIn 
                    ? "No customers have been checked in yet"
                    : "All customers have been checked in"
                }
              </p>
            </div>
          </div>
        ) : (
          /* ✅ Appointments Table */
          <div style={{
            flex: 1,
            overflowY: "auto",
            backgroundColor: "var(--surface)",
            borderRadius: "12px",
            border: "1px solid var(--surface-light)",
            boxShadow: "0 2px 4px rgba(var(--shadow-rgb),0.05)"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{
                position: "sticky",
                top: 0,
                backgroundColor: "var(--info-surface)",
                zIndex: 1
              }}>
                <tr style={{ borderBottom: "2px solid var(--surface-light)" }}>
                  <th style={tableHeaderStyle}>Time</th>
                  <th style={tableHeaderStyle}>Job #</th>
                  <th style={tableHeaderStyle}>Registration</th>
                  <th style={tableHeaderStyle}>Customer</th>
                  <th style={tableHeaderStyle}>Job Type</th>
                  <th style={tableHeaderStyle}>Customer Status</th>
                  <th style={tableHeaderStyle}>Estimated Finish</th>
                  <th style={tableHeaderStyle}>Job Source</th>
                  <th style={tableHeaderStyle}>VHC Required</th>
                  <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job, index) => {
                  const statusNormalized = (job.status || "").trim().toLowerCase();
                  const isBooked = statusNormalized === "booked";
                  const isCheckedIn =
                    ["checked in", "workshop/mot", "vhc complete", "vhc sent", "being washed", "complete"].includes(
                      statusNormalized
                    ) || !isBooked;
                  const isCurrentlyCheckingIn = checkingIn === job.id;
                  
                  return (
                    <tr
                      key={job.id || index}
                      style={{
                        borderBottom: "1px solid var(--info-surface)",
                        backgroundColor: isCheckedIn ? "var(--success-surface)" : "white",
                        transition: "background-color 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        if (!isCheckedIn) {
                          e.currentTarget.style.backgroundColor = "var(--info-surface)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isCheckedIn ? "var(--success-surface)" : "white";
                      }}
                    >
                      <td style={tableCellStyle}>
                        <span style={{ fontWeight: "600", fontSize: "16px" }}>
                          {job.appointment?.time || "N/A"}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{ fontWeight: "600", color: "var(--primary)" }}>
                          {job.jobNumber}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{ fontWeight: "600" }}>
                          {job.reg || "N/A"}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        {job.customer || "N/A"}
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>
                          {getDetectedJobTypeLabel(job)}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <span
                          style={{
                            padding: "6px 12px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: "600",
                            ...getCustomerStatusBadgeColors(job.waitingStatus || "Neither"),
                          }}
                        >
                          {job.waitingStatus || "Neither"}
                        </span>
                      </td>
                      <td style={{ ...tableCellStyle, fontWeight: "600" }}>
                        {getEstimatedFinishTime(job)}
                      </td>
                      <td style={tableCellStyle}>
                        {job.jobSource || "Retail"}
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "700",
                          backgroundColor: job.vhcRequired ? "var(--info-surface)" : "var(--info-surface)",
                          color: job.vhcRequired ? "var(--info-dark)" : "var(--info-dark)",
                          display: "inline-block"
                        }}>
                          {job.vhcRequired ? "Yes" : "No"}
                        </span>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: "center" }}>
                        {isBooked ? (
                          <button
                            onClick={() => handleCheckIn(job)}
                            disabled={isCurrentlyCheckingIn}
                            style={{
                              padding: "8px 16px",
                              backgroundColor: isCurrentlyCheckingIn ? "var(--background)" : "var(--info)",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: isCurrentlyCheckingIn ? "not-allowed" : "pointer",
                              fontSize: "13px",
                              fontWeight: "600",
                              transition: "background-color 0.2s"
                            }}
                            onMouseEnter={(e) => !isCurrentlyCheckingIn && (e.target.style.backgroundColor = "var(--info-dark)")}
                            onMouseLeave={(e) => !isCurrentlyCheckingIn && (e.target.style.backgroundColor = "var(--info)")}
                          >
                            {isCurrentlyCheckingIn ? "Checking In..." : "Check In"}
                          </button>
                        ) : (
                          <span style={{
                            padding: "8px 16px",
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: "600",
                            backgroundColor: "var(--success)",
                            color: "var(--info-dark)"
                          }}>
                            ✓ Checked In
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ✅ Footer */}
        {filteredJobs.length > 0 && (
          <div style={{
            marginTop: "16px",
            fontSize: "14px",
            color: "var(--info)",
            textAlign: "center",
            flexShrink: 0
          }}>
            Showing {filteredJobs.length} of {jobs.length} appointments
          </div>
        )}
      </div>
    </Layout>
  );
}

// ✅ Helpers for job list fields
function normalizeJobCategoryLabel(rawLabel) {
  if (!rawLabel || typeof rawLabel !== "string") return null;
  const cleaned = rawLabel.trim().toLowerCase();

  if (cleaned === "service") return "service";
  if (cleaned === "mot") return "mot";
  if (cleaned === "diagnostic" || cleaned === "diagnostics" || cleaned === "diagnosis")
    return "diagnosis";
  if (cleaned === "other") return "other";

  return null;
}

function getDetectedJobTypeLabel(job) {
  const categories = Array.isArray(job.jobCategories) ? job.jobCategories : job.job_categories || [];
  const normalized = new Set(
    categories.map((category) => normalizeJobCategoryLabel(category)).filter(Boolean)
  );

  if (normalized.size === 0) {
    const fallbackType = (job.type || "").trim().toLowerCase();
    if (fallbackType.includes("mot")) {
      normalized.add("mot");
    } else if (fallbackType.includes("diag")) {
      normalized.add("diagnosis");
    } else if (fallbackType.includes("service")) {
      normalized.add("service");
    }
  }

  if (normalized.size === 0) {
    normalized.add("other");
  }

  return Array.from(normalized)
    .map((label) => {
      if (label === "mot") return "MOT";
      if (label === "diagnosis") return "Diagnostic";
      if (label === "service") return "Service";
      return "Other";
    })
    .join(", ");
}

function getCustomerStatusBadgeColors(status) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "waiting") {
    return { backgroundColor: "var(--surface-light)", color: "var(--danger)" };
  }
  if (normalized === "loan car") {
    return { backgroundColor: "var(--info-surface)", color: "var(--info)" };
  }
  if (normalized === "collection") {
    return { backgroundColor: "var(--warning-surface)", color: "var(--warning)" };
  }
  return { backgroundColor: "var(--success-surface)", color: "var(--success-dark)" };
}

function getEstimatedFinishTime(job) {
  const appointment = job.appointment;
  if (!appointment?.date || !appointment?.time) return "-";

  const start = new Date(`${appointment.date}T${appointment.time}:00`);
  if (Number.isNaN(start.getTime())) return "-";

  const baseHours = 2; // Simple base estimate for workshop work
  const finish = new Date(start.getTime() + baseHours * 60 * 60 * 1000);
  return finish.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ✅ Helper function for status colors
function getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case "booked":
      return "var(--info)";
    case "checked in":
      return "var(--accent-purple)";
    case "workshop/mot":
      return "var(--warning)";
    case "vhc complete":
      return "var(--info)";
    case "vhc sent":
      return "var(--accent-purple)";
    case "being washed":
      return "var(--info)";
    case "complete":
      return "var(--info)";
    default:
      return "var(--info)";
  }
}

// ✅ Reusable table styles
const tableHeaderStyle = {
  padding: "14px 16px",
  textAlign: "left",
  fontSize: "13px",
  fontWeight: "600",
  color: "var(--info)",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const tableCellStyle = {
  padding: "14px 16px",
  fontSize: "14px",
  color: "var(--info-dark)"
};
