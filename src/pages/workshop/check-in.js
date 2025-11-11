// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/workshop/check-in.js

"use client"; // Enable client-side rendering for Next.js

import React, { useState, useEffect } from "react"; // React hooks
import Layout from "@/components/Layout"; // Main layout wrapper
import { useUser } from "@/context/UserContext"; // Get logged-in user
import { useNextAction } from "@/context/NextActionContext"; // Next action dispatcher
import { getAllJobs } from "@/lib/database/jobs"; // Get all jobs
import { autoSetCheckedInStatus } from "@/lib/services/jobStatusService"; // Auto check-in function

export default function CheckInPage() {
  const { user } = useUser(); // Get logged-in user
  const { triggerNextAction } = useNextAction(); // Hook to queue next action prompts
  const [jobs, setJobs] = useState([]); // All jobs for today
  const [loading, setLoading] = useState(true); // Loading state
  const [searchTerm, setSearchTerm] = useState(""); // Search filter
  const [checkingIn, setCheckingIn] = useState(null); // Job currently being checked in
  const [showCheckedIn, setShowCheckedIn] = useState(false); // Toggle to show already checked in jobs

  // ✅ Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const today = getTodayDate();

  // ✅ Fetch jobs on component mount
  useEffect(() => {
    fetchJobs();
  }, []);

  // ✅ Fetch all jobs and filter for today's appointments
  const fetchJobs = async () => {
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
  };

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
  const totalAppointments = jobs.length;
  const checkedInCount = jobs.filter(job => 
    ["Checked In", "Workshop/MOT", "VHC Complete", "VHC Sent", "Being Washed", "Complete"].includes(job.status)
  ).length;
  const awaitingCheckIn = totalAppointments - checkedInCount;

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
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #d10000",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ color: "#666", fontSize: "16px" }}>Loading appointments...</p>
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
            <p style={{ fontSize: "16px", color: "#666", margin: 0 }}>
              {new Date().toLocaleDateString('en-GB', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>

          <button
            onClick={fetchJobs}
            disabled={loading}
            style={{
              padding: "12px 24px",
              backgroundColor: loading ? "#ccc" : "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = "#b00000")}
            onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = "#d10000")}
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
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <p style={{ fontSize: "13px", color: "#666", margin: "0 0 8px 0" }}>
              Total Appointments
            </p>
            <p style={{ fontSize: "32px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
              {totalAppointments}
            </p>
          </div>

          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <p style={{ fontSize: "13px", color: "#666", margin: "0 0 8px 0" }}>
              Checked In
            </p>
            <p style={{ fontSize: "32px", fontWeight: "700", color: "#10b981", margin: 0 }}>
              {checkedInCount}
            </p>
          </div>

          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <p style={{ fontSize: "13px", color: "#666", margin: "0 0 8px 0" }}>
              Awaiting Check-In
            </p>
            <p style={{ fontSize: "32px", fontWeight: "700", color: "#f59e0b", margin: 0 }}>
              {awaitingCheckIn}
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
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              outline: "none"
            }}
            onFocus={(e) => e.target.style.borderColor = "#d10000"}
            onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
          />

          <button
            onClick={() => setShowCheckedIn(!showCheckedIn)}
            style={{
              padding: "12px 20px",
              backgroundColor: showCheckedIn ? "#d10000" : "#f5f5f5",
              color: showCheckedIn ? "white" : "#666",
              border: "1px solid #e0e0e0",
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
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid #e0e0e0"
          }}>
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div style={{ fontSize: "64px", marginBottom: "16px" }}>📅</div>
              <p style={{ fontSize: "18px", fontWeight: "600", color: "#1a1a1a", margin: "0 0 8px 0" }}>
                No Appointments Today
              </p>
              <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
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
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid #e0e0e0"
          }}>
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div style={{ fontSize: "64px", marginBottom: "16px" }}>🔍</div>
              <p style={{ fontSize: "18px", fontWeight: "600", color: "#1a1a1a", margin: "0 0 8px 0" }}>
                No Results Found
              </p>
              <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
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
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{
                position: "sticky",
                top: 0,
                backgroundColor: "#f9fafb",
                zIndex: 1
              }}>
                <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                  <th style={tableHeaderStyle}>Time</th>
                  <th style={tableHeaderStyle}>Job #</th>
                  <th style={tableHeaderStyle}>Registration</th>
                  <th style={tableHeaderStyle}>Vehicle</th>
                  <th style={tableHeaderStyle}>Customer</th>
                  <th style={tableHeaderStyle}>Status</th>
                  <th style={tableHeaderStyle}>Job Types</th>
                  <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job, index) => {
                  const isCheckedIn = ["Checked In", "Workshop/MOT", "VHC Complete", "VHC Sent", "Being Washed", "Complete"].includes(job.status);
                  const isCurrentlyCheckingIn = checkingIn === job.id;
                  
                  return (
                    <tr
                      key={job.id || index}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        backgroundColor: isCheckedIn ? "#f0fdf4" : "white",
                        transition: "background-color 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        if (!isCheckedIn) {
                          e.currentTarget.style.backgroundColor = "#f9fafb";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isCheckedIn ? "#f0fdf4" : "white";
                      }}
                    >
                      <td style={tableCellStyle}>
                        <span style={{ fontWeight: "600", fontSize: "16px" }}>
                          {job.appointment?.time || "N/A"}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{ fontWeight: "600", color: "#d10000" }}>
                          {job.jobNumber}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{ fontWeight: "500" }}>
                          {job.reg || "N/A"}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        {job.makeModel || "N/A"}
                      </td>
                      <td style={tableCellStyle}>
                        {job.customer || "N/A"}
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "600",
                          backgroundColor: getStatusColor(job.status),
                          color: "white"
                        }}>
                          {job.status}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        {job.jobCategories && job.jobCategories.length > 0 ? (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {job.jobCategories.map((cat, i) => (
                              <span
                                key={i}
                                style={{
                                  padding: "2px 8px",
                                  backgroundColor: "#e0e0e0",
                                  borderRadius: "10px",
                                  fontSize: "11px",
                                  fontWeight: "600"
                                }}
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#999", fontSize: "13px" }}>-</span>
                        )}
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: "center" }}>
                        {isCheckedIn ? (
                          <span style={{
                            padding: "8px 16px",
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: "600",
                            backgroundColor: "#d1fae5",
                            color: "#065f46"
                          }}>
                            ✓ Checked In
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCheckIn(job)}
                            disabled={isCurrentlyCheckingIn}
                            style={{
                              padding: "8px 16px",
                              backgroundColor: isCurrentlyCheckingIn ? "#ccc" : "#10b981",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: isCurrentlyCheckingIn ? "not-allowed" : "pointer",
                              fontSize: "13px",
                              fontWeight: "600",
                              transition: "background-color 0.2s"
                            }}
                            onMouseEnter={(e) => !isCurrentlyCheckingIn && (e.target.style.backgroundColor = "#059669")}
                            onMouseLeave={(e) => !isCurrentlyCheckingIn && (e.target.style.backgroundColor = "#10b981")}
                          >
                            {isCurrentlyCheckingIn ? "Checking In..." : "Check In"}
                          </button>
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
            color: "#6b7280",
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

// ✅ Helper function for status colors
function getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case "booked":
      return "#06b6d4";
    case "checked in":
      return "#8b5cf6";
    case "workshop/mot":
      return "#f59e0b";
    case "vhc complete":
      return "#3b82f6";
    case "vhc sent":
      return "#6366f1";
    case "being washed":
      return "#14b8a6";
    case "complete":
      return "#10b981";
    default:
      return "#6b7280";
  }
}

// ✅ Reusable table styles
const tableHeaderStyle = {
  padding: "14px 16px",
  textAlign: "left",
  fontSize: "13px",
  fontWeight: "600",
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const tableCellStyle = {
  padding: "14px 16px",
  fontSize: "14px",
  color: "#4b5563"
};
