// file location: src/components/reporting/KpiTrendChart.js
//
// Dependency-free SVG trend (area + line) for a KPI series from /api/reports/
// trend. Renders only — the engine/trendBuilder already aggregated the buckets
// (sum / ratio×100 / point-in-time) into the series values. No maths here beyond
// scaling pixels.

import React, { useMemo, useState } from "react";
import { formatKpiValue } from "@/utils/reporting/formatKpiValue";

export default function KpiTrendChart({ series = [], unit = "count", format = "0,0", height = 120 }) {
  const [hover, setHover] = useState(null);
  const points = useMemo(() => (series || []).filter((p) => p && p.value != null), [series]);

  if (points.length === 0) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--surfaceTextMuted)", fontSize: "0.8rem" }}>
        No trend data for this period yet.
      </div>
    );
  }

  const W = 600;
  const H = height;
  const padX = 8;
  const padY = 12;
  const values = points.map((p) => Number(p.value) || 0);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const stepX = points.length > 1 ? (W - padX * 2) / (points.length - 1) : 0;
  const xy = (i, v) => {
    const x = padX + i * stepX;
    const y = padY + (H - padY * 2) * (1 - (v - min) / span);
    return [x, y];
  };

  const linePath = points
    .map((p, i) => {
      const [x, y] = xy(i, Number(p.value) || 0);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const [lastX] = xy(points.length - 1, Number(points[points.length - 1].value) || 0);
  const areaPath = `${linePath} L${lastX.toFixed(1)},${(H - padY).toFixed(1)} L${padX.toFixed(1)},${(H - padY).toFixed(1)} Z`;

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, display: "block" }}>
        <defs>
          <linearGradient id="kpiTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accentText)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accentText)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#kpiTrendFill)" />
        <path d={linePath} fill="none" stroke="var(--accentText)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => {
          const [x, y] = xy(i, Number(p.value) || 0);
          return (
            <circle
              key={p.key || i}
              cx={x}
              cy={y}
              r={hover === i ? 4 : 2.5}
              fill="var(--accentText)"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--surfaceTextMuted)", marginTop: 2 }}>
        <span>{points[0].key}</span>
        {hover != null ? (
          <span style={{ color: "var(--text-1)", fontWeight: 600 }}>
            {points[hover].key}: {formatKpiValue(points[hover].value, unit, format)}
          </span>
        ) : (
          <span>{formatKpiValue(points[points.length - 1].value, unit, format)} latest</span>
        )}
        <span>{points[points.length - 1].key}</span>
      </div>
    </div>
  );
}
