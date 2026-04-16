// file location: src/components/VHC/mediaCapture/VerticalZoomSlider.js
// Sole zoom UI for the capture experience. A vertical rail with four
// snap points (0.5x, 1x, 2x, 3x) that the user can drag freely between
// or tap directly to jump to. The rail always extends above 3x so new
// higher zoom levels can fit into the same control without redesign.
//
// All colour / radius / spacing / typography values resolve through
// the --hud-*, --accent*, --space, --radius, --duration and
// --tracking-* tokens in theme.css so the camera UI follows the user's
// chosen design tokens automatically.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SNAP_POINTS = [0.5, 1, 2, 3];

const RAIL_MIN = 0.5;
const RAIL_MAX_FLOOR = 5;

function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }

function formatZoom(v) {
  if (v < 1) return `${v.toFixed(1)}x`;
  if (Math.abs(v - Math.round(v)) < 0.05) return `${Math.round(v)}x`;
  return `${v.toFixed(1)}x`;
}

export default function VerticalZoomSlider({ zoomRange, zoomValue, onChange, disabled = false }) {
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
  const railSpan = Math.max(railMax - railMin, 0.0001);

  const tolerance = useMemo(() => Math.max(0.08, railSpan * 0.04), [railSpan]);

  const applySnap = useCallback((raw) => {
    let best = null;
    let bestDist = Infinity;
    for (const point of SNAP_POINTS) {
      const d = Math.abs(raw - point);
      if (d <= tolerance && d < bestDist) { best = point; bestDist = d; }
    }
    return best == null ? raw : best;
  }, [tolerance]);

  const valueToPercent = useCallback((value) => {
    return clamp(((value - railMin) / railSpan) * 100, 0, 100);
  }, [railMin, railSpan]);

  const clientYToValue = useCallback((clientY) => {
    const node = trackRef.current;
    if (!node) return railMin;
    const rect = node.getBoundingClientRect();
    const pct = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    return railMin + pct * railSpan;
  }, [railMin, railSpan]);

  const flushPending = useCallback(() => {
    rafRef.current = 0;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next != null) onChange?.(clamp(next, hwMin, hwMax));
  }, [onChange, hwMin, hwMax]);

  const schedule = useCallback((value) => {
    pendingRef.current = value;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(flushPending);
  }, [flushPending]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const commit = useCallback((raw) => {
    const snapped = applySnap(raw);
    setLocalValue(snapped);
    schedule(snapped);
  }, [applySnap, schedule]);

  const handlePointerDown = useCallback((event) => {
    if (disabled) return;
    event.preventDefault();
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* ignore */ }
    setDragging(true);
    commit(clientYToValue(event.clientY));
  }, [disabled, commit, clientYToValue]);

  const handlePointerMove = useCallback((event) => {
    if (!dragging) return;
    event.preventDefault();
    commit(clientYToValue(event.clientY));
  }, [dragging, commit, clientYToValue]);

  const endDrag = useCallback((event) => {
    if (!dragging) return;
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* ignore */ }
    setDragging(false);
    commit(clientYToValue(event.clientY));
  }, [dragging, commit, clientYToValue]);

  const handleMarkerSelect = useCallback((point) => {
    if (disabled) return;
    setLocalValue(point);
    schedule(point);
  }, [disabled, schedule]);

  const displayValue = dragging ? localValue : (zoomValue ?? 1);
  const thumbPct = valueToPercent(displayValue);

  return (
    <div
      data-dev-section-key="capture-zoom"
      data-dev-section-type="control"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-1)",
        // Extra bottom padding so the 0.5x pill (which sits at the
        // rail's lowest tick) has real breathing room before the
        // glass edge.
        padding: "var(--space-1) 6px var(--space-6)",
        borderRadius: "var(--radius-pill)",
        background: "var(--hud-surface)",
        backdropFilter: "var(--hud-blur)",
        WebkitBackdropFilter: "var(--hud-blur)",
        border: "1px solid var(--hud-divider)",
        boxSizing: "border-box",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
        fontFamily: "var(--font-family)",
        height: "100%",
        width: 52,
        opacity: hasHardwareRange ? 1 : 0.72,
      }}
    >
      <div
        style={{
          minWidth: 36,
          textAlign: "center",
          fontSize: "var(--text-caption)",
          fontWeight: 800,
          color: "var(--accentMain)",
          letterSpacing: "var(--tracking-caps)",
          fontVariantNumeric: "tabular-nums",
          padding: "3px 0",
        }}
      >
        {formatZoom(displayValue)}
      </div>

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
          width: 40,
          flex: 1,
          minHeight: 64,
          touchAction: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 3,
            transform: "translateX(-50%)",
            background: "var(--hud-rail)",
            borderRadius: "var(--radius-pill)",
            pointerEvents: "none",
          }}
        />

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            width: 3,
            height: `${thumbPct}%`,
            transform: "translateX(-50%)",
            background: "rgba(var(--accentMainRgb), 0.55)",
            borderRadius: "var(--radius-pill)",
            pointerEvents: "none",
            transition: dragging ? "none" : "height var(--duration-fast) var(--ease-default)",
          }}
        />

        {/* Snap labels — rendered centered ON the rail (not to the
            side) so the "0.5x / 1x / 2x / 3x" readings sit directly
            on top of the sliding line. The label covered by the
            thumb is hidden so it doesn't double up with the thumb's
            own text. */}
        {SNAP_POINTS.map((point) => {
          const pct = valueToPercent(point);
          const active = Math.abs(displayValue - point) <= tolerance;
          if (active) return null; // Thumb covers this one and shows the text itself
          return (
            <button
              key={point}
              type="button"
              disabled={disabled}
              aria-label={`Zoom to ${point}x`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                handleMarkerSelect(point);
              }}
              style={{
                position: "absolute",
                left: "50%",
                bottom: `${pct}%`,
                transform: "translate(-50%, 50%)",
                // Same pill shape as the active thumb below, so when
                // the user snaps to one of these points the thumb's
                // footprint matches the label's footprint exactly —
                // it feels like the thumb *becomes* the label.
                minWidth: 30,
                height: 22,
                padding: "0 6px",
                borderRadius: "var(--radius-pill)",
                border: "1px solid var(--hud-divider)",
                background: "var(--hud-surface)",
                color: "var(--hud-text-muted)",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "var(--tracking-wide)",
                cursor: disabled ? "not-allowed" : "pointer",
                pointerEvents: disabled ? "none" : "auto",
                lineHeight: 1,
                whiteSpace: "nowrap",
                fontFamily: "var(--font-family)",
                transition: "var(--control-transition)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
              }}
            >
              {`${point}x`}
            </button>
          );
        })}

        {/* Thumb — always rendered centered on the rail at the current
            value. When the current value is within tolerance of a snap
            point the thumb widens into a pill and displays that
            snap's label ("0.5x" / "1x" / "2x" / "3x"). Between snaps
            it collapses back to a compact circle so the user can see
            they're on a free-form zoom value. */}
        {(() => {
          const snappedLabel = SNAP_POINTS.find(
            (point) => Math.abs(displayValue - point) <= tolerance,
          );
          const showLabel = snappedLabel != null;
          return (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "50%",
                bottom: `${thumbPct}%`,
                // When snapped, the thumb's outer footprint matches
                // the label pill's outer footprint pixel-for-pixel
                // (same minWidth / height / padding / box-sizing) so
                // the thumb visually sits exactly inside the label
                // shape rather than over- or under-hanging it.
                minWidth: showLabel ? 30 : 18,
                height: showLabel ? 22 : 18,
                padding: showLabel ? "0 6px" : 0,
                boxSizing: "border-box",
                transform: "translate(-50%, 50%)",
                borderRadius: "var(--radius-pill)",
                background: "var(--accentMain)",
                border: "2px solid rgba(var(--hud-text-rgb), 0.92)",
                boxShadow: dragging
                  ? "0 0 0 5px rgba(var(--accentMainRgb), 0.22), var(--hud-shadow-md)"
                  : "var(--hud-shadow-md)",
                color: "var(--onAccentText)",
                fontSize: 10,
                fontWeight: 800,
                fontFamily: "var(--font-family)",
                letterSpacing: "var(--tracking-wide)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                whiteSpace: "nowrap",
                transition: dragging
                  ? "none"
                  : "bottom var(--duration-fast) var(--ease-default), min-width var(--duration-fast) var(--ease-default), height var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default)",
              }}
            >
              {showLabel ? `${snappedLabel}x` : ""}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
