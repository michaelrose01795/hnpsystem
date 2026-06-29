// file location: src/pages/hr/reports.js
import React from "react";
import { SectionCard } from "@/components/Section";
import HrReportsExportsUi from "@/components/page-ui/hr/hr-reports-ui"; // Extracted presentation layer.
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { hrPresentationData } from "@/features/presentation/mockData/hr_operations";

function ReportsContent() {
  const showPresentationMock = isPresentationMode();

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header>
        <p style={{ color: "var(--text-1)", marginTop: "var(--space-1)" }}>
          Generate HR analytics, download data sets, and schedule automated exports.
        </p>
      </header>

      <SectionCard title="Report Metrics" subtitle="Overview of report activity.">
        {showPresentationMock ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--layout-card-gap)" }}>
            {hrPresentationData.reportMetrics.map((metric) => (
              <div key={metric.id} style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                <span style={{ color: "var(--text-1)", fontSize: "var(--text-label)" }}>{metric.label}</span>
                <strong style={{ color: "var(--accentText)", fontSize: "var(--text-title)" }}>{metric.value}</strong>
                <span style={{ color: "var(--text-1)", fontSize: "var(--text-caption)" }}>{metric.detail}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch report metrics from Supabase analytics. Display scheduled exports count, reports generated (30d), downloads (30d), and alerts triggered.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Quick Export"
        subtitle="Choose a report and export format.">
        
        {showPresentationMock ? (
          <div className="app-table-shell-scroll" data-report-table-pan style={{ overflowX: "auto" }}>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Description</th>
                  <th>Formats</th>
                </tr>
              </thead>
              <tbody>
                {hrPresentationData.reportCatalogue.slice(0, 3).map((report) => (
                  <tr key={report.id}>
                    <td style={{ fontWeight: 600 }}>{report.title}</td>
                    <td>{report.description}</td>
                    <td>{report.formats}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch available report types from Supabase. Build export form with report type dropdown, format selection (CSV/Excel/PDF), date range picker, and generate/schedule actions.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Report Catalogue"
        subtitle="Available HR reporting templates.">
        
        {showPresentationMock ? (
          <div className="app-table-shell-scroll" data-report-table-pan style={{ overflowX: "auto" }}>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Description</th>
                  <th>Formats</th>
                </tr>
              </thead>
              <tbody>
                {hrPresentationData.reportCatalogue.map((report) => (
                  <tr key={report.id}>
                    <td style={{ fontWeight: 600 }}>{report.title}</td>
                    <td>{report.description}</td>
                    <td>{report.formats}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch report templates from Supabase. Display each report with title, description, supported formats, and a "View definition" action.
          </p>
        )}
      </SectionCard>
    </div>);

}

export default function HrReportsExports() {
  return <HrReportsExportsUi view="section1" ReportsContent={ReportsContent} />;
}
