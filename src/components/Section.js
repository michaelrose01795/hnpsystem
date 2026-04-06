// file location: src/components/Section.js
// Canonical section card components for the entire app.
//
// Default export: Section — titled section card used across all department dashboard pages.
//   Props: title, subtitle, children
//   Renders: <section class="app-section-card"> with an h2 title and optional subtitle paragraph.
//   Used by: dashboard/service, dashboard/mot, dashboard/admin, dashboard/after-sales,
//             dashboard/managers, dashboard/accounts, dashboard/parts, dashboard/painting, dashboard/valeting
//
// Named export: SectionCard — bare card wrapper (no title) used in HR and admin pages.
//   Equivalent to: src/components/ui/Card.js
//   Used by: HR pages, admin/users, HR tab components, dashboard manager components

import React from "react"; // React runtime for JSX

// Section — titled section card for department dashboard pages.
// Replaces the identical inline `const Section = ...` that was duplicated across 9 dashboard pages.
export default function Section({ title, subtitle, children, style }) {
  return (
    <section
      className="app-section-card" // base section card styling from globals.css
      style={{ gap: "12px", ...style }} // standard internal spacing between header and content
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--accentText)" }}>{title}</h2> {/* section heading */}
        {subtitle && <p style={{ margin: "6px 0 0", color: "var(--surfaceTextMuted)" }}>{subtitle}</p>} {/* optional subtitle */}
      </div>
      {children} {/* section body content */}
    </section>
  );
}

export { default as SectionCard } from "./ui/Card"; // bare card wrapper — used by HR/admin pages, no built-in title
