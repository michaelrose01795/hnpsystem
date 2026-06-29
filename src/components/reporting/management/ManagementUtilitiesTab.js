// file location: src/components/reporting/management/ManagementUtilitiesTab.js
//
// Reporting Utilities: saved executive views, CSV exports, filters and a drill-down
// explorer for the Management package. Everything routes through the shared
// reporting APIs (saved views, audited export, drill-down) — no separate executive
// reporting utility system. Every export is itself written to the audit_log via the
// shared reporting audit backbone.

import React, { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import SavedViewsBar from "../SavedViewsBar";
import ReportDrilldownTable from "../ReportDrilldownTable";
import { buildExportUrl } from "@/hooks/reporting/useReporting";
import { ALL_EXPORTABLE, MGT_VIEW_TARGET } from "./managementReportConfig";
import { reportDevKey } from "../reportDevOverlay";

export default function ManagementUtilitiesTab({ filter, onApplySavedView }) {
  const [explore, setExplore] = useState(null);

  return (
    <>
      <ReportSection title="Saved executive views" subtitle="Save and recall a filter set for the executive report.">
        <SavedViewsBar targetRef={MGT_VIEW_TARGET} currentFilter={filter} onApply={onApplySavedView} />
      </ReportSection>

      <ReportSection title="Exports & drill-downs" subtitle="Download the contributing records behind each executive composite, or explore them inline. Every export is itself audited.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {ALL_EXPORTABLE.map((kpi) => (
            <LayerSurface key={kpi.id} radius="var(--radius-sm)" padding="14px" gap="8px" sectionKey={reportDevKey("report-export-card", kpi.id)} data-dev-text-preview={`${kpi.label} export card`}>
              <div style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "0.88rem" }}>{kpi.label}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--surfaceTextMuted)" }}>{kpi.id}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                {kpi.hasDrilldown && (
                  <button type="button" className="app-btn app-btn--ghost" onClick={() => setExplore(kpi)} style={{ fontSize: "0.74rem", padding: "4px 10px" }}>
                    Explore
                  </button>
                )}
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
