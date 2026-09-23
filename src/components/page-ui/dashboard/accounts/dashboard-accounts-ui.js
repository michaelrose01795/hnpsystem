// file location: src/components/page-ui/dashboard/accounts/dashboard-accounts-ui.js
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import LayerTheme from "@/components/ui/LayerTheme";
import LayerSurface from "@/components/ui/LayerSurface";
import { SkeletonBlock, SkeletonKeyframes, SkeletonMetricCard, TableSkeleton } from "@/components/ui/LoadingSkeleton";

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
    TransactionTable,
    AccountBalanceTable,
    formatCurrency,
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
        style={{
          display: "grid",
          // 50/50 two-column split on tablet/desktop; collapses to one column under ~840px.
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
          gap: "var(--layout-card-gap)",
          alignItems: "start"
        }}
      >
        <ThemeSection sectionKey="dashboard-accounts-auto-content-card-1" title="Invoice stats">
          {loading ? <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading financial KPIs" style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              {Array.from({ length: 3 }, (_, index) => <SkeletonMetricCard key={index} layer="surface" />)}
            </div> : error ? <p style={{
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

        <ThemeSection sectionKey="dashboard-accounts-auto-content-card-cashflow" title="Cashflow snapshot" subtitle="Movement across customer accounts in the last 7 days">
          {loading ? <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading cashflow" style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              {Array.from({ length: 4 }, (_, index) => <SkeletonMetricCard key={index} layer="surface" />)}
            </div> : error ? <p style={{
        color: "var(--text-accent)"
      }}>{error}</p> : <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px"
      }}>
              <MetricCard label="Revenue received" value={formatCurrency(data.weeklyRevenue)} helper={`${data.paymentsReceived} payments in 7 days`} />
              <MetricCard label="Money out" value={formatCurrency(data.weeklyOutgoing)} helper="Debits in 7 days" />
              <MetricCard label="Outstanding debt" value={formatCurrency(data.outstandingDebt)} helper="Owed across active accounts" />
              <MetricCard label="Accounts at risk" value={data.accountsAtRisk} helper="At/over 80% of credit limit" />
            </div>}
        </ThemeSection>

        <ThemeSection sectionKey="dashboard-accounts-auto-content-card-transactions" title="Recent transactions" subtitle="Latest entries posted to customer accounts">
          {loading ? <TableSkeleton columns={["Date", "Description", "Job", "Method", "Amount"]} rows={5} label="Loading transactions" /> : error ? <p style={{
        color: "var(--text-accent)"
      }}>{error}</p> : <TransactionTable transactions={data.recentTransactions} />}
        </ThemeSection>

        <ThemeSection sectionKey="dashboard-accounts-auto-content-card-balances" title="Credit watchlist" subtitle="Accounts ranked by how much of their credit limit is used">
          {loading ? <TableSkeleton columns={["Account", "Type", "Balance", "Credit limit", "Usage"]} rows={5} label="Loading account balances" /> : error ? <p style={{
        color: "var(--text-accent)"
      }}>{error}</p> : <AccountBalanceTable accounts={data.creditAccounts} />}
        </ThemeSection>

        <ThemeSection sectionKey="dashboard-accounts-auto-content-card-2" title="Outstanding jobs" subtitle="Most recent completions without invoice">
          {loading ? <LayerSurface radius="var(--radius-sm)" padding="12px" gap="10px" role="status" aria-live="polite" aria-busy="true" aria-label="Loading outstanding jobs">
              <SkeletonKeyframes />
              {["42%", "36%", "48%", "40%"].map((width, index) => <div key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <div style={{ display: "grid", gap: "6px", flex: 1, minWidth: 0 }}>
                    <SkeletonBlock width="96px" height="16px" />
                    <SkeletonBlock width={width} height="12px" />
                  </div>
                  <SkeletonBlock width="72px" height="12px" />
                </div>)}
            </LayerSurface> : error ? <p style={{
        color: "var(--text-accent)"
      }}>{error}</p> : <JobList jobs={data.outstandingJobs} />}
        </ThemeSection>

        <ThemeSection sectionKey="dashboard-accounts-auto-content-card-3" title="Payments received trend" subtitle="Report KPI: payments received, last 7 days">
          <TrendBlock data={data.trends} />
        </ThemeSection>
      </DevLayoutSection>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
