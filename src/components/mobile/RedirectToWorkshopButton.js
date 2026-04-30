// file location: src/components/mobile/RedirectToWorkshopButton.js
// Action for mobile techs to send a job back to the workshop. Collects a reason
// and hits the mobile redirect API. Preserves job history — no duplicate created.

import React, { useState } from "react";
import { showAlert } from "@/lib/notifications/alertBus";

const buttonStyle = {
  padding: "10px 16px",
  borderRadius: "var(--control-radius, 8px)",
  border: "none",
  background: "var(--warning, #f59e0b)",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle = {
  background: "var(--surface, #fff)",
  padding: "20px",
  borderRadius: "var(--radius-lg, 12px)",
  width: "min(480px, 92vw)",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

export default function RedirectToWorkshopButton({ jobNumber, onRedirected }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) {
      showAlert("Please provide a reason before redirecting.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/mobile/jobs/${encodeURIComponent(jobNumber)}/redirect-to-workshop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Redirect failed");
      }
      showAlert(`Job ${jobNumber} sent to workshop.`, "success");
      setOpen(false);
      setReason("");
      if (typeof onRedirected === "function") onRedirected();
    } catch (err) {
      showAlert(err.message || "Redirect failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" style={buttonStyle} onClick={() => setOpen(true)}>
        Send to Workshop
      </button>
      {open && (
        <div style={modalOverlayStyle} role="dialog" aria-modal="true">
          <div style={modalStyle}>
            <h3 style={{ margin: 0 }}>Redirect {jobNumber} to workshop</h3>
            <p style={{ margin: 0, color: "var(--text-1)" }}>
              The job, its notes and parts history will be preserved. The mobile assignment will be cleared.
            </p>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Reason</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--primary-border-subtle)" }}
                placeholder="e.g. part not available on van, vehicle requires ramp access"
              />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" onClick={() => setOpen(false)} disabled={submitting}>
                Cancel
              </button>
              <button type="button" style={buttonStyle} onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Redirecting..." : "Confirm redirect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
