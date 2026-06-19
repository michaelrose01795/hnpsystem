// file location: src/components/reporting/accounts/AccountsOverviewTab.js
//
// Accounts Overview: the department scorecard plus the daily / weekly / monthly
// performance summary (the same KPI re-bucketed by the engine at three
// granularities). All values come from /api/reports/* — no maths here. Every
// figure is financial-gated server-side; a non-financial role sees nothing.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import KpiTrendChart from "../KpiTrendChart";
import { useKpiTrend } from "@/hooks/reporting/useReporting";
import { OVERVIEW_SCORECARD } from "./accountsReportConfig";

function PerformanceTrendCard({ kpiId, label, unit, format, filter, granularity, granularityLabel }) {
  const trend = useKpiTrend(kpiId, { ...filter, granularity }, { enabled: true });
  return (
    <LayerSurface radius="var(--radius-sm)" padding="14px" gap="8px">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-1)" }}>{label}</span>
        <span style={{ fontSize: "0.7rem", color: "var(--surfaceTextMuted)" }}>{granularityLabel}</span>
      </div>
      <KpiTrendChart series={trend.series} unit={unit} format={format} height={110} />
    </LayerSurface>
  );
}

export default function AccountsOverviewTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection title="Department scorecard" subtitle="Headline Accounts KPIs for the selected period (live-correct, exact figures — financial-gated).">
        <KpiScorecardStrip kpis={OVERVIEW_SCORECARD} filter={filter} onDrilldown={onDrilldown} showProvenance={false} />
      </ReportSection>

      <ReportSection title="Performance summary" subtitle="Revenue and payments received, re-bucketed daily, weekly and monthly (revenue & payment trends).">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <PerformanceTrendCard kpiId="acc.revenue" label="Revenue (£)" unit="currency" format="£0,0.00" filter={filter} granularity="day" granularityLabel="Daily" />
          <PerformanceTrendCard kpiId="acc.revenue" label="Revenue (£)" unit="currency" format="£0,0.00" filter={filter} granularity="week" granularityLabel="Weekly" />
          <PerformanceTrendCard kpiId="acc.revenue" label="Revenue (£)" unit="currency" format="£0,0.00" filter={filter} granularity="month" granularityLabel="Monthly" />
          <PerformanceTrendCard kpiId="acc.payments_received" label="Payments received (£)" unit="currency" format="£0,0.00" filter={filter} granularity="day" granularityLabel="Daily" />
          <PerformanceTrendCard kpiId="acc.payments_received" label="Payments received (£)" unit="currency" format="£0,0.00" filter={filter} granularity="week" granularityLabel="Weekly" />
          <PerformanceTrendCard kpiId="acc.payments_received" label="Payments received (£)" unit="currency" format="£0,0.00" filter={filter} granularity="month" granularityLabel="Monthly" />
        </div>
      </ReportSection>
    </>
  );
}
