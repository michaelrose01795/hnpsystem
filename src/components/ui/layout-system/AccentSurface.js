// file location: src/components/ui/layout-system/AccentSurface.js
import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function AccentSurface({ sectionKey, parentKey = "", children, className = "", style }) {
  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="section-shell"
      backgroundToken="accent-surface"
      shell
      className={`app-layout-surface-accent ${className}`.trim()}
      style={style}
    >
      {children}
    </DevLayoutSection>
  );
}

