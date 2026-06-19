// file location: src/components/reporting/valeting/ValetingOverviewTab.js
//
// Valeting Overview: catalogue-backed scorecard plus daily / weekly / monthly
// summaries. All values come from the shared reporting APIs.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import KpiTrendChart from "../KpiTrendChart";
import { useKpiTrend } from "@/hooks/reporting/useReporting";
import ValetingBreakdownCards from "./ValetingBreakdownCards";
import { OVERVIEW_SCORECARD } from "./valetingReportConfig";

function TrendCard({ kpiId, label, unit, format, filter, granularity, granularityLabel }) {
  const trend = useKpiTrend(kpiId, { ...filter, granularity }, { enabled: true });
  return (
    <LayerSurface radius="var(--radius-sm)" padding="14px" gap="8px">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-1)" }}>{label}</span>
        <span style={{ fontSize: "0.7rem", color: "var(--surfaceTextMuted)" }}>{granularityLabel}</span>
      </div>
      <KpiTrendChart series={trend.series} unit={unit} format={format} height={110} />
    </LayerSurface>
  );
}

export default function ValetingOverviewTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection
        title="Department scorecard"
        subtitle="Catalogue-defined Valeting KPIs. Duration, queue-time and productivity remain declared until the required wash history and attribution data lands."
      >
        <KpiScorecardStrip kpis={OVERVIEW_SCORECARD} filter={filter} onDrilldown={onDrilldown} showProvenance={false} />
      </ReportSection>

      <ReportSection title="Daily summary" subtitle="Current queue, active work, completions, throughput and demand facets returned by the Valeting KPI resolver.">
        <ValetingBreakdownCards filter={filter} />
      </ReportSection>

      <ReportSection title="Weekly and monthly summary" subtitle="Completed Valeting volume re-bucketed by the reporting engine.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <TrendCard kpiId="val.cars_washed" label="Valet volume" unit="count" format="0,0" filter={filter} granularity="day" granularityLabel="Daily" />
          <TrendCard kpiId="val.cars_washed" label="Valet volume" unit="count" format="0,0" filter={filter} granularity="week" granularityLabel="Weekly" />
          <TrendCard kpiId="val.cars_washed" label="Valet volume" unit="count" format="0,0" filter={filter} granularity="month" granularityLabel="Monthly" />
        </div>
      </ReportSection>
    </>
  );
}
