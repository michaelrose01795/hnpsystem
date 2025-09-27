// file location: src/pages/job-cards/view/index.js
"use client";

import React, { useState, useEffect } from "react";
import Layout from "../../../components/Layout";
import { useRouter } from "next/router";

// Dummy job cards for initial display
const initialJobs = [
  { jobNumber: "JN001", customer: "John Smith", status: "Checked In" },
  { jobNumber: "JN002", customer: "Jane Doe", status: "Checked In" },
  { jobNumber: "JN003", customer: "Mike Johnson", status: "Checked In" },
];

export default function ViewJobCards() {
  const [jobs, setJobs] = useState([]);
  const router = useRouter();

  useEffect(() => {
    setJobs(initialJobs);
  }, []);

  const goToJobCard = (jobNumber) => {
    router.push(`/job-cards/${jobNumber}`);
  };

  const getJobsByStatus = (status) => {
    return jobs.filter((job) => job.status === status);
  };

  const jobStatuses = ["Booked", "Checked In", "Workshop/MOT", "Waiting for Parts", "Being Washed", "Complete"];

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "#FF4040", marginBottom: "24px" }}>View Job Cards</h1>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
          {jobStatuses.map((status) => (
            <div
              key={status}
              style={{
                flex: "1 1 250px",
                backgroundColor: "white",
                borderRadius: "8px",
                padding: "16px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h2 style={{ fontWeight: "600", fontSize: "1.1rem", marginBottom: "12px" }}>{status}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                {getJobsByStatus(status).length > 0 ? (
                  getJobsByStatus(status).map((job) => (
                    <button
                      key={job.jobNumber}
                      onClick={() => goToJobCard(job.jobNumber)}
                      style={{
                        textAlign: "left",
                        padding: "8px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: "pointer",
                        backgroundColor: "#f9f9f9",
                        color: "black",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e0e0e0")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f9f9f9")}
                    >
                      {job.jobNumber} - {job.customer}
                    </button>
                  ))
                ) : (
                  <p style={{ color: "#999", fontSize: "0.875rem" }}>No jobs</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
