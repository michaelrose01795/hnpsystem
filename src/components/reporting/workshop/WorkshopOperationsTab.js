// file location: src/components/reporting/workshop/WorkshopOperationsTab.js
//
// Workshop Operations: job volume, job flow, throughput and workload monitoring.
// KPI panels (value + trend + drill-down) for the flow metrics, plus a workload
// strip. Engine-served throughout.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import KpiScorecardStrip from "../KpiScorecardStrip";
import { OPERATIONS_KPIS, OPERATIONS_WORKLOAD } from "./workshopReportConfig";

export default function WorkshopOperationsTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection title="Job volume & flow" subtitle="Intake, completion and throughput balance, with daily/weekly/monthly trend per the filter.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {OPERATIONS_KPIS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend withDrilldown />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Workload monitoring" subtitle="Per-head load and the sold-vs-clocked hours that drive recovery.">
        <KpiScorecardStrip kpis={OPERATIONS_WORKLOAD} filter={filter} onDrilldown={onDrilldown} minCardWidth={220} showProvenance />
      </ReportSection>
    </>
  );
}
