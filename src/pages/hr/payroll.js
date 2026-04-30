// file location: src/pages/hr/payroll.js
import React from "react";
import { useHrOperationsData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section";
import { Button, StatusMessage } from "@/components/ui";
import { SkeletonBlock, SkeletonTableRow, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";

// Structured skeleton bodies that sit inside each SectionCard while payroll
// data loads — outer page shell (header, section grids, card chrome) stays
// mounted so the first frame matches the final layout.
import HrPayrollUi from "@/components/page-ui/hr/hr-payroll-ui"; // Extracted presentation layer.
function TableRowsSkeleton({ rows = 5, cols = 4 }) {return (
    <>
      {Array.from({ length: rows }).map((_, i) =>
      <SkeletonTableRow key={i} cols={cols} />
      )}
    </>);

}

function ListRowsSkeleton({ rows = 3 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {Array.from({ length: rows }).map((_, i) =>
      <div
        key={i}
        style={{
          border: "1px solid var(--primary-border)",
          borderRadius: "var(--radius-sm)",
          padding: "var(--space-3)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-1)"
        }}>
        
          <SkeletonBlock width="58%" height="14px" />
          <SkeletonBlock width="70%" height="12px" />
          <SkeletonBlock width="48%" height="12px" />
        </div>
      )}
    </div>);

}

function PayrollContent() {
  const { data, isLoading, error } = useHrOperationsData();

  const employeeDirectory = data?.employeeDirectory ?? [];
  const overtimeSummaries = data?.overtimeSummaries ?? [];
  const payRateHistory = data?.payRateHistory ?? [];

  if (error) {
    return (
      <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
        <SectionCard title="Unable to load payroll data" subtitle="Mock API returned an error.">
          <StatusMessage tone="danger">{error.message}</StatusMessage>
        </SectionCard>
      </div>);

  }

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <SkeletonKeyframes />
      <header style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <p style={{ color: "var(--text-1)", margin: 0 }}>
          Track compensation, pay rise approvals, overtime payments, and exports.
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--layout-card-gap)"
        }}>
        
        <SectionCard
          title="Compensation Overview"
          subtitle="Current salary/hourly rate by employee"
          action={
          <Button variant="primary" size="sm">
              Export Payroll CSV
            </Button>
          }>
          
          <div style={{ maxHeight: "440px", overflowY: "auto" }}>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Contract</th>
                  <th>Pay Rate</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ?
                <TableRowsSkeleton rows={6} cols={4} /> :

                employeeDirectory.map((employee) =>
                <tr key={employee.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{employee.name}</span>
                          <span style={{ fontSize: "var(--text-label)", color: "var(--text-1)" }}>
                            {employee.jobTitle}
                          </span>
                        </div>
                      </td>
                      <td>{employee.department}</td>
                      <td>{employee.employmentType}</td>
                      <td>£{Number(employee.hourlyRate).toFixed(2)} / hr</td>
                    </tr>
                )
                }
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Pay Rise Requests" subtitle="Approval workflow: Employee → Manager → HR">
          <p style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch pay rise requests from Supabase. Display employee name, current/requested rate, approver, status, and approve/reject actions.
          </p>
        </SectionCard>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--layout-card-gap)"
        }}>
        
        <SectionCard
          title="Pay Rate History"
          subtitle="Audit trail of pay changes with effective dates"
          action={
          <Button variant="secondary" size="sm">
              Add record
            </Button>
          }>
          
          <div style={{ overflowX: "auto" }}>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Effective Date</th>
                  <th>Rate</th>
                  <th>Type</th>
                  <th>Approved By</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ?
                <TableRowsSkeleton rows={5} cols={5} /> :

                payRateHistory.map((entry) =>
                <tr key={entry.id}>
                      <td style={{ fontWeight: 600 }}>{entry.employee}</td>
                      <td>{new Date(entry.effectiveDate).toLocaleDateString()}</td>
                      <td>£{Number(entry.rate).toFixed(2)}</td>
                      <td>{entry.type}</td>
                      <td>{entry.approvedBy}</td>
                    </tr>
                )
                }
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Overtime & Bonus Tracking"
          subtitle="Hours and earnings rolled up per period"
          action={
          <Button variant="primary" size="sm">
              Generate Payroll Pack
            </Button>
          }>
          
          {isLoading ?
          <ListRowsSkeleton rows={4} /> :

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {overtimeSummaries.map((summary) =>
            <div
              key={summary.id}
              style={{
                border: "1px solid var(--primary-border)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-3)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-1)"
              }}>
              
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{summary.employee}</span>
                    <span style={{ fontSize: "var(--text-body-sm)", fontWeight: 600, color: "var(--text-1)" }}>
                      {summary.status}
                    </span>
                  </div>
                  <span style={{ fontSize: "var(--text-label)", color: "var(--text-1)" }}>
                    Period {new Date(summary.periodStart).toLocaleDateString()} -{" "}
                    {new Date(summary.periodEnd).toLocaleDateString()}
                  </span>
                  <div
                style={{
                  display: "flex",
                  gap: "var(--space-4)",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--text-1)"
                }}>
                
                    <span>{summary.overtimeHours} hrs</span>
                    <span>Rate £{Number(summary.overtimeRate).toFixed(2)}</span>
                    <span>Bonus £{Number(summary.bonus).toFixed(2)}</span>
                  </div>
                </div>
            )}
            </div>
          }
        </SectionCard>
      </section>
    </div>);

}

export default function HrPayroll({ embedded = false } = {}) {
  return <HrPayrollUi view="section1" PayrollContent={PayrollContent} />;
}
