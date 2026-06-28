// file location: src/components/reporting/management/ExecutiveOverviewTab.js
//
// Executive Overview: company scorecard plus daily / weekly / monthly / YTD
// summaries. All values come from the shared reporting APIs — no maths in the
// component. The scorecard is the mgt.* composite suite; the summaries trend the
// composed company revenue at each granularity via the shared trend framework.

import React from "react";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import KpiBreakdownCards from "../KpiBreakdownCards";
import ExecutiveTrendCard from "./ExecutiveTrendCard";
import { EXECUTIVE_SCORECARD, COMPANY_REVENUE_CARDS } from "./managementReportConfig";

export default function ExecutiveOverviewTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection
        title="Company scorecard"
        subtitle="Catalogue-defined executive composites. Company revenue and upsell contribution are live; site recovery, growth, department coverage and forecast inputs compose R1 department KPIs with their documented caveats."
      >
        <KpiScorecardStrip kpis={EXECUTIVE_SCORECARD} filter={filter} onDrilldown={onDrilldown} showProvenance={false} />
      </ReportSection>

      <ReportSection
        title="Daily summary"
        subtitle="Company revenue split (labour / parts) and invoice volume for the selected period, composed from the Accounts revenue KPIs."
      >
        <KpiBreakdownCards filter={filter} kpiId="mgt.company_revenue" cards={COMPANY_REVENUE_CARDS} />
      </ReportSection>

      <ReportSection
        title="Weekly, monthly and year-to-date summary"
        subtitle="Company revenue re-bucketed by the reporting engine. Set the filter range to 'Year to date' for the YTD view."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <ExecutiveTrendCard kpiId="mgt.company_revenue" label="Company revenue" unit="currency" format="£0,0.00" filter={filter} granularity="week" granularityLabel="Weekly" />
          <ExecutiveTrendCard kpiId="mgt.company_revenue" label="Company revenue" unit="currency" format="£0,0.00" filter={filter} granularity="month" granularityLabel="Monthly" />
          <ExecutiveTrendCard kpiId="mgt.company_revenue" label="Company revenue" unit="currency" format="£0,0.00" filter={filter} granularity="year" granularityLabel="Yearly / YTD" />
        </div>
      </ReportSection>
    </>
  );
}
