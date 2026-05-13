// file location: src/components/page-ui/dashboard/accounts/dashboard-accounts-ui.js
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import LayerTheme from "@/components/ui/LayerTheme";

function ThemeSection({ sectionKey, title, subtitle, children }) {
  return (
    <LayerTheme
      as="section"
      sectionKey={sectionKey}
      parentKey="dashboard-accounts-shell"
      sectionType="content-card"
      backgroundToken="theme"
      gap="12px"
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-accent)" }}>{title}</h2>
        {subtitle && <p style={{ margin: "6px 0 0", color: "var(--text-1)" }}>{subtitle}</p>}
      </div>
      {children}
    </LayerTheme>
  );
}

export default function AccountsDashboardUi(props) {
  const {
    JobList,
    MetricCard,
    TrendBlock,
    data,
    error,
    loading,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <DevLayoutSection
        sectionKey="dashboard-accounts-shell"
        parentKey="app-layout-page-card"
        sectionType="page-shell"
        shell
        backgroundToken="transparent"
        data-dev-text-preview="Accounts dashboard"
        style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)" }}
      >
        <ThemeSection sectionKey="dashboard-accounts-auto-content-card-1" title="Invoice stats">
          {loading ? <p style={{
        color: "var(--text-2)"
      }}>Loading financial KPIs…</p> : error ? <p style={{
        color: "var(--text-accent)"
      }}>{error}</p> : <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px"
      }}>
              <MetricCard label="Invoices raised" value={data.invoicesRaised} helper="Status set to Invoiced" />
              <MetricCard label="Invoices paid" value={data.invoicesPaid} helper="Collected status" />
              <MetricCard label="Outstanding balances" value={data.outstandingJobs.length} helper="Jobs awaiting billing" />
            </div>}
        </ThemeSection>

        <ThemeSection sectionKey="dashboard-accounts-auto-content-card-2" title="Outstanding jobs" subtitle="Most recent completions without invoice">
          {loading ? <p style={{
        color: "var(--text-2)"
      }}>Loading outstanding jobs…</p> : error ? <p style={{
        color: "var(--text-accent)"
      }}>{error}</p> : <JobList jobs={data.outstandingJobs} />}
        </ThemeSection>

        <ThemeSection sectionKey="dashboard-accounts-auto-content-card-3" title="Completion trend" subtitle="Jobs completed in the last 7 days">
          <TrendBlock data={data.trends} />
        </ThemeSection>
      </DevLayoutSection>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
