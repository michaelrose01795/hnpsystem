// file location: src/components/VHC/mediaCapture/VerticalZoomSlider.js
// Vertical zoom slider control positioned between the capture button and top right corner.
// Includes snap buttons for 0.5x, 1x, 2x zoom.

import React, { useMemo } from "react";

export default function VerticalZoomSlider({ zoomRange, zoomValue, onChange, disabled }) {
  if (!zoomRange) return null; // Nothing to show if not supported

  // Snap points: 0.5x, 1x, 2x, 3x (3x included but slider may extend beyond)
  const snapPoints = [0.5, 1, 2, 3];

  // Adaptive tolerance based on the device zoom range so snapping feels consistent.
  const tolerance = Math.max(0.05, (zoomRange.max - zoomRange.min) * 0.02);
  const shouldSnap = (value) => {
    for (const point of snapPoints) {
      if (Math.abs(value - point) <= tolerance) return point;
    }
    return value;
  };

  // When dragging, we snap when near a snap point so the interaction feels precise.
  const handleChange = (event) => {
    let value = Number(event.target.value);
    const snapped = shouldSnap(value);
    onChange?.(snapped);
  };

  // Compute marker positions (bottom-to-top) as percents for absolute placement.
  const markers = useMemo(() => {
    const span = Math.max(zoomRange.max - zoomRange.min, 0.0001);
    return snapPoints.map((p) => ({
      value: p,
      percent: ((p - zoomRange.min) / span) * 100,
    }));
  }, [zoomRange]);

  const isActive = (point) => Math.abs(zoomValue - point) <= Math.max(0.03, tolerance);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "10px 8px",
        borderRadius: 12,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        height: "auto",
        minHeight: 140,
        maxWidth: 72,
        boxSizing: "border-box",
      }}
    >
      {/* Current zoom display */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: "#38bdf8",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {`${zoomValue.toFixed(zoomValue < 1 ? 1 : Number.isInteger(zoomValue) ? 0 : 1)}x`}
      </div>

      {/* Slider + marker rail */}
      <div style={{ position: "relative", width: 48, height: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Marker labels and ticks (absolute along the rail) */}
        <div style={{ position: "absolute", left: 4, right: "auto", top: 6, bottom: 6 }}>
          {markers.map((m) => (
            <div key={m.value} style={{ position: "absolute", left: 0, transform: "translateY(50%)", bottom: `calc(${m.percent}% )`, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 2, background: isActive(m.value) ? "#38bdf8" : "rgba(255,255,255,0.12)", borderRadius: 2 }} />
              <div style={{ fontSize: 11, color: isActive(m.value) ? "#38bdf8" : "rgba(255,255,255,0.6)", fontWeight: 800 }}>{`${m.value}x`}</div>
            </div>
          ))}
        </div>

        {/* The native input rotated vertically */}
        <input
          type="range"
          min={zoomRange.min}
          max={zoomRange.max}
          step={0.01}
          value={zoomValue}
          onChange={handleChange}
          disabled={disabled}
          style={{
            writingMode: "bt-lr", // bottom-to-top
            WebkitAppearance: "slider-vertical",
            appearance: "slider-vertical",
            width: 4,
            height: 120,
            accentColor: "#38bdf8",
            cursor: disabled ? "not-allowed" : "pointer",
            background: "transparent",
          }}
        />
      </div>
    </div>
  );
}
