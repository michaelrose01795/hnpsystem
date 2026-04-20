// file location: src/pages/mobile/dashboard.js
// Mobile technician landing page: shows today's appointments and upcoming on-site jobs.

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import ServiceModeBadge from "@/components/mobile/ServiceModeBadge";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";

// Structured job-row skeleton shaped like the real JobRow (title + time stamp + body).
// Kept local to this file because the mobile dashboard cards use a compact two-column
// grid that differs from the main app table layout.
function MobileJobRowsSkeleton({ count = 2 }) {
  return (
    <div>
      <SkeletonKeyframes />
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "10px",
            padding: "12px 0",
            borderBottom: "1px solid var(--border-subtle, rgba(15,23,42,0.08))",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <SkeletonBlock width="60%" height="14px" />
            <SkeletonBlock width="80%" height="10px" />
          </div>
          <SkeletonBlock width="80px" height="12px" />
        </div>
      ))}
    </div>
  );
}

const pageStyle = {
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const cardStyle = {
  backgroundColor: "var(--section-card-bg, #fff)",
  borderRadius: "var(--section-card-radius, 12px)",
  padding: "16px",
  border: "var(--section-card-border, 1px solid rgba(15,23,42,0.08))",
};

const jobRowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "10px",
  padding: "12px 0",
  borderBottom: "1px solid var(--border-subtle, rgba(15,23,42,0.08))",
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
    return () => { cancelled = true; };
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
    <div style={pageStyle}>
      <header>
        <h1 style={{ margin: 0 }}>Mobile Dashboard</h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-secondary)" }}>
          Your on-site visits for today and the days ahead.
        </p>
      </header>

      {error && (
        <div style={{ ...cardStyle, borderColor: "var(--danger, #dc2626)", color: "var(--danger, #dc2626)" }}>
          {error}
        </div>
      )}

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Today ({today.length})</h2>
        {loading ? (
          <MobileJobRowsSkeleton count={2} />
        ) : today.length === 0 ? (
          <p>No mobile visits scheduled today.</p>
        ) : (
          today.map((j) => <JobRow key={j.id} job={j} />)
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Upcoming ({upcoming.length})</h2>
        {loading ? (
          <MobileJobRowsSkeleton count={3} />
        ) : upcoming.length === 0 ? (
          <p>Nothing upcoming.</p>
        ) : (
          upcoming.map((j) => <JobRow key={j.id} job={j} />)
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Quick actions</h2>
        <ul style={{ margin: 0, paddingLeft: "20px" }}>
          <li><Link href="/mobile/appointments">View all appointments</Link></li>
          <li><Link href="/mobile/jobs">See my mobile jobs</Link></li>
          <li><Link href="/tech/consumables-request">Request consumables</Link></li>
        </ul>
      </section>
    </div>
  );
}

function JobRow({ job }) {
  return (
    <div style={jobRowStyle}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <strong>{job.job_number}</strong>
          <ServiceModeBadge mode="mobile" />
        </div>
        <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          {job.vehicle_reg} · {job.vehicle_make_model}
        </div>
        <div style={{ fontSize: "0.85rem" }}>{job.service_address} {job.service_postcode}</div>
        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          {formatWindow(job.appointment_window_start, job.appointment_window_end)}
        </div>
      </div>
      <div style={{ alignSelf: "center" }}>
        <Link href={`/mobile/jobs/${encodeURIComponent(job.job_number)}`} style={{ fontWeight: 600 }}>
          Open →
        </Link>
      </div>
    </div>
  );
}

export default function MobileDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["MOBILE TECHNICIAN", "ADMIN", "ADMIN MANAGER", "OWNER", "SERVICE MANAGER", "WORKSHOP MANAGER"]}>
      <MobileDashboardInner />
    </ProtectedRoute>
  );
}
