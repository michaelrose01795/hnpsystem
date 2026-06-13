// file location: src/components/page-ui/job-cards/scheduling/CustomerUpdatesSection.js
// Scheduling dashboard → Customer Updates.
// "Last updated" is derived (read-only) from the latest customer-visible
// message on the job's messaging thread. "Next update due" is editable and
// persists to jobs.next_update_due via POST /api/job-cards/[jobNumber]/next-update.
import React, { useEffect, useMemo, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { CalendarField } from "@/components/ui/calendarAPI";
import { TimePickerField } from "@/components/ui/timePickerAPI";

const labelStyle = {
  fontSize: "var(--text-label)",
  fontWeight: 600,
  color: "var(--text-1)",
  opacity: 0.65,
};

const splitIso = (iso) => {
  if (!iso) return { date: "", time: "" };
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { date: "", time: "" };
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
};

export default function CustomerUpdatesSection({
  jobData,
  jobNumber,
  canEdit = false,
  onRefreshJob = () => {},
}) {
  const initial = splitIso(jobData?.nextUpdateDue);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Re-sync when the persisted value changes (e.g. after a refresh).
  useEffect(() => {
    const next = splitIso(jobData?.nextUpdateDue);
    setDate(next.date);
    setTime(next.time);
    setMessage("");
  }, [jobData?.nextUpdateDue]);

  // Last customer-visible message timestamp.
  const lastUpdated = useMemo(() => {
    const messages = jobData?.messagingThread?.messages;
    if (!Array.isArray(messages) || messages.length === 0) return null;
    const visible = messages.filter(
      (m) => m?.customerVisible !== false && m?.audience !== "staff" && m?.createdAt
    );
    if (visible.length === 0) return null;
    const latest = visible.reduce((acc, m) =>
      new Date(m.createdAt) > new Date(acc.createdAt) ? m : acc
    );
    return latest.createdAt;
  }, [jobData?.messagingThread]);

  const lastUpdatedText = lastUpdated
    ? new Date(lastUpdated).toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No updates sent yet";

  const persist = async (nextUpdateDue) => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(
        `/api/job-cards/${encodeURIComponent(jobNumber)}/next-update`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nextUpdateDue }),
        }
      );
      const data = await res.json();
      if (!data?.success) {
        setMessage(data?.error || "Failed to save");
      } else {
        setMessage(nextUpdateDue ? "Next update saved" : "Next update cleared");
        await onRefreshJob();
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      setMessage(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!canEdit || !date || !time) return;
    const dt = new Date(`${date}T${time}`);
    if (Number.isNaN(dt.getTime())) return;
    persist(dt.toISOString());
  };

  const handleClear = () => {
    if (!canEdit) return;
    setDate("");
    setTime("");
    persist(null);
  };

  return (
    <LayerSurface
      sectionKey="jobcard-scheduling-customer-updates"
      sectionType="content-card"
      parentKey="jobcard-tab-scheduling"
      style={{ gap: "14px" }}
    >
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
        Customer Updates
      </h3>

      <LayerTheme
        sectionKey="jobcard-scheduling-customer-updates-last"
        sectionType="content-card"
        parentKey="jobcard-scheduling-customer-updates"
        style={{ gap: "2px" }}
      >
        <span style={labelStyle}>Last updated</span>
        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-1)" }}>
          {lastUpdatedText}
        </span>
      </LayerTheme>

      <div>
        <div style={{ ...labelStyle, marginBottom: "6px" }}>Next update due</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <CalendarField
            label="Date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={!canEdit || saving}
            className="compact-picker"
          />
          <TimePickerField
            label="Time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            disabled={!canEdit || saving}
            className="compact-picker"
          />
        </div>
      </div>

      {canEdit && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="app-btn app-btn--primary"
            onClick={handleSave}
            disabled={saving || !date || !time}
          >
            {saving ? "Saving…" : "Set next update"}
          </button>
          {jobData?.nextUpdateDue && (
            <button
              type="button"
              className="app-btn app-btn--ghost"
              onClick={handleClear}
              disabled={saving}
            >
              Clear
            </button>
          )}
          {message && (
            <span style={{ fontSize: "13px", color: "var(--success)", fontWeight: 500 }}>
              {message}
            </span>
          )}
        </div>
      )}
    </LayerSurface>
  );
}
