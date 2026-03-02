"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";
import { getAllJobs } from "@/lib/database/jobs";
import { getClockingStatus } from "@/lib/database/clocking";

export default function TechsDashboard() {
  const router = useRouter();
  const { user, dbUserId } = useUser();
  const { usersByRole, isLoading: rosterLoading } = useRoster();
  const [myJobs, setMyJobs] = useState([]);
  const [nextJob, setNextJob] = useState(null);
  const [currentJob, setCurrentJob] = useState(null);
  const [clockingStatus, setClockingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const techsList = usersByRole?.["Techs"] || [];
  const motList = usersByRole?.["MOT Tester"] || [];
  const allowedNames = new Set([...techsList, ...motList]);
  const username =
    typeof user?.username === "string" ? user.username.trim() : "";
  const hasTechRole =
    user?.roles?.some((role) => role?.toLowerCase().includes("tech")) || false;
  const isTech = allowedNames.has(username) || hasTechRole;

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
        const fetchedJobs = await getAllJobs();
        const assignedJobs = fetchedJobs.filter((job) => isAssignedToTechnician(job));

        const sortedJobs = assignedJobs.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          }
          return 0;
        });

        setMyJobs(sortedJobs);
        setNextJob(sortedJobs.length > 0 ? sortedJobs[0] : null);

        const { isClockedIn, data } = await getClockingStatus(dbUserId);
        setClockingStatus(data);

        if (isClockedIn && data) {
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

  const handleStartJob = (job) => {
    router.push(`/job-cards/myjobs/${job.jobNumber}`);
  };

  if (rosterLoading) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading roster...
        </div>
      </Layout>
    );
  }

  if (!isTech) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2 style={{ color: "var(--primary)", marginBottom: "10px" }}>Access Denied</h2>
          <p style={{ color: "var(--text-secondary)" }}>This page is only for Technicians.</p>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "80vh",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              border: "4px solid var(--surface-light)",
              borderTop: "4px solid var(--primary)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>Loading dashboard...</p>
          <style jsx>{`
            @keyframes spin {
              0% {
                transform: rotate(0deg);
              }
              100% {
                transform: rotate(360deg);
              }
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
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--accent-purple-surface)",
              padding: "24px",
              borderRadius: "16px",
              boxShadow: "none",
              border: "1px solid rgba(var(--primary-rgb),0.25)",
            }}
          >
            <div style={{ fontSize: "36px", fontWeight: "700", color: "var(--primary)", marginBottom: "8px" }}>
              {myJobs.length}
            </div>
            <div style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: "600" }}>Jobs Assigned</div>
          </div>

          <div
            style={{
              backgroundColor: clockingStatus ? "var(--success-surface)" : "var(--danger-surface)",
              padding: "24px",
              borderRadius: "16px",
              boxShadow: "none",
              border: `1px solid ${clockingStatus ? "var(--success-border)" : "var(--danger-border)"}`,
            }}
          >
            <div
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: clockingStatus ? "var(--success-text)" : "var(--danger-text)",
                marginBottom: "8px",
              }}
            >
              {clockingStatus ? "Clocked In" : "Clocked Out"}
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {clockingStatus
                ? `Since ${new Date(clockingStatus.clock_in).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Not currently working"}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "rgba(var(--primary-rgb), 0.08)",
              padding: "24px",
              borderRadius: "16px",
              boxShadow: "none",
              border: "1px solid rgba(var(--primary-rgb),0.2)",
            }}
          >
            <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "8px" }}>
              Current Job
            </div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--primary)" }}>
              {currentJob ? currentJob.jobNumber : "None"}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "rgba(var(--primary-rgb), 0.08)",
              padding: "24px",
              borderRadius: "16px",
              boxShadow: "none",
              border: "1px solid rgba(var(--primary-rgb),0.2)",
            }}
          >
            <div style={{ fontSize: "36px", fontWeight: "700", color: "var(--primary)", marginBottom: "8px" }}>
              {clockingStatus ? calculateHoursWorked(clockingStatus.clock_in) : "0.0"}h
            </div>
            <div style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: "600" }}>Hours Today</div>
          </div>
        </div>

        {currentJob && (
          <div
            style={{
              backgroundColor: "var(--surface)",
              padding: "24px",
              borderRadius: "16px",
              boxShadow: "none",
              border: "2px solid var(--primary)",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "700",
                color: "var(--primary)",
                marginBottom: "16px",
              }}
            >
              Currently Working On
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: "24px",
                alignItems: "center",
              }}
            >
              <div>
                <p style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 8px 0" }}>
                  {currentJob.jobNumber}
                </p>
                <p style={{ fontSize: "16px", color: "var(--text-secondary)", margin: "0 0 4px 0" }}>
                  <strong>Customer:</strong> {currentJob.customer}
                </p>
                <p style={{ fontSize: "16px", color: "var(--text-secondary)", margin: "0 0 4px 0" }}>
                  <strong>Vehicle:</strong> {currentJob.reg} - {currentJob.makeModel}
                </p>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "8px 0 0 0" }}>
                  {currentJob.description}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <button
                  onClick={() => handleStartJob(currentJob)}
                  style={{
                    padding: "14px 28px",
                    backgroundColor: "var(--primary)",
                    color: "var(--text-inverse)",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "15px",
                    fontWeight: "600",
                    boxShadow: "none",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.target.style.backgroundColor = "var(--primary-dark)")}
                  onMouseLeave={(e) => (e.target.style.backgroundColor = "var(--primary)")}
                >
                  Continue Job
                </button>
              </div>
            </div>
          </div>
        )}

        {nextJob && !currentJob && (
          <div
            style={{
              backgroundColor: "var(--surface)",
              padding: "24px",
              borderRadius: "16px",
              boxShadow: "none",
              border: "1px solid var(--surface-light)",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "700",
                color: "var(--text-primary)",
                marginBottom: "16px",
              }}
            >
              Next Job Assigned
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: "24px",
                alignItems: "center",
              }}
            >
              <div>
                <p style={{ fontSize: "24px", fontWeight: "700", color: "var(--primary)", margin: "0 0 8px 0" }}>
                  {nextJob.jobNumber}
                </p>
                <p style={{ fontSize: "16px", color: "var(--text-secondary)", margin: "0 0 4px 0" }}>
                  <strong>Customer:</strong> {nextJob.customer}
                </p>
                <p style={{ fontSize: "16px", color: "var(--text-secondary)", margin: "0 0 4px 0" }}>
                  <strong>Vehicle:</strong> {nextJob.reg} - {nextJob.makeModel}
                </p>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "8px 0 0 0" }}>
                  {nextJob.description}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <button
                  onClick={() => handleStartJob(nextJob)}
                  style={{
                    padding: "14px 28px",
                    backgroundColor: "var(--primary)",
                    color: "var(--text-inverse)",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "15px",
                    fontWeight: "600",
                    boxShadow: "none",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.target.style.backgroundColor = "var(--primary-dark)")}
                  onMouseLeave={(e) => (e.target.style.backgroundColor = "var(--primary)")}
                >
                  Start Job
                </button>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            backgroundColor: "var(--surface)",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "none",
            border: "1px solid var(--surface-light)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "700",
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              My Assigned Jobs
            </h2>
          </div>

          {myJobs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
              <p style={{ fontSize: "16px" }}>No jobs assigned yet</p>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {myJobs.slice(0, 3).map((job) => (
                <div
                  key={job.id}
                  onClick={() => handleStartJob(job)}
                  style={{
                    border: "1px solid var(--surface-light)",
                    borderRadius: "8px",
                    padding: "16px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    backgroundColor: "var(--surface)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(var(--primary-rgb), 0.06)";
                    e.currentTarget.style.borderColor = "var(--primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--surface)";
                    e.currentTarget.style.borderColor = "var(--surface-light)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p
                        style={{
                          fontSize: "16px",
                          fontWeight: "700",
                          color: "var(--primary)",
                          margin: "0 0 4px 0",
                        }}
                      >
                        {job.jobNumber}
                      </p>
                      <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "0 0 4px 0" }}>
                        {job.customer} | {job.reg}
                      </p>
                      <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>{job.makeModel}</p>
                    </div>
                    <div
                      style={{
                        padding: "6px 12px",
                        backgroundColor:
                          job.status === "In Progress"
                            ? "var(--accent-purple-surface)"
                            : job.status === "Complete"
                              ? "var(--success-surface)"
                              : "var(--warning-surface)",
                        color:
                          job.status === "In Progress"
                            ? "var(--primary)"
                            : job.status === "Complete"
                              ? "var(--success-text)"
                              : "var(--warning-text)",
                        border:
                          job.status === "In Progress"
                            ? "1px solid rgba(var(--primary-rgb), 0.25)"
                            : job.status === "Complete"
                              ? "1px solid var(--success-border)"
                              : "1px solid var(--warning-border)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      {job.status}
                    </div>
                  </div>
                </div>
              ))}
              {myJobs.length > 3 && (
                <div
                  style={{
                    border: "1px solid rgba(var(--primary-rgb), 0.2)",
                    backgroundColor: "rgba(var(--primary-rgb), 0.08)",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    color: "var(--text-secondary)",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  More jobs available. Click the "View All Jobs" button below.
                </div>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px",
          }}
        >
          <button
            onClick={() => router.push("/job-cards/Myjobs")}
            style={{
              padding: "20px",
              backgroundColor: "rgba(var(--primary-rgb), 0.08)",
              border: "1px solid rgba(var(--primary-rgb), 0.25)",
              borderRadius: "12px",
              cursor: "pointer",
              textAlign: "center",
              boxShadow: "none",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.backgroundColor = "rgba(var(--primary-rgb), 0.14)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.backgroundColor = "rgba(var(--primary-rgb), 0.08)";
            }}
          >
            <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>View All Jobs</div>
          </button>

          <button
            onClick={() => router.push("/tech/efficiency")}
            style={{
              padding: "20px",
              backgroundColor: "rgba(var(--primary-rgb), 0.08)",
              border: "1px solid rgba(var(--primary-rgb), 0.25)",
              borderRadius: "12px",
              cursor: "pointer",
              textAlign: "center",
              boxShadow: "none",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.backgroundColor = "rgba(var(--primary-rgb), 0.14)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.backgroundColor = "rgba(var(--primary-rgb), 0.08)";
            }}
          >
            <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>Time Tracking</div>
          </button>

          <button
            onClick={() => router.push("/tech/consumables-request")}
            style={{
              padding: "20px",
              backgroundColor: "rgba(var(--primary-rgb), 0.08)",
              border: "1px solid rgba(var(--primary-rgb), 0.25)",
              borderRadius: "12px",
              cursor: "pointer",
              textAlign: "center",
              boxShadow: "none",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.backgroundColor = "rgba(var(--primary-rgb), 0.14)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.backgroundColor = "rgba(var(--primary-rgb), 0.08)";
            }}
          >
            <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>Request Consumables</div>
          </button>
        </div>
      </div>
    </Layout>
  );
}

function calculateHoursWorked(clockInTime) {
  if (!clockInTime) return "0.0";
  const now = new Date();
  const clockIn = new Date(clockInTime);
  const hours = (now - clockIn) / (1000 * 60 * 60);
  return hours.toFixed(1);
}
