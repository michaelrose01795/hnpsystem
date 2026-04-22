// file location: src/components/page-ui/dashboard/mot/dashboard-mot-ui.js

export default function MotDashboardUi(props) {
  const {
    CardList,
    MetricCard,
    Section,
    TrendBlock,
    data,
    error,
    loading,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <div>
        <header className="app-section-card" style={{
      background: "var(--surface-light)"
    }}>
          <p style={{
        margin: 0,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--primary-dark)"
      }}>
            MOT workspace
          </p>
          <h1 style={{
        margin: "6px 0 0",
        color: "var(--primary-dark)"
      }}>Today's test board</h1>
          <p style={{
        margin: "6px 0 0",
        color: "var(--info)"
      }}>
            Track pass/fail rates, retests, and the queue for testers.
          </p>
        </header>

        <Section title="Daily MOT tally">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading daily totals…</p> : error ? <p style={{
        color: "var(--primary)"
      }}>{error}</p> : <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px"
      }}>
              <MetricCard label="Tests today" value={data.testsToday} helper="Checked in today" />
              <MetricCard label="Passed" value={data.passCount} helper="Completion includes pass" />
              <MetricCard label="Failed" value={data.failCount} helper="Status includes fail" />
              <MetricCard label="Retests" value={data.retestCount} helper="Needs follow-up" />
            </div>}
        </Section>

        <Section title="Recent MOT jobs" subtitle="Latest registered jobs">
          <CardList title="Recent MOTs" items={data.recentTests} />
        </Section>

        <Section title="Trend" subtitle="Tests checked in over the last 7 days">
          <TrendBlock data={data.trends} />
        </Section>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
