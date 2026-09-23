// file location: src/components/page-ui/job-cards/jobSettings/AuditSection.js
//
// Job Card Settings → Audit. Read-only.
//
// This is the job's existing audit trail, not a new one: the status snapshot
// the page already loads (/api/status/snapshot → buildJobStatusSnapshot) merges
// job_status_history (with each change's reason) and job_activity_events,
// resolves who made each change, and adds the booking / check-in milestones.
// Every change made from this popup lands in those same tables.

import React, { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { StatusBadge, Timeline, TimelineHead } from "@/features/customers/hub/RecordPrimitives";
import {
  LockedNotice,
  SettingsCard,
  SettingsField,
  formatSettingsDateTime,
} from "@/components/page-ui/job-cards/jobSettings/settingsParts";

const PAGE_SIZE = 30;

const FILTERS = [
  { value: "all", label: "All activity" },
  { value: "status", label: "Status and workflow" },
  { value: "job", label: "Job card changes" },
  { value: "vhc", label: "VHC and health check" },
  { value: "parts", label: "Parts" },
  { value: "files", label: "Documents" },
];

const categoryOf = (entry) => entry?.metadata?.meta?.category || null;

const matchesFilter = (entry, filter) => {
  if (filter === "all") return true;
  const category = categoryOf(entry);
  if (filter === "status") return entry.kind === "status" || (!category && entry.type !== "workflow_event");
  if (filter === "vhc") return category === "vhc" || category === "health_check";
  return category === filter;
};

const toneOf = (entry) => {
  const text = `${entry.label || ""} ${entry.metadata?.meta?.action || ""}`.toLowerCase();
  if (/cancel|override|reopen|deleted|removed|declin/.test(text)) return "danger";
  if (entry.kind === "status") return "success";
  if (/waiting|pending/.test(text)) return "warning";
  return "neutral";
};

export default function AuditSection({ ctx }) {
  const { statusTimeline, isArchiveMode } = ctx;
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const entries = useMemo(
    () =>
      (Array.isArray(statusTimeline) ? statusTimeline : [])
        .filter((entry) => entry?.at || entry?.timestamp)
        .filter((entry) => matchesFilter(entry, filter))
        .slice()
        .sort((a, b) => new Date(b.at || b.timestamp).getTime() - new Date(a.at || a.timestamp).getTime()),
    [statusTimeline, filter]
  );

  const visible = entries.slice(0, limit).map((entry, index) => ({
    ...entry,
    id: entry.id || `${entry.at}-${index}`,
    tone: toneOf(entry),
  }));

  return (
    <SettingsCard sectionKey="jobcard-settings-audit" title="Audit history">
      {isArchiveMode ? (
        <LockedNotice tone="info">
          The archived copy keeps its history inside the archive snapshot; the live audit trail is shown on the job
          card before archiving.
        </LockedNotice>
      ) : null}
      <SettingsField id="job-settings-audit-filter" label="Show">
        <DropdownField
          id="job-settings-audit-filter"
          options={FILTERS}
          value={filter}
          onValueChange={(value) => {
            setFilter(value);
            setLimit(PAGE_SIZE);
          }}
        />
      </SettingsField>
      {visible.length ? (
        <Timeline
          entries={visible}
          renderEntry={(entry) => (
            <>
              <TimelineHead
                title={entry.label || entry.to || "Update"}
                time={formatSettingsDateTime(entry.at || entry.timestamp)}
                badge={entry.department ? <StatusBadge tone="neutral">{entry.department}</StatusBadge> : null}
              />
              <p className="app-timeline__meta">
                {entry.actorName || entry.userName || "System"}
                {entry.reason ? ` · ${entry.reason}` : ""}
              </p>
            </>
          )}
        />
      ) : (
        <p className="app-record-note">
          {isArchiveMode ? "No live history to show." : "No recorded activity matches this filter yet."}
        </p>
      )}
      {entries.length > limit ? (
        <div className="app-record-actions">
          <Button type="button" variant="secondary" size="sm" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, entries.length - limit)} more
          </Button>
        </div>
      ) : null}
    </SettingsCard>
  );
}
