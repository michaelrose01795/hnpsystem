// file location: src/pages/mobile/dashboard.js
// Mobile technician landing page: shows assigned on-site visits and mobile-specific actions.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import ProtectedRoute from "@/components/ProtectedRoute";
import ServiceModeBadge from "@/components/mobile/ServiceModeBadge";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { SectionShell, StatCard } from "@/components/ui";
import MobileDashboardPageUi from "@/components/page-ui/mobile/mobile-dashboard-ui";
import {
  HR_MANAGER_ROLES,
  MOBILE_TECH_ROLES,
  WORKSHOP_MANAGER_ROLES,
} from "@/lib/auth/roles";
import { prefetchJob } from "@/lib/swr/prefetch";

const MOBILE_DASHBOARD_ROLES = Array.from(
  new Set([
    ...MOBILE_TECH_ROLES,
    ...HR_MANAGER_ROLES,
    ...WORKSHOP_MANAGER_ROLES,
    "service manager",
  ].map((role) => role.toUpperCase()))
);

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

const centeredStateStyle = {
  minHeight: "280px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
};

const sectionSurfaceStyle = {
  boxShadow: "none",
};

const sectionHeadingStyle = {
  fontSize: "20px",
  fontWeight: 700,
  color: "var(--text-1)",
  margin: 0,
};

const detailLabelStyle = {
  fontSize: "15px",
  color: "var(--text-1)",
  margin: 0,
  lineHeight: 1.5,
  overflowWrap: "anywhere",
};

const statusBadgeBaseStyle = {
  height: "var(--table-action-btn-height, 32px)",
  minHeight: "var(--table-action-btn-height, 32px)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 12px",
  borderRadius: "var(--radius-xs)",
  fontSize: "11px",
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const quickActions = [
  { key: "appointments", label: "Appointments", href: "/appointments" },
  { key: "my-jobs", label: "My Mobile Jobs", href: "/tech" },
  { key: "request-parts", label: "Request Parts", href: "/consumables-request" },
  { key: "new-mobile-job", label: "New Mobile Job", href: "/new-job" },
];

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatWindow = (startIso, endIso) => {
  if (!startIso) return "Unscheduled";

  const start = new Date(startIso);
  const startLabel = start.toLocaleString("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!endIso) return startLabel;

  return `${startLabel} – ${new Date(endIso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const formatVisitStatus = (job) => {
  const outcomeLabels = {
    completed_onsite: "Completed on-site",
    follow_up_required: "Follow-up required",
    redirected_to_workshop: "Sent to workshop",
    unable_to_complete: "Unable to complete",
  };

  return outcomeLabels[job?.mobile_outcome] || job?.status || "Scheduled";
};

const getStatusBadgeStyle = (job) => {
  const status = formatVisitStatus(job).toLowerCase();

  if (status.includes("complete") && !status.includes("unable")) {
    return {
      ...statusBadgeBaseStyle,
      backgroundColor: "var(--success-surface)",
      color: "var(--success-text)",
    };
  }

  if (status.includes("unable") || status.includes("workshop")) {
    return {
      ...statusBadgeBaseStyle,
      backgroundColor: "var(--danger-surface)",
      color: "var(--danger-text)",
    };
  }

  return {
    ...statusBadgeBaseStyle,
    backgroundColor: "var(--warning-surface)",
    color: "var(--warning-text)",
  };
};

function MobileDashboardInner() {
  const router = useRouter();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/mobile/jobs");
      if (!response.ok) throw new Error(`Failed to load mobile jobs (${response.status})`);
      const body = await response.json();
      setJobs(Array.isArray(body.jobs) ? body.jobs : []);
    } catch (loadError) {
      setError(loadError.message || "Mobile jobs could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/mobile/jobs");
        if (!response.ok) throw new Error(`Failed to load mobile jobs (${response.status})`);
        const body = await response.json();
        if (!cancelled) setJobs(Array.isArray(body.jobs) ? body.jobs : []);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Mobile jobs could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = useMemo(() => {
    const todayIso = getLocalDateKey();
    return jobs.filter((job) =>
      (job.appointment_window_start || "").slice(0, 10) === todayIso
    );
  }, [jobs]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return jobs.filter((job) => {
      if (!job.appointment_window_start) return false;
      return new Date(job.appointment_window_start) > now && !today.includes(job);
    });
  }, [jobs, today]);

  const followUps = useMemo(
    () => jobs.filter((job) => job.mobile_outcome === "follow_up_required"),
    [jobs]
  );

  const visibleJobs = useMemo(() => {
    const priorityJobs = [...today, ...upcoming, ...jobs];
    const uniqueJobs = Array.from(new Map(priorityJobs.map((job) => [job.id, job])).values());
    return uniqueJobs.slice(0, 3);
  }, [jobs, today, upcoming]);

  const nextVisit = useMemo(() => {
    const now = new Date();
    return (
      today.find((job) => {
        const visitEnd = job.appointment_window_end || job.appointment_window_start;
        return visitEnd && new Date(visitEnd) >= now;
      }) || upcoming[0] || today[0] || null
    );
  }, [today, upcoming]);

  const openJob = useCallback(
    (job) => router.push(`/tech/${encodeURIComponent(job.job_number)}`),
    [router]
  );

  if (loading) return <PageSkeleton />;

  if (error) {
    return (
      <SectionShell
        sectionKey="mobile-dashboard-error"
        parentKey="app-layout-page-card"
        style={centeredStateStyle}
      >
        <div style={{ display: "grid", gap: "12px", justifyItems: "center" }}>
          <h2 style={{ ...sectionHeadingStyle, color: "var(--danger-text)" }}>
            Mobile jobs could not be loaded
          </h2>
          <p style={detailLabelStyle}>{error}</p>
          <button type="button" className="app-btn app-btn--primary" onClick={loadJobs}>
            Try Again
          </button>
        </div>
      </SectionShell>
    );
  }

  return (
    <>
      <DevLayoutSection
        sectionKey="mobile-dashboard-page"
        parentKey="app-layout-page-card"
        sectionType="page-shell"
        shell
        backgroundToken="surface"
        className="app-layout-page-shell"
        style={pageShellStyle}
      >
        <DevLayoutSection
          sectionKey="mobile-dashboard-stats-grid"
          parentKey="mobile-dashboard-page"
          sectionType="section-shell"
          shell
          style={statsGridStyle}
        >
          <MobileStatCard label="Visits Today" value={today.length} sectionKey="today" />
          <MobileStatCard label="Upcoming Visits" value={upcoming.length} sectionKey="upcoming" />
          <MobileStatCard label="Follow-ups" value={followUps.length} sectionKey="follow-ups" />
          <MobileStatCard label="Mobile Jobs" value={jobs.length} sectionKey="total" />
        </DevLayoutSection>

        {nextVisit && (
          <SectionShell
            sectionKey="mobile-dashboard-next-visit"
            parentKey="mobile-dashboard-page"
            backgroundToken="page-card-alt"
            style={{
              ...sectionSurfaceStyle,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div style={{ display: "grid", gap: "10px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h2 style={sectionHeadingStyle}>Next Mobile Visit</h2>
                <ServiceModeBadge mode="mobile" />
              </div>
              <div className="mobile-dashboard-next-visit-details">
                <p className="mobile-dashboard-job-number">{nextVisit.job_number}</p>
                <p style={detailLabelStyle}>
                  <strong>Vehicle:</strong> {nextVisit.vehicle_reg || "No registration"} · {nextVisit.vehicle_make_model || "Vehicle details missing"}
                </p>
                <p style={detailLabelStyle}>
                  <strong>When:</strong> {formatWindow(nextVisit.appointment_window_start, nextVisit.appointment_window_end)}
                </p>
                <p style={detailLabelStyle}>
                  <strong>Location:</strong> {[nextVisit.service_address, nextVisit.service_postcode].filter(Boolean).join(", ") || "Address not added"}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="app-btn app-btn--primary mobile-dashboard-primary-button"
              onClick={() => openJob(nextVisit)}
              onMouseEnter={() => prefetchJob(nextVisit.job_number)}
            >
              Open Visit
            </button>
          </SectionShell>
        )}

        <SectionShell
          sectionKey="mobile-dashboard-assigned-visits"
          parentKey="mobile-dashboard-page"
          backgroundToken="page-card-alt"
          style={sectionSurfaceStyle}
        >
          <DevLayoutSection
            sectionKey="mobile-dashboard-assigned-visits-header"
            parentKey="mobile-dashboard-assigned-visits"
            sectionType="toolbar"
            className="app-layout-header-row"
          >
            <h2 style={sectionHeadingStyle}>My Assigned Mobile Visits</h2>
          </DevLayoutSection>

          {visibleJobs.length === 0 ? (
            <DevLayoutSection
              sectionKey="mobile-dashboard-assigned-visits-empty"
              parentKey="mobile-dashboard-assigned-visits"
              sectionType="content-card"
              className="app-layout-card"
              style={{
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                minHeight: "140px",
              }}
            >
              <p style={detailLabelStyle}>No mobile visits are currently assigned.</p>
            </DevLayoutSection>
          ) : (
            <DevLayoutSection
              sectionKey="mobile-dashboard-assigned-visits-rows"
              parentKey="mobile-dashboard-assigned-visits"
              sectionType="data-table-shell"
              className="app-table-shell-scroll"
            >
              <table
                className="app-data-table app-table-shell app-table-shell--with-headings mobile-dashboard-visits-table"
                data-dev-section="1"
                data-dev-section-key="mobile-dashboard-visits-table"
                data-dev-section-type="data-table"
                data-dev-section-parent="mobile-dashboard-assigned-visits-rows"
              >
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Vehicle</th>
                    <th>Visit window</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th aria-label="Open visit" />
                  </tr>
                </thead>
                <tbody>
                  {visibleJobs.map((job, index) => (
                    <tr key={job.id || job.job_number || index}>
                      <td className="mobile-dashboard-table-job">{job.job_number}</td>
                      <td>{job.vehicle_reg || "No registration"} · {job.vehicle_make_model || "Vehicle details missing"}</td>
                      <td>{formatWindow(job.appointment_window_start, job.appointment_window_end)}</td>
                      <td>{[job.service_address, job.service_postcode].filter(Boolean).join(", ") || "Address not added"}</td>
                      <td>
                        <span className="app-table-action-btn" style={getStatusBadgeStyle(job)}>
                          {formatVisitStatus(job)}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="app-btn app-btn--secondary app-btn--sm"
                          onClick={() => openJob(job)}
                          onMouseEnter={() => prefetchJob(job.job_number)}
                          aria-label={`Open mobile visit ${job.job_number}`}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DevLayoutSection>
          )}
        </SectionShell>

        <SectionShell
          sectionKey="mobile-dashboard-actions-card"
          parentKey="mobile-dashboard-page"
          backgroundToken="page-card-alt"
          style={sectionSurfaceStyle}
        >
          <DevLayoutSection
            sectionKey="mobile-dashboard-actions"
            parentKey="mobile-dashboard-actions-card"
            sectionType="toolbar"
            className="app-layout-toolbar-row"
            style={actionGridStyle}
          >
            {quickActions.map((action) => (
              <button
                key={action.key}
                type="button"
                className="app-btn app-btn--primary mobile-dashboard-action-button"
                onClick={() => router.push(action.href)}
              >
                {action.label}
              </button>
            ))}
          </DevLayoutSection>
        </SectionShell>
      </DevLayoutSection>

      <style jsx>{`
        .mobile-dashboard-next-visit-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
          align-items: center;
          gap: 14px;
          width: 100%;
        }

        .mobile-dashboard-job-number,
        .mobile-dashboard-table-job {
          color: var(--text-accent);
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .mobile-dashboard-job-number {
          margin: 0;
          font-size: 24px;
        }

        .mobile-dashboard-table-job {
          white-space: nowrap;
        }

        .mobile-dashboard-primary-button {
          width: 100%;
        }

        .mobile-dashboard-action-button {
          width: 100%;
          min-height: 88px;
          text-align: center;
          transition: transform 0.2s ease, background-color 0.2s ease;
        }

        .mobile-dashboard-action-button:hover,
        .mobile-dashboard-action-button:focus-visible {
          transform: translateY(-2px);
          z-index: var(--hover-surface-z, 80);
        }

        .mobile-dashboard-action-button:active {
          transform: translateY(1px);
        }

        @media (prefers-reduced-motion: reduce) {
          .mobile-dashboard-action-button {
            transition: none;
          }

          .mobile-dashboard-action-button:hover,
          .mobile-dashboard-action-button:focus-visible,
          .mobile-dashboard-action-button:active {
            transform: none;
          }
        }
      `}</style>
    </>
  );
}

function MobileStatCard({ label, value, sectionKey }) {
  return (
    <StatCard
      sectionKey={`mobile-dashboard-stat-${sectionKey}`}
      parentKey="mobile-dashboard-stats-grid"
      style={{ boxShadow: "none" }}
    >
      <div
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: "var(--text-accent)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "14px", color: "var(--text-1)", fontWeight: 600 }}>
        {label}
      </div>
    </StatCard>
  );
}

export default function MobileDashboardPage() {
  return (
    <MobileDashboardPageUi
      view="section1"
      MobileDashboardInner={MobileDashboardInner}
      ProtectedRoute={ProtectedRoute}
      allowedRoles={MOBILE_DASHBOARD_ROLES}
    />
  );
}
