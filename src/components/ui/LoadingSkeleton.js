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

// Generic section card skeleton — mirrors the `.app-section-card` pattern: header
// row + 2-column body grid. Use this as the default loading placeholder for any
// card-based page section (HR dashboard, reports, detail pages, etc.).
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
        display: "flex",
        flexDirection: "column",
        gap: "var(--layout-card-gap, 14px)",
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
// collection of cards. Use `cols` to match the final grid width.
export function SectionGridSkeleton({ cards = 4, cols = "repeat(auto-fit, minmax(220px, 1fr))", rows = 3, style }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--layout-card-gap, 16px)",
        gridTemplateColumns: cols,
        ...(style || {}),
      }}
    >
      <SkeletonKeyframes />
      {Array.from({ length: cards }).map((_, i) => (
        <SectionSkeleton key={i} rows={rows} />
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

const SHIMMER_BG = "var(--surface-light, #e0e0e0)";

function DashboardSectionCardSkeleton({
  titleWidth = "180px",
  subtitleWidth = "240px",
  cardCount = 4,
  minCardWidth = "180px",
  sectionHeight = "auto",
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--accent-base)",
        padding: "20px",
        minHeight: sectionHeight,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
        <SkeletonBlock width={titleWidth} height="18px" borderRadius="6px" />
        <SkeletonBlock width={subtitleWidth} height="12px" borderRadius="6px" />
      </div>
      <div
        style={{
          display: "grid",
          gap: "16px",
          gridTemplateColumns: `repeat(auto-fit, minmax(${minCardWidth}, 1fr))`,
        }}
      >
        {Array.from({ length: cardCount }).map((_, index) => (
          <div
            key={index}
            style={{
              background: "rgba(var(--primary-rgb), 0.08)",
              borderRadius: "var(--radius-md)",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <SkeletonBlock width="48%" height="12px" borderRadius="6px" />
            <SkeletonBlock width="64%" height="28px" borderRadius="8px" />
            <SkeletonBlock width="72%" height="12px" borderRadius="6px" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardFallbackSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", minHeight: 640 }}>
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--accent-base)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <SkeletonBlock width="170px" height="12px" borderRadius="999px" />
        <SkeletonBlock width="260px" height="28px" borderRadius="8px" />
        <SkeletonBlock width="220px" height="14px" borderRadius="6px" />
      </div>

      <DashboardSectionCardSkeleton
        titleWidth="210px"
        subtitleWidth="320px"
        cardCount={8}
        minCardWidth="180px"
      />

      <DashboardSectionCardSkeleton
        titleWidth="190px"
        subtitleWidth="300px"
        cardCount={4}
        minCardWidth="240px"
      />

      <div
        style={{
          display: "grid",
          gap: "20px",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <DashboardSectionCardSkeleton
          titleWidth="180px"
          subtitleWidth="220px"
          cardCount={3}
          minCardWidth="100%"
          sectionHeight="100%"
        />
        <DashboardSectionCardSkeleton
          titleWidth="170px"
          subtitleWidth="240px"
          cardCount={3}
          minCardWidth="100%"
          sectionHeight="100%"
        />
      </div>
    </div>
  );
}

// Default fallback: assume the page's first main section is card-based (stat
// cards, tiles, or content cards). We render a header strip, a row of metric
// cards, and a responsive grid of 6 content-card skeletons — so each card
// inside the first section appears as its own skeleton item instead of one
// generic block + table.
function DefaultFallbackSkeleton({ fallbackMinHeight, cardCount = 6, metricCount = 4 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", minHeight: fallbackMinHeight }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <SkeletonBlock width="180px" height="20px" borderRadius="8px" />
          <SkeletonBlock width="260px" height="12px" borderRadius="6px" />
        </div>
        <SkeletonBlock width="140px" height="36px" borderRadius="999px" />
      </div>

      <div
        style={{
          display: "grid",
          gap: "12px",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        }}
      >
        {Array.from({ length: metricCount }).map((_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gap: "16px",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        {Array.from({ length: cardCount }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--accent-base)",
              borderRadius: "var(--radius-md)",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              minHeight: "140px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
              <SkeletonBlock width="55%" height="14px" borderRadius="6px" />
              <SkeletonBlock width="36px" height="36px" borderRadius="10px" />
            </div>
            <SkeletonBlock width="72%" height="22px" borderRadius="8px" />
            <SkeletonBlock width="90%" height="12px" borderRadius="6px" />
            <SkeletonBlock width="64%" height="12px" borderRadius="6px" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthFallbackSkeleton({ fallbackMinHeight }) {
  return (
    <div
      style={{
        minHeight: Math.max(fallbackMinHeight, 620),
        display: "grid",
        placeItems: "center",
        padding: "24px 0",
      }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          alignItems: "center",
        }}
      >
        <SkeletonBlock width="180px" height="56px" borderRadius="18px" />
        <div
          style={{
            width: "100%",
            background: "var(--surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--accent-base)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <SkeletonBlock width="90px" height="24px" borderRadius="8px" />
          <SkeletonBlock width="100%" height="52px" borderRadius="14px" />
          <SkeletonBlock width="100%" height="52px" borderRadius="14px" />
          <SkeletonBlock width="100%" height="46px" borderRadius="999px" />
          <SkeletonBlock width="58%" height="12px" borderRadius="6px" />
        </div>
      </div>
    </div>
  );
}

function SplitPaneFallbackSkeleton({ fallbackMinHeight }) {
  return (
    <div
      style={{
        minHeight: Math.max(fallbackMinHeight, 620),
        display: "grid",
        gap: "20px",
        gridTemplateColumns: "minmax(260px, 360px) minmax(0, 1fr)",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--accent-base)",
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <SkeletonBlock width="100%" height="42px" borderRadius="12px" />
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            style={{
              borderRadius: "var(--radius-md)",
              background: "rgba(var(--primary-rgb), 0.08)",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <SkeletonBlock width="42%" height="12px" borderRadius="6px" />
            <SkeletonBlock width="68%" height="16px" borderRadius="6px" />
            <SkeletonBlock width="56%" height="10px" borderRadius="6px" />
          </div>
        ))}
      </div>

      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--accent-base)",
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
          <SkeletonBlock width="160px" height="18px" borderRadius="8px" />
          <SkeletonBlock width="110px" height="34px" borderRadius="999px" />
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            style={{
              alignSelf: index % 2 === 0 ? "flex-start" : "flex-end",
              width: index % 2 === 0 ? "72%" : "64%",
              borderRadius: "18px",
              background: "rgba(var(--primary-rgb), 0.08)",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <SkeletonBlock width="74%" height="12px" borderRadius="6px" />
            <SkeletonBlock width="92%" height="12px" borderRadius="6px" />
            <SkeletonBlock width="36%" height="10px" borderRadius="6px" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolbarTableFallbackSkeleton({ fallbackMinHeight, filterCount = 3, rowCount = 8 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", minHeight: Math.max(fallbackMinHeight, 560) }}>
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--accent-base)",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <SkeletonBlock width="180px" height="38px" borderRadius="999px" />
          <SkeletonBlock width="min(420px, 100%)" height="38px" borderRadius="12px" />
          {Array.from({ length: filterCount }).map((_, index) => (
            <SkeletonBlock key={index} width="150px" height="38px" borderRadius="12px" />
          ))}
        </div>
      </div>

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
            {Array.from({ length: rowCount }).map((_, i) => (
              <SkeletonTableRow key={i} cols={5} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetailPageFallbackSkeleton({ fallbackMinHeight }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", minHeight: Math.max(fallbackMinHeight, 620) }}>
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--accent-base)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <SkeletonBlock width="120px" height="12px" borderRadius="999px" />
        <SkeletonBlock width="260px" height="28px" borderRadius="8px" />
        <SkeletonBlock width="180px" height="14px" borderRadius="6px" />
      </div>

      <div
        style={{
          display: "grid",
          gap: "18px",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--accent-base)",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <SkeletonBlock width="48%" height="14px" borderRadius="6px" />
            <SkeletonBlock width="84%" height="18px" borderRadius="8px" />
            <SkeletonBlock width="76%" height="12px" borderRadius="6px" />
            <SkeletonBlock width="62%" height="12px" borderRadius="6px" />
          </div>
        ))}
      </div>

      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--accent-base)",
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <SkeletonBlock width="190px" height="18px" borderRadius="8px" />
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonBlock key={index} width={index % 2 === 0 ? "100%" : "92%"} height="14px" borderRadius="6px" />
        ))}
      </div>
    </div>
  );
}

function StatsGridFallbackSkeleton({ fallbackMinHeight }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", minHeight: Math.max(fallbackMinHeight, 620) }}>
      <div
        style={{
          display: "grid",
          gap: "16px",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonMetricCard key={index} />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gap: "20px",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--accent-base)",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <SkeletonBlock width="52%" height="16px" borderRadius="8px" />
            <SkeletonBlock width="100%" height="140px" borderRadius="14px" />
            <SkeletonBlock width="68%" height="12px" borderRadius="6px" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerPortalFallbackSkeleton({ fallbackMinHeight }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", minHeight: Math.max(fallbackMinHeight, 560) }}>
      <div
        style={{
          display: "grid",
          gap: "16px",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--accent-base)",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <SkeletonBlock width="44%" height="10px" borderRadius="999px" />
            <SkeletonBlock width="72%" height="18px" borderRadius="8px" />
            <SkeletonBlock width="56%" height="12px" borderRadius="6px" />
          </div>
        ))}
      </div>

      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--accent-base)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <SkeletonBlock width="180px" height="20px" borderRadius="8px" />
        <div
          style={{
            display: "grid",
            gap: "14px",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              style={{
                background: "rgba(var(--primary-rgb), 0.08)",
                borderRadius: "var(--radius-md)",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <SkeletonBlock width="48%" height="12px" borderRadius="6px" />
              <SkeletonBlock width="80%" height="16px" borderRadius="8px" />
              <SkeletonBlock width="62%" height="12px" borderRadius="6px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function resolveFallbackVariant(route = "") {
  const normalizedRoute = String(route || "").toLowerCase();

  if (normalizedRoute.startsWith("/login")) return "auth";
  if (normalizedRoute.startsWith("/customer")) return "customer";
  if (normalizedRoute.startsWith("/messages")) return "split-pane";
  if (normalizedRoute.startsWith("/dashboard")) return "dashboard";
  if (normalizedRoute.startsWith("/clocking")) return "stats-grid";
  if (normalizedRoute.startsWith("/tracking")) return "stats-grid";
  if (normalizedRoute.startsWith("/hr")) return "dashboard";
  if (normalizedRoute.startsWith("/admin")) return "dashboard";
  if (normalizedRoute.startsWith("/appointments")) return "stats-grid";
  if (normalizedRoute.startsWith("/workshop")) return "stats-grid";
  if (normalizedRoute.startsWith("/tech")) return "stats-grid";
  if (normalizedRoute.startsWith("/profile")) return "detail";
  if (normalizedRoute.startsWith("/job-cards/view")) return "toolbar-table";
  if (normalizedRoute.startsWith("/job-cards/archive")) return "toolbar-table";
  if (normalizedRoute.startsWith("/accounts")) {
    if (/\[(accountid|invoiceid)\]/.test(normalizedRoute) || /\/(view|transactions|invoices)\//.test(normalizedRoute)) {
      return "detail";
    }
    return "toolbar-table";
  }
  if (normalizedRoute.startsWith("/parts")) {
    if (/\/\[[^/]+\]/.test(normalizedRoute) || /\/(deliveries|goods-in|create-order)\//.test(normalizedRoute)) {
      return "detail";
    }
    return "toolbar-table";
  }
  if (normalizedRoute.startsWith("/job-cards/")) {
    if (normalizedRoute.includes("/create")) return "detail";
    if (normalizedRoute.includes("/myjobs")) return "detail";
    if (/\/job-cards\/[^/]+$/.test(normalizedRoute) || /\/\[[^/]+\]/.test(normalizedRoute)) {
      return "detail";
    }
  }

  return "default";
}

function RouteFallbackSkeleton({ route, fallbackMinHeight }) {
  const variant = resolveFallbackVariant(route);

  switch (variant) {
    case "auth":
      return <AuthFallbackSkeleton fallbackMinHeight={fallbackMinHeight} />;
    case "customer":
      return <CustomerPortalFallbackSkeleton fallbackMinHeight={fallbackMinHeight} />;
    case "split-pane":
      return <SplitPaneFallbackSkeleton fallbackMinHeight={fallbackMinHeight} />;
    case "dashboard":
      return <DashboardFallbackSkeleton />;
    case "toolbar-table":
      return <ToolbarTableFallbackSkeleton fallbackMinHeight={fallbackMinHeight} />;
    case "detail":
      return <DetailPageFallbackSkeleton fallbackMinHeight={fallbackMinHeight} />;
    case "stats-grid":
      return <StatsGridFallbackSkeleton fallbackMinHeight={fallbackMinHeight} />;
    default:
      return <DefaultFallbackSkeleton fallbackMinHeight={fallbackMinHeight} />;
  }
}

// Render shimmer placeholders at the exact rectangles captured for the given route.
// Used by Layout.js / CustomerLayout.js as an inline replacement for {children}
// while a page is loading. Sidebar and topbar are NOT included — they live
// outside the content container, so they keep rendering normally.
export function PageContentSkeleton({ route, fallbackMinHeight = 480 }) {
  const fingerprint = route ? getLayoutFingerprint(route) : null;

  if (!fingerprint || !fingerprint.blocks?.length) {
    // No cached fingerprint yet — first visit to this route. Use a route-aware
    // fallback so high-value pages like the dashboard still load with card-level
    // placeholders instead of a single generic page block.
    return (
      <div
        className="page-content-skeleton page-content-skeleton--fallback"
        role="status"
        aria-live="polite"
        aria-label="Loading"
        style={{ padding: "8px 0", minHeight: fallbackMinHeight }}
      >
        <SkeletonKeyframes />
        <RouteFallbackSkeleton route={route} fallbackMinHeight={fallbackMinHeight} />
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
          className="skeleton-block"
          style={{
            position: "absolute",
            left: `${block.left}px`,
            top: `${block.top}px`,
            width: `${block.width}px`,
            height: `${block.height}px`,
            borderRadius: `${block.radius}px`,
            background:
              "linear-gradient(90deg, var(--skeleton-base,#ececef) 25%, var(--skeleton-highlight,#f6f6f8) 50%, var(--skeleton-base,#ececef) 75%)",
            backgroundSize: "200% 100%",
            animation: "skeleton-scan var(--skeleton-animation-duration,1.8s) ease-in-out infinite",
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
