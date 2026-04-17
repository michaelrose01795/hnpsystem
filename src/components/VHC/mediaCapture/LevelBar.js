import React, { useEffect, useRef, useState } from "react";

// ─── constants ────────────────────────────────────────────────────────────────
const TILT_RANGE    = 15;    // degrees clamped on each side of centre
const LEVEL_EPSILON = 0.5;   // ≤ this → green / "level"
const NEAR_LEVEL    = 3;     // ≤ this → amber; above → red
const SMOOTHING     = 0.35;  // exponential weight (0 = instant, 1 = frozen)

// Tick marks: drawn symmetrically; major ticks are taller
const TICKS = [
  { deg:  3, major: false }, { deg:  -3, major: false },
  { deg:  6, major: true  }, { deg:  -6, major: true  },
  { deg:  9, major: false }, { deg:  -9, major: false },
  { deg: 12, major: true  }, { deg: -12, major: true  },
];

// Visual level zone: ±1.5° of centre (3× epsilon) — wider than the actual
// epsilon so the target is legible but the green state still feels earned.
const ZONE_LEFT_PCT  = 45;
const ZONE_WIDTH_PCT = 10;

// ─── helpers ─────────────────────────────────────────────────────────────────
function readScreenAngle() {
  if (typeof window === "undefined") return 0;
  const a = window.screen?.orientation?.angle;
  if (typeof a === "number" && !isNaN(a)) return a;
  if (typeof window.orientation === "number") return window.orientation;
  return 0;
}

function normaliseAngle(a) {
  let v = Number(a) || 0;
  while (v >  180) v -= 360;
  while (v < -180) v += 360;
  return v;
}

function computeScreenTilt(beta, gamma, screenAngle) {
  const g = Number(gamma) || 0;
  // gamma always equals 0 when the camera frame is level regardless of device
  // pitch — it measures roll around the optical axis directly. Sign flips for
  // the two "upside-down" orientations (180° and 270°).
  switch (((screenAngle % 360) + 360) % 360) {
    case 90:  return normaliseAngle(g);
    case 180: return normaliseAngle(-g);
    case 270: return normaliseAngle(-g);
    default:  return normaliseAngle(g);
  }
}

function tiltToPos(deg) {
  const c = Math.max(-TILT_RANGE, Math.min(TILT_RANGE, Number(deg) || 0));
  return 0.5 + c / (2 * TILT_RANGE);
}

function tiltColor(tilt) {
  const a = Math.abs(tilt);
  if (a <= LEVEL_EPSILON) return "var(--success)";
  if (a <= NEAR_LEVEL)    return "var(--warning)";
  return "var(--danger)";
}

const STATUS_BG = {
  recording: "rgba(var(--danger-rgb),  0.92)",
  paused:    "rgba(var(--warning-rgb), 0.92)",
  default:   "var(--hud-surface)",
};

// ─── component ───────────────────────────────────────────────────────────────
export default function LevelBar({
  compact     = false,
  statusLabel = "",
  statusTone  = "default",
}) {
  const [tilt, setTilt]           = useState(0);
  const [supported, setSupported] = useState(false);
  const angleRef    = useRef(0);
  const smoothedRef = useRef(0);
  const handlerRef  = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncAngle = () => { angleRef.current = readScreenAngle(); };
    syncAngle();

    const oriTarget = window.screen?.orientation;
    oriTarget?.addEventListener?.("change", syncAngle);
    window.addEventListener("orientationchange", syncAngle);

    if (typeof window.DeviceOrientationEvent === "undefined") {
      return () => {
        oriTarget?.removeEventListener?.("change", syncAngle);
        window.removeEventListener("orientationchange", syncAngle);
      };
    }

    const maybeRequest =
      typeof window.DeviceOrientationEvent.requestPermission === "function"
        ? window.DeviceOrientationEvent.requestPermission().catch(() => "denied")
        : Promise.resolve("granted");

    let cancelled = false;
    maybeRequest.then((state) => {
      if (cancelled || state !== "granted") return;
      const handler = (e) => {
        const raw  = computeScreenTilt(e.beta, e.gamma, angleRef.current);
        const next = smoothedRef.current + (1 - SMOOTHING) * (raw - smoothedRef.current);
        smoothedRef.current = next;
        setSupported(true);
        setTilt(next);
      };
      handlerRef.current = handler;
      window.addEventListener("deviceorientation", handler, true);
    });

    return () => {
      cancelled = true;
      if (handlerRef.current) {
        window.removeEventListener("deviceorientation", handlerRef.current, true);
        handlerRef.current = null;
      }
      oriTarget?.removeEventListener?.("change", syncAngle);
      window.removeEventListener("orientationchange", syncAngle);
    };
  }, []);

  // ── derived state ──────────────────────────────────────────────────────────
  const pos      = tiltToPos(tilt);
  const color    = tiltColor(tilt);
  const isLevel  = Math.abs(tilt) <= LEVEL_EPSILON;
  const isActive = statusTone !== "default"; // recording or paused
  const bg       = STATUS_BG[statusTone] ?? STATUS_BG.default;
  const trackW   = compact ? 120 : 150;
  const pad      = compact ? "var(--space-1) var(--space-2)" : "var(--space-sm) var(--space-3)";
  const gap      = compact ? "var(--space-1)" : "var(--space-sm)";

  return (
    <div
      data-dev-section-key="capture-level"
      data-dev-section-type="status-pill"
      aria-label={statusLabel ? `Recording status: ${statusLabel}` : "Device level"}
      style={{
        display:              "flex",
        alignItems:           "center",
        gap,
        padding:              pad,
        borderRadius:         "var(--radius-pill)",
        background:           bg,
        border:               `1px solid ${isLevel && !isActive
                                ? "rgba(34,197,94,0.40)"
                                : "var(--hud-divider)"}`,
        backdropFilter:       "var(--hud-blur)",
        WebkitBackdropFilter: "var(--hud-blur)",
        color:                "var(--hud-text)",
        fontSize:             "var(--text-caption)",
        fontWeight:           700,
        letterSpacing:        "var(--tracking-caps)",
        textTransform:        "uppercase",
        pointerEvents:        "none",
        fontFamily:           "var(--font-family)",
        transition:           "background var(--duration-normal) var(--ease-default), border-color 0.3s ease",
      }}
    >
      {/* ── label / recording status ──────────────────────────────────────── */}
      <span style={{
        display:            "flex",
        alignItems:         "center",
        gap:                5,
        opacity:            isActive ? 1 : 0.85,
        whiteSpace:         "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}>
        {isActive && (
          <span
            aria-hidden="true"
            style={{
              display:      "inline-block",
              width:        6,
              height:       6,
              borderRadius: "50%",
              flexShrink:   0,
              background:   statusTone === "recording" ? "var(--danger)" : "var(--warning)",
            }}
          />
        )}
        {statusLabel || "Level"}
      </span>

      {/* ── level track ───────────────────────────────────────────────────── */}
      <div style={{
        position:     "relative",
        width:        trackW,
        height:       4,
        borderRadius: "var(--radius-pill)",
        background:   "var(--hud-rail)",
        flexShrink:   0,
        overflow:     "visible",
      }}>
        {/* Green zone — marks the ±1.5° target window */}
        <span aria-hidden="true" style={{
          position:      "absolute",
          top:           0,
          left:          `${ZONE_LEFT_PCT}%`,
          width:         `${ZONE_WIDTH_PCT}%`,
          height:        "100%",
          borderRadius:  "var(--radius-pill)",
          background:    "rgba(34,197,94,0.40)",
          pointerEvents: "none",
        }} />

        {/* Tick marks — visual scale reference */}
        {TICKS.map(({ deg, major }) => (
          <span key={deg} aria-hidden="true" style={{
            position:   "absolute",
            left:       `${tiltToPos(deg) * 100}%`,
            top:        "50%",
            width:      1,
            height:     major ? 10 : 6,
            background: "rgba(var(--hud-text-rgb),0.22)",
            transform:  "translate(-50%,-50%)",
          }} />
        ))}

        {/* Centre mark — glows green when the frame is level */}
        <span aria-hidden="true" style={{
          position:   "absolute",
          left:       "50%",
          top:        "50%",
          width:      2,
          height:     14,
          background: supported && isLevel
            ? color
            : "rgba(var(--hud-text-rgb),0.50)",
          transform:  "translate(-50%,-50%)",
          transition: "background 0.3s ease",
        }} />

        {/* Sliding bubble */}
        <span aria-hidden="true" style={{
          position:     "absolute",
          top:          "50%",
          left:         `${pos * 100}%`,
          width:        12,
          height:       12,
          borderRadius: "var(--radius-pill)",
          transform:    "translate(-50%,-50%)",
          background:   supported ? color : "rgba(var(--hud-text-rgb),0.28)",
          boxShadow:    supported && isLevel
            ? "0 0 6px 2px rgba(34,197,94,0.55), var(--hud-shadow-md)"
            : "var(--hud-shadow-md)",
          transition:   "left 80ms linear, background 200ms ease, box-shadow 200ms ease",
          zIndex:       1,
        }} />
      </div>

      {/* ── degree readout ────────────────────────────────────────────────── */}
      <span style={{
        minWidth:           32,
        textAlign:          "right",
        fontVariantNumeric: "tabular-nums",
        letterSpacing:      0,
        textTransform:      "none",
        fontWeight:         supported && isLevel ? 800 : 700,
        color:              supported
          ? (isLevel ? "var(--success)" : "var(--hud-text)")
          : "var(--hud-text-dim)",
        transition:         "color 0.2s ease",
      }}>
        {supported ? `${Math.abs(tilt).toFixed(1)}°` : "—"}
      </span>
    </div>
  );
}
