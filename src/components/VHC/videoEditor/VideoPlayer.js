// file location: src/components/VHC/videoEditor/VideoPlayer.js
// Primary video preview surface for the editor. Playback state is owned
// by the parent so a single source of truth drives the timeline too.

import React, { useRef, useState } from "react";

function formatTime(seconds = 0) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const VideoPlayer = React.forwardRef(function VideoPlayer(
  {
    src,
    isMuted,
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
      className="video-editor-player"
      onMouseEnter={() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setHovering(true);
      }}
      onMouseLeave={() => {
        hideTimerRef.current = setTimeout(() => setHovering(false), 100);
      }}
    >
      <video
        className="video-editor-player__video"
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
        style={{ visibility: videoLoaded ? "visible" : "hidden" }}
      />

      {!videoLoaded ? (
        <div className="video-editor-player__loading">
          <div className="video-editor-player__loading-content">
            <div className="video-editor-player__loading-title">
              {loadError || "Loading video..."}
            </div>
            <div className="video-editor-player__loading-copy">
              The editor will appear as soon as the recorded file is ready.
            </div>
          </div>
        </div>
      ) : null}

      {videoLoaded ? (
        <div className="video-editor-player__time-strip" style={{ opacity: hovering ? 1 : 0 }}>
          <span>{formatTime(currentTime)}</span>
          <span className="video-editor-player__clip-range">
            Clip {formatTime(trimStart)} - {formatTime(trimEnd)}
          </span>
          <span>{formatTime(duration)}</span>
        </div>
      ) : null}
    </div>
  );
});

export default VideoPlayer;
