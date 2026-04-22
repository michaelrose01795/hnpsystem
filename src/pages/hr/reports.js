// file location: src/pages/hr/reports.js
import React from "react";
import { SectionCard } from "@/components/Section";
import HrReportsExportsUi from "@/components/page-ui/hr/hr-reports-ui"; // Extracted presentation layer.

function ReportsContent() {
  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header>
        <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
          Generate HR analytics, download data sets, and schedule automated exports.
        </p>
      </header>

      <SectionCard title="Report Metrics" subtitle="Overview of report activity.">
        <p style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)", fontStyle: "italic", margin: 0 }}>
          TODO: Fetch report metrics from Supabase analytics. Display scheduled exports count, reports generated (30d), downloads (30d), and alerts triggered.
        </p>
      </SectionCard>

      <SectionCard
        title="Quick Export"
        subtitle="Choose a report and export format.">
        
        <p style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)", fontStyle: "italic", margin: 0 }}>
          TODO: Fetch available report types from Supabase. Build export form with report type dropdown, format selection (CSV/Excel/PDF), date range picker, and generate/schedule actions.
        </p>
      </SectionCard>

      <SectionCard
        title="Report Catalogue"
        subtitle="Available HR reporting templates.">
        
        <p style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)", fontStyle: "italic", margin: 0 }}>
          TODO: Fetch report templates from Supabase. Display each report with title, description, supported formats, and a "View definition" action.
        </p>
      </SectionCard>
    </div>);

}

export default function HrReportsExports({ embedded = false } = {}) {
  return <HrReportsExportsUi view="section1" ReportsContent={ReportsContent} />;
}
