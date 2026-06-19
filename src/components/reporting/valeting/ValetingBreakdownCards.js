// file location: src/components/reporting/valeting/ValetingBreakdownCards.js
//
// Renders operational facets returned by the val.cars_washed resolver. The UI
// does not calculate these figures; it only displays the engine's breakdown.

import React from "react";
import KpiValueCard from "../KpiValueCard";
import ProvenanceFooter from "../ProvenanceFooter";
import { useKpiValues } from "@/hooks/reporting/useReporting";
import { BREAKDOWN_CARDS } from "./valetingReportConfig";

export default function ValetingBreakdownCards({ filter, keys = null }) {
  const { loading, error, byId } = useKpiValues(["val.cars_washed"], filter);
  const result = byId["val.cars_washed"] || {};
  const breakdown = result.breakdown || {};
  const wanted = keys ? BREAKDOWN_CARDS.filter((card) => keys.includes(card.key)) : BREAKDOWN_CARDS;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
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
      </div>
      {error && <div style={{ color: "var(--danger-base)", fontSize: "0.8rem" }}>{error}</div>}
      <ProvenanceFooter meta={result.provenance} warnings={result.warnings} compact />
    </div>
  );
}
