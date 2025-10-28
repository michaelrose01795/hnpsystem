// file location: src/pages/job-cards/myjobs/index.js
"use client";

import React, { useEffect, useState } from "react"; // React hooks for state and effects
import Layout from "../../../components/Layout"; // Layout wrapper for page structure
import { useUser } from "../../../context/UserContext"; // Context to get logged-in user
import { usersByRole } from "../../../config/users"; // Role and user mapping
import { getAllJobs } from "../../../lib/database/jobs"; // ✅ Fetch jobs from Supabase

export default function MyJobsPage() {
  const { user } = useUser(); // Get current logged-in user
  const [jobs, setJobs] = useState([]); // Local state for all jobs
  const [myJobs, setMyJobs] = useState([]); // Local state for user's assigned jobs
  const [nextJob, setNextJob] = useState(null); // State for next job assigned
  const [selectedJob, setSelectedJob] = useState(null); // Popup job details
  const [startJobPopup, setStartJobPopup] = useState(null); // Start job popup state

  // Get username from user context
  const username = user?.username;

  // Get technician names list
  const techsList = usersByRole["Techs"] || [];

  // Check if user is a technician
  const isTech = techsList.includes(username);

  // ✅ Fetch jobs from Supabase when page loads
  useEffect(() => {
    const fetchJobs = async () => {
      const fetchedJobs = await getAllJobs();
      setJobs(fetchedJobs);
    };
    fetchJobs();
  }, []);

  // ✅ Filter jobs assigned to this technician
  useEffect(() => {
    if (isTech && jobs.length > 0) {
      // Filter jobs assigned to this technician
      const assignedJobs = jobs.filter(
        (job) => job.assignedTech?.name === username || job.technician === username
      );

      // Sort by job number or created date if available
      const sortedJobs = assignedJobs.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        return (b.jobNumber || 0) - (a.jobNumber || 0);
      });

      setMyJobs(sortedJobs);

      // Pick the latest assigned job as the "next job"
      setNextJob(sortedJobs.length > 0 ? sortedJobs[0] : null);
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

  // Function to handle starting a job
  const handleStartJob = (job) => {
    setSelectedJob(null); // Close "Clock on" popup
    setStartJobPopup(job); // Open start job popup with job number pre-filled
  };

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

        {/* === NEXT JOB ASSIGNED SECTION === */}
        {nextJob && (
          <div
            style={{
              marginBottom: "24px",
              border: "2px solid #FF4040",
              borderRadius: "10px",
              padding: "16px",
              backgroundColor: "#fff5f5",
            }}
          >
            <h2
              style={{
                fontSize: "1.2rem",
                fontWeight: "bold",
                color: "#FF4040",
                marginBottom: "12px",
              }}
            >
              Next Job Assigned
            </h2>

            <div
              onClick={() => setSelectedJob(nextJob)}
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
                (e.currentTarget.style.transform = "scale(1.02)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            >
              <h3 style={{ fontWeight: "bold", color: "#333" }}>
                {nextJob.jobNumber}
              </h3>
              <p style={{ fontSize: "0.9rem", color: "#555" }}>
                <strong>Customer:</strong> {nextJob.customer}
              </p>
              <p style={{ fontSize: "0.9rem", color: "#555" }}>
                <strong>Car:</strong> {nextJob.car || `${nextJob.make} ${nextJob.model}`}
              </p>
              <p style={{ fontSize: "0.9rem", color: "#555" }}>
                <strong>Description:</strong> {nextJob.description}
              </p>
              <p style={{ fontSize: "0.9rem", color: "#777" }}>
                <strong>Status:</strong> {nextJob.status}
              </p>
            </div>
          </div>
        )}

        {/* === ALL MY JOBS LIST === */}
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
                  <strong>Car:</strong> {job.car || `${job.make} ${job.model}`}
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

        {/* === POPUP: CLOCK ON TO JOB === */}
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
              <h3
                style={{
                  fontWeight: "bold",
                  marginBottom: "8px",
                  color: "#FF4040",
                }}
              >
                Clock On To Job
              </h3>
              <p>
                <strong>Job Number:</strong> {selectedJob.jobNumber}
              </p>
              <p>
                <strong>Customer:</strong> {selectedJob.customer}
              </p>
              <p>
                <strong>Car:</strong> {selectedJob.car || `${selectedJob.make} ${selectedJob.model}`}
              </p>
              <p>
                <strong>Description:</strong> {selectedJob.description}
              </p>

              <div
                style={{
                  marginTop: "20px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <button
                  onClick={() => handleStartJob(selectedJob)}
                  style={{
                    backgroundColor: "#28a745",
                    color: "white",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Start Job
                </button>
                <button
                  onClick={() => setSelectedJob(null)}
                  style={{
                    backgroundColor: "#FF4040",
                    color: "white",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === POPUP: START JOB === */}
        {startJobPopup && (
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
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              <h3
                style={{
                  fontWeight: "bold",
                  marginBottom: "8px",
                  color: "#FF4040",
                }}
              >
                Start Job
              </h3>
              <p>
                <strong>Job Number:</strong> {startJobPopup.jobNumber}
              </p>
              <p>
                <strong>Customer:</strong> {startJobPopup.customer}
              </p>
              <p>
                <strong>Car:</strong> {startJobPopup.car || `${startJobPopup.make} ${startJobPopup.model}`}
              </p>
              <p>
                <strong>Description:</strong> {startJobPopup.description}
              </p>

              <button
                onClick={() => setStartJobPopup(null)}
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