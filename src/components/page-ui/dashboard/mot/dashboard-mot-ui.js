// file location: src/components/page-ui/dashboard/mot/dashboard-mot-ui.js

export default function MotDashboardUi(props) {
  const {
    CardList,
    LayerTheme,
    MetricCard,
    TrendBlock,
    data,
    error,
    loading,
  } = props; // receive page logic props.

  const MotSection = ({ title, subtitle, children }) => (
    <LayerTheme as="section" className="app-section-card" gap="12px">
      <div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-accent)" }}>{title}</h2>
        {subtitle && <p style={{ margin: "6px 0 0", color: "var(--text-2)" }}>{subtitle}</p>}
      </div>
      {children}
    </LayerTheme>
  );

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return (
        <div>
          <MotSection title="Daily MOT tally">
            {loading ? (
              <p style={{ color: "var(--text-2)" }}>Loading daily totals...</p>
            ) : error ? (
              <p style={{ color: "var(--text-accent)" }}>{error}</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                <MetricCard label="Tests today" value={data.testsToday} helper="Checked in today" />
                <MetricCard label="Passed" value={data.passCount} helper="Completion includes pass" />
                <MetricCard label="Failed" value={data.failCount} helper="Status includes fail" />
                <MetricCard label="Retests" value={data.retestCount} helper="Needs follow-up" />
              </div>
            )}
          </MotSection>

          <MotSection title="Recent MOT jobs" subtitle="Latest registered jobs">
            <CardList title="Recent MOTs" items={data.recentTests} />
          </MotSection>

          <MotSection title="Trend" subtitle="Tests checked in over the last 7 days">
            <TrendBlock data={data.trends} />
          </MotSection>
        </div>
      ); // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
