// file location: src/components/page-ui/dashboard/accounts/dashboard-accounts-ui.js

export default function AccountsDashboardUi(props) {
  const {
    JobList,
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
      border: "1px solid var(--accent-purple-surface)"
    }}>
          <p style={{
        margin: 0,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--primary-dark)"
      }}>
            Accounts cockpit
          </p>
          <h1 style={{
        margin: "6px 0 0",
        color: "var(--primary-dark)"
      }}>Invoice performance</h1>
          <p style={{
        margin: "6px 0 0",
        color: "var(--info)"
      }}>
            Track invoices raised, items collected, and jobs awaiting billing.
          </p>
        </header>

        <Section title="Invoice stats">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading financial KPIs…</p> : error ? <p style={{
        color: "var(--primary)"
      }}>{error}</p> : <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px"
      }}>
              <MetricCard label="Invoices raised" value={data.invoicesRaised} helper="Status set to Invoiced" />
              <MetricCard label="Invoices paid" value={data.invoicesPaid} helper="Collected status" />
              <MetricCard label="Outstanding balances" value={data.outstandingJobs.length} helper="Jobs awaiting billing" />
            </div>}
        </Section>

        <Section title="Outstanding jobs" subtitle="Most recent completions without invoice">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading outstanding jobs…</p> : error ? <p style={{
        color: "var(--primary)"
      }}>{error}</p> : <JobList jobs={data.outstandingJobs} />}
        </Section>

        <Section title="Completion trend" subtitle="Jobs completed in the last 7 days">
          <TrendBlock data={data.trends} />
        </Section>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
