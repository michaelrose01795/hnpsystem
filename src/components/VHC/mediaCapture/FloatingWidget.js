// file location: src/components/VHC/mediaCapture/FloatingWidget.js
// DOM representation of a floating in-recording widget. This mirrors the
// widget that `useWidgetRecorder` burns into the actual video frame —
// keeping the DOM version means the technician sees exactly what the
// customer will see on playback. A long-press removes the widget.

import React, { useEffect, useRef } from "react"; // React primitives

// Convert a 0..1 fractional coordinate into a CSS percentage.
function toPercent(fraction) {
  const clamped = Math.max(0.06, Math.min(0.94, Number(fraction) || 0.5)); // Keep off the edges
  return `${clamped * 100}%`; // Return "%" string
}

// Status → accent colour used by the left strip and the badge.
const ACCENTS = { // Keep in sync with useWidgetRecorder palette
  red: "#ef4444", // Red concern accent
  amber: "#f59e0b", // Amber concern accent
  green: "#10b981", // Green / good status accent
  default: "#38bdf8", // Info fallback accent
};

// Badge label text used inside the widget.
const BADGES = { // Keep in sync with useWidgetRecorder
  red: "RED", // Red badge
  amber: "AMBER", // Amber badge
  green: "GREEN", // Green / good badge
  default: "INFO", // Info fallback
};

export default function FloatingWidget({ widget, onRemove }) {
  const timerRef = useRef(null); // Holds the long-press timer id

  // Clear any pending long-press on unmount to avoid leaks.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current); // Always clean up
  }, []);

  // On press-and-hold, call onRemove to drop the widget from the list.
  const startLongPress = () => {
    if (timerRef.current) clearTimeout(timerRef.current); // Defensive reset
    timerRef.current = setTimeout(() => { // 500ms is plenty for intent
      onRemove?.(widget.id); // Remove this widget
      timerRef.current = null; // Clear ref
    }, 500); // Long-press threshold
  };

  // Cancel the long-press if the user releases early.
  const cancelLongPress = () => {
    if (timerRef.current) { // Something pending?
      clearTimeout(timerRef.current); // Cancel
      timerRef.current = null; // Reset ref
    }
  };

  const accent = ACCENTS[widget.status] || ACCENTS.default; // Lookup accent colour
  const badge = BADGES[widget.status] || BADGES.default; // Lookup badge text

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseDown={startLongPress} // Desktop long-press
      onMouseUp={cancelLongPress} // Release cancels
      onMouseLeave={cancelLongPress} // Pointer leaving cancels
      onTouchStart={startLongPress} // Mobile long-press
      onTouchEnd={cancelLongPress} // Release cancels
      onTouchCancel={cancelLongPress} // System cancel
      style={{
        position: "absolute", // Free-placed over camera
        top: toPercent(widget.y ?? 0.5), // Vertical position
        left: toPercent(widget.x ?? 0.5), // Horizontal position
        transform: "translate(-50%, -50%)", // Centre on its point
        display: "inline-grid", // Shrink-wrap auto width
        gridTemplateColumns: "6px 1fr", // Thin accent strip + body
        gap: 10, // Breathing room between strip and body
        minWidth: 180, // Readable floor width
        maxWidth: "min(320px, 48vw)", // Never too wide on phones
        padding: "10px 14px 12px 12px", // Inner spacing
        background: "rgba(15, 23, 42, 0.94)", // Deep slate, matches canvas version
        color: "#f8fafc", // White content
        borderRadius: 14, // Modern rounded corners
        boxShadow: "0 14px 32px rgba(0,0,0,0.38)", // Elevated shadow
        border: "1px solid rgba(255,255,255,0.08)", // Subtle edge
        pointerEvents: "auto", // Interactive
        userSelect: "none", // Prevent text-select on long-press
        animation: "hnpWidgetIn 180ms ease-out", // Entry animation (keyframes defined in container)
      }}
    >
      {/* Accent strip (left) */}
      <span
        style={{
          width: 6, // Strip width
          borderRadius: 3, // Rounded ends
          background: accent, // Status colour
          alignSelf: "stretch", // Match body height
        }}
      />
      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
        {/* Badge pill */}
        <span
          style={{
            justifySelf: "start", // Badge sits on the left
            fontSize: 10, // Small caps badge
            fontWeight: 800, // Heavy
            letterSpacing: "0.12em", // Spaced caps
            textTransform: "uppercase", // Caps
            padding: "3px 8px", // Pill padding
            borderRadius: 999, // Pill
            background: accent, // Matches strip
            color: "#0f172a", // Dark text on coloured pill
          }}
        >
          {badge}
        </span>
        {/* Title */}
        <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(226, 232, 240, 0.92)", lineHeight: 1.15 }}>
          {widget.title}
        </span>
        {/* Value — the big number/text */}
        <span style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
          {widget.value}
        </span>
      </div>
    </div>
  );
}
