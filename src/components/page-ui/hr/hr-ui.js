// file location: src/components/page-ui/hr/hr-ui.js

export default function HrDashboardUi(props) {
  const {
    HrTabLoadingSkeleton,
    Link,
    MetricCard,
    SectionCard,
    StatusMessage,
    StatusTag,
    activeWarnings,
    departmentPerformance,
    error,
    formattedMetrics,
    isLoading,
    trainingRenewals,
    upcomingAbsences,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <div className="app-page-stack" style={{
  padding: "8px 8px 32px"
}}>
      {isLoading && <HrTabLoadingSkeleton variant="dashboard" />}

      {error && <SectionCard title="Failed to load HR data" subtitle="Mock API returned an error.">
          <StatusMessage tone="danger">{error.message}</StatusMessage>
        </SectionCard>}

      {!isLoading && !error && <>
          <section style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "var(--layout-card-gap)"
    }}>
            {formattedMetrics.map(metric => <MetricCard key={metric.label} {...metric} accentColor="var(--accentMain)" />)}
          </section>

          <section style={{
      display: "grid",
      gap: "var(--layout-card-gap)",
      gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
    }}>
            <SectionCard title="Department Performance Snapshot" subtitle="Productivity, quality, and teamwork scoring (rolling 30 days)">
              <div style={{
          overflowX: "auto"
        }}>
                <table className="app-data-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Productivity</th>
                      <th>Quality</th>
                      <th>Teamwork</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentPerformance.map(dept => <tr key={dept.id}>
                        <td style={{
                  fontWeight: 600
                }}>{dept.department}</td>
                        <td>{dept.productivity}%</td>
                        <td>{dept.quality}%</td>
                        <td>{dept.teamwork}%</td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Training Renewals" subtitle="Upcoming expiries across mandatory certifications" action={<Link href="/hr/training" style={{
        fontSize: "var(--text-label)",
        fontWeight: 600,
        color: "var(--accentText)"
      }}>
                  View all
                </Link>}>
              <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)"
        }}>
                {trainingRenewals.map(renewal => {
            const tone = renewal.status === "Overdue" ? "danger" : renewal.status === "Due Soon" ? "warning" : "default";
            return <div key={renewal.id} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: "var(--space-3)",
              borderBottom: "1px solid var(--border)",
              gap: "var(--space-3)"
            }}>
                      <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-xs)"
              }}>
                        <span style={{
                  fontWeight: 600,
                  color: "var(--text-primary)"
                }}>{renewal.course}</span>
                        <span style={{
                  fontSize: "var(--text-label)",
                  color: "var(--text-secondary)"
                }}>
                          {renewal.employee}
                        </span>
                      </div>
                      <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "var(--space-1)"
              }}>
                        <span style={{
                  fontSize: "var(--text-label)",
                  color: "var(--text-secondary)"
                }}>
                          Due {new Date(renewal.dueDate).toLocaleDateString()}
                        </span>
                        <StatusTag label={renewal.status} tone={tone} />
                      </div>
                    </div>;
          })}
              </div>
            </SectionCard>
          </section>

          <section style={{
      display: "grid",
      gap: "var(--layout-card-gap)",
      gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
    }}>
            <SectionCard title="Upcoming Holidays & Absences" subtitle="Next 14 days across the business" action={<Link href="/hr/leave" style={{
        fontSize: "var(--text-label)",
        fontWeight: 600,
        color: "var(--accentText)"
      }}>
                  Manage leave
                </Link>}>
              <div style={{
          overflowX: "auto"
        }}>
                <table className="app-data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Type</th>
                      <th>Dates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingAbsences.map(absence => <tr key={absence.id}>
                        <td style={{
                  fontWeight: 600
                }}>{absence.employee}</td>
                        <td>{absence.department}</td>
                        <td>{absence.type}</td>
                        <td>
                          {new Date(absence.startDate).toLocaleDateString()} -{" "}
                          {new Date(absence.endDate).toLocaleDateString()}
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Active Warnings" subtitle="Summary of open disciplinary notices" action={<Link href="/hr/disciplinary" style={{
        fontSize: "var(--text-label)",
        fontWeight: 600,
        color: "var(--accentText)"
      }}>
                  Review log
                </Link>}>
              <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)"
        }}>
                {activeWarnings.map(warning => <div key={warning.id} style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
            paddingBottom: "var(--space-3)",
            borderBottom: "1px solid var(--border)"
          }}>
                    <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
                      <span style={{
                fontWeight: 600,
                color: "var(--text-primary)"
              }}>{warning.employee}</span>
                      <StatusTag label={warning.level} tone={warning.level.includes("Final") ? "danger" : "warning"} />
                    </div>
                    <span style={{
              fontSize: "var(--text-label)",
              color: "var(--text-secondary)"
            }}>
                      {warning.department}
                    </span>
                    <span style={{
              fontSize: "var(--text-label)",
              color: "var(--text-secondary)"
            }}>
                      Issued {new Date(warning.issuedOn).toLocaleDateString()}
                    </span>
                    <span style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--text-primary)"
            }}>
                      {warning.notes}
                    </span>
                  </div>)}
              </div>
            </SectionCard>
          </section>
        </>}
    </div>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
