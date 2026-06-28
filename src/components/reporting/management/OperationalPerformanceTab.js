// file location: src/components/reporting/management/OperationalPerformanceTab.js
//
// Operational Performance: existing department operational/tactical KPIs combined
// into one executive view. Every card references an EXISTING department KPI id
// (workshop efficiency/utilisation/productivity, labour & parts revenue, invoice
// performance, customer authorisation, VHC/MOT performance, valeting & paint
// throughput) so the executive layer orchestrates the department packages rather
// than recomputing anything. Declared KPIs (utilisation, productivity) surface
// with their blocker via the shared KpiPanel "not yet captured" state.

import React from "react";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import KpiPanel from "../KpiPanel";
import { OPERATIONAL_KPIS } from "./managementReportConfig";

const HEADLINE = ["wsh.tech_efficiency", "acc.labour_revenue", "vhc.authorisation_rate", "mot.pass_rate"];

export default function OperationalPerformanceTab({ filter, onDrilldown }) {
  const headlinePanels = OPERATIONAL_KPIS.filter((k) => HEADLINE.includes(k.id));

  return (
    <>
      <ReportSection
        title="Operational scorecard"
        subtitle="Workshop, labour, parts, VHC, MOT, valeting and paint operational KPIs combined from the department packages. No metric is recomputed — each card reads its department's canonical KPI."
      >
        <KpiScorecardStrip kpis={OPERATIONAL_KPIS} filter={filter} onDrilldown={onDrilldown} showProvenance={false} minCardWidth={210} />
      </ReportSection>

      <ReportSection title="Headline operational metrics with trends" subtitle="Efficiency, labour revenue, customer authorisation and MOT performance with history.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {headlinePanels.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend withDrilldown />
          ))}
        </div>
      </ReportSection>
    </>
  );
}
