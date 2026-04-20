// file location: src/pages/hr/leave.js
import React from "react";
import { useHrOperationsData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section";
import { Button, StatusMessage } from "@/components/ui";
import { StatusTag } from "@/components/HR/MetricCard";
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";

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
      <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
        <SectionCard title="Unable to load leave data" subtitle="Mock API returned an error.">
          <StatusMessage tone="danger">{error.message}</StatusMessage>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Approve leave requests, calculate balances, and track special leave programmes.
        </p>
        <Button variant="primary">+ New Leave Request</Button>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--layout-card-gap)",
        }}
      >
        <SectionCard
          title="Pending & Recent Leave Requests"
          subtitle="Review approval status and history"
          action={
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button variant="secondary" size="sm">
                Export
              </Button>
              <Button variant="ghost" size="sm">
                Configure approvers
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
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Approver</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((request) => (
                  <tr key={request.id}>
                    <td style={{ fontWeight: 600 }}>{request.employee}</td>
                    <td>{request.type}</td>
                    <td>
                      {new Date(request.startDate).toLocaleDateString()} -{" "}
                      {new Date(request.endDate).toLocaleDateString()}
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
          </div>
        </SectionCard>

        <SectionCard title="Team Availability" subtitle="Upcoming leave by date range">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {upcomingAbsences.map((absence) => (
              <div
                key={absence.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "var(--space-3)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-xs)",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {absence.employee} • {absence.department}
                </span>
                <span style={{ fontSize: "var(--text-label)", color: "var(--text-secondary)" }}>
                  {absence.type} from {new Date(absence.startDate).toLocaleDateString()} to{" "}
                  {new Date(absence.endDate).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--layout-card-gap)",
        }}
      >
        <SectionCard title="Leave Balances" subtitle="Entitlement vs. taken time off">
          <div style={{ overflowX: "auto" }}>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Entitlement</th>
                  <th>Taken</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {leaveBalances.map((balance) => (
                  <tr key={balance.employeeId}>
                    <td style={{ fontWeight: 600 }}>{balance.employee}</td>
                    <td>{balance.department}</td>
                    <td>{balance.entitlement} days</td>
                    <td>{balance.taken} days</td>
                    <td>{balance.remaining} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Calendar Sync & Notifications"
          subtitle="Push approved leave to shared calendars and notify relevant managers"
        >
          <ul
            style={{
              margin: 0,
              padding: "0 var(--space-md)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
            }}
          >
            <li style={{ color: "var(--text-primary)" }}>
              Enable per-department calendar feeds (Google / Outlook) for leave visibility.
            </li>
            <li style={{ color: "var(--text-primary)" }}>
              Configure auto-notifications for approvals, rejections, and upcoming return dates.
            </li>
            <li style={{ color: "var(--text-primary)" }}>
              Sync sickness and unpaid leave with payroll deductions automatically.
            </li>
          </ul>
          <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-2)" }}>
            <Button variant="secondary" size="sm">
              Edit calendar settings
            </Button>
            <Button variant="ghost" size="sm">
              Notification rules
            </Button>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

export default function HrLeaveManagement({ embedded = false } = {}) {
  return <LeaveContent />;
}
