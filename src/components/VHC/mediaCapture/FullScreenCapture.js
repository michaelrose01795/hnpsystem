// file location: src/components/VHC/mediaCapture/FullScreenCapture.js
// Main full-screen camera experience. The camera preview fills the whole
// viewport and every piece of UI floats on top of it. A dedicated
// "capture area" layer is inset from the right-controls column so that
// the crosshair and any added widgets sit at the *visual* centre of the
// capture (not under the controls stack).
//
// Key behaviours:
//   - Tapping a left-panel row toggles a widget: first tap places it
//     dead-centre of the capture area; second tap removes it.
//   - A minimal crosshair guide marks the centre of the capture area.
//   - Widgets are burned into the recorded video (via useWidgetRecorder).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"; // React primitives
import { createPortal } from "react-dom"; // Portal into <body> for true fullscreen
import useBodyModalLock from "@/hooks/useBodyModalLock"; // Lock scroll while open

import useDeviceCamera from "./useDeviceCamera"; // Camera lifecycle + zoom/flip
import useWidgetRecorder from "./useWidgetRecorder"; // Canvas compositing + MediaRecorder
import LevelBar from "./LevelBar"; // Top-bar level indicator
import ConcernPanel from "./ConcernPanel"; // Left-side panel
import CameraControls from "./CameraControls"; // Right-side controls
import FloatingWidget from "./FloatingWidget"; // DOM twin of the baked widget

// Right-side controls column width in px. Used to offset the capture
// area, top bar, and recorder-error toast so they never sit under the
// control stack and the true centre of the capture lines up with the
// centre of the user-visible preview area.
const RIGHT_CONTROLS_WIDTH = 96;

// Format seconds as MM:SS for the timer label.
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60); // Minute component
  const s = seconds % 60; // Seconds remainder
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; // Zero-padded pair
}

// Generate a React-stable widget id.
let widgetIdCounter = 0; // Module-level counter
function nextWidgetId(kind) {
  widgetIdCounter += 1; // Bump on each call
  return `${kind}-${Date.now()}-${widgetIdCounter}`; // Stable id
}

// Minimal crosshair SVG rendered dead-centre of the capture area.
// Purely visual (never baked into the video) — just a framing guide
// so technicians know exactly where tapped widgets will appear.
function Crosshair({ dimmed = false }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute", // Overlay the capture area
        left: "50%", // Dead centre horizontally
        top: "50%", // Dead centre vertically
        transform: "translate(-50%, -50%)", // Centre the SVG on the point
        pointerEvents: "none", // Never steal pointer events
        opacity: dimmed ? 0.35 : 0.72, // Dimmer when a widget sits on top
        transition: "opacity 160ms ease", // Smooth dim when widgets appear
        color: "#f8fafc", // Currentcolor for the strokes
        mixBlendMode: "screen", // Keep the guide readable over any background
      }}
    >
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <circle cx="28" cy="28" r="3" fill="currentColor" />{/* Centre dot */}
        <circle cx="28" cy="28" r="13" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.55" />{/* Inner ring */}
        <line x1="28" y1="4" x2="28" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />{/* Top tick */}
        <line x1="28" y1="40" x2="28" y2="52" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />{/* Bottom tick */}
        <line x1="4" y1="28" x2="16" y2="28" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />{/* Left tick */}
        <line x1="40" y1="28" x2="52" y2="28" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />{/* Right tick */}
      </svg>
    </div>
  );
}

export default function FullScreenCapture({
  isOpen, // Controls portal rendering
  initialMode = "photo", // "photo" | "video"
  onClose, // () => void — user dismissed
  onCapture, // (file, { type, widgets }) => void — capture succeeded
  allowModeSwitch = true, // If false, hides the mode toggle (e.g. customer video = video-only)
  panel = null, // { tyres: [], brakes: [] } or null — shows the left panel when provided
  panelInitiallyOpen = true, // Start with panel expanded (false collapses to a thin rail)
  title = "", // Optional subtle top-left label (e.g. "Customer Video")
  busyLabel = "", // External busy label (e.g. "Uploading…")
}) {
  useBodyModalLock(isOpen); // Lock body scroll when overlay is visible

  // Capture mode toggle ----------------------------------------------
  const [mode, setMode] = useState(initialMode); // Local mode
  useEffect(() => { setMode(initialMode); }, [initialMode, isOpen]); // Reset when re-opened

  // Camera hook ------------------------------------------------------
  const camera = useDeviceCamera({ isActive: isOpen, mode }); // Owns the MediaStream

  // Widgets state (live DOM overlay + baked into video) --------------
  // Each widget carries `sourceRowId` so the panel can display a toggle
  // state and the second tap on the same row can remove it.
  const [widgets, setWidgets] = useState([]); // List of active widgets
  const videoElementRef = useRef(null); // <video> node for canvas draw

  // Widget recorder (owns canvas + MediaRecorder) --------------------
  const recorder = useWidgetRecorder({
    stream: camera.stream, // Source camera MediaStream
    videoElement: videoElementRef.current, // Draw target for canvas loop
    widgets, // Current widget list (for compositing)
    isRecordingMode: mode === "video", // Only animate canvas in video mode
  });

  // UI state ---------------------------------------------------------
  const [panelCollapsed, setPanelCollapsed] = useState(!panelInitiallyOpen); // Panel collapse toggle
  const [capturing, setCapturing] = useState(false); // True during photo save / video finalise

  // Reset widgets and capture-in-progress flag when the overlay opens.
  useEffect(() => {
    if (!isOpen) return; // Only act when becoming visible
    setWidgets([]); // Clear any stale widgets
    setCapturing(false); // Clear busy flag
  }, [isOpen]);

  // Ensure the <video> element always shows the active stream.
  useEffect(() => {
    const el = videoElementRef.current; // Current ref
    if (!el) return; // Node not mounted yet
    el.srcObject = camera.stream || null; // Bind stream (or clear)
  }, [camera.stream]);

  // --- Actions -------------------------------------------------------

  // Toggle a widget from a panel row.
  // First tap inserts a widget dead-centre of the capture area; a
  // second tap on the same row removes it. This gives the technician a
  // fast on/off for each concern without having to long-press.
  const insertWidgetFromRow = useCallback((row) => {
    setWidgets((current) => {
      const existingIndex = current.findIndex((entry) => entry.sourceRowId === row.id); // Does this row already have a widget?
      if (existingIndex !== -1) { // Yes → toggle off
        return current.filter((_, index) => index !== existingIndex); // Drop the existing widget
      }
      // Otherwise → toggle on at dead-centre of the capture area.
      const widget = { // Widget shape (matches FloatingWidget + canvas drawWidget)
        id: nextWidgetId(row.kind || "info"), // Stable ID
        sourceRowId: row.id, // Link back to the panel row for toggling
        title: row.widget?.title || row.label, // Title string
        value: row.widget?.value || row.measurement || "", // Value line
        status: row.widget?.status || row.status || "default", // Colour key
        x: 0.5, // Horizontal centre of the capture area
        y: 0.5, // Vertical centre of the capture area
      };
      return [...current, widget]; // Append (render + next frame will bake it in)
    });
  }, []);

  // Remove a widget by id (long-press gesture from the DOM widget).
  const removeWidget = useCallback((widgetId) => {
    setWidgets((current) => current.filter((entry) => entry.id !== widgetId)); // Drop by id
  }, []);

  // Derived: the set of row IDs currently represented by a widget. The
  // panel uses this to render an "on" state for each active row.
  const activeRowIds = useMemo(() => {
    const set = new Set(); // Start empty
    for (const widget of widgets) { // Iterate current widgets
      if (widget.sourceRowId) set.add(widget.sourceRowId); // Track origin row
    }
    return set; // Return the snapshot set
  }, [widgets]);

  // Close: tear down everything and notify the parent.
  const handleClose = useCallback(() => {
    recorder.cancel(); // Stop any in-flight recording (no file produced)
    camera.stop(); // Release camera
    setWidgets([]); // Reset widgets
    onClose?.(); // Parent cleanup
  }, [camera, recorder, onClose]);

  // Snap a still from the current video frame.
  const handlePhotoPress = useCallback(async () => {
    if (capturing || !camera.stream) return; // Guard rails
    try {
      setCapturing(true); // Show busy state
      const video = videoElementRef.current; // Current <video>
      if (!video) throw new Error("Camera not ready"); // Shouldn't happen if stream is set
      const width = video.videoWidth || 1920; // Fall back to sane dimensions
      const height = video.videoHeight || 1080; // Fall back to sane dimensions
      const canvas = document.createElement("canvas"); // Temporary snapshot canvas
      canvas.width = width; canvas.height = height; // Size it to source
      const ctx = canvas.getContext("2d"); // Drawing context
      ctx.drawImage(video, 0, 0, width, height); // Capture the frame
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94)); // JPEG encode
      if (!blob) throw new Error("Failed to capture photo"); // Encode error
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" }); // Finalise as File
      camera.stop(); // Release camera
      await Promise.resolve(onCapture?.(file, { type: "photo", widgets: [] })); // Hand off to parent
      onClose?.(); // Close the overlay
    } catch (err) {
      console.error("Photo capture failed:", err); // Log
      setCapturing(false); // Clear busy
    }
  }, [camera, capturing, onCapture, onClose]);

  // Start / stop video recording from the shutter.
  const handleVideoPress = useCallback(async () => {
    if (capturing) return; // Ignore while busy
    if (!recorder.isRecording) { // Idle → start
      try {
        await recorder.start(); // Fire up canvas+MediaRecorder
      } catch (err) {
        console.error("Start recording failed:", err); // Log — UI surfaces recorderError
      }
      return;
    }
    // Recording → stop and deliver file.
    try {
      setCapturing(true); // Show busy during finalisation
      const file = await recorder.stop(); // Wait for blob
      const frozenWidgets = widgets.map((widget) => ({ ...widget })); // Snapshot widgets at stop
      camera.stop(); // Release camera now that we have the file
      if (file) {
        await Promise.resolve(onCapture?.(file, { type: "video", widgets: frozenWidgets })); // Hand off
      }
      onClose?.(); // Close overlay
    } catch (err) {
      console.error("Stop recording failed:", err); // Log error
      setCapturing(false); // Clear busy to re-allow attempts
    }
  }, [camera, capturing, onCapture, onClose, recorder, widgets]);

  // Toggle pause during a recording (no-op if not supported).
  const handlePauseToggle = useCallback(() => {
    if (!recorder.canPause) return; // Browser lacks pause support
    if (recorder.isPaused) recorder.resume(); else recorder.pause(); // Toggle
  }, [recorder]);

  // Switch capture mode (only available when idle).
  const handleModeChange = useCallback((nextMode) => {
    if (recorder.isRecording) return; // Refuse during recording
    setMode(nextMode); // Apply
  }, [recorder.isRecording]);

  // Handle slider-driven continuous zoom.
  const handleZoomChange = useCallback((value) => {
    camera.applyZoom(value); // Apply via hardware zoom
  }, [camera]);

  // Handle discrete lens switching (physical camera change).
  const handleLensSelect = useCallback((deviceId) => {
    camera.switchLens(deviceId); // Restart camera on that lens
  }, [camera]);

  // Decide which shutter action to run based on mode.
  const onShutterPress = mode === "photo" ? handlePhotoPress : handleVideoPress; // Contextual handler

  // Keyboard: Escape closes when allowed. Space triggers the shutter.
  useEffect(() => {
    if (!isOpen) return undefined; // Only bind while open
    const onKey = (event) => { // Global key handler
      if (event.key === "Escape" && !recorder.isRecording) handleClose(); // Esc closes unless recording
      if (event.key === " " && document.activeElement?.tagName !== "INPUT") { // Space = shutter (outside inputs)
        event.preventDefault(); // Avoid scroll
        onShutterPress?.(); // Fire shutter
      }
    };
    window.addEventListener("keydown", onKey); // Register
    return () => window.removeEventListener("keydown", onKey); // Cleanup
  }, [handleClose, isOpen, onShutterPress, recorder.isRecording]);

  // Live flag for the panel / widget overlay state.
  const isLive = mode === "video" && recorder.isRecording; // "We are actively recording"
  const showPanel = Boolean(panel); // Left-side panel on/off

  // Dim the crosshair when a widget is sitting at the centre so the
  // two visual elements don't clash.
  const crosshairDimmed = widgets.length > 0; // Any active widget dims the guide

  // Right padding used by the top bar so it never sits on top of the
  // right-side control column (width + a little breathing room).
  const topBarRightOffset = RIGHT_CONTROLS_WIDTH + 12; // Leave a 12px gap

  // Portal target — render a full-screen overlay on <body>.
  if (!isOpen || typeof document === "undefined") return null; // SSR/portal guard

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || "Camera"}
      style={{
        position: "fixed", // Cover the viewport
        inset: 0, // All sides flush
        zIndex: 1000, // Over application chrome
        background: "#05070b", // Dark base behind camera (visible during loading)
        overflow: "hidden", // Never scroll the overlay itself
      }}
    >
      {/* Tiny global keyframes for widget entry animation. Scoped by unique name. */}
      <style>{"@keyframes hnpWidgetIn { from { opacity: 0; transform: translate(-50%, -45%) scale(0.9); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }"}</style>

      {/* ----------------------------------------------------------------
          Layer 1: Full-screen camera preview.
          The preview still covers the whole viewport so the UI feels
          edge-to-edge — the capture-area layer (below) handles centring.
      ---------------------------------------------------------------- */}
      {camera.stream ? (
        <video
          ref={videoElementRef}
          autoPlay
          playsInline
          muted
          style={{
            position: "absolute", // Cover entire container
            inset: 0, // All sides flush
            width: "100%", // Full width
            height: "100%", // Full height
            objectFit: "cover", // Crop rather than letterbox (camera feel)
            background: "#000", // Black while frames arrive
          }}
        />
      ) : null}

      {/* Subtle top/bottom vignette for readability of overlay chrome. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", // Overlay the feed
          inset: 0, // All sides flush
          background: camera.stream
            ? "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.0) 18%, rgba(0,0,0,0.0) 78%, rgba(0,0,0,0.7) 100%)"
            : "linear-gradient(180deg, #0f172a 0%, #030712 100%)",
          pointerEvents: "none", // Visual only
        }}
      />

      {/* ----------------------------------------------------------------
          Layer 2: Capture-area layer.
          This is inset from the right by RIGHT_CONTROLS_WIDTH so that
          its 50%/50% is the *visual* centre of the camera preview the
          technician actually sees. Both the crosshair guide and every
          floating widget live inside it, so they all share the same
          centred coordinate system.
      ---------------------------------------------------------------- */}
      <div
        aria-hidden="false"
        style={{
          position: "absolute", // Positioned layer
          top: 0, // Top of viewport
          left: 0, // Left of viewport
          right: RIGHT_CONTROLS_WIDTH, // Reserve the controls column
          bottom: 0, // Bottom of viewport
          pointerEvents: "none", // Pass-through; widgets re-enable their own events
        }}
      >
        {/* Crosshair guide — centred in the capture area */}
        <Crosshair dimmed={crosshairDimmed} />

        {/* Floating widgets — positioned within this same layer so
            their (0.5, 0.5) coordinates land on the crosshair */}
        {widgets.map((widget) => (
          <FloatingWidget key={widget.id} widget={widget} onRemove={removeWidget} />
        ))}
      </div>

      {/* ----------------------------------------------------------------
          Layer 3: Top bar. Sits across the top, stops before the right
          controls column so the two layers never collide.
      ---------------------------------------------------------------- */}
      <div
        style={{
          position: "absolute", // Overlay the top edge
          top: "max(14px, env(safe-area-inset-top))", // Respect safe-area
          left: 14, // Inner padding
          right: topBarRightOffset, // Leave room for the right-side controls
          display: "flex", // Horizontal layout
          alignItems: "center", // Centre content vertically
          justifyContent: "space-between", // Close/title on left, level+timer on right
          gap: 12, // Between groups
          pointerEvents: "none", // Individual controls opt in
        }}
      >
        {/* Left cluster: close button + optional title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto" }}>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close camera"
            disabled={recorder.isRecording && !recorder.isPaused}
            style={{
              width: 44, // Touch target
              height: 44, // Touch target
              borderRadius: 999, // Circle
              border: "1px solid rgba(255,255,255,0.16)", // Thin edge
              background: "rgba(15,23,42,0.6)", // Dark glass
              color: "#fff", // White glyph
              fontSize: 24, // Large ×
              cursor: recorder.isRecording && !recorder.isPaused ? "not-allowed" : "pointer", // Block while recording (unless paused)
              backdropFilter: "blur(10px)", // Glass
              WebkitBackdropFilter: "blur(10px)", // Safari prefix
              opacity: recorder.isRecording && !recorder.isPaused ? 0.4 : 1, // Faded when blocked
            }}
          >
            ×
          </button>
          {title ? (
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, letterSpacing: "0.04em", opacity: 0.86, maxWidth: "22vw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title}
            </span>
          ) : null}
        </div>

        {/* Right cluster: level bar + timer + external busy label */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto" }}>
          <LevelBar compact />
          {isLive || recorder.isPaused ? (
            <div
              aria-live="polite"
              style={{
                padding: "8px 12px", // Pill padding
                borderRadius: 999, // Pill
                background: recorder.isPaused ? "rgba(245, 158, 11, 0.92)" : "rgba(220, 38, 38, 0.92)", // Amber when paused else red
                color: "#fff", // White text
                fontSize: 13, // Compact label
                fontWeight: 800, // Bold
                letterSpacing: "0.08em", // Slight spacing
                textTransform: "uppercase", // Caps
                fontVariantNumeric: "tabular-nums", // Fixed digit width
                boxShadow: "0 10px 20px rgba(0,0,0,0.3)", // Elevate
              }}
            >
              {recorder.isPaused ? `Paused ${formatDuration(recorder.elapsed)}` : `Rec ${formatDuration(recorder.elapsed)}`}
            </div>
          ) : null}
          {busyLabel ? (
            <div style={{ padding: "8px 12px", borderRadius: 999, background: "rgba(59, 130, 246, 0.88)", color: "#fff", fontSize: 13, fontWeight: 700 }}>
              {busyLabel}
            </div>
          ) : null}
        </div>
      </div>

      {/* ----------------------------------------------------------------
          Layer 4: Left-side inspection panel overlay. Floats over the
          preview as a HUD, never shrinks the camera.
      ---------------------------------------------------------------- */}
      {showPanel ? (
        <div
          style={{
            position: "absolute", // Floating overlay
            left: 12, // Small inset from the left edge
            top: "calc(env(safe-area-inset-top, 0px) + 76px)", // Sit below the top bar
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)", // Keep clear of bottom edge
            display: "flex", // Allow the panel to stretch to full available height
            alignItems: "stretch", // Fill vertical space
            pointerEvents: "none", // Let taps pass through outside the panel itself
            zIndex: 2, // Above widgets, below top bar
            maxWidth: "calc(100% - 12px - 12px - " + RIGHT_CONTROLS_WIDTH + "px)", // Don't overrun right controls
          }}
        >
          <ConcernPanel
            tyres={panel?.tyres || []}
            brakes={panel?.brakes || []}
            activeRowIds={activeRowIds}
            onInsertWidget={insertWidgetFromRow}
            isLive={isLive}
            collapsed={panelCollapsed}
            onToggle={() => setPanelCollapsed((current) => !current)}
          />
        </div>
      ) : null}

      {/* ----------------------------------------------------------------
          Layer 5: Right-side control column. Anchored to the right edge
          at full height, overlaying the camera preview.
      ---------------------------------------------------------------- */}
      <div
        style={{
          position: "absolute", // Anchored overlay
          top: 0, // Full height
          right: 0, // Flush to right edge
          bottom: 0, // Full height
          width: RIGHT_CONTROLS_WIDTH, // Fixed column width
          display: "flex", // Flex host for CameraControls
          alignItems: "stretch", // Fill vertically
          pointerEvents: "none", // CameraControls re-enables inside
          zIndex: 3, // Above the panel overlay
        }}
      >
        <CameraControls
          mode={mode}
          onModeChange={allowModeSwitch ? handleModeChange : undefined}
          isRecording={recorder.isRecording}
          isPaused={recorder.isPaused}
          canPause={recorder.canPause}
          onShutterPress={onShutterPress}
          onPausePress={handlePauseToggle}
          onFlip={camera.flip}
          onZoomChange={handleZoomChange}
          onLensSelect={handleLensSelect}
          zoomRange={camera.zoomRange}
          zoomValue={camera.zoomValue}
          lenses={camera.discreteLensOptions}
          selectedDeviceId={camera.selectedDeviceId}
          disabled={camera.loading || !!camera.error || !camera.permissionGranted || capturing}
        />
      </div>

      {/* ----------------------------------------------------------------
          Layer 6: Loading / error curtain. Shown only when the camera is
          unavailable so it can carry an explanation and a retry button.
      ---------------------------------------------------------------- */}
      {(camera.loading || camera.error || !camera.permissionGranted) && !camera.stream ? (
        <div
          style={{
            position: "absolute", // Full-screen curtain
            inset: 0, // Cover area
            display: "flex", // Centre card
            alignItems: "center", // Vertical centre
            justifyContent: "center", // Horizontal centre
            padding: 24, // Breathing room
            zIndex: 4, // Above controls
          }}
        >
          <div
            style={{
              maxWidth: 380, // Readable width
              padding: "20px 22px", // Card padding
              borderRadius: 22, // Rounded card
              background: "rgba(15, 23, 42, 0.78)", // Dark card
              border: "1px solid rgba(255,255,255,0.08)", // Subtle edge
              color: "#fff", // White text
              textAlign: "center", // Centre text
              backdropFilter: "blur(20px)", // Glass
              WebkitBackdropFilter: "blur(20px)", // Safari prefix
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              {camera.loading ? "Opening camera…" : camera.error ? "Camera unavailable" : "Preparing camera…"}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.8)" }}>
              {camera.error || "Please wait while the device camera is prepared."}
            </div>
            {camera.error ? (
              <button
                type="button"
                onClick={() => camera.start({ facingMode: "environment" })}
                style={{
                  marginTop: 14, // Space under message
                  padding: "10px 16px", // Tap target
                  borderRadius: 999, // Pill
                  border: "1px solid rgba(255,255,255,0.2)", // Edge
                  background: "rgba(255,255,255,0.08)", // Subtle fill
                  color: "#fff", // White text
                  fontWeight: 700, // Bold
                  cursor: "pointer", // Tappable
                }}
              >
                Try again
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Recorder error toast (bottom, clear of right controls) */}
      {recorder.recorderError ? (
        <div
          style={{
            position: "absolute", // Floating toast
            left: 16, // Padding from left
            right: 16 + RIGHT_CONTROLS_WIDTH, // Padding from right, clear of controls
            bottom: "calc(16px + env(safe-area-inset-bottom))", // Safe area aware
            padding: "10px 14px", // Inner spacing
            borderRadius: 12, // Rounded
            background: "rgba(220, 38, 38, 0.92)", // Red alert colour
            color: "#fff", // White text
            fontSize: 13, // Compact
            fontWeight: 700, // Bold
            textAlign: "center", // Centre message
            boxShadow: "0 10px 24px rgba(0,0,0,0.36)", // Elevate
            zIndex: 4, // Above most layers
          }}
        >
          {recorder.recorderError}
        </div>
      ) : null}
    </div>,
    document.body
  );
}
