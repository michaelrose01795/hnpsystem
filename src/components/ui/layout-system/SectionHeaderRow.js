// file location: src/components/ui/layout-system/SectionHeaderRow.js
import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function SectionHeaderRow({ sectionKey, parentKey = "", children, className = "", style }) {
  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="section-header-row"
      className={`app-layout-header-row ${className}`.trim()}
      style={style}
    >
      {children}
    </DevLayoutSection>
  );
}

