// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/payroll.js
import React from "react"; // React runtime for the payroll workspace
import Layout from "@/components/Layout"; // shared layout wrapper
import { useHrOperationsData } from "@/hooks/useHrData"; // Supabase-backed HR aggregation hook
import { SectionCard, StatusTag } from "@/components/HR/MetricCard"; // HR specific UI components

// TODO: Pull payroll data, pay rises, and overtime summaries from Supabase tables.

const payriseRequests = [
  {
    id: "PR-1",
    employee: "Michael Green",
    submittedOn: "2024-03-05",
    requestedRate: 24.0,
    currentRate: 22.1,
    approver: "Sarah Thompson",
    status: "Awaiting HR",
  },
  {
    id: "PR-2",
    employee: "Katie Lewis",
    submittedOn: "2024-02-22",
    requestedRate: 21.0,
    currentRate: 20.0,
    approver: "HR Team",
    status: "Approved",
  },
];

function PayrollContent() {
  const { data, isLoading, error } = useHrOperationsData();

  const employeeDirectory = data?.employeeDirectory ?? [];
  const overtimeSummaries = data?.overtimeSummaries ?? [];
  const payRateHistory = data?.payRateHistory ?? [];

  if (isLoading) {
    return (
      <div style={{ padding: "8px 8px 32px" }}>
        <SectionCard title="Loading payroll data" subtitle="Fetching pay records and overtime.">
          <span style={{ color: "var(--info)" }}>
            Please wait while we retrieve placeholder payroll information for testing purposes.
          </span>
        </SectionCard>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "8px 8px 32px" }}>
        <SectionCard title="Unable to load payroll data" subtitle="Mock API returned an error.">
          <span style={{ color: "var(--danger)" }}>{error.message}</span>
        </SectionCard>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px 8px 32px" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <p style={{ color: "var(--info)" }}>
          Track compensation, pay rise approvals, overtime payments, and exports.
        </p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "20px" }}>
        <SectionCard
          title="Compensation Overview"
          subtitle="Current salary/hourly rate by employee"
          action={
            <button type="button" style={buttonStylePrimary}>
              Export Payroll CSV
            </button>
          }
        >
          <div style={{ maxHeight: "440px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                  <th style={{ paddingBottom: "10px", textAlign: "left" }}>Employee</th>
                  <th>Department</th>
                  <th>Contract</th>
                  <th>Pay Rate</th>
                </tr>
              </thead>
              <tbody>
                {employeeDirectory.map((employee) => (
                  <tr key={employee.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                    <td style={{ padding: "12px 0" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{employee.name}</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>{employee.jobTitle}</span>
                      </div>
                    </td>
                    <td>{employee.department}</td>
                    <td>{employee.employmentType}</td>
                    <td>£{Number(employee.hourlyRate).toFixed(2)} / hr</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Pay Rise Requests" subtitle="Approval workflow: Employee → Manager → HR">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {payriseRequests.map((request) => (
              <div
                key={request.id}
                style={{
                  border: "1px solid var(--accent-purple-surface)",
                  borderRadius: "12px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  background: "rgba(var(--info-rgb), 0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{request.employee}</span>
                  <StatusTag tone={request.status === "Approved" ? "success" : "warning"} label={request.status} />
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>
                  Submitted {new Date(request.submittedOn).toLocaleDateString()}
                </span>
                <div style={{ display: "flex", gap: "14px", fontSize: "0.85rem", color: "var(--info-dark)" }}>
                  <span>Current £{request.currentRate.toFixed(2)}</span>
                  <span>Requested £{request.requestedRate.toFixed(2)}</span>
                  <span>Approver: {request.approver}</span>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="button" style={buttonStyleSecondary}>
                    Approve
                  </button>
                  <button type="button" style={buttonStyleGhost}>
                    Request edits
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <SectionCard
          title="Pay Rate History"
          subtitle="Audit trail of pay changes with effective dates"
          action={
            <button type="button" style={buttonStyleSecondary}>
              Add record
            </button>
          }
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                <th style={{ textAlign: "left", paddingBottom: "10px" }}>Employee</th>
                <th>Effective Date</th>
                <th>Rate</th>
                <th>Type</th>
                <th>Approved By</th>
              </tr>
            </thead>
            <tbody>
              {payRateHistory.map((entry) => (
                <tr key={entry.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                  <td style={{ padding: "12px 0", fontWeight: 600 }}>{entry.employee}</td>
                  <td>{new Date(entry.effectiveDate).toLocaleDateString()}</td>
                  <td>£{Number(entry.rate).toFixed(2)}</td>
                  <td>{entry.type}</td>
                  <td>{entry.approvedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard
          title="Overtime & Bonus Tracking"
          subtitle="Hours and earnings rolled up per period"
          action={
            <button type="button" style={buttonStylePrimary}>
              Generate Payroll Pack
            </button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {overtimeSummaries.map((summary) => (
              <div
                key={summary.id}
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
                  <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{summary.employee}</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--info)" }}>{summary.status}</span>
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>
                  Period {new Date(summary.periodStart).toLocaleDateString()} -{" "}
                  {new Date(summary.periodEnd).toLocaleDateString()}
                </span>
                <div style={{ display: "flex", gap: "14px", fontSize: "0.85rem", color: "var(--info-dark)" }}>
                  <span>{summary.overtimeHours} hrs</span>
                  <span>Rate £{Number(summary.overtimeRate).toFixed(2)}</span>
                  <span>Bonus £{Number(summary.bonus).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

export default function HrPayroll({ embedded = false } = {}) {
  const content = <PayrollContent />;
  return embedded ? content : <Layout>{content}</Layout>;
}

const buttonStylePrimary = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  background: "var(--danger)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleSecondary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--warning)",
  background: "var(--surface)",
  color: "var(--danger)",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleGhost = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--danger)",
  fontWeight: 600,
  cursor: "pointer",
};
