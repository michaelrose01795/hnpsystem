// file location: src/components/ui/GlassPanel.js
// iOS-style "liquid glass" CARD surface — thin wrapper around liquid-glass-react.
//
// Loaded client-only (ssr: false) because the library touches window/document
// without SSR guards. This is an OPT-IN showcase primitive; the canonical app
// surface is still <LayerSurface>/<LayerTheme> per CLAUDE.md §3.0. Use this where
// you specifically want the Apple displacement/refraction look.
//
// ⚠ The edge-bending refraction only fully renders in Chromium browsers.
//   Safari/Firefox fall back to a plain blur (library limitation).
//
// The effect needs something behind it to refract — place GlassPanel over a
// photo / gradient / busy background, not a flat same-colour page.
import dynamic from "next/dynamic";
import React from "react";

const LiquidGlass = dynamic(() => import("liquid-glass-react"), { ssr: false });

export default function GlassPanel({
  children,
  cornerRadius = 24,
  padding = "24px",
  blurAmount = 0.1,
  displacementScale = 64,
  saturation = 130,
  elasticity = 0.15,
  className = "",
  style,
  ...rest
}) {
  return (
    <LiquidGlass
      cornerRadius={cornerRadius}
      padding={padding}
      blurAmount={blurAmount}
      displacementScale={displacementScale}
      saturation={saturation}
      elasticity={elasticity}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </LiquidGlass>
  );
}
