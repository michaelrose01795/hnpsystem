// file location: src/components/reporting/valeting/ValeterActivityTab.js
//
// Valeter Activity: shows current completer attribution where present and keeps
// productivity blocked until the documented assignee/shift model exists.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import ReportDrilldownTable from "../ReportDrilldownTable";
import ValetingBreakdownCards from "./ValetingBreakdownCards";
import { VALETER_KPIS } from "./valetingReportConfig";

export default function ValeterActivityTab({ filter }) {
  return (
    <>
      <ReportSection
        title="Valeter workload"
        subtitle="Completed work records include wash_completed_by where present. Missing completer stamps remain visible as unattributed completions."
      >
        <ValetingBreakdownCards filter={filter} keys={["vehicles_completed"]} />
      </ReportSection>

      <ReportSection
        title="Productivity"
        subtitle="The catalogue productivity KPI needs wash assignee and shift attribution. It is shown as a declared blocker rather than an invented leaderboard."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {VALETER_KPIS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend={false} withDrilldown={false} />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Activity trends" subtitle="Completed Valeting volume trend. True per-valeter trends unlock when assignee history is captured.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          <KpiPanel kpi={{ id: "val.cars_washed", label: "Completed Valets", unit: "count", format: "0,0", readiness: "R1", hasDrilldown: true }} filter={filter} withTrend withDrilldown />
        </div>
      </ReportSection>

      <ReportSection title="Drill-down explorer" subtitle="Completed Valeting rows with completer id where the current operational data captured it.">
        <ReportDrilldownTable kpiId="val.cars_washed" label="Valeter activity" filter={filter} />
      </ReportSection>
    </>
  );
}
