// file location: src/components/reporting/KpiTrendChart.js
//
// Dependency-free SVG trend (area + line) for a KPI series from /api/reports/
// trend. Renders only — the engine/trendBuilder already aggregated the buckets
// (sum / ratio×100 / point-in-time) into the series values. No maths here beyond
// scaling pixels for the path.
//
// Visual system is the shared "report graph" (Revolut-style) defined globally in
// src/styles/staffglobal.css (`.report-graph*` classes + `--report-graph-*`
// tokens). This component owns no colours: restyle every report graph at once by
// editing those tokens. Behaviour layered on top: smooth rounded line, soft
// glowing active/selected segment, pointer-follow scrub marker, animated value
// movement, touch-friendly scrubbing, and reduced-motion fallbacks.

import React, { useEffect, useMemo, useRef, useState } from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import { formatKpiValue } from "@/utils/reporting/formatKpiValue";

// Catmull-Rom → cubic-bezier smoothing for a rounded, premium line path.
function smoothPath(pts, tension = 0.18) {
  if (!pts.length) return "";
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * tension;
    const c1y = p1[1] + (p2[1] - p0[1]) * tension;
    const c2x = p2[0] - (p3[0] - p1[0]) * tension;
    const c2y = p2[1] - (p3[1] - p1[1]) * tension;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

// Display a bucket key as DD/MM/YY when it is an ISO date (matching the report
// drilldown tables); non-date labels (e.g. "Jun 2026", "Week 23") pass through.
function formatAxisLabel(key) {
  if (typeof key !== "string") return key;
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2})?/);
  if (m) return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
  return key;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

// Tween a number toward `target` (animated value movement). Jumps instantly when
// motion is reduced or on first mount.
function useTweenedNumber(target, animate) {
  const [val, setVal] = useState(target);
  const valRef = useRef(target);
  valRef.current = val;
  useEffect(() => {
    if (!animate || typeof window === "undefined") {
      setVal(target);
      return;
    }
    const from = valRef.current;
    if (from === target) return;
    let raf = 0;
    let startTs = null;
    const dur = 340;
    const tick = (ts) => {
      if (startTs == null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);
  return val;
}

function TrendSkeleton({ height, sectionKey, parentKey }) {
  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="content-card"
      backgroundToken="transparent"
      className="report-graph"
      data-dev-text-preview="Loading KPI trend chart"
      style={{ minHeight: height + 58 }}
    >
      <SkeletonKeyframes />
      <div className="report-graph__plot" style={{ height, display: "flex", alignItems: "stretch" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, width: "100%", padding: "8px 4px 2px" }}>
          {[46, 70, 54, 82, 62, 92, 58, 76].map((barHeight, index) => (
            <SkeletonBlock
              key={index}
              width="100%"
              height={`${Math.max(24, Math.round((barHeight / 100) * height))}px`}
              borderRadius="var(--radius-sm)"
              style={{ flex: "1 1 0", opacity: index % 2 === 0 ? 0.78 : 0.95 }}
            />
          ))}
        </div>
      </div>
      <div className="report-graph__panel">
        <SkeletonBlock width="62px" height="12px" borderRadius="999px" />
        <span style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <SkeletonBlock width="46px" height="10px" borderRadius="999px" />
          <SkeletonBlock width="88px" height="18px" borderRadius="999px" />
        </span>
        <SkeletonBlock width="62px" height="12px" borderRadius="999px" />
      </div>
    </DevLayoutSection>
  );
}

export default function KpiTrendChart({ series = [], unit = "count", format = "0,0", height = 120, sectionKey, parentKey, loading = false }) {
  const reactId = React.useId();
  const fillId = `kpiTrendFill-${reactId}`;
  const glowId = `kpiTrendGlow-${reactId}`;

  const reducedMotion = usePrefersReducedMotion();
  const [hover, setHover] = useState(null); // selected/scrubbed index

  const points = useMemo(() => (series || []).filter((p) => p && p.value != null), [series]);
  const latestValue = points.length ? Number(points[points.length - 1].value) || 0 : 0;
  const targetValue = hover != null && points[hover] ? Number(points[hover].value) || 0 : latestValue;
  const tweened = useTweenedNumber(targetValue, !reducedMotion);

  if (loading) {
    return <TrendSkeleton height={height} sectionKey={sectionKey} parentKey={parentKey} />;
  }

  if (points.length === 0) {
    return (
      <DevLayoutSection
        sectionKey={sectionKey}
        parentKey={parentKey}
        sectionType="content-card"
        backgroundToken="transparent"
        className="report-graph__empty"
        data-dev-text-preview="Empty KPI trend chart"
        style={{ height }}
      >
        No trend data for this period yet.
      </DevLayoutSection>
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
    const x = points.length > 1 ? padX + i * stepX : W / 2;
    const y = padY + (H - padY * 2) * (1 - (v - min) / span);
    return [x, y];
  };

  const pts = points.map((p, i) => xy(i, Number(p.value) || 0));
  const linePath = smoothPath(pts);
  const [lastX] = pts[pts.length - 1];
  const [firstX] = pts[0];
  const areaPath =
    points.length > 1
      ? `${linePath} L${lastX.toFixed(1)},${(H - padY).toFixed(1)} L${firstX.toFixed(1)},${(H - padY).toFixed(1)} Z`
      : "";

  // Active (selected) segment: from the start up to the scrubbed index.
  const activePath = hover != null && hover > 0 ? smoothPath(pts.slice(0, hover + 1)) : "";

  const indexFromEvent = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return 0;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return Math.round(ratio * (points.length - 1));
  };
  const handleMove = (e) => setHover(indexFromEvent(e));
  const handleLeave = () => setHover(null);

  const markerX = hover != null ? (pts[hover][0] / W) * 100 : 0;
  const markerY = hover != null ? pts[hover][1] : 0;

  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="content-card"
      backgroundToken="transparent"
      className={`report-graph${hover != null ? " report-graph--scrubbing" : ""}`}
      data-dev-text-preview="KPI trend chart"
    >
      <div
        className="report-graph__plot"
        style={{ height: H }}
        onPointerMove={handleMove}
        onPointerDown={handleMove}
        onPointerLeave={handleLeave}
        onPointerCancel={handleLeave}
      >
        <svg
          className="report-graph__svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ height: H }}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--report-graph-fill-top)" />
              <stop offset="100%" stopColor="var(--report-graph-fill-bottom)" />
            </linearGradient>
            <filter id={glowId} x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {areaPath && <path d={areaPath} fill={`url(#${fillId})`} />}

          {/* Soft glow underlay for the active segment (or full line when idle). */}
          <path
            className="report-graph__glow"
            d={activePath || linePath}
            filter={`url(#${glowId})`}
            opacity={hover != null ? 0.85 : 0.5}
            vectorEffect="non-scaling-stroke"
          />

          {/* Base line — draws on first mount, dims while a section is selected. */}
          <path
            className={`report-graph__line report-graph__line--base${reducedMotion ? "" : " report-graph__draw"}`}
            d={linePath}
            pathLength="1"
            vectorEffect="non-scaling-stroke"
          />

          {/* Bright active/selected segment on top. */}
          {activePath && (
            <path
              className="report-graph__line report-graph__line--active"
              d={activePath}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {hover != null && (
          <span
            className="report-graph__dot"
            style={{ left: `${markerX}%`, top: markerY }}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="report-graph__panel">
        <span>{formatAxisLabel(points[0].key)}</span>
        <span style={{ textAlign: "center", flex: 1 }}>
          <span className="report-graph__value-label">
            {hover != null ? formatAxisLabel(points[hover].key) : "Latest"}
          </span>
          <span className="report-graph__value">{formatKpiValue(tweened, unit, format)}</span>
        </span>
        <span className="report-graph__panel-end">{formatAxisLabel(points[points.length - 1].key)}</span>
      </div>
    </DevLayoutSection>
  );
}
