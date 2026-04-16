// file location: src/components/VHC/mediaCapture/FloatingWidget.js
// DOM representation of a floating in-recording widget. This mirrors the
// widget that `useWidgetRecorder` burns into the actual video frame —
// keeping the DOM version means the technician sees exactly what the
// customer will see on playback. A long-press removes the widget.
//
// UI philosophy (post-refinement):
//   - Only ONE widget is on-screen at a time, so the card can be large
//     and easy to read without crowding the frame.
//   - The severity colour already tells the viewer whether the item is
//     red / amber / green — we no longer duplicate that as a "RED" /
//     "AMBER" badge pill inside the card.
//   - For external concerns (wipers, lights, etc.) the caller sends an
//     empty title so the card shows only the issue text, which is the
//     meaningful information. For tyres / brakes we still show the
//     short title above a large value.
//   - Every widget is rendered at a fixed size so the frame looks
//     consistent no matter which concern is active.
//
// All colour / radius / spacing / typography values resolve through
// the --hud-*, --space, --radius and --tracking-* tokens in theme.css
// so the widget follows the user's theme.

import React, { useEffect, useRef } from "react";

// Fixed card dimensions so every widget occupies the same footprint.
const WIDGET_WIDTH = 320;
const WIDGET_HEIGHT = 120;

function toPercent(fraction) {
  const clamped = Math.max(0.06, Math.min(0.94, Number(fraction) || 0.5));
  return `${clamped * 100}%`;
}

const ACCENTS = {
  red: "var(--danger)",
  amber: "var(--warning)",
  green: "var(--success)",
  default: "var(--accentMain)",
};

export default function FloatingWidget({ widget, onRemove }) {
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const startLongPress = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onRemove?.(widget.id);
      timerRef.current = null;
    }, 500);
  };

  const cancelLongPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const accent = ACCENTS[widget.status] || ACCENTS.default;
  const title = String(widget.title || "").trim();
  const value = String(widget.value || "").trim();
  const hasTitle = title.length > 0;
  // If there's no title the value text can take the full card and scale
  // up to the big heading size for easy reading from behind the camera.
  const valueFontSize = hasTitle ? "var(--text-h3)" : "var(--text-h2)";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Overlay widget: ${title || value}. Long-press to remove.`}
      data-dev-section-key="capture-floating-widget"
      data-dev-section-type="content-card"
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
      style={{
        position: "absolute",
        top: toPercent(widget.y ?? 0.5),
        left: toPercent(widget.x ?? 0.5),
        transform: "translate(-50%, -50%)",
        display: "grid",
        gridTemplateColumns: "8px 1fr",
        alignItems: "center",
        gap: "var(--space-3)",
        width: WIDGET_WIDTH,
        height: WIDGET_HEIGHT,
        padding: "var(--space-3) var(--space-4)",
        background: "var(--hud-surface-glass)",
        color: "var(--hud-text)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--hud-shadow-md)",
        border: "1px solid var(--hud-divider)",
        pointerEvents: "auto",
        userSelect: "none",
        WebkitUserSelect: "none",
        animation: "hnpWidgetIn 180ms var(--ease-default)",
        fontFamily: "var(--font-family)",
        boxSizing: "border-box",
      }}
    >
      {/* Left accent strip — severity colour lives here; no badge pill. */}
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: "100%",
          borderRadius: "var(--radius-pill)",
          background: accent,
          alignSelf: "stretch",
        }}
      />

      {/* Text stack. The title is optional — external concerns don't
          carry one, so the value takes the whole card and scales up. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: hasTitle ? "var(--space-1)" : 0,
          minWidth: 0,
          height: "100%",
        }}
      >
        {hasTitle ? (
          <span
            style={{
              fontSize: "var(--text-body-sm)",
              fontWeight: 700,
              color: "var(--hud-text-muted)",
              lineHeight: "var(--leading-tight)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
        ) : null}
        <span
          style={{
            fontSize: valueFontSize,
            fontWeight: 800,
            color: "var(--hud-text)",
            lineHeight: "var(--leading-tight)",
            fontVariantNumeric: "tabular-nums",
            // Clamp long issue text (external concerns) to the card
            // height so every card keeps the same footprint.
            display: "-webkit-box",
            WebkitLineClamp: hasTitle ? 2 : 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
