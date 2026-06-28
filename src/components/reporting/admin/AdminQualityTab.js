// file location: src/components/reporting/admin/AdminQualityTab.js
//
// Data Quality & System Health: data-quality defects, reporting validation
// issues, missing attribution, missing department ownership and status drift.
// The achievable defect monitors run live; snapshot-drift and department-ownership
// coverage stay declared until their monitors accrue.

import React from "react";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import ReportDrilldownTable from "../ReportDrilldownTable";
import AdminBreakdownCards from "./AdminBreakdownCards";
import { DATA_QUALITY_KPIS, DATA_QUALITY_CARDS } from "./adminReportConfig";

export default function AdminQualityTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection title="Data-quality health" subtitle="Meta-KPI guarding every other metric's trust. Defects that can be measured today are live; the rest are declared until their monitors land.">
        <KpiScorecardStrip kpis={DATA_QUALITY_KPIS} filter={filter} onDrilldown={onDrilldown} minCardWidth={240} />
      </ReportSection>

      <ReportSection title="Reporting validation issues" subtitle="Missing attribution, unresolved actor logins, out-of-model status drift and missing department ownership.">
        <AdminBreakdownCards filter={filter} kpiId="adm.data_quality" cards={DATA_QUALITY_CARDS} />
      </ReportSection>

      <ReportSection title="Missing-attribution drill-down" subtitle="Audit rows logged without a resolved actor — the leading attribution defect.">
        <ReportDrilldownTable kpiId="adm.data_quality" label="Data-quality defects" filter={filter} />
      </ReportSection>
    </>
  );
}
