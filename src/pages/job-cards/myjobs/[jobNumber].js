// file location: src/pages/job-cards/myjobs/[jobNumber].js
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { useUser } from "../../../context/UserContext";
import { usersByRole } from "../../../config/users";
import { getJobByNumber, updateJobStatus } from "../../../lib/database/jobs";
import { getVHCChecksByJob, createVHCCheck } from "../../../lib/database/vhc";
import { getClockingStatus } from "../../../lib/database/clocking";

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
        const { data: job, error } = await getJobByNumber(jobNumber);
        
        if (error || !job) {
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

      } catch (error) {
        console.error("❌ Error fetching job:", error);
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
        maxWidth: "1400px",
        margin: "0 auto"
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
            padding: "12px 24px",
            backgroundColor: 
              jobCard.status === "In Progress" ? "#dbeafe" :
              jobCard.status === "Complete" ? "#dcfce7" :
              "#fef3c7",
            color:
              jobCard.status === "In Progress" ? "#1e40af" :
              jobCard.status === "Complete" ? "#166534" :
              "#92400e",
            borderRadius: "24px",
            fontSize: "14px",
            fontWeight: "600"
          }}>
            {jobCard.status}
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "12px",
          marginBottom: "20px"
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            border: "1px solid #e0e0e0",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "24px", fontWeight: "700", color: "#0369a1", marginBottom: "4px" }}>
              {vhcChecks.length}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>VHC Checks</div>
          </div>

          <div style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            border: "1px solid #e0e0e0",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "24px", fontWeight: "700", color: "#92400e", marginBottom: "4px" }}>
              0
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>Parts Requests</div>
          </div>

          <div style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            border: "1px solid #e0e0e0",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "24px", fontWeight: "700", color: "#166534", marginBottom: "4px" }}>
              0
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>Notes</div>
          </div>

          <div style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            border: "1px solid #e0e0e0",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "24px", fontWeight: "700", color: "#7c3aed", marginBottom: "4px" }}>
              {clockingStatus ? calculateHoursWorked(clockingStatus.clock_in) : "0.0"}h
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>Time Logged</div>
          </div>

          <div style={{
            backgroundColor: jobCard.vhcRequired ? "#fef2f2" : "#f0fdf4",
            padding: "16px",
            borderRadius: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            border: `1px solid ${jobCard.vhcRequired ? "#fecaca" : "#86efac"}`,
            textAlign: "center"
          }}>
            <div style={{ 
              fontSize: "18px", 
              fontWeight: "600", 
              color: jobCard.vhcRequired ? "#991b1b" : "#166534",
              marginBottom: "4px"
            }}>
              {jobCard.vhcRequired ? "Required" : "Not Required"}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>VHC Status</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
          borderBottom: "2px solid #e0e0e0"
        }}>
          {["overview", "vhc", "parts", "notes", "write-up"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "12px 20px",
                backgroundColor: activeTab === tab ? "#FF4040" : "transparent",
                color: activeTab === tab ? "white" : "#666",
                border: "none",
                borderBottom: activeTab === tab ? "3px solid #FF4040" : "3px solid transparent",
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
                borderRadius: "12px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                border: "1px solid #e0e0e0"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
                  Job Details
                </h3>
                {jobCard.requests && jobCard.requests.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <strong style={{ fontSize: "14px", color: "#666" }}>Customer Requests:</strong>
                    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {jobCard.requests.map((req, i) => (
                        <div key={i} style={{
                          padding: "12px",
                          backgroundColor: "#f9f9f9",
                          borderLeft: "4px solid #FF4040",
                          borderRadius: "6px"
                        }}>
                          {req.text || req}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {jobCard.cosmeticNotes && (
                  <div>
                    <strong style={{ fontSize: "14px", color: "#666" }}>Cosmetic Notes:</strong>
                    <p style={{ marginTop: "8px", color: "#333" }}>{jobCard.cosmeticNotes}</p>
                  </div>
                )}
              </div>

              {/* Vehicle Info */}
              <div style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "12px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                border: "1px solid #e0e0e0"
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
                borderRadius: "12px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                border: "1px solid #e0e0e0"
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
              borderRadius: "12px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              border: "1px solid #e0e0e0"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>
                  Vehicle Health Checks ({vhcChecks.length})
                </h3>
                <button
                  onClick={() => router.push(`/vhc?job=${jobNumber}`)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#FF4040",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}
                >
                  + Add VHC Check
                </button>
              </div>

              {vhcChecks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
                  <p>No VHC checks added yet</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {vhcChecks.map(check => (
                    <div key={check.vhc_id} style={{
                      padding: "16px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      backgroundColor: "#fafafa"
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
                            padding: "4px 10px",
                            backgroundColor: "#e0e0e0",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: "600"
                          }}>
                            {check.section}
                          </span>
                        </div>
                        {check.measurement && (
                          <div style={{
                            padding: "8px 16px",
                            backgroundColor: "#dcfce7",
                            color: "#166534",
                            borderRadius: "8px",
                            fontSize: "16px",
                            fontWeight: "700"
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
              borderRadius: "12px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              border: "1px solid #e0e0e0"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>
                  Parts Requests
                </h3>
                <button
                  onClick={() => alert("Parts request feature coming soon")}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#FF4040",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}
                >
                  + Request Parts
                </button>
              </div>
              <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔧</div>
                <p>No parts requested yet</p>
              </div>
            </div>
          )}

          {/* NOTES TAB */}
          {activeTab === "notes" && (
            <div style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "12px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              border: "1px solid #e0e0e0"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>
                  Job Notes
                </h3>
                <button
                  onClick={() => setShowAddNote(true)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#FF4040",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
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
                  padding: "16px",
                  backgroundColor: "#f9f9f9",
                  borderRadius: "8px",
                  marginBottom: "20px"
                }}>
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Enter your note here..."
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "6px",
                      resize: "vertical",
                      minHeight: "100px",
                      fontSize: "14px",
                      marginBottom: "12px"
                    }}
                  />
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setShowAddNote(false)}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#f5f5f5",
                        color: "#666",
                        border: "1px solid #e0e0e0",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "14px"
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddNote}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "600"
                      }}
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              )}

              <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📝</div>
                <p>No notes added yet</p>
              </div>
            </div>
          )}

          {/* WRITE-UP TAB */}
          {activeTab === "write-up" && (
            <div style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "12px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              border: "1px solid #e0e0e0",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "20px" }}>📄</div>
              <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "12px" }}>
                Job Write-Up
              </h3>
              <p style={{ color: "#666", marginBottom: "24px" }}>
                Complete the job write-up form to document all work performed
              </p>
              <button
                onClick={() => router.push(`/job-cards/${jobNumber}/write-up`)}
                style={{
                  padding: "14px 28px",
                  backgroundColor: "#FF4040",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: "600"
                }}
              >
                Open Write-Up Form →
              </button>
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginTop: "20px",
          paddingTop: "20px",
          borderTop: "2px solid #e0e0e0"
        }}>
          <button
            onClick={() => handleUpdateStatus("In Progress")}
            style={{
              padding: "14px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            🔄 Mark In Progress
          </button>

          <button
            onClick={() => router.push(`/vhc?job=${jobNumber}`)}
            style={{
              padding: "14px",
              backgroundColor: "#0369a1",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            🔍 Add VHC
          </button>

          <button
            onClick={() => router.push(`/job-cards/${jobNumber}/write-up`)}
            style={{
              padding: "14px",
              backgroundColor: "#166534",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            ✍️ Write-Up
          </button>

          <button
            onClick={() => handleUpdateStatus("Complete")}
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