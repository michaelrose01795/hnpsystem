// file location: src/components/VHC/VideoEditorModal.js
import React, { useState, useRef, useEffect } from "react";
import VHCModalShell, { buildModalButton } from "./VHCModalShell";

export default function VideoEditorModal({ isOpen, videoFile, onSave, onCancel, onSkip }) {
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);

  const videoRef = useRef(null);
  const videoUrlRef = useRef(null);

  // Load video when modal opens
  useEffect(() => {
    if (isOpen && videoFile) {
      loadVideo();
    }

    return () => {
      // Cleanup
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
      }
    };
  }, [isOpen, videoFile]);

  // Load video
  const loadVideo = () => {
    const video = videoRef.current;
    if (!video) return;

    const url = URL.createObjectURL(videoFile);
    videoUrlRef.current = url;
    video.src = url;

    video.onloadedmetadata = () => {
      const dur = video.duration;
      setDuration(dur);
      setTrimStart(0);
      setTrimEnd(dur);
      setVideoLoaded(true);
    };

    video.ontimeupdate = () => {
      setCurrentTime(video.currentTime);

      // Stop at trim end
      if (video.currentTime >= trimEnd) {
        video.pause();
        setIsPlaying(false);
        video.currentTime = trimStart;
      }
    };

    video.onended = () => {
      setIsPlaying(false);
      video.currentTime = trimStart;
    };
  };

  // Play/Pause
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      // Start from trim start if before it or after trim end
      if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
      }
      video.play();
      setIsPlaying(true);
    }
  };

  // Seek to position
  const seekTo = (time) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = time;
    setCurrentTime(time);
  };

  // Handle trim start change
  const handleTrimStartChange = (value) => {
    const newStart = Math.max(0, Math.min(value, trimEnd - 1));
    setTrimStart(newStart);

    // Move playhead if it's before trim start
    if (currentTime < newStart) {
      seekTo(newStart);
    }
  };

  // Handle trim end change
  const handleTrimEndChange = (value) => {
    const newEnd = Math.min(duration, Math.max(value, trimStart + 1));
    setTrimEnd(newEnd);

    // Move playhead if it's after trim end
    if (currentTime >= newEnd) {
      seekTo(trimStart);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Format time (seconds to MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Export trimmed/muted video
  const exportVideo = async () => {
    try {
      setProcessing(true);

      const video = videoRef.current;
      if (!video) return;

      // If no trimming and no muting, use original file
      if (trimStart === 0 && trimEnd === duration && !isMuted) {
        onSave(videoFile);
        return;
      }

      // Create a new video with trim/mute
      // For browser-based trimming, we'll use MediaRecorder to re-encode
      const stream = video.captureStream();

      // Remove audio track if muted
      if (isMuted) {
        const audioTracks = stream.getAudioTracks();
        audioTracks.forEach(track => {
          stream.removeTrack(track);
        });
      }

      const options = { mimeType: "video/webm;codecs=vp9" };

      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = "video/webm;codecs=vp8";
      }

      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = "video/webm";
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const fileName = `edited_video_${Date.now()}.webm`;
        const file = new File([blob], fileName, { type: "video/webm" });
        setProcessing(false);
        onSave(file);
      };

      // Seek to trim start
      video.currentTime = trimStart;

      // Wait for seek to complete
      video.onseeked = () => {
        // Start recording
        mediaRecorder.start();
        video.play();

        // Stop recording at trim end
        const recordDuration = (trimEnd - trimStart) * 1000;
        setTimeout(() => {
          mediaRecorder.stop();
          video.pause();
        }, recordDuration);
      };
    } catch (err) {
      console.error("Error exporting video:", err);
      setProcessing(false);
      alert("Failed to export video. Please try again.");
    }
  };

  // Get trimmed duration
  const getTrimmedDuration = () => {
    return trimEnd - trimStart;
  };

  // Modal footer
  const footer = (
    <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", width: "100%" }}>
      <button
        onClick={onCancel}
        style={{
          ...buildModalButton("ghost"),
          padding: "10px 20px",
        }}
        disabled={processing}
      >
        Cancel
      </button>

      <div style={{ display: "flex", gap: "12px" }}>
        {onSkip && (
          <button
            onClick={() => onSkip(videoFile)}
            style={{
              ...buildModalButton("secondary"),
              padding: "10px 20px",
            }}
            disabled={processing || !videoLoaded}
          >
            Skip Editing
          </button>
        )}

        <button
          onClick={toggleMute}
          style={{
            ...buildModalButton(isMuted ? "danger" : "secondary"),
            padding: "10px 20px",
          }}
          disabled={processing}
        >
          {isMuted ? "🔇 Unmute" : "🔊 Mute"}
        </button>

        <button
          onClick={exportVideo}
          style={{
            ...buildModalButton("primary"),
            padding: "10px 20px",
          }}
          disabled={!videoLoaded || processing}
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
      subtitle="Trim video length and control audio"
      width="900px"
      height="700px"
      onClose={onCancel}
      footer={footer}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%" }}>
        {/* Video Player */}
        <div style={{
          flex: 1,
          background: "var(--background)",
          borderRadius: "12px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}>
          {!videoLoaded ? (
            <div style={{ textAlign: "center", color: "var(--info)" }}>
              <div style={{ fontSize: "48px", marginBottom: "8px" }}>🎥</div>
              <div style={{ fontSize: "14px" }}>Loading video...</div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  borderRadius: "8px",
                }}
                muted={isMuted}
              />

              {/* Play/Pause Overlay */}
              <button
                onClick={togglePlayPause}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "rgba(0, 0, 0, 0.6)",
                  border: "none",
                  color: "white",
                  fontSize: "24px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isPlaying ? 0 : 1,
                  transition: "opacity 0.3s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                onMouseLeave={(e) => e.currentTarget.style.opacity = isPlaying ? 0 : 1}
              >
                {isPlaying ? "⏸" : "▶"}
              </button>

              {/* Mute Indicator */}
              {isMuted && (
                <div style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  background: "rgba(220, 38, 38, 0.9)",
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}>
                  🔇 Muted
                </div>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        <div style={{
          background: "var(--surface)",
          borderRadius: "12px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}>
          {/* Timeline */}
          <div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "8px",
              fontSize: "13px",
              color: "var(--info)",
            }}>
              <span>Current: {formatTime(currentTime)}</span>
              <span>Duration: {formatTime(duration)}</span>
            </div>

            {/* Playhead Scrubber */}
            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={currentTime}
              onChange={(e) => seekTo(Number(e.target.value))}
              disabled={!videoLoaded}
              style={{
                width: "100%",
                height: "8px",
                borderRadius: "4px",
                outline: "none",
                appearance: "none",
                background: `linear-gradient(to right,
                  var(--accent-purple-surface) 0%,
                  var(--primary) ${(currentTime / duration) * 100}%,
                  var(--accent-purple-surface) ${(currentTime / duration) * 100}%)`,
              }}
            />
          </div>

          {/* Trim Controls */}
          <div style={{ display: "flex", gap: "20px" }}>
            {/* Trim Start */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--accent-purple)",
                marginBottom: "8px",
                display: "flex",
                justifyContent: "space-between",
              }}>
                <span>Trim Start</span>
                <span>{formatTime(trimStart)}</span>
              </div>
              <input
                type="range"
                min="0"
                max={duration}
                step="0.1"
                value={trimStart}
                onChange={(e) => handleTrimStartChange(Number(e.target.value))}
                disabled={!videoLoaded}
                style={{
                  width: "100%",
                }}
              />
            </div>

            {/* Trim End */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--accent-purple)",
                marginBottom: "8px",
                display: "flex",
                justifyContent: "space-between",
              }}>
                <span>Trim End</span>
                <span>{formatTime(trimEnd)}</span>
              </div>
              <input
                type="range"
                min="0"
                max={duration}
                step="0.1"
                value={trimEnd}
                onChange={(e) => handleTrimEndChange(Number(e.target.value))}
                disabled={!videoLoaded}
                style={{
                  width: "100%",
                }}
              />
            </div>
          </div>

          {/* Info */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "12px",
            background: "var(--accent-purple-surface)",
            borderRadius: "8px",
            fontSize: "13px",
          }}>
            <div>
              <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>Trimmed Duration: </span>
              <span style={{ color: "var(--text)" }}>{formatTime(getTrimmedDuration())}</span>
            </div>
            <div>
              <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>Audio: </span>
              <span style={{ color: isMuted ? "var(--danger)" : "var(--success)" }}>
                {isMuted ? "Muted" : "Enabled"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </VHCModalShell>
  );
}
