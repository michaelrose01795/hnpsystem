// file location: src/components/ui/ToolbarRow.js
// Shared layout for filters, search bars, and controls.
// Renders a flex row with consistent gap and wrapping.
import React from "react";

export default function ToolbarRow({ children, className = "", style }) {
  return (
    <div className={`app-toolbar-row ${className}`} style={style}>
      {children}
    </div>
  );
}
