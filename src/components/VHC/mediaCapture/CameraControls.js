// file location: src/components/VHC/mediaCapture/CameraControls.js
// Right-hand vertical control stack shown over the full-screen camera.
// Contains the shutter (context-aware for photo vs video), a separate
// pause button for recording, a flip/reverse camera button, and a
// compact zoom stack. All targets are sized for gloved/one-handed use.

import React from "react"; // React primitive

// Shared style for the round "chip" buttons (flip/pause/discrete lens).
const chipStyle = {
  width: 52, // Large touch target
  height: 52, // Circle
  borderRadius: 999, // Full pill/circle
  border: "1px solid rgba(255,255,255,0.18)", // Subtle edge
  background: "rgba(15, 23, 42, 0.6)", // Dark translucent surface
  color: "#fff", // White icon colour
  fontSize: 16, // Readable glyph
  fontWeight: 700, // Bold
  display: "inline-flex", // Centre icon
  alignItems: "center", // Vertical centre
  justifyContent: "center", // Horizontal centre
  backdropFilter: "blur(10px)", // Glass effect
  cursor: "pointer", // Tappable feel
  transition: "transform 120ms ease", // Press animation
};

// Small utility: merge inline styles without nesting.
function mergeStyle(...styles) { return Object.assign({}, ...styles); } // Flatten styles

// Chip button with disabled handling.
function Chip({ children, onClick, ariaLabel, disabled = false, highlight = false, testId }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={mergeStyle(chipStyle, { // Apply base + modifiers
        opacity: disabled ? 0.4 : 1, // Fade when disabled
        cursor: disabled ? "not-allowed" : "pointer", // Match cursor to state
        borderColor: highlight ? "#ef4444" : chipStyle.border.replace(/^.*?, /, ""), // Highlight red when paused
        background: highlight ? "rgba(239, 68, 68, 0.18)" : chipStyle.background, // Highlight fill
      })}
    >
      {children}
    </button>
  );
}

// The main shutter button. Appearance changes with capture mode + recording state.
function ShutterButton({ mode, isRecording, isPaused, onPress, disabled }) {
  // For the icon's inner shape:
  const innerShape = mode === "photo"
    ? { size: 42, radius: 999, colour: "#fff" } // White disc for photo
    : isRecording
      ? { size: 22, radius: 6, colour: "#ef4444" } // Red square while recording (stop)
      : { size: 40, radius: 999, colour: "#ef4444" }; // Red disc when idle video

  // Outer ring colour subtly shifts to signal state.
  const ringColour = isRecording ? "rgba(239, 68, 68, 0.9)" : "rgba(255,255,255,0.95)";

  return (
    <button
      type="button"
      aria-label={mode === "photo" ? "Take photo" : isRecording ? "Stop recording" : "Start recording"}
      onClick={onPress}
      disabled={disabled}
      style={{
        width: 82, // Large shutter
        height: 82, // Circle
        borderRadius: 999, // Full circle
        border: `4px solid ${ringColour}`, // Outer ring
        background: "rgba(15, 23, 42, 0.35)", // Glassy inside
        display: "inline-flex", // Centre inner shape
        alignItems: "center", // Vertical centre
        justifyContent: "center", // Horizontal centre
        cursor: disabled ? "not-allowed" : "pointer", // Match cursor
        opacity: disabled ? 0.5 : 1, // Disabled fade
        boxShadow: "0 16px 40px rgba(0,0,0,0.38)", // Elevated look
        transition: "border-color 180ms ease", // Smooth ring colour change
      }}
    >
      <span
        style={{
          width: innerShape.size, // Inner shape width
          height: innerShape.size, // Inner shape height
          borderRadius: innerShape.radius, // Circle or square
          background: innerShape.colour, // Inner colour
          display: "block", // Solid block
          transition: "all 180ms ease", // Smooth morph when state changes
          opacity: isPaused ? 0.6 : 1, // Dim when paused
        }}
      />
    </button>
  );
}

// Tiny discrete zoom stepper shown when the lens has no continuous zoom.
function DiscreteLensStack({ lenses, selectedDeviceId, onSelect, disabled }) {
  if (!lenses || lenses.length <= 1) return null; // Not worth showing for a single lens
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {lenses.map((lens) => {
        const active = lens.deviceId === selectedDeviceId; // Highlight the active lens
        return (
          <button
            key={lens.deviceId || lens.label}
            type="button"
            aria-label={`Switch to ${lens.label} lens`}
            disabled={disabled}
            onClick={() => onSelect?.(lens.deviceId)}
            style={{
              minWidth: 44, // Consistent width
              height: 36, // Compact pill height
              padding: "0 10px", // Breathing room
              borderRadius: 999, // Pill
              border: "1px solid rgba(255,255,255,0.16)", // Thin edge
              background: active ? "#fff" : "rgba(15, 23, 42, 0.55)", // Flip colour when active
              color: active ? "#0f172a" : "#fff", // Flip text colour when active
              fontSize: 12, // Small pill label
              fontWeight: 800, // Bold
              cursor: disabled ? "not-allowed" : "pointer", // Cursor state
              opacity: disabled ? 0.5 : 1, // Dim when disabled
              backdropFilter: "blur(10px)", // Glass
            }}
          >
            {lens.label}
          </button>
        );
      })}
    </div>
  );
}

// Continuous zoom slider shown when the browser exposes a zoom range.
function ZoomSlider({ zoomRange, zoomValue, onChange, disabled }) {
  if (!zoomRange) return null; // Nothing to show if not supported
  return (
    <div style={{ display: "grid", gap: 6, padding: "8px 10px", borderRadius: 14, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        <span>Zoom</span>
        <span>{`${zoomValue.toFixed(zoomValue < 1 ? 1 : Number.isInteger(zoomValue) ? 0 : 1)}x`}</span>
      </div>
      <input
        type="range"
        min={zoomRange.min}
        max={zoomRange.max}
        step={zoomRange.max > 3 ? 0.05 : 0.01}
        value={zoomValue}
        onChange={(event) => onChange?.(Number(event.target.value))}
        disabled={disabled}
        style={{ width: 140, height: 20, accentColor: "#38bdf8" }}
      />
    </div>
  );
}

// Mode toggle between Photo and Video. Rendered inside the control stack.
function ModeToggle({ mode, onChange, disabled }) {
  const options = [ // Just two entries
    { id: "photo", label: "Photo" }, // Photo mode
    { id: "video", label: "Video" }, // Video mode
  ];
  return (
    <div
      style={{
        display: "inline-flex", // Horizontal pill group
        padding: 4, // Inside padding around the active pill
        borderRadius: 999, // Full pill
        border: "1px solid rgba(255,255,255,0.12)", // Subtle edge
        background: "rgba(15,23,42,0.6)", // Dark surface
        backdropFilter: "blur(12px)", // Glass
        gap: 4, // Breathing room between options
      }}
    >
      {options.map((option) => {
        const active = option.id === mode; // Which one is currently selected
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => !disabled && onChange?.(option.id)}
            disabled={disabled}
            style={{
              minWidth: 64, // Wide tap target
              height: 34, // Pill height
              borderRadius: 999, // Pill
              border: "none", // Remove default
              background: active ? "#fff" : "transparent", // Flip when active
              color: active ? "#0f172a" : "#fff", // Flip colour when active
              fontSize: 12, // Compact label
              fontWeight: 800, // Heavy emphasis
              letterSpacing: "0.04em", // Small spacing
              cursor: disabled ? "not-allowed" : "pointer", // Cursor state
              opacity: disabled ? 0.5 : 1, // Dim when disabled
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function CameraControls({
  mode, // "photo" | "video"
  onModeChange, // (nextMode) => void
  isRecording, // boolean — currently capturing
  isPaused, // boolean — currently paused
  canPause, // boolean — browser supports pause
  onShutterPress, // () => void — the main shutter
  onPausePress, // () => void — separate pause/resume button
  onFlip, // () => void — flip front/rear
  onZoomChange, // (value) => void — continuous zoom
  onLensSelect, // (deviceId) => void — discrete lens pick
  zoomRange, // capabilities.zoom or null
  zoomValue, // current zoom
  lenses, // discrete lens list
  selectedDeviceId, // active device id
  disabled, // global disabled flag (during loading etc.)
}) {
  const isVideo = mode === "video"; // Convenience flag

  return (
    <div
      style={{
        pointerEvents: "auto", // Children need to receive clicks
        height: "100%", // Fill the capture height
        display: "flex", // Vertical stack
        flexDirection: "column", // Stack top-to-bottom
        alignItems: "center", // Horizontal centre within the sidebar
        justifyContent: "space-between", // Push zoom to top, shutter block to bottom
        padding: "18px 10px calc(20px + env(safe-area-inset-bottom)) 10px", // Safe area aware
        gap: 14, // General spacing between groups
        width: 96, // Fixed sidebar width
      }}
    >
      {/* Zoom region (top of the stack) */}
      <div style={{ display: "grid", gap: 10, alignItems: "start" }}>
        <ZoomSlider // Continuous zoom (when supported)
          zoomRange={zoomRange}
          zoomValue={zoomValue}
          onChange={onZoomChange}
          disabled={disabled}
        />
        <DiscreteLensStack // Discrete lens buttons (multi-lens rigs)
          lenses={lenses}
          selectedDeviceId={selectedDeviceId}
          onSelect={onLensSelect}
          disabled={disabled || isRecording}
        />
      </div>

      {/* Primary action cluster — mode toggle, shutter, pause, flip */}
      <div style={{ display: "grid", gap: 14, justifyItems: "center" }}>
        <ModeToggle mode={mode} onChange={onModeChange} disabled={disabled || isRecording} />

        <ShutterButton
          mode={mode}
          isRecording={isRecording}
          isPaused={isPaused}
          onPress={onShutterPress}
          disabled={disabled}
        />

        {isVideo && isRecording ? (
          <Chip
            ariaLabel={isPaused ? "Resume recording" : "Pause recording"}
            onClick={onPausePress}
            disabled={disabled || !canPause} // Disable if the browser doesn't support pause
            highlight={isPaused} // Red outline when paused
            testId="capture-pause"
          >
            {isPaused ? "▶" : "❚❚"}
          </Chip>
        ) : null}

        <Chip
          ariaLabel="Switch camera"
          onClick={onFlip}
          disabled={disabled || isRecording}
        >
          ⇄
        </Chip>
      </div>
    </div>
  );
}
