// file location: src/components/reporting/valeting/ValetingOperationsTab.js
//
// Valeting Operations: queue monitoring, active workload, completed work and
// throughput analysis using shared reporting panels.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import KpiScorecardStrip from "../KpiScorecardStrip";
import ReportDrilldownTable from "../ReportDrilldownTable";
import ValetingBreakdownCards from "./ValetingBreakdownCards";
import { OPERATIONS_KPIS, OPERATIONS_READINESS } from "./valetingReportConfig";

export default function ValetingOperationsTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection title="Queue monitoring" subtitle="Point-in-time queue facets from the shared Valeting resolver.">
        <ValetingBreakdownCards filter={filter} keys={["vehicles_awaiting_valet", "vehicles_in_valet", "valet_queue_size"]} />
      </ReportSection>

      <ReportSection title="Completed work and throughput" subtitle="Completed valet volume, completion rate and no-wash rate for the selected period.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {OPERATIONS_KPIS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend={kpi.id === "val.cars_washed"} withDrilldown />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Completed work drill-down" subtitle="Vehicles contributing to completed Valeting volume in the selected period.">
        <ReportDrilldownTable kpiId="val.cars_washed" label="Completed valet work" filter={filter} />
      </ReportSection>

      <ReportSection title="Throughput analysis readiness" subtitle="Queue-time, average duration and SLA are declared, but need wash history and completion timestamps before they can compute.">
        <KpiScorecardStrip kpis={OPERATIONS_READINESS} filter={filter} onDrilldown={onDrilldown} minCardWidth={230} />
      </ReportSection>
    </>
  );
}
