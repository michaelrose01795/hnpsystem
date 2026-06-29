// file location: src/components/reporting/accounts/AccountsOperationsTab.js
//
// Financial Operations: financial activity (the collection / receivables KPIs),
// invoice processing, and the revenue / payment trends. Plus the declared R2/R3
// readiness indicators (DSO, invoice ageing, payment conversion, profitability,
// gross/net profit) so the gap is explicit, not hidden. Engine-served throughout.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import KpiTrendChart from "../KpiTrendChart";
import { useKpiTrend } from "@/hooks/reporting/useReporting";
import { FINANCIAL_ACTIVITY, OPERATIONS_READINESS } from "./accountsReportConfig";
import { reportDevKey } from "../reportDevOverlay";

function TrendCard({ kpiId, label, unit, format, filter, granularity, granularityLabel }) {
  const trend = useKpiTrend(kpiId, { ...filter, granularity }, { enabled: true });
  const devSectionKey = reportDevKey("report-trend-card", `${kpiId}-${granularity}`);
  return (
    <LayerSurface radius="var(--radius-sm)" padding="14px" gap="8px" sectionKey={devSectionKey} data-dev-text-preview={`${label} ${granularityLabel}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-1)" }}>{label}</span>
        <span style={{ fontSize: "0.7rem", color: "var(--surfaceTextMuted)" }}>{granularityLabel}</span>
      </div>
      <KpiTrendChart series={trend.series} unit={unit} format={format} height={110} loading={trend.loading} sectionKey={`${devSectionKey}-chart`} parentKey={devSectionKey} />
    </LayerSurface>
  );
}

export default function AccountsOperationsTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection title="Financial activity" subtitle="Collection and receivables activity across the period — payments, the open invoice pipeline, balances and exposure.">
        <KpiScorecardStrip kpis={FINANCIAL_ACTIVITY} filter={filter} onDrilldown={onDrilldown} minCardWidth={220} />
      </ReportSection>

      <ReportSection title="Revenue & payment trends" subtitle="Invoiced revenue and cash collected, re-bucketed daily / weekly / monthly.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <TrendCard kpiId="acc.revenue" label="Revenue (£)" unit="currency" format="£0,0.00" filter={filter} granularity="day" granularityLabel="Daily" />
          <TrendCard kpiId="acc.revenue" label="Revenue (£)" unit="currency" format="£0,0.00" filter={filter} granularity="week" granularityLabel="Weekly" />
          <TrendCard kpiId="acc.payments_received" label="Payments (£)" unit="currency" format="£0,0.00" filter={filter} granularity="day" granularityLabel="Daily" />
          <TrendCard kpiId="acc.payments_received" label="Payments (£)" unit="currency" format="£0,0.00" filter={filter} granularity="week" granularityLabel="Weekly" />
        </div>
      </ReportSection>

      <ReportSection
        title="Invoice processing & financial readiness indicators"
        subtitle="Declared in the catalogue — DSO, invoice ageing and payment conversion light up once invoice status-history accrues (R2); profitability needs the department dimension + cost inputs (R2); gross/net profit need COGS and an opex model (R3)."
      >
        <KpiScorecardStrip kpis={OPERATIONS_READINESS} filter={filter} onDrilldown={onDrilldown} minCardWidth={220} />
      </ReportSection>
    </>
  );
}
