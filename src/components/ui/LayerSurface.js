// file location: src/components/ui/LayerSurface.js
// Canonical "surface" layer primitive. One of TWO and only two surface components for the entire app.
// Pair: <LayerSurface> + <LayerTheme>. Strict alternation as nesting deepens:
//   <LayerSurface> → <LayerTheme> → <LayerSurface> → <LayerTheme> ...
// Visual reference: "Section Layers (surface / theme alternation)" showcase in
// src/pages/dev/user-diagnostic.js (rendered without borders).
//
// Renders a borderless, rounded surface using --surface as the background.
// Consumers MUST NOT pass `border`, `background`, or `borderRadius` via the
// `style` prop. Use the `radius`, `padding`, and `gap` props instead.
import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function LayerSurface({
  children,
  className = "",
  style,
  radius = "var(--radius-md)",
  padding = "var(--section-card-padding)",
  gap = "var(--layout-card-gap)",
  as = "div",
  sectionKey,
  parentKey,
  sectionType = "content-card",
  backgroundToken = "surface",
  widthMode = "",
  shell = false,
  ...rest
}) {
  const surfaceStyle = {
    background: "var(--surface)",
    borderRadius: radius,
    padding,
    display: "flex",
    flexDirection: "column",
    gap,
    ...style,
  };

  // Stable marker class so the Dev Overlay auto-detects EVERY surface primitive
  // (and therefore every Card/Section/SectionCard that renders one) without any
  // per-instance `sectionKey`. The class is a no-op visually — it only feeds the
  // overlay's fallback selectors in src/lib/dev-layout/categories.js. This is
  // what makes new pages/sections/cards appear in the overlay with zero extra
  // steps. See also LayerTheme's `app-layer-theme`.
  const mergedClassName = ["app-layer-surface", className].filter(Boolean).join(" ");

  if (sectionKey) {
    return (
      <DevLayoutSection
        as={as}
        sectionKey={sectionKey}
        parentKey={parentKey}
        sectionType={sectionType}
        backgroundToken={backgroundToken}
        widthMode={widthMode}
        shell={shell}
        className={mergedClassName}
        style={surfaceStyle}
        {...rest}
      >
        {children}
      </DevLayoutSection>
    );
  }

  const Component = as;
  return (
    <Component className={mergedClassName} style={surfaceStyle} {...rest}>
      {children}
    </Component>
  );
}
