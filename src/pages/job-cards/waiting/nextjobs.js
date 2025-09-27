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

// Placeholder jobs for layout testing
const dummyJobs = Array.from({ length: 15 }, (_, i) => ({
  jobNumber: `DUMMY${i + 1}`,
  customer: `Customer ${i + 1}`,
  car: `Car ${i + 1}`,
  description: `Test job ${i + 1}`,
  status: "New",
  assignedTech: null,
}));

export default function NextJobsPage() {
  const { user } = useUser();
  const { jobs: realJobs, updateJob } = useJobs();
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

  // Combine real jobs with dummy jobs for display
  const jobs = [...realJobs, ...dummyJobs];

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

  // Flattened tech display order
  const techDisplayOrder = [
    ["Glen", "Michael", "Jake"],
    ["Scott", "Paul", "Cheryl"],
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
                title={`${job.jobNumber} - ${job.customer} - ${job.car} - ${job.description}`}
              >
                {`${job.jobNumber} - ${job.customer} - ${job.car} - ${job.description}`}
              </button>
            ))}
          </div>
        </div>

        {/* Techs Grid 2x3 */}
        <div>
          <h2 style={{ fontWeight: "bold", marginBottom: "8px" }}>Technicians</h2>
          <div className="grid grid-cols-3 gap-4">
            {techDisplayOrder.flat().map((techName, index) => {
              const tech = assignedJobs.find((t) => t.name === techName) || { id: index, name: techName, jobs: [] };
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
                      tech.jobs.map((job, i) => (
                        <div
                          key={job.jobNumber}
                          onClick={() => setSelectedJob(job)}
                          style={{
                            position: i === 0 ? "relative" : "absolute",
                            top: i * 25,
                            left: 0,
                            right: 0,
                            border: "1px solid #eee",
                            borderRadius: "6px",
                            padding: i === 0 ? "6px" : "4px 6px",
                            backgroundColor: i === 0 ? "#f9f9f9" : "#eee",
                            cursor: "pointer",
                            zIndex: tech.jobs.length - i,
                          }}
                        >
                          <p style={{ fontSize: "0.875rem", fontWeight: i === 0 ? "bold" : "normal" }}>
                            {job.jobNumber}
                          </p>
                          {i === 0 && (
                            <>
                              <p style={{ fontSize: "0.75rem" }}>{job.customer}</p>
                              <p style={{ fontSize: "0.75rem" }}>{job.car}</p>
                              <p style={{ fontSize: "0.75rem" }}>{job.description}</p>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Job Card Popup */}
        {selectedJob && (
          <div
            className="fixed inset-0 z-50 flex justify-center items-center"
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              width: "100%",
              height: "100%",
              top: 0,
              left: 0,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "8px",
                width: "400px",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              <h3 style={{ fontWeight: "bold", marginBottom: "8px" }}>Job Card: {selectedJob.jobNumber}</h3>
              <p><strong>Customer:</strong> {selectedJob.customer}</p>
              <p><strong>Car:</strong> {selectedJob.car}</p>
              <p><strong>Description:</strong> {selectedJob.description}</p>
              <p><strong>Status:</strong> {selectedJob.status}</p>

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
          <div
            className="fixed inset-0 z-50 flex justify-center items-center"
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              width: "100%",
              height: "100%",
              top: 0,
              left: 0,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "8px",
                width: "400px",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
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
