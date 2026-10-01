// file location: src/components/reporting/parts/PartsOverviewTab.js
//
// Parts Overview: the department scorecard plus the daily / weekly / monthly
// performance summary (the same KPI re-bucketed by the engine at three
// granularities). All values come from /api/reports/* — no maths here.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import KpiTrendChart from "../KpiTrendChart";
import { useKpiTrend } from "@/hooks/reporting/useReporting";
import { OVERVIEW_SCORECARD } from "./partsReportConfig";
import { reportDevKey } from "../reportDevOverlay";

function PerformanceTrendCard({ kpiId, label, unit, format, filter, granularity, granularityLabel }) {
  const trend = useKpiTrend(kpiId, { ...filter, granularity }, { enabled: true });
  const devSectionKey = reportDevKey("report-trend-card", `${kpiId}-${granularity}`);
  // Trend card: a measure's name, its time grouping and a small chart of its values over time.
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

export default function PartsOverviewTab({ filter, onDrilldown }) {
  return (
    <>
      {/* Department scorecard: the headline parts figures for the selected period. */}
      <ReportSection title="Department scorecard" subtitle="Headline Parts KPIs for the selected period (live-correct, exact counts).">
        <KpiScorecardStrip kpis={OVERVIEW_SCORECARD} filter={filter} onDrilldown={onDrilldown} showProvenance={false} />
      </ReportSection>

      {/* Performance summary: parts fitted and parts revenue charted by day, week and month. */}
      <ReportSection title="Performance summary" subtitle="Parts fitted and parts revenue, re-bucketed daily, weekly and monthly.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 12 }}>
          {/* Parts fitted, daily trend. */}
          <PerformanceTrendCard kpiId="prt.fitted" label="Parts fitted" unit="count" format="0,0" filter={filter} granularity="day" granularityLabel="Daily" />
          {/* Parts fitted, weekly trend. */}
          <PerformanceTrendCard kpiId="prt.fitted" label="Parts fitted" unit="count" format="0,0" filter={filter} granularity="week" granularityLabel="Weekly" />
          {/* Parts fitted, monthly trend. */}
          <PerformanceTrendCard kpiId="prt.fitted" label="Parts fitted" unit="count" format="0,0" filter={filter} granularity="month" granularityLabel="Monthly" />
          {/* Parts revenue, daily trend. */}
          <PerformanceTrendCard kpiId="prt.revenue" label="Parts revenue (£)" unit="currency" format="£0,0.00" filter={filter} granularity="day" granularityLabel="Daily" />
          {/* Parts revenue, weekly trend. */}
          <PerformanceTrendCard kpiId="prt.revenue" label="Parts revenue (£)" unit="currency" format="£0,0.00" filter={filter} granularity="week" granularityLabel="Weekly" />
          {/* Parts revenue, monthly trend. */}
          <PerformanceTrendCard kpiId="prt.revenue" label="Parts revenue (£)" unit="currency" format="£0,0.00" filter={filter} granularity="month" granularityLabel="Monthly" />
        </div>
      </ReportSection>
    </>
  );
}
