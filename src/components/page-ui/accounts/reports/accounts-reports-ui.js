// file location: src/components/page-ui/accounts/reports/accounts-reports-ui.js
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import { Dropdown } from "@/components/ui/dropdownAPI"; // canonical dropdown
import { MonthPicker } from "@/components/ui/monthPickerAPI"; // canonical month picker
import { SearchBar } from "@/components/ui/searchBarAPI"; // canonical search bar

export default function AccountsReportsPageUi(props) {
  const {
    Button,
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
    searchText,
    selectedMonth,
    selectedQuarter,
    selectedYear,
    setActivePeriod,
    setSearchText,
    setSelectedMonth,
    setSelectedQuarter,
    setSelectedYear,
  } = props; // receive page logic props.

  const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
  const currentYear = new Date().getFullYear();
  const YEARS = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(String);

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={REPORT_ROLES}>
      <>
        <DevLayoutSection as="div" sectionKey="accounts-reports-page-shell" sectionType="page-shell" backgroundToken="page-card-bg" shell className="app-layout-page-shell" style={{
      gap: "20px"
    }}>
          <ToolbarRow style={{
        justifyContent: "flex-start",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap"
      }}>
            {/* Period selector — canonical Dropdown */}
            <div style={{ flex: "0 0 160px" }}>
              <Dropdown
                aria-label="Report period"
                placeholder="Period"
                value={activePeriod}
                options={REPORT_PERIODS.map(period => ({ value: period.value, label: period.label }))}
                onChange={(selected) => setActivePeriod(typeof selected === "object" ? selected?.value : selected)}
              />
            </div>

            {/* Period-specific filter */}
            {activePeriod === "monthly" && (
              <div style={{ flex: "0 0 180px" }}>
                <MonthPicker
                  aria-label="Month"
                  value={selectedMonth || ""}
                  onChange={(event) => setSelectedMonth(event?.target?.value || "")}
                />
              </div>
            )}
            {activePeriod === "quarterly" && (
              <div className="app-layout-tab-row" role="group" aria-label="Quarter" style={{ flex: "0 0 auto" }}>
                {QUARTERS.map(q => {
                  const isActive = selectedQuarter === q;
                  return <button
                    key={q}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setSelectedQuarter(q)}
                    className={`app-tab app-tab--segmented${isActive ? " is-active" : ""}`}>
                    {q}
                  </button>;
                })}
              </div>
            )}
            {activePeriod === "yearly" && (
              <div className="app-layout-tab-row" role="group" aria-label="Year" style={{ flex: "0 0 auto" }}>
                {YEARS.map(y => {
                  const isActive = selectedYear === y;
                  return <button
                    key={y}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setSelectedYear(y)}
                    className={`app-tab app-tab--segmented${isActive ? " is-active" : ""}`}>
                    {y}
                  </button>;
                })}
              </div>
            )}

            {/* Search — canonical SearchBar; shrinks so the rest of the row stays visible */}
            <SearchBar
              placeholder="Search…"
              aria-label="Search reports"
              value={searchText || ""}
              onChange={(event) => setSearchText(event.target.value)}
              onClear={() => setSearchText("")}
              style={{ flex: "1 1 120px", minWidth: "100px" }}
            />

            {/* Export — push to far right */}
            <Button variant="secondary" size="sm" onClick={handleExport} style={{ marginLeft: "auto" }}>
              Export Summary
            </Button>
          </ToolbarRow>

          {loading && <p style={{
        color: "var(--text-1)",
        margin: 0
      }}>Loading reports…</p>}

          {!loading && <>
              <LayerTheme as="section" sectionKey="accounts-reports-metrics-shell" sectionType="content-card" parentKey="accounts-reports-page-shell" style={metricsShellStyle}>
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
            }).format(current.averageBalance || 0), "var(--success-text)")}
                </div>
              </LayerTheme>

              <LayerTheme as="section" sectionKey="accounts-reports-highlights-card" sectionType="content-card" parentKey="accounts-reports-page-shell" style={{
          gap: "12px"
        }}>
                <div style={{
            fontWeight: 700,
            fontSize: "var(--text-h3)",
            color: "var(--text-accent)"
          }}>Highlights</div>
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
              </LayerTheme>
            </>}
        </DevLayoutSection>
      </>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
