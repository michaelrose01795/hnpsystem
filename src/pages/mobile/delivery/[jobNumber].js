// file location: src/pages/mobile/delivery/[jobNumber].js
// Post-visit completion/handover screen for mobile jobs. Presents the outcome summary and
// lets the technician finalise the visit (completed, follow-up, redirect).

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import ServiceModeBadge from "@/components/mobile/ServiceModeBadge";
import RedirectToWorkshopButton from "@/components/mobile/RedirectToWorkshopButton";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";

const pageStyle = { padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "720px" };
const cardStyle = {
  backgroundColor: "var(--section-card-bg, #fff)",
  borderRadius: "var(--section-card-radius, 12px)",
  padding: "16px",
  border: "var(--section-card-border, 1px solid rgba(15,23,42,0.08))",
};

function OUTCOME_LABEL(outcome) {
  switch (outcome) {
    case "completed_onsite": return "✅ Completed on-site";
    case "follow_up_required": return "🔁 Follow-up required";
    case "redirected_to_workshop": return "🏭 Redirected to workshop";
    case "unable_to_complete": return "⚠️ Unable to complete";
    default: return "Pending completion";
  }
}

function DeliveryInner() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [job, setJob] = useState(null);

  const load = useCallback(() => {
    if (!jobNumber) return;
    fetch(`/api/mobile/jobs/${encodeURIComponent(jobNumber)}`)
      .then((r) => r.json())
      .then((b) => setJob(b.job || null));
  }, [jobNumber]);

  useEffect(() => { load(); }, [load]);

  if (!job) {
    return (
      <div style={pageStyle}>
        <SkeletonKeyframes />
        <header style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <SkeletonBlock width="100px" height="14px" />
          <SkeletonBlock width="180px" height="22px" />
          <SkeletonBlock width="64px" height="18px" borderRadius="999px" />
        </header>
        <section style={cardStyle}>
          <SkeletonBlock width="40%" height="16px" />
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <SkeletonBlock width="70%" height="12px" />
            <SkeletonBlock width="80%" height="12px" />
            <SkeletonBlock width="60%" height="12px" />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <header style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <Link href={`/mobile/jobs/${encodeURIComponent(jobNumber)}`}>← Back to job</Link>
        <h1 style={{ margin: 0 }}>Delivery & Completion</h1>
        <ServiceModeBadge mode="mobile" />
      </header>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>{job.job_number}</h2>
        <p><strong>Outcome:</strong> {OUTCOME_LABEL(job.mobile_outcome)}</p>
        {job.mobile_completed_at && (
          <p><strong>Completed at:</strong> {new Date(job.mobile_completed_at).toLocaleString()}</p>
        )}
        <p><strong>Vehicle:</strong> {job.vehicle_reg} — {job.vehicle_make_model}</p>
        <p><strong>Site:</strong> {job.service_address} {job.service_postcode}</p>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Next steps</h2>
        {job.mobile_outcome === "completed_onsite" && <p>All done. Customer notified via the normal status flow.</p>}
        {job.mobile_outcome === "follow_up_required" && (
          <p>A follow-up visit is required. Service office will reschedule via the appointments board.</p>
        )}
        {job.mobile_outcome === "redirected_to_workshop" && (
          <p>This job is now in the workshop queue. No further mobile action needed.</p>
        )}
        {(!job.mobile_outcome || job.mobile_outcome === "unable_to_complete") && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <RedirectToWorkshopButton jobNumber={job.job_number} onRedirected={load} />
            <Link href={`/mobile/jobs/${encodeURIComponent(jobNumber)}`}>Back to job actions →</Link>
          </div>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={["MOBILE TECHNICIAN", "ADMIN", "ADMIN MANAGER", "OWNER", "SERVICE MANAGER", "WORKSHOP MANAGER"]}>
      <DeliveryInner />
    </ProtectedRoute>
  );
}
