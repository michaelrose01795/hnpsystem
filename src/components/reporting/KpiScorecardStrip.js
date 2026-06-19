// file location: src/components/reporting/KpiScorecardStrip.js
//
// A responsive grid of KPI summary cards for a set of KPI ids — the "scorecard"
// at the top of a department report. Fetches all ids in ONE /api/reports/kpi
// call (the engine resolves them concurrently) and renders a KpiValueCard each.

import React from "react";
import KpiValueCard from "./KpiValueCard";
import ProvenanceFooter from "./ProvenanceFooter";
import { useKpiValues } from "@/hooks/reporting/useReporting";

export default function KpiScorecardStrip({ kpis = [], filter, onDrilldown, minCardWidth = 200, showProvenance = false }) {
  const ids = kpis.map((k) => k.id);
  const { loading, error, byId, warnings } = useKpiValues(ids, filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
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
            onDrilldown={k.hasDrilldown && onDrilldown ? () => onDrilldown(k) : undefined}
            showProvenance={showProvenance}
          />
        ))}
      </div>
      {error && <div style={{ color: "var(--danger-base)", fontSize: "0.8rem" }}>{error}</div>}
      {!showProvenance && <ProvenanceFooter warnings={warnings} />}
    </div>
  );
}
