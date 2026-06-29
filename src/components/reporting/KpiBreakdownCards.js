// file location: src/components/reporting/KpiBreakdownCards.js
//
// Shared reporting component: renders the operational facets returned in a single
// KPI resolver's `breakdown` object as a responsive grid of value cards. The UI
// does NOT calculate these figures — it only displays the engine's breakdown for
// one KPI id. Promoted to the shared folder (from the per-package copies the Admin
// / Valeting / Paint packages each carried) so the Management package adds no
// duplicate breakdown-card implementation.

import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import KpiValueCard from "./KpiValueCard";
import ProvenanceFooter from "./ProvenanceFooter";
import { useKpiValues } from "@/hooks/reporting/useReporting";
import { reportDevKey } from "./reportDevOverlay";

export default function KpiBreakdownCards({ filter, kpiId, cards = [], keys = null, minCardWidth = 210 }) {
  const { loading, error, byId } = useKpiValues([kpiId], filter);
  const result = byId[kpiId] || {};
  const breakdown = result.breakdown || {};
  const wanted = keys ? cards.filter((card) => keys.includes(card.key)) : cards;
  const gridKey = reportDevKey("report-breakdown-grid", kpiId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <DevLayoutSection
        sectionKey={gridKey}
        sectionType="section-shell"
        backgroundToken="transparent"
        data-dev-text-preview={`${kpiId} breakdown grid`}
        style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${minCardWidth}px, 1fr))`, gap: 12 }}
      >
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
            loading={loading}
          />
        ))}
      </DevLayoutSection>
      {error && <div style={{ color: "var(--danger-base)", fontSize: "0.8rem" }}>{error}</div>}
      <ProvenanceFooter meta={result.provenance} warnings={result.warnings} compact />
    </div>
  );
}
