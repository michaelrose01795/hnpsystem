// file location: src/components/reporting/paint/PaintWorkloadTab.js
//
// Paint Workload: current workload, bodyshop demand and attribution readiness.

import React from "react";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import ReportDrilldownTable from "../ReportDrilldownTable";
import PaintBreakdownCards from "./PaintBreakdownCards";
import { WORKLOAD_KPIS } from "./paintReportConfig";

export default function PaintWorkloadTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection title="Paint workload" subtitle="Open Paint/bodyshop work and current assignment visibility from existing job attribution fields.">
        <PaintBreakdownCards filter={filter} source="queue" />
      </ReportSection>

      <ReportSection title="Bodyshop job demand" subtitle="Paint jobs identified and bodyshop demand facets from existing job category/type signals.">
        <PaintBreakdownCards filter={filter} keys={["paint_jobs_identified", "bodyshop_job_volume", "paint_jobs_completed", "paint_throughput_per_day"]} />
      </ReportSection>

      <ReportSection title="Painter attribution readiness" subtitle="Painter-level productivity is declared, but remains blocked until dedicated painter assignment and stage/shift exposure exist.">
        <KpiScorecardStrip kpis={WORKLOAD_KPIS} filter={filter} onDrilldown={onDrilldown} minCardWidth={220} />
      </ReportSection>

      <ReportSection title="Workload drill-down" subtitle="Open Paint/bodyshop jobs. assigned_to is exposed where present, but is not treated as final painter productivity.">
        <ReportDrilldownTable kpiId="pnt.queue" label="Paint workload" filter={filter} />
      </ReportSection>
    </>
  );
}
