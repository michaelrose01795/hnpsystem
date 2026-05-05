// file location: src/components/page-ui/dashboard/managers/dashboard-managers-ui.js

export default function ManagersDashboardUi(props) {
  const {
    ContentWidth,
    DevLayoutSection,
    EscalationList,
    MetricCard,
    PageShell,
    ProgressBar,
    Section,
    TrendBlock,
    data,
    error,
    loading,
    metricsGridStyle,
    twoColSplitStyle,
  } = props;

  switch (props.view) {
    case "section1":
      return (
        <div style={{
          padding: "48px",
          textAlign: "center",
          color: "var(--text-1)",
        }}>
          You do not have access to the Managers dashboard.
        </div>
      );

    case "section2":
      return (
        <PageShell sectionKey="managers-dashboard-shell">
          <ContentWidth
            sectionKey="managers-dashboard-content"
            parentKey="managers-dashboard-shell"
            widthMode="content"
            style={{ gap: "10px" }}
          >
            <Section
              sectionKey="managers-dashboard-combined-performance"
              parentKey="managers-dashboard-content"
              title="Combined performance"
            >
              {loading ? (
                <p style={{ margin: 0, color: "var(--text-1)" }}>Gathering completion statistics…</p>
              ) : error ? (
                <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>
              ) : (
                <DevLayoutSection
                  sectionKey="managers-dashboard-combined-performance-grid"
                  parentKey="managers-dashboard-combined-performance"
                  sectionType="grid-card"
                  style={metricsGridStyle}
                >
                  <MetricCard
                    sectionKey="managers-dashboard-metric-jobs-completed"
                    parentKey="managers-dashboard-combined-performance-grid"
                    label="Jobs completed"
                    value={data.counts.jobsCompleted}
                    helper="This week"
                  />
                  <MetricCard
                    sectionKey="managers-dashboard-metric-vhcs-completed"
                    parentKey="managers-dashboard-combined-performance-grid"
                    label="VHCs completed"
                    value={data.counts.vhcsCompleted}
                    helper="This week"
                  />
                </DevLayoutSection>
              )}
            </Section>

            <Section
              sectionKey="managers-dashboard-approvals"
              parentKey="managers-dashboard-content"
              title="Approvals & follow ups"
            >
              <DevLayoutSection
                sectionKey="managers-dashboard-approvals-grid"
                parentKey="managers-dashboard-approvals"
                sectionType="grid-card"
                style={metricsGridStyle}
              >
                <MetricCard
                  sectionKey="managers-dashboard-metric-parts-approvals"
                  parentKey="managers-dashboard-approvals-grid"
                  label="Parts approvals"
                  value={data.counts.pendingParts}
                  helper="Pending"
                />
                <MetricCard
                  sectionKey="managers-dashboard-metric-vhc-signoff"
                  parentKey="managers-dashboard-approvals-grid"
                  label="VHC sign-off"
                  value={data.counts.pendingVhc}
                  helper="Awaiting auth"
                />
              </DevLayoutSection>
            </Section>

            <Section
              sectionKey="managers-dashboard-escalations"
              parentKey="managers-dashboard-content"
              title="Escalations"
              subtitle="Latest notifications"
            >
              <EscalationList
                sectionKey="managers-dashboard-escalations-list"
                parentKey="managers-dashboard-escalations"
                items={data.escalations}
              />
            </Section>

            <DevLayoutSection
              sectionKey="managers-dashboard-analytics-row"
              parentKey="managers-dashboard-content"
              sectionType="section-shell"
              shell
              style={twoColSplitStyle}
            >
              <Section
                sectionKey="managers-dashboard-progress"
                parentKey="managers-dashboard-analytics-row"
                title="Progress"
                subtitle="Jobs completed vs started"
                style={{ height: "100%" }}
              >
                <ProgressBar completed={data.progress.completed} target={data.progress.scheduled} />
              </Section>

              <Section
                sectionKey="managers-dashboard-completion-trend"
                parentKey="managers-dashboard-analytics-row"
                title="Completion trend"
                subtitle="Last 7 days"
                style={{ height: "100%" }}
              >
                <TrendBlock
                  sectionKey="managers-dashboard-completion-trend-chart"
                  parentKey="managers-dashboard-completion-trend"
                  data={data.trend.jobsCompletedLast7}
                />
              </Section>
            </DevLayoutSection>
          </ContentWidth>
        </PageShell>
      );

    default:
      return null;
  }
}
