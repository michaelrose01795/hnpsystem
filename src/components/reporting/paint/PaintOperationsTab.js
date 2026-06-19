// file location: src/components/reporting/paint/PaintOperationsTab.js
//
// Paint Operations: job volume, queue, completed work and throughput monitoring.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import ReportDrilldownTable from "../ReportDrilldownTable";
import PaintBreakdownCards from "./PaintBreakdownCards";
import { OPERATIONS_KPIS } from "./paintReportConfig";

export default function PaintOperationsTab({ filter }) {
  return (
    <>
      <ReportSection title="Paint queue" subtitle="Point-in-time Paint/bodyshop queue facets from the shared Paint resolver.">
        <PaintBreakdownCards filter={filter} source="queue" keys={["paint_queue", "open_started_jobs", "open_not_started_jobs"]} />
      </ReportSection>

      <ReportSection title="Paint job volume and completed work" subtitle="Completed Paint jobs, queue depth and whole-job cycle-time proxy.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {OPERATIONS_KPIS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend={kpi.id !== "pnt.queue"} withDrilldown />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Paint job drill-down" subtitle="Jobs contributing to completed Paint work in the selected period.">
        <ReportDrilldownTable kpiId="pnt.jobs_completed" label="Completed Paint jobs" filter={filter} />
      </ReportSection>

      <ReportSection title="Paint queue drill-down" subtitle="Current Paint/bodyshop jobs not completed.">
        <ReportDrilldownTable kpiId="pnt.queue" label="Paint queue" filter={filter} />
      </ReportSection>
    </>
  );
}
