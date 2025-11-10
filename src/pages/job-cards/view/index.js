// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/job-cards/view/index.js
"use client"; // enables client-side rendering for Next.js

import React, { useState, useEffect } from "react"; // import React and hooks
import Link from "next/link";
import Layout from "@/components/Layout"; // import layout wrapper
import { useRouter } from "next/router"; // for navigation
import { getAllJobs, updateJobStatus } from "@/lib/database/jobs"; // import database functions

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
  const [loading, setLoading] = useState(true); // loading state
  const router = useRouter(); // router for navigation
  const today = getTodayDate(); // get today's date

  /* ----------------------------
     Fetch jobs from Supabase
  ---------------------------- */
  const fetchJobs = async () => {
    setLoading(true); // show loading state
    const jobsFromSupabase = await getAllJobs(); // get all jobs from database with full data
    console.log("📋 Fetched jobs:", jobsFromSupabase); // debug log
    setJobs(jobsFromSupabase); // update state
    setLoading(false); // hide loading state
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

    // Search filter - now includes more fields
    if (searchTerms[status]) {
      const term = searchTerms[status].toLowerCase(); // convert search term to lowercase
      filtered = filtered.filter(
        (job) =>
          job.jobNumber.toLowerCase().includes(term) || // search by job number
          job.customer.toLowerCase().includes(term) || // search by customer name
          (job.reg && job.reg.toLowerCase().includes(term)) || // search by registration
          (job.makeModel && job.makeModel.toLowerCase().includes(term)) || // ✅ search by make/model
          (job.vin && job.vin.toLowerCase().includes(term)) // ✅ search by VIN
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
     ✅ Get background color based on job source
  ---------------------------- */
  const getJobCardBackground = (job) => {
    if (job.jobSource === "Warranty") {
      return "linear-gradient(135deg, #fff5e6 0%, #ffe6cc 100%)"; // orange gradient for warranty
    }
    return "#ffffff"; // white for retail
  };

  /* ----------------------------
     ✅ Get border color based on waiting status
  ---------------------------- */
  const getJobCardBorderColor = (job) => {
    switch (job.waitingStatus) {
      case "Waiting":
        return "#ff4444"; // red for waiting
      case "Loan Car":
        return "#4488ff"; // blue for loan car
      case "Collection":
        return "#44ff88"; // green for collection
      default:
        return "#e0e0e0"; // default grey
    }
  };

  /* ----------------------------
     Render each job card box
  ---------------------------- */
  const renderJobCard = (job, fullView = false) => (
    <div
      key={job.jobNumber}
      style={{
        border: `2px solid ${getJobCardBorderColor(job)}`, // ✅ dynamic border based on waiting status
        borderRadius: "12px", // rounded corners
        padding: "12px", // inner padding
        background: getJobCardBackground(job), // ✅ dynamic background based on job source
        cursor: "pointer", // pointer cursor on hover
        boxShadow: "0 2px 4px rgba(0,0,0,0.08)", // subtle shadow
        transition: "all 0.2s", // smooth transition
        marginBottom: "8px", // spacing between cards
      }}
      onClick={() => setPopupJob(job)} // open popup on click
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 8px rgba(209,0,0,0.15)"; // enhance shadow on hover
        e.currentTarget.style.transform = "translateY(-2px)"; // lift effect
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.08)"; // reset shadow
        e.currentTarget.style.transform = "translateY(0)"; // reset position
      }}
    >
      {/* ✅ Job Source Badge */}
      {job.jobSource === "Warranty" && (
        <div style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          backgroundColor: "#ff8800",
          color: "white",
          padding: "4px 8px",
          borderRadius: "6px",
          fontSize: "10px",
          fontWeight: "600"
        }}>
          WARRANTY
        </div>
      )}

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

      {/* ✅ Show make/model if available */}
      {job.makeModel && (
        <div style={{ fontSize: "12px", color: "#999", marginBottom: "4px" }}>
          {job.makeModel}
        </div>
      )}
      
      {/* ✅ Show job categories as badges */}
      {job.jobCategories && job.jobCategories.length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
          {job.jobCategories.map((category, idx) => (
            <span
              key={idx}
              style={{
                backgroundColor: "#f0f0f0",
                color: "#666",
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "10px",
                fontWeight: "600"
              }}
            >
              {category}
            </span>
          ))}
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
          {job.makeModel && (
            <div style={{ fontSize: "13px", color: "#666", marginBottom: "6px" }}>
              <strong>Vehicle:</strong> {job.makeModel}
            </div>
          )}
          {/* ✅ Show waiting status */}
          {job.waitingStatus && job.waitingStatus !== "Neither" && (
            <div style={{ fontSize: "13px", color: "#666", marginBottom: "6px" }}>
              <strong>Status:</strong> {job.waitingStatus}
            </div>
          )}
          {/* ✅ Show requests if available */}
          {job.requests && job.requests.length > 0 && (
            <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
              <strong>Requests:</strong>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                {job.requests.slice(0, 2).map((req, idx) => (
                  <li key={idx} style={{ marginBottom: "2px" }}>
                    {req.text || req}
                  </li>
                ))}
                {job.requests.length > 2 && (
                  <li style={{ color: "#999", fontStyle: "italic" }}>
                    +{job.requests.length - 2} more...
                  </li>
                )}
              </ul>
            </div>
          )}
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
              VHC: {job.vhcChecks?.length || 0}
            </div>
            <div style={{
              backgroundColor: "#fef3c7",
              color: "#92400e",
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "600"
            }}>
              Parts: {job.partsRequests?.length || 0}
            </div>
            <div style={{
              backgroundColor: "#f0fdf4",
              color: "#166534",
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "600"
            }}>
              Notes: {job.notes?.length || 0}
            </div>
            {/* ✅ NEW: Show files count */}
            {job.files && job.files.length > 0 && (
              <div style={{
                backgroundColor: "#fef3f2",
                color: "#991b1b",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "600"
              }}>
                Files: {job.files.length}
              </div>
            )}
            {/* ✅ NEW: Show VHC required indicator */}
            {job.vhcRequired && (
              <div style={{
                backgroundColor: "#ffe4e6",
                color: "#be123c",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "600"
              }}>
                VHC REQUIRED
              </div>
            )}
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
     Loading State
  ================================ */
  if (loading) {
    return (
      <Layout>
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          height: "100vh" 
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ 
              fontSize: "18px", 
              fontWeight: "600", 
              color: "#d10000",
              marginBottom: "12px"
            }}>
              Loading Job Cards...
            </div>
            <div style={{ fontSize: "14px", color: "#666" }}>
              Please wait while we fetch your data
            </div>
          </div>
        </div>
      </Layout>
    );
  }

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
          <div>
            <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
              Total Jobs: {jobs.length} | Today: {filterJobs("Booked").length} Booked
            </p>
          </div>
          <button
            onClick={fetchJobs}
            style={{
              padding: "10px 20px",
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
            🔄 Refresh
          </button>
        </div>

        {/* ✅ Tabs Navigation */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            justifyContent: "flex-start",
            alignItems: "center",
            borderBottom: "2px solid #e0e0e0",
            paddingBottom: "8px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              flex: "1 1 auto",
              minWidth: "240px",
            }}
          >
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
                transition: "all 0.2s",
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
                transition: "all 0.2s",
              }}
            >
              Carry Over
            </button>
          </div>
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
          {tabs[activeTab].map((status) => {
            const filteredJobs = filterJobs(status);
            return (
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
                {/* Section Header with Count */}
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  marginBottom: "12px",
                  flexShrink: 0
                }}>
                  <h2 style={{ 
                    fontSize: "16px", 
                    fontWeight: "600", 
                    color: "#1a1a1a",
                    margin: 0
                  }}>
                    {status}
                  </h2>
                  <span style={{
                    backgroundColor: "#f0f0f0",
                    color: "#666",
                    padding: "4px 10px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}>
                    {filteredJobs.length}
                  </span>
                </div>

                {/* Search Input - Modern Design */}
                <input
                  type="text"
                  placeholder="Search job, reg, vehicle..."
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
                  gap: "8px",
                  position: "relative"
                }}>
                  {filteredJobs.length > 0 ? (
                    filteredJobs.map((job) =>
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
            );
          })}
        </div>

        {/* ✅ Job Popup - Enhanced with all new fields */}
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
                maxWidth: "700px",
                width: "90%",
                maxHeight: "85vh",
                overflowY: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
              }}
            >
              {/* Popup Header */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ fontSize: "24px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
                      {popupJob.jobNumber}
                    </h2>
                    <p style={{ fontSize: "16px", color: "#666", margin: 0 }}>
                      {popupJob.customer}
                    </p>
                  </div>
                  {/* ✅ Job Source Badge */}
                  <div style={{
                    backgroundColor: popupJob.jobSource === "Warranty" ? "#ff8800" : "#4CAF50",
                    color: "white",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}>
                    {popupJob.jobSource || "RETAIL"}
                  </div>
                </div>
              </div>

              {/* ✅ Job Details - Enhanced */}
              <div style={{ 
                background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
                border: "1px solid #ffe5e5",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "20px"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ fontSize: "14px", color: "#666" }}>
                    <strong>Registration:</strong> {popupJob.reg}
                  </div>
                  {popupJob.makeModel && (
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      <strong>Vehicle:</strong> {popupJob.makeModel}
                    </div>
                  )}
                  {popupJob.vin && (
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      <strong>VIN:</strong> {popupJob.vin}
                    </div>
                  )}
                  {popupJob.mileage && (
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      <strong>Mileage:</strong> {popupJob.mileage.toLocaleString()} miles
                    </div>
                  )}
                  {/* ✅ Waiting Status */}
                  {popupJob.waitingStatus && popupJob.waitingStatus !== "Neither" && (
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      <strong>Customer Status:</strong> {popupJob.waitingStatus}
                    </div>
                  )}
                  {popupJob.appointment && (
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      <strong>Appointment:</strong> {popupJob.appointment.date} at {popupJob.appointment.time}
                    </div>
                  )}
                </div>

                {/* ✅ Job Categories */}
                {popupJob.jobCategories && popupJob.jobCategories.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <strong style={{ fontSize: "14px", color: "#666" }}>Job Types:</strong>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                      {popupJob.jobCategories.map((category, idx) => (
                        <span
                          key={idx}
                          style={{
                            backgroundColor: "#e0e0e0",
                            color: "#333",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600"
                          }}
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ✅ Job Requests */}
                {popupJob.requests && popupJob.requests.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <strong style={{ fontSize: "14px", color: "#666" }}>Customer Requests:</strong>
                    <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px" }}>
                      {popupJob.requests.map((req, idx) => (
                        <li key={idx} style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>
                          {req.text || req} 
                          {req.time && <span style={{ color: "#999" }}> ({req.time}h)</span>}
                          {req.paymentType && req.paymentType !== "Customer" && (
                            <span style={{ 
                              marginLeft: "8px", 
                              backgroundColor: "#fff3cd", 
                              padding: "2px 6px", 
                              borderRadius: "4px",
                              fontSize: "11px"
                            }}>
                              {req.paymentType}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ✅ Cosmetic Notes */}
                {popupJob.cosmeticNotes && (
                  <div style={{ marginTop: "12px" }}>
                    <strong style={{ fontSize: "14px", color: "#666" }}>Cosmetic Damage:</strong>
                    <p style={{ fontSize: "13px", color: "#666", margin: "4px 0 0 0" }}>
                      {popupJob.cosmeticNotes}
                    </p>
                  </div>
                )}
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
                  VHC Checks: {popupJob.vhcChecks?.length || 0}
                </div>
                <div style={{
                  backgroundColor: "#fef3c7",
                  color: "#92400e",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  Parts Requests: {popupJob.partsRequests?.length || 0}
                </div>
                <div style={{
                  backgroundColor: "#f0fdf4",
                  color: "#166534",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  Notes: {popupJob.notes?.length || 0}
                </div>
                {/* ✅ Files Badge */}
                {popupJob.files && popupJob.files.length > 0 && (
                  <div style={{
                    backgroundColor: "#fef3f2",
                    color: "#991b1b",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "600"
                  }}>
                    Files: {popupJob.files.length}
                  </div>
                )}
                {/* ✅ VHC Required Badge */}
                {popupJob.vhcRequired && (
                  <div style={{
                    backgroundColor: "#ffe4e6",
                    color: "#be123c",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "600"
                  }}>
                    VHC REQUIRED
                  </div>
                )}
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
                  📝 View Full Details
                </button>

                <button
                  onClick={() => router.push(`/job-cards/${popupJob.jobNumber}/vhc`)}
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
                  🔍 View VHC
                </button>

                <button
                  onClick={() => router.push(`/job-cards/${popupJob.jobNumber}/write-up`)}
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
                  ✍️ Write-Up
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
