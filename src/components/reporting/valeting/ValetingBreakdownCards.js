// file location: src/components/reporting/valeting/ValetingBreakdownCards.js
//
// Renders operational facets returned by the val.cars_washed resolver. The UI
// does not calculate these figures; it only displays the engine's breakdown.

import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import KpiValueCard from "../KpiValueCard";
import ProvenanceFooter from "../ProvenanceFooter";
import { useKpiValues } from "@/hooks/reporting/useReporting";
import { BREAKDOWN_CARDS } from "./valetingReportConfig";
import { reportDevKey } from "../reportDevOverlay";

export default function ValetingBreakdownCards({ filter, keys = null }) {
  const { loading, error, byId } = useKpiValues(["val.cars_washed"], filter);
  const result = byId["val.cars_washed"] || {};
  const breakdown = result.breakdown || {};
  const wanted = keys ? BREAKDOWN_CARDS.filter((card) => keys.includes(card.key)) : BREAKDOWN_CARDS;
  const gridKey = reportDevKey("report-breakdown-grid", "val.cars_washed");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <DevLayoutSection
        sectionKey={gridKey}
        sectionType="section-shell"
        backgroundToken="transparent"
        data-dev-text-preview="val.cars_washed breakdown grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}
      >
        {wanted.map((card) => (
          <KpiValueCard
            key={card.key}
            compact
            result={{
              kpiId: `val.cars_washed.breakdown.${card.key}`,
              label: card.label,
              value: loading ? null : breakdown[card.key] ?? 0,
              unit: card.unit,
              format: card.format,
              targetType: "informational",
              warnings: result.warnings || [],
              provenance: result.provenance,
            }}
          />
        ))}
      </DevLayoutSection>
      {error && <div style={{ color: "var(--danger-base)", fontSize: "0.8rem" }}>{error}</div>}
      <ProvenanceFooter meta={result.provenance} warnings={result.warnings} compact />
    </div>
  );
}
