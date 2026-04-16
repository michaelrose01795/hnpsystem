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

// Chip button with disabled handling - responsive sizing
function Chip({ children, onClick, ariaLabel, disabled = false, highlight = false, testId, compactMode = false }) {
  const size = compactMode ? 44 : 52;
  const fontSize = compactMode ? 14 : 16;
  
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={mergeStyle(chipStyle, { // Apply base + modifiers
        width: size,
        height: size,
        fontSize: fontSize,
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
function ShutterButton({ mode, isRecording, isPaused, onPress, disabled, compactMode = false }) {
  const shutterSize = compactMode ? 70 : 82;
  const ringSize = compactMode ? 4 : 4;
  
  // For the icon's inner shape:
  const innerShape = mode === "photo"
    ? { size: compactMode ? 36 : 42, radius: 999, colour: "#fff" } // White disc for photo
    : isRecording
      ? { size: compactMode ? 18 : 22, radius: 6, colour: "#ef4444" } // Red square while recording (stop)
      : { size: compactMode ? 34 : 40, radius: 999, colour: "#ef4444" }; // Red disc when idle video

  // Outer ring colour subtly shifts to signal state.
  const ringColour = isRecording ? "rgba(239, 68, 68, 0.9)" : "rgba(255,255,255,0.95)";

  return (
    <button
      type="button"
      aria-label={mode === "photo" ? "Take photo" : isRecording ? "Stop recording" : "Start recording"}
      onClick={onPress}
      disabled={disabled}
      style={{
        width: shutterSize, // Responsive shutter
        height: shutterSize, // Circle
        borderRadius: 999, // Full circle
        border: `${ringSize}px solid ${ringColour}`, // Outer ring
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

// Zoom control removed from CameraControls: zoom is now handled
// centrally by the `VerticalZoomSlider` component to avoid duplicates.

// Mode toggle between Photo and Video. Rendered inside the control stack.
function ModeToggle({ mode, onChange, disabled, compactMode = false }) {
  // Even more optimized sizing
  const minWidth = compactMode ? 50 : 58;
  const height = compactMode ? 28 : 32;
  const fontSize = compactMode ? 10 : 11;
  const padding = compactMode ? "0 8px" : "0 10px";
  
  const options = [ // Just two entries
    { id: "photo", label: "Photo" }, // Photo mode
    { id: "video", label: "Video" }, // Video mode
  ];
  return (
    <div
      style={{
        display: "inline-flex", // Horizontal pill group
        padding: 3, // Inside padding around the active pill
        borderRadius: 999, // Full pill
        border: "1px solid rgba(255,255,255,0.12)", // Subtle edge
        background: "rgba(15,23,42,0.6)", // Dark surface
        backdropFilter: "blur(12px)", // Glass
        gap: 3, // Breathing room between options
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
              minWidth: minWidth, // Responsive tap target
              height: height, // Responsive pill height
              padding: padding, // Responsive inner padding
              borderRadius: 999, // Pill
              border: "none", // Remove default
              background: active ? "#fff" : "transparent", // Flip when active
              color: active ? "#0f172a" : "#fff", // Flip colour when active
              fontSize: fontSize, // Responsive label
              fontWeight: 800, // Heavy emphasis
              letterSpacing: "0.03em", // Small spacing
              cursor: disabled ? "not-allowed" : "pointer", // Cursor state
              opacity: disabled ? 0.5 : 1, // Dim when disabled
              transition: "all 120ms ease",
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
  screenWidth, // screen width for responsive layout
}) {
  const isVideo = mode === "video"; // Convenience flag
  // Use compact mode on small screens
  const compactMode = screenWidth && screenWidth < 500; // Phones < 500px wide

  return (
    <div
      style={{
        pointerEvents: "auto", // Children need to receive clicks
        height: "100%", // Fill the capture height
        display: "flex", // Vertical stack
        flexDirection: "column", // Stack top-to-bottom
        alignItems: "center", // Horizontal centre within the sidebar
        justifyContent: "space-between", // Push controls apart
        padding: compactMode 
          ? "12px 8px calc(16px + env(safe-area-inset-bottom)) 8px"
          : "18px 10px calc(20px + env(safe-area-inset-bottom)) 10px", // Responsive padding
        gap: compactMode ? 10 : 14, // Responsive spacing
        width: "100%", // Fill available width
      }}
    >
      {/* Top: Discrete lens buttons (multi-lens rigs) */}
      <div style={{ display: "grid", gap: 8, alignItems: "start" }}>
        <DiscreteLensStack // Discrete lens buttons (multi-lens rigs)
          lenses={lenses}
          selectedDeviceId={selectedDeviceId}
          onSelect={onLensSelect}
          disabled={disabled || isRecording}
        />
      </div>

      {/* Middle: Primary action cluster — shutter, pause, and flip */}
      <div style={{ display: "grid", gap: compactMode ? 10 : 14, justifyItems: "center" }}>
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
            disabled={disabled || !canPause} // Disable if the browser doesn't support pause
            highlight={isPaused} // Red outline when paused
            testId="capture-pause"
            compactMode={compactMode}
          >
            {isPaused ? "▶" : "❚❚"}
          </Chip>
        ) : null}

        {/* Flip camera button positioned above mode toggle */}
        <Chip
          ariaLabel="Switch camera"
          onClick={onFlip}
          disabled={disabled || isRecording}
          compactMode={compactMode}
        >
          ⇄
        </Chip>
      </div>

      {/* Bottom: Mode toggle */}
      <ModeToggle mode={mode} onChange={onModeChange} disabled={disabled || isRecording} compactMode={compactMode} />
    </div>
  );
}
