// file location: src/components/HR/tabs/AttendanceTab.js
// Attendance tracking tab - shows time logs, overtime, and absences
import React from "react";
import { useHrAttendanceData } from "@/hooks/useHrData";
import { SectionCard, StatusTag } from "@/components/HR/MetricCard";

const buttonStyleSecondary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--warning)",
  background: "var(--surface)",
  color: "var(--danger)",
  fontWeight: 600,
  cursor: "pointer",
};

export default function AttendanceTab() {
  const { data, isLoading, error } = useHrAttendanceData();

  const attendanceLogs = data?.attendanceLogs ?? [];
  const overtimeSummaries = data?.overtimeSummaries ?? [];
  const absenceRecords = data?.absenceRecords ?? [];

  if (isLoading) {
    return (
      <SectionCard title="Loading attendance" subtitle="Fetching clocking data.">
        <span style={{ color: "var(--info)" }}>Pulling attendance data from Supabase.</span>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard title="Unable to load attendance" subtitle="An error occurred.">
        <span style={{ color: "var(--danger)" }}>{error.message}</span>
      </SectionCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
          Attendance Tracking
        </h2>
        <p style={{ color: "var(--info)", margin: 0 }}>
          Monitor time logs, absences, late arrivals, and overtime activity across the team.
        </p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
        <SectionCard
          title="Daily Time Logs"
          subtitle="Sourced from the workshop clocking system"
          action={
            <button type="button" style={buttonStyleSecondary}>
              Export CSV
            </button>
          }
        >
          <div style={{ maxHeight: "360px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--info)", fontSize: "0.8rem" }}>
                  <th style={{ padding: "12px 0" }}>Employee</th>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Total Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLogs.map((log) => (
                  <tr key={log.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                    <td style={{ padding: "12px 0", fontWeight: 600 }}>{log.employeeName}</td>
                    <td>{new Date(log.date).toLocaleDateString()}</td>
                    <td>{log.clockIn ? new Date(log.clockIn).toLocaleTimeString() : "—"}</td>
                    <td>{log.clockOut ? new Date(log.clockOut).toLocaleTimeString() : "—"}</td>
                    <td>{log.totalHours?.toFixed(2) ?? "—"} hrs</td>
                    <td>
                      <StatusTag
                        label={log.status}
                        tone={log.status === "Late" ? "danger" : log.status === "Overtime" ? "warning" : "success"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Overtime Summary" subtitle="Recent overtime entries">
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {overtimeSummaries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid var(--info-surface)",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{entry.employee}</span>
                <span style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
                  {entry.overtimeHours} hours @ {entry.overtimeRate}x rate
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Absence Records" subtitle="Upcoming and recent absences">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--info)", fontSize: "0.8rem" }}>
              <th style={{ padding: "12px 0" }}>Employee</th>
              <th>Type</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {absenceRecords.map((record) => (
              <tr key={record.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                <td style={{ padding: "12px 0", fontWeight: 600 }}>{record.employee}</td>
                <td>{record.type}</td>
                <td>{new Date(record.startDate).toLocaleDateString()}</td>
                <td>{new Date(record.endDate).toLocaleDateString()}</td>
                <td>
                  <StatusTag
                    label={record.status}
                    tone={record.status === "Approved" ? "success" : record.status === "Pending" ? "warning" : "danger"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}
