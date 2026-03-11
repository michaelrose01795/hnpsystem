// file location: src/components/ui/layout-system/ContentWidth.js
import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function ContentWidth({ sectionKey, parentKey = "", widthMode = "content", children, className = "", style }) {
  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      sectionType="section-shell"
      parentKey={parentKey}
      widthMode={widthMode}
      shell
      className={`app-layout-content-width ${className}`.trim()}
      style={style}
    >
      {children}
    </DevLayoutSection>
  );
}

