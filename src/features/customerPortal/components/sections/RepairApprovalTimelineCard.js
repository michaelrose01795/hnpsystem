// file location: src/features/customerPortal/components/sections/RepairApprovalTimelineCard.js
// Live repair lifecycle from job_status_history and core job timestamps.
import React from "react";
import SectionShell from "./SectionShell";
import { Tile, Tracker, Empty } from "./_websiteParts";

const STAGES = [
  { key: "booked", label: "Booked" },
  { key: "checked_in", label: "Checked in" },
  { key: "workshop", label: "Workshop" },
  { key: "vhc", label: "VHC" },
  { key: "wash", label: "Wash" },
  { key: "ready", label: "Ready" },
];

const formatDateTime = (value) => {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isOpenJob = (job) => {
  const status = String(job.status || job.completion_status || "").toLowerCase();
  return !["delivered", "closed", "completed", "collected"].some((token) => status.includes(token)) && !job.completed_at;
};

export default function RepairApprovalTimelineCard({ jobs = [], jobStatusHistory = [] }) {
  const job = jobs.find(isOpenJob) || jobs[0];
  const history = job ? jobStatusHistory.filter((row) => row.job_id === job.id) : [];
  const events = {
    booked: job?.created_at,
    checked_in: job?.checked_in_at,
    workshop: job?.workshop_started_at,
    vhc: job?.vhc_completed_at,
    wash: job?.wash_started_at || job?.wash_completed_by,
    ready: job?.completed_at,
  };
  const activeIndex = Math.max(
    0,
    STAGES.reduce((last, stage, index) => (events[stage.key] ? index : last), 0),
  );

  return (
    <SectionShell id="tracker-timeline" eyebrow="Live repair" title="Repair approval timeline">
      {!job ? (
        <Empty>No job timeline is available for this account yet.</Empty>
      ) : (
        <Tile padding={16}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--txt-bright)" }}>{job.job_number}</span>
            <span style={{ fontSize: 12, color: "var(--txt-soft)" }}>
              {[job.vehicle_make_model, job.vehicle_reg].filter(Boolean).join(" - ")}
            </span>
          </div>
          <Tracker stages={STAGES} activeIndex={activeIndex} />
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {STAGES.map((stage) => {
              const matchingHistory = history.find((row) =>
                String(row.to_status || "").toLowerCase().includes(stage.key.replace("_", " ")),
              );
              return (
                <li
                  key={stage.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 10,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--txt-bright)" }}>{stage.label}</span>
                    {matchingHistory?.reason ? (
                      <span style={{ fontSize: 12, color: "var(--txt-soft)" }}>{matchingHistory.reason}</span>
                    ) : null}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--txt-mute)", whiteSpace: "nowrap" }}>
                    {formatDateTime(events[stage.key] || matchingHistory?.changed_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Tile>
      )}
    </SectionShell>
  );
}
