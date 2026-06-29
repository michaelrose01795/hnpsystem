// file location: src/components/reporting/ReportSection.js
//
// A titled report section. Renders a <LayerTheme> so the surface/theme
// alternation holds: page card (surface) → ReportSection (theme) → the cards
// inside (LayerSurface). Borderless per the layer law.

import React from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import { reportDevKey } from "./reportDevOverlay";

export default function ReportSection({ title, subtitle, action, children, sectionKey, parentKey }) {
  const devSectionKey = sectionKey || reportDevKey("report-section", title || subtitle, "untitled");

  return (
    <LayerTheme
      as="section"
      gap="12px"
      sectionKey={devSectionKey}
      parentKey={parentKey}
      sectionType="section-shell"
      data-dev-text-preview={title || subtitle || "Report section"}
    >
      {action && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          {action}
        </div>
      )}
      {children}
    </LayerTheme>
  );
}
