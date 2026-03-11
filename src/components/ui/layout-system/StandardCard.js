// file location: src/components/ui/layout-system/StandardCard.js
import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function StandardCard({ sectionKey, parentKey = "", children, className = "", style }) {
  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="content-card"
      backgroundToken="surface"
      className={`app-layout-card ${className}`.trim()}
      style={style}
    >
      {children}
    </DevLayoutSection>
  );
}

