// file location: src/components/reporting/service/ServiceCommunicationsTab.js
//
// Customer Communications: customer contact activity, customer responses,
// follow-up activity and communication trends. Today the one R1 customer-comms
// signal is the VHC send rate (VHCs are the primary customer communication);
// contact rate, response time and follow-up completion are declared (R2/R3) and
// render their exact blocker — the gap is explicit, not hidden. Every figure
// comes from /api/reports/* — no maths here.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import { COMMUNICATIONS_R1, COMMUNICATIONS_READINESS } from "./serviceReportConfig";

export default function ServiceCommunicationsTab({ filter }) {
  return (
    <>
      <ReportSection
        title="Customer communication activity"
        subtitle="VHC send rate — the live customer-communication signal (with daily/weekly/monthly trend)."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {COMMUNICATIONS_R1.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend withDrilldown={kpi.hasDrilldown} />
          ))}
        </div>
      </ReportSection>

      <ReportSection
        title="Customer responses & follow-up"
        subtitle="Contact activity, response time and follow-up completion light up as the customer-communication event spine accrues (R2) and a follow-up entity lands (R3)."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {COMMUNICATIONS_READINESS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend={false} withDrilldown={false} />
          ))}
        </div>
      </ReportSection>
    </>
  );
}
