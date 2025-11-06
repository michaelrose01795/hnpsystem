// file location: src/components/HR/OvertimeEntriesEditor.js
import React, { useMemo, useState } from "react";
import { SectionCard, StatusTag } from "./MetricCard";

/**
 * Placeholder overtime entry editor that stores entries locally for UX validation.
 * TODO: Replace temporary state with Supabase mutations once APIs are available.
 */
export default function OvertimeEntriesEditor({ initialEntries = [] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [form, setForm] = useState({
    date: "",
    start: "",
    end: "",
  });

  const totals = useMemo(() => {
    const totalHours = entries.reduce((sum, entry) => sum + Number(entry.totalHours ?? 0), 0);
    return {
      sessions: entries.length,
      totalHours: totalHours.toFixed(2),
    };
  }, [entries]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdd = (event) => {
    event.preventDefault();
    const { date, start, end } = form;
    if (!date || !start || !end) return;

    const startDate = new Date(`${date}T${start}`);
    const endDate = new Date(`${date}T${end}`);
    const diff = (endDate - startDate) / (1000 * 60 * 60);
    const totalHours = diff > 0 ? diff : 0;

    const newEntry = {
      id: `OT-${Date.now()}`,
      date,
      start,
      end,
      totalHours,
    };

    setEntries((prev) => [newEntry, ...prev]);
    setForm({ date: "", start: "", end: "" });
  };

  return (
    <SectionCard
      title="Overtime Sessions"
      subtitle="Add entries for the current 26th-to-26th overtime period."
    >
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
        <button type="submit" style={buttonStyle}>
          Add session
        </button>
      </form>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "#6B7280", fontSize: "0.8rem" }}>
              <th style={{ textAlign: "left", paddingBottom: "10px" }}>Date</th>
              <th>Start</th>
              <th>End</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                <td style={{ padding: "12px 0", fontWeight: 600 }}>
                  {new Date(entry.date).toLocaleDateString()}
                </td>
                <td>{entry.start}</td>
                <td>{entry.end}</td>
                <td>{Number(entry.totalHours).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "16px", display: "flex", gap: "16px", alignItems: "center" }}>
        <StatusTag label={`Sessions: ${totals.sessions}`} tone="default" />
        <StatusTag label={`Total Hours: ${totals.totalHours}`} tone="success" />
        <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>
          TODO: Persist overtime sessions via Supabase edge functions.
        </span>
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
  color: "#374151",
};

const inputStyle = {
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #E5E7EB",
  fontWeight: 500,
};

const buttonStyle = {
  alignSelf: "end",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "none",
  background: "#6366F1",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  height: "42px",
};
