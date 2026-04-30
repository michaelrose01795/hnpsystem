// file location: src/components/page-ui/accounts/reports/accounts-reports-ui.js

export default function AccountsReportsPageUi(props) {
  const {
    Button,
    Card,
    DevLayoutSection,
    ProtectedRoute,
    REPORT_PERIODS,
    REPORT_ROLES,
    ToolbarRow,
    activePeriod,
    current,
    handleExport,
    loading,
    metricCard,
    metricsGridStyle,
    metricsShellStyle,
    setActivePeriod,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={REPORT_ROLES}>
      <>
        <DevLayoutSection as="div" sectionKey="accounts-reports-page-shell" sectionType="page-shell" backgroundToken="page-card-bg" shell className="app-layout-page-shell" style={{
      gap: "20px"
    }}>
          <DevLayoutSection as="section" sectionKey="accounts-reports-toolbar" sectionType="content-card" parentKey="accounts-reports-page-shell" backgroundToken="surface" className="app-section-card">
            <ToolbarRow style={{
          justifyContent: "space-between",
          alignItems: "center"
        }}>
              <div className="app-toolbar-row" style={{
            flex: "1 1 auto",
            flexWrap: "nowrap",
            justifyContent: "flex-start",
            overflowX: "auto",
            maxWidth: "calc(100% - 180px)"
          }}>
                {REPORT_PERIODS.map(period => {
              const isActive = activePeriod === period.value;
              return <Button key={period.value} onClick={() => setActivePeriod(period.value)} variant={isActive ? "primary" : "secondary"} size="sm" pill>
                      {period.label}
                    </Button>;
            })}
              </div>
              <Button variant="secondary" size="sm" onClick={handleExport}>
                Export Summary
              </Button>
            </ToolbarRow>
          </DevLayoutSection>

          {loading && <p style={{
        color: "var(--text-1)",
        margin: 0
      }}>Loading reports…</p>}

          {!loading && <>
              <DevLayoutSection as="section" sectionKey="accounts-reports-metrics-shell" sectionType="content-card" parentKey="accounts-reports-page-shell" backgroundToken="accent" className="app-layout-surface-accent" style={metricsShellStyle}>
                <div style={metricsGridStyle}>
                  {metricCard("accounts-reports-auto-content-card-2", "New Accounts", current.newAccounts ?? 0)}
                  {metricCard("accounts-reports-auto-content-card-3", "Total Invoiced", new Intl.NumberFormat("en-GB", {
              style: "currency",
              currency: "GBP"
            }).format(current.totalInvoiced || 0))}
                  {metricCard("accounts-reports-auto-content-card-4", "Overdue Invoices", current.overdueInvoices ?? 0, "var(--warning-text)")}
                  {metricCard("accounts-reports-auto-content-card-5", "Average Balance", new Intl.NumberFormat("en-GB", {
              style: "currency",
              currency: "GBP"
            }).format(current.averageBalance || 0), "#0f766e")}
                </div>
              </DevLayoutSection>

              <DevLayoutSection as="section" sectionKey="accounts-reports-highlights-card" sectionType="content-card" parentKey="accounts-reports-page-shell" backgroundToken="surface">
                <Card title="Highlights" className="" style={{
            background: "var(--surface)",
            gap: "12px"
          }}>
                  <ul style={{
              margin: 0,
              paddingLeft: "20px",
              color: "var(--text-1)",
              lineHeight: 1.6
            }}>
                    <li>{current.newAccounts ?? 0} new accounts opened during this period.</li>
                    <li>{new Intl.NumberFormat("en-GB", {
                  style: "currency",
                  currency: "GBP"
                }).format(current.totalInvoiced || 0)} invoiced with {current.overdueInvoices ?? 0} overdue follow-ups.</li>
                    <li>Average balance stands at {new Intl.NumberFormat("en-GB", {
                  style: "currency",
                  currency: "GBP"
                }).format(current.averageBalance || 0)} for the selected period.</li>
                  </ul>
                </Card>
              </DevLayoutSection>
            </>}
        </DevLayoutSection>
      </>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
