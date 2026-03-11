// file location: src/components/ui/PageWrapper.js
// Controls the global page background and layout.
// Wraps page content in the standard page stack with consistent spacing.
import React from "react";

export default function PageWrapper({ children, className = "", style }) {
  return (
    <div className={`app-page-stack ${className}`} style={style}>
      {children}
    </div>
  );
}
