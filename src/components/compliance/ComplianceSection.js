// file location: src/components/compliance/ComplianceSection.js
// Compliance pages sit directly inside the app page card, so their main cards
// use the theme layer instead of the default surface layer.

import React from "react";
import LayerTheme from "@/components/ui/LayerTheme";

export default function ComplianceSection({ title, subtitle, children, style }) {
  return (
    <LayerTheme
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
    </LayerTheme>
  );
}
