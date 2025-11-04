// file location: src/pages/job-cards/myjobs/index.js
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { useUser } from "../../../context/UserContext";
import { usersByRole } from "../../../config/users";
import { getAllJobs } from "../../../lib/database/jobs";
import { getClockingStatus } from "../../../lib/database/clocking";

export default function MyJobsPage() {
  const router = useRouter();
  const { user } = useUser();
  
  const [jobs, setJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [clockingStatus, setClockingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, in-progress, pending, complete
  const [searchTerm, setSearchTerm] = useState("");

  const username = user?.username;
  const techsList = usersByRole["Techs"] || [];
  const isTech = techsList.includes(username);

  // ✅ Fetch jobs from database
  useEffect(() => {
    if (!isTech || !username) return;

    const fetchJobs = async () => {
      setLoading(true);

      try {
        // Fetch all jobs
        const fetchedJobs = await getAllJobs();
        setJobs(fetchedJobs);

        // Filter jobs assigned to this technician
        const assignedJobs = fetchedJobs.filter(
          (job) => job.assignedTech?.name === username || job.technician === username
        );

        // Sort by created date (newest first)
        const sortedJobs = assignedJobs.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          }
          return 0;
        });

        setMyJobs(sortedJobs);
        setFilteredJobs(sortedJobs);

        // Get clocking status
        const { data: clockData } = await getClockingStatus(username);
        setClockingStatus(clockData);

      } catch (error) {
        console.error("❌ Error fetching jobs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [username, isTech]);

  // ✅ Apply filters when filter or search changes
  useEffect(() => {
    let filtered = [...myJobs];

    // Apply status filter
    if (filter === "in-progress") {
      filtered = filtered.filter(job => 
        job.status === "In Progress" || job.status === "Started"
      );
    } else if (filter === "pending") {
      filtered = filtered.filter(job => 
        job.status === "Pending" || job.status === "Waiting" || job.status === "Open"
      );
    } else if (filter === "complete") {
      filtered = filtered.filter(job => 
        job.status === "Complete" || job.status === "Completed"
      );
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(job =>
        job.jobNumber?.toLowerCase().includes(lower) ||
        job.customer?.toLowerCase().includes(lower) ||
        job.reg?.toLowerCase().includes(lower) ||
        job.makeModel?.toLowerCase().includes(lower)
      );
    }

    setFilteredJobs(filtered);
  }, [filter, searchTerm, myJobs]);

  // ✅ Handle job click - navigate to job detail page
  const handleJobClick = (job) => {
    router.push(`/job-cards/myjobs/${job.jobNumber}`);
  };

  // ✅ Access check
  if (!isTech) {
    return (
      <Layout>
        <div style={{ 
          padding: "40px", 
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh"
        }}>
          <div style={{ fontSize: "60px", marginBottom: "20px" }}>⚠️</div>
          <h2 style={{ color: "#FF4040", marginBottom: "10px", fontWeight: "700" }}>
            Access Denied
          </h2>
          <p style={{ color: "#666", fontSize: "16px" }}>
            This page is only accessible to Technicians.
          </p>
        </div>
      </Layout>
    );
  }

  // ✅ Loading state
  if (loading) {
    return (
      <Layout>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "80vh",
          flexDirection: "column",
          gap: "16px"
        }}>
          <div style={{
            width: "60px",
            height: "60px",
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #FF4040",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ color: "#666", fontSize: "16px" }}>Loading your jobs...</p>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ 
        maxWidth: "1400px", 
        margin: "0 auto", 
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        minHeight: "90vh"
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <h1 style={{
              color: "#FF4040",
              fontSize: "32px",
              fontWeight: "700",
              margin: "0 0 8px 0"
            }}>
              My Assigned Jobs
            </h1>
            <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
              {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""} assigned to you
            </p>
          </div>

          <button
            onClick={() => router.push("/tech/dashboard")}
            style={{
              padding: "12px 24px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#0056b3"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#007bff"}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Clocking Status Banner */}
        {clockingStatus && (
          <div style={{
            backgroundColor: "#dcfce7",
            border: "1px solid #86efac",
            borderRadius: "12px",
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: "#10b981",
                animation: "pulse 2s infinite"
              }}></div>
              <div>
                <p style={{ fontSize: "14px", fontWeight: "600", color: "#166534", margin: 0 }}>
                  Currently Clocked In
                </p>
                <p style={{ fontSize: "12px", color: "#166534", margin: "4px 0 0 0" }}>
                  Since {new Date(clockingStatus.clock_in).toLocaleTimeString("en-GB", { 
                    hour: "2-digit", 
                    minute: "2-digit" 
                  })} • {calculateHoursWorked(clockingStatus.clock_in)} hours worked today
                </p>
              </div>
            </div>
            <style jsx>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}</style>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div style={{
          display: "flex",
          gap: "12px",
          alignItems: "center"
        }}>
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search by job number, customer, reg, or vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              outline: "none"
            }}
            onFocus={(e) => e.target.style.borderColor = "#FF4040"}
            onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
          />

          {/* Filter Buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            {[
              { value: "all", label: "All Jobs" },
              { value: "in-progress", label: "In Progress" },
              { value: "pending", label: "Pending" },
              { value: "complete", label: "Complete" }
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                style={{
                  padding: "10px 20px",
                  backgroundColor: filter === value ? "#FF4040" : "white",
                  color: filter === value ? "white" : "#666",
                  border: `1px solid ${filter === value ? "#FF4040" : "#e0e0e0"}`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: filter === value ? "600" : "500",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (filter !== value) {
                    e.target.style.backgroundColor = "#f5f5f5";
                  }
                }}
                onMouseLeave={(e) => {
                  if (filter !== value) {
                    e.target.style.backgroundColor = "white";
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Jobs Grid */}
        {filteredJobs.length === 0 ? (
          <div style={{
            backgroundColor: "white",
            padding: "60px",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e0e0e0",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "64px", marginBottom: "20px" }}>
              {searchTerm ? "🔍" : "📭"}
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: "600", color: "#333", marginBottom: "8px" }}>
              {searchTerm ? "No jobs found" : "No jobs assigned"}
            </h3>
            <p style={{ color: "#666", fontSize: "14px" }}>
              {searchTerm 
                ? "Try adjusting your search or filter criteria"
                : "You currently have no jobs assigned to you"
              }
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
            gap: "16px"
          }}>
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => handleJobClick(job)}
                style={{
                  backgroundColor: "white",
                  border: "1px solid #e0e0e0",
                  borderRadius: "12px",
                  padding: "20px",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                  transition: "all 0.3s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 8px 16px rgba(209,0,0,0.15)";
                  e.currentTarget.style.borderColor = "#FF4040";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
                  e.currentTarget.style.borderColor = "#e0e0e0";
                }}
              >
                {/* Job Number and Status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{
                    fontSize: "20px",
                    fontWeight: "700",
                    color: "#FF4040",
                    margin: 0
                  }}>
                    {job.jobNumber}
                  </h3>
                  <span style={{
                    padding: "6px 12px",
                    backgroundColor: 
                      job.status === "In Progress" ? "#dbeafe" :
                      job.status === "Complete" ? "#dcfce7" :
                      job.status === "Pending" ? "#fef3c7" :
                      "#f3f4f6",
                    color:
                      job.status === "In Progress" ? "#1e40af" :
                      job.status === "Complete" ? "#166534" :
                      job.status === "Pending" ? "#92400e" :
                      "#4b5563",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}>
                    {job.status}
                  </span>
                </div>

                {/* Customer Info */}
                <div style={{ paddingTop: "8px", borderTop: "1px solid #f0f0f0" }}>
                  <p style={{ fontSize: "14px", color: "#666", margin: "0 0 6px 0" }}>
                    <strong style={{ color: "#333" }}>Customer:</strong> {job.customer}
                  </p>
                  <p style={{ fontSize: "14px", color: "#666", margin: "0 0 6px 0" }}>
                    <strong style={{ color: "#333" }}>Vehicle:</strong> {job.reg}
                  </p>
                  <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
                    <strong style={{ color: "#333" }}>Make/Model:</strong> {job.makeModel || `${job.make} ${job.model}`}
                  </p>
                </div>

                {/* Job Description */}
                {job.description && (
                  <div style={{
                    padding: "12px",
                    backgroundColor: "#f9f9f9",
                    borderRadius: "8px",
                    borderLeft: "3px solid #FF4040"
                  }}>
                    <p style={{
                      fontSize: "13px",
                      color: "#666",
                      margin: 0,
                      lineHeight: "1.5",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    }}>
                      {job.description}
                    </p>
                  </div>
                )}

                {/* Job Meta Info */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "8px",
                  borderTop: "1px solid #f0f0f0",
                  fontSize: "12px",
                  color: "#999"
                }}>
                  <span>
                    {job.createdAt && new Date(job.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short"
                    })}
                  </span>
                  {job.vhcRequired && (
                    <span style={{
                      padding: "4px 8px",
                      backgroundColor: "#fef2f2",
                      color: "#991b1b",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: "600"
                    }}>
                      VHC Required
                    </span>
                  )}
                </div>

                {/* Quick Actions */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  paddingTop: "12px"
                }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/vhc?job=${job.jobNumber}`);
                    }}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "#f0f9ff",
                      color: "#0369a1",
                      border: "1px solid #bfdbfe",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "600",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#dbeafe";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "#f0f9ff";
                    }}
                  >
                    🔍 VHC
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/job-cards/${job.jobNumber}/write-up`);
                    }}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "#f0fdf4",
                      color: "#166534",
                      border: "1px solid #86efac",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "600",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#dcfce7";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "#f0fdf4";
                    }}
                  >
                    ✍️ Write-Up
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Job Count Summary */}
        <div style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "12px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          border: "1px solid #e0e0e0"
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px",
            textAlign: "center"
          }}>
            <div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "#0369a1", marginBottom: "4px" }}>
                {myJobs.length}
              </div>
              <div style={{ fontSize: "13px", color: "#666" }}>Total Jobs</div>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "#3b82f6", marginBottom: "4px" }}>
                {myJobs.filter(j => j.status === "In Progress").length}
              </div>
              <div style={{ fontSize: "13px", color: "#666" }}>In Progress</div>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "#fbbf24", marginBottom: "4px" }}>
                {myJobs.filter(j => j.status === "Pending" || j.status === "Open").length}
              </div>
              <div style={{ fontSize: "13px", color: "#666" }}>Pending</div>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "#10b981", marginBottom: "4px" }}>
                {myJobs.filter(j => j.status === "Complete" || j.status === "Completed").length}
              </div>
              <div style={{ fontSize: "13px", color: "#666" }}>Completed</div>
            </div>
          </div>
        </div>

        {/* Quick Info Box */}
        <div style={{
          backgroundColor: "#f0f9ff",
          border: "1px solid #bfdbfe",
          borderRadius: "12px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: "12px"
        }}>
          <div style={{ fontSize: "24px" }}>💡</div>
          <div>
            <p style={{ fontSize: "14px", fontWeight: "600", color: "#1e40af", margin: "0 0 4px 0" }}>
              Quick Tip
            </p>
            <p style={{ fontSize: "13px", color: "#3730a3", margin: 0 }}>
              Click on any job card to view full details, add VHC checks, request parts, and update the job status.
            </p>
          </div>
        </div>
      </div>

      {/* Job Detail Popup (if needed) */}
      {selectedJob && (
        <div
          onClick={() => setSelectedJob(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "white",
              padding: "32px",
              borderRadius: "16px",
              maxWidth: "600px",
              width: "90%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
            }}
          >
            <h2 style={{ fontSize: "24px", fontWeight: "700", color: "#FF4040", marginBottom: "16px" }}>
              {selectedJob.jobNumber}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ fontSize: "14px" }}>
                <strong>Customer:</strong> {selectedJob.customer}
              </p>
              <p style={{ fontSize: "14px" }}>
                <strong>Vehicle:</strong> {selectedJob.reg} - {selectedJob.makeModel}
              </p>
              <p style={{ fontSize: "14px" }}>
                <strong>Status:</strong> {selectedJob.status}
              </p>
              {selectedJob.description && (
                <p style={{ fontSize: "14px" }}>
                  <strong>Description:</strong> {selectedJob.description}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button
                onClick={() => {
                  setSelectedJob(null);
                  handleJobClick(selectedJob);
                }}
                style={{
                  flex: 1,
                  padding: "12px 24px",
                  backgroundColor: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600"
                }}
              >
                Open Job
              </button>
              <button
                onClick={() => setSelectedJob(null)}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#f5f5f5",
                  color: "#666",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// ✅ Helper function to calculate hours worked
function calculateHoursWorked(clockInTime) {
  if (!clockInTime) return "0.0";
  const now = new Date();
  const clockIn = new Date(clockInTime);
  const hours = (now - clockIn) / (1000 * 60 * 60);
  return hours.toFixed(1);
}