// file location: src/components/VHC/mediaCapture/FullScreenCapture.js
// Main full-screen camera experience. The camera preview fills the whole
// viewport and every piece of UI floats on top of it. A dedicated
// "capture area" layer is inset from the right-controls column so that
// the crosshair and any added widgets sit at the visual centre of the
// capture (not under the controls stack).
//
// Every colour, radius, spacing, and typography value resolves through
// CSS variables defined in src/styles/theme.css. The dark glass chrome
// that floats over video uses the --hud-* token set so light/dark
// theme switching keeps the HUD readable over the live feed.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";

import useDeviceCamera from "./useDeviceCamera";
import useWidgetRecorder from "./useWidgetRecorder";
import useOrientation from "./useOrientation";
import LevelBar from "./LevelBar";
import ConcernPanel from "./ConcernPanel";
import CameraControls, { CaptureModeToggle } from "./CameraControls";
import VerticalZoomSlider from "./VerticalZoomSlider";
import FloatingWidget from "./FloatingWidget";

// Right-side controls width varies by device size to maintain usability
function getControlsWidth(screenWidth) {
  if (screenWidth < 500) return 70;
  if (screenWidth < 768) return 80;
  if (screenWidth < 1024) return 88;
  return 96;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

let widgetIdCounter = 0;
function nextWidgetId(kind) {
  widgetIdCounter += 1;
  return `${kind}-${Date.now()}-${widgetIdCounter}`;
}

// Widget footprint used by FloatingWidget (kept in sync manually) so
// the crosshair outline shows the exact rectangle that a tapped
// concern widget will occupy once placed.
const WIDGET_OUTLINE_WIDTH = 320;
const WIDGET_OUTLINE_HEIGHT = 120;

// Framing guide shown at the centre of the capture area. Instead of
// a classic crosshair we render a dashed outline that matches the
// widget card dimensions — so technicians see precisely where an
// Inspection widget will land before they tap it.
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
      {/* Small centre dot so there's still a single-pixel aim point */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 6,
          height: 6,
          borderRadius: "var(--radius-pill)",
          background: "var(--hud-text)",
          transform: "translate(-50%, -50%)",
          opacity: 0.9,
        }}
      />
    </div>
  );
}

export default function FullScreenCapture({
  isOpen,
  initialMode = "photo",
  onClose,
  onCapture,
  allowModeSwitch = true,
  panel = null,
  // panelInitiallyOpen is kept in the public API for backward
  // compatibility but no longer has an effect — the Inspection panel
  // cannot be collapsed/hidden from within the capture UI.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  panelInitiallyOpen = true,
  title = "",
  busyLabel = "",
}) {
  useBodyModalLock(isOpen);

  // When the global DevLayoutOverlay is on the whole capture section
  // enters "pass-through" mode: every control stops receiving pointer
  // events so the technician can inspect layout boxes without firing
  // the shutter, toggling widgets, etc. The DEV button in the
  // Inspection header flips its own pointer-events back on so the
  // overlay can always be turned off from inside the capture.
  const devOverlay = useDevLayoutOverlay();
  const passThroughActive = Boolean(devOverlay?.enabled);

  const orientation = useOrientation();
  const RIGHT_CONTROLS_WIDTH = getControlsWidth(orientation.screenWidth);
  const ZOOM_SLIDER_WIDTH = Math.round(Math.min(RIGHT_CONTROLS_WIDTH - 8, Math.max(44, RIGHT_CONTROLS_WIDTH * 0.7)));
  const ZOOM_SLIDER_HEIGHT = Math.round(Math.min(Math.max(220, orientation.screenHeight * 0.38), 420));

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

  // Single-widget mode: only ONE widget is ever on-screen. Tapping the
  // row that's already active removes it; tapping any other row
  // replaces the current widget with the new one. This keeps the frame
  // uncluttered during a customer video and matches the UX brief.
  const insertWidgetFromRow = useCallback((row) => {
    setWidgets((current) => {
      const alreadyActive = current.some((entry) => entry.sourceRowId === row.id);
      if (alreadyActive) return []; // Toggle off — no widget visible
      return [{
        id: nextWidgetId(row.kind || "info"),
        sourceRowId: row.id,
        // External concerns intentionally send title: "" from
        // buildInspectionConcerns, which the widget renders as a
        // single large line. Tyres / brakes pass a short title + a
        // numeric value.
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
    if (!orientation.isLandscape) {
      console.warn("Photo capture requires landscape orientation");
      return;
    }
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
      ctx.drawImage(video, 0, 0, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
      if (!blob) throw new Error("Failed to capture photo");
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
      camera.stop();
      await Promise.resolve(onCapture?.(file, { type: "photo", widgets: [] }));
      onClose?.();
    } catch (err) {
      console.error("Photo capture failed:", err);
      setCapturing(false);
    }
  }, [camera, capturing, onCapture, onClose, orientation.isLandscape]);

  const handleVideoPress = useCallback(async () => {
    if (!orientation.isLandscape) {
      console.warn("Video recording requires landscape orientation");
      return;
    }
    if (capturing) return;
    if (!recorder.isRecording) {
      try {
        await recorder.start();
      } catch (err) {
        console.error("Start recording failed:", err);
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
  const showPanel = Boolean(panel);
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
        // Pass-through mode: swallow pointer events on the whole
        // capture portal. Children that need to stay live (just the
        // DEV button in the Inspection header) opt back in by setting
        // pointer-events: auto on themselves.
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
          }}
        />
      ) : null}

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: camera.stream
            ? "var(--hud-gradient-top-bottom)"
            : "var(--hud-scrim)",
          pointerEvents: "none",
        }}
      />

      <div
        aria-hidden="false"
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
              compact={orientation.screenWidth && orientation.screenWidth < 500}
            />
          </div>
        ) : null}
      </div>

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
              border: "1px solid var(--hud-border)",
              background: "var(--hud-surface)",
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
            <span
              style={{
                color: "var(--hud-text)",
                fontWeight: 700,
                fontSize: "var(--text-body-sm)",
                letterSpacing: "var(--tracking-wide)",
                opacity: 0.86,
                maxWidth: "22vw",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </span>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", pointerEvents: "auto" }}>
          {busyLabel ? (
            <div
              style={{
                padding: "var(--space-sm) var(--space-3)",
                borderRadius: "var(--radius-pill)",
                background: "var(--accentMain)",
                color: "var(--onAccentText)",
                fontSize: "var(--text-caption)",
                fontWeight: 700,
                letterSpacing: "var(--tracking-wide)",
                textTransform: "uppercase",
              }}
            >
              {busyLabel}
            </div>
          ) : null}
        </div>
      </div>

      {orientation.isLandscape ? (
        <div
          style={{
            position: "absolute",
            top: "max(var(--space-4), env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "auto",
            zIndex: 5,
          }}
        >
          <LevelBar compact statusLabel={statusLabel} statusTone={statusTone} />
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + var(--space-6))",
          right: `${(RIGHT_CONTROLS_WIDTH - ZOOM_SLIDER_WIDTH) / 2}px`,
          width: ZOOM_SLIDER_WIDTH,
          height: ZOOM_SLIDER_HEIGHT,
          pointerEvents: "auto",
          zIndex: 4,
          display: "flex",
          alignItems: "stretch",
        }}
      >
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
            display: "flex",
            alignItems: "stretch",
            pointerEvents: "none",
            zIndex: 2,
            maxWidth: `calc(100% - var(--space-3) - var(--space-3) - ${RIGHT_CONTROLS_WIDTH}px)`,
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
          screenWidth={orientation.screenWidth}
        />
      </div>

      {(camera.loading || camera.error || !camera.permissionGranted) && !camera.stream ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-lg)",
            zIndex: 4,
          }}
        >
          {/* Camera-open / loading / error card. Sized to match the
              WIDGET_OUTLINE footprint (320 × 120) so it sits inside
              the crosshair outline and looks consistent with every
              other card on the HUD. */}
          <div
            style={{
              width: WIDGET_OUTLINE_WIDTH,
              height: WIDGET_OUTLINE_HEIGHT,
              maxWidth: "calc(100vw - var(--space-6))",
              padding: "var(--space-3) var(--space-4)",
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
              gap: "var(--space-1)",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <div style={{ fontSize: "var(--text-body)", fontWeight: 800 }}>
              {camera.loading ? "Opening camera…" : camera.error ? "Camera unavailable" : "Preparing camera…"}
            </div>
            <div
              style={{
                fontSize: "var(--text-caption)",
                lineHeight: "var(--leading-tight)",
                color: "var(--hud-text-muted)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {camera.error || "Please wait while the device camera is prepared."}
            </div>
            {camera.error ? (
              <button
                type="button"
                onClick={() => camera.start({ facingMode: "environment" })}
                style={{
                  marginTop: "var(--space-1)",
                  padding: "var(--space-1) var(--space-3)",
                  borderRadius: "var(--radius-pill)",
                  border: "1px solid var(--hud-border-strong)",
                  background: "var(--hud-surface)",
                  color: "var(--hud-text)",
                  fontWeight: 700,
                  fontSize: "var(--text-caption)",
                  cursor: "pointer",
                  fontFamily: "var(--font-family)",
                  transition: "var(--control-transition)",
                }}
              >
                Try again
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!orientation.isLandscape ? (
        <div
          style={{
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
          }}
        >
          {/* Portrait warning card — same 320 × 120 footprint as the
              widget cards so every popup that sits in the crosshair
              frame shares a visual footprint. */}
          <div
            style={{
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
            }}
          >
            <div style={{ fontSize: "var(--text-h3)", opacity: 0.85, lineHeight: 1 }}>📱</div>
            <div style={{ fontSize: "var(--text-body)", fontWeight: 800, color: "var(--hud-text)", lineHeight: "var(--leading-tight)" }}>
              Rotate Device
            </div>
            <div style={{ fontSize: "var(--text-caption)", lineHeight: "var(--leading-tight)", color: "var(--hud-text-muted)" }}>
              Landscape orientation required
            </div>
          </div>
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
