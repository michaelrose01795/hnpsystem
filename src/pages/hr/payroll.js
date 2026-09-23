// file location: src/pages/hr/payroll.js
import React from "react";
import { useHrOperationsData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section";
import { Button, LayerSurface, StatusMessage } from "@/components/ui"; // LayerSurface: third rung — nested inside a --theme SectionCard (CLAUDE.md §3.0a-2)
import { SkeletonBlock, SkeletonTableRow, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { hrPresentationData } from "@/features/presentation/mockData/hr_operations";
import { redirectToHrManagerTab } from "@/lib/hr/hrManagerRoutes";
import DataTableShell from "@/components/ui/DataTableShell"; // canonical table scroll shell (CLAUDE.md §3.4)
import EmptyState from "@/components/ui/EmptyState"; // canonical empty-state primitive
import HrSummaryStrip from "@/components/HR/HrSummaryStrip"; // shared at-a-glance metric strip
import { buildPayrollSummary } from "@/lib/hr/hrTabSummaries";

export function getServerSideProps() {
  return redirectToHrManagerTab("payroll");
}

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
      <LayerSurface
        key={i}
        radius="var(--radius-sm)"
        padding="var(--space-3)"
        gap="var(--space-1)">

          <SkeletonBlock width="58%" height="14px" />
          <SkeletonBlock width="70%" height="12px" />
          <SkeletonBlock width="48%" height="12px" />
        </LayerSurface>
      )}
    </div>);

}

function PayrollContent() {
  const { data, isLoading, error } = useHrOperationsData();

  const employeeDirectory = data?.employeeDirectory ?? [];
  const overtimeSummaries = data?.overtimeSummaries ?? [];
  const payRateHistory = data?.payRateHistory ?? [];
  const showPresentationMock = isPresentationMode();

  // Cost of the payroll and what is still waiting to be processed, so the run
  // can be sanity-checked before anyone opens the tables below.
  const summary = buildPayrollSummary({ employeeDirectory, overtimeSummaries, payRateHistory });

  if (error) {
    return (
      <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
        <SectionCard layer="theme"
          sectionKey="hr-payroll-error" parentKey="hr-manager-tab-payroll" title="Unable to load payroll data" subtitle="Mock API returned an error.">
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

      {isLoading ? null : <HrSummaryStrip items={summary} parentKey="hr-manager-tab-payroll" />}

      <SectionCard layer="theme"
        sectionKey="hr-payroll-compensation-overview" parentKey="hr-manager-tab-payroll"
        title="Compensation Overview"
        subtitle="Current salary/hourly rate by employee"
        action={
        <Button variant="primary" size="sm">
            Export Payroll CSV
          </Button>
        }>
        
        <LayerSurface padding="var(--space-3)" gap="0">
          <DataTableShell>
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

                employeeDirectory.length === 0 ?
                <tr>
                  <td colSpan={4}>
                    <EmptyState variant="bare" icon="👥" title="No employees on payroll" description="Employees appear here with their contract type and pay rate." />
                  </td>
                </tr> :

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
          </DataTableShell>
        </LayerSurface>
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-payroll-pay-rise-requests" parentKey="hr-manager-tab-payroll" title="Pay Rise Requests" subtitle="Approval workflow: Employee → Manager → HR">
        {showPresentationMock ? (
          <LayerSurface padding="var(--space-3)" gap="0">
            <DataTableShell>
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Current</th>
                    <th>Requested</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hrPresentationData.payRiseRequests.map((request) => (
                    <tr key={request.id}>
                      <td style={{ fontWeight: 600 }}>{request.employee}</td>
                      <td>£{Number(request.currentRate).toFixed(2)}</td>
                      <td>£{Number(request.requestedRate).toFixed(2)}</td>
                      <td>{request.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </LayerSurface>
        ) : (
          <EmptyState
            icon="💷"
            title="No pay rise requests"
            description="Requests appear here once submitted, showing the current and requested rate for approval."
          />
        )}
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-payroll-pay-rate-history" parentKey="hr-manager-tab-payroll"
        title="Pay Rate History"
        subtitle="Audit trail of pay changes with effective dates"
        action={
        <Button variant="secondary" size="sm">
            Add record
          </Button>
        }>
        
        <LayerSurface padding="var(--space-3)" gap="0">
          <DataTableShell>
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

                payRateHistory.length === 0 ?
                <tr>
                  <td colSpan={5}>
                    <EmptyState variant="bare" icon="🧾" title="No pay changes recorded" description="Every rate change is logged here with its effective date and approver." />
                  </td>
                </tr> :

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
          </DataTableShell>
        </LayerSurface>
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-payroll-overtime-and-bonus" parentKey="hr-manager-tab-payroll"
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
          <LayerSurface
            key={summary.id}
            radius="var(--radius-sm)"
            padding="var(--space-3)"
            gap="var(--space-1)">

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
              </LayerSurface>
          )}
          </div>
        }
      </SectionCard>
    </div>);

}

export default function HrPayroll() {
  return <HrPayrollUi view="section1" PayrollContent={PayrollContent} />;
}
