// file location: src/components/ui/layout-system/TabRow.js
import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function TabRow({ sectionKey, parentKey = "", children, className = "", style }) {
  // Tab row: a horizontal strip that holds whatever tab buttons are passed in.
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

