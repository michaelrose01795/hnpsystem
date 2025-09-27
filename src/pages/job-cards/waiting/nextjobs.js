// file location: src/pages/job-cards/waiting/nextjobs.js
"use client";

import React, { useState } from "react";
import Layout from "../../../components/Layout";
import { useUser } from "../../../context/UserContext";
import { usersByRole } from "../../../config/users";
import { useJobs } from "../../../context/JobsContext";

// Dynamically generate techsList from usersByRole
const techsList = (usersByRole["Techs"] || []).map((name, index) => ({
  id: index + 1,
  name,
}));

export default function NextJobsPage() {
  const { user } = useUser();
  const { jobs, updateJob } = useJobs();
  const [selectedJob, setSelectedJob] = useState(null);
  const [techPopup, setTechPopup] = useState(false);

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

  const assignTechToJob = (tech) => {
    if (!selectedJob) return;
    updateJob({ ...selectedJob, assignedTech: tech });
    setTechPopup(false);
    setSelectedJob(null);
  };

  const unassignTechFromJob = () => {
    if (!selectedJob) return;
    updateJob({ ...selectedJob, assignedTech: null });
    setSelectedJob(null);
  };

  // Filter unassigned jobs: "New", "Created", or "Accepted" first
  const newJobs = jobs.filter(
    (job) => ["New", "Created", "Accepted"].includes(job.status)
  );
  const otherJobs = jobs.filter(
    (job) => !["New", "Created", "Accepted"].includes(job.status)
  );
  const unassignedJobs = [...newJobs, ...otherJobs].filter(
    (job) => !job.assignedTech
  );

  const assignedJobs = techsList.map((tech) => ({
    ...tech,
    jobs: jobs.filter((job) => job.assignedTech?.id === tech.id),
  }));

  // Define the exact tech display order (2 rows × 3 columns)
  const techDisplayOrder = [
    ["Glen", "Michael", "Jake"],
    ["Scott", "Paul", "Cheryl"]
  ];

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "#FF4040", fontSize: "1.5rem", fontWeight: "bold", marginBottom: "16px" }}>
          Next Jobs
        </h1>

        {/* Unassigned Jobs */}
        <div className="mb-6">
          <h2 style={{ fontWeight: "bold", marginBottom: "8px" }}>Unassigned Jobs</h2>
          <div className="flex flex-wrap gap-2">
            {unassignedJobs.map((job) => (
              <button
                key={job.jobNumber}
                onClick={() => setSelectedJob(job)}
                style={{
                  backgroundColor: "#FF4040",
                  color: "white",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: "bold",
                  cursor: "pointer",
                  border: "none",
                  textAlign: "left",
                  width: "calc(20% - 8px)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={`${job.jobNumber} - ${job.customer || "N/A"} - ${job.car || "N/A"} - ${job.description || "N/A"}`}
              >
                {`${job.jobNumber} - ${job.customer || "N/A"} - ${job.car || "N/A"} - ${job.description || "N/A"}`}
              </button>
            ))}
          </div>
        </div>

        {/* Techs Grid 2x3 */}
        <div>
          <h2 style={{ fontWeight: "bold", marginBottom: "8px" }}>Technicians</h2>
          {techDisplayOrder.map((rowNames, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-3 gap-4 mb-4">
              {rowNames.map((techName) => {
                const tech = assignedJobs.find((t) => t.name === techName) || { id: techName, name: techName, jobs: [] };
                return (
                  <div
                    key={tech.id}
                    style={{
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                      padding: "12px",
                      backgroundColor: "white",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      minHeight: "220px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-start",
                    }}
                  >
                    <p style={{ fontWeight: "bold", marginBottom: "8px" }}>{tech.name}</p>
                    <div style={{ position: "relative", flex: 1 }}>
                      {tech.jobs.length === 0 ? (
                        <p style={{ color: "#999", fontSize: "0.875rem" }}>No jobs assigned</p>
                      ) : (
                        tech.jobs.map((job, index) => (
                          <div
                            key={job.jobNumber}
                            onClick={() => setSelectedJob(job)}
                            style={{
                              position: index === 0 ? "relative" : "absolute",
                              top: index * 25,
                              left: 0,
                              right: 0,
                              border: "1px solid #eee",
                              borderRadius: "6px",
                              padding: index === 0 ? "6px" : "4px 6px",
                              backgroundColor: index === 0 ? "#f9f9f9" : "#eee",
                              cursor: "pointer",
                              zIndex: tech.jobs.length - index,
                            }}
                          >
                            <p style={{ fontSize: "0.875rem", fontWeight: index === 0 ? "bold" : "normal" }}>
                              {job.jobNumber}
                            </p>
                            {index === 0 ? (
                              <>
                                <p style={{ fontSize: "0.75rem" }}>{job.customer || "N/A"}</p>
                                <p style={{ fontSize: "0.75rem" }}>{job.car || "N/A"}</p>
                                <p style={{ fontSize: "0.75rem" }}>{job.description || "N/A"}</p>
                              </>
                            ) : (
                              <p style={{ fontSize: "0.75rem" }}>{job.car || "N/A"}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Job Card Popup */}
        {selectedJob && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
            <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", width: "400px", maxHeight: "90vh", overflowY: "auto" }}>
              <h3 style={{ fontWeight: "bold", marginBottom: "8px" }}>Job Card: {selectedJob.jobNumber}</h3>
              <p><strong>Customer:</strong> {selectedJob.customer || "N/A"}</p>
              <p><strong>Car:</strong> {selectedJob.car || "N/A"}</p>
              <p><strong>Description:</strong> {selectedJob.description || "N/A"}</p>
              <p><strong>Status:</strong> {selectedJob.status || "N/A"}</p>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginTop: "12px" }}>
                <button style={{ backgroundColor: "#333", color: "white", padding: "6px 12px", borderRadius: "6px" }} onClick={() => setTechPopup(true)}>Assign Tech</button>
                <button style={{ backgroundColor: "#FF4040", color: "white", padding: "6px 12px", borderRadius: "6px" }} onClick={() => unassignTechFromJob()}>Unassign Tech</button>
                <button style={{ backgroundColor: "#FF4040", color: "white", padding: "6px 12px", borderRadius: "6px" }} onClick={() => setSelectedJob(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Tech Selection Popup */}
        {techPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
            <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", width: "400px" }}>
              <h3 style={{ fontWeight: "bold", marginBottom: "12px" }}>Select Technician</h3>
              <div className="grid grid-cols-1 gap-2">
                {techsList.map((tech) => (
                  <button
                    key={tech.id}
                    style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #ccc", cursor: "pointer", textAlign: "left" }}
                    onClick={() => assignTechToJob(tech)}
                  >
                    {tech.name}
                  </button>
                ))}
              </div>
              <button
                style={{ marginTop: "12px", backgroundColor: "#FF4040", color: "white", padding: "6px 12px", borderRadius: "6px" }}
                onClick={() => setTechPopup(false)}
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
