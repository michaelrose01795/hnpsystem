// file location: src/components/reporting/management/ExecutiveDrilldownTab.js
//
// Executive Drill-down: navigate from the executive view into the EXISTING
// department report packages (no department report page is duplicated — these are
// links into the shared platform's own /reports/* routes), plus an inline
// drill-down explorer that reuses the shared ReportDrilldownTable / drill-down API
// for the executive composites that carry a drill-down (e.g. company revenue →
// the contributing invoices, composed from acc.revenue's own drill-down).

import React, { useState } from "react";
import Link from "next/link";
import LayerSurface from "@/components/ui/LayerSurface";
import ReportSection from "../ReportSection";
import ReportDrilldownTable from "../ReportDrilldownTable";
import { CROSS_DEPARTMENT_LINKS, ALL_EXPORTABLE } from "./managementReportConfig";
import { reportDevKey } from "../reportDevOverlay";

export default function ExecutiveDrilldownTab({ filter }) {
  const [explore, setExplore] = useState(null);
  const drillable = ALL_EXPORTABLE.filter((k) => k.hasDrilldown);

  return (
    <>
      {/* Department report links: a grid of shortcuts from the executive view into each department's own report pages. */}
      <ReportSection
        title="Open a department reporting package"
        subtitle="Drill from the executive view straight into the existing department report pages. These reuse the shared reporting platform — no department report is recreated here."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 12 }}>
          {CROSS_DEPARTMENT_LINKS.map((area) => (
            <Link key={area.href} href={area.href} style={{ textDecoration: "none" }}>
              {/* Department link card: the department's name and a short description of its report. */}
              <LayerSurface radius="var(--radius-sm)" padding="14px" gap="6px" sectionKey={reportDevKey("report-department-link", area.href)} data-dev-text-preview={`${area.label} report link`}>
                <div style={{ fontWeight: 700, color: "var(--accentText)", fontSize: "0.92rem" }}>{area.label}</div>
                <div style={{ fontSize: "0.76rem", color: "var(--surfaceTextMuted)", lineHeight: 1.35 }}>{area.description}</div>
              </LayerSurface>
            </Link>
          ))}
        </div>
      </ReportSection>

      {/* Executive KPI drill-down: lists the headline figures whose underlying records can be inspected. */}
      <ReportSection
        title="Executive KPI drill-down"
        subtitle="Inspect the contributing records behind a drillable executive composite, reusing the shared drill-down infrastructure."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 12 }}>
          {drillable.map((kpi) => (
            // KPI card: the figure's name and identifier with an Explore records button.
            <LayerSurface key={kpi.id} radius="var(--radius-sm)" padding="14px" gap="8px" sectionKey={reportDevKey("report-drilldown-card", kpi.id)} data-dev-text-preview={`${kpi.label} drill-down card`}>
              <div style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "0.88rem" }}>{kpi.label}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--surfaceTextMuted)" }}>{kpi.id}</div>
              <button type="button" className="app-btn app-btn--primary app-btn--xs" onClick={() => setExplore(kpi)} style={{ alignSelf: "flex-start" }}>
                Explore records
              </button>
            </LayerSurface>
          ))}
        </div>
      </ReportSection>

      {explore && (
        // Drill-down results: a table of the records behind the chosen figure, shown once one has been picked.
        <ReportSection title={`Drill-down: ${explore.label}`}>
          <ReportDrilldownTable kpiId={explore.id} label={explore.label} filter={filter} onClose={() => setExplore(null)} />
        </ReportSection>
      )}
    </>
  );
}
