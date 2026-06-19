// file location: src/components/reporting/accounts/AccountsRevenueTab.js
//
// Revenue & Invoicing: revenue (total / labour / parts), invoice volume,
// outstanding invoices and revenue monitoring. KPI panels (value + trend +
// drill-down) for the revenue family, plus the point-in-time outstanding-invoice
// pipeline drill-down (the invoice volume awaiting collection). Engine-served
// throughout — no KPI maths in the client.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import ReportDrilldownTable from "../ReportDrilldownTable";
import { REVENUE_KPIS, INVOICE_VOLUME } from "./accountsReportConfig";

export default function AccountsRevenueTab({ filter }) {
  return (
    <>
      <ReportSection title="Revenue & revenue monitoring" subtitle="Total, labour and parts revenue invoiced — each with daily/weekly/monthly trend per the filter and the invoices behind it.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {REVENUE_KPIS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend withDrilldown />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Invoice volume & outstanding invoices" subtitle="Point-in-time unpaid invoice pipeline — count and value of invoices in Sent/Overdue (exact, not truncated).">
        <ReportDrilldownTable kpiId={INVOICE_VOLUME.id} label={INVOICE_VOLUME.label} filter={filter} />
      </ReportSection>
    </>
  );
}
