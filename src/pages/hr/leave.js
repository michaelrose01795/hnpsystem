// file location: src/pages/hr/leave.js
import React from "react";
import { useHrOperationsData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section";
import { Button, LayerSurface, StatusMessage } from "@/components/ui"; // LayerSurface: third rung — nested inside a --theme SectionCard (CLAUDE.md §3.0a-2)
import { StatusTag } from "@/components/HR/MetricCard";
import { SkeletonBlock, SkeletonTableRow, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import { redirectToHrManagerTab } from "@/lib/hr/hrManagerRoutes";
import DataTableShell from "@/components/ui/DataTableShell"; // canonical table scroll shell (CLAUDE.md §3.4)
import EmptyState from "@/components/ui/EmptyState"; // canonical empty-state primitive
import HrSummaryStrip from "@/components/HR/HrSummaryStrip"; // shared at-a-glance metric strip
import { buildLeaveSummary } from "@/lib/hr/hrTabSummaries";

export function getServerSideProps() {
  return redirectToHrManagerTab("leave");
}

// Structured skeleton body used inside each SectionCard while leave data loads.
// Rendered in place of the table rows / list rows so the outer page shell —
// header row, action buttons, section grid, card headings — stays mounted and
// the user sees the final layout from the first frame.
import HrLeaveManagementUi from "@/components/page-ui/hr/hr-leave-ui"; // Extracted presentation layer.
function TableRowsSkeleton({ rows = 5, cols = 5 }) {return (
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
        gap="var(--space-xs)">

          <SkeletonBlock width="58%" height="14px" />
          <SkeletonBlock width="72%" height="12px" />
        </LayerSurface>
      )}
    </div>);

}

function LeaveContent() {
  const { data, isLoading, error } = useHrOperationsData();

  const leaveRequests = data?.leaveRequests ?? [];
  const leaveBalances = data?.leaveBalances ?? [];
  const upcomingAbsences = data?.upcomingAbsences ?? [];

  // Approval queue, cover risk, and remaining entitlement — the three things a
  // manager checks before they open a single request below.
  const summary = buildLeaveSummary({ leaveRequests, leaveBalances, upcomingAbsences });

  if (error) {
    return (
      <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
        <SectionCard layer="theme"
          sectionKey="hr-leave-error" parentKey="hr-manager-tab-leave" title="Unable to load leave data" subtitle="Mock API returned an error.">
          <StatusMessage tone="danger">{error.message}</StatusMessage>
        </SectionCard>
      </div>);

  }

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <SkeletonKeyframes />
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
        <p style={{ color: "var(--text-1)", margin: 0 }}>
          Approve leave requests, calculate balances, and track special leave programmes.
        </p>
        <Button variant="primary">+ New Leave Request</Button>
      </header>

      {isLoading ? null : <HrSummaryStrip items={summary} parentKey="hr-manager-tab-leave" />}

      <SectionCard layer="theme"
        sectionKey="hr-leave-pending-requests" parentKey="hr-manager-tab-leave"
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
        }>
        
        <LayerSurface padding="var(--space-3)" gap="0">
          <DataTableShell>
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
                {isLoading ?
                <TableRowsSkeleton rows={5} cols={5} /> :

                leaveRequests.length === 0 ?
                <tr>
                  <td colSpan={5}>
                    <EmptyState variant="bare" icon="📥" title="No leave requests" description="Requests appear here as employees submit them." />
                  </td>
                </tr> :

                leaveRequests.map((request) =>
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
                      request.status === "Approved" ?
                      "success" :
                      request.status === "Pending" ?
                      "warning" :
                      "default"
                      } />
                    
                      </td>
                      <td>{request.approver}</td>
                    </tr>
                )
                }
              </tbody>
            </table>
          </DataTableShell>
        </LayerSurface>
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-leave-team-availability" parentKey="hr-manager-tab-leave" title="Team Availability" subtitle="Upcoming leave by date range">
        {isLoading ?
        <ListRowsSkeleton rows={3} /> :

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {upcomingAbsences.map((absence) =>
          <LayerSurface
            key={absence.id}
            radius="var(--radius-sm)"
            padding="var(--space-3)"
            gap="var(--space-xs)">

                <span style={{ fontWeight: 600, color: "var(--text-1)" }}>
                  {absence.employee} • {absence.department}
                </span>
                <span style={{ fontSize: "var(--text-label)", color: "var(--text-1)" }}>
                  {absence.type} from {new Date(absence.startDate).toLocaleDateString()} to{" "}
                  {new Date(absence.endDate).toLocaleDateString()}
                </span>
              </LayerSurface>
          )}
          </div>
        }
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-leave-balances" parentKey="hr-manager-tab-leave" title="Leave Balances" subtitle="Entitlement vs. taken time off">
        <LayerSurface padding="var(--space-3)" gap="0">
          <DataTableShell>
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
                {isLoading ?
                <TableRowsSkeleton rows={5} cols={5} /> :

                leaveBalances.length === 0 ?
                <tr>
                  <td colSpan={5}>
                    <EmptyState variant="bare" icon="🏖️" title="No leave balances" description="Entitlement and days taken appear here once employees are on the system." />
                  </td>
                </tr> :

                leaveBalances.map((balance) =>
                <tr key={balance.employeeId}>
                      <td style={{ fontWeight: 600 }}>{balance.employee}</td>
                      <td>{balance.department}</td>
                      <td>{balance.entitlement} days</td>
                      <td>{balance.taken} days</td>
                      <td>{balance.remaining} days</td>
                    </tr>
                )
                }
              </tbody>
            </table>
          </DataTableShell>
        </LayerSurface>
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-leave-calendar-sync" parentKey="hr-manager-tab-leave"
        title="Calendar Sync & Notifications"
        subtitle="Push approved leave to shared calendars and notify relevant managers">
        
        <ul
          style={{
            margin: 0,
            padding: "0 var(--space-md)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-sm)"
          }}>
          
          <li style={{ color: "var(--text-1)" }}>
            Enable per-department calendar feeds (Google / Outlook) for leave visibility.
          </li>
          <li style={{ color: "var(--text-1)" }}>
            Configure auto-notifications for approvals, rejections, and upcoming return dates.
          </li>
          <li style={{ color: "var(--text-1)" }}>
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
    </div>);

}

export default function HrLeaveManagement({ embedded = false } = {}) {
  return <HrLeaveManagementUi view="section1" LeaveContent={LeaveContent} />;
}
