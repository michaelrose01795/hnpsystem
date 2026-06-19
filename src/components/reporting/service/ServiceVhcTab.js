// file location: src/components/reporting/service/ServiceVhcTab.js
//
// VHC Performance (advisor view): VHC sent, viewed, authorised, authorised value,
// declined value and advisor conversion performance. The send rate is R1 (svc.*);
// authorisation rate, authorised value and completion are the DEPARTMENT-level R1
// vhc.* catalogue entries (one definition per metric — no duplicate card). VHC
// view rate, per-advisor authorised/declined value and advisor conversion are
// declared (R2) until the view event and the send-advisor attribution land — the
// gap is explicit. Every figure comes from /api/reports/* — no maths here.

import React from "react";
import ReportSection from "../ReportSection";
import KpiPanel from "../KpiPanel";
import { VHC_R1, VHC_READINESS } from "./serviceReportConfig";

export default function ServiceVhcTab({ filter }) {
  return (
    <>
      <ReportSection
        title="VHC performance"
        subtitle="Send rate, authorisation rate, authorised value and completion — real severity, correct ratios. Department-level value comes from the shared VHC catalogue."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {VHC_R1.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend withDrilldown={kpi.hasDrilldown} />
          ))}
        </div>
      </ReportSection>

      <ReportSection
        title="Advisor conversion performance"
        subtitle="VHC view rate, per-advisor authorised/declined value and advisor conversion light up once the VHC view event and the send-advisor attribution (D4) land (R2)."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {VHC_READINESS.map((kpi) => (
            <KpiPanel key={kpi.id} kpi={kpi} filter={filter} withTrend={false} withDrilldown={false} />
          ))}
        </div>
      </ReportSection>
    </>
  );
}
