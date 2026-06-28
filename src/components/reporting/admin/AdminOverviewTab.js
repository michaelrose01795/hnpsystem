// file location: src/components/reporting/admin/AdminOverviewTab.js
//
// Admin Overview: department scorecard plus daily / weekly / monthly summaries.
// All values come from the shared reporting APIs — no maths in the component.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import KpiScorecardStrip from "../KpiScorecardStrip";
import KpiTrendChart from "../KpiTrendChart";
import { useKpiTrend } from "@/hooks/reporting/useReporting";
import AdminBreakdownCards from "./AdminBreakdownCards";
import { OVERVIEW_SCORECARD, AUDIT_BREAKDOWN_CARDS } from "./adminReportConfig";

function TrendCard({ kpiId, label, unit, format, filter, granularity, granularityLabel }) {
  const trend = useKpiTrend(kpiId, { ...filter, granularity }, { enabled: true });
  return (
    <LayerSurface radius="var(--radius-sm)" padding="14px" gap="8px">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-1)" }}>{label}</span>
        <span style={{ fontSize: "0.7rem", color: "var(--surfaceTextMuted)" }}>{granularityLabel}</span>
      </div>
      <KpiTrendChart series={trend.series} unit={unit} format={format} height={110} />
    </LayerSurface>
  );
}

export default function AdminOverviewTab({ filter, onDrilldown }) {
  return (
    <>
      <ReportSection
        title="Department scorecard"
        subtitle="Catalogue-defined Admin KPIs. Login security, audit volume and compliance activity are live; report usage and active users are audit-backed proxies until the report_event spine accrues."
      >
        <KpiScorecardStrip kpis={OVERVIEW_SCORECARD} filter={filter} onDrilldown={onDrilldown} showProvenance={false} />
      </ReportSection>

      <ReportSection title="Daily summary" subtitle="Audited activity split by security, sensitive, compliance and report-access planes returned by the audit-activity resolver.">
        <AdminBreakdownCards filter={filter} kpiId="adm.audit_activity" cards={AUDIT_BREAKDOWN_CARDS} />
      </ReportSection>

      <ReportSection title="Weekly and monthly summary" subtitle="Audited activity volume re-bucketed by the reporting engine.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <TrendCard kpiId="adm.audit_activity" label="Audit activity" unit="count" format="0,0" filter={filter} granularity="day" granularityLabel="Daily" />
          <TrendCard kpiId="adm.audit_activity" label="Audit activity" unit="count" format="0,0" filter={filter} granularity="week" granularityLabel="Weekly" />
          <TrendCard kpiId="adm.audit_activity" label="Audit activity" unit="count" format="0,0" filter={filter} granularity="month" granularityLabel="Monthly" />
        </div>
      </ReportSection>
    </>
  );
}
