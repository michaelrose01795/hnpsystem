// file location: src/pages/hr/attendance.js
import React from "react";
import { useHrAttendanceData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section";
import { Button, StatusMessage } from "@/components/ui";
import { StatusTag } from "@/components/HR/MetricCard";

export default function HrAttendance() {
  const { data, isLoading, error } = useHrAttendanceData();

  const attendanceLogs = data?.attendanceLogs ?? [];
  const overtimeSummaries = data?.overtimeSummaries ?? [];
  const absenceRecords = data?.absenceRecords ?? [];

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Monitor time logs, absences, late arrivals, and overtime activity across the team.
        </p>
      </header>

      {isLoading && (
        <SectionCard title="Loading attendance" subtitle="Fetching clocking data.">
          <StatusMessage tone="info">Pulling attendance data from Supabase.</StatusMessage>
        </SectionCard>
      )}

      {error && (
        <SectionCard title="Unable to load attendance" subtitle="Mock API returned an error.">
          <StatusMessage tone="danger">{error.message}</StatusMessage>
        </SectionCard>
      )}

      {!isLoading && !error && (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "var(--layout-card-gap)",
            }}
          >
            <SectionCard
              title="Daily Time Logs"
              subtitle="Sourced from the workshop clocking system"
              action={
                <Button variant="secondary" size="sm">
                  Export CSV
                </Button>
              }
            >
              <div style={{ maxHeight: "360px", overflowY: "auto" }}>
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
                    {attendanceLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontWeight: 600 }}>{log.employeeName || "Unknown user"}</td>
                        <td>{new Date(log.date).toLocaleDateString()}</td>
                        <td>{log.clockIn}</td>
                        <td>{log.clockOut}</td>
                        <td>{Number(log.totalHours).toFixed(1)} hrs</td>
                        <td>
                          <StatusTag
                            label={log.status}
                            tone={
                              log.status === "On Time"
                                ? "success"
                                : log.status === "Overtime"
                                ? "warning"
                                : "default"
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title="Overtime Summary"
              subtitle="Captured per 26th-to-26th overtime period"
              action={
                <Button variant="primary" size="sm">
                  Review Timesheets
                </Button>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {overtimeSummaries.map((record) => (
                  <div
                    key={record.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "var(--space-3)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-1)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{record.employee}</span>
                      <StatusTag
                        label={record.status}
                        tone={record.status === "Ready" ? "success" : "warning"}
                      />
                    </div>
                    <span style={{ fontSize: "var(--text-label)", color: "var(--text-secondary)" }}>
                      {new Date(record.periodStart).toLocaleDateString()} -{" "}
                      {new Date(record.periodEnd).toLocaleDateString()}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--space-md)",
                        fontSize: "var(--text-body-sm)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <span>{record.overtimeHours} hrs</span>
                      <span>OT rate £{Number(record.overtimeRate).toFixed(2)}</span>
                      <span>Bonus £{Number(record.bonus).toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </section>

          <SectionCard
            title="Absence Tracking"
            subtitle="Holiday, sickness, unpaid leave, and other absences"
            action={
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button variant="secondary" size="sm">
                  Export PDF
                </Button>
                <Button variant="primary" size="sm">
                  New Absence
                </Button>
              </div>
            }
          >
            <div style={{ overflowX: "auto" }}>
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {absenceRecords.map((absence) => (
                    <tr key={absence.id}>
                      <td style={{ fontWeight: 600 }}>{absence.employee}</td>
                      <td>{absence.type}</td>
                      <td>{new Date(absence.startDate).toLocaleDateString()}</td>
                      <td>{new Date(absence.endDate).toLocaleDateString()}</td>
                      <td>
                        <StatusTag
                          label={absence.approvalStatus}
                          tone={absence.approvalStatus === "Approved" ? "success" : "warning"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
