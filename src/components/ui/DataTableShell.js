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
  /* Mobile stacked-card mode (families/tables.css). ON by default — it is what
     makes a table usable at the 375px floor. The class and the per-cell labels
     are applied by GlobalTableShells for every table in the app, so this prop
     only needs to carry the OPT-OUT down to the DOM. Pass stack={false} for a
     table that is already narrow enough (2-3 short columns), or one laid out
     as a grid/matrix rather than as a list of records, where turning each row
     into a card loses the comparison the table exists to make. */
  stack = true,
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
      {...(stack ? {} : { "data-app-table-stack": "off" })}
      {...rest}
    >
      {children}
    </div>
  );
}
