// file location: src/components/reporting/management/RevenueProfitabilityTab.js
//
// Revenue & Profitability: aggregates existing revenue KPIs (company revenue,
// labour / parts / MOT contribution, VHC upsell) and surfaces the year-on-year
// growth composite. Profitability metrics that need a cost model (company
// profitability, cost-to-serve) are shown as explicitly BLOCKED — no profitability
// figure is invented where COGS/opex data does not yet exist.

import React from "react";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import KpiBreakdownCards from "../KpiBreakdownCards";
import ExecutiveTrendCard from "./ExecutiveTrendCard";
import { REVENUE_KPIS, PROFITABILITY_BLOCKED_KPIS, REVENUE_GROWTH_CARDS } from "./managementReportConfig";

export default function RevenueProfitabilityTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection
        title="Revenue overview & contribution"
        subtitle="Company revenue with the labour, parts, MOT and VHC-upsell contributions — composed from the Accounts, MOT and VHC KPIs."
      >
        <KpiScorecardStrip kpis={REVENUE_KPIS} filter={filter} onDrilldown={onDrilldown} showProvenance={false} />
      </ReportSection>

      <ReportSection title="Gross revenue & growth trends" subtitle="Company revenue history plus the year-on-year growth composite (prior-year window null until ≥13 months of history accrue).">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 12 }}>
          <ExecutiveTrendCard kpiId="mgt.company_revenue" label="Gross revenue" unit="currency" format="£0,0.00" filter={filter} granularity="month" granularityLabel="Monthly" />
          <ExecutiveTrendCard kpiId="vhc.upsell_revenue" label="VHC upsell revenue" unit="currency" format="£0,0.00" filter={filter} granularity="month" granularityLabel="Monthly" />
        </div>
        <KpiBreakdownCards filter={filter} kpiId="mgt.growth" cards={REVENUE_GROWTH_CARDS} />
      </ReportSection>

      <ReportSection
        title="Profitability"
        subtitle="Parts margin is live today; full company profitability and cost-to-serve are BLOCKED until COGS on invoice lines and a cost/opex model exist (profitability modelling, R3). No profit figure is invented."
      >
        <KpiScorecardStrip kpis={PROFITABILITY_BLOCKED_KPIS} filter={filter} onDrilldown={onDrilldown} showProvenance={false} />
      </ReportSection>
    </>
  );
}
