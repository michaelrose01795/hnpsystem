// file location: src/components/reporting/workshop/WorkshopTechnicianTab.js
//
// Technician Performance: efficiency, ranking, activity and the productivity
// readiness indicators (declared metrics that unlock in a later phase). The
// ranking table is the tech_ranking drill-down; the readiness strip makes the
// R2/R3 gaps explicit rather than hiding them.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import KpiScorecardStrip from "../KpiScorecardStrip";
import ReportDrilldownTable from "../ReportDrilldownTable";
import { TECHNICIAN_KPIS, TECHNICIAN_RANKING, TECHNICIAN_READINESS } from "./workshopReportConfig";

export default function WorkshopTechnicianTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection title="Efficiency & activity" subtitle="Per-technician metrics from the canonical (int-keyed) efficiency entries.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {TECHNICIAN_KPIS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend={kpi.unit !== "count"} withDrilldown={kpi.hasDrilldown} />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Technician ranking" subtitle="Ranked by efficiency (allocated ÷ clocked) over the period. Export-ready.">
        <ReportDrilldownTable kpiId={TECHNICIAN_RANKING.id} label={TECHNICIAN_RANKING.label} filter={filter} />
      </ReportSection>

      <ReportSection
        title="Productivity readiness indicators"
        subtitle="Declared in the catalogue — these light up once the R2/R3 prerequisites land (clocking reconciliation, capacity model)."
      >
        <KpiScorecardStrip kpis={TECHNICIAN_READINESS} filter={filter} onDrilldown={onDrilldown} minCardWidth={220} />
      </ReportSection>
    </>
  );
}
