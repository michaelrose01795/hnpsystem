// file location: src/components/page-ui/dashboard/managers/dashboard-managers-ui.js

export default function ManagersDashboardUi(props) {
  const {
    EscalationList,
    MetricCard,
    ProgressBar,
    Section,
    TrendBlock,
    data,
    error,
    loading,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
        <div style={{
    padding: "48px",
    textAlign: "center",
    color: "var(--primary-selected)"
  }}>
          You do not have access to the Managers dashboard.
        </div>
      </>; // render extracted page section.

    case "section2":
      return <>
      <div>
        <Section title="Combined performance" style={{ background: "var(--theme)" }}>
          {loading ? <p style={{
        color: "var(--info)"
      }}>Gathering completion statistics…</p> : error ? <p style={{
        color: "var(--primary)"
      }}>{error}</p> : <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px"
      }}>
              <MetricCard label="Jobs completed" value={data.counts.jobsCompleted} helper="This week" />
              <MetricCard label="VHCs completed" value={data.counts.vhcsCompleted} helper="This week" />
            </div>}
        </Section>

        <Section title="Approvals & follow ups" style={{ background: "var(--theme)" }}>
          <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px"
      }}>
            <MetricCard label="Parts approvals" value={data.counts.pendingParts} helper="Pending" style={{ background: "var(--surface)" }} />
            <MetricCard label="VHC sign-off" value={data.counts.pendingVhc} helper="Awaiting auth" />
          </div>
        </Section>

        <Section title="Escalations" subtitle="Latest notifications" style={{ background: "var(--theme)" }}>
          <EscalationList items={data.escalations} />
        </Section>

        <Section title="Progress" subtitle="Jobs completed vs started" style={{ background: "var(--theme)" }}>
          <ProgressBar completed={data.progress.completed} target={data.progress.scheduled} />
        </Section>

        <Section title="Completion trend" subtitle="Last 7 days" style={{ background: "var(--theme)" }}>
          <TrendBlock data={data.trend.jobsCompletedLast7} />
        </Section>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
