// file location: src/components/customer-global/CustomerCard.js
// Reusable customer card surface. It uses layer primitives so customer cards
// stay compatible with the global borderless surface rules.
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

export default function CustomerCard({
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
    <Layer as={as} className={`customer-card ${className}`.trim()} {...rest}>
      {(title || subtitle || action) ? (
        <div className="customer-card-header">
          <div className="customer-card-heading">
            {title ? <h3 className="customer-card-title">{title}</h3> : null}
            {subtitle ? <p className="customer-card-subtitle">{subtitle}</p> : null}
          </div>
          {action ? <div className="customer-card-action">{action}</div> : null}
        </div>
      ) : null}
      <div className="customer-card-body">{children}</div>
    </Layer>
  );
}
