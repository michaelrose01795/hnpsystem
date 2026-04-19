// file location: src/components/VHC/VideoEditorModal.js
// Edit Video popup. Single-column layout: video preview on top, the
// unified timeline (with audio toggle, Split, Remove section, trim
// handles and playhead) directly under it. The shell uses the global
// surface / border tokens so the popup follows light and dark themes
// the same way the rest of the app does.
//
// Trim/save semantics preserved. Additionally supports "cut" segments
// removed from the middle of the clip: playback skips them, and export
// pauses the MediaRecorder while the playhead is inside a cut.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import { popupOverlayStyles } from "@/styles/appTheme";
import Button from "@/components/ui/Button";
import VideoPlayer from "./videoEditor/VideoPlayer";
import TimelineTrimControl from "./videoEditor/TimelineTrimControl";

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

const actionButtonStyle = (extra = {}) => ({
  minHeight: "var(--control-height)",
  padding: "0 var(--space-lg)",
  fontSize: "var(--text-body-sm)",
  letterSpacing: "var(--tracking-wide)",
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-sm)",
  ...extra,
});

function findCutContaining(time, cuts) {
  return cuts.find((c) => time >= c.start && time < c.end);
}

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
  const [splits, setSplits] = useState([]);
  const [cuts, setCuts] = useState([]);

  const videoRef = useRef(null);
  const scrubResumeRef = useRef(false);

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
    setSplits([]);
    setCuts([]);
  }, [isOpen, previewSource]);

  const seekTo = (time) => {
    const v = videoRef.current;
    if (!v) return;
    const safe = Number.isFinite(time) ? time : 0;
    const clamped = Math.max(0, Math.min(safe, duration || safe));
    // Update React state immediately so the playhead UI tracks the
    // pointer without waiting for the video's own timeupdate event.
    setCurrentTime(clamped);
    try {
      v.currentTime = clamped;
    } catch (err) {
      console.warn("Seek failed:", err);
    }
  };

  const handleScrubStart = () => {
    const v = videoRef.current;
    if (!v) return;
    // Pause while scrubbing so rapid currentTime writes aren't
    // fighting playback — the browser can then keep up with each
    // seek and actually paint the requested frame.
    scrubResumeRef.current = !v.paused;
    if (!v.paused) {
      v.pause();
      setIsPlaying(false);
    }
  };

  const handleScrubEnd = () => {
    const v = videoRef.current;
    if (!v) return;
    if (scrubResumeRef.current) {
      scrubResumeRef.current = false;
      v.play().then(() => setIsPlaying(true)).catch(() => {});
    }
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

      const noEdits =
        trimStart === 0 &&
        Math.abs(trimEnd - duration) < 0.01 &&
        !isMuted &&
        cuts.length === 0;
      if (noEdits) {
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

      // Pause/resume across cuts during recording.
      const onTimeUpdate = () => {
        const t = v.currentTime;
        const cut = findCutContaining(t, cuts);
        if (cut && recorder.state === "recording") {
          recorder.pause();
          v.currentTime = cut.end;
          if (recorder.state === "paused") recorder.resume();
        }
      };

      v.pause();
      v.currentTime = trimStart;
      const handleSeeked = async () => {
        v.removeEventListener("seeked", handleSeeked);
        recorder.start();
        v.addEventListener("timeupdate", onTimeUpdate);
        await v.play();
        const totalCutMs = cuts.reduce((acc, c) => acc + (c.end - c.start) * 1000, 0);
        const playMs = Math.max(100, (trimEnd - trimStart) * 1000 - totalCutMs);
        window.setTimeout(() => {
          v.removeEventListener("timeupdate", onTimeUpdate);
          if (recorder.state !== "inactive") recorder.stop();
          v.pause();
          setIsPlaying(false);
        }, playMs + 200);
      };
      v.addEventListener("seeked", handleSeeked);
    } catch (err) {
      console.error("Video export failed:", err);
      setProcessing(false);
      setLoadError("Unable to process the edited video in this browser.");
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Edit video" style={popupOverlayStyles}>
      <div
        style={{
          width: "min(1100px, 100%)",
          maxHeight: "calc(100dvh - clamp(10px, 2.5vw, 20px) * 2)",
          background: "var(--surfaceMain)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border)",
          boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
          color: "var(--surfaceText)",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          overflow: "hidden",
          fontFamily: "var(--font-family)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
          }}
        >
          <div style={{ display: "grid", gap: 2 }}>
            <div
              style={{
                fontSize: "var(--text-caption)",
                color: "var(--surfaceTextMuted)",
                fontWeight: 800,
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
              }}
            >
              Edit video
            </div>
            <div
              style={{
                fontSize: "var(--text-h3)",
                fontWeight: 800,
                color: "var(--surfaceText)",
                lineHeight: 1.2,
              }}
            >
              Trim and review your clip
            </div>
          </div>
          {widgetCount > 0 ? (
            <span
              style={{
                fontSize: "var(--text-caption)",
                color: "var(--surfaceTextMuted)",
                fontWeight: 700,
              }}
            >
              {widgetCount} widget{widgetCount === 1 ? "" : "s"} baked in
            </span>
          ) : null}
        </div>

        {/* Body */}
        <div
          style={{
            display: "grid",
            gridTemplateRows: "minmax(260px, 1fr) auto",
            gap: "var(--space-4)",
            padding: "var(--space-4) var(--space-5)",
            minHeight: 0,
            overflow: "auto",
          }}
        >
          <VideoPlayer
            ref={videoRef}
            src={previewSource}
            isMuted={isMuted}
            isPlaying={isPlaying}
            videoLoaded={videoLoaded}
            loadError={loadError}
            currentTime={currentTime}
            duration={duration}
            trimStart={trimStart}
            trimEnd={trimEnd}
            onTogglePlay={togglePlayPause}
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
              const cut = findCutContaining(v.currentTime, cuts);
              if (cut) { v.currentTime = cut.end; return; }
              if (v.currentTime >= trimEnd) { v.pause(); v.currentTime = trimStart; setIsPlaying(false); }
            }}
            onEnded={(event) => { event.currentTarget.currentTime = trimStart; setIsPlaying(false); }}
          />

          <TimelineTrimControl
            duration={duration}
            currentTime={currentTime}
            trimStart={trimStart}
            trimEnd={trimEnd}
            onSeek={seekTo}
            onTrimStartChange={handleTrimStartChange}
            onTrimEndChange={handleTrimEndChange}
            onScrubStart={handleScrubStart}
            onScrubEnd={handleScrubEnd}
            disabled={!videoLoaded}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted((c) => !c)}
            splits={splits}
            cuts={cuts}
            onSplitsChange={setSplits}
            onCutsChange={setCuts}
          />

          {(busyLabel || errorLabel) ? (
            <div
              role={errorLabel ? "alert" : undefined}
              style={{
                padding: "var(--space-sm) var(--space-3)",
                borderRadius: "var(--radius-md)",
                background: errorLabel ? "rgba(var(--danger-rgb), 0.12)" : "var(--control-bg)",
                color: errorLabel ? "var(--danger)" : "var(--surfaceText)",
                fontSize: "var(--text-body-sm)",
                fontWeight: 700,
                border: `1px solid ${errorLabel ? "rgba(var(--danger-rgb), 0.4)" : "var(--border)"}`,
              }}
            >
              {errorLabel || busyLabel}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "var(--space-sm)",
            padding: "var(--space-3) var(--space-5) calc(var(--space-3) + env(safe-area-inset-bottom))",
            borderTop: "1px solid var(--border)",
            background: "var(--control-bg)",
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={processing}
            style={actionButtonStyle({ marginRight: "auto" })}
          >
            Cancel
          </Button>
          {onSkip ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSkip?.(videoFile)}
              disabled={processing || !videoLoaded}
              style={actionButtonStyle()}
            >
              Keep original
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="sm"
            onClick={exportVideo}
            disabled={!videoLoaded || processing}
            style={actionButtonStyle()}
          >
            {processing ? "Processing…" : "Save edits"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
