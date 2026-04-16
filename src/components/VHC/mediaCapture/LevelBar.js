// file location: src/components/VHC/mediaCapture/LevelBar.js
// Compact horizontal level bar shown in the capture top bar. Uses the
// device's `deviceorientation` event when available (after permission
// prompting on iOS) and falls back to a static zero-tilt indicator
// when the API isn't accessible. Designed for quick visual feedback;
// it does not need millimetre accuracy.

import React, { useEffect, useRef, useState } from "react"; // React primitives

// Convert a tilt reading into a 0..1 position along the bar.
// Negative tilt → left of centre; positive → right of centre.
// Values are clamped so the marker never leaves the track.
// In landscape mode, we use beta (front/back tilt) instead of gamma (left/right tilt)
// to properly detect horizontal level when device is rotated 90 degrees.
function tiltToPosition(tiltDegrees) {
  const clamped = Math.max(-30, Math.min(30, Number(tiltDegrees) || 0)); // Limit to +/-30°
  return 0.5 + clamped / 60; // Map [-30..30] into [0..1]
}

export default function LevelBar({ compact = false }) {
  // In landscape mode, we use beta (front/back tilt) to detect horizontal level.
  // beta represents rotation around the X-axis (device tilt forward/backward).
  const [beta, setBeta] = useState(0); // Current beta reading (front/back tilt)
  const [supported, setSupported] = useState(false); // True once we get readings
  const handlerRef = useRef(null); // Hold the registered handler for cleanup

  useEffect(() => {
    // Feature detect first — not all browsers expose DeviceOrientationEvent.
    if (typeof window === "undefined" || typeof window.DeviceOrientationEvent === "undefined") { // Not supported at all
      return undefined; // Bail — level stays centred
    }

    // iOS 13+ requires explicit permission; older browsers just work.
    const maybeRequest = // Wrap permission call
      typeof window.DeviceOrientationEvent.requestPermission === "function" // iOS path
        ? window.DeviceOrientationEvent.requestPermission().catch(() => "denied") // Catch user rejection
        : Promise.resolve("granted"); // Default permissive path

    let cancelled = false; // Guard for async teardown

    maybeRequest.then((state) => { // Promise resolved
      if (cancelled || state !== "granted") return; // User denied or unmounted
      const handler = (event) => { // Orientation handler
        setSupported(true); // Mark as active once we receive any event
        // Use beta for horizontal level detection in landscape mode
        // beta = front/back tilt along X-axis (positive = device tilted back, negative = tilted forward)
        setBeta(event.beta || 0); // Track front/back tilt
      };
      handlerRef.current = handler; // Remember for removal
      window.addEventListener("deviceorientation", handler, true); // Register
    });

    return () => { // Cleanup on unmount
      cancelled = true; // Mark cancellation
      if (handlerRef.current) { // Remove listener if registered
        window.removeEventListener("deviceorientation", handlerRef.current, true); // Unregister
        handlerRef.current = null; // Clear ref
      }
    };
  }, []); // Only run once on mount

  const position = tiltToPosition(beta); // 0..1 location along the track
  const isLevel = Math.abs(beta) < 1.5; // Within ~1.5° is treated as level

  return (
    <div
      aria-label="Device level"
      style={{
        display: "flex", // Horizontal layout
        alignItems: "center", // Centre the track vertically
        gap: compact ? 6 : 8, // Tight spacing inside the top bar
        padding: compact ? "6px 10px" : "8px 12px", // Pill padding
        borderRadius: 999, // Full pill rounding
        background: "rgba(15, 23, 42, 0.55)", // Translucent dark surface
        border: "1px solid rgba(255,255,255,0.08)", // Subtle border
        backdropFilter: "blur(12px)", // Glassy look over the camera
        color: "#fff", // White content
        fontSize: 11, // Compact label
        fontWeight: 700, // Bold label
        letterSpacing: "0.08em", // Slightly spaced caps for the label
        textTransform: "uppercase", // Caps for the word LEVEL
        pointerEvents: "none", // Visual only — doesn't grab touch
      }}
    >
      <span style={{ opacity: 0.8 }}>Level</span>
      <div
        style={{
          position: "relative", // Host for the marker
          width: compact ? 110 : 140, // Track width scales with context
          height: 4, // Slim track
          borderRadius: 999, // Rounded track
          background: "rgba(255,255,255,0.14)", // Neutral track colour
          overflow: "hidden", // Clip marker inside
        }}
      >
        {/* Centre guide */}
        <span
          style={{
            position: "absolute", // Overlayed on the track
            left: "50%", // Dead centre
            top: -3, // Slightly taller than track
            width: 2, // Thin vertical tick
            height: 10, // Visible above/below the track
            background: "rgba(255,255,255,0.4)", // Soft white
            transform: "translateX(-50%)", // Centre the tick on 50%
          }}
        />
        {/* Current tilt marker */}
        <span
          style={{
            position: "absolute", // Overlayed on the track
            top: "50%", // Vertical centre
            left: `${position * 100}%`, // Derived from tilt
            width: 14, // Small dot
            height: 14, // Square dot → round via radius
            borderRadius: 999, // Circular marker
            transform: "translate(-50%, -50%)", // Centre on (left, top)
            background: isLevel ? "#34d399" : "#fbbf24", // Green when level, amber otherwise
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)", // Soft drop shadow
            transition: "left 80ms linear, background-color 160ms ease", // Smooth movement + colour
          }}
        />
      </div>
      <span style={{ minWidth: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {supported ? `${Math.round(beta)}°` : "—"}
      </span>
    </div>
  );
}
