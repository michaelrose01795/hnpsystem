// file location: src/components/reporting/KpiScorecardStrip.js
//
// A responsive grid of KPI summary cards for a set of KPI ids — the "scorecard"
// at the top of a department report. Fetches all ids in ONE /api/reports/kpi
// call (the engine resolves them concurrently) and renders a KpiValueCard each.

import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import KpiValueCard from "./KpiValueCard";
import ProvenanceFooter from "./ProvenanceFooter";
import { useKpiValues } from "@/hooks/reporting/useReporting";
import { reportDevKey } from "./reportDevOverlay";

export default function KpiScorecardStrip({ kpis = [], filter, onDrilldown, minCardWidth = 200, showProvenance = false }) {
  const ids = kpis.map((k) => k.id);
  const { loading, error, byId, warnings } = useKpiValues(ids, filter);
  const gridKey = reportDevKey("report-scorecard-grid", ids.join("-") || "empty");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <DevLayoutSection
        sectionKey={gridKey}
        sectionType="section-shell"
        backgroundToken="transparent"
        data-dev-text-preview="Report KPI scorecard grid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(${minCardWidth}px, 1fr))`,
          gap: 12,
        }}
      >
        {kpis.map((k) => (
          <KpiValueCard
            key={k.id}
            result={byId[k.id] || { kpiId: k.id, label: k.label, value: loading ? null : null, unit: k.unit, format: k.format, warnings: [] }}
            readiness={k.readiness}
            loading={loading && !byId[k.id]}
            onDrilldown={onDrilldown ? () => onDrilldown(k) : undefined}
            showProvenance={showProvenance}
          />
        ))}
      </DevLayoutSection>
      {error && <div style={{ color: "var(--danger-base)", fontSize: "0.8rem" }}>{error}</div>}
      {!showProvenance && <ProvenanceFooter warnings={warnings} />}
    </div>
  );
}
