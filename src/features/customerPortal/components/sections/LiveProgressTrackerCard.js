// file location: src/features/customerPortal/components/sections/LiveProgressTrackerCard.js
// Compact live tracker showing the customer's latest open workshop job.
import React from "react";
import SectionShell from "./SectionShell";
import { Tile, SubHeader, Badge, ProgressBar, Field, FieldGrid, Empty } from "./_websiteParts";

const doneStatuses = ["delivered", "closed", "completed", "collected", "invoiced"];

const isOpenJob = (job) => {
  const status = String(job.status || job.completion_status || "").toLowerCase();
  return !doneStatuses.some((token) => status.includes(token)) && !job.completed_at;
};

const getProgressPct = (job) => {
  const checks = [
    job.created_at,
    job.checked_in_at,
    job.workshop_started_at,
    job.vhc_required ? job.vhc_completed_at : true,
    job.wash_started_at || job.wash_completed_by,
    job.completed_at,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
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

export default function LiveProgressTrackerCard({ jobs = [], customer }) {
  const active = (jobs || []).find(isOpenJob);
  const contactPreference = String(customer?.contact_preference || "").toLowerCase();
  const smsEnabled = ["sms", "text", "phone"].includes(contactPreference) || Boolean(customer?.mobile);
  const emailEnabled = contactPreference === "email" || Boolean(customer?.email);

  return (
    <SectionShell id="tracker" eyebrow="Tracker" title="Live progress">
      {!active ? (
        <Empty>No active workshop job is currently linked to this account.</Empty>
      ) : (
        <Tile padding={16}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--txt-bright)" }}>
              {active.job_number || active.id}
            </span>
            <Badge tone="open">{active.status || "Booked"}</Badge>
            {active.service_mode === "mobile" ? <Badge tone="ok">Mobile service</Badge> : null}
            {String(active.status || "").toLowerCase().includes("ready") ? <Badge tone="ok">Ready for collection</Badge> : null}
          </div>
          <ProgressBar pct={getProgressPct(active)} />
          <FieldGrid>
            <Field label="Vehicle" value={active.vehicle_reg || active.vehicle_make_model} />
            <Field label="Job type" value={active.type || active.description} />
            <Field label="Service postcode" value={active.service_postcode} />
          </FieldGrid>
          <div>
            <SubHeader>Notifications</SubHeader>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
              <NotificationDot enabled={smsEnabled} label="SMS" />
              <NotificationDot enabled={emailEnabled} label="Email" />
              <NotificationDot enabled={false} label="Push" />
            </div>
          </div>
        </Tile>
      )}
    </SectionShell>
  );
}
