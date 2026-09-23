// file location: src/features/customers/hub/CustomerContactLog.js
//
// Internal notes and the contact log — "who spoke to this customer, when, and
// what was agreed". Everything is staff-only; nothing here is ever shown on the
// customer portal.
//
// Entries are rows in the existing customer_activity_events table
// (activity_type staff_contact_log / staff_note, activity_source "staff"), so
// they appear in the Activity audit trail too without a second store.

import React, { useMemo, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import EmptyState from "@/components/ui/EmptyState";
import StatusMessage from "@/components/ui/StatusMessage";
import { RecordHeading, StatusBadge, Timeline, TimelineHead } from "./RecordPrimitives";
import { CONTACT_LOG_TYPES, formatDateTime, staffName } from "@/lib/customers/customerHubModel";

const CHANNELS = [
  { value: "phone_in", label: "Phone call (inbound)" },
  { value: "phone_out", label: "Phone call (outbound)" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS / text" },
  { value: "in_person", label: "In person" },
  { value: "note", label: "Internal note (no contact)" },
];

const CHANNEL_LABELS = Object.fromEntries(CHANNELS.map((channel) => [channel.value, channel.label]));

export default function CustomerContactLog({
  activityEvents = [],
  jobs = [],
  access,
  onAddEntry,
  compact = false,
}) {
  const [channel, setChannel] = useState("phone_in");
  const [jobId, setJobId] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const jobOptions = useMemo(
    () => [
      { value: "", label: "Not about a specific job" },
      ...jobs.map((job) => ({ value: String(job.id), label: `Job ${job.job_number}` })),
    ],
    [jobs]
  );

  const entries = useMemo(
    () =>
      activityEvents
        .filter((event) => CONTACT_LOG_TYPES.has(event.activity_type))
        .map((event) => ({
          id: event.event_id,
          at: event.occurred_at,
          tone: event.activity_type === "staff_note" ? "neutral" : "accent",
          channel: event.activity_payload?.channel || null,
          note: event.activity_payload?.note || "",
          jobNumber: jobs.find((job) => String(job.id) === String(event.job_id))?.job_number || null,
          author: staffName(event.creator) || "Staff",
        }))
        .sort((a, b) => new Date(b.at) - new Date(a.at)),
    [activityEvents, jobs]
  );

  const visible = compact ? entries.slice(0, 5) : entries;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError("");
    const ok = await onAddEntry?.({
      activityType: channel === "note" ? "staff_note" : "staff_contact_log",
      payload: { channel, note: text.trim() },
      jobId: jobId ? Number(jobId) : null,
    });
    if (ok) {
      setText("");
      setJobId("");
    } else {
      setError("Could not save that entry. Try again.");
    }
    setSaving(false);
  };

  return (
    <LayerTheme as="section" sectionKey="customer-profile-contact-log" parentKey="customer-profile-tab-overview">
      <RecordHeading>{`Internal notes and contact log (${entries.length})`}</RecordHeading>

      {access?.canAddNote && (
        <LayerSurface
          as="form"
          onSubmit={handleSubmit}
          sectionKey="customer-profile-contact-log-form"
          parentKey="customer-profile-contact-log"
        >
          {error && <StatusMessage tone="danger">{error}</StatusMessage>}

          <div className="app-filter-bar">
            <div className="app-filter-bar__controls">
              <DropdownField
                label="Contact type"
                value={channel}
                options={CHANNELS}
                onChange={(event) => setChannel(event.target.value)}
              />
              <DropdownField
                label="Related job"
                value={jobId}
                options={jobOptions}
                onChange={(event) => setJobId(event.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <label className="app-record-field__label" htmlFor="customer-contact-log-text">
              What was said or agreed
            </label>
            <textarea
              id="customer-contact-log-text"
              className="app-input app-input--textarea"
              rows={3}
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={saving}
              placeholder="Called to confirm the courtesy car for Thursday — customer happy to leave the keys with reception."
            />
          </div>

          <div className="app-record-actions">
            <Button type="submit" variant="primary" size="sm" disabled={saving || !text.trim()}>
              {saving ? "Saving…" : "Add to log"}
            </Button>
          </div>
        </LayerSurface>
      )}

      {visible.length === 0 ? (
        <EmptyState
          variant="bare"
          icon="🗒️"
          title="Nothing logged yet"
          description="Record calls, emails and agreements here so the next person picking up the phone has the full picture."
        />
      ) : (
        <LayerSurface as="div" sectionKey="customer-profile-contact-log-list" parentKey="customer-profile-contact-log">
          <Timeline
            entries={visible}
            renderEntry={(entry) => (
              <>
                <TimelineHead
                  title={CHANNEL_LABELS[entry.channel] || "Contact logged"}
                  time={formatDateTime(entry.at)}
                  badge={
                    <>
                      <StatusBadge tone="neutral">{entry.author}</StatusBadge>
                      {entry.jobNumber && <StatusBadge tone="accent-soft">{`Job ${entry.jobNumber}`}</StatusBadge>}
                    </>
                  }
                />
                {entry.note && <p className="app-record-note">{entry.note}</p>}
              </>
            )}
          />
          {compact && entries.length > visible.length && (
            <p className="app-record-note">
              {`Showing the ${visible.length} most recent of ${entries.length} — the Activity tab has the rest.`}
            </p>
          )}
        </LayerSurface>
      )}
    </LayerTheme>
  );
}
