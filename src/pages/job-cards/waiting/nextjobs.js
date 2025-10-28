// file location: src/pages/job-cards/waiting/nextjobs.js
"use client";

import React, { useState, useMemo, useEffect } from "react"; // Core React hooks
import Layout from "../../../components/Layout"; // Main layout wrapper
import { useUser } from "../../../context/UserContext"; // Logged-in user context
import { usersByRole } from "../../../config/users"; // Role config
import { getAllJobs } from "../../../lib/database/jobs"; // ✅ Fetch jobs from Supabase

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
    const fetchJobs = async () => {
      const fetchedJobs = await getAllJobs();

      // Only include jobs with a real job number (actual job cards)
      const filtered = fetchedJobs.filter(
        (job) => job.jobNumber && job.jobNumber.trim() !== ""
      );

      setJobs(filtered);
    };
    fetchJobs();
  }, []);

  // ✅ Filter unassigned jobs that are New, Created, or Accepted
  const unassignedJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          ["New", "Created", "Accepted"].includes(job.status) &&
          !job.assignedTech
      ),
    [jobs]
  );

  // ✅ Search logic for job cards
  const filteredJobs = useMemo(() => {
    if (!searchTerm.trim()) return unassignedJobs;
    const lower = searchTerm.toLowerCase();
    return unassignedJobs.filter(
      (job) =>
        job.jobNumber?.toLowerCase().includes(lower) ||
        job.customer?.toLowerCase().includes(lower) ||
        job.make?.toLowerCase().includes(lower) ||
        job.model?.toLowerCase().includes(lower) ||
        job.reg?.toLowerCase().includes(lower)
    );
  }, [searchTerm, unassignedJobs]);

  // ✅ Group jobs by technician (using assignedTech.name)
  const assignedJobs = useMemo(
    () =>
      techsList.map((tech) => ({
        ...tech,
        jobs: jobs
          .filter(
            (job) =>
              job.assignedTech?.name === tech.name ||
              job.technician?.includes(tech.name)
          )
          .sort((a, b) => (a.position || 0) - (b.position || 0)),
      })),
    [jobs]
  );

  // ✅ Assign technician to a job (local only for now)
  const assignTechToJob = (tech) => {
    if (!selectedJob) return;
    const updatedJob = { ...selectedJob, assignedTech: tech };
    const newJobs = jobs.map((j) =>
      j.jobNumber === selectedJob.jobNumber ? updatedJob : j
    );
    setJobs(newJobs);
    setAssignPopup(false);
    setSelectedJob(null);
  };

  // ✅ Unassign technician
  const unassignTechFromJob = () => {
    if (!selectedJob) return;
    const updatedJob = { ...selectedJob, assignedTech: null };
    const newJobs = jobs.map((j) =>
      j.jobNumber === selectedJob.jobNumber ? updatedJob : j
    );
    setJobs(newJobs);
    setSelectedJob(null);
  };

  // ✅ Drag handlers for reordering
  const handleDragStart = (job) => {
    if (!hasAccess) return;
    setDraggingJob(job);
  };

  const handleDragOver = (e) => {
    if (!hasAccess) return;
    e.preventDefault();
  };

  const handleDrop = (targetJob, tech) => {
    if (!hasAccess || !draggingJob) return;
    const updatedTechJobs = tech.jobs.filter(
      (j) => j.jobNumber !== draggingJob.jobNumber
    );
    const dropIndex = updatedTechJobs.findIndex(
      (j) => j.jobNumber === targetJob.jobNumber
    );
    updatedTechJobs.splice(dropIndex, 0, draggingJob);
    const reindexed = updatedTechJobs.map((j, i) => ({
      ...j,
      position: i + 1,
    }));
    const updatedJobs = jobs.map((j) => {
      const match = reindexed.find((r) => r.jobNumber === j.jobNumber);
      return match || j;
    });
    setJobs(updatedJobs);
    setDraggingJob(null);
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

        {/* ==== UNASSIGNED JOBS ==== */}
        <div
          style={{
            height: "10%",
            marginBottom: "12px",
            background: "#fff",
            borderRadius: "8px",
            border: "1px solid #ddd",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <input
            type="text"
            placeholder="Search job number, reg, or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
                No matching jobs found.
              </p>
            ) : (
              filteredJobs.map((job) => (
                <button
                  key={job.jobNumber}
                  onClick={() => setSelectedJob(job)}
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
                  title={`${job.jobNumber} - ${job.customer} - ${job.make} ${job.model}`}
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
            gridTemplateColumns: "repeat(2, 1fr)",
            gridTemplateRows: "repeat(3, 1fr)",
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
                {tech.name}
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
                      draggable={hasAccess}
                      onDragStart={() => handleDragStart(job)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(job, tech)}
                      onClick={() => setSelectedJob(job)}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: "6px",
                        padding: "6px",
                        marginBottom: "4px",
                        backgroundColor:
                          draggingJob?.jobNumber === job.jobNumber
                            ? "#ffe5e5"
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
              backgroundColor: "rgba(0,0,0,0.5)",
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
                <strong>Make:</strong> {selectedJob.make} {selectedJob.model}
              </p>
              <p>
                <strong>Reg:</strong> {selectedJob.reg}
              </p>
              <p>
                <strong>Job Number:</strong> {selectedJob.jobNumber}
              </p>
              <p>
                <strong>Customer:</strong> {selectedJob.customer}
              </p>
              <p>
                <strong>Description:</strong> {selectedJob.description}
              </p>

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
                  }}
                  onClick={() => setAssignPopup(true)}
                >
                  Assign Tech
                </button>
                <button
                  style={{
                    backgroundColor: "#777",
                    color: "white",
                    padding: "6px 12px",
                    borderRadius: "6px",
                  }}
                  onClick={unassignTechFromJob}
                >
                  Unassign
                </button>
                <button
                  style={{
                    backgroundColor: "#FF4040",
                    color: "white",
                    padding: "6px 12px",
                    borderRadius: "6px",
                  }}
                  onClick={() => setSelectedJob(null)}
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
              backgroundColor: "rgba(0,0,0,0.5)",
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1001,
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
                  if (selectedTech) assignTechToJob(selectedTech);
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
                }}
                onClick={() => setAssignPopup(false)}
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