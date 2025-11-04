// file location: src/pages/job-cards/myjobs/index.js
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { useUser } from "../../../context/UserContext";
import { usersByRole } from "../../../config/users";
import { getAllJobs } from "../../../lib/database/jobs";
import { getClockingStatus } from "../../../lib/database/clocking";
import JobCardModal from "../../../components/JobCards/JobCardModal"; // Import Start Job modal

const STATUS_BADGE_STYLES = {
  "In Progress": { background: "#dbeafe", color: "#1e40af" },
  Started: { background: "#dbeafe", color: "#1e40af" },
  Pending: { background: "#fef3c7", color: "#92400e" },
  Waiting: { background: "#fef3c7", color: "#92400e" },
  Open: { background: "#fef3c7", color: "#92400e" },
  Complete: { background: "#dcfce7", color: "#166534" },
  Completed: { background: "#dcfce7", color: "#166534" },
};

const getStatusBadgeStyle = (status) =>
  STATUS_BADGE_STYLES[status] || { background: "#f3f4f6", color: "#4b5563" };

const getMakeModel = (job) => {
  if (!job) return "N/A";
  if (job.makeModel) return job.makeModel;
  const combined = [job.make, job.model].filter(Boolean).join(" ");
  return combined || "N/A";
};

const formatCreatedAt = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
};

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
  const [showStartJobModal, setShowStartJobModal] = useState(false); // Control Start Job modal visibility
  const [prefilledJobNumber, setPrefilledJobNumber] = useState(""); // Prefill job number in modal

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
        const assignedJobs = fetchedJobs.filter((job) => {
          const assignedNameRaw =
            job.assignedTech?.name ||
            job.technician ||
            (typeof job.assignedTo === "string" ? job.assignedTo : "");

          if (!assignedNameRaw || !username) return false;

          return assignedNameRaw.trim().toLowerCase() === username.trim().toLowerCase();
        });

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

  // ✅ Handle job click - open Start Job modal with job number prefilled
  const handleJobClick = (job) => {
    if (!job?.jobNumber) return;
    setPrefilledJobNumber(job.jobNumber); // Prefill the job number in the modal
    setShowStartJobModal(true); // Open the Start Job modal
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
          <h2 style={{ color: "#d10000", marginBottom: "10px", fontWeight: "700" }}>
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
            borderTop: "4px solid #d10000",
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "8px 16px",
          minHeight: "100vh"
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <h1 style={{
              color: "#d10000",
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
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#a60a0a"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#d10000"}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Clocking Status Banner */}
        {clockingStatus && (
          <div style={{
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "12px",
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 2px 6px rgba(16,185,129,0.12)"
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
          alignItems: "center",
          flexWrap: "wrap",
          padding: "12px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.08)"
        }}>
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search by job number, customer, reg, or vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: "220px",
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "14px",
              outline: "none",
              transition: "border-color 0.2s, box-shadow 0.2s"
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#d10000";
              e.target.style.boxShadow = "0 0 0 3px rgba(209,0,0,0.12)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#e5e7eb";
              e.target.style.boxShadow = "none";
            }}
          />

          {/* Filter Buttons */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
                  backgroundColor: filter === value ? "#d10000" : "#fff",
                  color: filter === value ? "#fff" : "#d10000",
                  border: "1px solid #d10000",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: filter === value ? "600" : "500",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (filter !== value) {
                    e.target.style.backgroundColor = "#ffe5e5";
                  }
                }}
                onMouseLeave={(e) => {
                  if (filter !== value) {
                    e.target.style.backgroundColor = "#fff";
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Jobs List */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRadius: "24px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            border: "1px solid #ffe5e5",
            background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
            padding: "24px",
            overflow: "hidden",
            minHeight: 0
          }}
        >
          {filteredJobs.length === 0 ? (
            <div style={{
              backgroundColor: "transparent",
              padding: "60px",
              borderRadius: "16px",
              boxShadow: "none",
              border: "1px dashed #ffc9c9",
              textAlign: "center",
              margin: "auto",
              maxWidth: "520px"
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
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                paddingRight: "8px",
                minHeight: 0
              }}
            >
              {filteredJobs.map((job) => {
                const statusLabel = job.status || "Pending";
                const statusStyle = getStatusBadgeStyle(statusLabel);
                const createdAt = formatCreatedAt(job.createdAt);
                const description = job.description?.trim();
                const makeModel = getMakeModel(job);

                return (
                  <div
                    key={job.id || job.jobNumber}
                    onClick={() => handleJobClick(job)}
                    style={{
                      border: "1px solid #ffe5e5",
                      padding: "16px 20px",
                      borderRadius: "12px",
                      backgroundColor: "white",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "16px"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 6px 18px rgba(209,0,0,0.16)";
                      e.currentTarget.style.borderColor = "#ffb3b3";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
                      e.currentTarget.style.borderColor = "#ffe5e5";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        width: "560px",
                        flexShrink: 0
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: statusStyle.background,
                          color: statusStyle.color,
                          padding: "8px 14px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: "600",
                          whiteSpace: "nowrap",
                          minWidth: "140px",
                          textAlign: "center"
                        }}
                      >
                        {statusLabel}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            flexWrap: "wrap"
                          }}
                        >
                          <span
                            style={{
                              fontSize: "18px",
                              fontWeight: "700",
                              color: "#1a1a1a"
                            }}
                          >
                            {job.jobNumber || "No Job #"}
                          </span>
                          <span
                            style={{
                              fontSize: "14px",
                              color: "#555",
                              fontWeight: "600"
                            }}
                          >
                            {job.reg || "No Reg"}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            flexWrap: "wrap"
                          }}
                        >
                          <span
                            style={{
                              fontSize: "13px",
                              color: "#666"
                            }}
                          >
                            {job.customer || "Unknown customer"}
                          </span>
                          {job.vhcRequired && (
                            <div
                              style={{
                                backgroundColor: "#fff5f5",
                                color: "#d10000",
                                padding: "4px 10px",
                                borderRadius: "999px",
                                fontSize: "11px",
                                fontWeight: "600"
                              }}
                            >
                              VHC Required
                            </div>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: "12px",
                            color: "#999"
                          }}
                        >
                          {makeModel}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "20px",
                        flex: 1,
                        justifyContent: "flex-end"
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "260px",
                          minWidth: "220px",
                          fontSize: "12px",
                          color: "#555",
                          lineHeight: "1.4"
                        }}
                      >
                        {description ? (
                          <span
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden"
                            }}
                          >
                            {description}
                          </span>
                        ) : (
                          <span style={{ color: "#ccc" }}>No notes added</span>
                        )}
                      </div>

                      <div
                        style={{
                          minWidth: "140px",
                          textAlign: "center",
                          fontSize: "12px",
                          color: "#555"
                        }}
                      >
                        {createdAt || "N/A"}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          minWidth: "190px",
                          justifyContent: "flex-end"
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!job.jobNumber) return;
                            router.push(`/vhc?job=${job.jobNumber}`);
                          }}
                          style={{
                            padding: "8px 14px",
                            backgroundColor: "#fff5f5",
                            color: "#d10000",
                            border: "1px solid #ffc9c9",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "600",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#ffe1e1";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#fff5f5";
                          }}
                        >
                          🔍 VHC
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!job.jobNumber) return;
                            router.push(`/job-cards/${job.jobNumber}/write-up`);
                          }}
                          style={{
                            padding: "8px 14px",
                            backgroundColor: "#f5f3ff",
                            color: "#5b21b6",
                            border: "1px solid #ddd6fe",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "600",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#ede9fe";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#f5f3ff";
                          }}
                        >
                          ✍️ Write-Up
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Job Count Summary */}
        <div style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "16px",
          boxShadow: "0 2px 6px rgba(209,0,0,0.08)",
          border: "1px solid #ffe5e5"
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "16px",
            textAlign: "center"
          }}>
            <div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "#d10000", marginBottom: "4px" }}>
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
              <div style={{ fontSize: "28px", fontWeight: "700", color: "#f97316", marginBottom: "4px" }}>
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
          background: "linear-gradient(90deg, #fff5f5, #ffe5e5)",
          border: "1px solid #ffc9c9",
          borderRadius: "12px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          boxShadow: "0 2px 6px rgba(209,0,0,0.08)"
        }}>
          <div style={{ fontSize: "24px" }}>💡</div>
          <div>
            <p style={{ fontSize: "14px", fontWeight: "600", color: "#b91c1c", margin: "0 0 4px 0" }}>
              Quick Tip
            </p>
            <p style={{ fontSize: "13px", color: "#7f1d1d", margin: 0 }}>
              Click any job row to open the Start Job popup and begin working instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Start Job Modal */}
      <JobCardModal 
        isOpen={showStartJobModal} 
        onClose={() => {
          setShowStartJobModal(false); // Close modal
          setPrefilledJobNumber(""); // Clear prefilled job number
        }}
        prefilledJobNumber={prefilledJobNumber} // Pass the prefilled job number to modal
      />
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
