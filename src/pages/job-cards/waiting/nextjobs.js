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

  // ✅ Manager access check
  const username = user?.username;
  const allowedUsers = [
    ...(usersByRole["Workshop Manager"] || []),
    ...(usersByRole["Service Manager"] || []),
  ];
  const hasAccess = allowedUsers.includes(username);

  // ✅ Fetch jobs from Supabase
  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    const fetchedJobs = await getAllJobs(); // Fetch all jobs from database

    // Only include jobs with a real job number (actual job cards)
    const filtered = fetchedJobs.filter(
      (job) => job.jobNumber && job.jobNumber.trim() !== ""
    );

    setJobs(filtered); // Update state with filtered jobs
  };

  // ✅ Filter ALL outstanding/not started jobs (unassigned AND not completed)
  // These are jobs that are not finished - they show in the top 10% section
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

  // ✅ Search logic for job cards in the 10% section
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

  // ✅ Assign technician to a job (save to Supabase)
  const assignTechToJob = async (tech) => {
    if (!selectedJob) return; // Exit if no job selected

    console.log("🔄 Assigning technician:", tech.name, "to job:", selectedJob.id); // Debug log

    // Use the dedicated helper function - it now returns formatted job data or null
    const updatedJob = await assignTechnicianToJob(selectedJob.id, tech.name);

    if (!updatedJob?.success) {
      console.error("❌ Failed to assign technician:", updatedJob?.error);
      alert(
        `Failed to assign technician. ${
          updatedJob?.error?.message ? `Reason: ${updatedJob.error.message}` : ""
        }`
      );
      return;
    }

    if (updatedJob) {
      console.log("✅ Technician assigned successfully:", updatedJob); // Debug log
      // Refresh jobs from database
      await fetchJobs();
      setAssignPopup(false); // Close assign popup
      setSelectedJob(null); // Clear selected job
      alert(`Job ${selectedJob.jobNumber} assigned to ${tech.name}`); // Success message
    } else {
      console.error("❌ Failed to assign technician"); // Debug log
      alert("Failed to assign technician. Please try again."); // Error message
    }
  };

  // ✅ Unassign technician (save to Supabase)
  const unassignTechFromJob = async () => {
    if (!selectedJob) return; // Exit if no job selected

    console.log("🔄 Unassigning technician from job:", selectedJob.id); // Debug log

    // Use the dedicated helper function - it now returns formatted job data or null
    const updatedJob = await unassignTechnicianFromJob(selectedJob.id);

    if (!updatedJob?.success) {
      console.error("❌ Failed to unassign technician:", updatedJob?.error);
      alert(
        `Failed to unassign technician. ${
          updatedJob?.error?.message ? `Reason: ${updatedJob.error.message}` : ""
        }`
      );
      return;
    }

    if (updatedJob) {
      console.log("✅ Technician unassigned successfully:", updatedJob); // Debug log
      // Refresh jobs from database
      await fetchJobs();
      setSelectedJob(null); // Clear selected job
      alert(`Technician unassigned from job ${selectedJob.jobNumber}`); // Success message
    } else {
      console.error("❌ Failed to unassign technician"); // Debug log
      alert("Failed to unassign technician. Please try again."); // Error message
    }
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
        <p className="p-4 text-red-600 font-bold">
          You do not have access to Next Jobs.
        </p>
      </Layout>
    );
  }

  // ✅ Page layout
  return (
    <Layout>
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "16px",
          height: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h1
          style={{
            color: "#FF4040",
            fontSize: "1.5rem",
            fontWeight: "bold",
            marginBottom: "8px",
          }}
        >
          Next Jobs
        </h1>

        {/* ==== OUTSTANDING/UNASSIGNED JOBS (10% SECTION) ==== */}
        <div
          style={{
            height: "15%",
            marginBottom: "12px",
            background: "#fff",
            borderRadius: "8px",
            border: "1px solid #ddd",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: "bold", color: "#333" }}>
              Outstanding Jobs ({unassignedJobs.length})
            </h2>
          </div>
          
          <input
            type="text"
            placeholder="Search job number, reg, or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} // Update search term
            style={{
              padding: "6px 10px",
              marginBottom: "6px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              fontSize: "0.9rem",
            }}
          />

          <div style={{ overflowX: "auto", whiteSpace: "nowrap", flex: 1 }}>
            {filteredJobs.length === 0 ? (
              <p style={{ color: "#999", fontSize: "0.875rem" }}>
                {searchTerm.trim() ? "No matching jobs found." : "No outstanding jobs."}
              </p>
            ) : (
              filteredJobs.map((job) => (
                <button
                  key={job.jobNumber}
                  onClick={() => setSelectedJob(job)} // Open job details popup
                  style={{
                    display: "inline-block",
                    backgroundColor: "#FF4040",
                    color: "white",
                    padding: "6px 8px",
                    marginRight: "6px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    cursor: "pointer",
                    border: "none",
                  }}
                  title={`${job.jobNumber} - ${job.customer} - ${job.make} ${job.model} - Status: ${job.status}`}
                >
                  {`${job.jobNumber} - ${job.reg}`}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ==== TECHNICIANS GRID ==== */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)", // 2 columns
            gridTemplateRows: "repeat(3, 1fr)", // 3 rows (6 techs total)
            gap: "12px",
          }}
        >
          {assignedJobs.map((tech) => (
            <div
              key={tech.id}
              style={{
                background: "white",
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                minHeight: "200px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <p style={{ fontWeight: "bold", marginBottom: "6px" }}>
                {tech.name} ({tech.jobs.length})
              </p>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {tech.jobs.length === 0 ? (
                  <p style={{ color: "#999", fontSize: "0.875rem" }}>
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
                      onClick={() => setSelectedJob(job)} // Open job details popup
                      style={{
                        border: "1px solid #eee",
                        borderRadius: "6px",
                        padding: "6px",
                        marginBottom: "4px",
                        backgroundColor:
                          draggingJob?.jobNumber === job.jobNumber
                            ? "#ffe5e5" // Highlight dragging job
                            : "#f9f9f9",
                        cursor: "pointer",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: "bold",
                          color: "#FF4040",
                        }}
                      >
                        {job.jobNumber} – {job.reg}
                      </p>
                      <p
                        style={{
                          fontSize: "0.7rem",
                          color: "#666",
                        }}
                      >
                        {job.status}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ==== JOB DETAILS POPUP ==== */}
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
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                width: "400px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
              }}
            >
              <h3 style={{ fontWeight: "bold", marginBottom: "10px" }}>
                Job Details
              </h3>
              <p>
                <strong>Job Number:</strong> {selectedJob.jobNumber}
              </p>
              <p>
                <strong>Status:</strong> {selectedJob.status}
              </p>
              <p>
                <strong>Make:</strong> {selectedJob.make} {selectedJob.model}
              </p>
              <p>
                <strong>Reg:</strong> {selectedJob.reg}
              </p>
              <p>
                <strong>Customer:</strong> {selectedJob.customer}
              </p>
              <p>
                <strong>Description:</strong> {selectedJob.description}
              </p>
              {selectedJob.assignedTech && (
                <p>
                  <strong>Assigned To:</strong> {selectedJob.assignedTech.name}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "14px",
                }}
              >
                <button
                  style={{
                    backgroundColor: "#333",
                    color: "white",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    border: "none",
                  }}
                  onClick={() => setAssignPopup(true)} // Open assign popup
                >
                  Assign Tech
                </button>
                {selectedJob.assignedTech && (
                  <button
                    style={{
                      backgroundColor: "#777",
                      color: "white",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      border: "none",
                    }}
                    onClick={unassignTechFromJob} // Unassign technician
                  >
                    Unassign
                  </button>
                )}
                <button
                  style={{
                    backgroundColor: "#FF4040",
                    color: "white",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    border: "none",
                  }}
                  onClick={() => setSelectedJob(null)} // Close popup
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==== ASSIGN TECH POPUP ==== */}
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
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                width: "400px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
              }}
            >
              <h3 style={{ fontWeight: "bold", marginBottom: "10px" }}>
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
                  padding: "6px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                }}
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
                  marginTop: "12px",
                  backgroundColor: "#FF4040",
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  width: "100%",
                  cursor: "pointer",
                  border: "none",
                }}
                onClick={() => setAssignPopup(false)} // Close assign popup
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
