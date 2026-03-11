// file location: src/components/ui/layout-system/SurfaceCard.js
import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function SurfaceCard({ sectionKey, parentKey = "", children, className = "", style }) {
  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="content-card"
      backgroundToken="surface-subtle"
      className={`app-layout-surface-subtle ${className}`.trim()}
      style={style}
    >
      {children}
    </DevLayoutSection>
  );
}

