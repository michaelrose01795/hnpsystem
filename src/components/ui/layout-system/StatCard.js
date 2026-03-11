// file location: src/components/ui/layout-system/StatCard.js
import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function StatCard({ sectionKey, parentKey = "", children, className = "", style }) {
  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="stat-card"
      backgroundToken="stat-surface"
      className={`app-layout-stat-card ${className}`.trim()}
      style={style}
    >
      {children}
    </DevLayoutSection>
  );
}

