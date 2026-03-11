// file location: src/components/ui/layout-system/PageShell.js
import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function PageShell({ sectionKey, children, className = "", style }) {
  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      sectionType="page-shell"
      shell
      widthMode="page"
      className={`app-layout-page-shell ${className}`.trim()}
      style={style}
    >
      {children}
    </DevLayoutSection>
  );
}

