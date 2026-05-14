// file location: src/components/ui/Card.js
// Bare card wrapper used across the app.
// Internally renders <LayerSurface> — the canonical "surface" layer primitive —
// so all consumers of Card automatically inherit the layer-sweep visual
// (borderless, --surface fill, --radius-md corners). Public API is unchanged.
//
// `app-section-card` className is preserved on the rendered element so the
// (large) body of legacy scoped CSS in staffglobal.css continues to apply.
import React from "react";
import LayerSurface from "./LayerSurface";

export default function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
  style,
  sectionKey,
  parentKey,
  sectionType = "content-card",
  backgroundToken = "",
  widthMode = "",
  shell = false,
}) {
  const cardClassName = `app-section-card ${className}`.trim();

  return (
    <LayerSurface
      className={cardClassName}
      style={style}
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType={sectionType}
      backgroundToken={backgroundToken}
      widthMode={widthMode}
      shell={shell}
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
    </LayerSurface>
  );
}
