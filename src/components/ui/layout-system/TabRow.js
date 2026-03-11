// file location: src/components/ui/layout-system/TabRow.js
import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function TabRow({ sectionKey, parentKey = "", children, className = "", style }) {
  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="tab-row"
      className={`app-layout-tab-row ${className}`.trim()}
      style={style}
    >
      {children}
    </DevLayoutSection>
  );
}

