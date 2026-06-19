// file location: src/components/reporting/workshop/WorkshopVhcTab.js
//
// VHC Performance (VHC KPIs are owned by the workshop department per the
// catalogue): completion, red items, authorisation and upsell. Each is a KPI
// panel with trend; red items carries the items drill-down.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import { VHC_KPIS } from "./workshopReportConfig";

export default function WorkshopVhcTab({ filter }) {
  return (
    <ReportSection
      title="VHC performance"
      subtitle="Inspection completion, findings and commercial conversion — real severity, correct ratios (no default-amber)."
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        {VHC_KPIS.map((kpi) => (
          <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend withDrilldown={kpi.hasDrilldown} />
        ))}
      </div>
    </ReportSection>
  );
}
