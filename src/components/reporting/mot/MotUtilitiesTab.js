// file location: src/components/reporting/mot/MotUtilitiesTab.js
//
// Reporting Utilities: saved views, exports and drill-down explorer. Exports
// route through the audited /api/reports/export endpoint.

import React, { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import SavedViewsBar from "../SavedViewsBar";
import ReportDrilldownTable from "../ReportDrilldownTable";
import { buildExportUrl } from "@/hooks/reporting/useReporting";
import { ALL_EXPORTABLE, MOT_VIEW_TARGET } from "./motReportConfig";

export default function MotUtilitiesTab({ filter, onApplySavedView }) {
  const [explore, setExplore] = useState(null);

  return (
    <>
      <ReportSection title="Saved views" subtitle="Save and recall a filter set (date range, granularity, search) for this MOT report.">
        <SavedViewsBar targetRef={MOT_VIEW_TARGET} currentFilter={filter} onApply={onApplySavedView} />
      </ReportSection>

      <ReportSection title="Exports & drill-downs" subtitle="Download the contributing records behind any drillable MOT KPI (audited CSV), or explore them inline.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {ALL_EXPORTABLE.map((kpi) => (
            <LayerSurface key={kpi.id} radius="var(--radius-sm)" padding="14px" gap="8px">
              <div style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "0.88rem" }}>{kpi.label}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--surfaceTextMuted)" }}>{kpi.id}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="button" className="app-btn app-btn--ghost" onClick={() => setExplore(kpi)} style={{ fontSize: "0.74rem", padding: "4px 10px" }}>
                  Explore
                </button>
                <a className="app-btn app-btn--ghost" href={buildExportUrl(kpi.id, filter)} style={{ fontSize: "0.74rem", padding: "4px 10px", textDecoration: "none" }}>
                  Export CSV
                </a>
              </div>
            </LayerSurface>
          ))}
        </div>
      </ReportSection>

      {explore && (
        <ReportSection title={`Drill-down: ${explore.label}`}>
          <ReportDrilldownTable kpiId={explore.id} label={explore.label} filter={filter} onClose={() => setExplore(null)} />
        </ReportSection>
      )}
    </>
  );
}
