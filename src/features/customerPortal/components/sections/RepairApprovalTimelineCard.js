// file location: src/features/customerPortal/components/sections/RepairApprovalTimelineCard.js
// Linear repair lifecycle for the active job: diagnostics → approval → parts
// → repairs → QC → wash → ready. Per-stage timestamps aren't yet exposed via
// the portal API, so mock until job_status_history is surfaced.
import React from "react";
import SectionShell from "./SectionShell";
import { Tile, Tracker } from "./_websiteParts";

const STAGES = [
  { key: "diagnostics", label: "Diagnostics" },
  { key: "approval", label: "Approval" },
  { key: "parts", label: "Parts" },
  { key: "repairs", label: "Repairs" },
  { key: "qc", label: "QC" },
  { key: "wash", label: "Wash" },
  { key: "ready", label: "Ready" },
];

const MOCK_EVENTS = {
  jobNumber: "JOB-22481",
  vehicle: "BMW 3 Series · DEMO123",
  events: {
    diagnostics: { at: "Mon 09:42", note: "Workshop confirmed worn pads + advisory tyres." },
    approval: { at: "Mon 11:18", note: "You approved £612 (pads + 2 rear tyres)." },
    parts: { at: "Mon 11:55", note: "Parts ordered from main supplier." },
    repairs: { at: "Tue 08:30", note: "Technician started work." },
    qc: { at: "Tue 14:12", note: "QC checks complete." },
    wash: { at: "Tue 15:01", note: "Vehicle washed & vacuumed." },
    ready: null,
  },
};

export default function RepairApprovalTimelineCard() {
  const job = MOCK_EVENTS;
  const reached = STAGES.findIndex((s) => !job.events?.[s.key]);
  const activeIndex = reached === -1 ? STAGES.length - 1 : reached;
  return (
    <SectionShell
      id="tracker-timeline"
      eyebrow="Live repair"
      title="Repair approval timeline"
      todo={{
        label: "Per-stage timestamps not exposed via portal API yet",
        detail: "job_status_history is captured server-side; once the bundle exposes per-stage timestamps, real data replaces the mock.",
      }}
    >
      <Tile padding={16}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--txt-bright)" }}>{job.jobNumber}</span>
          <span style={{ fontSize: 12, color: "var(--txt-soft)" }}>{job.vehicle}</span>
        </div>
        <Tracker stages={STAGES} activeIndex={activeIndex} />
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {STAGES.map((s) => {
            const e = job.events?.[s.key];
            return (
              <li
                key={s.key}
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
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--txt-bright)" }}>{s.label}</span>
                  {e?.note ? (
                    <span style={{ fontSize: 12, color: "var(--txt-soft)" }}>{e.note}</span>
                  ) : null}
                </div>
                <span style={{ fontSize: 11, color: "var(--txt-mute)", whiteSpace: "nowrap" }}>
                  {e?.at || "Pending"}
                </span>
              </li>
            );
          })}
        </ul>
      </Tile>
    </SectionShell>
  );
}
