// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/HR/OvertimeEntriesEditor.js
import React, { useEffect, useMemo, useState } from "react";
import { SectionCard, StatusTag } from "@/components/HR/MetricCard";

function formatTime(value) {
  if (!value) return "—";
  return value.slice(0, 5);
}

export default function OvertimeEntriesEditor({
  entries = [],
  employeeName = "",
  hourlyRate = null,
  overtimeSummary = null,
  canEdit = true,
  onSessionSaved = () => {},
}) {
  const [localEntries, setLocalEntries] = useState(entries);
  const [form, setForm] = useState({
    date: "",
    start: "",
    end: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const hourlyRateValue = Number(hourlyRate ?? 0);

  useEffect(() => {
    setLocalEntries(entries);
  }, [entries]);

  const totals = useMemo(() => {
    const totalHours = localEntries.reduce((sum, entry) => sum + Number(entry.totalHours ?? 0), 0);
    return {
      sessions: localEntries.length,
      totalHours: totalHours.toFixed(2),
    };
  }, [localEntries]);

  const periodLabel = useMemo(() => {
    if (!overtimeSummary?.periodStart || !overtimeSummary?.periodEnd) {
      return "Current overtime period";
    }
    const start = new Date(overtimeSummary.periodStart).toLocaleDateString();
    const end = new Date(overtimeSummary.periodEnd).toLocaleDateString();
    return `${start} – ${end}`;
  }, [overtimeSummary?.periodEnd, overtimeSummary?.periodStart]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!canEdit || isSaving) return;
    const { date, start, end } = form;
    if (!date || !start || !end) return;

    const startDate = new Date(`${date}T${start}`);
    const endDate = new Date(`${date}T${end}`);
    const diff = (endDate - startDate) / (1000 * 60 * 60);
    const totalHours = diff > 0 ? diff : 0;
    if (totalHours <= 0) {
      setError("End time must be after start time.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/profile/overtime-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date, start, end }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to save overtime session.");
      }

      const payload = await response.json();
      const savedEntry = payload?.data;

      if (!savedEntry) {
        throw new Error("Supabase did not return the saved session.");
      }

      const entry = {
        ...savedEntry,
        totalHours: Number(savedEntry.totalHours ?? totalHours),
      };

      setLocalEntries((prev) => [entry, ...prev]);
      setForm({ date: "", start: "", end: "" });
      onSessionSaved(entry);
    } catch (err) {
      setError(err.message || "Failed to save overtime session.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SectionCard
      title="Overtime Sessions"
      subtitle={periodLabel}
    >
      {canEdit ? (
        <form
          onSubmit={handleAdd}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <label style={labelStyle}>
            <span>Date</span>
            <input name="date" type="date" value={form.date} onChange={handleChange} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span>Start time</span>
            <input name="start" type="time" value={form.start} onChange={handleChange} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span>End time</span>
            <input name="end" type="time" value={form.end} onChange={handleChange} style={inputStyle} />
          </label>
          <button type="submit" style={{ ...buttonStyle, opacity: isSaving ? 0.7 : 1 }}>
            {isSaving ? "Saving…" : "Add session"}
          </button>
        </form>
      ) : (
        <div style={{ marginBottom: "16px", color: "var(--info)" }}>
          Admin preview: overtime entries for {employeeName || "this employee"} are read-only.
        </div>
      )}

      {error && (
        <div style={{ marginBottom: "12px", color: "var(--danger)", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
              <th style={{ textAlign: "left", paddingBottom: "10px" }}>Date</th>
              <th>Start</th>
              <th>End</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {localEntries.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "16px 0", color: "var(--text-secondary)" }}>
                  No overtime sessions logged for this period.
                </td>
              </tr>
            ) : (
              localEntries.map((entry) => (
                <tr key={entry.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                  <td style={{ padding: "12px 0", fontWeight: 600 }}>
                    {new Date(entry.date).toLocaleDateString()}
                  </td>
                  <td>{formatTime(entry.start)}</td>
                  <td>{formatTime(entry.end)}</td>
                  <td>{Number(entry.totalHours).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "16px", display: "flex", gap: "16px", alignItems: "center" }}>
        <StatusTag label={`Sessions: ${totals.sessions}`} tone="default" />
        <StatusTag label={`Total Hours: ${totals.totalHours}`} tone="success" />
        {overtimeSummary && (
          <StatusTag label={`Status: ${overtimeSummary.status}`} tone="warning" />
        )}
        {hourlyRateValue > 0 && (
          <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>
            Est. payout £{(Number(totals.totalHours) * hourlyRateValue).toFixed(2)}
          </span>
        )}
      </div>
    </SectionCard>
  );
}

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--info-dark)",
};

const inputStyle = {
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid var(--accent-purple-surface)",
  fontWeight: 500,
};

const buttonStyle = {
  alignSelf: "end",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "none",
  background: "var(--accent-purple)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  height: "42px",
};
