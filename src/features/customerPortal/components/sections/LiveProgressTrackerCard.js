// file location: src/features/customerPortal/components/sections/LiveProgressTrackerCard.js
// Compact live tracker showing the active job's stage, ETA, courtesy car,
// and notification state. Falls back to mock content if no active job.
import React from "react";
import SectionShell from "./SectionShell";
import { Stack, Tile, SubHeader, Badge, ProgressBar, Field, FieldGrid } from "./_websiteParts";

const MOCK = {
  jobNumber: "JOB-22481",
  status: "In workshop",
  stagePct: 64,
  eta: "Tomorrow ~ 15:30",
  mobileService: false,
  courtesyCar: "Ford Fiesta · DEMO-COURT",
  collectionReady: false,
  notifications: { sms: true, email: true, push: false },
};

function NotificationDot({ enabled, label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: enabled ? "var(--txt-bright)" : "var(--txt-mute)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: enabled ? "#58c790" : "rgba(255,255,255,0.18)",
        }}
      />
      {label}
    </span>
  );
}

export default function LiveProgressTrackerCard({ jobs = [] }) {
  const active = (jobs || []).find(
    (j) => !["delivered", "closed", "completed"].includes(String(j.status || "").toLowerCase())
  );
  const job = active
    ? {
        jobNumber: active.jobNumber || active.id,
        status: active.status || "In workshop",
        stagePct: active.progressPct ?? 50,
        eta: active.eta || "ETA TBC",
        mobileService: active.mobileService || false,
        courtesyCar: active.courtesyCar?.makeModel
          ? `${active.courtesyCar.makeModel} · ${active.courtesyCar.reg || ""}`
          : null,
        collectionReady: ["ready", "collection"].includes(String(active.status || "").toLowerCase()),
        notifications: active.notifications || { sms: false, email: false, push: false },
      }
    : MOCK;

  return (
    <SectionShell
      id="tracker"
      eyebrow="Tracker"
      title="Live progress"
      todo={active ? null : { label: "No active workshop job to render" }}
    >
      <Tile padding={16}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--txt-bright)" }}>
            {job.jobNumber}
          </span>
          <Badge tone="open">{job.status}</Badge>
          {job.mobileService ? <Badge tone="ok">Mobile service</Badge> : null}
          {job.collectionReady ? <Badge tone="ok">Ready for collection</Badge> : null}
        </div>
        <ProgressBar pct={job.stagePct} />
        <FieldGrid>
          <Field label="ETA" value={job.eta} />
          {job.courtesyCar ? <Field label="Courtesy car" value={job.courtesyCar} /> : null}
        </FieldGrid>
        <div>
          <SubHeader>Notifications</SubHeader>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            <NotificationDot enabled={job.notifications.sms} label="SMS" />
            <NotificationDot enabled={job.notifications.email} label="Email" />
            <NotificationDot enabled={job.notifications.push} label="Push" />
          </div>
        </div>
      </Tile>
    </SectionShell>
  );
}
