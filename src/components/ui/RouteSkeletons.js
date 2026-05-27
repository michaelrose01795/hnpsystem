import React from "react";
import { PageSkeleton, SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import LayerTheme from "@/components/ui/LayerTheme";

function TrackingRouteSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading tracker"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        padding: "8px 0",
      }}
    >
      <SkeletonKeyframes />
      <div
        className="app-section-card"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <SkeletonBlock width="112px" height="36px" borderRadius="var(--radius-pill)" />
            <SkeletonBlock width="128px" height="36px" borderRadius="var(--radius-pill)" />
            <SkeletonBlock width="104px" height="36px" borderRadius="var(--radius-pill)" />
          </div>
          <div style={{ display: "flex", gap: "8px", flex: "1 1 360px", justifyContent: "center", flexWrap: "wrap" }}>
            <SkeletonBlock width="min(320px, 100%)" height="38px" borderRadius="var(--radius-md)" />
            <SkeletonBlock width="150px" height="38px" borderRadius="var(--radius-md)" />
            <SkeletonBlock width="160px" height="38px" borderRadius="var(--radius-md)" />
          </div>
          <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
            <SkeletonBlock width="80px" height="34px" borderRadius="var(--radius-pill)" />
            <SkeletonBlock width="108px" height="34px" borderRadius="var(--radius-pill)" />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
            width: "100%",
            minWidth: 0,
          }}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <LayerTheme
              key={index}
              radius="var(--radius-sm)"
              padding="16px 18px"
              gap="10px"
              style={{ minWidth: 0 }}
            >
              <SkeletonBlock width="88%" height="18px" />
              <SkeletonBlock width="64%" height="12px" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px" }}>
                <SkeletonBlock height="54px" borderRadius="var(--radius-sm)" />
                <SkeletonBlock height="54px" borderRadius="var(--radius-sm)" />
              </div>
            </LayerTheme>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RouteSkeleton({ href }) {
  const pathname = String(href || "").split("?")[0].split("#")[0];
  if (pathname === "/tracking") {
    return <TrackingRouteSkeleton />;
  }
  return <PageSkeleton />;
}

export { TrackingRouteSkeleton };
