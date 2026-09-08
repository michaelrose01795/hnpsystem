// file location: src/components/ui/LoadingSkeleton.js
// Shared skeleton primitives used across the system.
//
// Rules:
// - One skeleton is shown per loading phase. No overlays, no stacking.
// - Skeletons render INSIDE the .app-page-stack wrapper provided by Layout —
//   so they should be the same shape as the real .app-section-card children
//   a page will produce once loaded. That keeps the transition flicker-free.

import React from "react";
import { useRouter } from "next/compat/router";
import LayerTheme from "@/components/ui/LayerTheme";
import LayerSurface from "@/components/ui/LayerSurface";

export function SkeletonBlock({ width = "100%", height = "20px", borderRadius = "var(--skeleton-radius, 8px)", style }) {
  return (
    <div
      className="skeleton-block"
      aria-hidden="true"
      style={{
        width,
        maxWidth: "100%",
        minWidth: 0,
        height,
        borderRadius,
        background:
          "linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-highlight) 50%, var(--skeleton-base) 75%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-scan var(--skeleton-animation-duration,1.8s) linear infinite",
        flexShrink: 0,
        ...(style || {}),
      }}
    />
  );
}

// Tiny inline loader used in place of plain "Loading…" / "Searching…" text inside
// search results, filters, or composer rows. Never full-block — short, subtle,
// themed. Always wrap next to the item being loaded so layout doesn't jump.
export function InlineLoading({ width = 140, height = 12, label = "Loading", className, style }) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        verticalAlign: "middle",
        ...(style || {}),
      }}
    >
      <SkeletonKeyframes />
      <SkeletonBlock width={`${width}px`} height={`${height}px`} borderRadius="999px" />
    </span>
  );
}

// Section card skeleton — uses the same `.app-section-card` class as the real
// page sections, so widths, padding, border, radius, background match the
// final layout exactly. Only the inside shimmer content changes to real text.
export function SectionSkeleton({ titleWidth = "180px", subtitleWidth = "240px", rows = 3, showHeader = true, minHeight = "auto", style, layer = "theme" }) {
  const Layer = layer === "surface" ? LayerSurface : LayerTheme;
  return (
    <Layer style={{ minHeight, minWidth: 0, ...style }}>
      <SkeletonKeyframes />
      {showHeader && <div style={{ display: "grid", gap: "var(--space-sm)" }}>
        <SkeletonBlock width={titleWidth} height="18px" />
        <SkeletonBlock width={subtitleWidth} height="12px" />
      </div>}
      <div style={{ display: "grid", gap: "var(--layout-card-gap)" }}>
        {Array.from({ length: rows }, (_, index) => <SkeletonBlock key={index} width={index % 2 ? "82%" : "100%"} height="14px" />)}
      </div>
    </Layer>
  );
}

export function SectionGridSkeleton({ cards = 4, cols = "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", rows = 3, style }) {
  return <LayerTheme style={{ display: "grid", gridTemplateColumns: cols, minWidth: 0, ...style }}>
    <SkeletonKeyframes />
    {Array.from({ length: cards }, (_, index) => <SectionSkeleton key={index} rows={rows} layer="surface" />)}
  </LayerTheme>;
}

export function SkeletonMetricCard({ layer = "theme" }) {
  const Layer = layer === "surface" ? LayerSurface : LayerTheme;
  return <Layer style={{ minWidth: 0, flex: 1 }}>
    <SkeletonKeyframes />
    <SkeletonBlock width="60%" height="14px" />
    <SkeletonBlock width="38%" height="30px" />
    <SkeletonBlock width="75%" height="12px" />
  </Layer>;
}

// A single placeholder row for a table that is already rendered by the page.
// Shares the cell, width and cascade rules with <TableSkeleton> — both are
// styled from src/styles/families/loaders.css, so one edit there restyles every
// table placeholder in the app.
export function SkeletonTableRow({ cols = 5 }) {
  return (
    <tr className="skeleton-table__row">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <span className="skeleton-table__cell" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Chart / graph / table skeletons
//
// These two are the ONLY approved loading placeholders for a graph or a data
// table. They carry no styling of their own — every colour, size, duration and
// keyframe lives in the loader family stylesheet
// (src/styles/families/loaders.css, imported by staffglobal.css). Change that
// one file and the loading state of every graph and every table on every page
// and section changes with it.
//
// Usage:
//   <ChartSkeleton height={120} />              // line / trend graph
//   <ChartSkeleton variant="bars" bars={8} />   // bar / column graph
//   <TableSkeleton columns={5} rows={6} />      // any .app-data-table
//   <TableSkeleton columns={["Record", "Customer", "Status"]} rows={8} />
// ---------------------------------------------------------------------------

// Fixed placeholder trace. The viewBox is stretched to the container, and the
// stroke is non-scaling, so one path serves every graph width.
const CHART_SKELETON_PATH =
  "M0,86 C60,74 92,40 150,44 C208,48 242,92 300,88 C358,84 398,30 452,34 C506,38 546,68 600,58";
const CHART_SKELETON_AREA = `${CHART_SKELETON_PATH} L600,120 L0,120 Z`;

export function ChartSkeleton({
  variant = "line",
  height = 120,
  bars = 8,
  ticks = 3,
  label = "Loading chart",
  className,
  style,
}) {
  const reactId = React.useId();
  const fillId = `skeletonChartFill-${reactId}`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      data-skeleton="1"
      className={`skeleton-chart${className ? ` ${className}` : ""}`}
      style={style}
    >
      <div className="skeleton-chart__plot" style={{ height }}>
        <span className="skeleton-chart__grid" aria-hidden="true" />
        {variant === "bars" ? (
          <div className="skeleton-chart__bars" aria-hidden="true">
            {Array.from({ length: Math.max(1, bars) }).map((_, i) => (
              <span key={i} className="skeleton-chart__bar" />
            ))}
          </div>
        ) : (
          <svg
            className="skeleton-chart__svg"
            viewBox="0 0 600 120"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop className="skeleton-chart__fill-top" offset="0%" />
                <stop className="skeleton-chart__fill-bottom" offset="100%" />
              </linearGradient>
            </defs>
            <path className="skeleton-chart__area" d={CHART_SKELETON_AREA} fill={`url(#${fillId})`} />
            <path
              className="skeleton-chart__line skeleton-chart__line--ghost"
              d={CHART_SKELETON_PATH}
              vectorEffect="non-scaling-stroke"
            />
            <path
              className="skeleton-chart__line"
              d={CHART_SKELETON_PATH}
              pathLength="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
        <span className="skeleton-chart__sweep" aria-hidden="true" />
      </div>
      {ticks > 0 && (
        <div className="skeleton-chart__axis" aria-hidden="true">
          {Array.from({ length: Math.max(2, ticks) }).map((_, i) => (
            <span
              key={i}
              className={`skeleton-chart__tick${
                i === Math.floor(Math.max(2, ticks) / 2) ? " skeleton-chart__tick--wide" : ""
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Renders a real .app-data-table so column widths, padding, row rules and
// radii match the loaded table exactly — no layout shift when data arrives.
// `columns` is either a count or the real heading labels (preferred: the
// headings stay readable while the body fills in).
export function TableSkeleton({
  columns = 5,
  rows = 6,
  withHeadings = true,
  label = "Loading table",
  className,
  style,
}) {
  const headings = Array.isArray(columns)
    ? columns
    : Array.from({ length: Math.max(1, Number(columns) || 1) }, () => null);

  return (
    <table
      role="status"
      aria-live="polite"
      aria-label={label}
      data-skeleton="1"
      className={`app-data-table app-table-shell${
        withHeadings ? " app-table-shell--with-headings" : ""
      } skeleton-table${className ? ` ${className}` : ""}`}
      style={{ width: "100%", ...(style || {}) }}
    >
      {withHeadings && (
        <thead>
          <tr>
            {headings.map((heading, i) => (
              <th key={i} align="left">
                {heading || <span className="skeleton-table__cell" />}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {Array.from({ length: Math.max(1, rows) }).map((_, rowIndex) => (
          <tr key={rowIndex}>
            {headings.map((_heading, colIndex) => (
              <td key={colIndex}>
                <span className="skeleton-table__cell" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Shimmer keyframes injected once per mount — safe to render multiple copies, browsers dedupe.
export function SkeletonKeyframes() {
  return (
    <style>{`@keyframes skeleton-pulse{0%{opacity:.72}50%{opacity:1}100%{opacity:.72}}@keyframes skeleton-scan{0%{background-position:200% 0}100%{background-position:-200% 0}}@media(prefers-reduced-motion:reduce){.skeleton-block{animation:none!important;opacity:.65!important}}`}</style>
  );
}

// PageSkeleton — the one canonical page-level skeleton.
//
// Renders what goes INSIDE the `.app-page-stack` wrapper that Layout already
// provides: a stack of `.app-section-card` placeholders. Because it uses the
// same class hierarchy and CSS tokens as real sections, widths, spacing,
// backgrounds, borders, and corner radii match the final layout exactly — so
// when the real content replaces the skeleton there is no layout shift.
//
// Usage:
//   <PageSkeleton />                           // 3 generic sections
//   <PageSkeleton sections={5} />              // 5 generic sections
//   <PageSkeleton sections={[                  // explicit per-section shapes
//     { rows: 2 },
//     { rows: 5 },
//     { rows: 3, titleWidth: '280px' },
//   ]} />
//
// Pages that need a more specific shape (e.g. a job-card detail page with a
// unique header + 4-card info row) should compose their own skeleton using
// SectionSkeleton / SectionGridSkeleton / SkeletonBlock, but they must render
// the result inside Layout's `.app-page-stack` (i.e. as the page's own return
// value) — no overlays, no separate mounting path.
// These shapes mirror the main page families without replacing their live shell.
const skeletonGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: "var(--layout-card-gap)", minWidth: 0 };

export function ListLoadingSkeleton({ rows = 6, toolbar = true }) {
  return <div role="status" aria-label="Loading records" aria-busy="true" className="app-page-stack" style={{ minWidth: 0, width: "100%" }}>
    <SkeletonKeyframes />
    {toolbar && <div style={skeletonGrid}><SkeletonBlock height="44px" /><SkeletonBlock width="180px" height="44px" /></div>}
    {Array.from({ length: rows }, (_, index) => <LayerTheme key={index} radius="var(--radius-sm)">
      <div style={skeletonGrid}>
        <SkeletonBlock width="65%" height="18px" />
        <SkeletonBlock width="80%" height="14px" />
        <SkeletonBlock width="45%" height="14px" />
      </div>
      <SkeletonBlock width={index % 2 ? "48%" : "68%"} height="12px" />
    </LayerTheme>)}
  </div>;
}

export function NextJobsSkeleton() {
  return <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading workshop queue" className="app-page-stack" style={{ width: "100%", minWidth: 0 }}>
    <SkeletonKeyframes />
    <SkeletonBlock height="44px" />
    {["Checked In Jobs", "Unassigned Jobs"].map((label) => <LayerTheme key={label} as="section" aria-label={label} radius="var(--radius-lg)">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--layout-card-gap)" }}>
        <SkeletonBlock width="180px" height="20px" /><SkeletonBlock width="72px" height="14px" />
      </div>
      {/* Match the planner's compact job cards and horizontal checked-in strip. */}
      <div style={label === "Checked In Jobs" ? { display: "flex", gap: "var(--layout-card-gap)", overflowX: "auto", minWidth: 0 } : { ...skeletonGrid, gridTemplateColumns: "repeat(auto-fill, minmax(min(212px, 100%), 212px))", maxHeight: "280px", overflowY: "auto" }}>
        {Array.from({ length: 4 }, (_, index) => <LayerSurface key={index} radius="var(--radius-sm)" style={label === "Checked In Jobs" ? { flex: "0 0 clamp(184px, 16vw, 212px)" } : undefined}>
          <SkeletonBlock width="42%" height="18px" />
          <SkeletonBlock width="65%" height="14px" />
          <SkeletonBlock width="90%" height="12px" />
          <SkeletonBlock width="55%" height="24px" />
        </LayerSurface>)}
      </div>
    </LayerTheme>)}
    <LayerTheme as="section" aria-label="Technician assignments">
      <SkeletonBlock width="180px" height="20px" />
      {/* The live board scrolls horizontally below its 680px minimum width. */}
      <div style={{ overflowX: "auto", minWidth: 0 }}>
        <div style={{ minWidth: "680px", display: "grid", gap: "var(--layout-card-gap)" }}>
          {/* Match the planner's 108–150px identity column before its scoped CSS mounts. */}
          {Array.from({ length: 4 }, (_, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "clamp(108px, 11vw, 150px) minmax(0, 1fr)", gap: "var(--layout-card-gap)" }}>
            <LayerSurface radius="var(--radius-sm)"><SkeletonBlock width="70%" height="16px" /><SkeletonBlock width="50%" height="12px" /></LayerSurface>
            <LayerSurface radius="var(--radius-sm)"><SkeletonBlock width={index % 2 ? "55%" : "80%"} height="44px" /></LayerSurface>
          </div>)}
        </div>
      </div>
    </LayerTheme>
  </div>;
}

export function PageSkeleton({ sections, minHeight, href }) {
  const router = useRouter();
  const pathname = String(href || router?.asPath || "").split(/[?#]/)[0];
  if (sections === undefined && pathname === "/nextjobs") return <NextJobsSkeleton />;
  const isDashboard = /^\/(dashboard|reports)(\/|$)/.test(pathname);
  const isList = ["/jobs", "/order", "/tech", "/valet", "/archive"].includes(pathname);
  const isTable = ["/customers", "/goods-in", "/stock-catalogue", "/consumables-tracker", "/consumables-request", "/parts-manager", "/accounts", "/company-accounts"].includes(pathname);
  if (sections === undefined && isList) return <ListLoadingSkeleton />;
  if (sections === undefined && isTable) return <div className="app-page-stack" style={{ width: "100%", minWidth: 0 }}>
    <SkeletonKeyframes />
    <div style={skeletonGrid}><SkeletonBlock height="44px" /><SkeletonBlock width="180px" height="44px" /></div>
    <LayerTheme style={{ overflowX: "auto", minWidth: 0 }}><TableSkeleton columns={pathname === "/customers" ? ["Customer", "Email", "Phone", "Postcode", "Vehicles", "Jobs", "Added"] : 5} rows={8} /></LayerTheme>
  </div>;
  const resolvedSections = sections ?? (isDashboard ? 2 : 3);
  const sectionList = Array.isArray(resolvedSections)
    ? resolvedSections
    : Array.from({ length: Math.max(1, Number(resolvedSections) || 0) }, () => ({}));

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      aria-busy="true"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--page-stack-gap, 16px)",
        width: "100%",
        minHeight,
      }}
    >
      <SkeletonKeyframes />
      {sections === undefined && isDashboard && <div style={skeletonGrid}>
        {Array.from({ length: 4 }, (_, index) => <SkeletonMetricCard key={index} />)}
      </div>}
      {sectionList.map((section, index) => (
        <SectionSkeleton key={index} {...section} />
      ))}
    </div>
  );
}

// Full-viewport skeleton used only for bootstrapping / splash flows (e.g. the
// very first paint of the login page before it knows whether to redirect).
// Most pages should NOT use this — they should return <PageSkeleton /> from
// inside the normal Layout tree so the sidebar and topbar stay mounted.
export default function PageLoadingSkeleton({
  metricCards = 4,
  tableRows = 8,
  tableCols = 5,
  fullscreen = true,
}) {
  const wrapperStyle = fullscreen
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 9800,
        background: "var(--page-shell-bg, var(--surface))",
        overflowY: "auto",
        padding: "32px 24px",
      }
    : { padding: "24px" };

  return (
    <div className="global-loading-skeleton" role="status" aria-live="polite" aria-label="Loading" style={wrapperStyle}>
      <SkeletonKeyframes />
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          {Array.from({ length: metricCards }).map((_, i) => (
            <SkeletonMetricCard key={i} />
          ))}
        </div>
        <SkeletonBlock width="100%" height="48px" borderRadius="10px" />
        <LayerTheme style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {Array.from({ length: tableRows }).map((_, i) => (
                <SkeletonTableRow key={i} cols={tableCols} />
              ))}
            </tbody>
          </table>
        </LayerTheme>
      </div>
    </div>
  );
}
