// file location: src/components/reporting/accounts/AccountsReceivablesTab.js
//
// Payments & Receivables: payments received, account balances, accounts
// receivable and credit exposure. Payments received is a flow KPI (trended);
// AR / balances / credit exposure are point-in-time (value + drill-down, no
// trend — the engine ignores the date range for these, so a trend would be a
// flat line). Engine-served throughout.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import { RECEIVABLES_KPIS } from "./accountsReportConfig";

export default function AccountsReceivablesTab({ filter }) {
  return (
    <ReportSection
      title="Payments & receivables"
      subtitle="Cash collected (trended), and the point-in-time receivables book: net AR, active-account balances and credit exposure (≥80% of limit). Each links to its contributing records."
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        {RECEIVABLES_KPIS.map((kpi) => (
          <KpiPanel
            key={kpi.id}
            kpi={kpi}
            filter={filter}
            // Only the flow KPI (payments received) is trended; the point-in-time
            // balances are shown as value + drill-down (a trend would be flat).
            withTrend={kpi.id === "acc.payments_received"}
            withDrilldown={kpi.hasDrilldown}
          />
        ))}
      </div>
    </ReportSection>
  );
}
