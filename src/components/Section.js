// file location: src/components/Section.js
import React from "react";

/**
 * Modern, reusable card/section component for dashboard/widgets
 * Props:
 * - title: section title
 * - children: content inside the widget
 * - bgColor: background color (hex or CSS color)
 * - textColor: text color
 * - hoverShadow: whether to add subtle hover shadow
 * - useGradientShadow: use gradient shadow effect (default: true)
 * - className: optional extra Tailwind classes
 */
export default function Section({
  title,
  children,
  bgColor = "var(--surface)",        // soft white background
  textColor = "var(--text-primary)",
  hoverShadow = true,
  useGradientShadow = true,
  className = "",
}) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: bgColor,
        borderRadius: "0.75rem",                // smooth rounded corners
        padding: "1.5rem",                     // slightly more padding
        display: "flex",
        flexDirection: "column",
        minHeight: "120px",
        color: textColor,
        fontFamily: "inherit",
        transition: "all 0.2s ease-in-out",    // smooth hover effect
        boxShadow: "none",
      }}
      onMouseEnter={(e) => {
        if (hoverShadow) e.currentTarget.style.boxShadow = "0 4px 12px rgba(var(--shadow-rgb),0.12)";
      }}
      onMouseLeave={(e) => {
        if (hoverShadow) e.currentTarget.style.boxShadow = "none";
      }}
    >
      {title && (
        <h3
          style={{
            fontSize: "1.25rem",                  // slightly larger modern font
            fontWeight: 600,
            marginBottom: "0.75rem",
            color: textColor,
            fontFamily: "inherit",
          }}
        >
          {title}
        </h3>
      )}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
