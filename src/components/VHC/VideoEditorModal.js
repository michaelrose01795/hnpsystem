// file location: src/components/VHC/VideoEditorModal.js
// Near full-screen editor for trimming and muting a freshly captured
// video. Designed for mobile first: the preview takes up almost the
// whole screen, the trim sliders are large and tactile, and the action
// buttons sit in a sticky footer so they're always reachable. On tablet
// and desktop the layout expands to a two-column arrangement.

import React, { useEffect, useMemo, useRef, useState } from "react"; // React primitives
import { createPortal } from "react-dom"; // Portal into <body>
import useBodyModalLock from "@/hooks/useBodyModalLock"; // Prevent background scroll

// Format elapsed seconds as MM:SS.
function formatTime(seconds = 0) {
  const m = Math.floor(seconds / 60); // Minute component
  const s = Math.floor(seconds % 60); // Remainder seconds (truncated)
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; // Pad each half
}

// Pick the best-supported output MIME for the export MediaRecorder.
function getPreferredMimeType() {
  const candidates = [ // From most to least preferred
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) || ""; // First supported
}

// Shared chip button style — pill, dark, hover/disabled aware.
function chipStyle({ kind = "ghost", disabled = false } = {}) {
  const base = { // Start from a common visual
    display: "inline-flex", // Centre icon + label
    alignItems: "center", // Vertical centre
    justifyContent: "center", // Horizontal centre
    gap: 8, // Space between glyph and text
    minHeight: 48, // Large mobile-friendly tap target
    padding: "0 16px", // Generous horizontal padding
    borderRadius: 14, // Modern rounded corners
    fontSize: 14, // Readable
    fontWeight: 800, // Heavy emphasis
    letterSpacing: "0.02em", // Slight tracking
    cursor: disabled ? "not-allowed" : "pointer", // State cursor
    opacity: disabled ? 0.45 : 1, // Dim when disabled
    transition: "background-color 160ms ease, transform 120ms ease", // Smooth interactions
    border: "none", // Start without a border
  };
  if (kind === "primary") return { ...base, background: "#38bdf8", color: "#0f172a" }; // Blue primary
  if (kind === "danger") return { ...base, background: "rgba(239, 68, 68, 0.16)", color: "#fecaca", border: "1px solid rgba(239, 68, 68, 0.6)" }; // Red outline
  if (kind === "secondary") return { ...base, background: "rgba(148, 163, 184, 0.18)", color: "#e2e8f0", border: "1px solid rgba(148, 163, 184, 0.32)" }; // Slate fill
  return { ...base, background: "transparent", color: "#e2e8f0", border: "1px solid rgba(148, 163, 184, 0.32)" }; // Ghost
}

export default function VideoEditorModal({
  isOpen, // Controls portal rendering
  videoFile, // File|Blob|string source for the video
  onSave, // (editedFile) => void — Save Edits
  onCancel, // () => void — Cancel/discard
  onSkip, // (originalFile) => void — Keep Original
  busyLabel = "", // External status label (e.g. "Uploading…")
  errorLabel = "", // External error label (from parent)
  widgetCount = 0, // How many widgets were baked into the video
}) {
  useBodyModalLock(isOpen); // Lock page scroll while open

  // --- Local state --------------------------------------------------
  const [duration, setDuration] = useState(0); // Full video duration
  const [currentTime, setCurrentTime] = useState(0); // Current playhead
  const [trimStart, setTrimStart] = useState(0); // Start of trim in seconds
  const [trimEnd, setTrimEnd] = useState(0); // End of trim in seconds
  const [isMuted, setIsMuted] = useState(false); // Whether the exported video should be muted
  const [isPlaying, setIsPlaying] = useState(false); // Playback state
  const [videoLoaded, setVideoLoaded] = useState(false); // Metadata-loaded gate
  const [loadError, setLoadError] = useState(""); // Internal load error
  const [processing, setProcessing] = useState(false); // Export-in-flight flag

  const videoRef = useRef(null); // <video> element

  // Build an object URL for File/Blob inputs; pass strings through unchanged.
  const previewSource = useMemo(() => {
    if (!videoFile) return ""; // Nothing to show
    if (typeof videoFile === "string") return videoFile; // Direct URL
    return URL.createObjectURL(videoFile); // Browser-created URL
  }, [videoFile]);

  // Revoke the object URL when the source changes or the modal unmounts.
  useEffect(() => {
    return () => {
      if (previewSource && typeof videoFile !== "string") { // Only revoke URLs we created
        URL.revokeObjectURL(previewSource); // Release memory
      }
    };
  }, [previewSource, videoFile]);

  // Reset internal state each time the modal opens.
  useEffect(() => {
    if (!isOpen) return; // Only reset when the modal becomes visible
    setVideoLoaded(false); // Wait for metadata
    setLoadError(""); // Clear prior errors
    setIsPlaying(false); // Ensure paused state
    setCurrentTime(0); // Reset playhead
    setProcessing(false); // Clear processing flag
  }, [isOpen, previewSource]);

  // --- Helpers ------------------------------------------------------

  const seekTo = (time) => {
    const v = videoRef.current; // Active element
    if (!v) return; // Not mounted yet
    v.currentTime = time; // Move playhead
    setCurrentTime(time); // Reflect in state
  };

  const togglePlayPause = async () => {
    const v = videoRef.current; // Active element
    if (!v || !videoLoaded) return; // Not ready yet
    if (isPlaying) { v.pause(); setIsPlaying(false); return; } // Currently playing → pause
    if (v.currentTime < trimStart || v.currentTime >= trimEnd) v.currentTime = trimStart; // Snap into trim
    try { await v.play(); setIsPlaying(true); } // Attempt playback
    catch (err) { console.error("Playback failed:", err); setLoadError("Video playback was blocked by the browser."); } // Safari autoplay etc.
  };

  const handleTrimStartChange = (value) => {
    const next = Math.max(0, Math.min(value, trimEnd - 0.2)); // Never cross trimEnd
    setTrimStart(next); // Update state
    if (currentTime < next) seekTo(next); // Keep playhead in bounds
  };

  const handleTrimEndChange = (value) => {
    const next = Math.min(duration, Math.max(value, trimStart + 0.2)); // Never cross trimStart
    setTrimEnd(next); // Update state
    if (currentTime >= next) seekTo(trimStart); // Keep playhead in bounds
  };

  // Export the video using MediaRecorder on the underlying stream.
  const exportVideo = async () => {
    try {
      setProcessing(true); // Mark busy
      const v = videoRef.current; // Current element
      if (!v) return; // Should never happen
      // Fast path: no trim + no mute → just return the original file.
      if (trimStart === 0 && Math.abs(trimEnd - duration) < 0.01 && !isMuted) { onSave?.(videoFile); return; }

      const stream = v.captureStream(); // Live stream of the playing video
      if (isMuted) { stream.getAudioTracks().forEach((track) => stream.removeTrack(track)); } // Drop audio for mute

      const mime = getPreferredMimeType(); // Best supported output
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {}); // Build recorder
      const chunks = []; // Accumulate output
      recorder.ondataavailable = (event) => { if (event.data && event.data.size > 0) chunks.push(event.data); }; // Collect
      recorder.onstop = () => { // Finalise
        const type = mime || "video/webm"; // Pick final MIME
        const ext = type.includes("mp4") ? "mp4" : "webm"; // File extension
        const blob = new Blob(chunks, { type }); // Assemble blob
        const file = new File([blob], `edited_video_${Date.now()}.${ext}`, { type }); // Construct File
        setProcessing(false); // Done
        onSave?.(file); // Hand off
      };

      v.pause(); // Seek safely
      v.currentTime = trimStart; // Jump to trim start
      const handleSeeked = async () => { // Only start recording once seek completes
        v.removeEventListener("seeked", handleSeeked); // One-shot listener
        recorder.start(); // Start recording the stream
        await v.play(); // Play through the trimmed region
        window.setTimeout(() => { recorder.stop(); v.pause(); setIsPlaying(false); }, Math.max(100, (trimEnd - trimStart) * 1000)); // Stop after trim window
      };
      v.addEventListener("seeked", handleSeeked); // Hook seek completion
    } catch (err) {
      console.error("Video export failed:", err); // Log
      setProcessing(false); // Clear busy
      setLoadError("Unable to process the edited video in this browser."); // Surface
    }
  };

  const trimmedDuration = Math.max(0, trimEnd - trimStart); // Derived length of the trimmed clip

  if (!isOpen || typeof document === "undefined") return null; // Portal guard

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit video"
      style={{
        position: "fixed", // Full overlay
        inset: 0, // Cover viewport
        zIndex: 1000, // Above app chrome
        background: "rgba(2, 6, 23, 0.92)", // Dark scrim behind content
        display: "flex", // Centre content
        alignItems: "stretch", // Fill area
        justifyContent: "center", // Centre horizontally
        padding: "max(12px, env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom))", // Safe areas
      }}
    >
      <div
        style={{
          width: "min(1440px, 100%)", // Max width for large screens
          height: "min(100%, 100vh)", // Fill vertically
          display: "grid", // Layout: preview, panel, footer
          gridTemplateRows: "1fr auto", // Main area + sticky footer
          background: "#0b1120", // Deep slate card
          borderRadius: 20, // Rounded card edges
          overflow: "hidden", // Clip children
          border: "1px solid rgba(148, 163, 184, 0.18)", // Subtle edge
          boxShadow: "0 40px 80px rgba(0,0,0,0.5)", // Elevated look
        }}
      >
        {/* Main two-column area (collapses to single column on narrow screens) */}
        <div
          style={{
            display: "grid", // Grid host
            gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 1fr)", // Preview wider than panel
            gap: 14, // Gap between columns
            padding: 14, // Inner padding
            minHeight: 0, // Allow shrink
            overflow: "hidden", // Respect parent layout
          }}
        >
          {/* Preview + trim sliders column */}
          <div
            style={{
              display: "grid", // Stack preview + sliders
              gridTemplateRows: "minmax(0, 1fr) auto", // Preview flexes, sliders sized
              gap: 12, // Between preview and sliders
              minHeight: 0, // Allow shrink
            }}
          >
            {/* Preview canvas */}
            <div
              style={{
                position: "relative", // Host for overlay controls
                background: "#000", // Black behind video
                borderRadius: 16, // Rounded preview
                overflow: "hidden", // Clip rounded corners
                minHeight: 260, // Never too short on mobile
              }}
            >
              <video
                ref={videoRef}
                src={previewSource || undefined}
                controls={false}
                playsInline
                muted={isMuted}
                onLoadedMetadata={(event) => {
                  const next = Number(event.currentTarget.duration || 0); // Read duration
                  setDuration(next); // Store
                  setTrimStart(0); // Default trim start
                  setTrimEnd(next); // Default trim end = full duration
                  setVideoLoaded(true); // Mark ready
                  setLoadError(""); // Clear any prior error
                }}
                onError={() => { setVideoLoaded(false); setIsPlaying(false); setLoadError("This browser could not load the captured video."); }}
                onTimeUpdate={(event) => {
                  const v = event.currentTarget; // The media element
                  setCurrentTime(v.currentTime); // Mirror time
                  if (v.currentTime >= trimEnd) { v.pause(); v.currentTime = trimStart; setIsPlaying(false); } // Loop within trim
                }}
                onEnded={(event) => { event.currentTarget.currentTime = trimStart; setIsPlaying(false); }} // Reset on end
                style={{
                  width: "100%", // Fill preview box
                  height: "100%", // Fill preview box
                  objectFit: "contain", // Letterbox to keep full frame visible
                  visibility: videoLoaded ? "visible" : "hidden", // Hide until metadata ready
                  background: "#000", // Black behind
                }}
              />

              {/* Loading / error curtain */}
              {!videoLoaded ? (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", padding: 20, textAlign: "center" }}>
                  <div style={{ display: "grid", gap: 8, maxWidth: 380 }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{loadError || "Loading video…"}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.76)" }}>The editor will appear as soon as the recorded file is ready.</div>
                  </div>
                </div>
              ) : null}

              {/* Play / pause overlay */}
              {videoLoaded ? (
                <button
                  type="button"
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  style={{
                    position: "absolute", // Over the preview
                    left: "50%", top: "50%", transform: "translate(-50%, -50%)", // Dead centre
                    width: 78, height: 78, // Large tap target
                    borderRadius: 999, // Circle
                    border: "1px solid rgba(255,255,255,0.24)", // Thin edge
                    background: "rgba(15, 23, 42, 0.56)", // Dark glass
                    color: "#fff", // White glyph
                    fontSize: 28, // Large icon
                    fontWeight: 800, // Heavy
                    cursor: "pointer", // Tappable
                    backdropFilter: "blur(14px)", // Glass
                  }}
                >
                  {isPlaying ? "❚❚" : "▶"}
                </button>
              ) : null}

              {/* Bottom stat strip */}
              {videoLoaded ? (
                <div
                  style={{
                    position: "absolute", left: 12, right: 12, bottom: 12, // Span bottom
                    display: "flex", justifyContent: "space-between", alignItems: "center", // Horizontal layout
                    padding: "10px 14px", // Inner padding
                    borderRadius: 14, // Rounded pill
                    background: "rgba(15, 23, 42, 0.64)", // Dark glass
                    color: "#fff", // White text
                    fontSize: 13, // Compact label
                    fontVariantNumeric: "tabular-nums", // Monospaced numbers
                    backdropFilter: "blur(12px)", // Glass effect
                  }}
                >
                  <span style={{ fontWeight: 800 }}>{formatTime(currentTime)}</span>
                  <span style={{ color: "rgba(255,255,255,0.72)" }}>
                    {isMuted ? "Muted" : "Audio on"} • {widgetCount > 0 ? `${widgetCount} widget${widgetCount === 1 ? "" : "s"}` : "No widgets"}
                  </span>
                  <span style={{ fontWeight: 800 }}>{formatTime(duration)}</span>
                </div>
              ) : null}
            </div>

            {/* Trim sliders panel */}
            <div
              style={{
                background: "#111827", // Slightly lighter than card
                borderRadius: 16, // Rounded
                border: "1px solid rgba(148, 163, 184, 0.14)", // Thin edge
                padding: 14, // Inner padding
                display: "grid", // Stack rows
                gap: 14, // Breathing room between rows
              }}
            >
              {/* Playhead */}
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Playhead</span>
                  <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.05"
                  value={currentTime}
                  onChange={(event) => seekTo(Number(event.target.value))}
                  disabled={!videoLoaded}
                  style={{ width: "100%", height: 20, accentColor: "#38bdf8" }}
                />
              </div>

              {/* Trim range sliders */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                {/* Start */}
                <div style={{ display: "grid", gap: 6, padding: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148, 163, 184, 0.14)", borderRadius: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Trim start</span>
                    <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{formatTime(trimStart)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.05"
                    value={trimStart}
                    onChange={(event) => handleTrimStartChange(Number(event.target.value))}
                    disabled={!videoLoaded}
                    style={{ width: "100%", height: 20, accentColor: "#f59e0b" }}
                  />
                </div>
                {/* End */}
                <div style={{ display: "grid", gap: 6, padding: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148, 163, 184, 0.14)", borderRadius: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Trim end</span>
                    <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{formatTime(trimEnd)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.05"
                    value={trimEnd}
                    onChange={(event) => handleTrimEndChange(Number(event.target.value))}
                    disabled={!videoLoaded}
                    style={{ width: "100%", height: 20, accentColor: "#ef4444" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Side panel: summary + audio toggle + tips */}
          <aside
            style={{
              display: "grid", // Stack cards
              gap: 12, // Between cards
              alignContent: "start", // Pack to the top
              overflow: "auto", // Scroll if content overflows
              minHeight: 0, // Allow shrink
            }}
          >
            {/* Header */}
            <div style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Edit video
              </span>
              <span style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 700 }}>
                Review the clip, trim the useful region, and choose whether audio stays on.
              </span>
            </div>

            {/* Summary card */}
            <div style={{ background: "#111827", borderRadius: 16, padding: 14, border: "1px solid rgba(148, 163, 184, 0.14)", display: "grid", gap: 10 }}>
              {[
                { label: "Original length", value: formatTime(duration) },
                { label: "New length", value: formatTime(trimmedDuration) },
                { label: "Audio", value: isMuted ? "Muted" : "Enabled" },
                { label: "Baked widgets", value: widgetCount },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 12 }}>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>{item.label}</span>
                  <span style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Audio toggle */}
            <button
              type="button"
              onClick={() => setIsMuted((current) => !current)}
              disabled={processing || !videoLoaded}
              style={chipStyle({ kind: isMuted ? "danger" : "secondary", disabled: processing || !videoLoaded })}
            >
              {isMuted ? "🔇 Muted" : "🔊 Audio on"}
            </button>

            {/* Tips */}
            <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.24)", borderRadius: 14, padding: 12, color: "#e2e8f0", fontSize: 13, lineHeight: 1.45 }}>
              <strong style={{ display: "block", marginBottom: 4, color: "#bfdbfe", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tips</strong>
              <div>Keep clips short so the customer sees the issue quickly on mobile.</div>
              <div>Mute the clip if workshop noise makes the voiceover harder to follow.</div>
              <div>Baked widgets stay in the file — you don't need to re-add them later.</div>
            </div>

            {/* Busy / error banner */}
            {(busyLabel || errorLabel) ? (
              <div style={{ padding: "10px 12px", borderRadius: 12, background: errorLabel ? "rgba(239, 68, 68, 0.14)" : "rgba(56, 189, 248, 0.12)", color: errorLabel ? "#fecaca" : "#bae6fd", fontSize: 13, fontWeight: 700, border: errorLabel ? "1px solid rgba(239, 68, 68, 0.36)" : "1px solid rgba(56, 189, 248, 0.36)" }}>
                {errorLabel || busyLabel}
              </div>
            ) : null}
          </aside>
        </div>

        {/* Sticky footer action bar */}
        <div
          style={{
            display: "grid", // Grid for layout
            gridTemplateColumns: "1fr auto", // Cancel on left, actions on right
            gap: 10, // Small gap
            padding: "12px 14px calc(12px + env(safe-area-inset-bottom)) 14px", // Safe area aware
            borderTop: "1px solid rgba(148, 163, 184, 0.14)", // Separator
            background: "rgba(15, 23, 42, 0.7)", // Slightly darker footer
            backdropFilter: "blur(10px)", // Glass effect
          }}
        >
          <button type="button" onClick={onCancel} disabled={processing} style={chipStyle({ kind: "ghost", disabled: processing })}>
            Cancel
          </button>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {onSkip ? (
              <button type="button" onClick={() => onSkip?.(videoFile)} disabled={processing || !videoLoaded} style={chipStyle({ kind: "secondary", disabled: processing || !videoLoaded })}>
                Keep original
              </button>
            ) : null}
            <button type="button" onClick={exportVideo} disabled={!videoLoaded || processing} style={chipStyle({ kind: "primary", disabled: !videoLoaded || processing })}>
              {processing ? "Processing…" : "Save edits"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
