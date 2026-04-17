// file location: src/components/VHC/photoEditor/ShapeToolbar.js
// Compact floating toolbar for the shape photo editor. Renders tool,
// colour and action buttons using global design tokens so it stays
// theme-aligned. Layout flips between a vertical rail on wide screens
// and a horizontal bar on narrow / touch viewports.

import React from "react";
import { SHAPE_TOOLS } from "./ShapeRenderer";

const TOOL_ICONS = {
  circle: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  square: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  line: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 17 L17 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  arrow: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 17 L16 4 M16 4 L10 4 M16 4 L16 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const TOOL_LABELS = {
  circle: "Circle",
  square: "Square",
  line: "Line",
  arrow: "Arrow",
};

// Four semantic colour swatches resolved from design tokens. Fallbacks
// mirror the light-mode token values so SSR renders look right.
export const PALETTE = [
  { id: "danger", token: "--dangerMain", fallback: "#ef4444", label: "Red" },
  { id: "warning", token: "--warningMain", fallback: "#f59e0b", label: "Amber" },
  { id: "success", token: "--successMain", fallback: "#22c55e", label: "Green" },
  { id: "accent", token: "--accentMain", fallback: "#3b82f6", label: "Blue" },
];

const BAR_BASE = {
  display: "flex",
  gap: "var(--space-2)",
  alignItems: "center",
  padding: "var(--space-2)",
  background: "var(--surfaceMain)",
  border: "1px solid var(--accentBorder)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-md)",
  backdropFilter: "saturate(1.2) blur(6px)",
  fontFamily: "var(--font-family)",
};

const DIVIDER = {
  width: 1,
  alignSelf: "stretch",
  background: "var(--accentBorder)",
  margin: "0 var(--space-1)",
};

function ToolButton({ active, disabled, onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active || undefined}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 38,
        height: 38,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${active ? "var(--accentBorderStrong)" : "transparent"}`,
        background: active ? "var(--accentSurfaceHover)" : "transparent",
        color: active ? "var(--accentMain)" : "var(--text-primary)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "var(--control-transition)",
      }}
    >
      {children}
    </button>
  );
}

function Swatch({ color, active, onClick, label }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={`Colour ${label}`}
      aria-pressed={active || undefined}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: color,
        border: active
          ? "3px solid var(--text-primary)"
          : "2px solid var(--accentBorder)",
        cursor: "pointer",
        padding: 0,
        transition: "var(--control-transition)",
      }}
    />
  );
}

export default function ShapeToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  onUndo,
  onClear,
  canUndo,
  canClear,
  orientation = "horizontal",
}) {
  const isVertical = orientation === "vertical";
  const barStyle = {
    ...BAR_BASE,
    flexDirection: isVertical ? "column" : "row",
    flexWrap: isVertical ? "nowrap" : "wrap",
  };
  const dividerStyle = isVertical
    ? { ...DIVIDER, width: "100%", height: 1, alignSelf: "auto", margin: "var(--space-1) 0" }
    : DIVIDER;

  return (
    <div role="toolbar" aria-label="Annotation tools" style={barStyle}>
      {SHAPE_TOOLS.map((id) => (
        <ToolButton
          key={id}
          active={tool === id}
          onClick={() => onToolChange(id)}
          title={TOOL_LABELS[id]}
        >
          {TOOL_ICONS[id]}
        </ToolButton>
      ))}

      <div style={dividerStyle} aria-hidden="true" />

      {PALETTE.map((p) => (
        <Swatch
          key={p.id}
          color={p.resolved || `var(${p.token}, ${p.fallback})`}
          active={color.id === p.id}
          onClick={() => onColorChange(p)}
          label={p.label}
        />
      ))}

      <div style={dividerStyle} aria-hidden="true" />

      <ToolButton title="Undo last" disabled={!canUndo} onClick={onUndo}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M7 5 L3 9 L7 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 9 H12 A5 5 0 0 1 17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      </ToolButton>
      <ToolButton title="Clear all" disabled={!canClear} onClick={onClear}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 6 H15 M8 6 V4 H12 V6 M7 6 L8 16 H12 L13 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </ToolButton>
    </div>
  );
}
