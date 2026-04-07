// file location: src/components/ui/PageContainer.js
// Controls the page width and horizontal padding.
// Use inside PageWrapper for full-width responsive content.
// DEPRECATED: New pages should use ContentWidth from src/components/ui/layout-system/.
// This file is kept for the pages still using the old layout pattern.
import React from "react";

export default function PageContainer({ children, className = "", style }) {
  return (
    <div
      className={className}
      style={{
        width: "100%",
        maxWidth: "100%",
        margin: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
