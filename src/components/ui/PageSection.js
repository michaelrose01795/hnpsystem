// file location: src/components/ui/PageSection.js
// Controls vertical spacing between page sections.
// Use to group related content blocks within a page.
import React from "react";

export default function PageSection({ children, gap, className = "", style }) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: gap || "var(--page-stack-gap)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
