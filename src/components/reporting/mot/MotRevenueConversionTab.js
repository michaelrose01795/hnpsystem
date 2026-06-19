// file location: src/components/reporting/mot/MotRevenueConversionTab.js
//
// MOT Revenue & Conversion: live MOT revenue plus declared conversion metrics
// that need event/history/advisory modelling before they can compute.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import KpiScorecardStrip from "../KpiScorecardStrip";
import { REVENUE_KPIS, CONVERSION_READINESS } from "./motReportConfig";

export default function MotRevenueConversionTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection title="MOT revenue" subtitle="MOT invoice-line value and revenue trend, served by the reporting engine.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {REVENUE_KPIS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend withDrilldown />
          ))}
        </div>
      </ReportSection>

      <ReportSection
        title="Repair and advisory conversion"
        subtitle="Catalogue-defined conversion KPIs. Repair conversion needs event-spine linkage; advisory conversion needs MOT advisory capture."
      >
        <KpiScorecardStrip kpis={CONVERSION_READINESS} filter={filter} onDrilldown={onDrilldown} minCardWidth={240} />
      </ReportSection>
    </>
  );
}
