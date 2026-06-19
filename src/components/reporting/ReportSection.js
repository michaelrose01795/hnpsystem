// file location: src/components/reporting/ReportSection.js
//
// A titled report section. Renders a <LayerTheme> so the surface/theme
// alternation holds: page card (surface) → ReportSection (theme) → the cards
// inside (LayerSurface). Borderless per the layer law.

import React from "react";
import LayerTheme from "@/components/ui/LayerTheme";

export default function ReportSection({ title, subtitle, action, children }) {
  return (
    <LayerTheme as="section" gap="12px">
      {(title || action) && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            {title && <h2 style={{ margin: 0, fontSize: "1.05rem", color: "var(--accentText)" }}>{title}</h2>}
            {subtitle && <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--surfaceTextMuted)" }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </LayerTheme>
  );
}
