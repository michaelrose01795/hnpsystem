// file location: src/components/VHC/mediaCapture/VerticalZoomSlider.js
// Vertical zoom control for the camera capture overlay. Four snap presets
// (0.5×, 1×, 2×, 3×) sit on a log-scale rail so the visual spacing between
// them feels proportional regardless of zoom magnitude. Users can tap any
// pill to jump directly, or drag the rail for fine-grained control.
//
// All colour / radius / spacing / typography values resolve through the
// --hud-*, --accent*, --space-*, --radius-*, --duration-* and --tracking-*
// tokens in theme.css so the control follows the user's chosen theme.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SNAP_POINTS = [0.5, 1, 2, 3];
const RAIL_MIN = 0.5;
const RAIL_MAX_FLOOR = 5;

// Pixel height of every pill — active and inactive share the exact same value.
const PILL_H = 30;
// Horizontal inset inside the track so pills don't touch the container edges.
const PILL_H_INSET = 6;

function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }

function formatZoom(v) {
  if (Math.abs(v - Math.round(v)) < 0.05) return `${Math.round(v)}`;
  const s = v.toFixed(1);
  return s.startsWith("0.") ? s.slice(1) : s; // "0.5" → ".5", "1.5" → "1.5"
}

// Log-scale mapping — ensures the four presets appear evenly spaced on the rail.
// pct=0 → bottom of track (min zoom), pct=100 → top (max zoom).
function valueToPct(v, min, max) {
  const lMin = Math.log(Math.max(min, 0.01));
  const lMax = Math.log(Math.max(max, 0.01));
  if (lMax === lMin) return 0;
  return clamp(((Math.log(Math.max(v, 0.01)) - lMin) / (lMax - lMin)) * 100, 0, 100);
}

function pctToValue(pct, min, max) {
  const lMin = Math.log(Math.max(min, 0.01));
  const lMax = Math.log(Math.max(max, 0.01));
  return Math.exp(lMin + (pct / 100) * (lMax - lMin));
}

// Shared pill geometry and typography. Active vs inactive state differs ONLY
// through colour, border, glow, and text — never through shape or size.
const PILL_BASE = {
  position: "absolute",
  left: "50%",
  transform: "translate(-50%, 50%)",
  height: PILL_H,
  minWidth: 0,
  padding: "0 6px",
  borderRadius: "var(--radius-pill)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "var(--tracking-caps)",
  fontFamily: "var(--font-family)",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  lineHeight: 1,
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  MozUserSelect: "none",
  transition: [
    "background var(--duration-fast) var(--ease-out)",
    "border-color var(--duration-fast) var(--ease-out)",
    "box-shadow var(--duration-fast) var(--ease-out)",
    "color var(--duration-fast) var(--ease-out)",
  ].join(", "),
};

const PILL_ACTIVE = {
  background: "var(--accentMain)",
  border: "1.5px solid rgba(var(--accentMainRgb), 0.55)",
  boxShadow: "0 0 0 3px rgba(var(--accentMainRgb), 0.22), 0 2px 12px rgba(0,0,0,0.30)",
  color: "var(--onAccentText)",
  zIndex: 4,
};

const PILL_INACTIVE = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.13)",
  boxShadow: "none",
  color: "var(--hud-text-dim)",
  zIndex: 3,
};

const NO_SELECT = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  MozUserSelect: "none",
};

export default function VerticalZoomSlider({
  zoomRange,
  zoomValue,
  onChange,
  disabled = false,
  sliderWidth = 52,
}) {
  const trackRef = useRef(null);
  const pendingRef = useRef(null);
  const rafRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [localValue, setLocalValue] = useState(() => zoomValue ?? 1);

  const hasHardwareRange = Boolean(zoomRange);
  const hwMin = zoomRange?.min ?? RAIL_MIN;
  const hwMax = zoomRange?.max ?? RAIL_MAX_FLOOR;

  useEffect(() => {
    if (!dragging) setLocalValue(zoomValue ?? 1);
  }, [zoomValue, dragging]);

  const railMin = useMemo(() => Math.min(RAIL_MIN, hwMin), [hwMin]);
  const railMax = useMemo(() => Math.max(RAIL_MAX_FLOOR, hwMax), [hwMax]);

  const tolerance = useMemo(
    () => Math.max(0.08, (railMax - railMin) * 0.04),
    [railMin, railMax],
  );

  const applySnap = useCallback(
    (raw) => {
      let best = null;
      let bestDist = Infinity;
      for (const point of SNAP_POINTS) {
        const d = Math.abs(raw - point);
        if (d <= tolerance && d < bestDist) { best = point; bestDist = d; }
      }
      return best ?? raw;
    },
    [tolerance],
  );

  const toPct = useCallback(
    (v) => valueToPct(v, railMin, railMax),
    [railMin, railMax],
  );

  const clientYToValue = useCallback(
    (clientY) => {
      const node = trackRef.current;
      if (!node) return railMin;
      const rect = node.getBoundingClientRect();
      const pct = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
      return clamp(pctToValue(pct * 100, railMin, railMax), railMin, railMax);
    },
    [railMin, railMax],
  );

  const flushPending = useCallback(() => {
    rafRef.current = 0;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next != null) onChange?.(clamp(next, hwMin, hwMax));
  }, [onChange, hwMin, hwMax]);

  const schedule = useCallback(
    (v) => {
      pendingRef.current = v;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(flushPending);
    },
    [flushPending],
  );

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const commit = useCallback(
    (raw) => {
      const snapped = applySnap(raw);
      setLocalValue(snapped);
      schedule(snapped);
    },
    [applySnap, schedule],
  );

  const handlePointerDown = useCallback(
    (event) => {
      if (disabled) return;
      event.preventDefault();
      try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* ignore */ }
      setDragging(true);
      commit(clientYToValue(event.clientY));
    },
    [disabled, commit, clientYToValue],
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!dragging) return;
      event.preventDefault();
      commit(clientYToValue(event.clientY));
    },
    [dragging, commit, clientYToValue],
  );

  const endDrag = useCallback(
    (event) => {
      if (!dragging) return;
      try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* ignore */ }
      setDragging(false);
      commit(clientYToValue(event.clientY));
    },
    [dragging, commit, clientYToValue],
  );

  // Pills intercept their own pointerdown so dragging on the track still
  // works everywhere else. Tapping a pill immediately jumps to that preset.
  const handlePillPointerDown = useCallback(
    (point, event) => {
      event.stopPropagation();
      if (disabled) return;
      try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* ignore */ }
      setLocalValue(point);
      schedule(point);
    },
    [disabled, schedule],
  );

  const displayValue = dragging ? localValue : (zoomValue ?? 1);
  const thumbPct = toPct(displayValue);
  const isSnapped = SNAP_POINTS.some((p) => Math.abs(displayValue - p) <= tolerance);

  // pillW fills the inner content width of the track (which is sliderWidth
  // minus the 2× PILL_H_INSET padding on the outer container).
  const pillW = sliderWidth - PILL_H_INSET * 2;

  return (
    <div
      data-dev-section-key="capture-zoom"
      data-dev-section-type="control"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-2)",
        // Bottom padding = half pill height so the 0.5× pill at bottom:0%
        // is fully visible and not clipped by the container's border edge.
        padding: `var(--space-2) ${PILL_H_INSET}px ${PILL_H / 2 + 6}px`,
        borderRadius: "var(--radius-pill)",
        background: "var(--hud-surface-strong)",
        backdropFilter: "var(--hud-blur-strong)",
        WebkitBackdropFilter: "var(--hud-blur-strong)",
        border: "1.5px solid rgba(var(--accentMainRgb), 0.28)",
        boxShadow: [
          "0 8px 32px rgba(0,0,0,0.45)",
          "inset 0 1px 0 rgba(255,255,255,0.07)",
          "0 0 0 1px rgba(255,255,255,0.04)",
        ].join(", "),
        boxSizing: "border-box",
        ...NO_SELECT,
        touchAction: "none",
        fontFamily: "var(--font-family)",
        height: "100%",
        width: sliderWidth,
        opacity: hasHardwareRange ? 1 : 0.72,
        transition: "width var(--duration-normal) var(--ease-out)",
      }}
    >
      {/* ── Current zoom value readout ── */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          width: "100%",
          textAlign: "center",
          fontSize: 11,
          fontWeight: 800,
          color: "var(--accentMain)",
          letterSpacing: "var(--tracking-caps)",
          fontVariantNumeric: "tabular-nums",
          padding: "4px 4px",
          background: "rgba(var(--accentMainRgb), 0.13)",
          borderRadius: "var(--radius-pill)",
          border: "1px solid rgba(var(--accentMainRgb), 0.22)",
          lineHeight: 1.4,
          boxSizing: "border-box",
          flexShrink: 0,
          ...NO_SELECT,
        }}
      >
        {formatZoom(displayValue)}
      </div>

      {/* ── Rail and snap pills ──
          The track is the drag surface. Pills are positioned absolutely
          at their log-scale percentages so spacing feels even. The track
          uses overflow:visible so pills at the 0% position render into
          the container's bottom padding rather than being clipped. */}
      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={railMin}
        aria-valuemax={railMax}
        aria-valuenow={Number(displayValue.toFixed(2))}
        aria-orientation="vertical"
        aria-label="Zoom"
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: "relative",
          width: "100%",
          flex: 1,
          minHeight: 100,
          overflow: "visible",
          touchAction: "none",
          cursor: disabled ? "not-allowed" : dragging ? "grabbing" : "grab",
          opacity: disabled ? 0.45 : 1,
          ...NO_SELECT,
        }}
      >
        {/* Background rail */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 3,
            transform: "translateX(-50%)",
            background: "rgba(255,255,255,0.09)",
            borderRadius: "var(--radius-pill)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Accent fill — from bottom up to the current position */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            width: 3,
            height: `${thumbPct}%`,
            transform: "translateX(-50%)",
            background: "linear-gradient(to top, var(--accentMain), rgba(var(--accentMainRgb), 0.28))",
            borderRadius: "var(--radius-pill)",
            pointerEvents: "none",
            boxShadow: "0 0 8px rgba(var(--accentMainRgb), 0.40)",
            transition: dragging ? "none" : "height var(--duration-fast) var(--ease-out)",
            zIndex: 1,
          }}
        />

        {/* Freeform indicator dot — shown only when between snap presets */}
        {!isSnapped && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              bottom: `${thumbPct}%`,
              width: 12,
              height: 12,
              borderRadius: "50%",
              transform: "translate(-50%, 50%)",
              background: "var(--accentMain)",
              border: "2.5px solid rgba(var(--hud-text-rgb), 0.90)",
              boxShadow: dragging
                ? "0 0 0 5px rgba(var(--accentMainRgb), 0.22), var(--hud-shadow-md)"
                : "0 0 0 2px rgba(var(--accentMainRgb), 0.18), var(--hud-shadow-md)",
              pointerEvents: "none",
              transition: dragging
                ? "none"
                : [
                    "bottom var(--duration-fast) var(--ease-out)",
                    "box-shadow var(--duration-fast) var(--ease-out)",
                  ].join(", "),
              zIndex: 3,
            }}
          />
        )}

        {/* Snap preset pills — all four always rendered.
            Shape (size, radius, padding, font) is ALWAYS identical.
            Only colour, border, glow, and text colour change per state. */}
        {SNAP_POINTS.map((point) => {
          const pct = toPct(point);
          const active = Math.abs(displayValue - point) <= tolerance;

          return (
            <button
              key={point}
              type="button"
              disabled={disabled}
              aria-label={`Zoom to ${point}×`}
              aria-pressed={active}
              onPointerDown={(e) => handlePillPointerDown(point, e)}
              style={{
                ...PILL_BASE,
                ...(active ? PILL_ACTIVE : PILL_INACTIVE),
                width: pillW,
                bottom: `${pct}%`,
                cursor: disabled ? "not-allowed" : "pointer",
                pointerEvents: disabled ? "none" : "auto",
              }}
            >
              {formatZoom(point)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
