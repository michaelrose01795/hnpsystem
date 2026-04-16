// file location: src/components/VHC/mediaCapture/CameraControls.js
// Right-hand vertical control stack shown over the full-screen camera.
// Contains the shutter (context-aware for photo vs video), a separate
// pause button for recording, and a flip/reverse camera button.
//
// Zoom lives in VerticalZoomSlider. The Photo/Video mode toggle is
// exported and rendered inside the capture area by FullScreenCapture
// so it feels part of the shot rather than an edge control.
//
// All colour / radius / size / timing values resolve through the
// --hud-* and --space / --radius / --duration tokens in theme.css so
// the control follows the user's selected design system automatically.

import React from "react";

const CHIP_BASE = {
  borderRadius: "var(--radius-pill)",
  border: "1px solid var(--hud-border)",
  background: "var(--hud-surface)",
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

function mergeStyle(...styles) { return Object.assign({}, ...styles); }

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
      style={mergeStyle(CHIP_BASE, {
        width: size,
        height: size,
        fontSize,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        borderColor: highlight ? "var(--danger)" : "var(--hud-border)",
        background: highlight ? "rgba(var(--danger-rgb), 0.22)" : "var(--hud-surface)",
      })}
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
      <span
        style={{
          width: innerShape.size,
          height: innerShape.size,
          borderRadius: innerShape.radius,
          background: innerShape.colour,
          display: "block",
          transition: "all var(--duration-normal) var(--ease-default)",
          opacity: isPaused ? 0.6 : 1,
        }}
      />
    </button>
  );
}

export default function CameraControls({
  mode,
  isRecording,
  isPaused,
  canPause,
  onShutterPress,
  onPausePress,
  onFlip,
  disabled,
  screenWidth,
}) {
  const isVideo = mode === "video";
  const compactMode = screenWidth && screenWidth < 500;

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
        <ShutterButton
          mode={mode}
          isRecording={isRecording}
          isPaused={isPaused}
          onPress={onShutterPress}
          disabled={disabled}
          compactMode={compactMode}
        />

        {isVideo && isRecording ? (
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
        ) : null}

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

// Photo / Video mode toggle — rendered inside the capture area by
// FullScreenCapture. Uses the same HUD tokens so it visually matches
// every other piece of overlay chrome.
export function CaptureModeToggle({ mode, onChange, disabled, compact = false }) {
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
        border: "1px solid var(--hud-border)",
        background: "var(--hud-surface)",
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
