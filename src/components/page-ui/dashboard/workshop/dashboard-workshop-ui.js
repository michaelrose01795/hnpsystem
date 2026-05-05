// file location: src/components/page-ui/dashboard/workshop/dashboard-workshop-ui.js

export default function WorkshopDashboardUi(props) {
  const {
    ContentWidth,
    DevLayoutSection,
    LayerTheme,
    MetricCard,
    PageShell,
    ProgressBar,
    Section,
    TrendBlock,
    availableTechnicians,
    dashboardData,
    error,
    formatTime,
    listViewportStyle,
    loading,
    twoColSplitStyle,
  } = props;

  switch (props.view) {
    case "section1":
      return (
        <PageShell sectionKey="workshop-dashboard-shell">
          <ContentWidth sectionKey="workshop-dashboard-content" parentKey="workshop-dashboard-shell" widthMode="content">
            <Section sectionKey="workshop-dashboard-daily-checkpoints" parentKey="workshop-dashboard-content" title="Daily checkpoints">
              {loading ? (
                <p style={{ color: "var(--text-1)" }}>Loading today's metrics...</p>
              ) : error ? (
                <p style={{ color: "var(--danger-text)" }}>{error}</p>
              ) : (
                <DevLayoutSection
                  sectionKey="workshop-dashboard-checkpoints-grid"
                  parentKey="workshop-dashboard-daily-checkpoints"
                  sectionType="grid-card"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <MetricCard sectionKey="workshop-dashboard-metric-in-progress" parentKey="workshop-dashboard-checkpoints-grid" label="Jobs in progress" value={dashboardData.dailySummary.inProgress} helper="Vehicles currently on the bay" />
                  <MetricCard sectionKey="workshop-dashboard-metric-checkedin" parentKey="workshop-dashboard-checkpoints-grid" label="Checked in today" value={dashboardData.dailySummary.checkedInToday} helper="Arrivals since midnight" />
                  <MetricCard sectionKey="workshop-dashboard-metric-completed" parentKey="workshop-dashboard-checkpoints-grid" label="Jobs completed" value={dashboardData.dailySummary.completedToday} helper="Finished today" />
                  <MetricCard sectionKey="workshop-dashboard-metric-availability" parentKey="workshop-dashboard-checkpoints-grid" label="Technician availability" value={`${availableTechnicians} / ${dashboardData.technicianAvailability.totalTechnicians}`} helper={`${dashboardData.technicianAvailability.onJobs} techs on jobs`} />
                </DevLayoutSection>
              )}
            </Section>

            <DevLayoutSection sectionKey="workshop-dashboard-analytics-row" parentKey="workshop-dashboard-content" sectionType="section-shell" shell style={twoColSplitStyle}>
              <Section sectionKey="workshop-dashboard-progress" parentKey="workshop-dashboard-analytics-row" title="Progress" subtitle="Completed vs scheduled" style={{ height: "100%", minHeight: "250px" }}>
                <ProgressBar completed={dashboardData.progress.completed} target={dashboardData.progress.scheduled} />
              </Section>

              <Section sectionKey="workshop-dashboard-checkin-trends" parentKey="workshop-dashboard-analytics-row" title="Check-in trends" subtitle="Last 7 days" style={{ height: "100%", minHeight: "250px" }}>
                <TrendBlock sectionKey="workshop-dashboard-checkin-trends-chart" parentKey="workshop-dashboard-checkin-trends" title="Daily check-ins" data={dashboardData.trends.checkInsLast7} />
              </Section>
            </DevLayoutSection>

            <DevLayoutSection sectionKey="workshop-dashboard-worklist-row" parentKey="workshop-dashboard-content" sectionType="section-shell" shell style={twoColSplitStyle}>
              <Section sectionKey="workshop-dashboard-next-jobs-queue" parentKey="workshop-dashboard-worklist-row" title="Next jobs queue" style={{ height: "100%", minHeight: "360px" }}>
                {loading ? (
                  <p style={{ color: "var(--text-1)" }}>Loading queue...</p>
                ) : (
                  <div style={listViewportStyle}>
                    {dashboardData.queue.length === 0 ? (
                      <p style={{ margin: 0, color: "var(--text-1)" }}>No outstanding jobs in the queue.</p>
                    ) : (
                      dashboardData.queue.map((job) => (
                        <LayerTheme
                          key={job.job_number}
                          radius="var(--radius-sm)"
                          padding="12px"
                          gap="8px"
                          style={{ minHeight: "84px" }}
                        >
                          <div>
                            <strong style={{ color: "var(--accentText)", fontSize: "0.95rem" }}>
                              {job.job_number || "-"} - {job.vehicle_reg || "TBC"}
                            </strong>
                            <div style={{ fontSize: "0.85rem", color: "var(--text-1)", marginTop: "4px" }}>
                              {job.status || "Status unknown"}
                            </div>
                          </div>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-1)" }}>
                            Checked in {formatTime(job.checked_in_at)}
                          </span>
                        </LayerTheme>
                      ))
                    )}
                  </div>
                )}
              </Section>

              <Section sectionKey="workshop-dashboard-outstanding-vhc" parentKey="workshop-dashboard-worklist-row" title="Outstanding VHCs" style={{ height: "100%", minHeight: "360px" }}>
                {loading ? (
                  <p style={{ color: "var(--text-1)" }}>Loading VHC backlog...</p>
                ) : dashboardData.outstandingVhc.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--text-1)" }}>No VHCs awaiting completion.</p>
                ) : (
                  <div style={listViewportStyle}>
                    {dashboardData.outstandingVhc.map((job) => (
                      <LayerTheme
                        key={job.job_number}
                        radius="var(--radius-sm)"
                        padding="12px"
                        gap="8px"
                        style={{ minHeight: "84px" }}
                      >
                        <div>
                          <strong style={{ fontSize: "0.95rem" }}>{job.job_number || "-"}</strong>
                          <p style={{ margin: "4px 0 0", color: "var(--text-1)", fontSize: "0.85rem" }}>
                            {job.vehicle_reg || "Registration missing"}
                          </p>
                        </div>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-1)" }}>
                          Checked in {formatTime(job.checked_in_at)}
                        </span>
                      </LayerTheme>
                    ))}
                  </div>
                )}
              </Section>
            </DevLayoutSection>
          </ContentWidth>
        </PageShell>
      );
    default:
      return null;
  }
}
