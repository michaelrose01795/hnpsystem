// file location: src/components/reporting/service/ServiceOverviewTab.js
//
// Service Overview: the department scorecard plus the daily / weekly / monthly
// performance summary (the same KPI re-bucketed by the engine at three
// granularities — advisor activity trends). All values come from /api/reports/* —
// no maths here.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import KpiTrendChart from "../KpiTrendChart";
import { useKpiTrend } from "@/hooks/reporting/useReporting";
import { OVERVIEW_SCORECARD } from "./serviceReportConfig";

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

export default function ServiceOverviewTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection
        title="Department scorecard"
        subtitle="Headline Service Advisor KPIs for the selected period (live-correct, exact figures). VHC value and rates come from the shared VHC catalogue — one definition per metric."
      >
        <KpiScorecardStrip kpis={OVERVIEW_SCORECARD} filter={filter} onDrilldown={onDrilldown} showProvenance={false} />
      </ReportSection>

      <ReportSection
        title="Performance summary"
        subtitle="Booking volume and authorised VHC value, re-bucketed daily, weekly and monthly (advisor activity trends)."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <PerformanceTrendCard kpiId="svc.booking_volume" label="Bookings" unit="count" format="0,0" filter={filter} granularity="day" granularityLabel="Daily" />
          <PerformanceTrendCard kpiId="svc.booking_volume" label="Bookings" unit="count" format="0,0" filter={filter} granularity="week" granularityLabel="Weekly" />
          <PerformanceTrendCard kpiId="svc.booking_volume" label="Bookings" unit="count" format="0,0" filter={filter} granularity="month" granularityLabel="Monthly" />
          <PerformanceTrendCard kpiId="vhc.upsell_revenue" label="Authorised value (£)" unit="currency" format="£0,0.00" filter={filter} granularity="day" granularityLabel="Daily" />
          <PerformanceTrendCard kpiId="vhc.upsell_revenue" label="Authorised value (£)" unit="currency" format="£0,0.00" filter={filter} granularity="week" granularityLabel="Weekly" />
          <PerformanceTrendCard kpiId="vhc.upsell_revenue" label="Authorised value (£)" unit="currency" format="£0,0.00" filter={filter} granularity="month" granularityLabel="Monthly" />
        </div>
      </ReportSection>
    </>
  );
}
