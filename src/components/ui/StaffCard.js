// file location: src/components/ui/StaffCard.js
// Staff card with automatic alternating layer colour.
//
// Renders one of the two canonical surface primitives so it inherits the
// layer-sweep visual (borderless, rounded, token-driven background):
//   - variant="theme"   → <LayerTheme>   (var(--theme), tinted layer)
//   - variant="surface" → <LayerSurface> (var(--surface), base layer)
//
// If `variant` is omitted, the colour alternates by `index`:
//   index 0 → theme, 1 → surface, 2 → theme, 3 → surface ...
// <StaffCardGrid> injects `index` into its children automatically, so a grid of
// StaffCards alternates with no per-card configuration and no invisible spacer
// cards. Pass `variant` explicitly to override the automatic choice.
import React from "react";
import LayerSurface from "./LayerSurface";
import LayerTheme from "./LayerTheme";

export default function StaffCard({
  variant,
  index = 0,
  title,
  subtitle,
  action,
  children,
  className = "",
  style,
  ...rest
}) {
  // Explicit variant wins; otherwise even index = theme, odd index = surface.
  const resolvedVariant = variant || (index % 2 === 0 ? "theme" : "surface");
  const LayerComponent = resolvedVariant === "theme" ? LayerTheme : LayerSurface;
  const cardClassName = `app-staff-card app-staff-card--${resolvedVariant} ${className}`.trim();

  return (
    <LayerComponent className={cardClassName} style={style} {...rest}>
      {(title || subtitle || action) && (
        <div className="app-staff-card__header">
          <div>
            {title && <div className="app-staff-card__title">{title}</div>}
            {subtitle && <div className="app-staff-card__subtitle">{subtitle}</div>}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      )}
      {children}
    </LayerComponent>
  );
}
