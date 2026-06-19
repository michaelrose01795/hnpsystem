// file location: src/components/reporting/paint/PaintBreakdownCards.js
//
// Renders operational facets returned by Paint KPI resolvers. The UI does not
// calculate these figures; it only displays the engine's breakdown.

import React from "react";
import KpiValueCard from "../KpiValueCard";
import ProvenanceFooter from "../ProvenanceFooter";
import { useKpiValues } from "@/hooks/reporting/useReporting";
import { COMPLETED_BREAKDOWN_CARDS, QUEUE_BREAKDOWN_CARDS } from "./paintReportConfig";

export default function PaintBreakdownCards({ filter, source = "completed", keys = null }) {
  const kpiId = source === "queue" ? "pnt.queue" : "pnt.jobs_completed";
  const cards = source === "queue" ? QUEUE_BREAKDOWN_CARDS : COMPLETED_BREAKDOWN_CARDS;
  const { loading, error, byId } = useKpiValues([kpiId], filter);
  const result = byId[kpiId] || {};
  const breakdown = result.breakdown || {};
  const wanted = keys ? cards.filter((card) => keys.includes(card.key)) : cards;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
        {wanted.map((card) => (
          <KpiValueCard
            key={card.key}
            compact
            result={{
              kpiId: `${kpiId}.breakdown.${card.key}`,
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
