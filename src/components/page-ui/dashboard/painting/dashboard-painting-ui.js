// file location: src/components/page-ui/dashboard/painting/dashboard-painting-ui.js

export default function PaintingDashboardUi(props) {
  const {
    MetricCard,
    QueueList,
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
      background: "var(--warning-surface)",
      border: "1px solid var(--warning)"
    }}>
          <p style={{
        margin: 0,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--primary-dark)"
      }}>
            Painting studio
          </p>
          <h1 style={{
        margin: "6px 0 0",
        color: "var(--primary-dark)"
      }}>Bodyshop queue</h1>
          <p style={{
        margin: "6px 0 0",
        color: "var(--info)"
      }}>
            Track paint jobs waiting on the bay and pull estimated finish times directly from job timestamps.
          </p>
        </header>

        <Section title="Bodyshop jobs">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading bodyshop jobs…</p> : error ? <p style={{
        color: "var(--primary)"
      }}>{error}</p> : <MetricCard label="Bodyshop jobs" value={data.bodyshopCount} helper="Jobs requiring bodywork" />}
        </Section>

        <Section title="Paint queue" subtitle="Jobs still in progress">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading queue…</p> : error ? <p style={{
        color: "var(--primary)"
      }}>{error}</p> : <QueueList queue={data.queue} />}
        </Section>

        <Section title="Queue trend" subtitle="Recent workshop starts">
          <TrendBlock data={data.trends} />
        </Section>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
