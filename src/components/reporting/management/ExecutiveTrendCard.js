// file location: src/components/reporting/management/ExecutiveTrendCard.js
//
// A labelled trend card for the executive package: a heading + the shared
// KpiTrendChart fed by the shared useKpiTrend hook. No maths — the engine builds
// the series via the snapshot/trend framework (live fallback until snapshots
// accrue). Used by the Executive Overview and Executive Trends tabs so there is
// one trend-card wrapper for the package (no duplicate trend builders).

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import KpiTrendChart from "../KpiTrendChart";
import { useKpiTrend } from "@/hooks/reporting/useReporting";

export default function ExecutiveTrendCard({ kpiId, label, unit, format, filter, granularity, granularityLabel, height = 120 }) {
  const trend = useKpiTrend(kpiId, { ...filter, granularity }, { enabled: true });
  return (
    <LayerSurface radius="var(--radius-sm)" padding="14px" gap="8px">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-1)" }}>{label}</span>
        {granularityLabel && <span style={{ fontSize: "0.7rem", color: "var(--surfaceTextMuted)" }}>{granularityLabel}</span>}
      </div>
      <KpiTrendChart series={trend.series} unit={unit} format={format} height={height} />
    </LayerSurface>
  );
}
