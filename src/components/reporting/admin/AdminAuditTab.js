// file location: src/components/reporting/admin/AdminAuditTab.js
//
// Audit & Compliance: audit activity, compliance metrics, sensitive actions,
// report access and export activity. All from the hash-chained audit_log via the
// shared reporting engine. Drill-downs omit the audit hash chain and diff payload.

import React from "react";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import ReportDrilldownTable from "../ReportDrilldownTable";
import AdminBreakdownCards from "./AdminBreakdownCards";
import { AUDIT_KPIS, AUDIT_BREAKDOWN_CARDS, COMPLIANCE_BREAKDOWN_CARDS, REPORT_USAGE_CARDS } from "./adminReportConfig";

export default function AdminAuditTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection title="Audit & compliance KPIs" subtitle="Catalogue-defined audit, compliance and report-usage metrics. Role changes are declared but unlogged today.">
        <KpiScorecardStrip kpis={AUDIT_KPIS} filter={filter} onDrilldown={onDrilldown} minCardWidth={220} />
      </ReportSection>

      <ReportSection title="Audit activity by plane" subtitle="Audited actions split into security, sensitive, compliance and report-access planes.">
        <AdminBreakdownCards filter={filter} kpiId="adm.audit_activity" cards={AUDIT_BREAKDOWN_CARDS} />
      </ReportSection>

      <ReportSection title="Compliance metrics" subtitle="GDPR consent, subject-access requests, data exports and retention runs.">
        <AdminBreakdownCards filter={filter} kpiId="adm.compliance" cards={COMPLIANCE_BREAKDOWN_CARDS} />
      </ReportSection>

      <ReportSection title="Report access & export activity" subtitle="Report views and exports recorded by the shared reporting audit backbone.">
        <AdminBreakdownCards filter={filter} kpiId="adm.report_usage" cards={REPORT_USAGE_CARDS} />
      </ReportSection>

      <ReportSection title="Audit activity drill-down" subtitle="Audited actions in the period — actor, action, plane and timestamp only (no hash chain or diff).">
        <ReportDrilldownTable kpiId="adm.audit_activity" label="Audit activity" filter={filter} />
      </ReportSection>

      <ReportSection title="Compliance drill-down" subtitle="GDPR/compliance audit events behind the compliance metric.">
        <ReportDrilldownTable kpiId="adm.compliance" label="Compliance events" filter={filter} />
      </ReportSection>
    </>
  );
}
