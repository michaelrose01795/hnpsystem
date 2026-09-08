// file location: src/components/HR/tabs/AttendanceTab.js
// Attendance tracking tab - shows time logs, overtime, and absences
import React from "react";
import { useHrAttendanceData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section"; // section card layout — ghost chain removed
import { StatusTag } from "@/components/HR/MetricCard"; // status badge component
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";
import LayerSurface from "@/components/ui/LayerSurface"; // third rung: nested inside a --theme SectionCard, so --surface (CLAUDE.md 3.0a-2)
import DataTableShell from "@/components/ui/DataTableShell"; // canonical table scroll shell (CLAUDE.md §3.4)
import EmptyState from "@/components/ui/EmptyState"; // canonical empty-state primitive
import HrSummaryStrip from "@/components/HR/HrSummaryStrip"; // shared at-a-glance metric strip
import { buildAttendanceSummary } from "@/lib/hr/hrTabSummaries";

const buttonStyleSecondary = {
  padding: "var(--control-padding)",
  borderRadius: "var(--input-radius)",
  background: "var(--surface)",
  color: "var(--text-1)",
  fontWeight: 600,
  cursor: "pointer",
};

export default function AttendanceTab() {
  const { data, isLoading, error } = useHrAttendanceData();

  const attendanceLogs = data?.attendanceLogs ?? [];
  const overtimeSummaries = data?.overtimeSummaries ?? [];
  const absenceRecords = data?.absenceRecords ?? [];

  // Today on the shop floor: who is clocked in, hours booked, who is away, and
  // the overtime accruing against the open period.
  const summary = buildAttendanceSummary({ attendanceLogs, overtimeSummaries, absenceRecords });

  if (isLoading) {
    return <HrTabLoadingSkeleton />;
  }

  if (error) {
    return (
      <SectionCard layer="theme"
        sectionKey="hr-attendance-error" parentKey="hr-manager-tab-attendance" title="Unable to load attendance" subtitle="An error occurred.">
        <span style={{ color: "var(--danger)" }}>{error.message}</span>
      </SectionCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <HrSummaryStrip items={summary} parentKey="hr-manager-tab-attendance" />

      <SectionCard layer="theme"
        sectionKey="hr-attendance-daily-time-logs" parentKey="hr-manager-tab-attendance"
        title="Daily Time Logs"
        subtitle="Sourced from the workshop clocking system"
        action={
          <button type="button" style={buttonStyleSecondary}>
            Export CSV
          </button>
        }
      >
        <LayerSurface padding="var(--space-3)" gap="0">
          <DataTableShell>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Total Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        variant="bare"
                        icon="🕒"
                        title="No time logged"
                        description="Clock-in and clock-out entries appear here as staff use the terminal."
                      />
                    </td>
                  </tr>
                ) : null}
                {attendanceLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 600 }}>{log.employeeName}</td>
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
          </DataTableShell>
        </LayerSurface>
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-attendance-overtime-summary" parentKey="hr-manager-tab-attendance" title="Overtime Summary" subtitle="Recent overtime entries">
        <LayerSurface padding="var(--space-3)" gap="var(--space-3)">
          {overtimeSummaries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                paddingBottom: "12px",
                borderBottom: "var(--separating-line)",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{entry.employee}</span>
              <span style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.7 }}>
                {entry.overtimeHours} hours @ {entry.overtimeRate}x rate
              </span>
            </div>
          ))}
        </LayerSurface>
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-attendance-absence-records" parentKey="hr-manager-tab-attendance" title="Absence Records" subtitle="Upcoming and recent absences">
        <LayerSurface padding="var(--space-3)" gap="0">
          <DataTableShell>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {absenceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        variant="bare"
                        icon="🌴"
                        title="No absences recorded"
                        description="Booked and reported absences appear here with their approval status."
                      />
                    </td>
                  </tr>
                ) : null}
                {absenceRecords.map((record) => (
                  <tr key={record.id}>
                    <td style={{ fontWeight: 600 }}>{record.employee}</td>
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
          </DataTableShell>
        </LayerSurface>
      </SectionCard>
    </div>
  );
}
