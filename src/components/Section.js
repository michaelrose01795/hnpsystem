// file location: src/components/Section.js
// Canonical titled section card components for the entire app.
//
// Default export: Section — titled section card used across all department dashboard pages.
//   Renders via <LayerSurface> — the canonical "surface" layer primitive.
//   Public API (title, subtitle, children, style) is unchanged so all 60+
//   existing consumers automatically inherit the layer-sweep visual.
//
// Named export: SectionCard — bare card wrapper (no title) re-exported from
//   src/components/ui/Card (which also renders via <LayerSurface>).
import React from "react";
import LayerSurface from "./ui/LayerSurface";

export default function Section({ title, subtitle, children, style }) {
  return (
    <LayerSurface
      as="section"
      className="app-section-card"
      gap="12px"
      style={style}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--accentText)" }}>{title}</h2>
        {subtitle && <p style={{ margin: "6px 0 0", color: "var(--surfaceTextMuted)" }}>{subtitle}</p>}
      </div>
      {children}
    </LayerSurface>
  );
}

export { default as SectionCard } from "./ui/Card";
