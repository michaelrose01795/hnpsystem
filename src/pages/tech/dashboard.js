// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/tech/dashboard.js
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";
import { getAllJobs } from "@/lib/database/jobs";
import { getClockingStatus, clockIn, clockOut } from "@/lib/database/clocking";

export default function TechsDashboard() {
  const router = useRouter();
  const { user } = useUser();
  const { usersByRole, isLoading: rosterLoading } = useRoster();
  const [jobs, setJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [nextJob, setNextJob] = useState(null);
  const [currentJob, setCurrentJob] = useState(null);
  const [clockingStatus, setClockingStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const username = user?.username;
  const techsList = usersByRole?.["Techs"] || [];
  const motList = usersByRole?.["MOT Tester"] || [];
  // ⚠️ Mock data found — replacing with Supabase query
  // ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)
  const allowedNames = new Set([...techsList, ...motList]);
  const hasTechRole =
    user?.roles?.some((role) => role?.toLowerCase().includes("tech")) || false;
  const isTech = allowedNames.has(username) || hasTechRole;

  // ✅ Fetch jobs and clocking status
  useEffect(() => {
    if (!isTech || !username) return;

    const fetchData = async () => {
      setLoading(true);

      try {
        // Fetch all jobs
        const fetchedJobs = await getAllJobs();
        setJobs(fetchedJobs);

        // Filter jobs assigned to this tech
        const assignedJobs = fetchedJobs.filter(
          (job) => job.assignedTech?.name === username || job.technician === username
        );

        // Sort by priority/created date
        const sortedJobs = assignedJobs.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          }
          return 0;
        });

        setMyJobs(sortedJobs);
        setNextJob(sortedJobs.length > 0 ? sortedJobs[0] : null);

        // Get clocking status
        const { isClockedIn, data } = await getClockingStatus(username);
        setClockingStatus(data);

        // If clocked in, find the job they're working on
        if (isClockedIn && data) {
          // TODO: Link clocking record to job
          // For now, assume they're working on the first assigned job
          setCurrentJob(sortedJobs[0] || null);
        }

      } catch (error) {
        console.error("❌ Error fetching tech data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [username, isTech]);

  // ✅ Handle clock in
  const handleClockIn = async () => {
    if (!username) return;

    const result = await clockIn(username);
    
    if (result.success) {
      alert("✅ Clocked in successfully!");
      setClockingStatus(result.data);
    } else {
      alert(`❌ ${result.error?.message || "Failed to clock in"}`);
    }
  };

  // ✅ Handle clock out
  const handleClockOut = async () => {
    if (!username) return;

    const confirmed = confirm("Are you sure you want to clock out?");
    if (!confirmed) return;

    const result = await clockOut(username);
    
    if (result.success) {
      alert("✅ Clocked out successfully!");
      setClockingStatus(null);
      setCurrentJob(null);
    } else {
      alert(`❌ ${result.error?.message || "Failed to clock out"}`);
    }
  };

  // ✅ Handle start job
  const handleStartJob = (job) => {
    router.push(`/job-cards/myjobs/${job.jobNumber}`);
  };

  // ✅ Access check
  if (rosterLoading) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center", color: "#6B7280" }}>
          Loading roster…
        </div>
      </Layout>
    );
  }

  if (!isTech) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: "60px", marginBottom: "20px" }}>⚠️</div>
          <h2 style={{ color: "#FF4040", marginBottom: "10px" }}>Access Denied</h2>
          <p style={{ color: "#666" }}>This page is only for Technicians.</p>
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
          <p style={{ color: "#666", fontSize: "16px" }}>Loading dashboard...</p>
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
        gap: "24px"
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
              Welcome back, {username}
            </h1>
            <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
              {new Date().toLocaleDateString("en-GB", { 
                weekday: "long", 
                year: "numeric", 
                month: "long", 
                day: "numeric" 
              })}
            </p>
          </div>

          {/* Clock In/Out Button */}
          <button
            onClick={clockingStatus ? handleClockOut : handleClockIn}
            style={{
              padding: "14px 28px",
              backgroundColor: clockingStatus ? "#ef4444" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "600",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 6px 12px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
            }}
          >
            {clockingStatus ? "⏱️ Clock Out" : "⏱️ Clock In"}
          </button>
        </div>

        {/* Status Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px"
        }}>
          {/* Jobs Assigned */}
          <div style={{
            backgroundColor: "white",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e0e0e0"
          }}>
            <div style={{ fontSize: "36px", fontWeight: "700", color: "#0369a1", marginBottom: "8px" }}>
              {myJobs.length}
            </div>
            <div style={{ fontSize: "14px", color: "#666", fontWeight: "500" }}>
              Jobs Assigned
            </div>
          </div>

          {/* Clocking Status */}
          <div style={{
            backgroundColor: clockingStatus ? "#dcfce7" : "#fef2f2",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: `1px solid ${clockingStatus ? "#86efac" : "#fecaca"}`
          }}>
            <div style={{ 
              fontSize: "16px", 
              fontWeight: "600", 
              color: clockingStatus ? "#166534" : "#991b1b",
              marginBottom: "8px" 
            }}>
              {clockingStatus ? "Clocked In" : "Clocked Out"}
            </div>
            <div style={{ fontSize: "13px", color: "#666" }}>
              {clockingStatus 
                ? `Since ${new Date(clockingStatus.clock_in).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                : "Not currently working"
              }
            </div>
          </div>

          {/* Current Job */}
          <div style={{
            backgroundColor: "white",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e0e0e0"
          }}>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "#333", marginBottom: "8px" }}>
              Current Job
            </div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "#FF4040" }}>
              {currentJob ? currentJob.jobNumber : "None"}
            </div>
          </div>

          {/* Hours Today */}
          <div style={{
            backgroundColor: "white",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e0e0e0"
          }}>
            <div style={{ fontSize: "36px", fontWeight: "700", color: "#7c3aed", marginBottom: "8px" }}>
              {clockingStatus ? calculateHoursWorked(clockingStatus.clock_in) : "0.0"}h
            </div>
            <div style={{ fontSize: "14px", color: "#666", fontWeight: "500" }}>
              Hours Today
            </div>
          </div>
        </div>

        {/* Current Job Section */}
        {currentJob && (
          <div style={{
            backgroundColor: "white",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "2px solid #FF4040"
          }}>
            <h2 style={{ 
              fontSize: "20px", 
              fontWeight: "700", 
              color: "#FF4040",
              marginBottom: "16px"
            }}>
              🔧 Currently Working On
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: "24px",
              alignItems: "center"
            }}>
              <div>
                <p style={{ fontSize: "24px", fontWeight: "700", color: "#1a1a1a", margin: "0 0 8px 0" }}>
                  {currentJob.jobNumber}
                </p>
                <p style={{ fontSize: "16px", color: "#666", margin: "0 0 4px 0" }}>
                  <strong>Customer:</strong> {currentJob.customer}
                </p>
                <p style={{ fontSize: "16px", color: "#666", margin: "0 0 4px 0" }}>
                  <strong>Vehicle:</strong> {currentJob.reg} - {currentJob.makeModel}
                </p>
                <p style={{ fontSize: "14px", color: "#999", margin: "8px 0 0 0" }}>
                  {currentJob.description}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <button
                  onClick={() => handleStartJob(currentJob)}
                  style={{
                    padding: "14px 28px",
                    backgroundColor: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "15px",
                    fontWeight: "600",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "#059669"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "#10b981"}
                >
                  Continue Job →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Next Job Section */}
        {nextJob && !currentJob && (
          <div style={{
            backgroundColor: "white",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e0e0e0"
          }}>
            <h2 style={{ 
              fontSize: "20px", 
              fontWeight: "700", 
              color: "#333",
              marginBottom: "16px"
            }}>
              📋 Next Job Assigned
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: "24px",
              alignItems: "center"
            }}>
              <div>
                <p style={{ fontSize: "24px", fontWeight: "700", color: "#FF4040", margin: "0 0 8px 0" }}>
                  {nextJob.jobNumber}
                </p>
                <p style={{ fontSize: "16px", color: "#666", margin: "0 0 4px 0" }}>
                  <strong>Customer:</strong> {nextJob.customer}
                </p>
                <p style={{ fontSize: "16px", color: "#666", margin: "0 0 4px 0" }}>
                  <strong>Vehicle:</strong> {nextJob.reg} - {nextJob.makeModel}
                </p>
                <p style={{ fontSize: "14px", color: "#999", margin: "8px 0 0 0" }}>
                  {nextJob.description}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <button
                  onClick={() => handleStartJob(nextJob)}
                  style={{
                    padding: "14px 28px",
                    backgroundColor: "#FF4040",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "15px",
                    fontWeight: "600",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "#cc0000"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "#FF4040"}
                >
                  Start Job →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* All Jobs List */}
        <div style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "16px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #e0e0e0"
        }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: "20px"
          }}>
            <h2 style={{ 
              fontSize: "20px", 
              fontWeight: "700", 
              color: "#333",
              margin: 0
            }}>
              📝 My Assigned Jobs ({myJobs.length})
            </h2>
            <button
              onClick={() => router.push("/job-cards/myjobs")}
              style={{
                padding: "8px 16px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600"
              }}
            >
              View All →
            </button>
          </div>

          {myJobs.length === 0 ? (
            <div style={{ 
              textAlign: "center", 
              padding: "40px",
              color: "#999"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
              <p style={{ fontSize: "16px" }}>No jobs assigned yet</p>
            </div>
          ) : (
            <div style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: "12px" 
            }}>
              {myJobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  onClick={() => handleStartJob(job)}
                  style={{
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    padding: "16px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    backgroundColor: "#fafafa"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f0f0f0";
                    e.currentTarget.style.borderColor = "#FF4040";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#fafafa";
                    e.currentTarget.style.borderColor = "#e0e0e0";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ 
                        fontSize: "16px", 
                        fontWeight: "700", 
                        color: "#FF4040",
                        margin: "0 0 4px 0"
                      }}>
                        {job.jobNumber}
                      </p>
                      <p style={{ fontSize: "14px", color: "#666", margin: "0 0 4px 0" }}>
                        {job.customer} | {job.reg}
                      </p>
                      <p style={{ fontSize: "13px", color: "#999", margin: 0 }}>
                        {job.makeModel}
                      </p>
                    </div>
                    <div style={{
                      padding: "6px 12px",
                      backgroundColor: 
                        job.status === "In Progress" ? "#dbeafe" :
                        job.status === "Complete" ? "#dcfce7" :
                        "#fef3c7",
                      color:
                        job.status === "In Progress" ? "#1e40af" :
                        job.status === "Complete" ? "#166534" :
                        "#92400e",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}>
                      {job.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px"
        }}>
          <button
            onClick={() => router.push("/job-cards/myjobs")}
            style={{
              padding: "20px",
              backgroundColor: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "12px",
              cursor: "pointer",
              textAlign: "center",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📋</div>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "#333" }}>
              View All Jobs
            </div>
          </button>

          <button
            onClick={() => router.push("/clocking")}
            style={{
              padding: "20px",
              backgroundColor: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "12px",
              cursor: "pointer",
              textAlign: "center",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>⏱️</div>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "#333" }}>
              Time Tracking
            </div>
          </button>

          <button
            onClick={() => router.push("/parts")}
            style={{
              padding: "20px",
              backgroundColor: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "12px",
              cursor: "pointer",
              textAlign: "center",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔧</div>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "#333" }}>
              Request Parts
            </div>
          </button>
        </div>
      </div>
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
