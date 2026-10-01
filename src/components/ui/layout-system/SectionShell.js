// file location: src/components/ui/layout-system/SectionShell.js
import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function SectionShell({ sectionKey, parentKey = "", children, className = "", style, backgroundToken = "section-shell" }) {
  // Generic section wrapper: places whatever content it is given inside a standard page section.
  return (
    <DevLayoutSection
      as="section"
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="section-shell"
      backgroundToken={backgroundToken}
      shell
      className={`app-layout-section-shell ${className}`.trim()}
      style={style}
    >
      {children}
    </DevLayoutSection>
  );
}

