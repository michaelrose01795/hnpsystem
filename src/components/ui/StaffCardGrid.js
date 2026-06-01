// file location: src/components/ui/StaffCardGrid.js
// Responsive grid container for StaffCard tiles.
//
// Spacing is handled entirely by CSS grid (`.app-card-grid`, gap token) — there
// are NO invisible placeholder/spacer cards. Columns auto-fit to the available
// width using `repeat(auto-fit, minmax(var(--app-card-grid-min), 1fr))`, so the
// same grid works on desktop, tablet, and mobile without hardcoded column counts.
//
// Each direct child receives an injected `index` prop (0,1,2,...), which
// StaffCard uses to alternate theme/surface colours automatically. Children that
// already set an explicit `variant`/`index` keep their own value.
import React from "react";

export default function StaffCardGrid({
  children,
  minColumnWidth = "260px",
  className = "",
  style,
  ...rest
}) {
  // Expose the minimum column width as a CSS var consumed by .app-card-grid.
  const gridStyle = { "--app-card-grid-min": minColumnWidth, ...style };

  const indexedChildren = React.Children.toArray(children)
    .filter((child) => React.isValidElement(child))
    .map((child, index) =>
      // Only inject index when the child hasn't been given one explicitly.
      child.props.index === undefined
        ? React.cloneElement(child, { index })
        : child
    );

  return (
    <div className={`app-card-grid ${className}`.trim()} style={gridStyle} {...rest}>
      {indexedChildren}
    </div>
  );
}
