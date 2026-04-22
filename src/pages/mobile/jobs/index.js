// file location: src/pages/mobile/jobs/index.js
// List page for mobile technicians showing every assigned mobile job.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import ServiceModeBadge from "@/components/mobile/ServiceModeBadge";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import PageUi from "@/components/page-ui/mobile/jobs/mobile-jobs-ui"; // Extracted presentation layer.

const pageStyle = { padding: "16px", display: "flex", flexDirection: "column", gap: "14px" };
const cardStyle = {
  backgroundColor: "var(--section-card-bg, #fff)",
  borderRadius: "var(--section-card-radius, 12px)",
  padding: "16px",
  border: "var(--section-card-border, 1px solid rgba(15,23,42,0.08))"
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
      {loading ?
      <div style={cardStyle}>
          <SkeletonKeyframes />
          {Array.from({ length: 4 }).map((_, i) =>
        <div
          key={i}
          style={{
            padding: "10px 0",
            borderBottom: "1px solid var(--border-subtle, rgba(15,23,42,0.08))",
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }}>
          
              <SkeletonBlock width="50%" height="14px" />
              <SkeletonBlock width="70%" height="10px" />
              <SkeletonBlock width="60%" height="10px" />
            </div>
        )}
        </div> :

      <div style={cardStyle}>
          {jobs.length === 0 ? <p>No mobile jobs assigned.</p> : jobs.map((j) =>
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
        )}
        </div>
      }
    </div>);

}

export default function Page() {
  return <PageUi view="section1" MobileJobsInner={MobileJobsInner} ProtectedRoute={ProtectedRoute} />;




}
