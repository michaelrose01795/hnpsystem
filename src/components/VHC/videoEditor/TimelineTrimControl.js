// file location: src/components/VHC/videoEditor/TimelineTrimControl.js
// Unified timeline + edit controls. One track holds:
//   - dimmed regions outside [trimStart, trimEnd]
//   - the active clip range (blue tint)
//   - red-striped "cut" segments removed from the middle
//   - thin dashed split markers
//   - draggable trim handles (amber start, red end)
//   - an independent blue playhead
// A toolbar on top of the track exposes the audio switch and the
// Split / Remove section / Reset controls. Pointer events handle mouse
// and touch uniformly with generous hit areas for handles.

import React, { useCallback, useEffect, useRef, useState } from "react";

const PLAYHEAD_COLOR = "#3b82f6";
const START_COLOR = "var(--warning)";
const END_COLOR = "var(--danger)";
const CUT_STRIPE = "repeating-linear-gradient(45deg, rgba(239,68,68,0.55) 0 8px, rgba(239,68,68,0.25) 8px 16px)";

function formatTime(seconds = 0) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Find the [start, end] segment containing `time`, bounded by trim handles
// and split markers (and existing cuts so removed regions are skipped).
function segmentContaining(time, trimStart, trimEnd, splits, cuts) {
  const boundaries = new Set([trimStart, trimEnd, ...splits]);
  cuts.forEach((c) => { boundaries.add(c.start); boundaries.add(c.end); });
  const sorted = [...boundaries].filter((b) => b >= trimStart && b <= trimEnd).sort((a, b) => a - b);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (time >= a && time <= b) {
      const isAlreadyCut = cuts.some((c) => Math.abs(c.start - a) < 0.001 && Math.abs(c.end - b) < 0.001);
      if (isAlreadyCut) return null;
      return { start: a, end: b };
    }
  }
  return null;
}

export default function TimelineTrimControl({
  duration = 0,
  currentTime = 0,
  trimStart = 0,
  trimEnd = 0,
  onSeek,
  onTrimStartChange,
  onTrimEndChange,
  onScrubStart,
  onScrubEnd,
  disabled = false,
  isMuted,
  onToggleMute,
  splits = [],
  cuts = [],
  onSplitsChange,
  onCutsChange,
}) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(null);

  const pct = (t) => (duration > 0 ? (t / duration) * 100 : 0);

  const positionFromEvent = useCallback(
    (event) => {
      const el = trackRef.current;
      if (!el || duration <= 0) return 0;
      const rect = el.getBoundingClientRect();
      const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      return ratio * duration;
    },
    [duration]
  );

  const handleMove = useCallback(
    (event) => {
      if (!dragging) return;
      const t = positionFromEvent(event);
      if (dragging === "start") onTrimStartChange?.(t);
      else if (dragging === "end") onTrimEndChange?.(t);
      else if (dragging === "playhead") onSeek?.(clamp(t, trimStart, trimEnd));
    },
    [dragging, positionFromEvent, onSeek, onTrimStartChange, onTrimEndChange, trimStart, trimEnd]
  );

  useEffect(() => {
    if (!dragging) return undefined;
    const end = () => {
      setDragging(null);
      onScrubEnd?.();
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging, handleMove, onScrubEnd]);

  const startDrag = (which) => (event) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    onScrubStart?.(which);
    setDragging(which);
  };

  const handleTrackPointerDown = (event) => {
    if (disabled) return;
    const t = positionFromEvent(event);
    onScrubStart?.("playhead");
    onSeek?.(clamp(t, trimStart, trimEnd));
    setDragging("playhead");
  };

  const handleSplit = () => {
    if (disabled || !onSplitsChange) return;
    if (currentTime <= trimStart + 0.05 || currentTime >= trimEnd - 0.05) return;
    if (splits.some((s) => Math.abs(s - currentTime) < 0.05)) return;
    onSplitsChange([...splits, currentTime].sort((a, b) => a - b));
  };

  const handleRemoveSection = () => {
    if (disabled || !onCutsChange) return;
    const seg = segmentContaining(currentTime, trimStart, trimEnd, splits, cuts);
    if (!seg) return;
    onCutsChange([...cuts, seg].sort((a, b) => a.start - b.start));
  };

  const handleResetEdits = () => {
    onSplitsChange?.([]);
    onCutsChange?.([]);
  };

  const startPct = pct(trimStart);
  const endPct = pct(trimEnd);
  const headPct = pct(currentTime);

  return (
    <div
      style={{
        background: "var(--surfaceMain)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        padding: "var(--space-4)",
        display: "grid",
        gap: "var(--space-3)",
        opacity: disabled ? 0.6 : 1,
        color: "var(--surfaceText)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: "var(--text-caption)",
          color: "var(--surfaceTextMuted)",
          letterSpacing: "var(--tracking-caps)",
          textTransform: "uppercase",
          fontWeight: 800,
        }}
      >
        <span>Timeline</span>
        <span style={{ color: "var(--surfaceText)", fontVariantNumeric: "tabular-nums" }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Toolbar: audio toggle + edit actions */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: "var(--text-body-sm)",
            color: "var(--surfaceText)",
            fontWeight: 600,
          }}
        >
          <Switch checked={!isMuted} onChange={onToggleMute} disabled={disabled} />
          <span>Include audio</span>
        </label>

        <div style={{ display: "inline-flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <ToolButton onClick={handleSplit} disabled={disabled}>
            <span aria-hidden>✂</span> Split at playhead
          </ToolButton>
          <ToolButton
            onClick={handleRemoveSection}
            disabled={disabled || !segmentContaining(currentTime, trimStart, trimEnd, splits, cuts)}
            tone="danger"
          >
            <span aria-hidden>−</span> Remove section
          </ToolButton>
          <ToolButton
            onClick={handleResetEdits}
            disabled={disabled || (splits.length === 0 && cuts.length === 0)}
            tone="ghost"
          >
            Reset cuts
          </ToolButton>
        </div>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        style={{
          position: "relative",
          height: 56,
          borderRadius: "var(--radius-md)",
          background: "var(--control-bg)",
          border: "1px solid var(--border)",
          cursor: disabled ? "not-allowed" : "pointer",
          touchAction: "none",
          userSelect: "none",
          marginBottom: 18,
        }}
      >
        {/* Dim region left of trim start */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            right: `${100 - startPct}%`,
            background: "rgba(0,0,0,0.35)",
            borderTopLeftRadius: "var(--radius-md)",
            borderBottomLeftRadius: "var(--radius-md)",
            pointerEvents: "none",
          }}
        />
        {/* Dim region right of trim end */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            left: `${endPct}%`,
            background: "rgba(0,0,0,0.35)",
            borderTopRightRadius: "var(--radius-md)",
            borderBottomRightRadius: "var(--radius-md)",
            pointerEvents: "none",
          }}
        />
        {/* Active clip range */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${startPct}%`,
            right: `${100 - endPct}%`,
            background: "linear-gradient(180deg, rgba(59,130,246,0.18), rgba(59,130,246,0.08))",
            borderTop: "1px solid rgba(59,130,246,0.45)",
            borderBottom: "1px solid rgba(59,130,246,0.45)",
            pointerEvents: "none",
          }}
        />

        {/* Cut sections */}
        {cuts.map((c, i) => (
          <div
            key={`cut-${i}`}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${pct(c.start)}%`,
              width: `${pct(c.end) - pct(c.start)}%`,
              background: CUT_STRIPE,
              borderLeft: "1px solid rgba(239,68,68,0.85)",
              borderRight: "1px solid rgba(239,68,68,0.85)",
              pointerEvents: "none",
            }}
            aria-label={`Removed section ${formatTime(c.start)} to ${formatTime(c.end)}`}
          />
        ))}

        {/* Split markers */}
        {splits.map((s, i) => (
          <div
            key={`split-${i}`}
            style={{
              position: "absolute",
              top: -4,
              bottom: -4,
              left: `${pct(s)}%`,
              width: 0,
              borderLeft: "2px dashed rgba(255,255,255,0.85)",
              transform: "translateX(-1px)",
              pointerEvents: "none",
              filter: "drop-shadow(0 0 2px rgba(0,0,0,0.6))",
            }}
            aria-label={`Split at ${formatTime(s)}`}
          />
        ))}

        {/* Start handle */}
        <Handle
          leftPct={startPct}
          color={START_COLOR}
          label={formatTime(trimStart)}
          onPointerDown={startDrag("start")}
          disabled={disabled}
          ariaLabel="Trim start"
        />

        {/* End handle */}
        <Handle
          leftPct={endPct}
          color={END_COLOR}
          label={formatTime(trimEnd)}
          onPointerDown={startDrag("end")}
          disabled={disabled}
          ariaLabel="Trim end"
        />

        {/* Playhead */}
        <div
          onPointerDown={(e) => {
            if (disabled) return;
            e.stopPropagation();
            e.preventDefault();
            onScrubStart?.("playhead");
            setDragging("playhead");
          }}
          role="slider"
          aria-label="Playhead"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          style={{
            position: "absolute",
            left: `${headPct}%`,
            top: -6,
            bottom: -6,
            width: 2,
            background: PLAYHEAD_COLOR,
            transform: "translateX(-1px)",
            boxShadow: "0 0 10px rgba(59,130,246,0.6)",
            cursor: disabled ? "not-allowed" : "grab",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -6,
              left: "50%",
              transform: "translateX(-50%)",
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: PLAYHEAD_COLOR,
              border: "2px solid #fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
            }}
          />
          <div
            style={{ position: "absolute", top: -12, bottom: -12, left: -10, width: 22 }}
          />
        </div>
      </div>

      <Legend />
    </div>
  );
}

function Handle({ leftPct, color, label, onPointerDown, disabled, ariaLabel }) {
  return (
    <div
      onPointerDown={onPointerDown}
      role="slider"
      aria-label={ariaLabel}
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        top: -4,
        bottom: -4,
        width: 4,
        background: color,
        transform: "translateX(-2px)",
        borderRadius: 2,
        cursor: disabled ? "not-allowed" : "ew-resize",
        touchAction: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 14,
          height: 34,
          background: color,
          borderRadius: 4,
          boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.35)",
        }}
      />
      <div
        style={{ position: "absolute", top: -10, bottom: -10, left: -14, width: 32 }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -22,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "1px 6px",
          borderRadius: 4,
          background: "rgba(0,0,0,0.6)",
          fontSize: "var(--text-caption)",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 800,
          color: color,
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Legend() {
  const item = (color, text, swatchStyle) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 12,
          height: 10,
          borderRadius: 2,
          background: color,
          display: "inline-block",
          ...swatchStyle,
        }}
      />
      <span>{text}</span>
    </span>
  );
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-4)",
        flexWrap: "wrap",
        fontSize: "var(--text-caption)",
        color: "var(--surfaceTextMuted)",
      }}
    >
      {item(START_COLOR, "Start")}
      {item(END_COLOR, "End")}
      {item(PLAYHEAD_COLOR, "Playhead")}
      {item(CUT_STRIPE, "Removed", { backgroundSize: "auto" })}
    </div>
  );
}

function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.()}
      style={{
        position: "relative",
        width: 44,
        height: 26,
        borderRadius: 999,
        border: "1px solid var(--border)",
        background: checked ? "var(--accentMain)" : "var(--control-bg)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 160ms ease",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 20 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 160ms ease",
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
        }}
      />
    </button>
  );
}

function ToolButton({ onClick, disabled, tone = "default", children }) {
  const palette = {
    default: { bg: "var(--control-bg)", color: "var(--surfaceText)", border: "var(--border)" },
    danger: { bg: "rgba(var(--danger-rgb), 0.12)", color: "var(--danger)", border: "rgba(var(--danger-rgb), 0.4)" },
    ghost: { bg: "transparent", color: "var(--surfaceTextMuted)", border: "var(--border)" },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: 32,
        padding: "0 var(--space-3)",
        borderRadius: "var(--radius-pill)",
        background: palette.bg,
        color: palette.color,
        border: `1px solid ${palette.border}`,
        fontSize: "var(--text-caption)",
        fontWeight: 700,
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background-color 160ms ease, opacity 160ms ease",
      }}
    >
      {children}
    </button>
  );
}
