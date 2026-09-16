// file location: src/components/HR/HrSummaryStrip.js
// Shared "at a glance" metric strip for the HR manager tabs.
//
// Every tab under /hr/manager opens with the handful of numbers an HR lead or
// department manager needs before they read the tables underneath — headcount
// on payroll, approvals waiting, certifications expiring, and so on. The strip
// is derived from the same datasets the tab already renders, so it never shows
// a number the tables below cannot account for.
//
// Layout only: each tile is the existing MetricCard, so the surface ladder and
// every colour token stay exactly as the design system defines them
// (CLAUDE.md §3.0 / §3.0a-2). `layer` is forwarded so a strip placed inside a
// --theme section can flip its tiles back to --surface.
import React from "react";
import { MetricCard } from "@/components/HR/MetricCard";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

const slug = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Tone → the accent the tile's headline number is painted in. Uses the status
// tokens from theme.css only — no local colours.
const TONE_COLOURS = {
  neutral: "var(--info-dark)",
  success: "var(--success-base)",
  warning: "var(--warning-base)",
  danger: "var(--danger-base)",
};

export default function HrSummaryStrip({ items = [], parentKey, minTileWidth = "200px", layer = "theme" }) {
  const tiles = items.filter(Boolean);
  if (!tiles.length) return null;

  const rowKey = parentKey ? `${parentKey}-summary-strip` : "";

  return (
    <DevLayoutSection
      sectionKey={rowKey}
      parentKey={parentKey}
      sectionType="section-shell"
      data-dev-card-section="At a glance"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minTileWidth}, 1fr))`,
        gap: "var(--layout-card-gap)",
      }}
    >
      {tiles.map((tile) => (
        <MetricCard
          key={tile.label}
          icon={tile.icon}
          label={tile.label}
          primary={tile.primary}
          secondary={tile.secondary}
          trend={tile.trend}
          accentColor={TONE_COLOURS[tile.tone] || TONE_COLOURS.neutral}
          sectionKey={`${parentKey}-metric-${slug(tile.label)}`}
          parentKey={rowKey || parentKey}
          layer={layer}
          data-dev-card-section={tile.label}
        />
      ))}
    </DevLayoutSection>
  );
}
