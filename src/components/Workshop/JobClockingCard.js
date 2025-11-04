// file location: src/components/Workshop/JobClockingCard.js

import React, { useState, useEffect } from "react"; // React hooks for state and effects
import { useUser } from "../../context/UserContext"; // Get logged-in user
import { 
  clockInToJob, 
  clockOutFromJob, 
  getUserActiveJobs,
  getTechnicianDailySummary,
  switchJob
} from "../../lib/database/jobClocking"; // Import clocking functions
import { getAllJobs } from "../../lib/database/jobs"; // Import jobs function

export default function JobClockingCard() {
  const { user } = useUser(); // Get logged-in user from context
  const [activeJobs, setActiveJobs] = useState([]); // Jobs user is currently clocked into
  const [availableJobs, setAvailableJobs] = useState([]); // Jobs available to clock into
  const [dailySummary, setDailySummary] = useState(null); // Daily hours summary
  const [selectedJobId, setSelectedJobId] = useState(""); // Job selected to clock into
  const [selectedJobNumber, setSelectedJobNumber] = useState(""); // Job number of selected job
  const [workType, setWorkType] = useState("initial"); // Type of work (initial or additional)
  const [loading, setLoading] = useState(false); // Loading state
  const [searchTerm, setSearchTerm] = useState(""); // Search filter for jobs
  const [showAvailableJobs, setShowAvailableJobs] = useState(false); // Toggle available jobs view

  // ✅ Fetch data on component mount and every 30 seconds
  useEffect(() => {
    if (!user) return;
    
    fetchData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval); // Cleanup on unmount
  }, [user]);

  // ✅ Fetch all required data
  const fetchData = async () => {
    if (!user) return;
    
    console.log("🔄 Refreshing clocking data...");
    
    // Fetch active jobs user is clocked into
    const activeResult = await getUserActiveJobs(user.id);
    if (activeResult.success) {
      setActiveJobs(activeResult.data);
    }
    
    // Fetch daily summary
    const summaryResult = await getTechnicianDailySummary(user.id);
    if (summaryResult.success) {
      setDailySummary(summaryResult.data);
    }
    
    // Fetch available jobs (only if showing available jobs)
    if (showAvailableJobs) {
      const allJobs = await getAllJobs();
      // Filter to jobs that are active and not completed
      const activeJobsList = allJobs.filter(job => 
        !["Complete", "Completed", "Invoiced", "Collected", "Cancelled"].includes(job.status)
      );
      setAvailableJobs(activeJobsList);
    }
  };

  // ✅ Handle clock in to job
  const handleClockIn = async () => {
    if (!selectedJobId || !selectedJobNumber) {
      alert("⚠️ Please select a job first");
      return;
    }
    
    setLoading(true);
    
    try {
      console.log(`🔧 Clocking in to job ${selectedJobNumber}...`);
      
      const result = await clockInToJob(
        user.id, 
        selectedJobId, 
        selectedJobNumber, 
        workType
      );
      
      if (result.success) {
        console.log("✅ Clocked in successfully");
        alert(`✅ Clocked in to Job ${selectedJobNumber}`);
        
        // Reset form
        setSelectedJobId("");
        setSelectedJobNumber("");
        setWorkType("initial");
        setShowAvailableJobs(false);
        
        // Refresh data
        await fetchData();
      } else {
        console.error("❌ Clock in failed:", result.error);
        alert(`❌ Failed to clock in: ${result.error}`);
      }
    } catch (error) {
      console.error("❌ Error clocking in:", error);
      alert("❌ Error clocking in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle clock out from job
  const handleClockOut = async (jobId, jobNumber) => {
    const confirmed = confirm(`Clock out from Job ${jobNumber}?`);
    if (!confirmed) return;
    
    setLoading(true);
    
    try {
      console.log(`⏸️ Clocking out from job ${jobNumber}...`);
      
      const result = await clockOutFromJob(user.id, jobId);
      
      if (result.success) {
        console.log("✅ Clocked out successfully");
        alert(`✅ Clocked out from Job ${jobNumber}\n\nHours worked: ${result.hoursWorked}h`);
        
        // Refresh data
        await fetchData();
      } else {
        console.error("❌ Clock out failed:", result.error);
        alert(`❌ Failed to clock out: ${result.error}`);
      }
    } catch (error) {
      console.error("❌ Error clocking out:", error);
      alert("❌ Error clocking out. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle switch job (clock out of one, clock into another)
  const handleSwitchJob = async (newJobId, newJobNumber) => {
    if (activeJobs.length === 0) {
      // No active job, just clock in
      setSelectedJobId(newJobId);
      setSelectedJobNumber(newJobNumber);
      await handleClockIn();
      return;
    }
    
    const currentJob = activeJobs[0]; // Assume switching from first active job
    
    const confirmed = confirm(
      `Switch from Job ${currentJob.jobNumber} to Job ${newJobNumber}?`
    );
    
    if (!confirmed) return;
    
    setLoading(true);
    
    try {
      const result = await switchJob(
        user.id,
        currentJob.jobId,
        newJobId,
        newJobNumber,
        workType
      );
      
      if (result.success) {
        alert(`✅ Switched to Job ${newJobNumber}`);
        setShowAvailableJobs(false);
        await fetchData();
      } else {
        alert(`❌ Failed to switch jobs: ${result.error}`);
      }
    } catch (error) {
      console.error("❌ Error switching jobs:", error);
      alert("❌ Error switching jobs. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Filter available jobs based on search term
  const filteredJobs = availableJobs.filter(job => {
    if (!searchTerm.trim()) return true;
    
    const lower = searchTerm.toLowerCase();
    return (
      job.jobNumber?.toString().toLowerCase().includes(lower) ||
      job.reg?.toLowerCase().includes(lower) ||
      job.customer?.toLowerCase().includes(lower) ||
      job.makeModel?.toLowerCase().includes(lower)
    );
  });

  // ✅ Loading state
  if (!user) {
    return (
      <div style={{
        padding: "20px",
        textAlign: "center",
        backgroundColor: "#fff3cd",
        borderRadius: "8px",
        border: "1px solid #ffc107"
      }}>
        <p style={{ margin: 0, color: "#856404" }}>
          Please log in to use job clocking
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "20px",
      padding: "20px",
      maxWidth: "1200px",
      margin: "0 auto"
    }}>
      {/* ✅ Daily Summary Card */}
      <div style={{
        backgroundColor: "white",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        border: "1px solid #e0e0e0"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px"
        }}>
          <h2 style={{
            fontSize: "24px",
            fontWeight: "700",
            color: "#1a1a1a",
            margin: 0
          }}>
            Job Clocking - {user.first_name} {user.last_name}
          </h2>
          
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: "10px 20px",
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
            {loading ? "Refreshing..." : "🔄 Refresh"}
          </button>
        </div>

        {/* Summary Stats */}
        {dailySummary && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px"
          }}>
            <div style={{
              padding: "16px",
              backgroundColor: "#f0f9ff",
              borderRadius: "12px",
              border: "1px solid #bfdbfe"
            }}>
              <p style={{ fontSize: "13px", color: "#666", margin: "0 0 8px 0" }}>
                Total Hours Today
              </p>
              <p style={{ fontSize: "32px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
                {dailySummary.totalHours}h
              </p>
            </div>
            
            <div style={{
              padding: "16px",
              backgroundColor: "#fef3c7",
              borderRadius: "12px",
              border: "1px solid #fde68a"
            }}>
              <p style={{ fontSize: "13px", color: "#666", margin: "0 0 8px 0" }}>
                Active Jobs
              </p>
              <p style={{ fontSize: "32px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
                {dailySummary.activeJobs}
              </p>
            </div>
            
            <div style={{
              padding: "16px",
              backgroundColor: "#d1fae5",
              borderRadius: "12px",
              border: "1px solid #a7f3d0"
            }}>
              <p style={{ fontSize: "13px", color: "#666", margin: "0 0 8px 0" }}>
                Completed Today
              </p>
              <p style={{ fontSize: "32px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
                {dailySummary.completedJobs}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ✅ Currently Clocked In Jobs */}
      <div style={{
        backgroundColor: "white",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        border: "1px solid #e0e0e0"
      }}>
        <h3 style={{
          fontSize: "18px",
          fontWeight: "600",
          color: "#1a1a1a",
          margin: "0 0 20px 0"
        }}>
          Currently Working On
        </h3>

        {activeJobs.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "40px",
            backgroundColor: "#fafafa",
            borderRadius: "12px"
          }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⏸️</div>
            <p style={{ fontSize: "16px", color: "#666", margin: 0 }}>
              Not clocked into any jobs
            </p>
            <p style={{ fontSize: "14px", color: "#999", marginTop: "8px" }}>
              Select a job below to start working
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {activeJobs.map((job) => (
              <div
                key={job.clockingId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px",
                  backgroundColor: "#fff5f5",
                  border: "2px solid #d10000",
                  borderRadius: "12px"
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#d10000",
                    marginBottom: "8px"
                  }}>
                    Job {job.jobNumber} - {job.reg}
                  </div>
                  <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>
                    {job.makeModel} • {job.customer}
                  </div>
                  <div style={{
                    display: "flex",
                    gap: "12px",
                    fontSize: "13px",
                    color: "#999"
                  }}>
                    <span>
                      <strong>Clocked in:</strong> {new Date(job.clockIn).toLocaleTimeString()}
                    </span>
                    <span>
                      <strong>Hours:</strong> {job.hoursWorked}h
                    </span>
                    <span>
                      <strong>Type:</strong> {job.workType === "initial" ? "Initial Work" : "Additional Work"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleClockOut(job.jobId, job.jobNumber)}
                  disabled={loading}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: loading ? "#ccc" : "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = "#dc2626")}
                  onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = "#ef4444")}
                >
                  ⏸️ Clock Out
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ Clock Into New Job Section */}
      <div style={{
        backgroundColor: "white",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        border: "1px solid #e0e0e0"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px"
        }}>
          <h3 style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#1a1a1a",
            margin: 0
          }}>
            Clock Into Job
          </h3>

          <button
            onClick={() => {
              setShowAvailableJobs(!showAvailableJobs);
              if (!showAvailableJobs) {
                fetchData(); // Load jobs when showing
              }
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: showAvailableJobs ? "#d10000" : "#f5f5f5",
              color: showAvailableJobs ? "white" : "#666",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600",
              transition: "all 0.2s"
            }}
          >
            {showAvailableJobs ? "Hide Jobs" : "Show Available Jobs"}
          </button>
        </div>

        {/* Manual Job Number Entry */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto auto",
          gap: "12px",
          marginBottom: showAvailableJobs ? "20px" : "0"
        }}>
          <input
            type="text"
            placeholder="Enter Job Number"
            value={selectedJobNumber}
            onChange={(e) => setSelectedJobNumber(e.target.value)}
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              outline: "none"
            }}
            onFocus={(e) => e.target.style.borderColor = "#d10000"}
            onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
          />

          <select
            value={workType}
            onChange={(e) => setWorkType(e.target.value)}
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              cursor: "pointer",
              outline: "none"
            }}
          >
            <option value="initial">Initial Work</option>
            <option value="additional">Additional Work</option>
          </select>

          <button
            onClick={handleClockIn}
            disabled={loading || !selectedJobNumber}
            style={{
              padding: "12px 24px",
              backgroundColor: loading || !selectedJobNumber ? "#ccc" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: loading || !selectedJobNumber ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => !loading && selectedJobNumber && (e.target.style.backgroundColor = "#059669")}
            onMouseLeave={(e) => !loading && selectedJobNumber && (e.target.style.backgroundColor = "#10b981")}
          >
            ⏱️ Clock In
          </button>
        </div>

        {/* Available Jobs List */}
        {showAvailableJobs && (
          <div>
            {/* Search Bar */}
            <input
              type="text"
              placeholder="🔍 Search jobs by number, reg, customer, or vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                marginBottom: "16px",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
                fontSize: "14px",
                outline: "none"
              }}
              onFocus={(e) => e.target.style.borderColor = "#d10000"}
              onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
            />

            {/* Jobs Table */}
            <div style={{
              maxHeight: "400px",
              overflowY: "auto",
              border: "1px solid #e0e0e0",
              borderRadius: "8px"
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{
                  position: "sticky",
                  top: 0,
                  backgroundColor: "#f9fafb",
                  zIndex: 1
                }}>
                  <tr>
                    <th style={tableHeaderStyle}>Job #</th>
                    <th style={tableHeaderStyle}>Reg</th>
                    <th style={tableHeaderStyle}>Vehicle</th>
                    <th style={tableHeaderStyle}>Customer</th>
                    <th style={tableHeaderStyle}>Status</th>
                    <th style={tableHeaderStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "#999"
                      }}>
                        No jobs found
                      </td>
                    </tr>
                  ) : (
                    filteredJobs.map((job) => (
                      <tr
                        key={job.id}
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          transition: "background-color 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                      >
                        <td style={tableCellStyle}>
                          <span style={{ fontWeight: "600", color: "#d10000" }}>
                            {job.jobNumber}
                          </span>
                        </td>
                        <td style={tableCellStyle}>{job.reg || "N/A"}</td>
                        <td style={tableCellStyle}>{job.makeModel || "N/A"}</td>
                        <td style={tableCellStyle}>{job.customer || "N/A"}</td>
                        <td style={tableCellStyle}>
                          <span style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                            backgroundColor: getStatusColor(job.status),
                            color: "white"
                          }}>
                            {job.status}
                          </span>
                        </td>
                        <td style={{ ...tableCellStyle, textAlign: "center" }}>
                          <button
                            onClick={() => {
                              setSelectedJobId(job.id);
                              setSelectedJobNumber(job.jobNumber);
                            }}
                            style={{
                              padding: "6px 12px",
                              backgroundColor: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: "600",
                              transition: "background-color 0.2s"
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = "#2563eb"}
                            onMouseLeave={(e) => e.target.style.backgroundColor = "#3b82f6"}
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
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
    case "additional work required":
      return "#f59e0b";
    case "additional work being carried out":
      return "#f97316";
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
  padding: "12px 16px",
  textAlign: "left",
  fontSize: "13px",
  fontWeight: "600",
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  borderBottom: "2px solid #e0e0e0"
};

const tableCellStyle = {
  padding: "12px 16px",
  fontSize: "14px",
  color: "#4b5563"
};