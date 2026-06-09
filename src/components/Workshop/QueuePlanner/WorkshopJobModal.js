// file location: src/components/Workshop/QueuePlanner/WorkshopJobModal.js
// Job details modal for the Workshop Queue Planner. Opened when a controller
// clicks any queue / clocked-in / unassigned card. Renders the full operational
// summary (vehicle, customer, timing, allocation, VHC + parts status, requests)
// plus the quick-action row. The surface uses the canonical <LayerSurface>
// primitive (CLAUDE.md §3.0) inside the global `.popup-backdrop`.
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import styles from "./WorkshopQueuePlanner.module.css";
import { getStatusMeta } from "./workshopQueueHelpers";

// Let the shared buttons grow to fill the action row evenly.
const btnFlex = { flex: "1 1 auto", minWidth: "120px" };

const Field = ({ label, value, wide }) => (
  <div className={`${styles.field} ${wide ? styles.fieldWide : ""}`}>
    <div className={styles.fieldLabel}>{label}</div>
    <div className={styles.fieldValue}>{value || "—"}</div>
  </div>
);

export default function WorkshopJobModal({
  job,
  feedback,
  onClose,
  onOpenJobCard,
  onUnassign,
  onQuickAction,
  estimateJobHours,
  deriveJobTypeLabel,
  formatAppointmentTime,
  getJobRequestItems,
}) {
  if (!job) return null;

  const statusMeta = getStatusMeta(job.status);
  const vehicle = [job.make, job.model].filter(Boolean).join(" ") || job.makeModel || "Vehicle TBC";
  const technician = job.assignedTech?.name || job.technician || "Unassigned";
  const role = (job.assignedTech?.role || job.technicianRole || "").toLowerCase();
  const motAssigned = role.includes("mot") ? technician : job.motTester || "Not assigned";
  const bookingTime = formatAppointmentTime ? formatAppointmentTime(job) : "";
  const estHours = estimateJobHours ? estimateJobHours(job) : 0;
  const requests = getJobRequestItems ? getJobRequestItems(job) : [];

  const vhcCount = Array.isArray(job.vhcChecks) ? job.vhcChecks.length : 0;
  const vhcStatus = job.vhcRequired
    ? vhcCount > 0
      ? `${vhcCount} item${vhcCount === 1 ? "" : "s"} recorded`
      : "Required — not started"
    : "Not required";
  const partsStatus = job.partsStatus || job.parts_status || "—";

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "560px", maxHeight: "90vh", overflow: "hidden" }}>
        <LayerSurface
          className="popup-card"
          sectionKey="workshop-queue-job-modal"
          sectionType="content-card"
          backgroundToken="surface"
          radius="var(--radius-xl)"
          padding="28px"
          style={{ width: "100%", maxHeight: "90vh", overflowY: "auto", position: "relative" }}
        >
          <h3 className={styles.modalTitle}>#{job.jobNumber}</h3>
          <p className={styles.modalSub}>
            {vehicle} · {job.reg || "Reg TBC"} · {statusMeta.label}
          </p>

          {feedback && (
            <div
              className={`${styles.feedback} ${
                feedback.type === "error"
                  ? styles.feedbackError
                  : feedback.type === "success"
                  ? styles.feedbackSuccess
                  : styles.feedbackInfo
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className={styles.fieldGrid}>
            <Field label="Registration" value={job.reg} />
            <Field label="Vehicle" value={vehicle} />
            <Field label="Customer" value={job.customer || "Unknown customer"} />
            <Field label="Phone" value={job.customerPhone} />
            <Field label="Booking Time" value={bookingTime && bookingTime !== "No appointment" ? bookingTime : "—"} />
            <Field label="Estimated Time" value={estHours ? `${estHours.toFixed(estHours % 1 === 0 ? 0 : 1)} hrs` : "—"} />
            <Field label="Service Type" value={deriveJobTypeLabel ? deriveJobTypeLabel(job) : job.type} />
            <Field label="Status" value={statusMeta.label} />
            <Field label="Technician" value={technician} />
            <Field label="MOT Assigned" value={motAssigned} />
            <Field label="VHC Status" value={vhcStatus} />
            <Field label="Parts Status" value={partsStatus} />

            <div className={`${styles.field} ${styles.fieldWide}`}>
              <div className={styles.fieldLabel}>Customer Requests</div>
              {requests.length > 0 ? (
                <div className={styles.requestList}>
                  {requests.map((request, index) => (
                    <div key={request.id} className={styles.requestRow}>
                      <span className={styles.requestNum}>{index + 1}.</span>
                      <span>{request.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.fieldValue}>No requests recorded.</div>
              )}
            </div>
          </div>

          {/* Quick actions use the shared `.app-btn` family — no bespoke styles. */}
          <div className={styles.modalActions}>
            <button type="button" className="app-btn app-btn--primary" style={btnFlex} onClick={onOpenJobCard}>
              Open Job Card
            </button>
            <button type="button" className="app-btn app-btn--secondary" style={btnFlex} onClick={() => onQuickAction?.("assign")}>
              Assign Technician
            </button>
            <button type="button" className="app-btn app-btn--secondary" style={btnFlex} onClick={() => onQuickAction?.("move")}>
              Move Position
            </button>
            <button type="button" className="app-btn app-btn--secondary" style={btnFlex} onClick={() => onQuickAction?.("ready")}>
              Mark Ready
            </button>
            {job.assignedTech && (
              <button type="button" className="app-btn app-btn--danger" style={btnFlex} onClick={onUnassign}>
                Unassign
              </button>
            )}
            <button type="button" className="app-btn app-btn--ghost" style={btnFlex} onClick={onClose}>
              Close
            </button>
          </div>
        </LayerSurface>
      </div>
    </div>
  );
}
