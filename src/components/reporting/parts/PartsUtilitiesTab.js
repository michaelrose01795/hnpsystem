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
      {/* Saved views: save the current report filters under a name and recall them later. */}
      <ReportSection title="Saved views" subtitle="Save and recall a filter set (date range, granularity, search) for this report.">
        <SavedViewsBar targetRef={PARTS_VIEW_TARGET} currentFilter={filter} onApply={onApplySavedView} />
      </ReportSection>

      {/* Exports and drill-downs: a card for each Parts KPI whose underlying records can be explored or downloaded. */}
      <ReportSection title="Exports & drill-downs" subtitle="Download the contributing records behind any drillable Parts KPI (audited CSV), or explore them inline.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 12 }}>
          {ALL_EXPORTABLE.map((kpi) => (
            // Export card: the KPI name and identifier, with buttons to explore its records on the page or export them as a CSV file.
            <LayerSurface key={kpi.id} radius="var(--radius-sm)" padding="14px" gap="8px" sectionKey={reportDevKey("report-export-card", kpi.id)} data-dev-text-preview={`${kpi.label} export card`}>
              <div style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "0.88rem" }}>{kpi.label}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--surfaceTextMuted)" }}>{kpi.id}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="button" className="app-btn app-btn--secondary app-btn--xs" onClick={() => setExplore(kpi)}>
                  Explore
                </button>
                <a className="app-btn app-btn--primary app-btn--xs" href={buildExportUrl(kpi.id, filter)}>
                  Export CSV
                </a>
              </div>
            </LayerSurface>
          ))}
        </div>
      </ReportSection>

      {explore && (
        // Drill-down: a table of the records behind the KPI chosen with Explore, which can be closed again.
        <ReportSection title={`Drill-down: ${explore.label}`}>
          <ReportDrilldownTable kpiId={explore.id} label={explore.label} filter={filter} onClose={() => setExplore(null)} />
        </ReportSection>
      )}
    </>
  );
}
