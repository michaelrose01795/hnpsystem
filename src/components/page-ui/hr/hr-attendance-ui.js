// file location: src/components/page-ui/hr/hr-attendance-ui.js
import { LayerTheme } from "@/components/ui"; // canonical layer primitive (see CLAUDE.md §3.0)
import DataTableShell from "@/components/ui/DataTableShell"; // canonical table scroll shell (CLAUDE.md §3.4)
import { SkeletonBlock, SkeletonKeyframes, TableSkeleton } from "@/components/ui/LoadingSkeleton";

export default function HrAttendanceUi(props) {
  const {
    Button,
    SectionCard,
    StatusMessage,
    StatusTag,
    absenceRecords,
    attendanceLogs,
    error,
    isLoading,
    overtimeSummaries,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <div className="app-page-stack" style={{
  padding: "8px 8px 32px"
}}>
      <header style={{
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)"
  }}>
        <p style={{
      color: "var(--text-1)",
      margin: 0
    }}>
          Monitor time logs, absences, late arrivals, and overtime activity across the team.
        </p>
      </header>

      {isLoading && <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading attendance" style={{
    display: "flex",
    flexDirection: "column",
    gap: "var(--page-stack-gap)"
  }}>
          <SkeletonKeyframes />
          {/* Mirrors the loaded layout: time logs + overtime summary side by side, absence table below. */}
          <section style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
      gap: "var(--layout-card-gap)"
    }}>
            <SectionCard>
              <div style={{
          display: "grid",
          gap: "var(--space-sm)"
        }}>
                <SkeletonBlock width="160px" height="18px" />
                <SkeletonBlock width="240px" height="12px" />
              </div>
              <LayerTheme padding="var(--space-3)" gap="0">
                <TableSkeleton columns={["Employee", "Date", "Clock In", "Clock Out", "Total Hours", "Status"]} rows={5} label="Loading daily time logs" />
              </LayerTheme>
            </SectionCard>
            <SectionCard>
              <div style={{
          display: "grid",
          gap: "var(--space-sm)"
        }}>
                <SkeletonBlock width="170px" height="18px" />
                <SkeletonBlock width="220px" height="12px" />
              </div>
              <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)"
        }}>
                {["62%", "48%", "55%"].map(width => <LayerTheme key={width} radius="var(--radius-sm)" padding="var(--space-3)" gap="var(--space-1)">
                    <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--space-3)"
            }}>
                      <SkeletonBlock width={width} height="16px" />
                      <SkeletonBlock width="64px" height="20px" borderRadius="var(--radius-pill)" />
                    </div>
                    <SkeletonBlock width="40%" height="12px" />
                    <SkeletonBlock width="70%" height="12px" />
                  </LayerTheme>)}
              </div>
            </SectionCard>
          </section>
          <SectionCard>
            <div style={{
        display: "grid",
        gap: "var(--space-sm)"
      }}>
              <SkeletonBlock width="160px" height="18px" />
              <SkeletonBlock width="300px" height="12px" />
            </div>
            <LayerTheme padding="var(--space-3)" gap="0">
              <TableSkeleton columns={["Employee", "Type", "Start", "End", "Status"]} rows={4} label="Loading absence records" />
            </LayerTheme>
          </SectionCard>
        </div>}

      {error && <SectionCard title="Unable to load attendance" subtitle="Mock API returned an error.">
          <StatusMessage tone="danger">{error.message}</StatusMessage>
        </SectionCard>}

      {!isLoading && !error && <>
          <section style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
      gap: "var(--layout-card-gap)"
    }}>
            <SectionCard title="Daily Time Logs" subtitle="Sourced from the workshop clocking system" action={<Button variant="secondary" size="sm">
                  Export CSV
                </Button>}>
              <LayerTheme padding="var(--space-3)" gap="0">
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
                      {attendanceLogs.map(log => <tr key={log.id}>
                          <td style={{
                    fontWeight: 600
                  }}>{log.employeeName || "Unknown user"}</td>
                          <td>{new Date(log.date).toLocaleDateString()}</td>
                          <td>{log.clockIn}</td>
                          <td>{log.clockOut}</td>
                          <td>{Number(log.totalHours).toFixed(1)} hrs</td>
                          <td>
                            <StatusTag label={log.status} tone={log.status === "On Time" ? "success" : log.status === "Overtime" ? "warning" : "default"} />
                          </td>
                        </tr>)}
                    </tbody>
                  </table>
                </DataTableShell>
              </LayerTheme>
            </SectionCard>

            <SectionCard title="Overtime Summary" subtitle="Captured per 26th-to-26th overtime period" action={<Button variant="primary" size="sm">
                  Review Timesheets
                </Button>}>
              <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)"
        }}>
                {overtimeSummaries.map(record => <LayerTheme key={record.id} radius="var(--radius-sm)" padding="var(--space-3)" gap="var(--space-1)">
                    <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
                      <span style={{
                fontWeight: 600,
                color: "var(--text-1)"
              }}>{record.employee}</span>
                      <StatusTag label={record.status} tone={record.status === "Ready" ? "success" : "warning"} />
                    </div>
                    <span style={{
              fontSize: "var(--text-label)",
              color: "var(--text-1)"
            }}>
                      {new Date(record.periodStart).toLocaleDateString()} -{" "}
                      {new Date(record.periodEnd).toLocaleDateString()}
                    </span>
                    <div style={{
              display: "flex",
              gap: "var(--space-md)",
              fontSize: "var(--text-body-sm)",
              color: "var(--text-1)"
            }}>
                      <span>{record.overtimeHours} hrs</span>
                      <span>OT rate £{Number(record.overtimeRate).toFixed(2)}</span>
                      <span>Bonus £{Number(record.bonus).toFixed(0)}</span>
                    </div>
                  </LayerTheme>)}
              </div>
            </SectionCard>
          </section>

          <SectionCard title="Absence Tracking" subtitle="Holiday, sickness, unpaid leave, and other absences" action={<div style={{
      display: "flex",
      gap: "var(--space-2)"
    }}>
                <Button variant="secondary" size="sm">
                  Export PDF
                </Button>
                <Button variant="primary" size="sm">
                  New Absence
                </Button>
              </div>}>
            <LayerTheme padding="var(--space-3)" gap="0">
              <DataTableShell>
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
                    {absenceRecords.map(absence => <tr key={absence.id}>
                        <td style={{
                  fontWeight: 600
                }}>{absence.employee}</td>
                        <td>{absence.type}</td>
                        <td>{new Date(absence.startDate).toLocaleDateString()}</td>
                        <td>{new Date(absence.endDate).toLocaleDateString()}</td>
                        <td>
                          <StatusTag label={absence.approvalStatus} tone={absence.approvalStatus === "Approved" ? "success" : "warning"} />
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </DataTableShell>
            </LayerTheme>
          </SectionCard>
        </>}
    </div>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
