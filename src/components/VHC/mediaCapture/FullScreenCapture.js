// file location: src/components/VHC/mediaCapture/FullScreenCapture.js
//
// Full-screen camera / video capture surface. The preview fills the whole
// viewport and every piece of UI floats on top. This file is the single
// home for the capture chrome — orientation detection, level indicator,
// zoom slider, shutter / flip / pause controls, the floating widget DOM
// mirror, and the capture portal itself all live here. ConcernPanel and
// the data-layer hooks (useDeviceCamera, useWidgetRecorder) stay in
// their own files because they carry independent responsibilities that
// are reused or tested on their own.
//
// Landscape-only. The camera will not operate in portrait — a "Rotate
// Device" prompt is shown and both shutter handlers bail. This matches
// the format the customer sees on playback and keeps the baked-in
// widgets consistent.
//
// Every colour, radius, spacing, and typography value resolves through
// CSS variables in src/styles/theme.css (the --hud-* / --space-* /
// --radius-* / --duration-* token set) so theme switching flows through
// the capture UI automatically.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";
import { showAlert } from "@/lib/notifications/alertBus";
import { buildErrorAlert } from "@/lib/notifications/buildErrorAlert";

import useDeviceCamera from "./useDeviceCamera";
import useWidgetRecorder from "./useWidgetRecorder";
import ConcernPanel from "./ConcernPanel";

// ─── layout constants ────────────────────────────────────────────────────────

// Footprint of the floating-widget card; the crosshair outline and the
// info / error card in the middle of the viewport all match this size.
const WIDGET_OUTLINE_WIDTH = 320;
const WIDGET_OUTLINE_HEIGHT = 120;

// Right-side controls column width scales with viewport so the shutter
// button stays a comfortable thumb target on every size from horizontal
// phones through to desktop.
function getControlsWidth(screenWidth) {
  if (screenWidth < 500) return 68;
  if (screenWidth < 768) return 80;
  if (screenWidth < 1024) return 88;
  return 96;
}

// Left concern panel width scales down on small landscape phones so it
// doesn't swallow the preview. Mid-range screens get a bit more so labels
// don't get cramped.
function getPanelWidth(screenWidth) {
  if (screenWidth < 560) return 180;
  if (screenWidth < 768) return 210;
  if (screenWidth < 1024) return 240;
  return 260;
}

// ─── orientation detection ───────────────────────────────────────────────────

function readIsLandscape() {
  if (typeof window === "undefined") return false;
  if (window.innerWidth > window.innerHeight) return true;
  if (typeof window.orientation === "number") {
    const angle = Math.abs(window.orientation);
    return angle === 90 || angle === 270;
  }
  if (typeof screen !== "undefined" && screen.orientation?.type) {
    return screen.orientation.type.includes("landscape");
  }
  return false;
}

function useOrientation() {
  const [state, setState] = useState(() => ({
    isLandscape: readIsLandscape(),
    screenWidth: typeof window !== "undefined" ? window.innerWidth : 0,
    screenHeight: typeof window !== "undefined" ? window.innerHeight : 0,
  }));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const update = () => {
      setState({
        isLandscape: readIsLandscape(),
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
      });
    };
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);
    window.addEventListener("fullscreenchange", update);
    return () => {
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("fullscreenchange", update);
    };
  }, []);

  return state;
}

// ─── tilt math ───────────────────────────────────────────────────────────────
//
// Earlier iterations relied on screen.orientation.angle to rotate gravity
// into the screen frame. That's unreliable: on iOS below 16.4, on some
// Android builds, and on any embedded webview that doesn't report a live
// angle, `screen.orientation.angle` stays at 0 even when the device is
// physically in landscape. With a wrong screen angle the projection
// arithmetic shifts the "level" reference 90° — which is exactly the
// drift the user was seeing (reads ~90° when the device is level).
//
// Instead we operate purely on the gravity vector expressed in the
// device's own frame. Which way is "screen-up" in landscape falls out of
// the data — the device axis with the larger absolute gravity component
// is the vertical one. For portrait we use the remaining axis. The only
// environment signal we keep is window.innerWidth > innerHeight, which
// is reliable across browsers and viewports.
//
// Verified cases (β/γ derived from Tait-Bryan ZXY rotations):
//   portrait upright level  (β≈90,  γ≈0)   → 0°
//   landscape-primary level (β≈0,   γ≈-90) → 0°
//   landscape-secondary lvl (β≈0,   γ≈+90) → 0°
//   any of those rolled 10° CW (user view) → +10°

// Graph runs 0 → ±10°; anything beyond just parks the bubble at the end.
const TILT_RANGE = 10;
const LEVEL_EPSILON = 0.4;
const NEAR_LEVEL = 3;
// Exponential smoothing weight: each update keeps this much of the
// previous sample. Higher = calmer dot, lower = more responsive. 0.35
// filters out most of the accelerometer jitter while still keeping
// real motion visible within a couple of frames.
const SMOOTHING = 0.35;
// Non-linear position curve. Values > 1 *compress* the near-zero region
// so tiny sensor noise doesn't make the bubble wander when the phone is
// basically level, while larger tilts still move visibly. 1.35 keeps
// the dot within ~1% of centre for any |tilt| under ~0.5°.
const POS_CURVE = 1.35;
// Tilts smaller than this snap the bubble to exact centre. Kills the
// last residual wobble near level without affecting the degree readout.
const POS_DEADZONE_DEG = 0.25;

const TILT_TICKS = [
  { deg:  3, major: false }, { deg:  -3, major: false },
  { deg:  5, major: true  }, { deg:  -5, major: true  },
  { deg:  7, major: false }, { deg:  -7, major: false },
  { deg: 10, major: true  }, { deg: -10, major: true  },
];

// Width of the coloured "target" band around centre. Calibrated against
// the new (compressed-near-zero) mapping so the band spans roughly ±1.5°
// of physical tilt — wide enough to be readable, tighter than the
// integer-readout boundary at ±0.5°.
const LEVEL_ZONE_LEFT_PCT = 46;
const LEVEL_ZONE_WIDTH_PCT = 8;

function normaliseAngle(a) {
  let v = Number(a) || 0;
  while (v > 180) v -= 360;
  while (v < -180) v += 360;
  return v;
}

// Tilt from a gravity-direction 2D vector in the device's own frame.
// `(gx, gy)` is gravity projected onto the screen plane, oriented in the
// device's portrait frame (gx along device +X = portrait-right, gy along
// device +Y = portrait-top). Sign convention: positive tilt = rolled CW
// from the user's viewpoint.
function tiltFromGravity(gx, gy, isLandscape) {
  const magX = Math.abs(gx);
  const magY = Math.abs(gy);

  if (isLandscape) {
    // In landscape the "up" axis on screen is device ±X; the one with the
    // larger gravity component wins, and its sign decides which landscape
    // orientation we're in. If gy dominates anyway (rare: a landscape
    // viewport with a physically portrait device) we fall back to the
    // portrait formula so the bar still reads zero when level. Sign is
    // flipped between the two landscape halves so a CW roll from the
    // user's view is positive no matter which way the device is on.
    if (magX >= magY) {
      return gx <= 0
        ? normaliseAngle((Math.atan2(-gy, -gx) * 180) / Math.PI)
        : normaliseAngle((Math.atan2(gy, gx) * 180) / Math.PI);
    }
  }

  // Portrait-ish: gravity "down on screen" is device -Y.
  return normaliseAngle((Math.atan2(gx, -gy) * 180) / Math.PI);
}

// DeviceOrientationEvent path: β/γ → gravity → tilt.
function computeTiltFromOrientation(beta, gamma, isLandscape) {
  const rad = Math.PI / 180;
  const b = (Number(beta) || 0) * rad;
  const g = (Number(gamma) || 0) * rad;
  // Gravity in device frame (R^T · [0,0,-1]) projected onto the screen
  // plane. z-component is ignored — it's the "pointing away from user"
  // component, not relevant to roll.
  const gx = Math.cos(b) * Math.sin(g);
  const gy = -Math.sin(b);
  return tiltFromGravity(gx, gy, isLandscape);
}

// DeviceMotionEvent path: accelerationIncludingGravity → tilt. Preferred
// when available — it's immune to Euler-angle / screen-rotation quirks.
// acc reports the reaction force, which is the inverse of gravity, so
// we flip the signs before handing off to the shared tilt formula.
function computeTiltFromMotion(accel, isLandscape) {
  if (!accel) return 0;
  const ax = Number(accel.x) || 0;
  const ay = Number(accel.y) || 0;
  const az = Number(accel.z) || 0;
  const mag = Math.hypot(ax, ay, az) || 1;
  return tiltFromGravity(-ax / mag, -ay / mag, isLandscape);
}

function tiltToPos(deg) {
  const c = Math.max(-TILT_RANGE, Math.min(TILT_RANGE, Number(deg) || 0));
  // Near-level deadzone: when the phone really is basically flat, the
  // bubble sits on the centre mark and doesn't chase sensor noise.
  if (Math.abs(c) < POS_DEADZONE_DEG) return 0.5;
  // Power curve (>1) compresses the near-zero region so small deviations
  // barely move the dot, while larger tilts use more of the track.
  const sign = c < 0 ? -1 : 1;
  const magnitude = Math.pow(Math.abs(c) / TILT_RANGE, POS_CURVE);
  return 0.5 + (sign * magnitude) / 2;
}

function tiltColor(tilt) {
  const a = Math.abs(tilt);
  if (a <= LEVEL_EPSILON) return "var(--success)";
  if (a <= NEAR_LEVEL) return "var(--warning)";
  return "var(--danger)";
}

const LEVEL_STATUS_BG = {
  recording: "rgba(var(--danger-rgb),  0.92)",
  paused:    "rgba(var(--warning-rgb), 0.92)",
  default:   "rgba(var(--accentMainRgb), 0.10)",
};

function LevelBar({ compact = false, statusLabel = "", statusTone = "default" }) {
  const [tilt, setTilt] = useState(0);
  const [supported, setSupported] = useState(false);
  const smoothedRef = useRef(0);
  const motionHandlerRef = useRef(null);
  const orientationHandlerRef = useRef(null);
  const usingMotionRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const pushTilt = (raw) => {
      const next = smoothedRef.current + (1 - SMOOTHING) * (raw - smoothedRef.current);
      smoothedRef.current = next;
      setSupported(true);
      setTilt(next);
    };

    // iOS gates both DeviceMotion and DeviceOrientation behind
    // requestPermission(). A single grant covers both APIs, so asking
    // twice would just show the prompt a second time. Prefer the motion
    // gate (covers both events) and fall back to the orientation gate
    // when motion isn't exposed. Non-iOS browsers have no gate.
    const gate = typeof window.DeviceMotionEvent?.requestPermission === "function"
      ? () => window.DeviceMotionEvent.requestPermission().catch(() => "denied")
      : typeof window.DeviceOrientationEvent?.requestPermission === "function"
        ? () => window.DeviceOrientationEvent.requestPermission().catch(() => "denied")
        : () => Promise.resolve("granted");

    let cancelled = false;
    gate().then((state) => {
      if (cancelled || state !== "granted") return;
      if (typeof window.DeviceMotionEvent !== "undefined") {
        const motionHandler = (event) => {
          // Prefer the device-frame gravity vector — no Euler-angle or
          // screen-angle guesswork. `isLandscape` comes straight from
          // viewport dimensions, which every browser agrees on.
          const isLandscape = window.innerWidth > window.innerHeight;
          const raw = computeTiltFromMotion(event.accelerationIncludingGravity, isLandscape);
          if (raw == null || Number.isNaN(raw)) return;
          usingMotionRef.current = true;
          pushTilt(raw);
        };
        motionHandlerRef.current = motionHandler;
        window.addEventListener("devicemotion", motionHandler, true);
      }
      if (typeof window.DeviceOrientationEvent !== "undefined") {
        const orientationHandler = (event) => {
          // Fallback path. Motion handler owns updates once it fires at
          // least once — orientation is only a safety net for browsers
          // that expose orientation but not accelerationIncludingGravity.
          if (usingMotionRef.current) return;
          const isLandscape = window.innerWidth > window.innerHeight;
          const raw = computeTiltFromOrientation(event.beta, event.gamma, isLandscape);
          if (raw == null || Number.isNaN(raw)) return;
          pushTilt(raw);
        };
        orientationHandlerRef.current = orientationHandler;
        window.addEventListener("deviceorientation", orientationHandler, true);
      }
    });

    return () => {
      cancelled = true;
      if (motionHandlerRef.current) {
        window.removeEventListener("devicemotion", motionHandlerRef.current, true);
        motionHandlerRef.current = null;
      }
      if (orientationHandlerRef.current) {
        window.removeEventListener("deviceorientation", orientationHandlerRef.current, true);
        orientationHandlerRef.current = null;
      }
      usingMotionRef.current = false;
    };
  }, []);

  const pos = tiltToPos(tilt);
  const color = tiltColor(tilt);
  const isLevel = Math.abs(tilt) <= LEVEL_EPSILON;
  const isActive = statusTone !== "default";
  const bg = LEVEL_STATUS_BG[statusTone] ?? LEVEL_STATUS_BG.default;
  const trackW = compact ? 120 : 150;
  const pad = compact ? "var(--space-1) var(--space-2)" : "var(--space-sm) var(--space-3)";
  const gap = compact ? "var(--space-1)" : "var(--space-sm)";

  return (
    <div
      data-dev-section-key="capture-level"
      data-dev-section-type="status-pill"
      aria-label={statusLabel ? `Recording status: ${statusLabel}` : "Device level"}
      style={{
        display: "flex",
        alignItems: "center",
        gap,
        padding: pad,
        borderRadius: "var(--radius-pill)",
        background: bg,
        border: isActive
          ? `1px solid ${isLevel ? "rgba(34,197,94,0.40)" : "var(--hud-divider)"}`
          : "none",
        backdropFilter: "var(--hud-blur)",
        WebkitBackdropFilter: "var(--hud-blur)",
        color: "var(--hud-text)",
        fontSize: "var(--text-caption)",
        fontWeight: 700,
        letterSpacing: "var(--tracking-caps)",
        textTransform: "uppercase",
        pointerEvents: "none",
        fontFamily: "var(--font-family)",
        transition: "background var(--duration-normal) var(--ease-default), border-color 0.3s ease",
      }}
    >
      <span style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        opacity: isActive ? 1 : 0.85,
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}>
        {isActive ? (
          <span aria-hidden="true" style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            flexShrink: 0,
            background: statusTone === "recording" ? "var(--danger)" : "var(--warning)",
          }} />
        ) : null}
        {statusLabel || "Level"}
      </span>

      <div style={{
        position: "relative",
        width: trackW,
        height: 4,
        borderRadius: "var(--radius-pill)",
        background: "var(--hud-rail)",
        flexShrink: 0,
        overflow: "visible",
      }}>
        <span aria-hidden="true" style={{
          position: "absolute",
          top: 0,
          left: `${LEVEL_ZONE_LEFT_PCT}%`,
          width: `${LEVEL_ZONE_WIDTH_PCT}%`,
          height: "100%",
          borderRadius: "var(--radius-pill)",
          background: "rgba(34,197,94,0.40)",
          pointerEvents: "none",
        }} />

        {TILT_TICKS.map(({ deg, major }) => (
          <span key={deg} aria-hidden="true" style={{
            position: "absolute",
            left: `${tiltToPos(deg) * 100}%`,
            top: "50%",
            width: 1,
            height: major ? 10 : 6,
            background: "rgba(var(--hud-text-rgb),0.22)",
            transform: "translate(-50%,-50%)",
          }} />
        ))}

        <span aria-hidden="true" style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 1,
          height: 16,
          background: supported && isLevel ? color : "rgba(var(--hud-text-rgb),0.65)",
          transform: "translate(-50%,-50%)",
          transition: "background 0.3s ease",
          zIndex: 2,
        }} />

        <span aria-hidden="true" style={{
          position: "absolute",
          top: "50%",
          left: `${pos * 100}%`,
          width: 10,
          height: 10,
          borderRadius: "var(--radius-pill)",
          transform: "translate(-50%,-50%)",
          background: supported ? color : "rgba(var(--hud-text-rgb),0.28)",
          border: supported && isLevel ? "1px solid rgba(255,255,255,0.85)" : "1px solid rgba(0,0,0,0.35)",
          boxShadow: supported && isLevel
            ? "0 0 5px 1.5px rgba(34,197,94,0.65), var(--hud-shadow-md)"
            : "var(--hud-shadow-md)",
          // No CSS easing on `left` — the exponential smoothing in the
          // sensor handler already produces a smooth trajectory, and a
          // separate 80ms animation on top of it added perceptible lag.
          transition: "background 150ms ease, box-shadow 150ms ease, border-color 150ms ease",
          willChange: "left",
          zIndex: 1,
        }} />
      </div>

    </div>
  );
}

// ─── floating widget (DOM mirror of the baked-in recording widget) ──────────

const WIDGET_ACCENTS = {
  red: "var(--danger)",
  amber: "var(--warning)",
  green: "var(--success)",
  default: "var(--accentMain)",
};

function widgetPositionPercent(fraction) {
  const clamped = Math.max(0.06, Math.min(0.94, Number(fraction) || 0.5));
  return `${clamped * 100}%`;
}

function FloatingWidget({ widget, onRemove }) {
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const startLongPress = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onRemove?.(widget.id);
      timerRef.current = null;
    }, 500);
  };

  const cancelLongPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const accent = WIDGET_ACCENTS[widget.status] || WIDGET_ACCENTS.default;
  const title = String(widget.title || "").trim();
  const value = String(widget.value || "").trim();
  const hasTitle = title.length > 0;
  const valueFontSize = hasTitle ? "var(--text-h3)" : "var(--text-h2)";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Overlay widget: ${title || value}. Long-press to remove.`}
      data-dev-section-key="capture-floating-widget"
      data-dev-section-type="content-card"
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
      style={{
        position: "absolute",
        top: widgetPositionPercent(widget.y ?? 0.5),
        left: widgetPositionPercent(widget.x ?? 0.5),
        transform: "translate(-50%, -50%)",
        display: "grid",
        gridTemplateColumns: "8px 1fr",
        alignItems: "center",
        gap: "var(--space-3)",
        width: WIDGET_OUTLINE_WIDTH,
        height: WIDGET_OUTLINE_HEIGHT,
        padding: "var(--space-3) var(--space-4)",
        background: "var(--hud-surface-glass)",
        color: "var(--hud-text)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--hud-shadow-md)",
        border: "1px solid var(--hud-divider)",
        pointerEvents: "auto",
        userSelect: "none",
        WebkitUserSelect: "none",
        animation: "hnpWidgetIn 180ms var(--ease-default)",
        fontFamily: "var(--font-family)",
        boxSizing: "border-box",
      }}
    >
      <span aria-hidden="true" style={{
        width: 8,
        height: "100%",
        borderRadius: "var(--radius-pill)",
        background: accent,
        alignSelf: "stretch",
      }} />

      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: hasTitle ? "var(--space-1)" : 0,
        minWidth: 0,
        height: "100%",
      }}>
        {hasTitle ? (
          <span style={{
            fontSize: "var(--text-body-sm)",
            fontWeight: 700,
            color: "var(--hud-text-muted)",
            lineHeight: "var(--leading-tight)",
            letterSpacing: "var(--tracking-wide)",
            textTransform: "uppercase",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {title}
          </span>
        ) : null}
        <span style={{
          fontSize: valueFontSize,
          fontWeight: 800,
          color: "var(--hud-text)",
          lineHeight: "var(--leading-tight)",
          fontVariantNumeric: "tabular-nums",
          display: "-webkit-box",
          WebkitLineClamp: hasTitle ? 2 : 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {value}
        </span>
      </div>
    </div>
  );
}

// ─── crosshair / framing guide ──────────────────────────────────────────────

function Crosshair({ dimmed = false }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: WIDGET_OUTLINE_WIDTH,
        height: WIDGET_OUTLINE_HEIGHT,
        border: "1.5px dashed var(--hud-text)",
        borderRadius: "var(--radius-md)",
        pointerEvents: "none",
        opacity: dimmed ? 0.25 : 0.55,
        transition: "opacity var(--duration-normal) var(--ease-default)",
        boxSizing: "border-box",
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 6,
        height: 6,
        borderRadius: "var(--radius-pill)",
        background: "var(--hud-text)",
        transform: "translate(-50%, -50%)",
        opacity: 0.9,
      }} />
    </div>
  );
}

// ─── vertical zoom slider ────────────────────────────────────────────────────

const ZOOM_SNAP_POINTS = [0.5, 1, 2, 3];
const ZOOM_RAIL_MIN = 0.5;
const ZOOM_RAIL_MAX_FLOOR = 5;
const ZOOM_PILL_H = 14;
const ZOOM_PILL_H_INSET = 6;

function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }

function formatZoom(v) {
  if (Math.abs(v - Math.round(v)) < 0.05) return `${Math.round(v)}`;
  const s = v.toFixed(1);
  return s.startsWith("0.") ? s.slice(1) : s;
}

// Piecewise anchor mapping: spreads the 0.5/1/2/3 snap points evenly along
// the lower portion of the rail so the 2× and 3× pills don't crowd together,
// then maps any remaining hardware zoom range (>3×) into the top 10%.
function zoomAnchors(min, max) {
  const anchors = [[min, 10]];
  if (min < 1) anchors.push([1, 22]);
  if (min < 2) anchors.push([2, 52]);
  if (min < 3) anchors.push([3, 80]);
  const topV = Math.max(max, anchors[anchors.length - 1][0] + 0.01);
  anchors.push([topV, 100]);
  return anchors;
}

function zoomValueToPct(v, min, max) {
  const anchors = zoomAnchors(min, max);
  if (v <= anchors[0][0]) return 0;
  if (v >= anchors[anchors.length - 1][0]) return 100;
  for (let i = 1; i < anchors.length; i++) {
    const [v1, p1] = anchors[i - 1];
    const [v2, p2] = anchors[i];
    if (v <= v2) {
      const t = (v - v1) / (v2 - v1);
      return clamp(p1 + t * (p2 - p1), 0, 100);
    }
  }
  return 100;
}

function zoomPctToValue(pct, min, max) {
  const anchors = zoomAnchors(min, max);
  if (pct <= 0) return anchors[0][0];
  if (pct >= 100) return anchors[anchors.length - 1][0];
  for (let i = 1; i < anchors.length; i++) {
    const [v1, p1] = anchors[i - 1];
    const [v2, p2] = anchors[i];
    if (pct <= p2) {
      const t = (pct - p1) / (p2 - p1);
      return v1 + t * (v2 - v1);
    }
  }
  return anchors[anchors.length - 1][0];
}

const ZOOM_PILL_BASE = {
  position: "absolute",
  left: "50%",
  transform: "translate(-50%, 50%)",
  height: ZOOM_PILL_H,
  minHeight: ZOOM_PILL_H,
  maxHeight: ZOOM_PILL_H,
  minWidth: 0,
  padding: "0 4px",
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

const ZOOM_PILL_ACTIVE = {
  background: "var(--accentMain)",
  border: "1.5px solid rgba(var(--accentMainRgb), 0.55)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
  color: "var(--onAccentText)",
  zIndex: 4,
};

const ZOOM_PILL_INACTIVE = {
  background: "rgba(var(--accentMainRgb), 0.10)",
  border: "none",
  boxShadow: "none",
  color: "var(--hud-text)",
  zIndex: 3,
};

const NO_SELECT = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  MozUserSelect: "none",
};

function VerticalZoomSlider({ zoomRange, zoomValue, onChange, disabled = false, sliderWidth = 52 }) {
  const trackRef = useRef(null);
  const pendingRef = useRef(null);
  const rafRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [localValue, setLocalValue] = useState(() => zoomValue ?? 1);

  const hasHardwareRange = Boolean(zoomRange);
  const hwMin = zoomRange?.min ?? ZOOM_RAIL_MIN;
  const hwMax = zoomRange?.max ?? ZOOM_RAIL_MAX_FLOOR;

  useEffect(() => {
    if (!dragging) setLocalValue(zoomValue ?? 1);
  }, [zoomValue, dragging]);

  const railMin = useMemo(() => Math.min(ZOOM_RAIL_MIN, hwMin), [hwMin]);
  const railMax = useMemo(() => Math.max(ZOOM_RAIL_MAX_FLOOR, hwMax), [hwMax]);

  const tolerance = useMemo(
    () => Math.max(0.08, (railMax - railMin) * 0.04),
    [railMin, railMax],
  );

  const applySnap = useCallback((raw) => {
    let best = null;
    let bestDist = Infinity;
    for (const point of ZOOM_SNAP_POINTS) {
      const d = Math.abs(raw - point);
      if (d <= tolerance && d < bestDist) { best = point; bestDist = d; }
    }
    return best ?? raw;
  }, [tolerance]);

  const toPct = useCallback(
    (v) => zoomValueToPct(v, railMin, railMax),
    [railMin, railMax],
  );

  const clientYToValue = useCallback((clientY) => {
    const node = trackRef.current;
    if (!node) return railMin;
    const rect = node.getBoundingClientRect();
    const pct = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    return clamp(zoomPctToValue(pct * 100, railMin, railMax), railMin, railMax);
  }, [railMin, railMax]);

  const flushPending = useCallback(() => {
    rafRef.current = 0;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next != null) onChange?.(clamp(next, hwMin, hwMax));
  }, [onChange, hwMin, hwMax]);

  const schedule = useCallback((v) => {
    pendingRef.current = v;
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

  const handlePillPointerDown = useCallback((point, event) => {
    event.stopPropagation();
    if (disabled) return;
    event.preventDefault();
    setLocalValue(point);
    schedule(point);
    // Capture on the rail (not the pill) so pointermove/up flow into the
    // slider's drag handlers — the user can keep their finger down and drag
    // away from the pill to pick any zoom value.
    if (trackRef.current) {
      try { trackRef.current.setPointerCapture?.(event.pointerId); } catch { /* ignore */ }
    }
    setDragging(true);
  }, [disabled, schedule]);

  const displayValue = dragging ? localValue : (zoomValue ?? 1);
  const thumbPct = toPct(displayValue);
  const isSnapped = ZOOM_SNAP_POINTS.some((p) => Math.abs(displayValue - p) <= tolerance);
  const pillW = sliderWidth - ZOOM_PILL_H_INSET * 2 - 6;

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
        padding: `var(--space-2) ${ZOOM_PILL_H_INSET}px ${ZOOM_PILL_H / 2 + 6}px`,
        borderRadius: "var(--radius-pill)",
        background: "rgba(var(--accentMainRgb), 0.10)",
        backdropFilter: "var(--hud-blur-strong)",
        WebkitBackdropFilter: "var(--hud-blur-strong)",
        border: "none",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
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
          background: "transparent",
          borderRadius: "var(--radius-pill)",
          border: "none",
          lineHeight: 1.4,
          boxSizing: "border-box",
          flexShrink: 0,
          ...NO_SELECT,
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
        <div aria-hidden="true" style={{
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
        }} />

        <div aria-hidden="true" style={{
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
        }} />

        {!isSnapped ? (
          <div aria-hidden="true" style={{
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
          }} />
        ) : null}

        {ZOOM_SNAP_POINTS.map((point) => {
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
                ...ZOOM_PILL_BASE,
                ...(active ? ZOOM_PILL_ACTIVE : ZOOM_PILL_INACTIVE),
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

// ─── camera controls (shutter, pause, flip, mode toggle) ────────────────────

const CHIP_BASE = {
  borderRadius: "var(--radius-pill)",
  border: "none",
  background: "rgba(var(--accentMainRgb), 0.10)",
  color: "var(--hud-text)",
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "var(--hud-blur)",
  WebkitBackdropFilter: "var(--hud-blur)",
  cursor: "pointer",
  transition: "var(--control-transition)",
  fontFamily: "var(--font-family)",
  lineHeight: 1,
};

function Chip({ children, onClick, ariaLabel, disabled = false, highlight = false, testId, compactMode = false }) {
  const size = compactMode ? 44 : 52;
  const fontSize = compactMode ? "var(--text-body-sm)" : "var(--text-body)";

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...CHIP_BASE,
        width: size,
        height: size,
        fontSize,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...(highlight
          ? { border: "none", background: "rgba(var(--danger-rgb), 0.22)" }
          : null),
      }}
    >
      {children}
    </button>
  );
}

function ShutterButton({ mode, isRecording, isPaused, onPress, disabled, compactMode = false }) {
  const shutterSize = compactMode ? 70 : 82;
  const ringSize = 4;

  const innerShape = mode === "photo"
    ? { size: compactMode ? 36 : 42, radius: "var(--radius-pill)", colour: "var(--hud-text)" }
    : isRecording
      ? { size: compactMode ? 18 : 22, radius: "var(--radius-xs)", colour: "var(--danger)" }
      : { size: compactMode ? 34 : 40, radius: "var(--radius-pill)", colour: "var(--danger)" };

  const ringColour = isRecording ? "rgba(var(--danger-rgb), 0.9)" : "rgba(var(--hud-text-rgb), 0.95)";

  return (
    <button
      type="button"
      aria-label={mode === "photo" ? "Take photo" : isRecording ? "Stop recording" : "Start recording"}
      onClick={onPress}
      disabled={disabled}
      style={{
        width: shutterSize,
        height: shutterSize,
        borderRadius: "var(--radius-pill)",
        border: `${ringSize}px solid ${ringColour}`,
        background: "var(--hud-surface-subtle)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: "var(--hud-shadow-md)",
        transition: "border-color var(--duration-normal) var(--ease-default), opacity var(--duration-normal) var(--ease-default)",
        fontFamily: "var(--font-family)",
      }}
    >
      <span style={{
        width: innerShape.size,
        height: innerShape.size,
        borderRadius: innerShape.radius,
        background: innerShape.colour,
        display: "block",
        transition: "all var(--duration-normal) var(--ease-default)",
        opacity: isPaused ? 0.6 : 1,
      }} />
    </button>
  );
}

function CameraControls({ mode, isRecording, isPaused, canPause, onShutterPress, onPausePress, onFlip, disabled, compactMode }) {
  const isVideo = mode === "video";

  return (
    <div
      data-dev-section-key="capture-controls"
      data-dev-section-type="toolbar"
      style={{
        pointerEvents: "auto",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: compactMode
          ? "var(--space-3) var(--space-sm) calc(var(--space-md) + env(safe-area-inset-bottom))"
          : "var(--space-5) var(--space-2) calc(var(--space-6) + env(safe-area-inset-bottom))",
        gap: compactMode ? "var(--space-2)" : "var(--space-4)",
        width: "100%",
        fontFamily: "var(--font-family)",
      }}
    >
      <div style={{ display: "grid", gap: compactMode ? "var(--space-2)" : "var(--space-4)", justifyItems: "center" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isVideo && isRecording ? (
            <div style={{
              position: "absolute",
              right: "100%",
              top: "50%",
              transform: "translateY(-50%)",
              paddingRight: compactMode ? "var(--space-2)" : "var(--space-3)",
              pointerEvents: "auto",
            }}>
              <Chip
                ariaLabel={isPaused ? "Resume recording" : "Pause recording"}
                onClick={onPausePress}
                disabled={disabled || !canPause}
                highlight={isPaused}
                testId="capture-pause"
                compactMode={compactMode}
              >
                {isPaused ? "▶" : "❚❚"}
              </Chip>
            </div>
          ) : null}

          <ShutterButton
            mode={mode}
            isRecording={isRecording}
            isPaused={isPaused}
            onPress={onShutterPress}
            disabled={disabled}
            compactMode={compactMode}
          />
        </div>

        <Chip
          ariaLabel="Switch camera"
          onClick={onFlip}
          disabled={disabled || isRecording}
          compactMode={compactMode}
        >
          ⇄
        </Chip>
      </div>
    </div>
  );
}

function CaptureModeToggle({ mode, onChange, disabled, compact = false }) {
  const minWidth = compact ? 62 : 74;
  const height = compact ? 30 : 34;
  const fontSize = compact ? "var(--text-caption)" : "var(--text-body-sm)";
  const padding = compact ? "0 var(--space-3)" : "0 var(--space-4)";

  const options = [
    { id: "photo", label: "Photo" },
    { id: "video", label: "Video" },
  ];

  return (
    <div
      data-dev-section-key="capture-mode-toggle"
      data-dev-section-type="toolbar"
      role="tablist"
      aria-label="Capture mode"
      style={{
        display: "inline-flex",
        padding: 3,
        borderRadius: "var(--radius-pill)",
        border: "none",
        background: "rgba(var(--accentMainRgb), 0.10)",
        backdropFilter: "var(--hud-blur)",
        WebkitBackdropFilter: "var(--hud-blur)",
        gap: 3,
        fontFamily: "var(--font-family)",
      }}
    >
      {options.map((option) => {
        const active = option.id === mode;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => !disabled && onChange?.(option.id)}
            disabled={disabled}
            style={{
              minWidth,
              height,
              padding,
              borderRadius: "var(--radius-pill)",
              border: "none",
              background: active ? "var(--accentMain)" : "transparent",
              color: active ? "var(--onAccentText)" : "var(--hud-text)",
              fontSize,
              fontWeight: 800,
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
              transition: "var(--control-transition)",
              fontFamily: "var(--font-family)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── top-level portal ────────────────────────────────────────────────────────

let widgetIdCounter = 0;
function nextWidgetId(kind) {
  widgetIdCounter += 1;
  return `${kind}-${Date.now()}-${widgetIdCounter}`;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function FullScreenCapture({
  isOpen,
  initialMode = "photo",
  onClose,
  onCapture,
  allowModeSwitch = true,
  panel = null,
  // Kept in the public API for backward compatibility — the panel can no
  // longer be collapsed from inside the capture UI.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  panelInitiallyOpen = true,
  title = "",
  busyLabel = "",
}) {
  useBodyModalLock(isOpen);

  // DevLayoutOverlay pass-through: every control stops taking pointer
  // events while the overlay is on, so the technician can inspect layout
  // without firing the shutter. The DEV button inside ConcernPanel opts
  // itself back in so the overlay can always be turned off from inside.
  const devOverlay = useDevLayoutOverlay();
  const passThroughActive = Boolean(devOverlay?.enabled);

  const orientation = useOrientation();
  const compactMode = orientation.screenWidth > 0 && orientation.screenWidth < 500;
  const RIGHT_CONTROLS_WIDTH = getControlsWidth(orientation.screenWidth);
  const PANEL_WIDTH = getPanelWidth(orientation.screenWidth);
  const ZOOM_SLIDER_WIDTH = Math.round(Math.min(RIGHT_CONTROLS_WIDTH - 12, Math.max(34, RIGHT_CONTROLS_WIDTH * 0.52)));
  const ZOOM_SLIDER_HEIGHT = Math.round(Math.min(Math.max(200, orientation.screenHeight * 0.36), 420));

  const [mode, setMode] = useState(initialMode);
  useEffect(() => { setMode(initialMode); }, [initialMode, isOpen]);

  const camera = useDeviceCamera({ isActive: isOpen, mode });

  const [widgets, setWidgets] = useState([]);
  const videoElementRef = useRef(null);

  const recorder = useWidgetRecorder({
    stream: camera.stream,
    videoElement: videoElementRef.current,
    widgets,
    isRecordingMode: mode === "video",
    facingMode: camera.facingMode,
  });

  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setWidgets([]);
    setCapturing(false);
  }, [isOpen]);

  useEffect(() => {
    const el = videoElementRef.current;
    if (!el) return;
    el.srcObject = camera.stream || null;
  }, [camera.stream]);

  // Single-widget mode: only ONE widget ever on-screen. Tapping the row
  // that's already active removes it; tapping a different row replaces
  // the current widget.
  const insertWidgetFromRow = useCallback((row) => {
    setWidgets((current) => {
      const alreadyActive = current.some((entry) => entry.sourceRowId === row.id);
      if (alreadyActive) return [];
      return [{
        id: nextWidgetId(row.kind || "info"),
        sourceRowId: row.id,
        title: row.widget?.title ?? row.label ?? "",
        value: row.widget?.value || row.measurement || row.label || "",
        status: row.widget?.status || row.status || "default",
        x: 0.5,
        y: 0.5,
      }];
    });
  }, []);

  const removeWidget = useCallback((widgetId) => {
    setWidgets((current) => current.filter((entry) => entry.id !== widgetId));
  }, []);

  const activeRowIds = useMemo(() => {
    const set = new Set();
    for (const widget of widgets) {
      if (widget.sourceRowId) set.add(widget.sourceRowId);
    }
    return set;
  }, [widgets]);

  const handleClose = useCallback(() => {
    recorder.cancel();
    camera.stop();
    setWidgets([]);
    onClose?.();
  }, [camera, recorder, onClose]);

  const handlePhotoPress = useCallback(async () => {
    if (!orientation.isLandscape) return;
    if (capturing || !camera.stream) return;
    try {
      setCapturing(true);
      const video = videoElementRef.current;
      if (!video) throw new Error("Camera not ready");
      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (camera.facingMode === "user") {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
      if (!blob) throw new Error("Failed to capture photo");
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
      camera.stop();
      await Promise.resolve(onCapture?.(file, { type: "photo", widgets: [] }));
      onClose?.();
    } catch (err) {
      console.error("Photo capture failed:", err);
      showAlert(buildErrorAlert(
        "Photo capture failed. Please try again.",
        err,
        { component: "FullScreenCapture", action: "handlePhotoPress", facing: camera.facingMode }
      ));
      setCapturing(false);
    }
  }, [camera, capturing, onCapture, onClose, orientation.isLandscape]);

  const handleVideoPress = useCallback(async () => {
    if (!orientation.isLandscape) return;
    if (capturing) return;
    if (!recorder.isRecording) {
      try {
        await recorder.start();
      } catch (err) {
        console.error("Start recording failed:", err);
        showAlert(buildErrorAlert(
          "Could not start recording. Check camera permissions and try again.",
          err,
          { component: "FullScreenCapture", action: "handleVideoPress:start", facing: camera.facingMode }
        ));
      }
      return;
    }
    try {
      setCapturing(true);
      const file = await recorder.stop();
      const frozenWidgets = widgets.map((widget) => ({ ...widget }));
      camera.stop();
      if (file) {
        await Promise.resolve(onCapture?.(file, { type: "video", widgets: frozenWidgets }));
      }
      onClose?.();
    } catch (err) {
      console.error("Stop recording failed:", err);
      showAlert(buildErrorAlert(
        "Recording stopped unexpectedly. The video may not have been saved.",
        err,
        { component: "FullScreenCapture", action: "handleVideoPress:stop", facing: camera.facingMode }
      ));
      setCapturing(false);
    }
  }, [camera, capturing, onCapture, onClose, recorder, widgets, orientation.isLandscape]);

  const handlePauseToggle = useCallback(() => {
    if (!recorder.canPause) return;
    if (recorder.isPaused) recorder.resume(); else recorder.pause();
  }, [recorder]);

  const handleModeChange = useCallback((nextMode) => {
    if (recorder.isRecording) return;
    setMode(nextMode);
  }, [recorder.isRecording]);

  const handleZoomChange = useCallback((value) => {
    camera.applyZoom(value);
  }, [camera]);

  const onShutterPress = mode === "photo" ? handlePhotoPress : handleVideoPress;

  // Stop any in-flight recording when the user rotates back to portrait.
  // The hardware is still rolling a recording it can't save sensibly, so
  // we cancel to keep behaviour predictable when they rotate back.
  useEffect(() => {
    if (!isOpen) return;
    if (!orientation.isLandscape && recorder.isRecording) {
      recorder.cancel();
    }
  }, [isOpen, orientation.isLandscape, recorder]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !recorder.isRecording) handleClose();
      if (event.key === " " && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        onShutterPress?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose, isOpen, onShutterPress, recorder.isRecording]);

  const isLive = mode === "video" && recorder.isRecording;
  const showPanel = Boolean(panel) && orientation.isLandscape;
  const crosshairDimmed = widgets.length > 0;
  const topBarRightOffset = RIGHT_CONTROLS_WIDTH + 12;

  if (!isOpen || typeof document === "undefined") return null;

  let statusLabel = "";
  let statusTone = "default";
  if (recorder.isPaused) { statusLabel = `Paused ${formatDuration(recorder.elapsed)}`; statusTone = "paused"; }
  else if (isLive) { statusLabel = `Rec ${formatDuration(recorder.elapsed)}`; statusTone = "recording"; }

  const recordingLock = recorder.isRecording && !recorder.isPaused;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || "Camera"}
      data-dev-section-key="capture-fullscreen"
      data-dev-section-type="page-shell"
      data-dev-background-token="camera-surface"
      data-capture-passthrough={passThroughActive ? "1" : "0"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-modal)",
        background: "var(--hud-scrim)",
        overflow: "hidden",
        fontFamily: "var(--font-family)",
        pointerEvents: passThroughActive ? "none" : undefined,
      }}
    >
      <style>{"@keyframes hnpWidgetIn { from { opacity: 0; transform: translate(-50%, -45%) scale(0.9); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }"}</style>

      {camera.stream ? (
        <video
          ref={videoElementRef}
          autoPlay
          playsInline
          muted
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            background: "var(--hud-scrim)",
            transform: camera.facingMode === "user" ? "scaleX(-1)" : "none",
          }}
        />
      ) : null}

      <div aria-hidden="true" style={{
        position: "absolute",
        inset: 0,
        background: camera.stream ? "var(--hud-gradient-top-bottom)" : "var(--hud-scrim)",
        pointerEvents: "none",
      }} />

      {orientation.isLandscape ? (
        <div
          data-dev-section-key="capture-area"
          data-dev-section-type="content-card"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
          }}
        >
          <Crosshair dimmed={crosshairDimmed} />

          {widgets.map((widget) => (
            <FloatingWidget key={widget.id} widget={widget} onRemove={removeWidget} />
          ))}

          {allowModeSwitch ? (
            <div
              data-dev-section-key="capture-mode-toggle-wrapper"
              data-dev-section-type="toolbar"
              style={{
                position: "absolute",
                left: "50%",
                bottom: "calc(var(--space-4) + env(safe-area-inset-bottom))",
                transform: "translateX(-50%)",
                pointerEvents: "auto",
                zIndex: 4,
              }}
            >
              <CaptureModeToggle
                mode={mode}
                onChange={handleModeChange}
                disabled={camera.loading || !!camera.error || !camera.permissionGranted || capturing || recorder.isRecording}
                compact={compactMode}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {orientation.isLandscape ? (
        <>
          <div
            data-dev-section-key="capture-top-bar"
            data-dev-section-type="toolbar"
            style={{
              position: "absolute",
              top: "max(var(--space-4), env(safe-area-inset-top))",
              left: "var(--space-4)",
              right: topBarRightOffset,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-3)",
              pointerEvents: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", pointerEvents: "auto" }}>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close camera"
                disabled={recordingLock}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-pill)",
                  border: "none",
                  background: "rgba(var(--accentMainRgb), 0.10)",
                  color: "var(--hud-text)",
                  fontSize: "var(--text-h3)",
                  lineHeight: 1,
                  cursor: recordingLock ? "not-allowed" : "pointer",
                  backdropFilter: "var(--hud-blur)",
                  WebkitBackdropFilter: "var(--hud-blur)",
                  opacity: recordingLock ? 0.4 : 1,
                  fontFamily: "var(--font-family)",
                  transition: "var(--control-transition)",
                }}
              >
                ×
              </button>
              {title ? (
                <span style={{
                  color: "var(--hud-text)",
                  fontWeight: 700,
                  fontSize: "var(--text-body-sm)",
                  letterSpacing: "var(--tracking-wide)",
                  opacity: 0.86,
                  maxWidth: "22vw",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {title}
                </span>
              ) : null}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", pointerEvents: "auto" }}>
              {busyLabel ? (
                <div style={{
                  padding: "var(--space-sm) var(--space-3)",
                  borderRadius: "var(--radius-pill)",
                  background: "var(--accentMain)",
                  color: "var(--onAccentText)",
                  fontSize: "var(--text-caption)",
                  fontWeight: 700,
                  letterSpacing: "var(--tracking-wide)",
                  textTransform: "uppercase",
                }}>
                  {busyLabel}
                </div>
              ) : null}
            </div>
          </div>

          <div style={{
            position: "absolute",
            top: "max(var(--space-4), env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "auto",
            zIndex: 5,
          }}>
            <LevelBar compact={compactMode} statusLabel={statusLabel} statusTone={statusTone} />
          </div>

          <div style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + var(--space-3))",
            right: `${(RIGHT_CONTROLS_WIDTH - ZOOM_SLIDER_WIDTH) / 2}px`,
            width: ZOOM_SLIDER_WIDTH,
            height: ZOOM_SLIDER_HEIGHT,
            pointerEvents: "auto",
            zIndex: 4,
            display: "flex",
            alignItems: "stretch",
          }}>
            <VerticalZoomSlider
              zoomRange={camera.zoomRange}
              zoomValue={camera.zoomValue}
              onChange={handleZoomChange}
              disabled={camera.loading || !camera.permissionGranted}
              sliderWidth={ZOOM_SLIDER_WIDTH}
            />
          </div>

          {showPanel ? (
            <div
              data-dev-section-key="capture-panel-slot"
              data-dev-section-type="sidebar"
              style={{
                position: "absolute",
                left: "var(--space-3)",
                top: "calc(env(safe-area-inset-top, 0px) + 76px)",
                bottom: "calc(env(safe-area-inset-bottom, 0px) + var(--space-4))",
                width: PANEL_WIDTH,
                maxWidth: `calc(100% - var(--space-3) - var(--space-3) - ${RIGHT_CONTROLS_WIDTH}px)`,
                display: "flex",
                alignItems: "stretch",
                pointerEvents: "none",
                zIndex: 2,
              }}
            >
              <ConcernPanel
                tyres={panel?.tyres || []}
                brakes={panel?.brakes || []}
                external={panel?.external || []}
                activeRowIds={activeRowIds}
                onInsertWidget={insertWidgetFromRow}
                isLive={isLive}
              />
            </div>
          ) : null}

          <div
            data-dev-section-key="capture-right-rail"
            data-dev-section-type="sidebar"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: RIGHT_CONTROLS_WIDTH,
              display: "flex",
              alignItems: "stretch",
              pointerEvents: "none",
              zIndex: 3,
            }}
          >
            <CameraControls
              mode={mode}
              isRecording={recorder.isRecording}
              isPaused={recorder.isPaused}
              canPause={recorder.canPause}
              onShutterPress={onShutterPress}
              onPausePress={handlePauseToggle}
              onFlip={camera.flip}
              disabled={camera.loading || !!camera.error || !camera.permissionGranted || capturing}
              compactMode={compactMode}
            />
          </div>
        </>
      ) : null}

      {orientation.isLandscape && !camera.stream ? (() => {
        const status = camera.permissionStatus;
        const needsPrompt = status === "prompt" || status === "unknown";
        const isDenied = status === "denied";
        const isBusy = camera.loading || status === "checking";
        const wantsAudio = mode === "video";
        const promptBody = wantsAudio
          ? "HNPSystem uses your camera and microphone to record this vehicle check. Your browser will ask once — choose Allow and you won't be asked again on this device."
          : "HNPSystem uses your camera to capture this vehicle check. Your browser will ask once — choose Allow and you won't be asked again on this device.";
        const deniedBody = wantsAudio
          ? "Camera or microphone access was blocked. Open your browser's site settings, set Camera and Microphone to Allow for this site, then tap Try again."
          : "Camera access was blocked. Open your browser's site settings, set Camera to Allow for this site, then tap Try again.";
        const isModal = needsPrompt || isDenied;

        return (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-lg)",
            zIndex: 4,
            pointerEvents: "none",
            background: isModal ? "rgba(5, 7, 11, 0.55)" : "transparent",
            backdropFilter: isModal ? "var(--hud-blur)" : undefined,
            WebkitBackdropFilter: isModal ? "var(--hud-blur)" : undefined,
          }}>
            <div
              role={isModal ? "dialog" : undefined}
              aria-modal={isModal ? "true" : undefined}
              aria-labelledby={isModal ? "capture-permission-title" : undefined}
              style={{
                width: isModal ? 420 : WIDGET_OUTLINE_WIDTH,
                maxWidth: "calc(100vw - var(--space-6))",
                minHeight: isModal ? undefined : WIDGET_OUTLINE_HEIGHT,
                padding: isModal ? "var(--space-5)" : "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-md)",
                background: "var(--hud-surface-glass)",
                border: "1px solid var(--hud-divider)",
                boxShadow: "var(--hud-shadow-md)",
                color: "var(--hud-text)",
                textAlign: "center",
                backdropFilter: "var(--hud-blur-strong)",
                WebkitBackdropFilter: "var(--hud-blur-strong)",
                fontFamily: "var(--font-family)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-3)",
                boxSizing: "border-box",
                overflow: "hidden",
                pointerEvents: "auto",
              }}
            >
              {isModal ? (
                <div aria-hidden="true" style={{
                  width: 48,
                  height: 48,
                  borderRadius: "var(--radius-pill)",
                  background: isDenied ? "rgba(var(--danger-rgb), 0.18)" : "rgba(var(--accentMainRgb), 0.18)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "var(--text-h3)",
                  color: isDenied ? "var(--danger)" : "var(--accentMain)",
                }}>
                  {isDenied ? "⚠" : wantsAudio ? "🎥" : "📷"}
                </div>
              ) : null}

              <div
                id={isModal ? "capture-permission-title" : undefined}
                style={{
                  fontSize: isModal ? "var(--text-h3)" : "var(--text-body)",
                  fontWeight: 800,
                  lineHeight: "var(--leading-tight)",
                  color: "var(--hud-text)",
                }}
              >
                {isDenied
                  ? "Camera is blocked"
                  : needsPrompt
                    ? "Camera access needed"
                    : isBusy && camera.loading
                      ? "Opening camera…"
                      : isBusy
                        ? "Checking access…"
                        : "Preparing camera…"}
              </div>

              <div style={{
                fontSize: isModal ? "var(--text-body-sm)" : "var(--text-caption)",
                lineHeight: "var(--leading-normal, 1.45)",
                color: "var(--hud-text-muted)",
                maxWidth: 360,
              }}>
                {isDenied
                  ? deniedBody
                  : needsPrompt
                    ? promptBody
                    : camera.error || "Please wait while the device camera is prepared."}
              </div>

              {needsPrompt ? (
                <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-1)", flexWrap: "wrap", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={handleClose}
                    style={{
                      padding: "var(--space-2) var(--space-4)",
                      borderRadius: "var(--radius-pill)",
                      border: "1px solid var(--hud-border)",
                      background: "var(--hud-surface)",
                      color: "var(--hud-text)",
                      fontWeight: 700,
                      fontSize: "var(--text-body-sm)",
                      cursor: "pointer",
                      fontFamily: "var(--font-family)",
                      transition: "var(--control-transition)",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => camera.requestPermission?.()}
                    style={{
                      padding: "var(--space-2) var(--space-4)",
                      borderRadius: "var(--radius-pill)",
                      border: "1px solid rgba(var(--accentMainRgb), 0.6)",
                      background: "var(--accentMain)",
                      color: "var(--onAccentText)",
                      fontWeight: 800,
                      fontSize: "var(--text-body-sm)",
                      letterSpacing: "var(--tracking-wide)",
                      cursor: "pointer",
                      fontFamily: "var(--font-family)",
                      transition: "var(--control-transition)",
                      boxShadow: "0 2px 12px rgba(var(--accentMainRgb), 0.35)",
                    }}
                  >
                    {wantsAudio ? "Allow camera & mic" : "Allow camera"}
                  </button>
                </div>
              ) : isDenied ? (
                <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-1)", flexWrap: "wrap", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={handleClose}
                    style={{
                      padding: "var(--space-2) var(--space-4)",
                      borderRadius: "var(--radius-pill)",
                      border: "1px solid var(--hud-border)",
                      background: "var(--hud-surface)",
                      color: "var(--hud-text)",
                      fontWeight: 700,
                      fontSize: "var(--text-body-sm)",
                      cursor: "pointer",
                      fontFamily: "var(--font-family)",
                      transition: "var(--control-transition)",
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => camera.requestPermission?.()}
                    style={{
                      padding: "var(--space-2) var(--space-4)",
                      borderRadius: "var(--radius-pill)",
                      border: "1px solid rgba(var(--accentMainRgb), 0.6)",
                      background: "var(--accentMain)",
                      color: "var(--onAccentText)",
                      fontWeight: 800,
                      fontSize: "var(--text-body-sm)",
                      letterSpacing: "var(--tracking-wide)",
                      cursor: "pointer",
                      fontFamily: "var(--font-family)",
                      transition: "var(--control-transition)",
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })() : null}

      {!orientation.isLandscape ? (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-lg)",
          zIndex: 999,
          background: "var(--overlay)",
          backdropFilter: "var(--hud-blur)",
          WebkitBackdropFilter: "var(--hud-blur)",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}>
          <div style={{
            width: WIDGET_OUTLINE_WIDTH,
            height: WIDGET_OUTLINE_HEIGHT,
            maxWidth: "calc(100vw - var(--space-6))",
            padding: "var(--space-2) var(--space-4)",
            borderRadius: "var(--radius-md)",
            background: "var(--hud-surface-glass)",
            border: "1px solid var(--hud-divider)",
            boxShadow: "var(--hud-shadow-md)",
            color: "var(--hud-text)",
            textAlign: "center",
            backdropFilter: "var(--hud-blur-strong)",
            WebkitBackdropFilter: "var(--hud-blur-strong)",
            fontFamily: "var(--font-family)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            boxSizing: "border-box",
            overflow: "hidden",
          }}>
            <div style={{ fontSize: "var(--text-h3)", opacity: 0.85, lineHeight: 1 }}>📱</div>
            <div style={{ fontSize: "var(--text-body)", fontWeight: 800, color: "var(--hud-text)", lineHeight: "var(--leading-tight)" }}>
              Rotate Device
            </div>
            <div style={{ fontSize: "var(--text-caption)", lineHeight: "var(--leading-tight)", color: "var(--hud-text-muted)" }}>
              Landscape orientation required
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--hud-border)",
              background: "var(--hud-surface)",
              color: "var(--hud-text)",
              fontSize: "var(--text-caption)",
              fontWeight: 700,
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "var(--font-family)",
              transition: "var(--control-transition)",
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {recorder.recorderError ? (
        <div
          role="alert"
          style={{
            position: "absolute",
            left: "var(--space-md)",
            right: `calc(var(--space-md) + ${RIGHT_CONTROLS_WIDTH}px)`,
            bottom: "calc(var(--space-md) + env(safe-area-inset-bottom))",
            padding: "var(--space-2) var(--space-4)",
            borderRadius: "var(--radius-sm)",
            background: "var(--danger)",
            color: "var(--onAccentText)",
            fontSize: "var(--text-caption)",
            fontWeight: 700,
            textAlign: "center",
            boxShadow: "var(--hud-shadow-md)",
            zIndex: 4,
            fontFamily: "var(--font-family)",
          }}
        >
          {recorder.recorderError}
        </div>
      ) : null}
    </div>,
    document.body
  );
}
