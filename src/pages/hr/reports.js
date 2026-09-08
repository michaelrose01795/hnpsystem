// file location: src/pages/hr/reports.js
import React from "react";
import { SectionCard } from "@/components/Section";
import HrReportsExportsUi from "@/components/page-ui/hr/hr-reports-ui"; // Extracted presentation layer.
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { hrPresentationData } from "@/features/presentation/mockData/hr_operations";
import { redirectToHrManagerTab } from "@/lib/hr/hrManagerRoutes";
import LayerSurface from "@/components/ui/LayerSurface"; // third rung: nested inside a --theme SectionCard, so --surface (CLAUDE.md 3.0a-2)
import DataTableShell from "@/components/ui/DataTableShell"; // canonical table scroll shell (CLAUDE.md §3.4)
import EmptyState from "@/components/ui/EmptyState"; // canonical empty-state primitive

export function getServerSideProps() {
  return redirectToHrManagerTab("reports");
}

function ReportsContent() {
  const showPresentationMock = isPresentationMode();

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header>
        <p style={{ color: "var(--text-1)", marginTop: "var(--space-1)" }}>
          Generate HR analytics, download data sets, and schedule automated exports.
        </p>
      </header>

      <SectionCard layer="theme"
        sectionKey="hr-reports-report-metrics"
        parentKey="hr-manager-tab-reports"
        title="Report Metrics"
        subtitle="Overview of report activity.">
        {showPresentationMock ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--layout-card-gap)" }}>
            {hrPresentationData.reportMetrics.map((metric) => (
              <div key={metric.id} style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                <span style={{ color: "var(--text-1)", fontSize: "var(--text-label)" }}>{metric.label}</span>
                <strong style={{ color: "var(--accentText)", fontSize: "var(--text-h2)" }}>{metric.value}</strong>
                <span style={{ color: "var(--text-1)", fontSize: "var(--text-caption)" }}>{metric.detail}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="📊"
            title="No report activity yet"
            description="Scheduled exports, reports generated and downloads over the last 30 days appear here."
          />
        )}
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-reports-quick-export"
        parentKey="hr-manager-tab-reports"
        title="Quick Export"
        subtitle="Choose a report and export format.">
        
        {showPresentationMock ? (
          <LayerSurface padding="var(--space-3)" gap="0">
            <DataTableShell>
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
            </DataTableShell>
          </LayerSurface>
        ) : (
          <EmptyState
            icon="⬇️"
            title="No reports available to export"
            description="Report types appear here with the formats and date ranges you can export them in."
          />
        )}
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-reports-report-catalogue"
        parentKey="hr-manager-tab-reports"
        title="Report Catalogue"
        subtitle="Available HR reporting templates.">
        
        {showPresentationMock ? (
          <LayerSurface padding="var(--space-3)" gap="0">
            <DataTableShell>
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
            </DataTableShell>
          </LayerSurface>
        ) : (
          <EmptyState
            icon="🗂️"
            title="No report templates"
            description="Saved HR report templates appear here with their description and supported formats."
          />
        )}
      </SectionCard>
    </div>);

}

export default function HrReportsExports() {
  return <HrReportsExportsUi view="section1" ReportsContent={ReportsContent} />;
}
