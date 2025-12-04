// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/attendance.js
import React from "react";
import Layout from "@/components/Layout";
import { useHrAttendanceData } from "@/hooks/useHrData";
import { SectionCard, StatusTag } from "@/components/HR/MetricCard";

export default function HrAttendance() {
  const { data, isLoading, error } = useHrAttendanceData();

  const attendanceLogs = data?.attendanceLogs ?? [];
  const overtimeSummaries = data?.overtimeSummaries ?? [];
  const absenceRecords = data?.absenceRecords ?? [];

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px 8px 32px" }}>
        <header style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <p style={{ color: "var(--info)" }}>
            Monitor time logs, absences, late arrivals, and overtime activity across the team.
          </p>
        </header>

        {isLoading && (
          <SectionCard title="Loading attendance" subtitle="Fetching clocking data.">
            <span style={{ color: "var(--info)" }}>Pulling attendance data from Supabase.</span>
          </SectionCard>
        )}

        {error && (
          <SectionCard title="Unable to load attendance" subtitle="Mock API returned an error.">
            <span style={{ color: "var(--danger)" }}>{error.message}</span>
          </SectionCard>
        )}

        {!isLoading && !error && (
          <>
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
                      <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                        <th style={{ paddingBottom: "10px", textAlign: "left" }}>Employee</th>
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
                          <td style={{ padding: "12px 0", fontWeight: 600 }}>{log.employeeId}</td>
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
                  <button type="button" style={buttonStylePrimary}>
                    Review Timesheets
                  </button>
                }
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {overtimeSummaries.map((record) => (
                    <div
                      key={record.id}
                      style={{
                        border: "1px solid var(--accent-purple-surface)",
                        borderRadius: "12px",
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{record.employee}</span>
                        <StatusTag
                          label={record.status}
                          tone={record.status === "Ready" ? "success" : "warning"}
                        />
                      </div>
                      <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>
                        {new Date(record.periodStart).toLocaleDateString()} -{" "}
                        {new Date(record.periodEnd).toLocaleDateString()}
                      </span>
                      <div style={{ display: "flex", gap: "16px", fontSize: "0.85rem", color: "var(--info-dark)" }}>
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
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="button" style={buttonStyleSecondary}>
                    Export PDF
                  </button>
                  <button type="button" style={buttonStylePrimary}>
                    New Absence
                  </button>
                </div>
              }
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                      <th style={{ textAlign: "left", paddingBottom: "10px" }}>Employee</th>
                      <th>Type</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absenceRecords.map((absence) => (
                      <tr key={absence.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                        <td style={{ padding: "12px 0", fontWeight: 600 }}>{absence.employee}</td>
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
    </Layout>
  );
}

const buttonStylePrimary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "none",
  background: "var(--info)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleSecondary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--info)",
  background: "var(--surface)",
  color: "var(--accent-purple)",
  fontWeight: 600,
  cursor: "pointer",
};
