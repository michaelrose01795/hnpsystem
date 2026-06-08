// file location: src/components/ui/GlassButton.js
// iOS-style "liquid glass" BUTTON — thin wrapper around liquid-glass-react.
//
// Loaded client-only (ssr: false); see GlassPanel.js for the rationale and the
// Safari/Firefox caveat. Defaults mirror the library's button preset (pill
// radius, stronger displacement, chromatic aberration, elastic "liquid" feel).
import dynamic from "next/dynamic";
import React from "react";

const LiquidGlass = dynamic(() => import("liquid-glass-react"), { ssr: false });

export default function GlassButton({
  children,
  onClick,
  cornerRadius = 100,
  padding = "10px 22px",
  displacementScale = 64,
  blurAmount = 0.1,
  saturation = 130,
  aberrationIntensity = 2,
  elasticity = 0.35,
  className = "",
  style,
  ...rest
}) {
  return (
    <LiquidGlass
      onClick={onClick}
      cornerRadius={cornerRadius}
      padding={padding}
      displacementScale={displacementScale}
      blurAmount={blurAmount}
      saturation={saturation}
      aberrationIntensity={aberrationIntensity}
      elasticity={elasticity}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </LiquidGlass>
  );
}
