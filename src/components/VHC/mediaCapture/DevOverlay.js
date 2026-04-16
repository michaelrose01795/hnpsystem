import React from "react";

// Simple, extensible developer overlay mounted inside the capture area.
// Pointer-events are none by default so it doesn't block the capture UI.
export default function DevOverlay({ visible = false }) {
  if (!visible) return null;

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none", // Allow taps to pass through by default
        zIndex: 60, // Above most capture layer content but below modal chrome
      }}
    >
      {/* Example overlay content: safe area guides + a small info card */}
      <div style={{ position: "absolute", left: 12, top: 12, pointerEvents: "none" }}>
        <div style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(2,6,23,0.6)", color: "#fff", fontSize: 12, fontWeight: 800 }}>
          Dev Overlay
        </div>
      </div>

      {/* Central guides: horizontal and vertical lines */}
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(56,189,248,0.12)", transform: "translateX(-50%)" }} />
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(56,189,248,0.12)", transform: "translateY(-50%)" }} />

      {/* Safe-area inset outlines (example) */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "env(safe-area-inset-top)", background: "rgba(255,0,0,0.02)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "env(safe-area-inset-bottom)", background: "rgba(255,0,0,0.02)", pointerEvents: "none" }} />
    </div>
  );
}
