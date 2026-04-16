// file location: src/components/VHC/VideoEditorModal.js
// Near full-screen editor for trimming and muting a freshly captured
// video. Designed for mobile first: the preview takes up almost the
// whole screen, the trim sliders are large and tactile, and the action
// buttons sit in a sticky footer so they're always reachable.
//
// All colour / radius / spacing / typography values resolve through
// the global design tokens in src/styles/theme.css so the editor
// follows the user's selected theme (light and dark). The editor
// preview itself is deliberately framed in a dark stage (cinema
// feel) using the camera --hud-* token set, so the video reads well
// regardless of app theme.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import { createVhcButtonStyle } from "@/styles/appTheme";

function formatTime(seconds = 0) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getPreferredMimeType() {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) || "";
}

function editorButton(variant = "primary", disabled = false) {
  return {
    ...createVhcButtonStyle(variant, { disabled }),
    minHeight: "var(--control-height)",
    padding: "0 var(--space-md)",
    fontSize: "var(--text-body-sm)",
    letterSpacing: "var(--tracking-wide)",
    textTransform: "uppercase",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-sm)",
  };
}

const SECTION_LABEL_STYLE = {
  fontSize: "var(--text-caption)",
  color: "var(--hud-text-muted)",
  fontWeight: 800,
  letterSpacing: "var(--tracking-caps)",
  textTransform: "uppercase",
};

const VALUE_STYLE = {
  fontSize: "var(--text-body-sm)",
  color: "var(--hud-text)",
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
};

const PANEL_STYLE = {
  background: "var(--hud-surface-strong)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--hud-divider)",
  padding: "var(--space-4)",
};

const RANGE_STYLE = {
  width: "100%",
  height: "var(--space-5)",
  accentColor: "var(--accentMain)",
  cursor: "pointer",
};

export default function VideoEditorModal({
  isOpen,
  videoFile,
  onSave,
  onCancel,
  onSkip,
  busyLabel = "",
  errorLabel = "",
  widgetCount = 0,
}) {
  useBodyModalLock(isOpen);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [processing, setProcessing] = useState(false);

  const videoRef = useRef(null);

  const previewSource = useMemo(() => {
    if (!videoFile) return "";
    if (typeof videoFile === "string") return videoFile;
    return URL.createObjectURL(videoFile);
  }, [videoFile]);

  useEffect(() => {
    return () => {
      if (previewSource && typeof videoFile !== "string") {
        URL.revokeObjectURL(previewSource);
      }
    };
  }, [previewSource, videoFile]);

  useEffect(() => {
    if (!isOpen) return;
    setVideoLoaded(false);
    setLoadError("");
    setIsPlaying(false);
    setCurrentTime(0);
    setProcessing(false);
  }, [isOpen, previewSource]);

  const seekTo = (time) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = time;
    setCurrentTime(time);
  };

  const togglePlayPause = async () => {
    const v = videoRef.current;
    if (!v || !videoLoaded) return;
    if (isPlaying) { v.pause(); setIsPlaying(false); return; }
    if (v.currentTime < trimStart || v.currentTime >= trimEnd) v.currentTime = trimStart;
    try { await v.play(); setIsPlaying(true); }
    catch (err) {
      console.error("Playback failed:", err);
      setLoadError("Video playback was blocked by the browser.");
    }
  };

  const handleTrimStartChange = (value) => {
    const next = Math.max(0, Math.min(value, trimEnd - 0.2));
    setTrimStart(next);
    if (currentTime < next) seekTo(next);
  };

  const handleTrimEndChange = (value) => {
    const next = Math.min(duration, Math.max(value, trimStart + 0.2));
    setTrimEnd(next);
    if (currentTime >= next) seekTo(trimStart);
  };

  const exportVideo = async () => {
    try {
      setProcessing(true);
      const v = videoRef.current;
      if (!v) return;
      if (trimStart === 0 && Math.abs(trimEnd - duration) < 0.01 && !isMuted) {
        onSave?.(videoFile);
        return;
      }

      const stream = v.captureStream();
      if (isMuted) { stream.getAudioTracks().forEach((track) => stream.removeTrack(track)); }

      const mime = getPreferredMimeType();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data && event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = () => {
        const type = mime || "video/webm";
        const ext = type.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(chunks, { type });
        const file = new File([blob], `edited_video_${Date.now()}.${ext}`, { type });
        setProcessing(false);
        onSave?.(file);
      };

      v.pause();
      v.currentTime = trimStart;
      const handleSeeked = async () => {
        v.removeEventListener("seeked", handleSeeked);
        recorder.start();
        await v.play();
        window.setTimeout(() => { recorder.stop(); v.pause(); setIsPlaying(false); }, Math.max(100, (trimEnd - trimStart) * 1000));
      };
      v.addEventListener("seeked", handleSeeked);
    } catch (err) {
      console.error("Video export failed:", err);
      setProcessing(false);
      setLoadError("Unable to process the edited video in this browser.");
    }
  };

  const trimmedDuration = Math.max(0, trimEnd - trimStart);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit video"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-modal)",
        background: "var(--overlay)",
        backdropFilter: "var(--hud-blur)",
        WebkitBackdropFilter: "var(--hud-blur)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: "max(var(--space-3), env(safe-area-inset-top)) var(--space-3) calc(var(--space-3) + env(safe-area-inset-bottom))",
        fontFamily: "var(--font-family)",
      }}
    >
      <div
        style={{
          width: "min(1440px, 100%)",
          height: "min(100%, 100vh)",
          display: "grid",
          gridTemplateRows: "1fr auto",
          background: "var(--hud-scrim)",
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
          border: "1px solid var(--hud-divider)",
          boxShadow: "var(--hud-shadow-lg)",
          color: "var(--hud-text)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 1fr)",
            gap: "var(--space-4)",
            padding: "var(--space-4)",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Preview + trim sliders column */}
          <div
            style={{
              display: "grid",
              gridTemplateRows: "minmax(0, 1fr) auto",
              gap: "var(--space-3)",
              minHeight: 0,
            }}
          >
            {/* Preview stage */}
            <div
              style={{
                position: "relative",
                background: "var(--hud-scrim)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                minHeight: 260,
                border: "1px solid var(--hud-divider)",
              }}
            >
              <video
                ref={videoRef}
                src={previewSource || undefined}
                controls={false}
                playsInline
                muted={isMuted}
                onLoadedMetadata={(event) => {
                  const next = Number(event.currentTarget.duration || 0);
                  setDuration(next);
                  setTrimStart(0);
                  setTrimEnd(next);
                  setVideoLoaded(true);
                  setLoadError("");
                }}
                onError={() => {
                  setVideoLoaded(false);
                  setIsPlaying(false);
                  setLoadError("This browser could not load the captured video.");
                }}
                onTimeUpdate={(event) => {
                  const v = event.currentTarget;
                  setCurrentTime(v.currentTime);
                  if (v.currentTime >= trimEnd) { v.pause(); v.currentTime = trimStart; setIsPlaying(false); }
                }}
                onEnded={(event) => { event.currentTarget.currentTime = trimStart; setIsPlaying(false); }}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  visibility: videoLoaded ? "visible" : "hidden",
                  background: "var(--hud-scrim)",
                }}
              />

              {!videoLoaded ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--hud-text)",
                    padding: "var(--space-lg)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ display: "grid", gap: "var(--space-sm)", maxWidth: 380 }}>
                    <div style={{ fontSize: "var(--text-h3)", fontWeight: 800 }}>
                      {loadError || "Loading video…"}
                    </div>
                    <div style={{ fontSize: "var(--text-body-sm)", color: "var(--hud-text-muted)" }}>
                      The editor will appear as soon as the recorded file is ready.
                    </div>
                  </div>
                </div>
              ) : null}

              {videoLoaded ? (
                <button
                  type="button"
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 78,
                    height: 78,
                    borderRadius: "var(--radius-pill)",
                    border: "1px solid var(--hud-border-strong)",
                    background: "var(--hud-surface-strong)",
                    color: "var(--hud-text)",
                    fontSize: "var(--text-h2)",
                    fontWeight: 800,
                    cursor: "pointer",
                    backdropFilter: "var(--hud-blur)",
                    WebkitBackdropFilter: "var(--hud-blur)",
                    transition: "var(--control-transition)",
                  }}
                >
                  {isPlaying ? "❚❚" : "▶"}
                </button>
              ) : null}

              {videoLoaded ? (
                <div
                  style={{
                    position: "absolute",
                    left: "var(--space-3)",
                    right: "var(--space-3)",
                    bottom: "var(--space-3)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "var(--space-sm) var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--hud-surface-strong)",
                    border: "1px solid var(--hud-divider)",
                    color: "var(--hud-text)",
                    fontSize: "var(--text-body-sm)",
                    fontVariantNumeric: "tabular-nums",
                    backdropFilter: "var(--hud-blur)",
                    WebkitBackdropFilter: "var(--hud-blur)",
                  }}
                >
                  <span style={{ fontWeight: 800 }}>{formatTime(currentTime)}</span>
                  <span style={{ color: "var(--hud-text-muted)" }}>
                    {isMuted ? "Muted" : "Audio on"} • {widgetCount > 0 ? `${widgetCount} widget${widgetCount === 1 ? "" : "s"}` : "No widgets"}
                  </span>
                  <span style={{ fontWeight: 800 }}>{formatTime(duration)}</span>
                </div>
              ) : null}
            </div>

            {/* Trim sliders */}
            <div
              style={{
                ...PANEL_STYLE,
                display: "grid",
                gap: "var(--space-4)",
              }}
            >
              <div style={{ display: "grid", gap: "var(--space-1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={SECTION_LABEL_STYLE}>Playhead</span>
                  <span style={VALUE_STYLE}>
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
                  style={RANGE_STYLE}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "var(--space-3)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gap: "var(--space-1)",
                    padding: "var(--space-3)",
                    background: "var(--hud-surface-subtle)",
                    border: "1px solid var(--hud-divider)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)" }}>
                    <span style={SECTION_LABEL_STYLE}>Trim start</span>
                    <span style={VALUE_STYLE}>{formatTime(trimStart)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.05"
                    value={trimStart}
                    onChange={(event) => handleTrimStartChange(Number(event.target.value))}
                    disabled={!videoLoaded}
                    style={{ ...RANGE_STYLE, accentColor: "var(--warning)" }}
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: "var(--space-1)",
                    padding: "var(--space-3)",
                    background: "var(--hud-surface-subtle)",
                    border: "1px solid var(--hud-divider)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)" }}>
                    <span style={SECTION_LABEL_STYLE}>Trim end</span>
                    <span style={VALUE_STYLE}>{formatTime(trimEnd)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.05"
                    value={trimEnd}
                    onChange={(event) => handleTrimEndChange(Number(event.target.value))}
                    disabled={!videoLoaded}
                    style={{ ...RANGE_STYLE, accentColor: "var(--danger)" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Side panel: summary + audio toggle + tips */}
          <aside
            style={{
              display: "grid",
              gap: "var(--space-3)",
              alignContent: "start",
              overflow: "auto",
              minHeight: 0,
            }}
          >
            <div style={{ display: "grid", gap: "var(--space-xs)" }}>
              <span style={SECTION_LABEL_STYLE}>Edit video</span>
              <span
                style={{
                  fontSize: "var(--text-body)",
                  color: "var(--hud-text)",
                  fontWeight: 700,
                  lineHeight: "var(--leading-normal)",
                }}
              >
                Review the clip, trim the useful region, and choose whether audio stays on.
              </span>
            </div>

            <div
              style={{
                ...PANEL_STYLE,
                display: "grid",
                gap: "var(--space-2)",
              }}
            >
              {[
                { label: "Original length", value: formatTime(duration) },
                { label: "New length", value: formatTime(trimmedDuration) },
                { label: "Audio", value: isMuted ? "Muted" : "Enabled" },
                { label: "Baked widgets", value: widgetCount },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    padding: "var(--space-sm) var(--space-3)",
                    background: "var(--hud-surface-subtle)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <span style={{ fontSize: "var(--text-body-sm)", color: "var(--hud-text-muted)" }}>{item.label}</span>
                  <span style={VALUE_STYLE}>{item.value}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsMuted((current) => !current)}
              disabled={processing || !videoLoaded}
              style={editorButton(isMuted ? "primary" : "secondary", processing || !videoLoaded)}
            >
              {isMuted ? "🔇 Muted" : "🔊 Audio on"}
            </button>

            <div
              style={{
                background: "rgba(var(--accentMainRgb), 0.08)",
                border: "1px solid rgba(var(--accentMainRgb), 0.24)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-3)",
                color: "var(--hud-text)",
                fontSize: "var(--text-body-sm)",
                lineHeight: "var(--leading-normal)",
                display: "grid",
                gap: "var(--space-1)",
              }}
            >
              <strong
                style={{
                  ...SECTION_LABEL_STYLE,
                  color: "rgba(var(--accentMainRgb), 0.9)",
                  marginBottom: "var(--space-xs)",
                }}
              >
                Tips
              </strong>
              <div>Keep clips short so the customer sees the issue quickly on mobile.</div>
              <div>Mute the clip if workshop noise makes the voiceover harder to follow.</div>
              <div>Baked widgets stay in the file — you don't need to re-add them later.</div>
            </div>

            {(busyLabel || errorLabel) ? (
              <div
                role={errorLabel ? "alert" : undefined}
                style={{
                  padding: "var(--space-sm) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  background: errorLabel ? "rgba(var(--danger-rgb), 0.16)" : "rgba(var(--accentMainRgb), 0.12)",
                  color: errorLabel ? "rgba(var(--danger-rgb), 1)" : "var(--hud-text)",
                  fontSize: "var(--text-body-sm)",
                  fontWeight: 700,
                  border: `1px solid ${errorLabel ? "rgba(var(--danger-rgb), 0.4)" : "rgba(var(--accentMainRgb), 0.36)"}`,
                }}
              >
                {errorLabel || busyLabel}
              </div>
            ) : null}
          </aside>
        </div>

        {/* Sticky footer action bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "var(--space-sm)",
            padding: "var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom))",
            borderTop: "1px solid var(--hud-divider)",
            background: "var(--hud-surface-strong)",
            backdropFilter: "var(--hud-blur)",
            WebkitBackdropFilter: "var(--hud-blur)",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            style={editorButton("ghost", processing)}
          >
            Cancel
          </button>
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {onSkip ? (
              <button
                type="button"
                onClick={() => onSkip?.(videoFile)}
                disabled={processing || !videoLoaded}
                style={editorButton("secondary", processing || !videoLoaded)}
              >
                Keep original
              </button>
            ) : null}
            <button
              type="button"
              onClick={exportVideo}
              disabled={!videoLoaded || processing}
              style={editorButton("primary", !videoLoaded || processing)}
            >
              {processing ? "Processing…" : "Save edits"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
