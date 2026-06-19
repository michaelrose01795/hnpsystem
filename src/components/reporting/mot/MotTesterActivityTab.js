// file location: src/components/reporting/mot/MotTesterActivityTab.js
//
// Tester Activity: tester workload/activity from existing MOT clocking. The KPI
// definition carries the caveat: reliable tester attribution improves with
// mot_tests.tester_id and MOT result events.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import ReportDrilldownTable from "../ReportDrilldownTable";
import { TESTER_KPIS } from "./motReportConfig";

export default function MotTesterActivityTab({ filter }) {
  return (
    <>
      <ReportSection
        title="Tester workload and activity"
        subtitle="Clocking-based tester activity where existing attribution supports it. Per-test signed attribution becomes reliable when mot_tests.tester_id lands."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {TESTER_KPIS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend withDrilldown />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Tester drill-down" subtitle="Tester-level rows derived from MOT clocking records in the selected period.">
        <ReportDrilldownTable kpiId="mot.tester_productivity" label="Tester activity" filter={filter} />
      </ReportSection>
    </>
  );
}
