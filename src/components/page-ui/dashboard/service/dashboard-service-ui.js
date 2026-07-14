// file location: src/components/page-ui/dashboard/service/dashboard-service-ui.js

// ThemeCard — local card primitive for this dashboard. Renders a LayerTheme-backed
// surface (var(--theme)) with an optional title/subtitle. Used for every tile on
// this page so the whole grid sits on a consistent `--theme` background.
function ThemeCard({ LayerTheme, title, subtitle, children, sectionKey, parentKey }) {
  return (
    <LayerTheme
      radius="var(--radius-md)"
      padding="var(--section-card-padding)"
      gap="14px"
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="content-card"
      style={{ minWidth: 0 }}
    >
      {(title || subtitle) && (
        <div>
          {title && (
            <h2 style={{ margin: 0, fontSize: "1.05rem", color: "var(--text-accent)" }}>
              {title}
            </h2>
          )}
          {subtitle && (
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-2)" }}>
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </LayerTheme>
  );
}

export default function ServiceDashboardUi(props) {
  const {
    LayerTheme,
    MetricCard,
    PieChart,
    ProgressBar,
    QueueItem,
    TrendBlock,
    data,
    error,
    loading,
  } = props;

  switch (props.view) {
    case "section1":
      return (
        <div
          style={{
            width: "100%",
            maxWidth: "100%",
            padding: "8px 0",
            color: "var(--text-1)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Top row — three compact summary tiles, equal width on desktop. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              width: "100%",
            }}
          >
            <ThemeCard
              LayerTheme={LayerTheme}
              sectionKey="dashboard-service-appointments-today"
              parentKey="app-layout-page-card"
              title="Appointments today"
            >
              {loading ? (
                <p style={{ margin: 0, color: "var(--text-2)" }}>Counting today&apos;s arrivals…</p>
              ) : error ? (
                <p style={{ margin: 0, color: "var(--text-accent)" }}>{error}</p>
              ) : (
                <MetricCard
                  label="Appointments today"
                  value={data.appointmentsToday}
                  helper="Scheduled between 00:00 and midnight"
                />
              )}
            </ThemeCard>

            <ThemeCard
              LayerTheme={LayerTheme}
              sectionKey="dashboard-service-progress"
              parentKey="app-layout-page-card"
              title="Progress"
              subtitle="Jobs completed vs checked in"
            >
              <ProgressBar completed={data.progress.completed} target={data.progress.scheduled} />
            </ThemeCard>

            <ThemeCard
              LayerTheme={LayerTheme}
              sectionKey="dashboard-service-waiting-mix"
              parentKey="app-layout-page-card"
              title="Waiting mix"
              subtitle="Loan, waiting, and collection split"
            >
              <PieChart breakdown={data.waitingBreakdown} />
            </ThemeCard>
          </div>

          {/* Bottom block — 2 rows × 2 columns, locked 50/50 on desktop/tablet,
              collapses to a single column on narrow phones. Independent of the
              top row's grid so its column count never inherits from above. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))",
              gridAutoRows: "minmax(0, auto)",
              gap: "16px",
              width: "100%",
            }}
          >
            <ThemeCard
              LayerTheme={LayerTheme}
              sectionKey="dashboard-service-appointment-trends"
              parentKey="app-layout-page-card"
              title="Booking volume trend"
              subtitle="Report KPI: booking volume, last 7 days"
            >
              <TrendBlock data={data.appointmentTrends} />
            </ThemeCard>

            <ThemeCard
              LayerTheme={LayerTheme}
              sectionKey="dashboard-service-vhc-severity"
              parentKey="app-layout-page-card"
              title="VHC severity"
              subtitle="Weekly breakdown"
            >
              {data.vhcSeverityTrend.length === 0 ? (
                <p style={{ margin: 0, color: "var(--text-2)" }}>No VHC data for the week yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {data.vhcSeverityTrend.map((point) => {
                    const total = point.red + point.amber + point.green || 1;
                    return (
                      <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: 35, fontSize: "0.85rem", color: "var(--text-2)" }}>
                          {point.label}
                        </span>
                        <div style={{ flex: 1, height: 8, background: "var(--surface)", borderRadius: 4 }}>
                          <div
                            style={{
                              position: "relative",
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              borderRadius: 4,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.round((point.red / total) * 100)}%`,
                                background: "var(--danger)",
                              }}
                            />
                            <div
                              style={{
                                width: `${Math.round((point.amber / total) * 100)}%`,
                                background: "var(--warning)",
                              }}
                            />
                            <div
                              style={{
                                width: `${Math.round((point.green / total) * 100)}%`,
                                background: "var(--success)",
                              }}
                            />
                          </div>
                        </div>
                        <strong style={{ color: "var(--text-accent)", fontSize: "0.85rem" }}>
                          {total}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              )}
            </ThemeCard>

            <ThemeCard
              LayerTheme={LayerTheme}
              sectionKey="dashboard-service-upcoming-jobs"
              parentKey="app-layout-page-card"
              title="Upcoming jobs"
            >
              {data.upcomingJobs.length === 0 ? (
                <p style={{ margin: 0, color: "var(--text-2)" }}>No upcoming jobs right now.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {data.upcomingJobs.map((job) => (
                    <QueueItem key={job.id} job={job} />
                  ))}
                </div>
              )}
            </ThemeCard>

            <ThemeCard
              LayerTheme={LayerTheme}
              sectionKey="dashboard-service-vhc-approvals"
              parentKey="app-layout-page-card"
              title="VHCs awaiting approval"
            >
              {data.awaitingVhc.length === 0 ? (
                <p style={{ margin: 0, color: "var(--text-2)" }}>No pending VHC approvals.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {data.awaitingVhc.map((job) => (
                    <QueueItem key={job.id} job={job} />
                  ))}
                </div>
              )}
            </ThemeCard>
          </div>
        </div>
      );
    default:
      return null;
  }
}
