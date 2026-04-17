// file location: src/components/VHC/mediaCapture/LevelBar.js
// Compact horizontal level bar shown in the capture top bar. Uses the
// device's `deviceorientation` event when available (after permission
// prompting on iOS) and falls back to a static zero-tilt indicator
// when the API isn't accessible.
//
// Also doubles as the recording-status surface. When a `statusLabel`
// is provided (e.g. "Rec 00:03" / "Paused 00:02") it replaces the
// default "LEVEL" caption so there's one compact HUD pill in the top
// bar instead of a second floating pill competing for space.
//
// All colour / radius / spacing / typography values resolve through
// the --hud-*, --space, --radius, --duration, --tracking-* and status
// tokens in theme.css so the pill follows the user's theme.

import React, { useEffect, useRef, useState } from "react";

const TILT_RANGE_DEGREES = 12;
const LEVEL_EPSILON_DEGREES = 0.5;
const SMOOTHING = 0.35;

function readScreenAngle() {
  if (typeof window === "undefined") return 0;
  const screenAngle = window.screen?.orientation?.angle;
  if (typeof screenAngle === "number") return screenAngle;
  if (typeof window.orientation === "number") return window.orientation;
  return 0;
}

function normaliseAngle(angle) {
  let value = Number(angle) || 0;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

function computeScreenTilt(beta, gamma, screenAngle) {
  const b = Number(beta) || 0;
  const g = Number(gamma) || 0;
  // In portrait (0°/180°), gamma directly measures camera roll.
  // In landscape (90°/270°), the device is upright when beta≈90°, so roll
  // is the deviation of beta from that baseline — not raw beta.
  switch (((screenAngle % 360) + 360) % 360) {
    case 90:  return normaliseAngle(90 - b);
    case 180: return normaliseAngle(-g);
    case 270: return normaliseAngle(b - 90);
    case 0:
    default:  return normaliseAngle(g);
  }
}

function tiltToPosition(tiltDegrees) {
  const clamped = Math.max(-TILT_RANGE_DEGREES, Math.min(TILT_RANGE_DEGREES, Number(tiltDegrees) || 0));
  return 0.5 + clamped / (2 * TILT_RANGE_DEGREES);
}

const STATUS_TONE_BG = {
  recording: "rgba(var(--danger-rgb), 0.92)",
  paused: "rgba(var(--warning-rgb), 0.92)",
  default: "var(--hud-surface)",
};

export default function LevelBar({ compact = false, statusLabel = "", statusTone = "default" }) {
  const [tilt, setTilt] = useState(0);
  const [supported, setSupported] = useState(false);
  const handlerRef = useRef(null);
  const angleRef = useRef(0);
  const smoothedRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncAngle = () => { angleRef.current = readScreenAngle(); };
    syncAngle();

    const orientationTarget = window.screen?.orientation;
    if (orientationTarget && typeof orientationTarget.addEventListener === "function") {
      orientationTarget.addEventListener("change", syncAngle);
    }
    window.addEventListener("orientationchange", syncAngle);

    if (typeof window.DeviceOrientationEvent === "undefined") {
      return () => {
        if (orientationTarget && typeof orientationTarget.removeEventListener === "function") {
          orientationTarget.removeEventListener("change", syncAngle);
        }
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
      const handler = (event) => {
        const raw = computeScreenTilt(event.beta, event.gamma, angleRef.current);
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
      if (orientationTarget && typeof orientationTarget.removeEventListener === "function") {
        orientationTarget.removeEventListener("change", syncAngle);
      }
      window.removeEventListener("orientationchange", syncAngle);
    };
  }, []);

  const position = tiltToPosition(tilt);
  const isLevel = Math.abs(tilt) < LEVEL_EPSILON_DEGREES;

  const toneBackground = STATUS_TONE_BG[statusTone] || STATUS_TONE_BG.default;
  const leadingText = statusLabel || "Level";
  const trackWidth = compact ? 110 : 140;

  return (
    <div
      data-dev-section-key="capture-level"
      data-dev-section-type="status-pill"
      aria-label={statusLabel ? `Recording status: ${statusLabel}` : "Device level"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? "var(--space-1)" : "var(--space-sm)",
        padding: compact ? "var(--space-1) var(--space-2)" : "var(--space-sm) var(--space-3)",
        borderRadius: "var(--radius-pill)",
        background: toneBackground,
        border: "1px solid var(--hud-divider)",
        backdropFilter: "var(--hud-blur)",
        WebkitBackdropFilter: "var(--hud-blur)",
        color: "var(--hud-text)",
        fontSize: "var(--text-caption)",
        fontWeight: 800,
        letterSpacing: "var(--tracking-caps)",
        textTransform: "uppercase",
        pointerEvents: "none",
        fontFamily: "var(--font-family)",
        transition: "background var(--duration-normal) var(--ease-default)",
      }}
    >
      <span
        style={{
          opacity: statusLabel ? 1 : 0.85,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {leadingText}
      </span>
      <div
        style={{
          position: "relative",
          width: trackWidth,
          height: 4,
          borderRadius: "var(--radius-pill)",
          background: "var(--hud-rail)",
          overflow: "hidden",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: -3,
            width: 2,
            height: 10,
            background: "rgba(var(--hud-text-rgb), 0.4)",
            transform: "translateX(-50%)",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: `${position * 100}%`,
            width: 14,
            height: 14,
            borderRadius: "var(--radius-pill)",
            transform: "translate(-50%, -50%)",
            background: isLevel ? "var(--success)" : "var(--warning)",
            boxShadow: "var(--hud-shadow-md)",
            transition: "left 80ms linear, background-color var(--duration-normal) var(--ease-default)",
          }}
        />
      </div>
      <span style={{ minWidth: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {supported ? `${tilt.toFixed(1)}°` : "—"}
      </span>
    </div>
  );
}
