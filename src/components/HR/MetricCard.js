// file location: src/components/HR/MetricCard.js
// Exports MetricCard (metric display widget) and StatusTag (status badge).
// SectionCard re-export has been removed — all consumers now import it from @/components/Section directly.
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

export function MetricCard({
  icon,
  label,
  primary,
  secondary,
  trend,
  accentColor = "var(--info-dark)",
  sectionKey,
  parentKey,
  sectionType = "stat-card",
  // Which rung of the surface ladder the tile sits on (CLAUDE.md 3.0a-2).
  // "theme" is the default because a metric tile is almost always dropped
  // straight into the main page card (--surface) and so is the second rung.
  // Pass layer="surface" when the tile sits inside a --theme section.
  layer = "theme",
  ...rest
}) {
  const Layer = layer === "surface" ? LayerSurface : LayerTheme;

  return (
    <Layer as="div"
    sectionKey={sectionKey}
    parentKey={parentKey}
    sectionType={sectionType}
    backgroundToken={layer}
    style={{
      gap: "14px",
      minWidth: "200px",
      flex: 1
    }}
    {...rest}>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "1.6rem" }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--info-dark)" }}>
          {label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span style={{ fontSize: "2rem", fontWeight: 700, color: accentColor }}>
          {primary}
        </span>
        {secondary ?
        <span style={{ color: "var(--info)", fontWeight: 500 }}>{secondary}</span> :
        null}
      </div>
      {trend ?
      <span
        style={{
          backgroundColor: "rgba(var(--info-rgb), 0.08)",
          color: accentColor,
          borderRadius: "var(--radius-pill)",
          padding: "6px 12px",
          fontSize: "0.8rem",
          fontWeight: 600,
          alignSelf: "flex-start"
        }}>

          {trend}
        </span> :
      null}
    </Layer>);

}


// StatusTag's own tone vocabulary, mapped onto the Badge family variants it
// now renders. The names are kept because every HR call site passes them; only
// the paint moved. Two of the old inline palettes were wrong on their own
// terms and are corrected by the move: "success" was tinted with --info (blue,
// not green) and "warning" used --warning rather than the readable
// --warning-dark. "info" was never in the old map at all, so ProfileWorkTab's
// Overtime/Weekend rows silently fell back to the default purple.
const STATUS_TAG_TONES = {
  default: "app-badge--neutral",
  neutral: "app-badge--neutral",
  info: "app-badge--accent-soft",
  success: "app-badge--success",
  warning: "app-badge--warning",
  danger: "app-badge--danger"
};

/**
 * A status label. Shape and colour are the canonical Badge family
 * (.app-badge + one tone modifier) so an HR status reads identically to the
 * same status on a job card, a parts order or the clocking board. Do not add
 * sizing or colour at the call site — pass a tone.
 */
export function StatusTag({ label, tone = "default" }) {
  const variant = STATUS_TAG_TONES[tone] || STATUS_TAG_TONES.default;

  return <span className={`app-badge ${variant}`}>{label}</span>;

}
