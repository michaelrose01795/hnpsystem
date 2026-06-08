// file location: src/pages/dev/liquid-glass-demo.js
// Standalone showcase for the liquid-glass-react primitives (GlassPanel + GlassButton).
// Route: /dev/liquid-glass-demo
//
// The page paints a vivid gradient + colour blobs behind the glass so the
// Apple-style displacement/refraction is actually visible (the effect needs
// contrasting content behind it). Best viewed in Chrome/Edge — Safari/Firefox
// fall back to a plain blur (library limitation).
import React, { useRef } from "react";
import GlassPanel from "@/components/ui/GlassPanel";
import GlassButton from "@/components/ui/GlassButton";

export default function LiquidGlassDemo() {
  const containerRef = useRef(null);

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "32px",
        padding: "64px 24px",
        background:
          "linear-gradient(135deg, #1d2671 0%, #c33764 50%, #f7971e 100%)",
      }}
    >
      {/* Decorative blobs so the refraction has something to bend */}
      <div style={{ position: "absolute", top: "12%", left: "8%", width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,0.35)", filter: "blur(8px)" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "12%", width: 320, height: 320, borderRadius: "50%", background: "rgba(60,200,255,0.45)", filter: "blur(10px)" }} />
      <div style={{ position: "absolute", top: "45%", left: "55%", width: 180, height: 180, borderRadius: "50%", background: "rgba(255,230,80,0.5)", filter: "blur(6px)" }} />

      <h1 style={{ color: "#fff", fontSize: "2rem", fontWeight: 800, zIndex: 1, textShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
        Liquid Glass UI — Cards &amp; Buttons
      </h1>

      {/* Card example */}
      <GlassPanel cornerRadius={28} padding="28px" style={{ zIndex: 1, maxWidth: 420 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", color: "#fff" }}>
          <span style={{ fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.9 }}>
            Estimated Pay
          </span>
          <strong style={{ fontSize: "2rem", fontWeight: 800 }}>£2,480.50</strong>
          <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>
            After tax · linked to the income widget
          </span>
        </div>
      </GlassPanel>

      <GlassPanel cornerRadius={28} padding="28px" style={{ zIndex: 1, maxWidth: 420 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", color: "#fff" }}>
          <span style={{ fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.9 }}>
            Leave Summary
          </span>
          <strong style={{ fontSize: "1.4rem", fontWeight: 700 }}>18 of 28 days remaining</strong>
        </div>
      </GlassPanel>

      {/* Button examples */}
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", justifyContent: "center", zIndex: 1 }}>
        <GlassButton onClick={() => alert("Primary clicked")}>
          <span style={{ color: "#fff", fontWeight: 600 }}>Request leave</span>
        </GlassButton>
        <GlassButton onClick={() => alert("Secondary clicked")} padding="10px 28px">
          <span style={{ color: "#fff", fontWeight: 600 }}>Save changes</span>
        </GlassButton>
      </div>

      <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.8rem", zIndex: 1, maxWidth: 480, textAlign: "center" }}>
        Tip: best viewed in Chrome/Edge. The edge-bending refraction does not render in
        Safari/Firefox (they fall back to a plain blur).
      </p>
    </div>
  );
}
