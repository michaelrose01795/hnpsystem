// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/leave.js
import React from "react"; // React runtime for page rendering
import { useHrOperationsData } from "@/hooks/useHrData"; // Supabase-backed HR aggregation hook
import { SectionCard } from "@/components/Section"; // section card layout — ghost chain removed
import { StatusTag } from "@/components/HR/MetricCard"; // status badge component
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";

// TODO: Wire leave requests, balances, and upcoming absences to live HR leave data.
function LeaveContent() {
  const { data, isLoading, error } = useHrOperationsData();

  const leaveRequests = data?.leaveRequests ?? [];
  const leaveBalances = data?.leaveBalances ?? [];
  const upcomingAbsences = data?.upcomingAbsences ?? [];

  if (isLoading) {
    return <HrTabLoadingSkeleton />;
  }

  if (error) {
    return (
      <div style={{ padding: "8px 8px 32px" }}>
        <SectionCard title="Unable to load leave data" subtitle="Mock API returned an error.">
          <span style={{ color: "var(--danger)" }}>{error.message}</span>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ color: "var(--info)", marginTop: "6px" }}>
            Approve leave requests, calculate balances, and track special leave programmes.
          </p>
        </div>
        <button type="button" style={buttonStylePrimary}>
          + New Leave Request
        </button>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "20px" }}>
        <SectionCard
          title="Pending & Recent Leave Requests"
          subtitle="Review approval status and history"
          action={
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" style={buttonStyleSecondary}>
                Export
              </button>
              <button type="button" style={buttonStyleGhost}>
                Configure approvers
              </button>
            </div>
          }
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                <th style={{ paddingBottom: "10px", textAlign: "left" }}>Employee</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Approver</th>
              </tr>
            </thead>
            <tbody>
              {leaveRequests.map((request) => (
                <tr key={request.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                  <td style={{ padding: "12px 0", fontWeight: 600 }}>{request.employee}</td>
                  <td>{request.type}</td>
                  <td>
                    {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                  </td>
                  <td>
                    <StatusTag
                      label={request.status}
                      tone={
                        request.status === "Approved"
                          ? "success"
                          : request.status === "Pending"
                          ? "warning"
                          : "default"
                      }
                    />
                  </td>
                  <td>{request.approver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title="Team Availability" subtitle="Upcoming leave by date range">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {upcomingAbsences.map((absence) => (
              <div
                key={absence.id}
                style={{
                  border: "1px solid var(--accent-purple-surface)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>
                  {absence.employee} • {absence.department}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>
                  {absence.type} from {new Date(absence.startDate).toLocaleDateString()} to{" "}
                  {new Date(absence.endDate).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <SectionCard title="Leave Balances" subtitle="Entitlement vs. taken time off">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                <th style={{ paddingBottom: "10px", textAlign: "left" }}>Employee</th>
                <th>Department</th>
                <th>Entitlement</th>
                <th>Taken</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {leaveBalances.map((balance) => (
                <tr key={balance.employeeId} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                  <td style={{ padding: "12px 0", fontWeight: 600 }}>{balance.employee}</td>
                  <td>{balance.department}</td>
                  <td>{balance.entitlement} days</td>
                  <td>{balance.taken} days</td>
                  <td>{balance.remaining} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard
          title="Calendar Sync & Notifications"
          subtitle="Push approved leave to shared calendars and notify relevant managers"
        >
          <ul style={{ margin: 0, padding: "0 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <li style={{ color: "var(--info-dark)" }}>
              Enable per-department calendar feeds (Google / Outlook) for leave visibility.
            </li>
            <li style={{ color: "var(--info-dark)" }}>
              Configure auto-notifications for approvals, rejections, and upcoming return dates.
            </li>
            <li style={{ color: "var(--info-dark)" }}>
              Sync sickness and unpaid leave with payroll deductions automatically.
            </li>
          </ul>
          <div style={{ marginTop: "12px", display: "flex", gap: "10px" }}>
            <button type="button" style={buttonStyleSecondary}>
              Edit calendar settings
            </button>
            <button type="button" style={buttonStyleGhost}>
              Notification rules
            </button>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

export default function HrLeaveManagement({ embedded = false } = {}) {
  const content = <LeaveContent />;
  return content;
}

const buttonStylePrimary = {
  padding: "var(--control-padding)",
  borderRadius: "var(--input-radius)",
  border: "none",
  background: "var(--danger)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleSecondary = {
  padding: "var(--control-padding)",
  borderRadius: "var(--input-radius)",
  border: "1px solid var(--warning)",
  background: "var(--surface)",
  color: "var(--danger)",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleGhost = {
  padding: "var(--control-padding)",
  borderRadius: "var(--input-radius)",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--danger)",
  fontWeight: 600,
  cursor: "pointer",
};
