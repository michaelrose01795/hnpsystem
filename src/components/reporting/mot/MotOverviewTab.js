// file location: src/components/reporting/mot/MotOverviewTab.js
//
// MOT Overview: department scorecard plus daily / weekly / monthly summary
// trends. All figures are engine-served; this component only arranges them.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import KpiTrendChart from "../KpiTrendChart";
import { useKpiTrend } from "@/hooks/reporting/useReporting";
import { OVERVIEW_SCORECARD } from "./motReportConfig";

function TrendCard({ kpiId, label, unit, format, filter, granularity, granularityLabel }) {
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

export default function MotOverviewTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection
        title="Department scorecard"
        subtitle="Headline MOT KPIs for the selected period. Outcome figures are labelled with their current data-quality caveat until mot_tests lands."
      >
        <KpiScorecardStrip kpis={OVERVIEW_SCORECARD} filter={filter} onDrilldown={onDrilldown} showProvenance={false} />
      </ReportSection>

      <ReportSection title="Performance summary" subtitle="MOT volume and MOT revenue, re-bucketed daily, weekly and monthly by the reporting engine.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <TrendCard kpiId="mot.volume" label="MOT volume" unit="count" format="0,0" filter={filter} granularity="day" granularityLabel="Daily" />
          <TrendCard kpiId="mot.volume" label="MOT volume" unit="count" format="0,0" filter={filter} granularity="week" granularityLabel="Weekly" />
          <TrendCard kpiId="mot.volume" label="MOT volume" unit="count" format="0,0" filter={filter} granularity="month" granularityLabel="Monthly" />
          <TrendCard kpiId="mot.revenue" label="MOT revenue" unit="currency" format="£0,0.00" filter={filter} granularity="day" granularityLabel="Daily" />
          <TrendCard kpiId="mot.revenue" label="MOT revenue" unit="currency" format="£0,0.00" filter={filter} granularity="week" granularityLabel="Weekly" />
          <TrendCard kpiId="mot.revenue" label="MOT revenue" unit="currency" format="£0,0.00" filter={filter} granularity="month" granularityLabel="Monthly" />
        </div>
      </ReportSection>
    </>
  );
}
