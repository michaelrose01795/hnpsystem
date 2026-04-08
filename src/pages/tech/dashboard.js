"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { SectionShell, StatCard } from "@/components/ui";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";
import { getAllJobs } from "@/lib/database/jobs";
import { getClockingStatus } from "@/lib/database/clocking";
import { prefetchJob } from "@/lib/swr/prefetch";

const pageShellStyle = {
  width: "100%",
  minWidth: 0,
  padding: "8px 0",
};

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
  gap: "12px",
  width: "100%",
};

const actionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
  gap: "12px",
  width: "100%",
};

const jobsListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const centeredStateStyle = {
  minHeight: "280px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
};

const statCardBaseStyle = {
  background: "var(--accent-surface)",
  border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
  boxShadow: "none",
};

const buildToneSurfaceStyle = (surface, border = "var(--accentBorder)") => ({
  ...statCardBaseStyle,
  background: surface,
  border: `1px solid ${border}`,
});

const sectionSurfaceStyle = {
  background: "var(--accent-surface)",
  border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
  boxShadow: "none",
};

const emphasizedSectionSurfaceStyle = {
  ...sectionSurfaceStyle,
  border: "1px solid var(--accentBorderStrong)",
};

const statusBadgeBaseStyle = {
  padding: "6px 12px",
  borderRadius: "var(--radius-sm)",
  fontSize: "12px",
  fontWeight: "600",
  whiteSpace: "nowrap",
};

const getStatusBadgeStyle = (status) => {
  switch (String(status || "").trim().toLowerCase()) {
    case "in progress":
      return {
        ...statusBadgeBaseStyle,
        backgroundColor: "var(--accent-purple-surface)",
        color: "var(--primary)",
        border: "1px solid rgba(var(--accent-base-rgb), 0.2)",
      };
    case "complete":
      return {
        ...statusBadgeBaseStyle,
        backgroundColor: "var(--success-surface)",
        color: "var(--success-text)",
        border: "1px solid var(--success-border)",
      };
    default:
      return {
        ...statusBadgeBaseStyle,
        backgroundColor: "var(--warning-surface)",
        color: "var(--warning-text)",
        border: "1px solid var(--warning-border)",
      };
  }
};

const formatClockInLabel = (clockInTime) => {
  if (!clockInTime) return "Not currently working";
  return `Since ${new Date(clockInTime).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const buildVehicleLabel = (job) => {
  const reg = job?.reg || "No registration";
  const makeModel = job?.makeModel || "Vehicle details missing";
  return `${reg} - ${makeModel}`;
};

const detailLabelStyle = {
  fontSize: "15px",
  color: "var(--text-primary)",
  margin: 0,
  lineHeight: 1.5,
};

const sectionHeadingStyle = {
  fontSize: "20px",
  fontWeight: "700",
  color: "var(--text-primary)",
  margin: 0,
};

const sectionCopyStyle = {
  margin: 0,
  fontSize: "14px",
  color: "var(--text-secondary)",
  lineHeight: 1.5,
};

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
  const username = typeof user?.username === "string" ? user.username.trim() : "";
  const hasTechRole =
    user?.roles?.some((role) => role?.toLowerCase().includes("tech")) || false;
  const isTech = allowedNames.has(username) || hasTechRole;

  const isAssignedToTechnician = useCallback(
    (job) => {
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
    },
    [dbUserId]
  );

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
        setCurrentJob(isClockedIn && data ? sortedJobs[0] || null : null);
      } catch (error) {
        console.error("Error fetching tech data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dbUserId, isAssignedToTechnician, isTech]);

  const handleStartJob = useCallback(
    (job) => {
      router.push(`/job-cards/myjobs/${job.jobNumber}`);
    },
    [router]
  );

  const visibleJobs = useMemo(() => myJobs.slice(0, 3), [myJobs]);
  const isClockedIn = Boolean(clockingStatus?.clock_in);
  const clockInTime = clockingStatus?.clock_in || null;
  const dashboardActions = [
    {
      key: "view-all-jobs",
      label: "View All Jobs",
      href: "/job-cards/myjobs",
    },
    {
      key: "time-tracking",
      label: "Time Tracking",
      href: "/tech/efficiency",
    },
    {
      key: "request-consumables",
      label: "Request Consumables",
      href: "/tech/consumables-request",
    },
  ];

  if (rosterLoading) {
    return (
      <Layout>
        <SectionShell
          sectionKey="tech-dashboard-roster-loading"
          parentKey="app-layout-page-card"
          style={centeredStateStyle}
        >
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>Loading roster...</p>
        </SectionShell>
      </Layout>
    );
  }

  if (!isTech) {
    return (
      <Layout>
        <SectionShell
          sectionKey="tech-dashboard-access-denied"
          parentKey="app-layout-page-card"
          style={centeredStateStyle}
        >
          <div style={{ display: "grid", gap: "10px" }}>
            <h2 style={{ color: "var(--primary)", margin: 0 }}>Access Denied</h2>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              This page is only for technicians.
            </p>
          </div>
        </SectionShell>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <SectionShell
          sectionKey="tech-dashboard-loading"
          parentKey="app-layout-page-card"
          style={{
            ...centeredStateStyle,
            minHeight: "70vh",
            gap: "16px",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: "60px",
              height: "60px",
              border: "4px solid var(--surface-light)",
              borderTop: "4px solid var(--primary)",
              borderRadius: "var(--radius-full)",
              animation: "tech-dashboard-spin 1s linear infinite",
            }}
          />
          <p style={{ color: "var(--text-secondary)", fontSize: "16px", margin: 0 }}>
            Loading dashboard...
          </p>
          <style jsx>{`
            @keyframes tech-dashboard-spin {
              0% {
                transform: rotate(0deg);
              }
              100% {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </SectionShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <DevLayoutSection
        sectionKey="tech-dashboard-page"
        parentKey="app-layout-page-card"
        sectionType="page-shell"
        shell
        backgroundToken="surface"
        className="app-layout-page-shell"
        style={pageShellStyle}
      >
        <DevLayoutSection
          sectionKey="tech-dashboard-stats-grid"
          parentKey="tech-dashboard-page"
          sectionType="section-shell"
          shell
          style={statsGridStyle}
        >
          <StatCard
            sectionKey="tech-dashboard-stat-assigned"
            parentKey="tech-dashboard-stats-grid"
            style={buildToneSurfaceStyle("var(--accent-surface)", "var(--accentBorderStrong)")}
          >
            <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--primary)" }}>
              {myJobs.length}
            </div>
            <div style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: "600" }}>
              Jobs Assigned
            </div>
          </StatCard>

          <StatCard
            sectionKey="tech-dashboard-stat-clocking"
            parentKey="tech-dashboard-stats-grid"
            style={buildToneSurfaceStyle(
              isClockedIn ? "var(--success-surface)" : "var(--danger-surface)",
              isClockedIn ? "var(--success-border)" : "var(--danger-border)"
            )}
          >
            <div
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: isClockedIn ? "var(--success-text)" : "var(--danger-text)",
              }}
            >
              {isClockedIn ? "Clocked In" : "Clocked Out"}
            </div>
            <div
              style={{
                fontSize: "13px",
                color: isClockedIn ? "var(--success-text)" : "var(--danger-text)",
              }}
            >
              {formatClockInLabel(clockInTime)}
            </div>
          </StatCard>

          <StatCard
            sectionKey="tech-dashboard-stat-current-job"
            parentKey="tech-dashboard-stats-grid"
            style={buildToneSurfaceStyle("var(--page-card-bg-alt)")}
          >
            <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-primary)" }}>
              Current Job
            </div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--primary)" }}>
              {currentJob ? currentJob.jobNumber : "None"}
            </div>
          </StatCard>

          <StatCard
            sectionKey="tech-dashboard-stat-hours"
            parentKey="tech-dashboard-stats-grid"
            style={buildToneSurfaceStyle("var(--page-card-bg-alt)")}
          >
            <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--primary)" }}>
              {isClockedIn ? calculateHoursWorked(clockInTime) : "0.0"}h
            </div>
            <div style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: "600" }}>
              Hours Today
            </div>
          </StatCard>
        </DevLayoutSection>

        {currentJob && (
          <SectionShell
            sectionKey="tech-dashboard-current-job"
            parentKey="tech-dashboard-page"
            backgroundToken="page-card-alt"
            style={{
              ...emphasizedSectionSurfaceStyle,
              gap: "16px",
            }}
          >
            <div style={{ display: "grid", gap: "12px" }}>
              <h2 style={{ ...sectionHeadingStyle, color: "var(--primary)" }}>
                Currently Working On
              </h2>
              <div style={{ display: "grid", gap: "6px" }}>
                <p style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                  {currentJob.jobNumber}
                </p>
                <p style={detailLabelStyle}>
                  <strong>Customer:</strong> {currentJob.customer}
                </p>
                <p style={detailLabelStyle}>
                  <strong>Vehicle:</strong> {buildVehicleLabel(currentJob)}
                </p>
                <p style={{ ...sectionCopyStyle, marginTop: "2px" }}>
                  {currentJob.description || "No description added yet."}
                </p>
              </div>
            </div>

            <DevLayoutSection
              as="button"
              type="button"
              sectionKey="tech-dashboard-current-job-action"
              parentKey="tech-dashboard-current-job"
              sectionType="content-card"
              className="tech-dashboard-primary-button"
              onClick={() => handleStartJob(currentJob)}
              onMouseEnter={() => prefetchJob(currentJob?.jobNumber)}
            >
              Continue Job
            </DevLayoutSection>
          </SectionShell>
        )}

        {nextJob && !currentJob && (
          <SectionShell
            sectionKey="tech-dashboard-next-job"
            parentKey="tech-dashboard-page"
            backgroundToken="page-card-alt"
            style={sectionSurfaceStyle}
          >
            <div style={{ display: "grid", gap: "12px" }}>
              <h2 style={sectionHeadingStyle}>Next Job Assigned</h2>
              <div style={{ display: "grid", gap: "6px" }}>
                <p style={{ fontSize: "24px", fontWeight: "700", color: "var(--primary)", margin: 0 }}>
                  {nextJob.jobNumber}
                </p>
                <p style={detailLabelStyle}>
                  <strong>Customer:</strong> {nextJob.customer}
                </p>
                <p style={detailLabelStyle}>
                  <strong>Vehicle:</strong> {buildVehicleLabel(nextJob)}
                </p>
                <p style={{ ...sectionCopyStyle, marginTop: "2px" }}>
                  {nextJob.description || "No description added yet."}
                </p>
              </div>
            </div>

            <DevLayoutSection
              as="button"
              type="button"
              sectionKey="tech-dashboard-next-job-action"
              parentKey="tech-dashboard-next-job"
              sectionType="content-card"
              className="tech-dashboard-primary-button"
              onClick={() => handleStartJob(nextJob)}
              onMouseEnter={() => prefetchJob(nextJob?.jobNumber)}
            >
              Start Job
            </DevLayoutSection>
          </SectionShell>
        )}

        <SectionShell
          sectionKey="tech-dashboard-assigned-jobs"
          parentKey="tech-dashboard-page"
          backgroundToken="page-card-alt"
          style={sectionSurfaceStyle}
        >
          <DevLayoutSection
            sectionKey="tech-dashboard-assigned-jobs-header"
            parentKey="tech-dashboard-assigned-jobs"
            sectionType="toolbar"
            className="app-layout-header-row"
          >
            <div style={{ display: "grid", gap: "4px" }}>
              <h2 style={sectionHeadingStyle}>My Assigned Jobs</h2>
              <p style={sectionCopyStyle}>
                Showing the next three jobs currently assigned to you.
              </p>
            </div>
          </DevLayoutSection>

          {visibleJobs.length === 0 ? (
            <DevLayoutSection
              sectionKey="tech-dashboard-assigned-jobs-empty"
              parentKey="tech-dashboard-assigned-jobs"
              sectionType="content-card"
              className="app-layout-card"
              style={{
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                minHeight: "140px",
              }}
            >
              <p style={{ fontSize: "16px", color: "var(--text-secondary)", margin: 0 }}>
                No jobs assigned yet.
              </p>
            </DevLayoutSection>
          ) : (
            <DevLayoutSection
              sectionKey="tech-dashboard-assigned-jobs-rows"
              parentKey="tech-dashboard-assigned-jobs"
              sectionType="table-rows"
              style={jobsListStyle}
            >
              {visibleJobs.map((job, index) => (
                <DevLayoutSection
                  key={job.id || job.jobNumber || index}
                  as="button"
                  type="button"
                  sectionKey={`tech-dashboard-assigned-job-${index + 1}`}
                  parentKey="tech-dashboard-assigned-jobs-rows"
                  sectionType="content-card"
                  className="app-layout-card tech-dashboard-surface-button"
                  style={{
                    textAlign: "left",
                    justifyContent: "space-between",
                  }}
                  onClick={() => handleStartJob(job)}
                  onMouseEnter={() => prefetchJob(job.jobNumber)}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "12px",
                      width: "100%",
                    }}
                  >
                    <div style={{ display: "grid", gap: "4px" }}>
                      <p
                        style={{
                          fontSize: "16px",
                          fontWeight: "700",
                          color: "var(--primary)",
                          margin: 0,
                        }}
                      >
                        {job.jobNumber}
                      </p>
                      <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0 }}>
                        {job.customer} | {job.reg}
                      </p>
                      <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
                        {job.makeModel || "Vehicle details missing"}
                      </p>
                    </div>
                    <div style={getStatusBadgeStyle(job.status)}>{job.status}</div>
                  </div>
                </DevLayoutSection>
              ))}

              {myJobs.length > 3 && (
                <DevLayoutSection
                  sectionKey="tech-dashboard-assigned-jobs-more"
                  parentKey="tech-dashboard-assigned-jobs-rows"
                  sectionType="content-card"
                  className="app-layout-surface-subtle"
                >
                  <p style={{ ...sectionCopyStyle, fontWeight: "600" }}>
                    More jobs are available. Use View All Jobs below to open the full list.
                  </p>
                </DevLayoutSection>
              )}
            </DevLayoutSection>
          )}
        </SectionShell>

        <SectionShell
          sectionKey="tech-dashboard-actions-card"
          parentKey="tech-dashboard-page"
          backgroundToken="page-card-alt"
          style={sectionSurfaceStyle}
        >
          <DevLayoutSection
            sectionKey="tech-dashboard-actions"
            parentKey="tech-dashboard-actions-card"
            sectionType="toolbar"
            className="app-layout-toolbar-row"
            style={actionGridStyle}
          >
            {dashboardActions.map((action) => (
              <DevLayoutSection
                key={action.key}
                as="button"
                type="button"
                sectionKey={`tech-dashboard-action-${action.key}`}
                parentKey="tech-dashboard-actions"
                sectionType="content-card"
                className="app-layout-card tech-dashboard-action-button"
                onClick={() => router.push(action.href)}
              >
                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
                  {action.label}
                </div>
              </DevLayoutSection>
            ))}
          </DevLayoutSection>
        </SectionShell>
      </DevLayoutSection>

      <style jsx>{`
        .tech-dashboard-primary-button {
          width: 100%;
          border: none;
          border-radius: var(--radius-sm);
          padding: 14px 20px;
          background: var(--primary);
          color: var(--text-inverse);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s ease, transform 0.2s ease;
          box-shadow: none;
        }

        .tech-dashboard-primary-button:hover,
        .tech-dashboard-primary-button:focus-visible {
          background: var(--primary-dark);
          transform: translateY(-1px);
        }

        .tech-dashboard-surface-button,
        .tech-dashboard-action-button {
          appearance: none;
          width: 100%;
          cursor: pointer;
          transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
        }

        .tech-dashboard-surface-button {
          background: var(--surface);
          border: 1px solid rgba(var(--accent-base-rgb), 0.14);
        }

        .tech-dashboard-action-button {
          min-height: 88px;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: var(--surface);
          border: 1px solid rgba(var(--accent-base-rgb), 0.14);
        }

        .tech-dashboard-surface-button:hover,
        .tech-dashboard-surface-button:focus-visible,
        .tech-dashboard-action-button:hover,
        .tech-dashboard-action-button:focus-visible {
          transform: translateY(-2px);
          z-index: var(--hover-surface-z, 80);
        }

        .tech-dashboard-surface-button:hover,
        .tech-dashboard-surface-button:focus-visible {
          border-color: rgba(var(--accent-base-rgb), 0.3);
          background: var(--accent-surface);
        }

        .tech-dashboard-action-button:hover,
        .tech-dashboard-action-button:focus-visible {
          border-color: rgba(var(--accent-base-rgb), 0.3);
          background: var(--accent-surface);
          z-index: var(--hover-surface-z, 80);
        }
      `}</style>
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
