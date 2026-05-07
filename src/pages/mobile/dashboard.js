// file location: src/pages/mobile/dashboard.js
// Mobile technician landing page: shows today's appointments and upcoming on-site jobs.

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import ServiceModeBadge from "@/components/mobile/ServiceModeBadge";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

// Structured job-row skeleton shaped like the real JobRow (title + time stamp + body).
// Kept local to this file because the mobile dashboard cards use a compact two-column
// grid that differs from the main app table layout.
import MobileDashboardPageUi from "@/components/page-ui/mobile/mobile-dashboard-ui"; // Extracted presentation layer.
function MobileJobRowsSkeleton({ count = 2 }) {return (
    <div>
      <SkeletonKeyframes />
      {Array.from({ length: count }).map((_, i) =>
      <div
        key={i}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "10px",
          padding: "12px 0",
          borderBottom: "var(--separating-line)"
        }}>
        
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <SkeletonBlock width="60%" height="14px" />
            <SkeletonBlock width="80%" height="10px" />
          </div>
          <SkeletonBlock width="80px" height="12px" />
        </div>
      )}
    </div>);

}

const pageStyle = {
  padding: "clamp(12px, 2.5vw, 20px)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--page-stack-gap, 18px)",
  width: "100%",
  boxSizing: "border-box"
};

const responsiveGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: "var(--layout-card-gap, 16px)",
  alignItems: "start"
};

const sectionHeadingStyle = {
  marginTop: 0,
  marginBottom: "8px",
  fontSize: "clamp(1rem, 1.6vw, 1.15rem)",
  color: "var(--text-accent)"
};

const sectionEmptyStyle = {
  margin: 0,
  color: "var(--text-2)",
  fontSize: "0.9rem"
};

const quickActionsListStyle = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: "8px"
};

const quickActionLinkStyle = {
  display: "block",
  padding: "10px 12px",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--text-1)",
  textDecoration: "none",
  fontWeight: 500,
  minHeight: "44px",
  lineHeight: "24px"
};

const jobRowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "12px",
  alignItems: "center",
  padding: "12px 0",
  borderBottom: "var(--separating-line)"
};

function formatWindow(startIso, endIso) {
  if (!startIso) return "Unscheduled";
  const start = new Date(startIso);
  const fmt = (d) => d.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  if (!endIso) return fmt(start);
  const end = new Date(endIso);
  return `${fmt(start)} → ${end.toLocaleString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function MobileDashboardInner() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/mobile/jobs");
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const body = await res.json();
        if (!cancelled) setJobs(body.jobs || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {cancelled = true;};
  }, []);

  const today = useMemo(() => {
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    return jobs.filter((j) => (j.appointment_window_start || "").slice(0, 10) === todayIso);
  }, [jobs]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return jobs.filter((j) => {
      if (!j.appointment_window_start) return false;
      return new Date(j.appointment_window_start) > now && !today.includes(j);
    });
  }, [jobs, today]);

  return (
    <DevLayoutSection
      sectionKey="mobile-dashboard-page"
      parentKey="app-layout-page-card"
      sectionType="page-shell"
      shell
      backgroundToken="surface"
      style={pageStyle}>
      {error &&
      <LayerTheme
        sectionKey="mobile-dashboard-error"
        parentKey="mobile-dashboard-page"
        sectionType="banner"
        padding="var(--section-card-padding)"
        style={{ color: "var(--danger-base)" }}>
        {error}
      </LayerTheme>
      }

      <DevLayoutSection
        sectionKey="mobile-dashboard-grid"
        parentKey="mobile-dashboard-page"
        sectionType="grid"
        style={responsiveGridStyle}>
        <LayerTheme
          as="section"
          sectionKey="mobile-dashboard-today"
          parentKey="mobile-dashboard-grid"
          sectionType="content-card"
          padding="var(--section-card-padding)">
          <h2 style={sectionHeadingStyle}>Today ({today.length})</h2>
          {loading ?
          <MobileJobRowsSkeleton count={2} /> :
          today.length === 0 ?
          <p style={sectionEmptyStyle}>No mobile visits scheduled today.</p> :

          today.map((j) => <JobRow key={j.id} job={j} parentKey="mobile-dashboard-today" />)
          }
        </LayerTheme>

        <LayerTheme
          as="section"
          sectionKey="mobile-dashboard-upcoming"
          parentKey="mobile-dashboard-grid"
          sectionType="content-card"
          padding="var(--section-card-padding)">
          <h2 style={sectionHeadingStyle}>Upcoming ({upcoming.length})</h2>
          {loading ?
          <MobileJobRowsSkeleton count={3} /> :
          upcoming.length === 0 ?
          <p style={sectionEmptyStyle}>Nothing upcoming.</p> :

          upcoming.map((j) => <JobRow key={j.id} job={j} parentKey="mobile-dashboard-upcoming" />)
          }
        </LayerTheme>

        <LayerTheme
          as="section"
          sectionKey="mobile-dashboard-quick-actions"
          parentKey="mobile-dashboard-grid"
          sectionType="content-card"
          padding="var(--section-card-padding)">
          <h2 style={sectionHeadingStyle}>Quick actions</h2>
          <ul style={quickActionsListStyle}>
            <li><Link href="/appointments" style={quickActionLinkStyle}>View all appointments</Link></li>
            <li><Link href="/job-cards/myjobs" style={quickActionLinkStyle}>See my mobile jobs</Link></li>
            <li><Link href="/tech/consumables-request" style={quickActionLinkStyle}>Request consumables</Link></li>
          </ul>
        </LayerTheme>
      </DevLayoutSection>
    </DevLayoutSection>);

}

function JobRow({ job, parentKey }) {
  return (
    <DevLayoutSection
      sectionKey={`mobile-dashboard-job-row-${job.id}`}
      parentKey={parentKey}
      sectionType="list-row"
      style={jobRowStyle}>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <strong style={{ color: "var(--text-accent)" }}>{job.job_number}</strong>
          <ServiceModeBadge mode="mobile" />
        </div>
        <div style={{ color: "var(--text-1)", fontSize: "0.9rem" }}>
          {job.vehicle_reg} · {job.vehicle_make_model}
        </div>
        <div style={{ fontSize: "0.85rem", color: "var(--text-2)", overflowWrap: "anywhere" }}>
          {job.service_address} {job.service_postcode}
        </div>
        <div style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>
          {formatWindow(job.appointment_window_start, job.appointment_window_end)}
        </div>
      </div>
      <Link
        href={`/job-cards/myjobs/${encodeURIComponent(job.job_number)}`}
        style={{
          fontWeight: 600,
          color: "var(--text-accent)",
          textDecoration: "none",
          padding: "10px 14px",
          minHeight: "44px",
          display: "inline-flex",
          alignItems: "center",
          whiteSpace: "nowrap"
        }}>
        Open →
      </Link>
    </DevLayoutSection>);

}

export default function MobileDashboardPage() {
  return <MobileDashboardPageUi view="section1" MobileDashboardInner={MobileDashboardInner} ProtectedRoute={ProtectedRoute} />;




}
