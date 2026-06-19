// file location: src/components/reporting/mot/MotOperationsTab.js
//
// MOT Operations: volume, outcomes and throughput monitoring using shared KPI
// panels. Blocked outcome metrics are shown as catalogue readiness indicators.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import KpiScorecardStrip from "../KpiScorecardStrip";
import ReportDrilldownTable from "../ReportDrilldownTable";
import { OPERATIONS_KPIS, OPERATIONS_READINESS } from "./motReportConfig";

export default function MotOperationsTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection
        title="MOT volume and outcomes"
        subtitle="Operational MOT volume, pass/fail analysis and throughput. Pass/fail uses the documented completion_status proxy until mot_tests.result exists."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {OPERATIONS_KPIS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend={kpi.id !== "mot.due_pipeline"} withDrilldown />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Outcome drill-down" subtitle="The records behind the current MOT outcome proxy, including completed, passed, failed and retest-labelled jobs.">
        <ReportDrilldownTable kpiId="mot.pass_rate" label="MOT outcomes" filter={filter} />
      </ReportSection>

      <ReportSection title="Outcome readiness indicators" subtitle="Declared MOT result metrics that need the mot_tests entity and retest linkage before they can be trusted.">
        <KpiScorecardStrip kpis={OPERATIONS_READINESS} filter={filter} onDrilldown={onDrilldown} minCardWidth={220} />
      </ReportSection>
    </>
  );
}
