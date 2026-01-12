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
import { useConfirmation } from "@/context/ConfirmationContext";

export default function TechsDashboard() {
  const router = useRouter();
  const { user, dbUserId } = useUser();
  const { confirm } = useConfirmation();
  const { usersByRole, isLoading: rosterLoading } = useRoster();
  const [jobs, setJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [nextJob, setNextJob] = useState(null);
  const [currentJob, setCurrentJob] = useState(null);
  const [clockingStatus, setClockingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayDate, setDisplayDate] = useState("Loading date...");

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
  const isAssignedToTechnician = (job) => {
    if (!dbUserId || !job) return false;
    const assignedNumeric =
      typeof job.assignedTo === "number"
        ? job.assignedTo
        : typeof job.assignedTo === "string"
        ? Number(job.assignedTo)
        : null;

    if (assignedNumeric === dbUserId) return true;
    if (job.assignedTech?.id && job.assignedTech.id === dbUserId) return true;
    return false;
  };

  useEffect(() => {
    if (!isTech || !dbUserId) return;

    const fetchData = async () => {
      setLoading(true);

      try {
        // Fetch all jobs
        const fetchedJobs = await getAllJobs();
        setJobs(fetchedJobs);

        // Filter jobs assigned to this tech
        const assignedJobs = fetchedJobs.filter((job) => isAssignedToTechnician(job));

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
        const { isClockedIn, data } = await getClockingStatus(dbUserId);
        setClockingStatus(data);

        // If clocked in, find the job they're working on
        if (isClockedIn && data) {
          // TODO: Link clocking record to job
          // For now, assume they're working on the first assigned job
          setCurrentJob(sortedJobs[0] || null);
        }

      } catch (error) {
        console.error("Error fetching tech data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dbUserId, isTech]);

  // ✅ Handle clock in
  const handleClockIn = async () => {
    if (!dbUserId) return;

    const result = await clockIn(dbUserId);
    
    if (result.success) {
      alert("Clocked in successfully!");
      setClockingStatus(result.data);
    } else {
      alert(result.error?.message || "Failed to clock in");
    }
  };

  // ✅ Handle clock out
  const handleClockOut = async () => {
    if (!dbUserId) return;

    const confirmed = await confirm("Are you sure you want to clock out?");
    if (!confirmed) return;

    const result = await clockOut(dbUserId);
    
    if (result.success) {
      alert("Clocked out successfully!");
      setClockingStatus(null);
      setCurrentJob(null);
    } else {
      alert(result.error?.message || "Failed to clock out");
    }
  };

  // ✅ Handle start job
  const handleStartJob = (job) => {
    router.push(`/job-cards/myjobs/${job.jobNumber}`);
  };

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    setDisplayDate(formatter.format(new Date()));
  }, []);

  // ✅ Access check
  if (rosterLoading) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center", color: "var(--info)" }}>
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
          <h2 style={{ color: "var(--primary)", marginBottom: "10px" }}>Access Denied</h2>
          <p style={{ color: "var(--grey-accent)" }}>This page is only for Technicians.</p>
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
            border: "4px solid var(--surface)",
            borderTop: "4px solid var(--primary)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ color: "var(--grey-accent)", fontSize: "16px" }}>Loading dashboard...</p>
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
              color: "var(--primary)", 
              fontSize: "32px", 
              fontWeight: "700",
              margin: "0 0 8px 0"
            }}>
              Welcome back, {username}
            </h1>
            <p style={{ color: "var(--grey-accent)", fontSize: "14px", margin: 0 }}>
              {displayDate}
            </p>
          </div>

          {/* Clock In/Out Button */}
          <button
            onClick={clockingStatus ? handleClockOut : handleClockIn}
            style={{
              padding: "14px 28px",
              backgroundColor: clockingStatus ? "var(--danger)" : "var(--info)",
              color: "white",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "600",
              boxShadow: "none",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 6px 12px rgba(var(--shadow-rgb),0.15)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 4px 6px rgba(var(--shadow-rgb),0.1)";
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
            backgroundColor: "var(--surface)",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "none",
            border: "1px solid var(--surface-light)"
          }}>
            <div style={{ fontSize: "36px", fontWeight: "700", color: "var(--info-dark)", marginBottom: "8px" }}>
              {myJobs.length}
            </div>
            <div style={{ fontSize: "14px", color: "var(--grey-accent)", fontWeight: "500" }}>
              Jobs Assigned
            </div>
          </div>

          {/* Clocking Status */}
          <div style={{
            backgroundColor: clockingStatus ? "var(--success-surface)" : "var(--danger-surface)",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "none",
            border: `1px solid ${clockingStatus ? "var(--success)" : "var(--danger-surface)"}`
          }}>
            <div style={{ 
              fontSize: "16px", 
              fontWeight: "600", 
              color: clockingStatus ? "var(--success-dark)" : "var(--danger)",
              marginBottom: "8px" 
            }}>
              {clockingStatus ? "Clocked In" : "Clocked Out"}
            </div>
            <div style={{ fontSize: "13px", color: "var(--grey-accent)" }}>
              {clockingStatus 
                ? `Since ${new Date(clockingStatus.clock_in).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                : "Not currently working"
              }
            </div>
          </div>

          {/* Current Job */}
          <div style={{
            backgroundColor: "var(--surface)",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "none",
            border: "1px solid var(--surface-light)"
          }}>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "8px" }}>
              Current Job
            </div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--primary)" }}>
              {currentJob ? currentJob.jobNumber : "None"}
            </div>
          </div>

          {/* Hours Today */}
          <div style={{
            backgroundColor: "var(--surface)",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "none",
            border: "1px solid var(--surface-light)"
          }}>
            <div style={{ fontSize: "36px", fontWeight: "700", color: "var(--accent-purple)", marginBottom: "8px" }}>
              {clockingStatus ? calculateHoursWorked(clockingStatus.clock_in) : "0.0"}h
            </div>
            <div style={{ fontSize: "14px", color: "var(--grey-accent)", fontWeight: "500" }}>
              Hours Today
            </div>
          </div>
        </div>

        {/* Current Job Section */}
        {currentJob && (
          <div style={{
            backgroundColor: "var(--surface)",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "none",
            border: "2px solid var(--primary)"
          }}>
            <h2 style={{ 
              fontSize: "20px", 
              fontWeight: "700", 
              color: "var(--primary)",
              marginBottom: "16px"
            }}>
              Currently Working On
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: "24px",
              alignItems: "center"
            }}>
              <div>
                <p style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 8px 0" }}>
                  {currentJob.jobNumber}
                </p>
                <p style={{ fontSize: "16px", color: "var(--grey-accent)", margin: "0 0 4px 0" }}>
                  <strong>Customer:</strong> {currentJob.customer}
                </p>
                <p style={{ fontSize: "16px", color: "var(--grey-accent)", margin: "0 0 4px 0" }}>
                  <strong>Vehicle:</strong> {currentJob.reg} - {currentJob.makeModel}
                </p>
                <p style={{ fontSize: "14px", color: "var(--grey-accent-light)", margin: "8px 0 0 0" }}>
                  {currentJob.description}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <button
                  onClick={() => handleStartJob(currentJob)}
                  style={{
                    padding: "14px 28px",
                    backgroundColor: "var(--info)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "15px",
                    fontWeight: "600",
                    boxShadow: "none",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "var(--info-dark)"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "var(--info)"}
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
            backgroundColor: "var(--surface)",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "none",
            border: "1px solid var(--surface-light)"
          }}>
            <h2 style={{ 
              fontSize: "20px", 
              fontWeight: "700", 
              color: "var(--text-secondary)",
              marginBottom: "16px"
            }}>
              Next Job Assigned
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: "24px",
              alignItems: "center"
            }}>
              <div>
                <p style={{ fontSize: "24px", fontWeight: "700", color: "var(--primary)", margin: "0 0 8px 0" }}>
                  {nextJob.jobNumber}
                </p>
                <p style={{ fontSize: "16px", color: "var(--grey-accent)", margin: "0 0 4px 0" }}>
                  <strong>Customer:</strong> {nextJob.customer}
                </p>
                <p style={{ fontSize: "16px", color: "var(--grey-accent)", margin: "0 0 4px 0" }}>
                  <strong>Vehicle:</strong> {nextJob.reg} - {nextJob.makeModel}
                </p>
                <p style={{ fontSize: "14px", color: "var(--grey-accent-light)", margin: "8px 0 0 0" }}>
                  {nextJob.description}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <button
                  onClick={() => handleStartJob(nextJob)}
                  style={{
                    padding: "14px 28px",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "15px",
                    fontWeight: "600",
                    boxShadow: "none",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "var(--danger)"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "var(--primary)"}
                >
                  Start Job →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* All Jobs List */}
        <div style={{
          backgroundColor: "var(--surface)",
          padding: "24px",
          borderRadius: "16px",
          boxShadow: "none",
          border: "1px solid var(--surface-light)"
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
              color: "var(--text-secondary)",
              margin: 0
            }}>
              My Assigned Jobs ({myJobs.length})
            </h2>
            <button
              onClick={() => router.push("/job-cards/myjobs")}
              style={{
                padding: "8px 16px",
                backgroundColor: "var(--info)",
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
              color: "var(--grey-accent-light)"
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
                    border: "1px solid var(--surface-light)",
                    borderRadius: "8px",
                    padding: "16px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    backgroundColor: "var(--surface)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--surface)";
                    e.currentTarget.style.borderColor = "var(--primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--surface)";
                    e.currentTarget.style.borderColor = "var(--surface-light)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ 
                        fontSize: "16px", 
                        fontWeight: "700", 
                        color: "var(--primary)",
                        margin: "0 0 4px 0"
                      }}>
                        {job.jobNumber}
                      </p>
                      <p style={{ fontSize: "14px", color: "var(--grey-accent)", margin: "0 0 4px 0" }}>
                        {job.customer} | {job.reg}
                      </p>
                      <p style={{ fontSize: "13px", color: "var(--grey-accent-light)", margin: 0 }}>
                        {job.makeModel}
                      </p>
                    </div>
                    <div style={{
                      padding: "6px 12px",
                      backgroundColor: 
                        job.status === "In Progress" ? "var(--info-surface)" :
                        job.status === "Complete" ? "var(--success-surface)" :
                        "var(--warning-surface)",
                      color:
                        job.status === "In Progress" ? "var(--accent-purple)" :
                        job.status === "Complete" ? "var(--success-dark)" :
                        "var(--danger-dark)",
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
              backgroundColor: "var(--surface)",
              border: "1px solid var(--surface-light)",
              borderRadius: "12px",
              cursor: "pointer",
              textAlign: "center",
              boxShadow: "none",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 4px 8px rgba(var(--shadow-rgb),0.1)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 2px 4px rgba(var(--shadow-rgb),0.05)";
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📋</div>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-secondary)" }}>
              View All Jobs
            </div>
          </button>

          <button
            onClick={() => router.push("/clocking")}
            style={{
              padding: "20px",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--surface-light)",
              borderRadius: "12px",
              cursor: "pointer",
              textAlign: "center",
              boxShadow: "none",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 4px 8px rgba(var(--shadow-rgb),0.1)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 2px 4px rgba(var(--shadow-rgb),0.05)";
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>⏱️</div>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-secondary)" }}>
              Time Tracking
            </div>
          </button>

          <button
            onClick={() => router.push("/parts")}
            style={{
              padding: "20px",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--surface-light)",
              borderRadius: "12px",
              cursor: "pointer",
              textAlign: "center",
              boxShadow: "none",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 4px 8px rgba(var(--shadow-rgb),0.1)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 2px 4px rgba(var(--shadow-rgb),0.05)";
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔧</div>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-secondary)" }}>
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
