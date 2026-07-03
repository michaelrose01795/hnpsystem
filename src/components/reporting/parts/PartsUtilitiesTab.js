// file location: src/components/reporting/parts/PartsUtilitiesTab.js
//
// Reporting Utilities: saved views, exports and an on-demand drill-down explorer.
// Filtering itself lives in the always-visible ReportFilterBar at the top of the
// page. Exports route through the audited /api/reports/export endpoint; saved
// views through /api/reports/views. Identical shared components to the Workshop
// package — no duplicate implementation.

import React, { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import SavedViewsBar from "../SavedViewsBar";
import ReportDrilldownTable from "../ReportDrilldownTable";
import { buildExportUrl } from "@/hooks/reporting/useReporting";
import { ALL_EXPORTABLE, PARTS_VIEW_TARGET } from "./partsReportConfig";
import { reportDevKey } from "../reportDevOverlay";

export default function PartsUtilitiesTab({ filter, onApplySavedView }) {
  const [explore, setExplore] = useState(null);

  return (
    <>
      <ReportSection title="Saved views" subtitle="Save and recall a filter set (date range, granularity, search) for this report.">
        <SavedViewsBar targetRef={PARTS_VIEW_TARGET} currentFilter={filter} onApply={onApplySavedView} />
      </ReportSection>

      <ReportSection title="Exports & drill-downs" subtitle="Download the contributing records behind any drillable Parts KPI (audited CSV), or explore them inline.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {ALL_EXPORTABLE.map((kpi) => (
            <LayerSurface key={kpi.id} radius="var(--radius-sm)" padding="14px" gap="8px" sectionKey={reportDevKey("report-export-card", kpi.id)} data-dev-text-preview={`${kpi.label} export card`}>
              <div style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "0.88rem" }}>{kpi.label}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--surfaceTextMuted)" }}>{kpi.id}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="button" className="app-btn app-btn--secondary" onClick={() => setExplore(kpi)} style={{ fontSize: "0.74rem", padding: "4px 10px" }}>
                  Explore
                </button>
                <a className="app-btn app-btn--primary" href={buildExportUrl(kpi.id, filter)} style={{ fontSize: "0.74rem", padding: "4px 10px", textDecoration: "none" }}>
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
