// file location: src/pages/mobile/jobs/[jobNumber].js
// Mobile-optimised job card: key details, parts request shortcut, complete/redirect actions.

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import ServiceModeBadge from "@/components/mobile/ServiceModeBadge";
import RedirectToWorkshopButton from "@/components/mobile/RedirectToWorkshopButton";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import { showAlert } from "@/lib/notifications/alertBus";
import PageUi from "@/components/page-ui/mobile/jobs/mobile-jobs-job-number-ui"; // Extracted presentation layer.

const pageStyle = { padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "720px" };
const cardStyle = {
  backgroundColor: "var(--section-card-bg, #fff)",
  borderRadius: "var(--section-card-radius, 12px)",
  padding: "16px",
  border: "var(--section-card-border, 1px solid rgba(15,23,42,0.08))"
};

const primaryButtonStyle = {
  padding: "10px 16px",
  borderRadius: "8px",
  border: "none",
  background: "var(--success, #16a34a)",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer"
};

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: "var(--info, #3b82f6)"
};

function MobileJobCardInner() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!jobNumber) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/mobile/jobs/${encodeURIComponent(jobNumber)}`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const body = await res.json();
      setJob(body.job);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [jobNumber]);

  useEffect(() => {reload();}, [reload]);

  async function complete() {
    const notes = window.prompt("Completion notes (optional):", "");
    if (notes === null) return;
    const res = await fetch(`/api/mobile/jobs/${encodeURIComponent(jobNumber)}/complete-onsite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes })
    });
    if (res.ok) {
      showAlert("Job completed on-site.", "success");
      router.push(`/mobile/delivery/${encodeURIComponent(jobNumber)}`);
    } else {
      const b = await res.json().catch(() => ({}));
      showAlert(b.message || "Failed", "error");
    }
  }

  async function unable() {
    const reason = window.prompt("Why can't the job be completed?", "");
    if (!reason) return;
    const followUp = window.confirm("Needs a follow-up visit? Cancel = just flag unable.");
    const res = await fetch(`/api/mobile/jobs/${encodeURIComponent(jobNumber)}/unable-to-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, followUp })
    });
    if (res.ok) {
      showAlert("Status recorded.", "success");
      reload();
    } else {
      const b = await res.json().catch(() => ({}));
      showAlert(b.message || "Failed", "error");
    }
  }

  async function requestParts() {
    const description = window.prompt("Part description:");
    if (!description) return;
    const qty = Number(window.prompt("Quantity:", "1")) || 1;
    const res = await fetch("/api/mobile/parts-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobNumber, description, quantity: qty })
    });
    if (res.ok) showAlert("Parts request submitted.", "success");else
    {
      const b = await res.json().catch(() => ({}));
      showAlert(b.message || "Failed", "error");
    }
  }

  if (loading) {
    // Shell-first: render header + 2 content sections as structured skeletons so
    // the user sees the final shape immediately, not a text placeholder.
    return (
      <div style={pageStyle}>
        <SkeletonKeyframes />
        <header style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <SkeletonBlock width="80px" height="14px" />
          <SkeletonBlock width="140px" height="22px" />
          <SkeletonBlock width="64px" height="18px" borderRadius="999px" />
        </header>
        <section style={cardStyle}>
          <SkeletonBlock width="60%" height="16px" />
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <SkeletonBlock width="80%" height="12px" />
            <SkeletonBlock width="70%" height="12px" />
            <SkeletonBlock width="65%" height="12px" />
          </div>
        </section>
        <section style={cardStyle}>
          <SkeletonBlock width="40%" height="16px" />
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <SkeletonBlock width="90%" height="12px" />
            <SkeletonBlock width="85%" height="12px" />
            <SkeletonBlock width="60%" height="12px" />
          </div>
        </section>
      </div>);

  }
  if (error) return <div style={pageStyle}><p style={{ color: "var(--danger)" }}>{error}</p></div>;
  if (!job) return <div style={pageStyle}><p>Not found.</p></div>;

  return (
    <div style={pageStyle}>
      <header style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <Link href="/mobile/dashboard">← Back</Link>
        <h1 style={{ margin: 0 }}>{job.job_number}</h1>
        <ServiceModeBadge mode={job.service_mode} />
        <span style={{ color: "var(--text-1)" }}>{job.status}</span>
      </header>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Vehicle & customer</h2>
        <p><strong>{job.vehicle_reg}</strong> — {job.vehicle_make_model}</p>
        <p>
          {job.customer?.first_name} {job.customer?.last_name} · {job.service_contact_phone || job.customer?.phone}
        </p>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>On-site visit</h2>
        <p><strong>Address:</strong> {job.service_address} {job.service_postcode}</p>
        <p><strong>Window:</strong> {job.appointment_window_start ? new Date(job.appointment_window_start).toLocaleString() : "—"}
          {job.appointment_window_end ? ` → ${new Date(job.appointment_window_end).toLocaleTimeString()}` : ""}
        </p>
        {job.access_notes && <p><strong>Access notes:</strong> {job.access_notes}</p>}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Work</h2>
        <p>{job.description || "No description"}</p>
        {job.mobile_outcome &&
        <p><strong>Outcome:</strong> {job.mobile_outcome.replace(/_/g, " ")}</p>
        }
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Actions</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <button type="button" style={primaryButtonStyle} onClick={complete}>Complete on-site</button>
          <button type="button" style={secondaryButtonStyle} onClick={requestParts}>Request parts</button>
          <button type="button" onClick={unable} style={{ ...secondaryButtonStyle, background: "var(--warning, #f59e0b)" }}>
            Unable to complete
          </button>
          <RedirectToWorkshopButton jobNumber={job.job_number} onRedirected={() => router.push("/mobile/dashboard")} />
        </div>
      </section>

      <section style={cardStyle}>
        <Link href={`/job-cards/${encodeURIComponent(job.job_number)}`}>
          Open full job card (notes, parts, VHC)
        </Link>
      </section>
    </div>);

}

export default function Page() {
  return <PageUi view="section1" MobileJobCardInner={MobileJobCardInner} ProtectedRoute={ProtectedRoute} />;




}
