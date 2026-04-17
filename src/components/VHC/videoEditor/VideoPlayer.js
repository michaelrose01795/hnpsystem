// file location: src/components/VHC/videoEditor/VideoPlayer.js
// Primary video preview surface for the editor: renders the <video>
// element, a centred play/pause affordance with hover overlay, and a
// bottom time strip (current / total). Playback state is owned by the
// parent so a single source of truth drives the timeline too.

import React, { useState, useRef } from "react";

function formatTime(seconds = 0) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const VideoPlayer = React.forwardRef(function VideoPlayer(
  {
    src,
    isMuted,
    isPlaying,
    videoLoaded,
    loadError,
    currentTime,
    duration,
    trimStart,
    trimEnd,
    onTogglePlay,
    onLoadedMetadata,
    onError,
    onTimeUpdate,
    onEnded,
  },
  ref
) {
  const [hovering, setHovering] = useState(false);
  const hideTimerRef = useRef(null);

  return (
    <div
      onMouseEnter={() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setHovering(true);
      }}
      onMouseLeave={() => {
        hideTimerRef.current = setTimeout(() => setHovering(false), 100);
      }}
      style={{
        position: "relative",
        background: "#000",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        minHeight: 280,
        height: "100%",
        border: "1px solid var(--hud-divider)",
        boxShadow: "var(--hud-shadow-lg)",
      }}
    >
      <video
        ref={ref}
        src={src || undefined}
        controls={false}
        playsInline
        preload="auto"
        muted={isMuted}
        onClick={onTogglePlay}
        onLoadedMetadata={onLoadedMetadata}
        onError={onError}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          visibility: videoLoaded ? "visible" : "hidden",
          background: "#000",
          cursor: videoLoaded ? "pointer" : "default",
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
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 84,
            height: 84,
            borderRadius: "var(--radius-pill)",
            border: "1px solid rgba(255,255,255,0.35)",
            background: "rgba(15, 23, 42, 0.55)",
            color: "#fff",
            fontSize: 28,
            fontWeight: 700,
            cursor: "pointer",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            transition: "opacity 160ms ease, transform 160ms ease, box-shadow 160ms ease",
            opacity: isPlaying && !hovering ? 0 : hovering ? 1 : 0.85,
            boxShadow: hovering
              ? "0 0 0 6px rgba(255,255,255,0.08), 0 12px 32px rgba(0,0,0,0.5)"
              : "0 8px 24px rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: isPlaying ? 0 : 6,
          }}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>
      ) : null}

      {videoLoaded ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "var(--space-3) var(--space-4)",
            background: "linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0))",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#fff",
            fontSize: "var(--text-body-sm)",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700,
            pointerEvents: "none",
            opacity: hovering ? 1 : 0,
            transition: "opacity 160ms ease",
          }}
        >
          <span>{formatTime(currentTime)}</span>
          <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "var(--text-caption)" }}>
            Clip {formatTime(trimStart)} – {formatTime(trimEnd)}
          </span>
          <span>{formatTime(duration)}</span>
        </div>
      ) : null}
    </div>
  );
});

export default VideoPlayer;
