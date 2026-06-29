// file location: src/components/reporting/valeting/ValetingUtilitiesTab.js
//
// Reporting Utilities: saved views, exports, filters and drill-down explorer for
// the Valeting package. Exports use the audited reporting export API.

import React, { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import SavedViewsBar from "../SavedViewsBar";
import ReportDrilldownTable from "../ReportDrilldownTable";
import { buildExportUrl } from "@/hooks/reporting/useReporting";
import { ALL_EXPORTABLE, VALETING_VIEW_TARGET } from "./valetingReportConfig";
import { reportDevKey } from "../reportDevOverlay";

export default function ValetingUtilitiesTab({ filter, onApplySavedView }) {
  const [explore, setExplore] = useState(null);

  return (
    <>
      <ReportSection title="Saved views" subtitle="Save and recall a filter set for this Valeting report.">
        <SavedViewsBar targetRef={VALETING_VIEW_TARGET} currentFilter={filter} onApply={onApplySavedView} />
      </ReportSection>

      <ReportSection title="Exports & drill-downs" subtitle="Download contributing records behind each drillable Valeting KPI, or explore them inline.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {ALL_EXPORTABLE.map((kpi) => (
            <LayerSurface key={kpi.id} radius="var(--radius-sm)" padding="14px" gap="8px" sectionKey={reportDevKey("report-export-card", kpi.id)} data-dev-text-preview={`${kpi.label} export card`}>
              <div style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "0.88rem" }}>{kpi.label}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--surfaceTextMuted)" }}>{kpi.id}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
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
