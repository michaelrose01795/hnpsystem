// file location: src/components/ui/Card.js
// Standard card component with shared padding, border radius, and surface styling.
// Uses the .app-section-card class from globals.css for consistent appearance.
import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

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
  const cardContent = (
    <>
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
    </>
  );

  if (sectionKey) {
    return (
      <DevLayoutSection
        as="div"
        sectionKey={sectionKey}
        parentKey={parentKey}
        sectionType={sectionType}
        backgroundToken={backgroundToken}
        widthMode={widthMode}
        shell={shell}
        className={cardClassName}
        style={style}
      >
        {cardContent}
      </DevLayoutSection>
    );
  }

  return (
    <div className={cardClassName} style={style}>
      {cardContent}
    </div>
  );
}
