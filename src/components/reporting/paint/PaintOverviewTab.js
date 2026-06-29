// file location: src/components/reporting/paint/PaintOverviewTab.js
//
// Paint Overview: department scorecard plus daily / weekly / monthly summaries.
// All values come from the shared reporting APIs.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import KpiTrendChart from "../KpiTrendChart";
import { useKpiTrend } from "@/hooks/reporting/useReporting";
import PaintBreakdownCards from "./PaintBreakdownCards";
import { OVERVIEW_SCORECARD } from "./paintReportConfig";
import { reportDevKey } from "../reportDevOverlay";

function TrendCard({ kpiId, label, unit, format, filter, granularity, granularityLabel }) {
  const trend = useKpiTrend(kpiId, { ...filter, granularity }, { enabled: true });
  const devSectionKey = reportDevKey("report-trend-card", `${kpiId}-${granularity}`);
  return (
    <LayerSurface radius="var(--radius-sm)" padding="14px" gap="8px" sectionKey={devSectionKey} data-dev-text-preview={`${label} ${granularityLabel}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-1)" }}>{label}</span>
        <span style={{ fontSize: "0.7rem", color: "var(--surfaceTextMuted)" }}>{granularityLabel}</span>
      </div>
      <KpiTrendChart series={trend.series} unit={unit} format={format} height={110} loading={trend.loading} sectionKey={`${devSectionKey}-chart`} parentKey={devSectionKey} />
    </LayerSurface>
  );
}

export default function PaintOverviewTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection
        title="Department scorecard"
        subtitle="Catalogue-defined Paint KPIs. Queue and completed jobs are live; cycle-time is a whole-job proxy; stage, bay, productivity, material and rework metrics remain blocked until the paint model exists."
      >
        <KpiScorecardStrip kpis={OVERVIEW_SCORECARD} filter={filter} onDrilldown={onDrilldown} showProvenance={false} />
      </ReportSection>

      <ReportSection title="Daily summary" subtitle="Identified Paint jobs, completed work, throughput and bodyshop demand facets returned by the Paint KPI resolver.">
        <PaintBreakdownCards filter={filter} />
      </ReportSection>

      <ReportSection title="Weekly and monthly summary" subtitle="Paint completed volume re-bucketed by the reporting engine.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <TrendCard kpiId="pnt.jobs_completed" label="Paint jobs completed" unit="count" format="0,0" filter={filter} granularity="day" granularityLabel="Daily" />
          <TrendCard kpiId="pnt.jobs_completed" label="Paint jobs completed" unit="count" format="0,0" filter={filter} granularity="week" granularityLabel="Weekly" />
          <TrendCard kpiId="pnt.jobs_completed" label="Paint jobs completed" unit="count" format="0,0" filter={filter} granularity="month" granularityLabel="Monthly" />
        </div>
      </ReportSection>
    </>
  );
}
