// file location: src/components/ui/PageWrapper.js
// Controls the global page background and layout.
// Wraps page content in the standard page stack with consistent spacing.
// DEPRECATED: New pages should use PageShell from src/components/ui/layout-system/.
// This file is kept for the pages still using the old layout pattern.
import React from "react";

export default function PageWrapper({ children, className = "", style }) {
  return (
    <div className={`app-page-stack ${className}`} style={style}>
      {children}
    </div>
  );
}
