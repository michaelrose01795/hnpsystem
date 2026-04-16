// file location: src/components/VHC/mediaCapture/ConcernPanel.js
// Left-side panel rendered as a glass overlay on top of the full-screen
// camera view. Rows are toggles: tapping a row either drops a widget at
// the centre of the capture area or removes the existing one for that
// row. The panel reflects this with an "on" visual state on any row
// whose widget is currently showing.

import React from "react"; // React primitive (no hooks needed here)

// Colour lookups for status pills on each row. Values are deliberately
// translucent so the camera view remains discernible behind each row.
// `bgActive` is used when the row's widget is currently on-screen — a
// slightly stronger fill so the toggled state reads clearly at a glance.
const STATUS_STYLES = { // Per-status visual style
  red: { bg: "rgba(239, 68, 68, 0.22)", bgActive: "rgba(239, 68, 68, 0.34)", border: "rgba(239, 68, 68, 0.72)", label: "#fecaca", title: "Red" }, // Red concern
  amber: { bg: "rgba(245, 158, 11, 0.20)", bgActive: "rgba(245, 158, 11, 0.34)", border: "rgba(245, 158, 11, 0.70)", label: "#fde68a", title: "Amber" }, // Amber concern
  green: { bg: "rgba(16, 185, 129, 0.18)", bgActive: "rgba(16, 185, 129, 0.32)", border: "rgba(16, 185, 129, 0.60)", label: "#bbf7d0", title: "Green" }, // Green / good
  default: { bg: "rgba(59, 130, 246, 0.18)", bgActive: "rgba(59, 130, 246, 0.32)", border: "rgba(59, 130, 246, 0.60)", label: "#bfdbfe", title: "Info" }, // Fallback
};

// Active border colour applied when a row's widget is currently visible.
const ACTIVE_BORDER = "rgba(255, 255, 255, 0.82)"; // Bright white edge so toggled rows pop

// Single row inside the panel.
function ConcernRow({ row, onInsert, isLive, isActive }) {
  const status = STATUS_STYLES[row.status] || STATUS_STYLES.default; // Resolve palette

  // Secondary label text that explains the current tap behaviour.
  const secondary = isActive // Currently on-screen?
    ? "On • Tap to hide" // Tapping again will remove
    : `${status.title}${isLive ? " • Tap to overlay" : ""}`; // Otherwise show status (+ live hint)

  return (
    <button
      type="button"
      onClick={() => onInsert?.(row)}
      aria-pressed={isActive}
      style={{
        width: "100%", // Full panel width
        textAlign: "left", // Left-justified for readability
        display: "grid", // Three cells: marker + label + value
        gridTemplateColumns: "10px 1fr auto", // Marker dot, label, measurement pill
        alignItems: "center", // Vertical centre
        gap: 8, // Space between cells
        padding: "11px 12px", // Generous tap target
        border: `1px solid ${isActive ? ACTIVE_BORDER : status.border}`, // Active border is white
        borderRadius: 12, // Rounded corners
        background: isActive ? status.bgActive : status.bg, // Stronger fill when active
        color: "#f8fafc", // Light text on dark base
        cursor: "pointer", // Tappable feel
        transition: "transform 120ms ease, background-color 120ms ease, border-color 120ms ease", // Smooth state change
        backdropFilter: "blur(2px)", // Gentle extra blur so rows legibly sit on camera
        boxShadow: isActive ? "0 0 0 1px rgba(255,255,255,0.18) inset" : "none", // Subtle inset glow when active
      }}
      onMouseDown={(event) => { event.currentTarget.style.transform = "scale(0.97)"; }} // Press effect
      onMouseUp={(event) => { event.currentTarget.style.transform = "scale(1)"; }} // Release
      onMouseLeave={(event) => { event.currentTarget.style.transform = "scale(1)"; }} // Release if dragged off
    >
      {/* Left status marker dot (turns into a ring when active) */}
      <span
        aria-hidden="true"
        style={{
          width: 10, // Marker diameter
          height: 10, // Matches width
          borderRadius: 999, // Circle
          background: isActive ? "#ffffff" : status.border, // White when active, status colour otherwise
          boxShadow: isActive ? `0 0 0 2px ${status.border}` : "none", // Status-coloured ring when active
        }}
      />

      {/* Label + secondary caption */}
      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.01em", lineHeight: 1.2 }}>
          {row.label}
        </span>
        <span style={{ fontSize: 10, color: isActive ? "#f8fafc" : status.label, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {secondary}
        </span>
      </div>

      {/* Measurement pill */}
      <span
        style={{
          fontSize: 13, // Readable but not huge
          fontWeight: 800, // Heavy emphasis on the measurement
          padding: "6px 10px", // Pill padding
          borderRadius: 999, // Pill
          background: "rgba(15, 23, 42, 0.55)", // Dark pill for contrast
          color: "#f8fafc", // White text
          fontVariantNumeric: "tabular-nums", // Monospaced digits
          whiteSpace: "nowrap", // Don't wrap "3 mm"
        }}
      >
        {row.measurement || "—"}
      </span>
    </button>
  );
}

export default function ConcernPanel({
  tyres = [], // Tyre row list from buildInspectionConcerns
  brakes = [], // Brake row list from buildInspectionConcerns
  onInsertWidget, // (row) => void — toggles a widget for that row
  isLive = false, // True while recording (changes the hint text)
  collapsed = false, // True when the panel is collapsed to a rail
  onToggle, // () => void — collapse/expand toggle
  activeRowIds, // Set<string> of row IDs currently shown as widgets
}) {
  const total = (tyres?.length || 0) + (brakes?.length || 0); // Header counter
  const activeCount = activeRowIds ? activeRowIds.size : 0; // Number of widgets currently shown

  // Safe helper so the panel still works when no active set is supplied.
  const isRowActive = (rowId) => Boolean(activeRowIds && activeRowIds.has(rowId)); // Guarded lookup

  return (
    <aside
      aria-label="Inspection concerns"
      style={{
        pointerEvents: "auto", // Panel itself captures touches
        width: collapsed ? 52 : 260, // Narrower when collapsed; compact when expanded
        maxWidth: "72vw", // Never wider than most phones in landscape
        height: "100%", // Fill the positioned overlay container
        display: "flex", // Vertical stack
        flexDirection: "column", // Header → list
        gap: 0, // Tight inside
        padding: collapsed ? "10px 6px" : "12px 10px", // More padding when expanded
        background: "rgba(15, 23, 42, 0.38)", // Light glass — camera view shows through
        borderRadius: 18, // Rounded overlay card
        border: "1px solid rgba(255,255,255,0.10)", // Thin glassy edge
        backdropFilter: "blur(18px) saturate(140%)", // Strong blur keeps text crisp
        WebkitBackdropFilter: "blur(18px) saturate(140%)", // Safari prefix
        boxShadow: "0 20px 40px rgba(0,0,0,0.35)", // Drop shadow for separation
        transition: "width 180ms ease, padding 180ms ease", // Smooth collapse animation
        overflow: "hidden", // Clip children while collapsed
      }}
    >
      {/* Header + toggle row */}
      <div
        style={{
          display: "flex", // Horizontal
          alignItems: "center", // Vertical centre
          justifyContent: collapsed ? "center" : "space-between", // Toggle-only when collapsed
          marginBottom: collapsed ? 6 : 10, // Space under header
        }}
      >
        {!collapsed ? (
          <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 10, color: "#cbd5e1", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Inspection
            </span>
            <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {total > 0
                ? `${total} item${total === 1 ? "" : "s"}${activeCount > 0 ? ` • ${activeCount} on-screen` : ""}`
                : "No items to show"}
            </span>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand inspection panel" : "Collapse inspection panel"}
          style={{
            width: 36, // Touch target size
            height: 36, // Touch target size
            borderRadius: 999, // Circle
            border: "1px solid rgba(255,255,255,0.18)", // Thin border
            background: "rgba(15, 23, 42, 0.5)", // Dark pill
            color: "#f8fafc", // White icon colour
            fontSize: 16, // Arrow size
            fontWeight: 700, // Bold arrow
            display: "inline-flex", // Centre content
            alignItems: "center", // Centre
            justifyContent: "center", // Centre
            cursor: "pointer", // Tappable
            flexShrink: 0, // Don't let the toggle shrink
          }}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* List area — only when expanded */}
      {!collapsed ? (
        <div
          style={{
            flex: 1, // Take remaining space
            minHeight: 0, // Allow shrink for overflow
            overflowY: "auto", // Scroll list if many items
            display: "grid", // Stack sections
            gap: 12, // Space between tyres and brakes
            paddingRight: 4, // Subtle breathing room for scrollbar
          }}
        >
          {/* Tyres */}
          <section style={{ display: "grid", gap: 6 }}>
            <header style={{ fontSize: 10, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.08em", textTransform: "uppercase", paddingLeft: 4 }}>
              Tyres
            </header>
            {tyres.length === 0 ? (
              <div style={{ fontSize: 12, color: "#cbd5e1", padding: "4px 8px" }}>
                No tyre data yet.
              </div>
            ) : (
              tyres.map((row) => (
                <ConcernRow key={row.id} row={row} onInsert={onInsertWidget} isLive={isLive} isActive={isRowActive(row.id)} />
              ))
            )}
          </section>

          {/* Brakes */}
          <section style={{ display: "grid", gap: 6 }}>
            <header style={{ fontSize: 10, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.08em", textTransform: "uppercase", paddingLeft: 4 }}>
              Brakes
            </header>
            {brakes.length === 0 ? (
              <div style={{ fontSize: 12, color: "#cbd5e1", padding: "4px 8px" }}>
                No brake data yet.
              </div>
            ) : (
              brakes.map((row) => (
                <ConcernRow key={row.id} row={row} onInsert={onInsertWidget} isLive={isLive} isActive={isRowActive(row.id)} />
              ))
            )}
          </section>

          {/* Helpful footnote */}
          <div style={{ fontSize: 11, color: "#e2e8f0", background: "rgba(15,23,42,0.32)", padding: "8px 10px", borderRadius: 10, lineHeight: 1.4, border: "1px solid rgba(255,255,255,0.08)" }}>
            Tap a row to drop the widget at the crosshair. Tap again to hide it.
            {isLive ? " Long-press a widget to remove it while recording." : ""}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
