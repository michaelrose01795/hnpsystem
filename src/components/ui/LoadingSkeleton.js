// file location: src/components/ui/LoadingSkeleton.js
// Shared skeleton primitives used across the system.
//
// Rules:
// - One skeleton is shown per loading phase. No overlays, no stacking.
// - Skeletons render INSIDE the .app-page-stack wrapper provided by Layout —
//   so they should be the same shape as the real .app-section-card children
//   a page will produce once loaded. That keeps the transition flicker-free.

import React from "react";

export function SkeletonBlock({ width = "100%", height = "20px", borderRadius = "var(--skeleton-radius, 8px)", style }) {
  return (
    <div
      className="skeleton-block"
      style={{
        width,
        height,
        borderRadius,
        background:
          "linear-gradient(90deg, var(--skeleton-base,#ececef) 25%, var(--skeleton-highlight,#f6f6f8) 50%, var(--skeleton-base,#ececef) 75%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-scan var(--skeleton-animation-duration,1.8s) ease-in-out infinite",
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
export function SectionSkeleton({
  titleWidth = "180px",
  subtitleWidth = "240px",
  rows = 3,
  showHeader = true,
  minHeight = "auto",
  style,
}) {
  return (
    <div
      className="app-section-card"
      style={{
        minHeight,
        ...(style || {}),
      }}
    >
      <SkeletonKeyframes />
      {showHeader && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <SkeletonBlock width={titleWidth} height="18px" />
          <SkeletonBlock width={subtitleWidth} height="12px" />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonBlock key={i} width={i % 2 === 0 ? "100%" : "92%"} height="14px" />
        ))}
      </div>
    </div>
  );
}

// Grid of section skeletons — useful for dashboard pages and tabs that render a
// collection of cards. Wraps in `.app-section-card` so it still looks like one
// real page section with a grid of child cards inside.
export function SectionGridSkeleton({ cards = 4, cols = "repeat(auto-fit, minmax(220px, 1fr))", rows = 3, style }) {
  return (
    <div
      className="app-section-card"
      style={{
        display: "grid",
        gap: "var(--layout-card-gap, 16px)",
        gridTemplateColumns: cols,
        ...(style || {}),
      }}
    >
      <SkeletonKeyframes />
      {Array.from({ length: cards }).map((_, i) => (
        <SectionSkeleton key={i} rows={rows} style={{ border: "none", padding: "0" }} />
      ))}
    </div>
  );
}

export function SkeletonMetricCard() {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        minWidth: "200px",
        flex: 1,
        border: "1px solid var(--accent-base)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <SkeletonBlock width="28px" height="28px" borderRadius="8px" />
        <SkeletonBlock width="120px" height="14px" />
      </div>
      <SkeletonBlock width="80px" height="30px" borderRadius="6px" />
      <SkeletonBlock width="140px" height="12px" />
    </div>
  );
}

export function SkeletonTableRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "10px 0" }}>
          <SkeletonBlock width={i === 0 ? "100px" : "70px"} height="14px" />
        </td>
      ))}
    </tr>
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
export function PageSkeleton({ sections = 3, minHeight }) {
  const sectionList = Array.isArray(sections)
    ? sections
    : Array.from({ length: Math.max(1, Number(sections) || 0) }, () => ({}));

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--page-stack-gap, 16px)",
        width: "100%",
        minHeight,
      }}
    >
      <SkeletonKeyframes />
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
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--accent-base)",
            padding: "16px",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {Array.from({ length: tableRows }).map((_, i) => (
                <SkeletonTableRow key={i} cols={tableCols} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
