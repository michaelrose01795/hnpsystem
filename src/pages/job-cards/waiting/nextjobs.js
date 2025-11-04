// file location: src/pages/job-cards/waiting/nextjobs.js
"use client";

import React, { useState, useMemo, useEffect } from "react"; // Core React hooks
import Layout from "../../../components/Layout"; // Main layout wrapper
import { useUser } from "../../../context/UserContext"; // Logged-in user context
import { usersByRole } from "../../../config/users"; // Role config
import { 
  getAllJobs, 
  assignTechnicianToJob, 
  unassignTechnicianFromJob, 
  updateJobPosition 
} from "../../../lib/database/jobs"; // ✅ Fetch and update jobs from Supabase

// Build tech list dynamically from usersByRole
const techsList = (usersByRole["Techs"] || []).map((name, index) => ({
  id: index + 1,
  name,
}));

export default function NextJobsPage() {
  // ✅ Hooks
  const { user } = useUser(); // Current logged-in user
  const [jobs, setJobs] = useState([]); // Jobs from database
  const [selectedJob, setSelectedJob] = useState(null); // Job selected for popup
  const [assignPopup, setAssignPopup] = useState(false); // Assign popup
  const [searchTerm, setSearchTerm] = useState(""); // Search filter
  const [draggingJob, setDraggingJob] = useState(null); // Job being dragged
  const [feedbackMessage, setFeedbackMessage] = useState(null); // Success/error feedback
  const [loading, setLoading] = useState(true); // Loading state

  // ✅ Manager access check
  const username = user?.username;
  const allowedUsers = [
    ...(usersByRole["Workshop Manager"] || []),
    ...(usersByRole["Service Manager"] || []),
  ];
  const hasAccess = allowedUsers.includes(username);

  // ✅ Fetch jobs from Supabase on component mount
  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true); // Start loading
    const fetchedJobs = await getAllJobs(); // Fetch all jobs from database

    // Only include jobs with a real job number (actual job cards)
    const filtered = fetchedJobs.filter(
      (job) => job.jobNumber && job.jobNumber.trim() !== ""
    );

    setJobs(filtered); // Update state with filtered jobs
    setLoading(false); // Stop loading
    return filtered;
  };

  // ✅ Filter ALL outstanding/not started jobs (unassigned AND not completed)
  // These are jobs that are not finished - they show in the top section
  const unassignedJobs = useMemo(
    () =>
      jobs.filter(
        (job) => {
          // Define completed/finished statuses that should NOT appear
          const completedStatuses = ["Completed", "Finished", "Closed", "Invoiced", "Collected"];

          const assignedName =
            job.assignedTech?.name ||
            job.technician ||
            (typeof job.assignedTo === "string" ? job.assignedTo : "");
          
          // Show job if it's not in completed statuses AND has no tech assigned
          return !completedStatuses.includes(job.status) && !assignedName?.trim();
        }
      ),
    [jobs] // Recalculate when jobs change
  );

  // ✅ Search logic for job cards in the outstanding section
  const filteredJobs = useMemo(() => {
    if (!searchTerm.trim()) return unassignedJobs; // Return all unassigned jobs if no search term
    const lower = searchTerm.toLowerCase(); // Convert search term to lowercase for case-insensitive search
    return unassignedJobs.filter(
      (job) =>
        job.jobNumber?.toLowerCase().includes(lower) || // Search in job number
        job.customer?.toLowerCase().includes(lower) || // Search in customer name
        job.make?.toLowerCase().includes(lower) || // Search in make
        job.model?.toLowerCase().includes(lower) || // Search in model
        job.reg?.toLowerCase().includes(lower) // Search in registration
    );
  }, [searchTerm, unassignedJobs]); // Recalculate when search term or unassigned jobs change

  // ✅ Group jobs by technician (using assignedTech.name)
  const assignedJobs = useMemo(
    () =>
      techsList.map((tech) => ({
        ...tech, // Spread tech info
        jobs: jobs
          .filter((job) => {
            const assignedNameRaw =
              job.assignedTech?.name ||
              job.technician ||
              (typeof job.assignedTo === "string" ? job.assignedTo : "");

            const assignedName = assignedNameRaw?.toLowerCase().trim();
            const techName = tech.name.toLowerCase().trim();

            return assignedName && assignedName === techName;
          })
          .sort((a, b) => (a.position || 0) - (b.position || 0)), // Sort by position
      })),
    [jobs] // Recalculate when jobs change
  );

  const handleOpenJobDetails = (job) => {
    setFeedbackMessage(null);
    setSelectedJob(job);
  };

  const handleCloseJobDetails = () => {
    setFeedbackMessage(null);
    setSelectedJob(null);
  };

  const handleOpenAssignPopup = () => {
    setFeedbackMessage(null);
    setAssignPopup(true);
  };

  // ✅ Assign technician to a job (save to Supabase)
  const assignTechToJob = async (tech) => {
    if (!selectedJob) return; // Exit if no job selected
    const jobId = selectedJob.id;
    const jobNumber = selectedJob.jobNumber;
    const technicianName = tech.name;

    console.log("🔄 Assigning technician:", technicianName, "to job:", jobId); // Debug log
    setFeedbackMessage(null);

    // Use the dedicated helper function - it now returns formatted job data or null
    let updatedJob;
    try {
      updatedJob = await assignTechnicianToJob(jobId, technicianName);
    } catch (err) {
      console.error("❌ Exception assigning technician:", err);
      setAssignPopup(false);
      setFeedbackMessage({
        type: "error",
        text: `Failed to assign ${jobNumber} to ${technicianName}: ${err?.message || "Unknown error"}`,
      });
      return;
    }

    if (!updatedJob?.success) {
      console.error("❌ Failed to assign technician:", updatedJob?.error);
      setAssignPopup(false);
      setFeedbackMessage({
        type: "error",
        text: `Failed to assign ${jobNumber} to ${technicianName}${
          updatedJob?.error?.message ? `: ${updatedJob.error.message}` : ""
        }`,
      });
      return;
    }

    console.log("✅ Technician assigned successfully:", updatedJob); // Debug log

    const latestJobs = await fetchJobs();
    const refreshedJob = latestJobs.find((job) => job.id === jobId);

    setAssignPopup(false); // Close assign popup
    setSelectedJob(refreshedJob || selectedJob); // Keep modal open with latest info
    setFeedbackMessage({
      type: "success",
      text: `Job ${jobNumber} assigned to ${technicianName}`,
    });
  };

  // ✅ Unassign technician (save to Supabase)
  const unassignTechFromJob = async () => {
    if (!selectedJob) return; // Exit if no job selected
    const jobId = selectedJob.id;
    const jobNumber = selectedJob.jobNumber;

    console.log("🔄 Unassigning technician from job:", jobId); // Debug log
    setFeedbackMessage(null);

    // Use the dedicated helper function - it now returns formatted job data or null
    let updatedJob;
    try {
      updatedJob = await unassignTechnicianFromJob(jobId);
    } catch (err) {
      console.error("❌ Exception unassigning technician:", err);
      setFeedbackMessage({
        type: "error",
        text: `Failed to unassign technician from ${jobNumber}: ${err?.message || "Unknown error"}`,
      });
      return;
    }

    if (!updatedJob?.success) {
      console.error("❌ Failed to unassign technician:", updatedJob?.error);
      setFeedbackMessage({
        type: "error",
        text: `Failed to unassign technician from ${jobNumber}${
          updatedJob?.error?.message ? `: ${updatedJob.error.message}` : ""
        }`,
      });
      return;
    }

    console.log("✅ Technician unassigned successfully:", updatedJob); // Debug log

    const latestJobs = await fetchJobs();
    const refreshedJob = latestJobs.find((job) => job.id === jobId);

    setSelectedJob(refreshedJob || selectedJob);
    setFeedbackMessage({
      type: "success",
      text: `Technician unassigned from job ${jobNumber}`,
    });
  };

  // ✅ Drag handlers for reordering
  const handleDragStart = (job) => {
    if (!hasAccess) return; // Only managers can drag
    setDraggingJob(job); // Set the job being dragged
  };

  const handleDragOver = (e) => {
    if (!hasAccess) return; // Only managers can drop
    e.preventDefault(); // Allow drop
  };

  const handleDrop = async (targetJob, tech) => {
    if (!hasAccess || !draggingJob) return; // Only managers can reorder

    console.log("🔄 Reordering jobs for tech:", tech.name); // Debug log

    // Remove the dragged job from the tech's job list
    const updatedTechJobs = tech.jobs.filter(
      (j) => j.jobNumber !== draggingJob.jobNumber
    );
    
    // Find where to insert the dragged job (at the target job's position)
    const dropIndex = updatedTechJobs.findIndex(
      (j) => j.jobNumber === targetJob.jobNumber
    );
    
    // Insert the dragged job at the drop position
    updatedTechJobs.splice(dropIndex, 0, draggingJob);

    // Reindex positions (1-based index)
    const reindexed = updatedTechJobs.map((j, i) => ({
      ...j,
      position: i + 1, // Position starts at 1
    }));

    console.log("📝 Updating positions for", reindexed.length, "jobs"); // Debug log

    // Update all reindexed jobs in Supabase using the helper function
    for (const job of reindexed) {
      await updateJobPosition(job.id, job.position); // Update each job's position
    }

    console.log("✅ Positions updated successfully"); // Debug log

    // Refresh jobs from database
    await fetchJobs();
    setDraggingJob(null); // Clear dragging state
  };

  // ✅ Access check
  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2 style={{ color: "#d10000" }}>Access Denied</h2>
          <p>You do not have access to Next Jobs.</p>
        </div>
      </Layout>
    );
  }

  // ✅ Loading state with spinner animation
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
          <p style={{ color: "#666" }}>Loading jobs...</p>
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

  // ✅ Page layout
  return (
    <Layout>
      <div style={{ 
        height: "100%", 
        display: "flex", 
        flexDirection: "column", 
        padding: "8px 16px",
        overflow: "hidden" 
      }}>
        
        {/* ✅ Header Section */}
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
          <div style={{ flex: 1 }}>
            <h1 style={{ 
              color: "#d10000", 
              fontSize: "28px", 
              fontWeight: "700",
              margin: 0
            }}>
              Next Jobs
            </h1>
          </div>
        </div>

        {/* ✅ Outstanding Jobs Section */}
        <div style={{
          marginBottom: "12px",
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid #ffe5e5",
          boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          maxHeight: "180px",
          flexShrink: 0
        }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: "12px" 
          }}>
            <h2 style={{ 
              fontSize: "18px", 
              fontWeight: "600", 
              color: "#1f2937",
              margin: 0
            }}>
              Outstanding Jobs ({unassignedJobs.length})
            </h2>
          </div>
          
          <input
            type="text"
            placeholder="Search job number, reg, or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} // Update search term
            style={{
              padding: "10px 12px",
              marginBottom: "12px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              outline: "none",
              transition: "border-color 0.2s"
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = "#d10000"}
            onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
          />

          <div style={{ 
            overflowX: "auto", 
            whiteSpace: "nowrap", 
            flex: 1,
            paddingBottom: "8px"
          }}>
            {filteredJobs.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: "14px", margin: 0 }}>
                {searchTerm.trim() ? "No matching jobs found." : "No outstanding jobs."}
              </p>
            ) : (
              filteredJobs.map((job) => (
                <button
                  key={job.jobNumber}
                  onClick={() => handleOpenJobDetails(job)} // Open job details popup
                  style={{
                    display: "inline-block",
                    backgroundColor: "#d10000",
                    color: "white",
                    padding: "8px 12px",
                    marginRight: "8px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    border: "none",
                    boxShadow: "0 2px 4px rgba(209,0,0,0.18)",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a60a0a")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d10000")}
                  title={`${job.jobNumber} - ${job.customer} - ${job.make} ${job.model} - Status: ${job.status}`}
                >
                  {`${job.jobNumber} - ${job.reg}`}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ✅ Technicians Grid Section */}
        <div style={{ 
          flex: 1,
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
          border: "1px solid #ffe5e5",
          background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
          padding: "24px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0
        }}>
          
          <div style={{ 
            flex: 1,
            overflowY: "auto",
            paddingRight: "8px",
            minHeight: 0
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)", // 2 columns
              gridTemplateRows: "repeat(3, 1fr)", // 3 rows (6 techs total)
              gap: "16px",
              height: "100%"
            }}>
              {assignedJobs.map((tech) => (
                <div
                  key={tech.id}
                  style={{
                    background: "white",
                    border: "1px solid #ffe5e5",
                    borderRadius: "8px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                  }}
                >
                  <p style={{ 
                    fontWeight: "600", 
                    marginBottom: "12px",
                    fontSize: "16px",
                    color: "#1f2937",
                    flexShrink: 0
                  }}>
                    {tech.name} ({tech.jobs.length})
                  </p>
                  <div style={{ 
                    flex: 1, 
                    overflowY: "auto",
                    minHeight: 0,
                    paddingRight: "4px"
                  }}>
                    {tech.jobs.length === 0 ? (
                      <p style={{ 
                        color: "#9ca3af", 
                        fontSize: "14px",
                        margin: 0
                      }}>
                        No jobs assigned
                      </p>
                    ) : (
                      tech.jobs.map((job) => (
                        <div
                          key={job.jobNumber}
                          draggable={hasAccess} // Only draggable if user has access
                          onDragStart={() => handleDragStart(job)} // Start dragging
                          onDragOver={handleDragOver} // Allow drop
                          onDrop={() => handleDrop(job, tech)} // Handle drop
                          onClick={() => handleOpenJobDetails(job)} // Open job details popup
                          style={{
                            border: "1px solid #ffd6d6",
                            borderRadius: "8px",
                            padding: "10px",
                            marginBottom: "8px",
                            backgroundColor:
                              draggingJob?.jobNumber === job.jobNumber
                                ? "#ffe5e5" // Highlight dragging job
                                : "#fff5f5",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            if (draggingJob?.jobNumber !== job.jobNumber) {
                              e.currentTarget.style.backgroundColor = "#ffecec";
                              e.currentTarget.style.boxShadow = "0 2px 6px rgba(209,0,0,0.12)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (draggingJob?.jobNumber !== job.jobNumber) {
                              e.currentTarget.style.backgroundColor = "#fff5f5";
                              e.currentTarget.style.boxShadow = "none";
                            }
                          }}
                        >
                          <p style={{
                            fontSize: "14px",
                            fontWeight: "600",
                            color: "#d10000",
                            margin: "0 0 4px 0"
                          }}>
                            {job.jobNumber} – {job.reg}
                          </p>
                          <p style={{
                            fontSize: "12px",
                            color: "#6b7280",
                            margin: 0
                          }}>
                            {job.status}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ✅ JOB DETAILS POPUP */}
        {selectedJob && (
          <div
            style={{
              backgroundColor: "rgba(0,0,0,0.5)", // Semi-transparent overlay
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
            onClick={handleCloseJobDetails} // Close when clicking overlay
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "12px",
                width: "500px",
                maxWidth: "90%",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                border: "1px solid #ffe5e5"
              }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
              <h3 style={{ 
                fontWeight: "700", 
                marginBottom: "16px",
                fontSize: "20px",
                color: "#d10000"
              }}>
                Job Details
              </h3>
              
              {feedbackMessage && (
                <div
                  style={{
                    marginBottom: "16px",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    backgroundColor:
                      feedbackMessage.type === "error" ? "#fee2e2" : "#d1fae5",
                    color: feedbackMessage.type === "error" ? "#991b1b" : "#065f46",
                    fontSize: "14px",
                    fontWeight: 600,
                    border: feedbackMessage.type === "error" ? "1px solid #fca5a5" : "1px solid #6ee7b7"
                  }}
                >
                  {feedbackMessage.text}
                </div>
              )}
              
              <div style={{ marginBottom: "20px" }}>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "#6b7280" }}>Job Number:</strong> {selectedJob.jobNumber}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "#6b7280" }}>Status:</strong> {selectedJob.status}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "#6b7280" }}>Make:</strong> {selectedJob.make} {selectedJob.model}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "#6b7280" }}>Reg:</strong> {selectedJob.reg}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "#6b7280" }}>Customer:</strong> {selectedJob.customer}
                </p>
                <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong style={{ color: "#6b7280" }}>Description:</strong> {selectedJob.description}
                </p>
                {selectedJob.assignedTech && (
                  <p style={{ marginBottom: "8px", fontSize: "14px" }}>
                    <strong style={{ color: "#6b7280" }}>Assigned To:</strong> {selectedJob.assignedTech.name}
                  </p>
                )}
              </div>

              <div style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px"
              }}>
                <button
                  style={{
                    flex: 1,
                    backgroundColor: "#6c757d",
                    color: "white",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    border: "none",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onClick={handleOpenAssignPopup} // Open assign popup
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#5a6268")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#6c757d")}
                >
                  Assign Tech
                </button>
                {selectedJob.assignedTech && (
                  <button
                    style={{
                      flex: 1,
                      backgroundColor: "#f59e0b",
                      color: "white",
                      padding: "12px 16px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      border: "none",
                      fontSize: "14px",
                      fontWeight: "600",
                      transition: "background-color 0.2s"
                    }}
                    onClick={unassignTechFromJob} // Unassign technician
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#d97706")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f59e0b")}
                  >
                    Unassign
                  </button>
                )}
                <button
                  style={{
                    flex: 1,
                    backgroundColor: "#d10000",
                    color: "white",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    border: "none",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onClick={handleCloseJobDetails} // Close popup
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a60a0a")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d10000")}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ ASSIGN TECH POPUP */}
        {assignPopup && (
          <div
            style={{
              backgroundColor: "rgba(0,0,0,0.5)", // Semi-transparent overlay
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1001, // Above job details popup
            }}
            onClick={() => setAssignPopup(false)} // Close when clicking overlay
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "12px",
                width: "450px",
                maxWidth: "90%",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                border: "1px solid #ffe5e5"
              }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
              <h3 style={{ 
                fontWeight: "700", 
                marginBottom: "16px",
                fontSize: "20px",
                color: "#d10000"
              }}>
                Assign Technician
              </h3>
              
              <select
                onChange={(e) => {
                  const selectedTech = techsList.find(
                    (t) => t.name === e.target.value
                  );
                  if (selectedTech) assignTechToJob(selectedTech); // Assign selected tech
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0",
                  fontSize: "14px",
                  marginBottom: "16px",
                  outline: "none",
                  cursor: "pointer",
                  transition: "border-color 0.2s"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#d10000"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
                defaultValue=""
              >
                <option value="" disabled>
                  Select Technician...
                </option>
                {techsList.map((tech) => (
                  <option key={tech.id} value={tech.name}>
                    {tech.name}
                  </option>
                ))}
              </select>
              
              <button
                style={{
                  width: "100%",
                  backgroundColor: "#d10000",
                  color: "white",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: "600",
                  transition: "background-color 0.2s"
                }}
                onClick={() => setAssignPopup(false)} // Close assign popup
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a60a0a")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d10000")}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}