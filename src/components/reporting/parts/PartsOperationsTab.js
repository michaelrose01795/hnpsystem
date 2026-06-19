// file location: src/components/reporting/parts/PartsOperationsTab.js
//
// Parts Operations: requests, ordering, receiving, fitting and pipeline
// monitoring. KPI panels (value + trend + drill-down) for the flow metrics, the
// point-in-time open pipeline drill-down, plus the declared readiness indicators
// that unlock once parts status-history accrues. Engine-served throughout.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import KpiScorecardStrip from "../KpiScorecardStrip";
import ReportDrilldownTable from "../ReportDrilldownTable";
import { OPERATIONS_FLOW, OPERATIONS_PIPELINE, OPERATIONS_READINESS } from "./partsReportConfig";

export default function PartsOperationsTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection title="Requests · ordering · receiving · fitting" subtitle="The parts flow, each with daily/weekly/monthly trend per the filter and the records behind it.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {OPERATIONS_FLOW.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend withDrilldown />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Pipeline monitoring" subtitle="Point-in-time open part lines by status — the live backlog (exact, not truncated).">
        <ReportDrilldownTable kpiId={OPERATIONS_PIPELINE.id} label={OPERATIONS_PIPELINE.label} filter={filter} />
      </ReportSection>

      <ReportSection
        title="Operations readiness indicators"
        subtitle="Declared in the catalogue — these light up once parts status-history accrues (approval, cancellation, unavailable, pick transitions)."
      >
        <KpiScorecardStrip kpis={OPERATIONS_READINESS} filter={filter} onDrilldown={onDrilldown} minCardWidth={220} />
      </ReportSection>
    </>
  );
}
