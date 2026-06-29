// file location: src/components/reporting/workshop/WorkshopOverviewTab.js
//
// Workshop Overview: the department scorecard, the operational KPI cards, and the
// daily / weekly / monthly performance summary (the same KPI re-bucketed by the
// engine at three granularities). All values come from /api/reports/*.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import KpiTrendChart from "../KpiTrendChart";
import { useKpiTrend } from "@/hooks/reporting/useReporting";
import { OVERVIEW_SCORECARD } from "./workshopReportConfig";
import { reportDevKey } from "../reportDevOverlay";

function PerformanceTrendCard({ kpiId, label, unit, format, filter, granularity, granularityLabel }) {
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

export default function WorkshopOverviewTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection title="Department scorecard" subtitle="Headline Workshop KPIs for the selected period (live-correct, exact counts).">
        <KpiScorecardStrip kpis={OVERVIEW_SCORECARD} filter={filter} onDrilldown={onDrilldown} showProvenance={false} />
      </ReportSection>

      <ReportSection title="Performance summary" subtitle="Jobs completed and labour sales, re-bucketed daily, weekly and monthly.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <PerformanceTrendCard kpiId="wsh.jobs_completed" label="Jobs completed" unit="count" format="0,0" filter={filter} granularity="day" granularityLabel="Daily" />
          <PerformanceTrendCard kpiId="wsh.jobs_completed" label="Jobs completed" unit="count" format="0,0" filter={filter} granularity="week" granularityLabel="Weekly" />
          <PerformanceTrendCard kpiId="wsh.jobs_completed" label="Jobs completed" unit="count" format="0,0" filter={filter} granularity="month" granularityLabel="Monthly" />
          <PerformanceTrendCard kpiId="wsh.labour_sales" label="Labour sales (£)" unit="currency" format="£0,0.00" filter={filter} granularity="day" granularityLabel="Daily" />
          <PerformanceTrendCard kpiId="wsh.labour_sales" label="Labour sales (£)" unit="currency" format="£0,0.00" filter={filter} granularity="week" granularityLabel="Weekly" />
          <PerformanceTrendCard kpiId="wsh.labour_sales" label="Labour sales (£)" unit="currency" format="£0,0.00" filter={filter} granularity="month" granularityLabel="Monthly" />
        </div>
      </ReportSection>
    </>
  );
}
