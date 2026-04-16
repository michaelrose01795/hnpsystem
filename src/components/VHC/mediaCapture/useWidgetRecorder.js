// file location: src/components/VHC/mediaCapture/useWidgetRecorder.js
// Hook that records the camera stream with the floating widgets composited
// directly into the output video. This is what makes the in-recording
// widgets feel "baked in" rather than added afterwards. Widgets are drawn
// onto a hidden canvas along with each video frame; the canvas's captured
// stream is what MediaRecorder actually records. Audio is passed through
// from the original camera stream so sound still works.
//
// Caveats / browser limitations (surfaced to the caller so the UI can
// explain fallbacks):
//  - canvas.captureStream() is unavailable on very old Safari builds.
//    When missing we fall back to recording the raw camera stream and
//    simply don't bake widgets into the file (the UI still shows them).
//  - MediaRecorder.pause()/resume() is not universally supported. The
//    hook reports `canPause` so the UI can disable the pause control.
//  - Drawing many overlapping widgets at 30fps on a low-end phone may
//    drop frames; this is acceptable and results in slightly choppier
//    widget transitions only, not the underlying video.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"; // React primitives

// Probe the best-supported MIME type for MediaRecorder output.
function getPreferredMimeType() {
  const candidates = [ // Ordered from most to least preferred
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2", // iOS Safari + modern Chrome
    "video/mp4", // Plain MP4
    "video/webm;codecs=vp9", // Chrome/Edge
    "video/webm;codecs=vp8", // Fallback WebM
    "video/webm", // Plain WebM
  ];
  return candidates.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) || ""; // Find first supported
}

// Derive the file extension from a MIME type string.
function extensionFromMime(mime = "") {
  return String(mime).toLowerCase().includes("mp4") ? "mp4" : "webm"; // Simple binary decision
}

// Seeded pseudo-random so widgets repeatedly placed land in consistent spots.
function seededOffset(seed = 0) {
  const s = Math.abs(Math.sin(seed * 9301 + 49297)) * 233280; // Cheap deterministic hash
  return s - Math.floor(s); // 0..1 fractional
}

// Rounded rectangle helper for Canvas 2D (older Safari lacks roundRect).
function fillRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, h / 2, w / 2); // Never exceed half dimension
  ctx.beginPath(); // Start path
  ctx.moveTo(x + radius, y); // Top-left start
  ctx.lineTo(x + w - radius, y); // Top edge
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius); // Top-right corner
  ctx.lineTo(x + w, y + h - radius); // Right edge
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h); // Bottom-right corner
  ctx.lineTo(x + radius, y + h); // Bottom edge
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius); // Bottom-left corner
  ctx.lineTo(x, y + radius); // Left edge
  ctx.quadraticCurveTo(x, y, x + radius, y); // Close top-left
  ctx.closePath(); // Complete
  ctx.fill(); // Fill now
}

// Widget colour palette — tuned for readability on video backgrounds.
// Kept in sync with FloatingWidget.ACCENTS / BADGES so the baked-in
// rendering matches the live DOM preview pixel-for-pixel.
const WIDGET_COLOURS = {
  red: { accent: "#ef4444", badge: "RED" }, // Red concern
  amber: { accent: "#f59e0b", badge: "AMBER" }, // Amber concern
  green: { accent: "#10b981", badge: "GREEN" }, // Green / good status
  default: { accent: "#38bdf8", badge: "INFO" }, // Fallback / informational
};

// Paint one widget onto the canvas at its normalised [0..1] x/y position.
function drawWidget(ctx, canvasWidth, canvasHeight, widget) {
  const { title = "", value = "", status = "default", x = 0.5, y = 0.5 } = widget; // Unpack
  const colours = WIDGET_COLOURS[status] || WIDGET_COLOURS.default; // Lookup colour
  const fontScale = Math.max(14, Math.min(canvasWidth, canvasHeight) / 34); // Responsive font size
  const padding = fontScale * 0.9; // Inner padding scales with font

  ctx.save(); // Isolate transform/alpha changes
  ctx.font = `700 ${fontScale}px system-ui, -apple-system, Segoe UI, sans-serif`; // Heavy font for title
  const titleMetrics = ctx.measureText(title || " "); // Measure title text
  ctx.font = `800 ${fontScale * 1.4}px system-ui, -apple-system, Segoe UI, sans-serif`; // Value is bigger
  const valueMetrics = ctx.measureText(value || " "); // Measure value text
  const boxWidth = Math.max(titleMetrics.width, valueMetrics.width) + padding * 2 + fontScale * 2.2; // Total width
  const boxHeight = fontScale * 3.4; // Total height accommodates two lines

  const px = clampPosition(x, boxWidth, canvasWidth); // Clamp into canvas
  const py = clampPosition(y, boxHeight, canvasHeight); // Clamp into canvas

  // Card background.
  ctx.globalAlpha = 0.92; // Slightly translucent for a modern floating look
  ctx.fillStyle = "rgba(15, 23, 42, 0.94)"; // Deep slate base
  fillRoundedRect(ctx, px, py, boxWidth, boxHeight, fontScale * 0.9); // Rounded corners

  // Accent strip.
  ctx.globalAlpha = 1; // Fully opaque
  ctx.fillStyle = colours.accent; // Coloured strip
  fillRoundedRect(ctx, px, py, fontScale * 0.5, boxHeight, fontScale * 0.25); // Left-side strip

  // Badge pill inside.
  ctx.fillStyle = colours.accent; // Badge background
  const badgeText = colours.badge; // RED/AMBER/INFO
  ctx.font = `700 ${fontScale * 0.62}px system-ui, -apple-system, Segoe UI, sans-serif`; // Small caps font
  const badgeMetrics = ctx.measureText(badgeText); // Measure badge
  const badgeW = badgeMetrics.width + fontScale * 0.8; // Width with padding
  const badgeH = fontScale * 1; // Badge height
  const badgeX = px + fontScale * 1.2; // Badge x
  const badgeY = py + padding * 0.7; // Badge y
  fillRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2); // Pill shape
  ctx.fillStyle = "#0f172a"; // Dark text on coloured badge
  ctx.textBaseline = "middle"; // Centre vertically
  ctx.fillText(badgeText, badgeX + fontScale * 0.4, badgeY + badgeH / 2); // Paint badge text

  // Title text.
  ctx.fillStyle = "rgba(226, 232, 240, 0.92)"; // Light grey-white
  ctx.font = `700 ${fontScale}px system-ui, -apple-system, Segoe UI, sans-serif`; // Title font
  ctx.textBaseline = "alphabetic"; // Standard baseline
  ctx.fillText(title, px + fontScale * 1.2, py + padding + fontScale * 1.6); // Title line

  // Value text (large).
  ctx.fillStyle = "#f8fafc"; // White value
  ctx.font = `800 ${fontScale * 1.4}px system-ui, -apple-system, Segoe UI, sans-serif`; // Big value font
  ctx.fillText(value, px + fontScale * 1.2, py + padding + fontScale * 3); // Value line
  ctx.restore(); // Pop the saved state
}

// Clamp a 0..1 position into the visible drawing area so widgets never clip off-canvas.
function clampPosition(fraction, boxSize, canvasSize) {
  const margin = canvasSize * 0.05; // Keep a 5% margin from edges
  const absolute = fraction * canvasSize - boxSize / 2; // Centre around the requested point
  return Math.max(margin, Math.min(canvasSize - boxSize - margin, absolute)); // Clamp
}

// Hook entry.
export default function useWidgetRecorder({ stream, videoElement, widgets, isRecordingMode }) {
  // --- State --------------------------------------------------------
  const [isRecording, setIsRecording] = useState(false); // Whether a capture is live
  const [isPaused, setIsPaused] = useState(false); // Whether currently paused
  const [elapsed, setElapsed] = useState(0); // Accumulated recorded seconds (whole)
  const [canPause, setCanPause] = useState(false); // Whether the browser supports pause
  const [recorderError, setRecorderError] = useState(""); // Last recorder error, for the UI

  // --- Refs (avoid re-render thrashing) ------------------------------
  const canvasRef = useRef(null); // Offscreen compositing canvas
  const ctxRef = useRef(null); // 2D context cached
  const recorderRef = useRef(null); // Active MediaRecorder
  const chunksRef = useRef([]); // Buffer for ondataavailable chunks
  const rafRef = useRef(0); // requestAnimationFrame id
  const widgetsRef = useRef([]); // Always-latest widgets (used from RAF loop)
  const tickRef = useRef(null); // Interval id for the elapsed timer
  const resolveStopRef = useRef(null); // Promise resolver for stop()
  const mimeTypeRef = useRef(""); // Selected MIME type (used on stop)
  const startTimeRef = useRef(0); // ms timestamp when recording started
  const accumulatedRef = useRef(0); // ms accumulated across pauses
  const pauseStartRef = useRef(0); // ms timestamp of the current pause

  // Keep the latest widgets list in a ref so the animation loop doesn't close over a stale value.
  useEffect(() => { widgetsRef.current = widgets || []; }, [widgets]); // Mirror prop into ref

  // Detect whether MediaRecorder.pause is available on this browser.
  useEffect(() => {
    setCanPause(typeof MediaRecorder !== "undefined" && typeof MediaRecorder.prototype.pause === "function"); // Simple probe
  }, []);

  // Lazily create a single offscreen canvas for the lifetime of the component.
  const ensureCanvas = useCallback(() => {
    if (canvasRef.current) return canvasRef.current; // Already created
    const canvas = document.createElement("canvas"); // Create once
    canvasRef.current = canvas; // Save for reuse
    ctxRef.current = canvas.getContext("2d"); // Cache 2D context
    return canvas; // Return for chaining
  }, []);

  // Draw one frame: video first, then each widget overlay.
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current; // Grab canvas (may be null if torn down)
    const ctx = ctxRef.current; // Grab 2D context
    const video = videoElement; // Source video element
    if (!canvas || !ctx || !video) { // Nothing to draw
      rafRef.current = requestAnimationFrame(drawFrame); // Keep trying next tick
      return;
    }
    const width = video.videoWidth || 1280; // Choose a sensible width
    const height = video.videoHeight || 720; // And matching height
    if (canvas.width !== width) canvas.width = width; // Resize lazily
    if (canvas.height !== height) canvas.height = height; // Resize lazily

    try {
      ctx.drawImage(video, 0, 0, width, height); // Paint the live camera frame
    } catch {
      // Video not yet ready on first frame — ignore and try again.
    }

    const list = widgetsRef.current || []; // Current widget list
    for (let i = 0; i < list.length; i += 1) { // Iterate widgets
      drawWidget(ctx, width, height, list[i]); // Paint each widget
    }

    rafRef.current = requestAnimationFrame(drawFrame); // Schedule next frame
  }, [videoElement]);

  // Start the RAF loop once we're in a recording-capable mode.
  useEffect(() => {
    if (!isRecordingMode) { // Only animate in video mode
      if (rafRef.current) cancelAnimationFrame(rafRef.current); // Stop any active loop
      return undefined;
    }
    ensureCanvas(); // Make sure the canvas exists
    rafRef.current = requestAnimationFrame(drawFrame); // Kick off the loop
    return () => { // Cleanup stops the loop
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRecordingMode, drawFrame, ensureCanvas]);

  // Run a 1s ticker for the timer that the UI shows.
  useEffect(() => {
    if (!isRecording || isPaused) { // Only tick while actively recording
      if (tickRef.current) clearInterval(tickRef.current); // Stop ticker otherwise
      tickRef.current = null; // Clear ref
      return undefined;
    }
    tickRef.current = setInterval(() => { // Recompute elapsed every second
      const now = performance.now(); // Current monotonic time
      const total = accumulatedRef.current + (now - startTimeRef.current); // Sum pauses and active time
      setElapsed(Math.floor(total / 1000)); // Update state in seconds
    }, 1000); // Once a second is enough for the label
    return () => { if (tickRef.current) clearInterval(tickRef.current); }; // Cleanup
  }, [isRecording, isPaused]);

  // Start a recording. Returns a promise so the UI can await the file on stop.
  const start = useCallback(() => new Promise((resolve, reject) => {
    try {
      if (!stream) { // No camera yet
        reject(new Error("Camera not ready")); // Bail early
        return;
      }
      const canvas = ensureCanvas(); // Make sure canvas exists
      let recordedStream; // Stream that MediaRecorder will read
      if (typeof canvas.captureStream === "function") { // Preferred path
        const videoTrack = canvas.captureStream(30).getVideoTracks()[0]; // Canvas-composited video
        const audioTracks = stream.getAudioTracks(); // Passthrough audio from camera
        recordedStream = new MediaStream([videoTrack, ...audioTracks]); // Combine the two
      } else { // Fallback: record raw camera (widgets will still render in the DOM)
        recordedStream = stream; // Use stream directly
      }

      const mimeType = getPreferredMimeType(); // Best-supported format
      mimeTypeRef.current = mimeType; // Stash for stop handler
      const recorder = new MediaRecorder( // Create the recorder
        recordedStream, // Source stream
        mimeType ? { mimeType } : {} // Only pass a mimeType when we actually have one
      );
      chunksRef.current = []; // Reset chunk buffer
      recorder.ondataavailable = (event) => { // Collect data as it comes
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data); // Ignore empty chunks
      };
      recorder.onstop = () => { // Finalise when stopped
        const type = mimeTypeRef.current || "video/webm"; // Use chosen type or default
        const extension = extensionFromMime(type); // Pick extension
        const blob = new Blob(chunksRef.current, { type }); // Build final blob
        const file = new File([blob], `customer_video_${Date.now()}.${extension}`, { type }); // Convert to File
        setIsRecording(false); // Reset state
        setIsPaused(false); // Reset pause state
        const resolver = resolveStopRef.current; // Latest resolver (set by stop())
        resolveStopRef.current = null; // Clear so it isn't reused
        if (resolver) resolver(file); // Resolve the caller's promise
      };
      recorder.onerror = (event) => { // Error handler
        setRecorderError(event?.error?.message || "Recorder failed"); // Surface to UI
        reject(event?.error || new Error("Recorder failed")); // Reject start() promise
      };

      recorder.start(1000); // Flush every second so chunks don't grow huge
      recorderRef.current = recorder; // Save for later control
      startTimeRef.current = performance.now(); // Mark start time
      accumulatedRef.current = 0; // Reset accumulator
      setElapsed(0); // Reset displayed elapsed
      setIsRecording(true); // Flip to recording mode
      setIsPaused(false); // Not paused
      resolve(); // start() has succeeded
    } catch (err) {
      console.error("Failed to start recording:", err); // Log for ops
      setRecorderError(err?.message || "Unable to start recording"); // UI message
      reject(err); // Reject outer promise
    }
  }), [ensureCanvas, stream]);

  // Pause recording — only supported on engines with MediaRecorder.pause().
  const pause = useCallback(() => {
    const recorder = recorderRef.current; // Current recorder
    if (!recorder || recorder.state !== "recording") return; // Nothing to pause
    if (typeof recorder.pause !== "function") return; // Not supported on this browser
    try {
      recorder.pause(); // Pause the encoder
      pauseStartRef.current = performance.now(); // Remember pause moment
      accumulatedRef.current += performance.now() - startTimeRef.current; // Bank the running time
      setIsPaused(true); // Update state
    } catch (err) {
      console.warn("Pause failed:", err); // Soft-fail
    }
  }, []);

  // Resume after pause.
  const resume = useCallback(() => {
    const recorder = recorderRef.current; // Current recorder
    if (!recorder || recorder.state !== "paused") return; // Nothing to resume
    if (typeof recorder.resume !== "function") return; // Not supported
    try {
      recorder.resume(); // Resume encoder
      startTimeRef.current = performance.now(); // Reset start baseline
      setIsPaused(false); // Update state
    } catch (err) {
      console.warn("Resume failed:", err); // Soft-fail
    }
  }, []);

  // Stop recording and return a Promise resolving to the File object.
  const stop = useCallback(() => new Promise((resolve) => {
    const recorder = recorderRef.current; // Current recorder
    if (!recorder || recorder.state === "inactive") { // Nothing to stop
      resolve(null); // No file produced
      return;
    }
    resolveStopRef.current = resolve; // Save resolver for onstop handler
    try {
      recorder.stop(); // Triggers ondataavailable + onstop
    } catch (err) {
      console.warn("Stop failed:", err); // Soft-fail
      resolve(null); // Still resolve to unblock callers
    }
  }), []);

  // Cancel cleans up without producing a file (used by the close button).
  const cancel = useCallback(() => {
    const recorder = recorderRef.current; // Current recorder
    if (recorder && recorder.state !== "inactive") { // Still running?
      try { recorder.stop(); } catch { /* ignore */ } // Stop but ignore errors
    }
    recorderRef.current = null; // Clear ref
    chunksRef.current = []; // Drop buffered data
    setIsRecording(false); // Reset state
    setIsPaused(false); // Reset state
    setElapsed(0); // Reset timer
  }, []);

  // Helper to allow the UI to place widgets with deterministic staggered offsets.
  const suggestPosition = useCallback((seed) => {
    const fx = 0.28 + seededOffset(seed) * 0.32; // x in [0.28, 0.60]
    const fy = 0.32 + seededOffset(seed + 1) * 0.28; // y in [0.32, 0.60]
    return { x: fx, y: fy }; // Normalised coordinates
  }, []);

  return useMemo(() => ({ // Stable return object (avoid unnecessary re-renders)
    isRecording, // Current state
    isPaused, // Current pause state
    elapsed, // Whole seconds
    canPause, // Browser capability flag
    recorderError, // Surface to UI
    start, // () => Promise<void>
    stop, // () => Promise<File|null>
    pause, // () => void
    resume, // () => void
    cancel, // () => void
    suggestPosition, // (seed) => { x, y }
  }), [isRecording, isPaused, elapsed, canPause, recorderError, start, stop, pause, resume, cancel, suggestPosition]);
}
