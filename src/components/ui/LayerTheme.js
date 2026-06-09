// file location: src/components/ui/LayerTheme.js
// Canonical "theme" layer primitive. One of TWO and only two surface components for the entire app.
// Pair: <LayerSurface> + <LayerTheme>. Strict alternation as nesting deepens:
//   <LayerSurface> → <LayerTheme> → <LayerSurface> → <LayerTheme> ...
// Visual reference: "Section Layers (surface / theme alternation)" showcase in
// src/pages/dev/user-diagnostic.js (rendered without borders).
//
// Renders a borderless, rounded surface using --theme (tinted accent layer).
// Consumers MUST NOT pass `border`, `background`, or `borderRadius` via the
// `style` prop. Use the `radius`, `padding`, and `gap` props instead.
import React from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function LayerTheme({
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
  backgroundToken = "theme",
  widthMode = "",
  shell = false,
  ...rest
}) {
  const themeStyle = {
    background: "var(--theme)",
    borderRadius: radius,
    padding,
    display: "flex",
    flexDirection: "column",
    gap,
    ...style,
  };

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
        className={className}
        style={themeStyle}
        {...rest}
      >
        {children}
      </DevLayoutSection>
    );
  }

  const Component = as;
  return (
    <Component className={className} style={themeStyle} {...rest}>
      {children}
    </Component>
  );
}
