// file location: src/pages/mobile/jobs/index.js
// List page for mobile technicians showing every assigned mobile job.

import React, { useEffect, useState } from "react";
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

function MobileJobsInner() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mobile/jobs").then((r) => r.json()).then((b) => {
      setJobs(b.jobs || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={pageStyle}>
      <h1 style={{ margin: 0 }}>My Mobile Jobs</h1>
      {loading ? <p>Loading…</p> : (
        <div style={cardStyle}>
          {jobs.length === 0 ? <p>No mobile jobs assigned.</p> : jobs.map((j) => (
            <div key={j.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <Link href={`/mobile/jobs/${encodeURIComponent(j.job_number)}`}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <strong>{j.job_number}</strong>
                  <ServiceModeBadge mode="mobile" />
                  <span style={{ color: "var(--text-secondary)" }}>{j.status}</span>
                </div>
                <div style={{ fontSize: "0.9rem" }}>{j.vehicle_reg} · {j.vehicle_make_model}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  {j.service_address} {j.service_postcode}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={["MOBILE TECHNICIAN", "ADMIN", "ADMIN MANAGER", "OWNER", "SERVICE MANAGER", "WORKSHOP MANAGER"]}>
      <MobileJobsInner />
    </ProtectedRoute>
  );
}
