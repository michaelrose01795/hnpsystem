// file location: src/pages/mobile/appointments.js
// Mobile-specific appointment list, grouped by day. Separate from workshop booking views
// so advisors and techs can filter mobile-only visits cleanly.

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import ServiceModeBadge from "@/components/mobile/ServiceModeBadge";

const pageStyle = { padding: "16px", display: "flex", flexDirection: "column", gap: "14px" };
const cardStyle = {
  backgroundColor: "var(--section-card-bg, #fff)",
  borderRadius: "var(--section-card-radius, 12px)",
  padding: "16px",
  border: "var(--section-card-border, 1px solid rgba(15,23,42,0.08))",
};

function groupByDay(jobs) {
  const groups = new Map();
  jobs.forEach((j) => {
    const key = j.appointment_window_start ? j.appointment_window_start.slice(0, 10) : "unscheduled";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(j);
  });
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function MobileAppointmentsInner() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mobile/jobs").then((r) => r.json()).then((b) => {
      setJobs(b.jobs || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => groupByDay(jobs), [jobs]);

  return (
    <div style={pageStyle}>
      <h1 style={{ margin: 0 }}>Mobile Appointments</h1>
      {loading ? <p>Loading…</p> : grouped.length === 0 ? (
        <p>No mobile appointments scheduled.</p>
      ) : grouped.map(([day, list]) => (
        <section key={day} style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>
            {day === "unscheduled" ? "Unscheduled" : new Date(day).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}
          </h2>
          {list.map((j) => (
            <div key={j.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <Link href={`/mobile/jobs/${encodeURIComponent(j.job_number)}`}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <strong>{j.job_number}</strong>
                  <ServiceModeBadge mode="mobile" />
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    {j.appointment_window_start ? new Date(j.appointment_window_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    {j.appointment_window_end ? ` → ${new Date(j.appointment_window_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </span>
                </div>
                <div style={{ fontSize: "0.9rem" }}>{j.vehicle_reg} · {j.service_address} {j.service_postcode}</div>
              </Link>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={["MOBILE TECHNICIAN", "ADMIN", "ADMIN MANAGER", "OWNER", "SERVICE MANAGER", "WORKSHOP MANAGER"]}>
      <MobileAppointmentsInner />
    </ProtectedRoute>
  );
}
