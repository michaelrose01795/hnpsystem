// file location: src/components/ui/DataTableShell.js
// Canonical wrapper for an .app-data-table (CLAUDE.md §3.4 / families/tables.css).
//
// Replaces the ad-hoc `<div style={{ overflowX: "auto" }}>` wrappers: tables
// never scroll sideways, and the body scrolls vertically once it passes
// `visibleRows` (10 by default). All appearance lives in
// src/styles/families/tables.css under `.app-table-scroll`.
import React from "react";

export default function DataTableShell({
  visibleRows = 10,
  className = "",
  style,
  children,
  ...rest
}) {
  const shellStyle =
    visibleRows === 10 ? style : { "--table-visible-rows": visibleRows, ...style };

  return (
    <div
      className={["app-table-scroll", className].filter(Boolean).join(" ")}
      style={shellStyle}
      {...rest}
    >
      {children}
    </div>
  );
}
