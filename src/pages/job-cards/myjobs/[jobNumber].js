// file location: src/pages/job-cards/myjobs/[jobNumber].js
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { useUser } from "../../../context/UserContext";
import { usersByRole } from "../../../config/users";
import { getJobByNumber, updateJobStatus } from "../../../lib/database/jobs";
import { getVHCChecksByJob } from "../../../lib/database/vhc";
import { getClockingStatus } from "../../../lib/database/clocking";

const STATUS_COLORS = {
  "Outstanding": "#9ca3af",
  "Accepted": "#d10000",
  "In Progress": "#3b82f6",
  "Awaiting Authorization": "#fbbf24",
  "Authorized": "#9333ea",
  "Ready": "#10b981",
  "Carry Over": "#f97316",
  "Complete": "#06b6d4",
  "Sent": "#8b5cf6",
  "Viewed": "#06b6d4",
};

const formatDateTime = (date) => {
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "N/A";
  }
};

export default function TechJobDetailPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const { user } = useUser();

  const [jobData, setJobData] = useState(null);
  const [vhcChecks, setVhcChecks] = useState([]);
  const [clockingStatus, setClockingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [showAdditionalContents, setShowAdditionalContents] = useState(false); // ✅ NEW: Control Additional Contents popup

  const username = user?.username;
  const techsList = usersByRole["Techs"] || [];
  const isTech = techsList.includes(username);

  // ✅ Fetch job data
  useEffect(() => {
    if (!jobNumber) return;

    const fetchData = async () => {
      setLoading(true);

      try {
        // Fetch job
        const { data: job, error: jobError } = await getJobByNumber(jobNumber);

        if (jobError || !job) {
          alert("Job not found");
          router.push("/job-cards/myjobs");
          return;
        }

        setJobData(job);

        // Fetch VHC checks
        const checks = await getVHCChecksByJob(job.id);
        setVhcChecks(checks);

        // Get clocking status
        if (username) {
          const { data: clockData } = await getClockingStatus(username);
          setClockingStatus(clockData);
        }

      } catch (fetchError) {
        console.error("❌ Error fetching job:", fetchError);
        alert("Failed to load job");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jobNumber, username, router]);

  // ✅ Handle status update
  const handleUpdateStatus = async (newStatus) => {
    if (!jobData) return;

    const confirmed = confirm(`Update job status to "${newStatus}"?`);
    if (!confirmed) return;

    const result = await updateJobStatus(jobData.id, newStatus);
    
    if (result) {
      alert("✅ Status updated successfully!");
      setJobData({ ...jobData, status: newStatus });
    } else {
      alert("❌ Failed to update status");
    }
  };

  // ✅ Handle add note
  const handleAddNote = async () => {
    if (!newNote.trim()) {
      alert("Please enter a note");
      return;
    }

    // TODO: Implement notes system
    alert("Note saved: " + newNote);
    setNewNote("");
    setShowAddNote(false);
  };

  // ✅ Access check
  if (!isTech) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2 style={{ color: "#FF4040" }}>Access Denied</h2>
          <p>This page is only for Technicians.</p>
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
          <p style={{ color: "#666" }}>Loading job...</p>
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

  if (!jobData) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2 style={{ color: "#FF4040" }}>Job Not Found</h2>
          <button
            onClick={() => router.push("/job-cards/myjobs")}
            style={{
              padding: "12px 24px",
              backgroundColor: "#FF4040",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              marginTop: "20px"
            }}
          >
            Back to My Jobs
          </button>
        </div>
      </Layout>
    );
  }

  const { jobCard, customer, vehicle } = jobData;

  return (
    <Layout>
      <div style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "16px",
        gap: "16px",
        maxWidth: "1400px",
        margin: "0 auto",
        backgroundColor: "#f9fafb"
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              onClick={() => router.push("/job-cards/myjobs")}
              style={{
                padding: "10px 20px",
                backgroundColor: "#fff",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600"
              }}
            >
              ← Back
            </button>
            <div>
              <h1 style={{ 
                color: "#FF4040", 
                fontSize: "28px", 
                fontWeight: "700",
                margin: "0 0 4px 0"
              }}>
                Job #{jobCard.jobNumber}
              </h1>
              <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
                {customer.firstName} {customer.lastName} | {vehicle.reg}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            backgroundColor: "white",
            border: "1px solid #ffe5e5",
            borderRadius: "12px",
            padding: "10px 18px",
            boxShadow: "0 4px 12px rgba(209,0,0,0.08)",
            color: "white",
            fontWeight: "600"
          }}>
            <span style={{
              backgroundColor: jobStatusColor,
              padding: "6px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              letterSpacing: "0.02em",
              color: "white"
            }}>
              {jobCard.status}
            </span>
            <span style={{ fontSize: "12px", color: "#6b7280" }}>
              Updated {formatDateTime(jobCard.updatedAt)}
            </span>
          </div>
        </div>

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 24px",
          borderRadius: "16px",
          backgroundColor: "white",
          border: "1px solid #ffe5e5",
          boxShadow: "0 4px 12px rgba(209,0,0,0.1)",
          gap: "24px"
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "#d10000", fontWeight: "600", letterSpacing: "0.06em" }}>
              JOB SUMMARY
            </span>
            <h1 style={{
              color: "#1f2937",
              fontSize: "28px",
              fontWeight: "700",
              margin: 0
            }}>
              #{jobCard.jobNumber} • {vehicle.reg}
            </h1>
            <span style={{ fontSize: "15px", color: "#6b7280" }}>
              {customer.firstName} {customer.lastName} • {vehicle.makeModel}
            </span>
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            borderLeft: "1px solid #ffe5e5",
            paddingLeft: "20px"
          }}>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600" }}>Booked</span>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#1f2937" }}>
                {formatDateTime(jobCard.createdAt)}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600" }}>Advisor</span>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#1f2937" }}>
                {jobCard.serviceAdvisor || "TBC"}
              </div>
            </div>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: "12px"
        }}>
          {quickStats.map((stat) => (
            <div
              key={stat.label}
              style={{
                backgroundColor: "white",
                border: "1px solid #ffe5e5",
                borderRadius: "12px",
                boxShadow: "0 2px 6px rgba(209,0,0,0.06)",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "108px"
              }}
            >
              <div style={{
                fontSize: stat.pill ? "15px" : "24px",
                fontWeight: "700",
                color: stat.accent,
                backgroundColor: stat.pill ? `${stat.accent}15` : "transparent",
                padding: stat.pill ? "6px 14px" : 0,
                borderRadius: stat.pill ? "999px" : 0,
                letterSpacing: stat.pill ? "0.04em" : 0,
                textTransform: stat.pill ? "uppercase" : "none"
              }}>
                {stat.value}
              </div>
              <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          gap: "12px",
          marginTop: "8px",
          marginBottom: "12px",
          borderBottom: "2px solid #ffd6d6",
          paddingBottom: "6px"
        }}>
          {["overview", "vhc", "parts", "notes", "write-up"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 18px",
                backgroundColor: activeTab === tab ? "#d10000" : "white",
                color: activeTab === tab ? "white" : "#d10000",
                border: activeTab === tab ? "2px solid #d10000" : "1px solid #ffd6d6",
                borderBottom: activeTab === tab ? "2px solid #d10000" : "1px solid #ffd6d6",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: activeTab === tab ? "600" : "500",
                textTransform: "capitalize",
                transition: "all 0.2s"
              }}
            >
              {tab.replace("-", " ")}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Job Details */}
              <div style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "16px",
                boxShadow: "0 6px 18px rgba(209,0,0,0.08)",
                border: "1px solid #ffe5e5",
                backgroundImage: "linear-gradient(135deg, rgba(255,245,245,0.6), white)"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
                  Job Details
                </h3>
                {jobCard.requests && jobCard.requests.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <strong style={{ fontSize: "14px", color: "#6b7280", letterSpacing: "0.04em" }}>Customer Requests:</strong>
                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      {jobCard.requests.map((req, i) => (
                        <div key={i} style={{
                          padding: "14px 16px",
                          backgroundColor: "#fff5f5",
                          borderLeft: "4px solid #d10000",
                          borderRadius: "10px",
                          color: "#1f2937",
                          boxShadow: "0 4px 10px rgba(209,0,0,0.08)"
                        }}>
                          {req.text || req}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {jobCard.cosmeticNotes && (
                  <div>
                    <strong style={{ fontSize: "14px", color: "#6b7280", letterSpacing: "0.04em" }}>Cosmetic Notes:</strong>
                    <p style={{ marginTop: "10px", color: "#374151", lineHeight: 1.6 }}>{jobCard.cosmeticNotes}</p>
                  </div>
                )}
              </div>

              {/* Vehicle Info */}
              <div style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "16px",
                boxShadow: "0 6px 18px rgba(209,0,0,0.08)",
                border: "1px solid #ffe5e5"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
                  Vehicle Information
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                  <div>
                    <span style={{ fontSize: "13px", color: "#666" }}>Registration:</span>
                    <p style={{ fontSize: "16px", fontWeight: "600", color: "#FF4040", margin: "4px 0 0 0" }}>
                      {vehicle.reg}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: "13px", color: "#666" }}>Make & Model:</span>
                    <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                      {vehicle.makeModel}
                    </p>
                  </div>
                  {vehicle.mileage && (
                    <div>
                      <span style={{ fontSize: "13px", color: "#666" }}>Mileage:</span>
                      <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                        {vehicle.mileage.toLocaleString()} miles
                      </p>
                    </div>
                  )}
                  {vehicle.colour && (
                    <div>
                      <span style={{ fontSize: "13px", color: "#666" }}>Colour:</span>
                      <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                        {vehicle.colour}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Info */}
              <div style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "16px",
                boxShadow: "0 6px 18px rgba(209,0,0,0.08)",
                border: "1px solid #ffe5e5"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
                  Customer Information
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                  <div>
                    <span style={{ fontSize: "13px", color: "#666" }}>Name:</span>
                    <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                      {customer.firstName} {customer.lastName}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: "13px", color: "#666" }}>Mobile:</span>
                    <p style={{ fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>
                      {customer.mobile}
                    </p>
                  </div>
                  {customer.email && (
                    <div>
                      <span style={{ fontSize: "13px", color: "#666" }}>Email:</span>
                      <p style={{ fontSize: "16px", fontWeight: "600", color: "#007bff", margin: "4px 0 0 0" }}>
                        {customer.email}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VHC TAB */}
          {activeTab === "vhc" && (
            <div style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "16px",
              boxShadow: "0 6px 18px rgba(209,0,0,0.08)",
              border: "1px solid #ffe5e5",
              display: "flex",
              flexDirection: "column",
              gap: "20px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>
                  Vehicle Health Checks ({vhcChecks.length})
                </h3>
                <button
                  onClick={() => router.push(`/job-cards/${jobNumber}/vhc`)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#d10000",
                    color: "white",
                    border: "1px solid #b91c1c",
                    borderRadius: "10px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}
                >
                  + Add VHC Check
                </button>
              </div>

              {vhcChecks.length === 0 ? (
                <div style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#9ca3af",
                  backgroundColor: "#fff5f5",
                  borderRadius: "12px",
                  border: "1px solid #ffd6d6"
                }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
                  <p style={{ fontSize: "16px", fontWeight: "600" }}>No VHC checks added yet</p>
                  <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                    Start a new check to capture the vehicle condition.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {vhcChecks.map(check => (
                    <div key={check.vhc_id} style={{
                      padding: "16px",
                      border: "1px solid #ffd6d6",
                      borderRadius: "12px",
                      backgroundColor: "#fff",
                      boxShadow: "0 4px 12px rgba(209,0,0,0.08)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                        <div>
                          <p style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 8px 0" }}>
                            {check.issue_title}
                          </p>
                          <p style={{ fontSize: "14px", color: "#666", margin: "0 0 8px 0" }}>
                            {check.issue_description}
                          </p>
                          <span style={{
                            padding: "4px 12px",
                            backgroundColor: "#fff5f5",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#d10000",
                            border: "1px solid #ffd6d6",
                            letterSpacing: "0.04em"
                          }}>
                            {check.section}
                          </span>
                        </div>
                        {check.measurement && (
                          <div style={{
                            padding: "10px 18px",
                            backgroundColor: "#fef2f2",
                            color: "#b91c1c",
                            borderRadius: "10px",
                            fontSize: "16px",
                            fontWeight: "700",
                            border: "1px solid #fca5a5"
                          }}>
                            £{parseFloat(check.measurement).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PARTS TAB */}
          {activeTab === "parts" && (
            <div style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "16px",
              boxShadow: "0 6px 18px rgba(209,0,0,0.08)",
              border: "1px solid #ffe5e5",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              alignItems: "center"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "8px" }}>⚙️</div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>
                Parts Requests
              </h3>
              <p style={{ color: "#6b7280", margin: 0 }}>
                Track, raise and monitor parts needed to complete the job.
              </p>
              <button
                onClick={() => alert("Parts request feature coming soon")}
                style={{
                  padding: "12px 26px",
                  backgroundColor: "#d10000",
                  color: "white",
                  border: "1px solid #b91c1c",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: "600",
                  boxShadow: "0 10px 20px rgba(209,0,0,0.18)"
                }}
              >
                + Request Parts
              </button>
              <div style={{
                width: "100%",
                padding: "24px",
                backgroundColor: "#fff5f5",
                borderRadius: "12px",
                border: "1px solid #ffd6d6",
                color: "#9ca3af"
              }}>
                <p style={{ margin: 0 }}>No parts requested yet</p>
              </div>
            </div>
          )}

          {/* NOTES TAB */}
          {activeTab === "notes" && (
            <div style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "16px",
              boxShadow: "0 6px 18px rgba(209,0,0,0.08)",
              border: "1px solid #ffe5e5",
              display: "flex",
              flexDirection: "column",
              gap: "20px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>
                  Technician Notes
                </h3>
                <button
                  onClick={() => setShowAddNote(true)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#d10000",
                    color: "white",
                    border: "1px solid #b91c1c",
                    borderRadius: "10px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}
                >
                  + Add Note
                </button>
              </div>

              {showAddNote && (
                <div style={{
                  padding: "20px",
                  backgroundColor: "#fff5f5",
                  borderRadius: "12px",
                  border: "1px solid #ffd6d6"
                }}>
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note about the job..."
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      border: "1px solid #fca5a5",
                      borderRadius: "10px",
                      resize: "vertical",
                      minHeight: "110px",
                      fontSize: "14px",
                      marginBottom: "12px",
                      backgroundColor: "white"
                    }}
                  />
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setShowAddNote(false)}
                      style={{
                        padding: "10px 18px",
                        backgroundColor: "white",
                        color: "#6b7280",
                        border: "1px solid #d1d5db",
                        borderRadius: "10px",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "500"
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddNote}
                      style={{
                        padding: "10px 18px",
                        backgroundColor: "#10b981",
                        color: "white",
                        border: "1px solid #0f766e",
                        borderRadius: "10px",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "600",
                        boxShadow: "0 8px 14px rgba(16,185,129,0.2)"
                      }}
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              )}

              <div style={{
                textAlign: "center",
                padding: "40px",
                color: "#9ca3af",
                backgroundColor: "#fff5f5",
                borderRadius: "12px",
                border: "1px solid #ffd6d6"
              }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📝</div>
                <p style={{ fontSize: "16px", fontWeight: "600", marginBottom: "4px" }}>No notes added yet</p>
                <p style={{ fontSize: "14px", color: "#6b7280" }}>
                  Keep technicians aligned by logging progress, issues and next steps.
                </p>
              </div>
            </div>
          )}

          {/* WRITE-UP TAB */}
          {activeTab === "write-up" && (
            <div style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "16px",
              boxShadow: "0 6px 18px rgba(209,0,0,0.08)",
              border: "1px solid #ffe5e5",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              alignItems: "center"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "8px" }}>📄</div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>
                Job Write-Up
              </h3>
              <p style={{ color: "#6b7280", margin: 0, maxWidth: "520px" }}>
                Complete the job write-up form to document all work performed and capture handover notes for the service advisor.
              </p>
              <button
                onClick={() => router.push(`/job-cards/${jobNumber}/write-up`)}
                style={{
                  padding: "14px 28px",
                  backgroundColor: "#d10000",
                  color: "white",
                  border: "1px solid #b91c1c",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: "600",
                  boxShadow: "0 12px 24px rgba(209,0,0,0.18)"
                }}
              >
                Open Write-Up Form →
              </button>
            </div>
          )}
        </div>

        {/* Bottom Action Bar - ✅ UPDATED with new button layout */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginTop: "20px",
          paddingTop: "20px",
          borderTop: "2px solid #ffd6d6"
        }}>
          {/* Back to My Jobs Button */}
          <button
            onClick={() => router.push("/job-cards/myjobs")}
            style={{
              padding: "14px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 6px 12px rgba(59,130,246,0.18)"
            }}
          >
            ← Back to My Jobs
          </button>

          {/* VHC Button - Dynamic text based on status */}
          <button
            onClick={handleVhcClick}
            disabled={!jobCard.vhcRequired}
            style={{
              padding: "14px",
              backgroundColor: "#0369a1",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 6px 12px rgba(3,105,161,0.18)"
            }}
          >
            {getVhcButtonText()}
          </button>

          {/* Write-Up Button */}
          <button
            onClick={() => router.push(`/job-cards/${jobNumber}/write-up`)}
            style={{
              padding: "14px",
              backgroundColor: "white",
              color: "#16a34a",
              border: "1px solid #86efac",
              borderRadius: "12px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 6px 12px rgba(22,163,74,0.18)"
            }}
          >
            ✍️ Write-Up
          </button>

          {/* Additional Contents Button - Dynamic based on availability */}
          <button
            onClick={() => {
              if (hasAdditionalContents()) {
                setShowAdditionalContents(true);
              }
            }}
            disabled={!hasAdditionalContents()}
            style={{
              padding: "14px",
              backgroundColor: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            ✓ Complete Job
          </button>
        </div>
      </div>
    </Layout>
  );
}

// ✅ Helper function
function calculateHoursWorked(clockInTime) {
  if (!clockInTime) return "0.0";
  const now = new Date();
  const clockIn = new Date(clockInTime);
  const hours = (now - clockIn) / (1000 * 60 * 60);
  return hours.toFixed(1);
}