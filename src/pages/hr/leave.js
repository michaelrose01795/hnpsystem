// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/leave.js
import React from "react"; // React runtime for page rendering
import Layout from "@/components/Layout"; // global layout container
import { useHrOperationsData } from "@/hooks/useHrData"; // Supabase-backed HR aggregation hook
import { SectionCard, StatusTag } from "@/components/HR/MetricCard"; // shared HR component library

// TODO: Wire leave requests, balances, and upcoming absences to live HR leave data.
export default function HrLeaveManagement() {
  const { data, isLoading, error } = useHrOperationsData(); // load leave datasets for the workspace

  const leaveRequests = data?.leaveRequests ?? []; // aggregated leave request records
  const leaveBalances = data?.leaveBalances ?? []; // entitlement vs taken days per employee
  const upcomingAbsences = data?.upcomingAbsences ?? []; // upcoming approved leave events

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px 8px 32px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ color: "#6B7280", marginTop: "6px" }}>
              Approve leave requests, calculate balances, and track special leave programmes.
            </p>
          </div>
          <button type="button" style={buttonStylePrimary}>
            + New Leave Request
          </button>
        </header>

        {isLoading && (
          <SectionCard title="Loading leave data" subtitle="Fetching requests and balances.">
            <span style={{ color: "#6B7280" }}>Retrieving placeholder leave details for testing.</span>
          </SectionCard>
        )}

        {error && (
          <SectionCard title="Unable to load leave data" subtitle="Mock API returned an error.">
            <span style={{ color: "#B91C1C" }}>{error.message}</span>
          </SectionCard>
        )}

        {!isLoading && !error && (
          <>
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
                    <tr style={{ color: "#6B7280", fontSize: "0.8rem" }}>
                      <th style={{ paddingBottom: "10px", textAlign: "left" }}>Employee</th>
                      <th>Type</th>
                      <th>Dates</th>
                      <th>Status</th>
                      <th>Approver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.map((request) => (
                      <tr key={request.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                        <td style={{ padding: "12px 0", fontWeight: 600 }}>{request.employee}</td>
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
              </SectionCard>

              <SectionCard title="Team Availability" subtitle="Upcoming leave by date range">
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {upcomingAbsences.map((absence) => (
                    <div
                      key={absence.id}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: "12px",
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "#111827" }}>
                        {absence.employee} • {absence.department}
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>
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
                    <tr style={{ color: "#6B7280", fontSize: "0.8rem" }}>
                      <th style={{ paddingBottom: "10px", textAlign: "left" }}>Employee</th>
                      <th>Department</th>
                      <th>Entitlement</th>
                      <th>Taken</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveBalances.map((balance) => (
                      <tr key={balance.employeeId} style={{ borderTop: "1px solid #E5E7EB" }}>
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
                  <li style={{ color: "#374151" }}>
                    Enable per-department calendar feeds (Google / Outlook) for leave visibility.
                  </li>
                  <li style={{ color: "#374151" }}>
                    Configure auto-notifications for approvals, rejections, and upcoming return dates.
                  </li>
                  <li style={{ color: "#374151" }}>
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
          </>
        )}
      </div>
    </Layout>
  );
}

const buttonStylePrimary = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  background: "#F97316",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleSecondary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid #FED7AA",
  background: "white",
  color: "#EA580C",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleGhost = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid transparent",
  background: "transparent",
  color: "#EA580C",
  fontWeight: 600,
  cursor: "pointer",
};
