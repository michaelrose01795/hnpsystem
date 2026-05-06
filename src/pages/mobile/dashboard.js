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
          borderBottom: "1px solid var(--primary-border-subtle, rgba(15,23,42,0.08))"
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
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "var(--page-stack-gap, 18px)"
};

const responsiveGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "var(--layout-card-gap, 16px)",
  alignItems: "start"
};

const cardStyle = {
  padding: "16px"
};

const jobRowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "10px",
  padding: "12px 0",
  borderBottom: "1px solid var(--primary-border-subtle, rgba(15,23,42,0.08))"
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
        style={{ ...cardStyle, color: "var(--danger, #dc2626)" }}>
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
          style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Today ({today.length})</h2>
          {loading ?
          <MobileJobRowsSkeleton count={2} /> :
          today.length === 0 ?
          <p>No mobile visits scheduled today.</p> :

          today.map((j) => <JobRow key={j.id} job={j} parentKey="mobile-dashboard-today" />)
          }
        </LayerTheme>

        <LayerTheme
          as="section"
          sectionKey="mobile-dashboard-upcoming"
          parentKey="mobile-dashboard-grid"
          sectionType="content-card"
          style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Upcoming ({upcoming.length})</h2>
          {loading ?
          <MobileJobRowsSkeleton count={3} /> :
          upcoming.length === 0 ?
          <p>Nothing upcoming.</p> :

          upcoming.map((j) => <JobRow key={j.id} job={j} parentKey="mobile-dashboard-upcoming" />)
          }
        </LayerTheme>

        <LayerTheme
          as="section"
          sectionKey="mobile-dashboard-quick-actions"
          parentKey="mobile-dashboard-grid"
          sectionType="content-card"
          style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Quick actions</h2>
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            <li><Link href="/appointments">View all appointments</Link></li>
            <li><Link href="/job-cards/myjobs">See my mobile jobs</Link></li>
            <li><Link href="/tech/consumables-request">Request consumables</Link></li>
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
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <strong>{job.job_number}</strong>
          <ServiceModeBadge mode="mobile" />
        </div>
        <div style={{ color: "var(--text-1)", fontSize: "0.9rem" }}>
          {job.vehicle_reg} · {job.vehicle_make_model}
        </div>
        <div style={{ fontSize: "0.85rem" }}>{job.service_address} {job.service_postcode}</div>
        <div style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
          {formatWindow(job.appointment_window_start, job.appointment_window_end)}
        </div>
      </div>
      <div style={{ alignSelf: "center" }}>
        <Link href={`/job-cards/myjobs/${encodeURIComponent(job.job_number)}`} style={{ fontWeight: 600 }}>
          Open →
        </Link>
      </div>
    </DevLayoutSection>);

}

export default function MobileDashboardPage() {
  return <MobileDashboardPageUi view="section1" MobileDashboardInner={MobileDashboardInner} ProtectedRoute={ProtectedRoute} />;




}
