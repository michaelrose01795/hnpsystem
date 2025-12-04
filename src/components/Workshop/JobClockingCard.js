// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/Workshop/JobClockingCard.js

import React, { useState, useEffect } from "react"; // React hooks for state and effects
import { useUser } from "@/context/UserContext"; // Get logged-in user
import { 
  clockInToJob, 
  clockOutFromJob, 
  getUserActiveJobs,
  getTechnicianDailySummary,
  switchJob
} from "@/lib/database/jobClocking"; // Import clocking functions
import { getAllJobs } from "@/lib/database/jobs"; // Import jobs function

export default function JobClockingCard() {
  const { user, setStatus, refreshCurrentJob, setCurrentJob, dbUserId } = useUser(); // Get logged-in user and helpers
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
    const workshopUserId = dbUserId ?? user?.id;
    if (!user || workshopUserId == null) return;
    
    fetchData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval); // Cleanup on unmount
  }, [user, dbUserId]);

  // ✅ Fetch all required data
  const fetchData = async () => {
    const workshopUserId = dbUserId ?? user?.id;
    if (!user || workshopUserId == null) return;
    
    console.log("🔄 Refreshing clocking data...");
    
    // Fetch active jobs user is clocked into
    const activeResult = await getUserActiveJobs(workshopUserId);
    if (activeResult.success) {
      setActiveJobs(activeResult.data);
    }
    
    // Fetch daily summary
    const summaryResult = await getTechnicianDailySummary(workshopUserId);
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
    const workshopUserId = dbUserId ?? user?.id;
    if (!selectedJobId || !selectedJobNumber || workshopUserId == null) {
      alert("⚠️ Please select a job first");
      return;
    }
    
    setLoading(true);
    
    try {
      console.log(`🔧 Clocking in to job ${selectedJobNumber}...`);
      
      const result = await clockInToJob(
        workshopUserId, 
        selectedJobId, 
        selectedJobNumber, 
        workType
      );
      
      if (result.success) {
        console.log("✅ Clocked in successfully");
        alert(`✅ Clocked in to Job ${selectedJobNumber}`);
        setStatus("In Progress");
        await refreshCurrentJob();
        
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
  const handleClockOut = async (jobId, jobNumber, clockingId) => {
    const workshopUserId = dbUserId ?? user?.id;
    const confirmed = confirm(`Clock out from Job ${jobNumber}?`);
    if (!confirmed) return;
    
    setLoading(true);
    
    try {
      console.log(`⏸️ Clocking out from job ${jobNumber}...`);
      
      const result = await clockOutFromJob(workshopUserId, jobId, clockingId);
      
      if (result.success) {
        console.log("✅ Clocked out successfully");
        alert(`✅ Clocked out from Job ${jobNumber}\n\nHours worked: ${result.hoursWorked}h`);
        setCurrentJob(null);
        const nextJob = await refreshCurrentJob();
        if (!nextJob) {
          setStatus("Waiting for Job");
        }
        
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
    const workshopUserId = dbUserId ?? user?.id;
    if (workshopUserId == null) return;

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
        workshopUserId,
        currentJob.jobId,
        newJobId,
        newJobNumber,
        workType
      );
      
      if (result.success) {
        alert(`✅ Switched to Job ${newJobNumber}`);
        setShowAvailableJobs(false);
        setStatus("In Progress");
        await refreshCurrentJob();
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
        backgroundColor: "var(--warning-surface)",
        borderRadius: "8px",
        border: "1px solid var(--warning)"
      }}>
        <p style={{ margin: 0, color: "var(--warning-dark)" }}>
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
        backgroundColor: "var(--surface)",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 2px 8px rgba(var(--shadow-rgb),0.08)",
        border: "1px solid var(--surface-light)"
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
            color: "var(--text-primary)",
            margin: 0
          }}>
            Job Clocking - {user.first_name} {user.last_name}
          </h2>
          
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: "10px 20px",
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
              backgroundColor: "var(--info-surface)",
              borderRadius: "12px",
              border: "1px solid var(--info)"
            }}>
              <p style={{ fontSize: "13px", color: "var(--grey-accent)", margin: "0 0 8px 0" }}>
                Total Hours Today
              </p>
              <p style={{ fontSize: "32px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                {dailySummary.totalHours}h
              </p>
            </div>
            
            <div style={{
              padding: "16px",
              backgroundColor: "var(--warning-surface)",
              borderRadius: "12px",
              border: "1px solid var(--warning-surface)"
            }}>
              <p style={{ fontSize: "13px", color: "var(--grey-accent)", margin: "0 0 8px 0" }}>
                Active Jobs
              </p>
              <p style={{ fontSize: "32px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                {dailySummary.activeJobs}
              </p>
            </div>
            
            <div style={{
              padding: "16px",
              backgroundColor: "var(--success)",
              borderRadius: "12px",
              border: "1px solid var(--success)"
            }}>
              <p style={{ fontSize: "13px", color: "var(--grey-accent)", margin: "0 0 8px 0" }}>
                Completed Today
              </p>
              <p style={{ fontSize: "32px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                {dailySummary.completedJobs}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ✅ Currently Clocked In Jobs */}
      <div style={{
        backgroundColor: "var(--surface)",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 2px 8px rgba(var(--shadow-rgb),0.08)",
        border: "1px solid var(--surface-light)"
      }}>
        <h3 style={{
          fontSize: "18px",
          fontWeight: "600",
          color: "var(--text-primary)",
          margin: "0 0 20px 0"
        }}>
          Currently Working On
        </h3>

        {activeJobs.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "40px",
            backgroundColor: "var(--surface)",
            borderRadius: "12px"
          }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⏸️</div>
            <p style={{ fontSize: "16px", color: "var(--grey-accent)", margin: 0 }}>
              Not clocked into any jobs
            </p>
            <p style={{ fontSize: "14px", color: "var(--grey-accent-light)", marginTop: "8px" }}>
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
                  backgroundColor: "var(--surface-light)",
                  border: "2px solid var(--primary)",
                  borderRadius: "12px"
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "var(--primary)",
                    marginBottom: "8px"
                  }}>
                    Job {job.jobNumber} - {job.reg}
                  </div>
                  <div style={{ fontSize: "14px", color: "var(--grey-accent)", marginBottom: "4px" }}>
                    {job.makeModel} • {job.customer}
                  </div>
                  <div style={{
                    display: "flex",
                    gap: "12px",
                    fontSize: "13px",
                    color: "var(--grey-accent-light)"
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
                  onClick={() => handleClockOut(job.jobId, job.jobNumber, job.clockingId)}
                  disabled={loading}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: loading ? "var(--background)" : "var(--danger)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = "var(--danger)")}
                  onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = "var(--danger)")}
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
        backgroundColor: "var(--surface)",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 2px 8px rgba(var(--shadow-rgb),0.08)",
        border: "1px solid var(--surface-light)"
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
            color: "var(--text-primary)",
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
              backgroundColor: showAvailableJobs ? "var(--primary)" : "var(--surface)",
              color: showAvailableJobs ? "white" : "var(--grey-accent)",
              border: "1px solid var(--surface-light)",
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
              border: "1px solid var(--surface-light)",
              fontSize: "14px",
              outline: "none"
            }}
            onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
            onBlur={(e) => e.target.style.borderColor = "var(--surface-light)"}
          />

          <select
            value={workType}
            onChange={(e) => setWorkType(e.target.value)}
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid var(--surface-light)",
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
              backgroundColor: loading || !selectedJobNumber ? "var(--background)" : "var(--info)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: loading || !selectedJobNumber ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => !loading && selectedJobNumber && (e.target.style.backgroundColor = "var(--info-dark)")}
            onMouseLeave={(e) => !loading && selectedJobNumber && (e.target.style.backgroundColor = "var(--info)")}
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
                border: "1px solid var(--surface-light)",
                fontSize: "14px",
                outline: "none"
              }}
              onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
              onBlur={(e) => e.target.style.borderColor = "var(--surface-light)"}
            />

            {/* Jobs Table */}
            <div style={{
              maxHeight: "400px",
              overflowY: "auto",
              border: "1px solid var(--surface-light)",
              borderRadius: "8px"
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{
                  position: "sticky",
                  top: 0,
                  backgroundColor: "var(--info-surface)",
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
                        color: "var(--grey-accent-light)"
                      }}>
                        No jobs found
                      </td>
                    </tr>
                  ) : (
                    filteredJobs.map((job) => (
                      <tr
                        key={job.id}
                        style={{
                          borderBottom: "1px solid var(--info-surface)",
                          transition: "background-color 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--info-surface)"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                      >
                        <td style={tableCellStyle}>
                          <span style={{ fontWeight: "600", color: "var(--primary)" }}>
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
                              backgroundColor: "var(--danger)",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: "600",
                              transition: "background-color 0.2s"
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = "var(--danger)"}
                            onMouseLeave={(e) => e.target.style.backgroundColor = "var(--danger)"}
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
      return "var(--info)";
    case "checked in":
      return "var(--accent-purple)";
    case "workshop/mot":
      return "var(--warning)";
    case "vhc complete":
      return "var(--info)";
    case "vhc sent":
      return "var(--accent-purple)";
    case "additional work required":
      return "var(--warning)";
    case "additional work being carried out":
      return "var(--danger)";
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
  padding: "12px 16px",
  textAlign: "left",
  fontSize: "13px",
  fontWeight: "600",
  color: "var(--info)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  borderBottom: "2px solid var(--surface-light)"
};

const tableCellStyle = {
  padding: "12px 16px",
  fontSize: "14px",
  color: "var(--info-dark)"
};
