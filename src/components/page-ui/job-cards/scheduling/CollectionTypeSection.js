// file location: src/components/page-ui/job-cards/scheduling/CollectionTypeSection.js
// Scheduling dashboard → Collection Type.
// "Waiting / Loan Car / Collection / Neither" selector (persists to the job's
// waiting_status via the existing logistics handler). Below it, a conditional
// detail panel derived from real data already on the job:
//   Loan Car   → the loan-car details recorded on the booking request
//   Waiting    → "waiting from" = the appointment time
//   Collection → "collect by" = the booking ETA, else appointment time
//   Neither    → nothing
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

const WAITING_OPTIONS = ["Waiting", "Loan Car", "Collection", "Neither"];

const labelStyle = {
  fontSize: "var(--text-label)",
  fontWeight: 600,
  color: "var(--text-1)",
  opacity: 0.65,
};
const valueStyle = { fontSize: "14px", fontWeight: 600, color: "var(--text-1)" };

const formatAppointment = (appointment) => {
  if (!appointment?.date) return null;
  const time = appointment.time ? ` at ${appointment.time}` : "";
  const dt = new Date(`${appointment.date}T${appointment.time || "00:00"}`);
  if (Number.isNaN(dt.getTime())) return `${appointment.date}${time}`;
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }) + time;
};

const formatDateTime = (value) => {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const DetailRow = ({ label, value }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
    <span style={labelStyle}>{label}</span>
    <span style={valueStyle}>{value}</span>
  </div>
);

export default function CollectionTypeSection({
  waitingStatus,
  canEdit = false,
  onSelect = () => {},
  jobData,
}) {
  const active = waitingStatus || "Neither";
  const appointmentText = formatAppointment(jobData?.appointment);
  const loanCarDetails = jobData?.bookingRequest?.loanCarDetails || "";
  const collectBy =
    formatDateTime(jobData?.bookingRequest?.estimatedCompletion) || appointmentText;

  const renderDetail = () => {
    if (active === "Loan Car") {
      return (
        <DetailRow
          label="Loan car"
          value={loanCarDetails || "No loan car details recorded yet."}
        />
      );
    }
    if (active === "Waiting") {
      return (
        <DetailRow
          label="Waiting from"
          value={appointmentText || "No appointment time set."}
        />
      );
    }
    if (active === "Collection") {
      return (
        <DetailRow label="Collect by" value={collectBy || "No collection time set."} />
      );
    }
    return (
      <span style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.55 }}>
        No collection arrangement required.
      </span>
    );
  };

  return (
    <LayerSurface
      sectionKey="jobcard-scheduling-collection"
      sectionType="content-card"
      parentKey="jobcard-tab-scheduling"
      style={{ gap: "14px" }}
    >
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
        Collection Type
      </h3>

      {/* Reuses the canonical tab strip family (same as the main job tabs). */}
      <div
        className="tab-scroll-row"
        role="tablist"
        style={{
          backgroundColor: "var(--tab-container-bg)",
          borderRadius: "var(--radius-sm)",
          padding: "8px",
        }}
      >
        {WAITING_OPTIONS.map((option) => {
          const isActive = active === option;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              className={`tab-api__item${isActive ? " is-active" : ""}`}
              onClick={() => onSelect(option)}
              disabled={!canEdit}
              aria-selected={isActive}
            >
              {option}
            </button>
          );
        })}
      </div>

      <LayerTheme
        sectionKey="jobcard-scheduling-collection-detail"
        sectionType="content-card"
        parentKey="jobcard-scheduling-collection"
        style={{ gap: "8px" }}
      >
        {renderDetail()}
      </LayerTheme>
    </LayerSurface>
  );
}
