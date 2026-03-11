// file location: src/components/ui/ControlGroup.js
// Shared spacing system for grouped controls.
// Use to wrap adjacent buttons, inputs, or dropdowns that belong together.
import React from "react";

export default function ControlGroup({ children, gap, className = "", style }) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: gap || "var(--control-gap)",
        flexWrap: "wrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
