// file location: src/pages/job-cards/view/index.js
"use client"; // enables client-side rendering for Next.js

import React, { useState, useEffect } from "react"; // import React and hooks
import Layout from "../../../components/Layout"; // import layout wrapper
import { useRouter } from "next/router"; // for navigation
import { getAllJobs, updateJobStatus } from "../../../lib/database/jobs"; // import database functions

/* ================================
   Utility function: today's date
================================ */
const getTodayDate = () => {
  const today = new Date(); // get current date
  const yyyy = today.getFullYear(); // get year
  const mm = String(today.getMonth() + 1).padStart(2, "0"); // get month with leading zero
  const dd = String(today.getDate()).padStart(2, "0"); // get day with leading zero
  return `${yyyy}-${mm}-${dd}`; // return formatted date
};

/* ================================
   Main component: ViewJobCards
================================ */
export default function ViewJobCards() {
  const [jobs, setJobs] = useState([]); // store all jobs
  const [popupJob, setPopupJob] = useState(null); // store selected job for popup
  const [searchTerms, setSearchTerms] = useState({}); // store search terms for each status
  const [activeTab, setActiveTab] = useState("today"); // track active tab
  const router = useRouter(); // router for navigation
  const today = getTodayDate(); // get today's date

  /* ----------------------------
     Fetch jobs from Supabase
  ---------------------------- */
  const fetchJobs = async () => {
    const jobsFromSupabase = await getAllJobs(); // get all jobs from database
    setJobs(jobsFromSupabase); // update state
  };

  useEffect(() => {
    fetchJobs(); // fetch jobs on component mount
  }, []);

  /* ----------------------------
     Go to job card page
  ---------------------------- */
  const goToJobCard = (jobNumber) => {
    router.push(`/job-cards/${jobNumber}`); // navigate to job card detail page
  };

  /* ----------------------------
     Update job status in Supabase
  ---------------------------- */
  const handleStatusChange = async (jobId, newStatus) => {
    const result = await updateJobStatus(jobId, newStatus); // update status in database
    if (result.success) {
      fetchJobs(); // refresh jobs list after update
      if (popupJob && popupJob.id === jobId) {
        setPopupJob({ ...popupJob, status: newStatus }); // update popup if open
      }
    } else {
      alert("Error updating status"); // show error message
    }
  };

  /* ----------------------------
     Define status categories
  ---------------------------- */
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

  /* ----------------------------
     Filter jobs by status/date
  ---------------------------- */
  const filterJobs = (status) => {
    let filtered = jobs.filter((job) => job.status === status); // filter by status

    // Only today's appointments in Booked
    if (status === "Booked") {
      filtered = filtered.filter(
        (job) => job.appointment && job.appointment.date === today // filter by today's date
      );
    }

    // Search filter
    if (searchTerms[status]) {
      const term = searchTerms[status].toLowerCase(); // convert search term to lowercase
      filtered = filtered.filter(
        (job) =>
          job.jobNumber.toLowerCase().includes(term) || // search by job number
          job.customer.toLowerCase().includes(term) || // search by customer name
          (job.reg && job.reg.toLowerCase().includes(term)) // search by registration
      );
    }

    return filtered; // return filtered jobs
  };

  /* ----------------------------
     Handle search field input
  ---------------------------- */
  const handleSearchChange = (status, value) => {
    setSearchTerms({ ...searchTerms, [status]: value }); // update search term for specific status
  };

  /* ----------------------------
     Render each job card box
  ---------------------------- */
  const renderJobCard = (job, fullView = false) => (
    <div
      key={job.jobNumber}
      style={{
        border: "1px solid #e0e0e0", // light grey border
        borderRadius: "12px", // rounded corners
        padding: "12px", // inner padding
        backgroundColor: "#ffffff", // white background
        cursor: "pointer", // pointer cursor on hover
        boxShadow: "0 2px 4px rgba(0,0,0,0.08)", // subtle shadow
        transition: "all 0.2s", // smooth transition
        marginBottom: "8px", // spacing between cards
      }}
      onClick={() => setPopupJob(job)} // open popup on click
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 8px rgba(209,0,0,0.15)"; // enhance shadow on hover
        e.currentTarget.style.borderColor = "#d10000"; // red border on hover
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.08)"; // reset shadow
        e.currentTarget.style.borderColor = "#e0e0e0"; // reset border
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <strong style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>
          {job.jobNumber}
        </strong>
        <span style={{ fontSize: "12px", color: "#666" }}>
          {job.customer.split(" ").slice(-1)} {/* show last name only */}
        </span>
      </div>
      
      <div style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>
        {job.reg || "No Reg"} {/* show registration or placeholder */}
      </div>
      
      {job.description && (
        <div style={{ fontSize: "12px", color: "#999", marginTop: "8px" }}>
          {job.description.substring(0, 50)}... {/* truncate long descriptions */}
        </div>
      )}
      
      {fullView && (
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #f0f0f0" }}>
          <div style={{ fontSize: "13px", color: "#666", marginBottom: "6px" }}>
            <strong>Customer:</strong> {job.customer}
          </div>
          <div style={{ fontSize: "13px", color: "#666", marginBottom: "6px" }}>
            <strong>Reg:</strong> {job.reg}
          </div>
          <div style={{ fontSize: "13px", color: "#666", marginBottom: "6px" }}>
            <strong>Description:</strong> {job.description}
          </div>
          {job.appointment && (
            <div style={{ fontSize: "13px", color: "#666", marginBottom: "6px" }}>
              <strong>Appointment:</strong> {job.appointment.date} {job.appointment.time}
            </div>
          )}
          {/* Display counts with badges */}
          <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
            <div style={{
              backgroundColor: "#f0f9ff",
              color: "#0369a1",
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "600"
            }}>
              VHC: {job.vhcChecks.length}
            </div>
            <div style={{
              backgroundColor: "#fef3c7",
              color: "#92400e",
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "600"
            }}>
              Parts: {job.partsRequests.length}
            </div>
            <div style={{
              backgroundColor: "#f0fdf4",
              color: "#166534",
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "600"
            }}>
              Notes: {job.notes.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ----------------------------
     Grid layout styling
  ---------------------------- */
  const gridLayout =
    activeTab === "today"
      ? { gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, 1fr)" } // 3x3 grid for today
      : { gridTemplateColumns: "repeat(2, 1fr)", gridTemplateRows: "repeat(3, 1fr)" }; // 2x3 grid for carry over

  /* ================================
     Page Layout
  ================================ */
  return (
    <Layout>
      <div style={{ 
        height: "100%", 
        display: "flex", 
        flexDirection: "column", 
        padding: "16px",
        overflow: "hidden" 
      }}>
        {/* ✅ Header Section */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "16px",
          flexShrink: 0
        }}>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#1a1a1a" }}>
            View Job Cards
          </h1>
        </div>

        {/* ✅ Tabs Navigation - Modern Design */}
        <div style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
          borderBottom: "2px solid #e0e0e0",
          flexShrink: 0
        }}>
          <button
            onClick={() => setActiveTab("today")}
            style={{
              padding: "12px 24px",
              backgroundColor: activeTab === "today" ? "#d10000" : "transparent",
              color: activeTab === "today" ? "white" : "#666",
              border: "none",
              borderBottom: activeTab === "today" ? "3px solid #d10000" : "3px solid transparent",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: activeTab === "today" ? "600" : "500",
              transition: "all 0.2s"
            }}
          >
            Today's Workload
          </button>
          <button
            onClick={() => setActiveTab("carryOver")}
            style={{
              padding: "12px 24px",
              backgroundColor: activeTab === "carryOver" ? "#d10000" : "transparent",
              color: activeTab === "carryOver" ? "white" : "#666",
              border: "none",
              borderBottom: activeTab === "carryOver" ? "3px solid #d10000" : "3px solid transparent",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: activeTab === "carryOver" ? "600" : "500",
              transition: "all 0.2s"
            }}
          >
            Carry Over
          </button>
        </div>

        {/* ✅ Job Sections Grid - Scrollable */}
        <div
          style={{
            display: "grid",
            gap: "16px",
            ...gridLayout,
            flex: 1,
            overflow: "hidden"
          }}
        >
          {tabs[activeTab].map((status) => (
            <div
              key={status}
              style={{
                background: "white",
                borderRadius: "16px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid #e0e0e0",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
              }}
            >
              {/* Section Header */}
              <h2 style={{ 
                fontSize: "16px", 
                fontWeight: "600", 
                color: "#1a1a1a",
                marginBottom: "12px",
                flexShrink: 0
              }}>
                {status}
              </h2>

              {/* Search Input - Modern Design */}
              <input
                type="text"
                placeholder="Search by job, reg, customer..."
                value={searchTerms[status] || ""}
                onChange={(e) => handleSearchChange(status, e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  marginBottom: "12px",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0",
                  fontSize: "13px",
                  outline: "none",
                  transition: "border-color 0.2s",
                  flexShrink: 0
                }}
                onFocus={(e) => e.target.style.borderColor = "#d10000"}
                onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
              />

              {/* Job Cards - Scrollable Area */}
              <div style={{ 
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                {filterJobs(status).length > 0 ? (
                  filterJobs(status).map((job) =>
                    status === "Booked" ? renderJobCard(job, true) : renderJobCard(job)
                  )
                ) : (
                  <div style={{
                    textAlign: "center",
                    color: "#999",
                    fontSize: "13px",
                    padding: "20px"
                  }}>
                    No jobs found
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ✅ Job Popup - Modern Design */}
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
                padding: "32px",
                borderRadius: "16px",
                maxWidth: "600px",
                width: "90%",
                maxHeight: "80vh",
                overflowY: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
              }}
            >
              {/* Popup Header */}
              <div style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "24px", fontWeight: "700", color: "#1a1a1a", marginBottom: "8px" }}>
                  {popupJob.jobNumber}
                </h2>
                <p style={{ fontSize: "16px", color: "#666" }}>
                  {popupJob.customer}
                </p>
              </div>

              {/* Job Details */}
              <div style={{ 
                background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
                border: "1px solid #ffe5e5",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "20px"
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontSize: "14px", color: "#666" }}>
                    <strong>Registration:</strong> {popupJob.reg}
                  </div>
                  <div style={{ fontSize: "14px", color: "#666" }}>
                    <strong>Description:</strong> {popupJob.description}
                  </div>
                  {popupJob.appointment && (
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      <strong>Appointment:</strong> {popupJob.appointment.date} at {popupJob.appointment.time}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Badges */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
                <div style={{
                  backgroundColor: "#f0f9ff",
                  color: "#0369a1",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  VHC Checks: {popupJob.vhcChecks.length}
                </div>
                <div style={{
                  backgroundColor: "#fef3c7",
                  color: "#92400e",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  Parts Requests: {popupJob.partsRequests.length}
                </div>
                <div style={{
                  backgroundColor: "#f0fdf4",
                  color: "#166534",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  Notes: {popupJob.notes.length}
                </div>
              </div>

              {/* Status Dropdown */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#666", display: "block", marginBottom: "8px" }}>
                  Update Status
                </label>
                <select
                  value={popupJob.status}
                  onChange={(e) => handleStatusChange(popupJob.id, e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: "14px",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0",
                    backgroundColor: "white",
                    cursor: "pointer"
                  }}
                >
                  {Object.values(tabs).flat().map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  onClick={() => goToJobCard(popupJob.jobNumber)}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    backgroundColor: "#d10000",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "#b00000"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "#d10000"}
                >
                  View Write Up
                </button>

                <button
                  onClick={() => router.push(`/job-cards/vhc/${popupJob.jobNumber}`)}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    backgroundColor: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "#2563eb"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "#3b82f6"}
                >
                  View VHC
                </button>

                <button
                  onClick={() => router.push(`/job-cards/parts/${popupJob.jobNumber}`)}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    backgroundColor: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "#059669"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "#10b981"}
                >
                  Other Actions
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setPopupJob(null)}
                style={{
                  width: "100%",
                  marginTop: "16px",
                  padding: "12px 20px",
                  backgroundColor: "#f5f5f5",
                  color: "#666",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "#e0e0e0"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "#f5f5f5"}
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