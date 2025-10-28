// file location: src/pages/job-cards/waiting/nextjobs.js
"use client";

import React, { useState, useMemo } from "react"; // Core React hooks
import Layout from "../../../components/Layout"; // Main app layout
import { useUser } from "../../../context/UserContext"; // Logged-in user context
import { usersByRole } from "../../../config/users"; // Role config
import { useJobs } from "../../../context/JobsContext"; // Jobs data context

// Create techs list dynamically
const techsList = (usersByRole["Techs"] || []).map((name, index) => ({
  id: index + 1,
  name,
}));

export default function NextJobsPage() {
  const { user } = useUser(); // get current logged-in user
  const { jobs: realJobs, updateJob } = useJobs(); // get jobs + update function
  const [selectedJob, setSelectedJob] = useState(null); // job clicked
  const [assignPopup, setAssignPopup] = useState(false); // assign modal state
  const [searchTerm, setSearchTerm] = useState(""); // search text
  const [localJobs, setLocalJobs] = useState([]); // local job state for instant UI update

  // restrict access only to workshop/service managers
  const username = user?.username;
  const allowedUsers = [
    ...(usersByRole["Workshop Manager"] || []),
    ...(usersByRole["Service Manager"] || []),
  ];
  if (!allowedUsers.includes(username)) {
    return (
      <Layout>
        <p className="p-4 text-red-600 font-bold">
          You do not have access to Next Jobs.
        </p>
      </Layout>
    );
  }

  // Dummy filler jobs (visual testing only)
  const dummyJobs = Array.from({ length: 15 }, (_, i) => ({
    jobNumber: `DUMMY${i + 1}`,
    customer: `Customer ${i + 1}`,
    car: `Car ${i + 1}`,
    reg: `REG${i + 1}`,
    description: `Test job ${i + 1}`,
    status: "New",
    assignedTech: null,
  }));

  // Use local jobs if modified, otherwise use realJobs
  const jobs = localJobs.length > 0 ? localJobs : [...realJobs, ...dummyJobs];

  // Get unassigned jobs (new/created/accepted)
  const unassignedJobs = jobs.filter(
    (job) =>
      ["New", "Created", "Accepted"].includes(job.status) && !job.assignedTech
  );

  // Search logic
  const filteredJobs = useMemo(() => {
    if (!searchTerm.trim()) return unassignedJobs;
    const lower = searchTerm.toLowerCase();
    return unassignedJobs.filter(
      (job) =>
        job.jobNumber?.toLowerCase().includes(lower) ||
        job.customer?.toLowerCase().includes(lower) ||
        job.car?.toLowerCase().includes(lower) ||
        job.reg?.toLowerCase().includes(lower)
    );
  }, [searchTerm, unassignedJobs]);

  // Map jobs by technician
  const assignedJobs = techsList.map((tech) => ({
    ...tech,
    jobs: jobs.filter((job) => job.assignedTech?.id === tech.id),
  }));

  // Assign job instantly (UI + DB)
  const assignTechToJob = (tech) => {
    if (!selectedJob) return;

    // update local state instantly
    const updatedJob = { ...selectedJob, assignedTech: tech };
    const newJobs = jobs.map((job) =>
      job.jobNumber === selectedJob.jobNumber ? updatedJob : job
    );
    setLocalJobs(newJobs);

    // update backend
    updateJob(updatedJob);

    // close modals
    setAssignPopup(false);
    setSelectedJob(null);
  };

  // Unassign job (optional, instant)
  const unassignTechFromJob = () => {
    if (!selectedJob) return;
    const updatedJob = { ...selectedJob, assignedTech: null };
    const newJobs = jobs.map((job) =>
      job.jobNumber === selectedJob.jobNumber ? updatedJob : job
    );
    setLocalJobs(newJobs);
    updateJob(updatedJob);
    setSelectedJob(null);
  };

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
            placeholder="Search by job number, reg, or customer..."
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

          <div
            style={{
              overflowX: "auto",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
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
                  title={`${job.jobNumber} - ${job.customer} - ${job.car}`}
                >
                  {`${job.jobNumber} - ${job.customer} - ${job.car}`}
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
                      onClick={() => setSelectedJob(job)}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: "6px",
                        padding: "6px",
                        marginBottom: "4px",
                        backgroundColor: "#f9f9f9",
                        cursor: "pointer",
                      }}
                    >
                      <p style={{ fontSize: "0.875rem", fontWeight: "bold" }}>
                        {job.jobNumber}
                      </p>
                      <p style={{ fontSize: "0.75rem" }}>{job.customer}</p>
                      <p style={{ fontSize: "0.75rem" }}>{job.car}</p>
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
            className="fixed inset-0 z-50 flex justify-center items-center"
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
                <strong>Make:</strong> {selectedJob.car}
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
            className="fixed inset-0 z-50 flex justify-center items-center"
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