// file location: src/components/reporting/management/DepartmentPerformanceTab.js
//
// Department Performance: a cross-department comparison composed by the
// mgt.department_performance resolver (each department's existing headline KPIs,
// read through their own resolvers). The component renders the engine's
// breakdown.departments array — it computes nothing. The normalised performance
// INDEX / ranking is flagged as declared (needs dim_kpi weights + targets); the
// per-department composed KPI values are shown for direct comparison, with the
// shared trend chart for throughput history.

import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import ExecutiveTrendCard from "./ExecutiveTrendCard";
import ProvenanceFooter from "../ProvenanceFooter";
import { useKpiValues } from "@/hooks/reporting/useReporting";
import { DEPARTMENT_PERFORMANCE_KPI } from "./managementReportConfig";

const num = (v) =>
  v == null ? "—" : typeof v === "number" ? v.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : String(v);

function HealthPill({ reporting }) {
  // Background-tint + text-colour signalling only (no coloured side-borders — border law).
  const fg = reporting ? "var(--success-base)" : "var(--surfaceTextMuted)";
  return (
    <span style={{ background: "var(--theme)", color: fg, borderRadius: 999, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700 }}>
      {reporting ? "Reporting" : "No data"}
    </span>
  );
}

export default function DepartmentPerformanceTab({ filter }) {
  const { loading, error, byId } = useKpiValues([DEPARTMENT_PERFORMANCE_KPI], filter);
  const result = byId[DEPARTMENT_PERFORMANCE_KPI] || {};
  const departments = result.breakdown?.departments || [];

  return (
    <>
      <ReportSection
        title="Department comparison"
        subtitle="Every operational department's headline KPIs side by side — composed from each department package's own resolvers. A single normalised performance index / ranking needs the dim_kpi weighting model and targets (declared); the live composed values are shown for direct comparison."
      >
        <LayerSurface radius="var(--radius-sm)" padding="16px" gap="12px" sectionKey="report-department-comparison-table-card" data-dev-text-preview="Department comparison table card">
          {error && <div style={{ color: "var(--danger-base)", fontSize: "0.82rem" }}>{error}</div>}
          {loading && <div style={{ color: "var(--surfaceTextMuted)", fontSize: "0.85rem" }}>Loading department KPIs…</div>}
          {!loading && departments.length > 0 && (
            <DevLayoutSection
              as="div"
              className="app-table-shell-scroll"
              data-report-table-pan
              sectionKey="report-department-comparison-table-scroll"
              sectionType="section-shell"
              parentKey="report-department-comparison-table-card"
              backgroundToken="transparent"
              data-dev-text-preview="Department comparison table scroll area"
              style={{ overflowX: "auto" }}
            >
              <table
                className="app-data-table app-table-shell app-table-shell--with-headings"
                data-dev-section-key="report-department-comparison-table"
                data-dev-section-type="data-table"
                data-dev-section-parent="report-department-comparison-table-scroll"
                data-dev-background-token="transparent"
                data-dev-text-preview="Department comparison table"
                style={{ width: "100%" }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", whiteSpace: "nowrap" }}>Department</th>
                    <th style={{ textAlign: "left", whiteSpace: "nowrap" }}>Throughput KPI</th>
                    <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Value</th>
                    <th style={{ textAlign: "left", whiteSpace: "nowrap" }}>Quality KPI</th>
                    <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Value</th>
                    <th style={{ textAlign: "left", whiteSpace: "nowrap" }}>Health</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.department}>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{d.label}</td>
                      <td style={{ whiteSpace: "nowrap", color: "var(--surfaceTextMuted)", fontSize: "0.8rem" }}>{d.primary_kpi}</td>
                      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>{num(d.primary_value)}</td>
                      <td style={{ whiteSpace: "nowrap", color: "var(--surfaceTextMuted)", fontSize: "0.8rem" }}>{d.quality_kpi}</td>
                      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>{num(d.quality_value)}</td>
                      <td style={{ whiteSpace: "nowrap" }}><HealthPill reporting={d.reporting} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DevLayoutSection>
          )}
          <ProvenanceFooter meta={result.provenance} warnings={result.warnings} compact />
        </LayerSurface>
      </ReportSection>

      <ReportSection title="Department throughput trends" subtitle="Throughput history for the operational departments, built by the shared trend framework.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <ExecutiveTrendCard kpiId="wsh.jobs_completed" label="Workshop jobs completed" unit="count" format="0,0" filter={filter} granularity="week" granularityLabel="Weekly" />
          <ExecutiveTrendCard kpiId="prt.fitted" label="Parts fitted" unit="count" format="0,0" filter={filter} granularity="week" granularityLabel="Weekly" />
          <ExecutiveTrendCard kpiId="mot.volume" label="MOT volume" unit="count" format="0,0" filter={filter} granularity="week" granularityLabel="Weekly" />
          <ExecutiveTrendCard kpiId="val.cars_washed" label="Valeting throughput" unit="count" format="0,0" filter={filter} granularity="week" granularityLabel="Weekly" />
        </div>
      </ReportSection>
    </>
  );
}
