// file location: src/components/reporting/paint/PaintWorkflowTab.js
//
// Paint Workflow: current workflow visibility using existing data only, plus
// readiness indicators for the blocked workflow metrics.

import React from "react";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import ReportDrilldownTable from "../ReportDrilldownTable";
import PaintBreakdownCards from "./PaintBreakdownCards";
import { WORKFLOW_READINESS } from "./paintReportConfig";

export default function PaintWorkflowTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection title="Current workflow visibility" subtitle="Existing data supports open/not-started and open/started visibility only. Paint stages are not modelled yet.">
        <PaintBreakdownCards filter={filter} source="queue" keys={["paint_queue", "open_not_started_jobs", "open_started_jobs"]} />
      </ReportSection>

      <ReportSection title="Stage and cycle-time readiness" subtitle="Cycle-time uses whole-job milestones where present; stage duration and bay utilisation stay blocked until paint_stage_history exists.">
        <KpiScorecardStrip kpis={WORKFLOW_READINESS} filter={filter} onDrilldown={onDrilldown} minCardWidth={220} />
      </ReportSection>

      <ReportSection title="Cycle-time drill-down" subtitle="Completed Paint jobs with both workshop_started_at and completed_at supporting the current proxy.">
        <ReportDrilldownTable kpiId="pnt.cycle_time" label="Paint cycle-time proxy" filter={filter} />
      </ReportSection>
    </>
  );
}
