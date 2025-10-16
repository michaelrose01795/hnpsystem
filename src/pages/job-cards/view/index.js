// file location: src/pages/job-cards/view/index.js
"use client";

import React, { useState, useEffect } from "react";
import Layout from "../../../components/Layout";
import { useRouter } from "next/router";

// Utility to get today's date string in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Replace this with your actual API call
const fetchJobsFromAPI = async () => {
  // Example: fetch from your jobs endpoint
  const res = await fetch("/api/jobs"); 
  const data = await res.json();
  return data; // Expect an array of jobs with { jobNumber, customer, reg, description, status, appointment }
};

export default function ViewJobCards() {
  const [jobs, setJobs] = useState([]);
  const [popupJob, setPopupJob] = useState(null);
  const [searchTerms, setSearchTerms] = useState({});
  const [activeTab, setActiveTab] = useState("today"); // today / carryOver
  const router = useRouter();
  const today = getTodayDate();

  // Fetch jobs from API on mount
  useEffect(() => {
    const fetchJobs = async () => {
      const jobsFromAPI = await fetchJobsFromAPI();
      setJobs(jobsFromAPI);
    };
    fetchJobs();
  }, []);

  const goToJobCard = (jobNumber) => {
    router.push(`/job-cards/${jobNumber}`);
  };

  // Define tabs and their sections
  const tabs = {
    today: [
      "Booked",
      "Checked In",
      "Workshop/MOT",
      "VHC Complete",
      "VHC Sent",
      "Additional Work Required",
      "Additional Work Being Carried Out",
      "Being Washed",
      "Complete",
    ],
    carryOver: [
      "Retail Parts on Order",
      "Warranty Parts on Order",
      "Raise TSR",
      "Waiting for TSR Response",
      "Warranty Quality Control",
      "Warranty Ready to Claim",
    ],
  };

  // Filter jobs by status and optionally by today's date
  const filterJobs = (status) => {
    let filtered = jobs.filter((job) => job.status === status);

    // If Booked, filter only today's appointments
    if (status === "Booked") {
      filtered = filtered.filter(
        (job) => job.appointment && job.appointment.date === today
      );
    }

    if (searchTerms[status]) {
      const term = searchTerms[status].toLowerCase();
      filtered = filtered.filter(
        (job) =>
          job.jobNumber.toLowerCase().includes(term) ||
          job.customer.toLowerCase().includes(term) ||
          (job.reg && job.reg.toLowerCase().includes(term))
      );
    }

    return filtered;
  };

  const handleSearchChange = (status, value) => {
    setSearchTerms({ ...searchTerms, [status]: value });
  };

  const renderJobCard = (job, fullView = false) => (
    <div
      key={job.jobNumber}
      style={{
        border: "1px solid #ddd",
        borderRadius: "4px",
        padding: "8px",
        backgroundColor: "#f9f9f9",
        cursor: "pointer",
      }}
      onClick={() => setPopupJob(job)}
    >
      <div>
        <strong>{job.jobNumber}</strong> - {job.customer.split(" ").slice(-1)}
      </div>
      <div>{job.reg || ""}</div>
      <div>{job.description || ""}</div>
      {fullView && (
        <>
          <div>Customer: {job.customer}</div>
          <div>Reg: {job.reg}</div>
          <div>Job Description: {job.description}</div>
          {job.appointment && (
            <div>
              Appointment: {job.appointment.date} {job.appointment.time}
            </div>
          )}
        </>
      )}
    </div>
  );

  const gridLayout =
    activeTab === "today"
      ? { gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, 1fr)" }
      : { gridTemplateColumns: "repeat(2, 1fr)", gridTemplateRows: "repeat(3, 1fr)" };

  return (
    <Layout>
      <div style={{ maxWidth: "1500px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "#FF4040", marginBottom: "24px" }}>View Job Cards</h1>

        {/* Tabs */}
        <div style={{ marginBottom: "16px", display: "flex", gap: "16px" }}>
          <button
            style={{
              padding: "8px 16px",
              backgroundColor: activeTab === "today" ? "#FF4040" : "#eee",
              color: activeTab === "today" ? "#fff" : "#333",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
            onClick={() => setActiveTab("today")}
          >
            Today's Workload
          </button>
          <button
            style={{
              padding: "8px 16px",
              backgroundColor: activeTab === "carryOver" ? "#FF4040" : "#eee",
              color: activeTab === "carryOver" ? "#fff" : "#333",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
            onClick={() => setActiveTab("carryOver")}
          >
            Carry Over
          </button>
        </div>

        {/* Job Sections */}
        <div
          style={{
            display: "grid",
            gap: "16px",
            ...gridLayout,
            height: "calc(100vh - 180px)",
          }}
        >
          {tabs[activeTab].map((status) => (
            <div
              key={status}
              style={{
                backgroundColor: "white",
                borderRadius: "8px",
                padding: "16px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h2 style={{ fontWeight: "600", fontSize: "1.1rem", marginBottom: "8px" }}>{status}</h2>

              <input
                type="text"
                placeholder="Search by job, reg, customer"
                value={searchTerms[status] || ""}
                onChange={(e) => handleSearchChange(status, e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  marginBottom: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {filterJobs(status).length > 0 ? (
                  filterJobs(status).map((job) =>
                    status === "Booked" ? renderJobCard(job, true) : renderJobCard(job)
                  )
                ) : (
                  <p style={{ color: "#999", fontSize: "0.875rem" }}>No jobs</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Job Popup */}
        {popupJob && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
            onClick={() => setPopupJob(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "8px",
                maxWidth: "600px",
                width: "100%",
                maxHeight: "80vh",
                overflowY: "auto",
              }}
            >
              <h2>
                {popupJob.jobNumber} - {popupJob.customer}
              </h2>
              <p>Reg: {popupJob.reg}</p>
              <p>Description: {popupJob.description}</p>
              {popupJob.appointment && (
                <p>
                  Appointment: {popupJob.appointment.date} {popupJob.appointment.time}
                </p>
              )}

              <div style={{ display: "flex", gap: "6px", marginTop: "12px", flexWrap: "wrap" }}>
                <button style={{ padding: "4px 8px", fontSize: "0.75rem" }}>State Selector</button>
                <button style={{ padding: "4px 8px", fontSize: "0.75rem" }}>View Write Up</button>
                <button style={{ padding: "4px 8px", fontSize: "0.75rem" }}>View VHC</button>
                <button style={{ padding: "4px 8px", fontSize: "0.75rem" }}>Other Actions</button>
              </div>

              <button
                style={{ marginTop: "12px", padding: "6px 12px", fontSize: "0.85rem" }}
                onClick={() => setPopupJob(null)}
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
