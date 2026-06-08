// file location: src/components/staff-global/StaffCard.js
// Reusable staff card surface. Uses the canonical layer primitives so cards
// stay borderless and controlled by the global Liquid Glass system.
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

export default function StaffCard({
  title,
  subtitle,
  action,
  children,
  className = "",
  layer = "surface",
  as = "div",
  ...rest
}) {
  const Layer = layer === "theme" ? LayerTheme : LayerSurface;

  return (
    <Layer as={as} className={`staff-card ${className}`.trim()} {...rest}>
      {(title || subtitle || action) ? (
        <div className="staff-card-header">
          <div className="staff-card-heading">
            {title ? <h3 className="staff-card-title">{title}</h3> : null}
            {subtitle ? <p className="staff-card-subtitle">{subtitle}</p> : null}
          </div>
          {action ? <div className="staff-card-action">{action}</div> : null}
        </div>
      ) : null}
      <div className="staff-card-body">{children}</div>
    </Layer>
  );
}
