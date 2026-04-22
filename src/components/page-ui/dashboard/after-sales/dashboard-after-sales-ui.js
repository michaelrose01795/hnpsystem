// file location: src/components/page-ui/dashboard/after-sales/dashboard-after-sales-ui.js

export default function AfterSalesDashboardUi(props) {
  const {
    FollowUpList,
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
    color: "var(--primary-dark)"
  }}>
          You do not have access to the after sales dashboard.
        </div>
      </>; // render extracted page section.

    case "section2":
      return <>
      <div>
        <header className="app-section-card" style={{
      background: "var(--surface-light)"
    }}>
          <p style={{
        margin: 0,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--primary-dark)"
      }}>
            After sales performance
          </p>
          <h1 style={{
        margin: "6px 0 0",
        color: "var(--primary-dark)"
      }}>Combined workshop + VHC view</h1>
          <p style={{
        margin: "6px 0 0",
        color: "var(--info)"
      }}>
            Keep the customer journey humming — jobs, VHCs, and approvals in one pane.
          </p>
        </header>

        <Section title="Combined performance">
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

        <Section title="Follow-up calls needed" subtitle="Statuses containing follow or call">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading follow-ups…</p> : error ? <p style={{
        color: "var(--primary)"
      }}>{error}</p> : <FollowUpList items={data.followUps} />}
        </Section>

        <Section title="Approvals needed">
          <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px"
      }}>
            <MetricCard label="Parts approvals" value={data.counts.pendingParts} helper="Pending requests" />
            <MetricCard label="VHC sign-off" value={data.counts.pendingVhc} helper="Awaiting auth" />
          </div>
        </Section>

        <Section title="Completion trend" subtitle="Jobs completed last 7 days">
          <TrendBlock data={data.trend.jobsCompletedLast7} />
        </Section>

        <Section title="Progress" subtitle="Jobs completed vs started">
          <ProgressBar completed={data.progress.completed} target={data.progress.scheduled} />
        </Section>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
