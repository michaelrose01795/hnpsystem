// file location: src/components/ui/Card.js
// Bare card wrapper used across the app.
// Internally renders one of the two canonical layer primitives, so consumers
// inherit the layer-sweep visual (borderless, --radius-md corners):
//
//   layer="surface" (default) -> <LayerSurface>, --surface fill
//   layer="theme"             -> <LayerTheme>,   --theme fill
//
// `layer` exists because the surface ladder (CLAUDE.md §3.0a-2) makes a card's
// fill depend on what it sits ON, not on what it is. Default "surface" keeps
// the public API unchanged for every pre-existing consumer.
//
// `app-section-card` className is preserved on the rendered element so the
// (large) body of legacy scoped CSS in staffglobal.css continues to apply.
import React from "react";
import LayerSurface from "./LayerSurface";
import LayerTheme from "./LayerTheme";

export default function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
  style,
  layer = "surface",
  sectionKey,
  parentKey,
  sectionType = "content-card",
  backgroundToken = "",
  widthMode = "",
  shell = false,
  ...rest
}) {
  // Which rung of the surface ladder this card sits on (CLAUDE.md 3.0a-2).
  // A card dropped straight into the main page card (--surface) is the SECOND
  // rung and must be --theme; nested one level deeper it flips back to surface.
  // Default "surface" keeps every pre-existing consumer byte-identical.
  const cardClassName = `app-section-card ${className}`.trim();
  const Layer = layer === "theme" ? LayerTheme : LayerSurface;

  return (
    <Layer
      className={cardClassName}
      style={style}
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType={sectionType}
      backgroundToken={backgroundToken || layer}
      widthMode={widthMode}
      shell={shell}
      {...rest}
    >
      {(title || subtitle || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-md)",
          }}
        >
          <div>
            {title && (
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "var(--text-h3)",
                  color: "var(--accentText)",
                }}
              >
                {title}
              </div>
            )}
            {subtitle && (
              <div
                className="app-dev-section-description"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--text-1)",
                  marginTop: "var(--space-xs)",
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      )}
      {children}
    </Layer>
  );
}
