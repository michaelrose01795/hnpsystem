// file location: src/components/VHC/VideoEditorModal.js
// Edit Video popup. Single-column layout: video preview on top, the
// unified timeline (with audio toggle, Split, Remove section, trim
// handles and playhead) directly under it.

import React, { useEffect, useMemo, useRef, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
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
  // Queue navigation for a multi-video capture session. Back / Next commit the
  // current trim / cut / mute work before moving, so cycling through a session
  // never drops an edit. An untouched video is passed through without a
  // re-encode, so navigating past one costs nothing.
  onBack,
  onNext,
  queueIndex = 0,
  queueTotal = 0,
}) {
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
  const [videoAspectRatio, setVideoAspectRatio] = useState(9 / 16);

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
    setVideoAspectRatio(9 / 16);
  }, [isOpen, previewSource]);

  const seekTo = (time) => {
    const v = videoRef.current;
    if (!v) return;
    const safe = Number.isFinite(time) ? time : 0;
    const clamped = Math.max(0, Math.min(safe, duration || safe));
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
    if (isPlaying) {
      v.pause();
      setIsPlaying(false);
      return;
    }
    if (v.currentTime < trimStart || v.currentTime >= trimEnd) v.currentTime = trimStart;
    try {
      await v.play();
      setIsPlaying(true);
    } catch (err) {
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

  // Flatten the current trim / cut / mute work into a file and hand it to
  // `deliver`. Every exit that keeps the edit (Save edits, Back, Next) goes
  // through here, so the work is committed no matter which one the technician
  // uses. "Keep original" deliberately bypasses this.
  const exportVideo = async (deliver) => {
    try {
      setProcessing(true);
      const v = videoRef.current;
      if (!v) {
        setProcessing(false);
        return;
      }

      const noEdits =
        trimStart === 0 &&
        Math.abs(trimEnd - duration) < 0.01 &&
        !isMuted &&
        cuts.length === 0;
      if (noEdits) {
        setProcessing(false);
        deliver(videoFile);
        return;
      }

      const stream = v.captureStream();
      if (isMuted) stream.getAudioTracks().forEach((track) => stream.removeTrack(track));

      const mime = getPreferredMimeType();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const type = mime || "video/webm";
        const ext = type.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(chunks, { type });
        const file = new File([blob], `edited_video_${Date.now()}.${ext}`, { type });
        setProcessing(false);
        deliver(file);
      };

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

  const handleSavePress = () => exportVideo((file) => onSave?.(file));
  const handleBackPress = () => exportVideo((file) => onBack?.(file));
  const handleNextPress = () => exportVideo((file) => onNext?.(file));

  if (!isOpen) return null;

  const popupMaxWidth = videoAspectRatio < 0.8 ? "460px" : videoAspectRatio < 1.35 ? "720px" : "900px";

  return (
    <PopupModal
      isOpen
      onClose={processing ? undefined : onCancel}
      closeOnBackdrop={false}
      closeOnEscape={!processing}
      ariaLabel="Edit video"
      cardClassName="app-settings-popup-card"
      cardStyle={{
          width: `min(100%, ${popupMaxWidth})`,
          "--video-editor-max-width": popupMaxWidth,
          "--video-editor-aspect-ratio": videoAspectRatio,
          overflow: "hidden",
      }}
    >
      <div
        className="app-settings-popup app-media-editor-popup"
      >
        <header className="app-popup-compact-header">
          <div>
            <h2>{queueTotal > 1 ? `Edit video · ${queueIndex + 1} of ${queueTotal}` : "Edit video"}</h2>
            {widgetCount > 0 ? (
              <span className="video-editor-popup__meta">
                {widgetCount} widget{widgetCount === 1 ? "" : "s"} baked in
              </span>
            ) : null}
          </div>
          <div className="app-popup-compact-header__actions">
            <Button variant="primary" size="sm" onClick={handleSavePress} disabled={!videoLoaded || processing}>
              {processing ? "Processing..." : "Save edits"}
            </Button>
            {onSkip ? (
              <Button variant="secondary" size="sm" onClick={() => onSkip?.(videoFile)} disabled={processing || !videoLoaded}>
                Keep original
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={processing}>
              Close
            </Button>
          </div>
        </header>

        {/* Media preview stays on the popup card's own --surface layer; the editing
            controls below sit in their own --theme card (ladder, §3.0a-2). */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            flex: "0 1 auto",
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
              const target = event.currentTarget;
              const next = Number(target.duration || 0);
              const width = Number(target.videoWidth || 0);
              const height = Number(target.videoHeight || 0);
              if (width > 0 && height > 0) setVideoAspectRatio(width / height);
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
              if (cut) {
                v.currentTime = cut.end;
                return;
              }
              if (v.currentTime >= trimEnd) {
                v.pause();
                v.currentTime = trimStart;
                setIsPlaying(false);
              }
            }}
            onEnded={(event) => {
              event.currentTarget.currentTime = trimStart;
              setIsPlaying(false);
            }}
          />

        </div>

        <LayerTheme
          sectionKey="video-editor-controls"
          parentKey="shared-popup-card"
          style={{ flex: "0 1 auto", minHeight: 0 }}
        >
          {onBack || onNext ? (
            <div style={{ display: "flex", gap: 10, flex: "0 0 auto" }}>
              <Button type="button" variant="secondary" size="sm" onClick={handleBackPress} disabled={!onBack || processing || !videoLoaded}>
                Back
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleNextPress} disabled={!onNext || processing || !videoLoaded}>
                Next
              </Button>
            </div>
          ) : null}

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

          {busyLabel || errorLabel ? (
            <div className={`video-editor-popup__status ${errorLabel ? "is-error" : ""}`} role={errorLabel ? "alert" : undefined}>
              {errorLabel || busyLabel}
            </div>
          ) : null}
        </LayerTheme>
      </div>
    </PopupModal>
  );
}
