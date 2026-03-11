// file location: src/components/ui/layout-system/FilterToolbarRow.js
import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function FilterToolbarRow({ sectionKey, parentKey = "", children, className = "", style }) {
  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="filter-row"
      className={`app-layout-toolbar-row ${className}`.trim()}
      style={style}
    >
      {children}
    </DevLayoutSection>
  );
}

