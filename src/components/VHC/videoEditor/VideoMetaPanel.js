// file location: src/components/VHC/videoEditor/VideoMetaPanel.js
// Right-hand sidebar for the editor. Three cards: clip info,
// audio toggle (proper switch), and collapsible tips. Designed to be
// scannable — labels are human-friendly and the tips section is
// visually de-emphasised so it doesn't compete with the controls.

import React, { useState } from "react";

function formatTime(seconds = 0) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const cardStyle = {
  background: "var(--hud-surface-strong)",
  border: "1px solid var(--hud-divider)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-4)",
  display: "grid",
  gap: "var(--space-3)",
};

const cardTitleStyle = {
  fontSize: "var(--text-caption)",
  color: "var(--hud-text-muted)",
  fontWeight: 800,
  letterSpacing: "var(--tracking-caps)",
  textTransform: "uppercase",
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "var(--text-body-sm)",
};

const valueStyle = {
  color: "var(--hud-text)",
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
};

export default function VideoMetaPanel({
  duration,
  trimmedDuration,
  widgetCount,
  isMuted,
  onToggleMute,
  busyLabel,
  errorLabel,
  disabled,
}) {
  const [tipsOpen, setTipsOpen] = useState(false);

  return (
    <aside
      style={{
        display: "grid",
        gap: "var(--space-3)",
        alignContent: "start",
        overflow: "auto",
        minHeight: 0,
      }}
    >
      {/* Clip info */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Clip info</div>
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <div style={rowStyle}>
            <span style={{ color: "var(--hud-text-muted)" }}>Original video length</span>
            <span style={valueStyle}>{formatTime(duration)}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: "var(--hud-text-muted)" }}>Trimmed video length</span>
            <span style={valueStyle}>{formatTime(trimmedDuration)}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: "var(--hud-text-muted)" }}>Baked widgets</span>
            <span style={valueStyle}>{widgetCount}</span>
          </div>
        </div>
      </div>

      {/* Audio */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Audio</div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--hud-text)",
              fontWeight: 600,
              lineHeight: "var(--leading-normal)",
            }}
          >
            Include audio in final video
          </span>
          <Switch checked={!isMuted} onChange={onToggleMute} disabled={disabled} />
        </label>
      </div>

      {/* Tips (collapsed by default, lower visual weight) */}
      <div
        style={{
          ...cardStyle,
          background: "rgba(255,255,255,0.03)",
          opacity: 0.85,
          gap: "var(--space-2)",
        }}
      >
        <button
          type="button"
          onClick={() => setTipsOpen((v) => !v)}
          style={{
            background: "transparent",
            border: 0,
            padding: 0,
            color: "var(--hud-text-muted)",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "var(--text-caption)",
            fontWeight: 800,
            letterSpacing: "var(--tracking-caps)",
            textTransform: "uppercase",
          }}
          aria-expanded={tipsOpen}
        >
          <span>Tips</span>
          <span aria-hidden style={{ fontSize: "var(--text-body-sm)" }}>
            {tipsOpen ? "−" : "+"}
          </span>
        </button>
        {tipsOpen ? (
          <div
            style={{
              display: "grid",
              gap: "var(--space-1)",
              fontSize: "var(--text-body-sm)",
              color: "var(--hud-text-muted)",
              lineHeight: "var(--leading-normal)",
            }}
          >
            <div>Keep clips short so the customer sees the issue quickly on mobile.</div>
            <div>Mute the clip if workshop noise makes the voiceover harder to follow.</div>
            <div>Baked widgets stay in the file — you don&apos;t need to re-add them later.</div>
          </div>
        ) : null}
      </div>

      {(busyLabel || errorLabel) ? (
        <div
          role={errorLabel ? "alert" : undefined}
          style={{
            padding: "var(--space-sm) var(--space-3)",
            borderRadius: "var(--radius-md)",
            background: errorLabel ? "rgba(var(--danger-rgb), 0.16)" : "rgba(var(--accentMainRgb), 0.12)",
            color: errorLabel ? "rgba(var(--danger-rgb), 1)" : "var(--hud-text)",
            fontSize: "var(--text-body-sm)",
            fontWeight: 700,
            border: "none",
          }}
        >
          {errorLabel || busyLabel}
        </div>
      ) : null}
    </aside>
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
        width: 48,
        height: 44,
        borderRadius: "var(--control-radius)",
        border: "1px solid var(--hud-divider)",
        background: checked ? "rgba(59,130,246,0.85)" : "rgba(255,255,255,0.12)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 160ms ease",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "50%",
          left: checked ? 22 : 2,
          width: 22,
          height: 22,
          transform: "translateY(-50%)",
          borderRadius: "50%",
          background: "#fff",
          transition: "left 160ms ease, transform 160ms ease",
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
        }}
      />
    </button>
  );
}
