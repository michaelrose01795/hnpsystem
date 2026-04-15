// file location: src/components/VHC/VideoEditorModal.js
// Large near full-screen editor for reviewing, trimming, and muting recorded VHC videos.

import React, { useEffect, useMemo, useRef, useState } from "react";
import VHCModalShell, { buildModalButton } from "./VHCModalShell";

function formatTime(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function VideoEditorModal({ isOpen, videoFile, onSave, onCancel, onSkip }) {
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

  const getPreferredVideoMimeType = () => {
    const candidates = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  };

  const seekTo = (time) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  };

  const togglePlayPause = async () => {
    const video = videoRef.current;
    if (!video || !videoLoaded) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      return;
    }

    if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
      video.currentTime = trimStart;
    }

    try {
      await video.play();
      setIsPlaying(true);
    } catch (playError) {
      console.error("Video playback failed:", playError);
      setLoadError("Video playback was blocked by the browser.");
    }
  };

  const handleTrimStartChange = (value) => {
    const nextStart = Math.max(0, Math.min(value, trimEnd - 0.2));
    setTrimStart(nextStart);
    if (currentTime < nextStart) {
      seekTo(nextStart);
    }
  };

  const handleTrimEndChange = (value) => {
    const nextEnd = Math.min(duration, Math.max(value, trimStart + 0.2));
    setTrimEnd(nextEnd);
    if (currentTime >= nextEnd) {
      seekTo(trimStart);
    }
  };

  const exportVideo = async () => {
    try {
      setProcessing(true);
      const video = videoRef.current;
      if (!video) return;

      if (trimStart === 0 && trimEnd === duration && !isMuted) {
        onSave?.(videoFile);
        return;
      }

      const stream = video.captureStream();

      if (isMuted) {
        stream.getAudioTracks().forEach((track) => {
          stream.removeTrack(track);
        });
      }

      const preferredMimeType = getPreferredVideoMimeType();
      const recorder = new MediaRecorder(
        stream,
        preferredMimeType ? { mimeType: preferredMimeType } : {}
      );
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = preferredMimeType || "video/webm";
        const extension = mimeType.includes("mp4") ? "mp4" : "webm";
        const editedBlob = new Blob(chunks, { type: mimeType });
        const editedFile = new File([editedBlob], `edited_video_${Date.now()}.${extension}`, { type: mimeType });
        setProcessing(false);
        onSave?.(editedFile);
      };

      video.pause();
      video.currentTime = trimStart;

      const handleSeeked = async () => {
        video.removeEventListener("seeked", handleSeeked);
        recorder.start();
        await video.play();
        window.setTimeout(() => {
          recorder.stop();
          video.pause();
          setIsPlaying(false);
        }, Math.max(100, (trimEnd - trimStart) * 1000));
      };

      video.addEventListener("seeked", handleSeeked);
    } catch (exportError) {
      console.error("Video export failed:", exportError);
      setProcessing(false);
      setLoadError("Unable to process the edited video in this browser.");
    }
  };

  const trimmedDuration = Math.max(0, trimEnd - trimStart);

  const footer = (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", width: "100%", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={onCancel}
        disabled={processing}
        style={{ ...buildModalButton("ghost"), padding: "12px 18px" }}
      >
        Cancel
      </button>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {onSkip ? (
          <button
            type="button"
            onClick={() => onSkip(videoFile)}
            disabled={processing || !videoLoaded}
            style={{ ...buildModalButton("secondary"), padding: "12px 18px" }}
          >
            Keep Original
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setIsMuted((current) => !current)}
          disabled={processing || !videoLoaded}
          style={{ ...buildModalButton(isMuted ? "danger" : "secondary"), padding: "12px 18px" }}
        >
          {isMuted ? "Muted" : "Audio On"}
        </button>

        <button
          type="button"
          onClick={exportVideo}
          disabled={!videoLoaded || processing}
          style={{ ...buildModalButton("primary"), padding: "12px 18px" }}
        >
          {processing ? "Processing..." : "Save Edits"}
        </button>
      </div>
    </div>
  );

  return (
    <VHCModalShell
      isOpen={isOpen}
      title="Edit Video"
      subtitle="Review the capture, adjust the trim points, and choose whether the audio stays on."
      width="min(96vw, 1440px)"
      height="min(95vh, 980px)"
      onClose={onCancel}
      footer={footer}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.45fr) minmax(320px, 0.9fr)",
          gap: "20px",
          height: "100%",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateRows: "minmax(0, 1fr) auto",
            gap: "18px",
            minHeight: 0,
          }}
        >
          <div
            style={{
              position: "relative",
              borderRadius: "24px",
              overflow: "hidden",
              background: "#020617",
              border: "1px solid rgba(148, 163, 184, 0.16)",
              minHeight: 0,
            }}
          >
            <video
              ref={videoRef}
              src={previewSource || undefined}
              controls={false}
              playsInline
              muted={isMuted}
              onLoadedMetadata={(event) => {
                const nextDuration = Number(event.currentTarget.duration || 0);
                setDuration(nextDuration);
                setTrimStart(0);
                setTrimEnd(nextDuration);
                setVideoLoaded(true);
                setLoadError("");
              }}
              onLoadedData={() => {
                setVideoLoaded(true);
                setLoadError("");
              }}
              onError={() => {
                setVideoLoaded(false);
                setIsPlaying(false);
                setLoadError("This browser could not load the captured video.");
              }}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                setCurrentTime(video.currentTime);
                if (video.currentTime >= trimEnd) {
                  video.pause();
                  video.currentTime = trimStart;
                  setIsPlaying(false);
                }
              }}
              onEnded={(event) => {
                event.currentTarget.currentTime = trimStart;
                setIsPlaying(false);
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                visibility: videoLoaded ? "visible" : "hidden",
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
                  padding: "24px",
                  color: "#fff",
                  textAlign: "center",
                }}
              >
                <div style={{ display: "grid", gap: "10px" }}>
                  <div style={{ fontSize: "20px", fontWeight: 700 }}>{loadError || "Loading video…"}</div>
                  <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.72)" }}>
                    The editor will appear as soon as the recorded file is ready.
                  </div>
                </div>
              </div>
            ) : null}

            {videoLoaded ? (
              <>
                <button
                  type="button"
                  onClick={togglePlayPause}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "82px",
                    height: "82px",
                    borderRadius: "999px",
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(15, 23, 42, 0.56)",
                    color: "#fff",
                    fontSize: "28px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(14px)",
                    boxShadow: "0 16px 40px rgba(0,0,0,0.32)",
                  }}
                >
                  {isPlaying ? "❚❚" : "▶"}
                </button>

                <div
                  style={{
                    position: "absolute",
                    left: "16px",
                    right: "16px",
                    bottom: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 14px",
                    borderRadius: "18px",
                    background: "rgba(15, 23, 42, 0.62)",
                    color: "#fff",
                    backdropFilter: "blur(14px)",
                  }}
                >
                  <div style={{ fontSize: "13px", fontWeight: 700 }}>{formatTime(currentTime)}</div>
                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.72)" }}>
                    {isMuted ? "Muted" : "Audio on"}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700 }}>{formatTime(duration)}</div>
                </div>
              </>
            ) : null}
          </div>

          <div
            style={{
              border: "1px solid var(--accent-surface)",
              borderRadius: "20px",
              background: "var(--surface)",
              padding: "18px",
              display: "grid",
              gap: "16px",
            }}
          >
            <div style={{ display: "grid", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)", fontWeight: 700 }}>
                    Playhead
                  </div>
                  <div style={{ fontSize: "15px", color: "var(--primary)", fontWeight: 700 }}>
                    Move through the clip
                  </div>
                </div>
                <div style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: 600 }}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.05"
                value={currentTime}
                onChange={(event) => seekTo(Number(event.target.value))}
                disabled={!videoLoaded}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px" }}>
              <div
                style={{
                  border: "1px solid var(--accent-surface)",
                  borderRadius: "18px",
                  background: "var(--surface-light)",
                  padding: "16px",
                  display: "grid",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ fontSize: "14px", color: "var(--primary)", fontWeight: 700 }}>Trim start</div>
                  <div style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: 600 }}>{formatTime(trimStart)}</div>
                </div>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.05"
                  value={trimStart}
                  onChange={(event) => handleTrimStartChange(Number(event.target.value))}
                  disabled={!videoLoaded}
                  style={{ width: "100%" }}
                />
              </div>

              <div
                style={{
                  border: "1px solid var(--accent-surface)",
                  borderRadius: "18px",
                  background: "var(--surface-light)",
                  padding: "16px",
                  display: "grid",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ fontSize: "14px", color: "var(--primary)", fontWeight: 700 }}>Trim end</div>
                  <div style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: 600 }}>{formatTime(trimEnd)}</div>
                </div>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.05"
                  value={trimEnd}
                  onChange={(event) => handleTrimEndChange(Number(event.target.value))}
                  disabled={!videoLoaded}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: "16px",
            alignContent: "start",
            minHeight: 0,
          }}
        >
          <div
            style={{
              border: "1px solid var(--accent-surface)",
              borderRadius: "22px",
              background: "var(--surface)",
              padding: "18px",
              display: "grid",
              gap: "12px",
            }}
          >
            <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)", fontWeight: 700 }}>
              Summary
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              {[
                { label: "Original length", value: formatTime(duration) },
                { label: "New length", value: formatTime(trimmedDuration) },
                { label: "Audio", value: isMuted ? "Muted" : "Enabled" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    border: "1px solid var(--accent-surface)",
                    borderRadius: "16px",
                    background: "var(--surface-light)",
                    padding: "14px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{item.label}</div>
                  <div style={{ fontSize: "15px", color: "var(--primary)", fontWeight: 700 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              border: "1px solid var(--accent-surface)",
              borderRadius: "22px",
              background: "var(--surface)",
              padding: "18px",
              display: "grid",
              gap: "12px",
            }}
          >
            <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)", fontWeight: 700 }}>
              Editing tips
            </div>
            <div style={{ display: "grid", gap: "10px", fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              <div>Use the playhead to review the clip before changing the trim points.</div>
              <div>Keep clips short and focused so the customer sees the issue quickly on mobile.</div>
              <div>Mute the clip if workshop noise makes the explanation harder to follow.</div>
            </div>
          </div>

          {loadError ? (
            <div
              style={{
                borderRadius: "18px",
                background: "var(--danger-surface)",
                color: "var(--danger)",
                padding: "14px 16px",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              {loadError}
            </div>
          ) : null}
        </div>
      </div>
    </VHCModalShell>
  );
}
