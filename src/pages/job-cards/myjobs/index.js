// file location: src/pages/job-cards/myjobs/index.js
"use client";

import React, { useEffect, useState } from "react"; // React hooks for state and effects
import Layout from "../../../components/Layout"; // Layout wrapper for page structure
import { useUser } from "../../../context/UserContext"; // Context to get logged-in user
import { usersByRole } from "../../../config/users"; // Role and user mapping
import { useJobs } from "../../../context/JobsContext"; // Context for job data

export default function MyJobsPage() {
  const { user } = useUser(); // Get current logged-in user
  const { jobs } = useJobs(); // Get all jobs from global context
  const [myJobs, setMyJobs] = useState([]); // Local state for storing user’s jobs
  const [selectedJob, setSelectedJob] = useState(null); // For job popup details

  // Get username from user context
  const username = user?.username;

  // Create list of technician names
  const techsList = usersByRole["Techs"] || [];

  // Check if user is a technician
  const isTech = techsList.includes(username);

  useEffect(() => {
    if (isTech && jobs.length > 0) {
      // Filter jobs assigned to this technician
      const filteredJobs = jobs.filter(
        (job) => job.assignedTech?.name === username
      );
      setMyJobs(filteredJobs);
    }
  }, [jobs, username, isTech]);

  // If user is not a technician, block access
  if (!isTech) {
    return (
      <Layout>
        <div style={{ padding: "20px" }}>
          <p style={{ color: "#FF4040", fontWeight: "bold" }}>
            Access Denied – This page is only for Technicians.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "16px" }}>
        <h1
          style={{
            color: "#FF4040",
            fontSize: "1.5rem",
            fontWeight: "bold",
            marginBottom: "16px",
          }}
        >
          My Jobs
        </h1>

        {myJobs.length === 0 ? (
          <p style={{ color: "#777", fontSize: "1rem" }}>
            You currently have no jobs assigned.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {myJobs.map((job) => (
              <div
                key={job.jobNumber}
                onClick={() => setSelectedJob(job)}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  padding: "12px",
                  backgroundColor: "white",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  transition: "transform 0.1s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = "scale(1.01)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                <h3 style={{ fontWeight: "bold", color: "#333" }}>
                  {job.jobNumber}
                </h3>
                <p style={{ fontSize: "0.9rem", color: "#555" }}>
                  <strong>Customer:</strong> {job.customer}
                </p>
                <p style={{ fontSize: "0.9rem", color: "#555" }}>
                  <strong>Car:</strong> {job.car}
                </p>
                <p style={{ fontSize: "0.9rem", color: "#555" }}>
                  <strong>Description:</strong> {job.description}
                </p>
                <p style={{ fontSize: "0.9rem", color: "#777" }}>
                  <strong>Status:</strong> {job.status}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Popup for Job Details */}
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
              <h3 style={{ fontWeight: "bold", marginBottom: "8px" }}>
                Job Details
              </h3>
              <p>
                <strong>Job Number:</strong> {selectedJob.jobNumber}
              </p>
              <p>
                <strong>Customer:</strong> {selectedJob.customer}
              </p>
              <p>
                <strong>Car:</strong> {selectedJob.car}
              </p>
              <p>
                <strong>Description:</strong> {selectedJob.description}
              </p>
              <p>
                <strong>Status:</strong> {selectedJob.status}
              </p>
              <p>
                <strong>Assigned Technician:</strong>{" "}
                {selectedJob.assignedTech?.name || "Unassigned"}
              </p>

              <button
                onClick={() => setSelectedJob(null)}
                style={{
                  marginTop: "16px",
                  backgroundColor: "#FF4040",
                  color: "white",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}