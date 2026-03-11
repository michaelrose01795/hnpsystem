// file location: src/components/ui/Card.js
// Standard card component with shared padding, border radius, and surface styling.
// Uses the .app-section-card class from globals.css for consistent appearance.
import React from "react";

export default function Card({ title, subtitle, action, children, className = "", style }) {
  return (
    <div className={`app-section-card ${className}`} style={style}>
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
                  color: "var(--accent-purple)",
                }}
              >
                {title}
              </div>
            )}
            {subtitle && (
              <div
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--text-secondary)",
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
    </div>
  );
}
