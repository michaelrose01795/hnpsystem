// file location: src/components/VHC/mediaCapture/ConcernPanel.js
// Left-side panel rendered as a glass overlay on top of the full-screen
// camera view. Rows are toggles: tapping a row either drops a widget at
// the centre of the capture area or removes the existing one for that
// row. The panel reflects this with an "on" visual state on any row
// whose widget is currently showing.
//
// All colour / radius / spacing / typography values resolve via the
// --hud-*, --space, --radius, --tracking-* and status RGB tokens in
// theme.css so changing the global theme flows straight through the
// panel.

import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";

const STATUS_STYLES = {
  red: {
    bg: "rgba(var(--danger-rgb), 0.22)",
    bgActive: "rgba(var(--danger-rgb), 0.34)",
    border: "none",
    label: "rgba(var(--danger-rgb), 0.85)",
    title: "Red",
  },
  amber: {
    bg: "rgba(var(--warning-rgb), 0.20)",
    bgActive: "rgba(var(--warning-rgb), 0.34)",
    border: "none",
    label: "rgba(var(--warning-rgb), 0.9)",
    title: "Amber",
  },
  green: {
    bg: "rgba(var(--success-rgb), 0.18)",
    bgActive: "rgba(var(--success-rgb), 0.32)",
    border: "none",
    label: "rgba(var(--success-rgb), 0.9)",
    title: "Green",
  },
  default: {
    bg: "rgba(var(--accentMainRgb), 0.18)",
    bgActive: "rgba(var(--accentMainRgb), 0.32)",
    border: "rgba(var(--accentMainRgb), 0.60)",
    label: "rgba(var(--accentMainRgb), 0.9)",
    title: "Info",
  },
};

const ACTIVE_BORDER = "var(--hud-border-strong)";

function ConcernRow({ row, onInsert, isActive }) {
  const status = STATUS_STYLES[row.status] || STATUS_STYLES.default;
  const measurement = String(row.measurement || "").trim();
  const showMeasurementPill = measurement.length > 0;

  return (
    <button
      type="button"
      onClick={() => onInsert?.(row)}
      aria-pressed={isActive}
      style={{
        width: "100%",
        textAlign: "left",
        display: "grid",
        // Grid columns adapt: the trailing measurement pill slot is
        // removed entirely when there's no measurement to show, so the
        // row reads cleanly (important for external issues which don't
        // carry a numeric measurement and would otherwise show a "—").
        gridTemplateColumns: showMeasurementPill ? "10px 1fr auto" : "10px 1fr",
        alignItems: "center",
        gap: "var(--space-sm)",
        padding: "var(--space-2) var(--space-3)",
        border: `1px solid ${isActive ? ACTIVE_BORDER : status.border}`,
        borderRadius: "var(--radius-sm)",
        background: isActive ? status.bgActive : status.bg,
        color: "var(--hud-text)",
        cursor: "pointer",
        transition: "var(--control-transition), transform var(--duration-fast) var(--ease-default)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        boxShadow: isActive ? "0 0 0 1px var(--hud-border) inset" : "none",
        fontFamily: "var(--font-family)",
      }}
      onPointerDown={(event) => { event.currentTarget.style.transform = "scale(0.97)"; }}
      onPointerUp={(event) => { event.currentTarget.style.transform = "scale(1)"; }}
      onPointerLeave={(event) => { event.currentTarget.style.transform = "scale(1)"; }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 10,
          height: 10,
          borderRadius: "var(--radius-pill)",
          background: isActive ? "var(--hud-text)" : status.border,
          boxShadow: isActive ? `0 0 0 2px ${status.border}` : "none",
        }}
      />

      {/* Main label. The status colour is already carried by the row
          background and the left marker dot, so we no longer show a
          redundant "Red" / "Amber" / "Tap to overlay" caption beneath
          — the colour IS the status. */}
      <span
        style={{
          fontSize: "var(--text-body-sm)",
          fontWeight: 700,
          letterSpacing: "0.01em",
          lineHeight: "var(--leading-tight)",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {row.label}
      </span>

      {showMeasurementPill ? (
        <span
          style={{
            fontSize: "var(--text-caption)",
            fontWeight: 800,
            padding: "var(--space-1) var(--space-2)",
            borderRadius: "var(--radius-pill)",
            background: "var(--hud-surface)",
            color: "var(--hud-text)",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {measurement}
        </span>
      ) : null}
    </button>
  );
}

function SectionHeader({ children }) {
  return (
    <header
      style={{
        fontSize: "var(--text-caption)",
        fontWeight: 700,
        color: "var(--hud-text-muted)",
        letterSpacing: "var(--tracking-caps)",
        textTransform: "uppercase",
        paddingLeft: "var(--space-xs)",
      }}
    >
      {children}
    </header>
  );
}

function EmptyRowHint({ children }) {
  return (
    <div
      style={{
        fontSize: "var(--text-caption)",
        color: "var(--hud-text-dim)",
        padding: "var(--space-xs) var(--space-sm)",
      }}
    >
      {children}
    </div>
  );
}

export default function ConcernPanel({
  tyres = [],
  brakes = [],
  external = [], // External concerns (amber + red only) — wipers, lights, etc.
  onInsertWidget,
  isLive = false,
  activeRowIds,
}) {
  const total = (tyres?.length || 0) + (brakes?.length || 0) + (external?.length || 0);
  const activeCount = activeRowIds ? activeRowIds.size : 0;
  const isRowActive = (rowId) => Boolean(activeRowIds && activeRowIds.has(rowId));

  // DEV overlay toggle. The button only renders for users who can
  // access the global DevLayoutOverlay (same gate as Ctrl+Shift+D),
  // and it drives that same context — so the Inspection header pill
  // and the keyboard shortcut do exactly the same thing.
  //
  // The button is rendered twice:
  //   1. An in-flow placeholder inside the Inspection header. This
  //      reserves the slot's width in the flex layout so the header
  //      text doesn't reflow when the button appears / disappears.
  //   2. A live portal at document.body, positioned over the
  //      placeholder via a measured bounding rect, with z-index above
  //      the global DevLayoutOverlay root (2800). The overlay draws
  //      an invisible inspectButton over every detected section and
  //      swallows clicks in its stacking context; portalling with a
  //      higher z-index is the only way to keep this button clickable.
  const devOverlay = useDevLayoutOverlay();
  const canShowDev = devOverlay?.canAccess && devOverlay?.hydrated;
  const devOn = Boolean(devOverlay?.enabled);

  const devAnchorRef = useRef(null);
  const [devRect, setDevRect] = useState(null);

  useLayoutEffect(() => {
    if (!canShowDev) { setDevRect(null); return undefined; }
    const node = devAnchorRef.current;
    if (!node) return undefined;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setDevRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    measure();
    if (typeof window === "undefined") return undefined;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [canShowDev]);

  const devPortal = canShowDev && devRect && typeof document !== "undefined"
    ? createPortal(
      <button
        type="button"
        onClick={devOverlay.toggleEnabled}
        aria-pressed={devOn}
        aria-label={devOn ? "Hide developer layout overlay" : "Show developer layout overlay"}
        title={devOn ? "Dev overlay on (Ctrl+Shift+D)" : "Dev overlay off (Ctrl+Shift+D)"}
        data-dev-overlay-skip="1"
        style={{
          position: "fixed",
          top: devRect.top,
          left: devRect.left,
          minWidth: devRect.width,
          height: devRect.height,
          // Above the global DevLayoutOverlay root (z-index 2800) so
          // the overlay's inspectButton can't swallow clicks — this
          // is what keeps the DEV button live in pass-through mode.
          zIndex: 3000,
          pointerEvents: "auto",
          padding: "0 var(--space-2)",
          borderRadius: "var(--radius-pill)",
          border: devOn
            ? "1px solid rgba(var(--accentMainRgb), 0.9)"
            : "1px solid var(--hud-border)",
          background: devOn ? "rgba(var(--accentMainRgb), 0.92)" : "var(--hud-surface)",
          color: devOn ? "var(--onAccentText)" : "var(--hud-text)",
          fontSize: "var(--text-caption)",
          fontWeight: 800,
          letterSpacing: "var(--tracking-caps)",
          cursor: "pointer",
          fontFamily: "var(--font-family)",
          transition: "var(--control-transition)",
          backdropFilter: "var(--hud-blur)",
          WebkitBackdropFilter: "var(--hud-blur)",
        }}
      >
        DEV
      </button>,
      document.body,
    )
    : null;

  return (
    <aside
      aria-label="Inspection concerns"
      style={{
        // Pass-through mode: when the dev overlay is on, the whole
        // panel stops taking pointer events so rows can't fire while
        // the technician is inspecting layout. The DEV button below
        // flips pointer-events back on just for itself so the overlay
        // can still be toggled off from here.
        pointerEvents: devOn ? "none" : "auto",
        // Panel is always expanded — the previous "‹" collapse button
        // was removed so technicians can never accidentally hide the
        // Inspection list mid-capture.
        width: 260,
        maxWidth: "72vw",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        padding: "var(--space-3) var(--space-2)",
        background: "rgba(var(--accentMainRgb), 0.10)",
        borderRadius: "var(--radius-lg)",
        border: "none",
        backdropFilter: "var(--hud-blur-strong)",
        WebkitBackdropFilter: "var(--hud-blur-strong)",
        boxShadow: "var(--hud-shadow-lg)",
        overflow: "hidden",
        fontFamily: "var(--font-family)",
        color: "var(--hud-text)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-2)",
          marginBottom: "var(--space-2)",
        }}
      >
        <div style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
          <span
            style={{
              fontSize: "var(--text-caption)",
              color: "var(--hud-text-muted)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "var(--tracking-caps)",
            }}
          >
            Inspection
          </span>
          <span
            style={{
              fontSize: "var(--text-caption)",
              color: "var(--hud-text)",
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {total > 0
              ? `${total} item${total === 1 ? "" : "s"}${activeCount > 0 ? ` • ${activeCount} on-screen` : ""}`
              : "No items to show"}
          </span>
        </div>

        {/* DEV overlay toggle — an in-flow placeholder reserves the
            slot in the header flexbox so the text doesn't reflow; the
            real clickable button is portalled to document.body below
            with a z-index above the global DevLayoutOverlay root so
            the overlay's inspectButton can't swallow its clicks. */}
        {canShowDev ? (
          <div
            ref={devAnchorRef}
            aria-hidden="true"
            style={{
              flexShrink: 0,
              height: 28,
              minWidth: 40,
              // Keep the placeholder visually empty. The portalled
              // button below paints the actual UI over this slot.
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "grid",
          // Tighter inter-section gap so Tyres / Brakes / External
          // sit close together in the panel.
          gap: "var(--space-1)",
          paddingRight: "var(--space-xs)",
        }}
      >
          <section
            data-dev-section-key="capture-panel-tyres"
            data-dev-section-type="section-shell"
            style={{ display: "grid", gap: 2 }}
          >
            <SectionHeader>Tyres</SectionHeader>
            {tyres.length === 0 ? (
              <EmptyRowHint>No tyre data yet.</EmptyRowHint>
            ) : (
              tyres.map((row) => (
                <ConcernRow
                  key={row.id}
                  row={row}
                  onInsert={onInsertWidget}
                  isLive={isLive}
                  isActive={isRowActive(row.id)}
                />
              ))
            )}
          </section>

          <section
            data-dev-section-key="capture-panel-brakes"
            data-dev-section-type="section-shell"
            style={{ display: "grid", gap: 2 }}
          >
            <SectionHeader>Brakes</SectionHeader>
            {brakes.length === 0 ? (
              <EmptyRowHint>No brake data yet.</EmptyRowHint>
            ) : (
              brakes.map((row) => (
                <ConcernRow
                  key={row.id}
                  row={row}
                  onInsert={onInsertWidget}
                  isLive={isLive}
                  isActive={isRowActive(row.id)}
                />
              ))
            )}
          </section>

          {/* External concerns — only rendered when there is at least
              one amber/red external item, so Tyres/Brakes pages without
              any wiper/light issues stay uncluttered. The row itself
              displays only the issue text; the category is intentionally
              omitted per the capture-section UX brief. */}
          {external.length > 0 ? (
            <section
              data-dev-section-key="capture-panel-external"
              data-dev-section-type="section-shell"
              style={{ display: "grid", gap: 2 }}
            >
              <SectionHeader>External</SectionHeader>
              {external.map((row) => (
                <ConcernRow
                  key={row.id}
                  row={row}
                  onInsert={onInsertWidget}
                  isLive={isLive}
                  isActive={isRowActive(row.id)}
                />
              ))}
            </section>
          ) : null}
      </div>
      {devPortal}
    </aside>
  );
}
