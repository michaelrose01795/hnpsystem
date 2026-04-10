// file location: src/components/ui/LoadingSkeleton.js
// Shared skeleton loading primitives used as the global loading style across the system.
// Mirrors the style originally defined inline in ProfileWorkTab.js.
//
// PageContentSkeleton (default export of the fingerprint-aware variant) reads the
// per-route layout fingerprint captured by Layout.js and renders shimmer blocks at
// the exact positions of the previous render — so the loading grid mirrors the
// page that's about to mount instead of using a generic template. When no
// fingerprint exists yet (first visit) it falls back to the generic layout.

import React from "react";
import { getLayoutFingerprint } from "@/lib/loading/layoutFingerprint";

export function SkeletonBlock({ width = "100%", height = "20px", borderRadius = "8px" }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background:
          "linear-gradient(90deg, var(--surface-light, #e0e0e0) 25%, var(--surface, #f0f0f0) 50%, var(--surface-light, #e0e0e0) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s ease-in-out infinite",
      }}
    />
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
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  );
}

const SHIMMER_BG =
  "linear-gradient(90deg, var(--surface-light, #e0e0e0) 25%, var(--surface, #f0f0f0) 50%, var(--surface-light, #e0e0e0) 75%)";

// Render shimmer placeholders at the exact rectangles captured for the given route.
// Used by Layout.js / CustomerLayout.js as an inline replacement for {children}
// while a page is loading. Sidebar and topbar are NOT included — they live
// outside the content container, so they keep rendering normally.
export function PageContentSkeleton({ route, fallbackMinHeight = 480 }) {
  const fingerprint = route ? getLayoutFingerprint(route) : null;

  if (!fingerprint || !fingerprint.blocks?.length) {
    // No cached fingerprint yet — first visit to this route. Render the generic
    // metric/table skeleton inline so the user still sees the global loading style.
    return (
      <div
        className="page-content-skeleton page-content-skeleton--fallback"
        role="status"
        aria-live="polite"
        aria-label="Loading"
        style={{ padding: "8px 0", minHeight: fallbackMinHeight }}
      >
        <SkeletonKeyframes />
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
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
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonTableRow key={i} cols={5} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="page-content-skeleton page-content-skeleton--fingerprint"
      role="status"
      aria-live="polite"
      aria-label="Loading"
      style={{
        position: "relative",
        width: "100%",
        minHeight: fingerprint.containerHeight || fallbackMinHeight,
      }}
    >
      <SkeletonKeyframes />
      {fingerprint.blocks.map((block, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: `${block.left}px`,
            top: `${block.top}px`,
            width: `${block.width}px`,
            height: `${block.height}px`,
            borderRadius: `${block.radius}px`,
            background: SHIMMER_BG,
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

// Full-page skeleton used as the global loading UI. Mirrors the ProfileWorkTab layout:
// row of metric cards, a toolbar bar, then a table of skeleton rows.
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
