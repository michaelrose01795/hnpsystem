// file location: src/components/LoanCars/FuelGauge.js
// Single-row segmented fuel indicator for loan-car rows, styled as a clean
// dashboard gauge: fuel icon · "E" · eight clickable rounded segments · "F".
// Stored fuel scale is 0–8 (nine levels): 0 = Empty, 8 = Full, each step an
// eighth. Filled segments use the app success colour; empty segments are transparent
// with a light grey ring. Clicking a segment sets that level; hovering shows
// the fraction + percentage via tooltip.
import { useState } from "react";

export const FUEL_LEVEL_COUNT = 8;

// Index = level (0..8). The label IS the corrected fraction name.
export const FUEL_LEVEL_LABELS = [
  "Empty", // 0   – 0%
  "1/8", //   1   – 12.5%
  "1/4", //   2   – 25%
  "3/8", //   3   – 37.5%
  "1/2", //   4   – 50%
  "5/8", //   5   – 62.5%
  "3/4", //   6   – 75%
  "7/8", //   7   – 87.5%
  "Full", //  8   – 100%
];

export const clampFuelLevel = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(FUEL_LEVEL_COUNT, Math.max(0, Math.round(parsed)));
};

export const fuelLevelLabel = (value) => FUEL_LEVEL_LABELS[clampFuelLevel(value)];

// Whole-number percent for the tooltip (0, 13, 25, 38, 50, 63, 75, 88, 100).
export const fuelLevelPercent = (level) => Math.round((clampFuelLevel(level) / FUEL_LEVEL_COUNT) * 100);

export const fuelLevelDisplayLabel = (level) => `${fuelLevelLabel(level)} · ${fuelLevelPercent(level)}%`;

const containerStyle = {
  display: "flex",
  flexDirection: "row",
  flexWrap: "nowrap",
  alignItems: "center",
  gap: "6px",
};

const capStyle = {
  color: "var(--text-1)",
  fontSize: "13px",
  fontWeight: 800,
  lineHeight: 1,
};

const barStyle = {
  display: "flex",
  flexDirection: "row",
  flexWrap: "nowrap",
  alignItems: "center",
  gap: "5px",
};

// Equal rounded segment; flexes to fill space but stays compact in list rows.
const segmentStyle = {
  flex: "1 1 20px",
  minWidth: "18px",
  maxWidth: "44px",
  height: "22px",
  padding: 0,
  border: 0,
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  appearance: "none",
};

function FuelPumpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15" />
      <path d="M3 20h11" />
      <path d="M7 9h4" />
      <path d="M14 8l3 3v6a2 2 0 0 0 4 0V7l-3-3" />
    </svg>
  );
}

export default function FuelGauge({ value, onChange, disabled = false }) {
  const level = clampFuelLevel(value);
  const [hovered, setHovered] = useState(null); // hovered segment level (1..8) or null
  const activeLevel = hovered ?? level;
  const activeLabel = fuelLevelDisplayLabel(activeLevel);

  const handleSegment = (segmentLevel) => {
    if (disabled) return;
    // Re-clicking the first segment when already at 1/8 drains the tank to Empty.
    onChange(level === segmentLevel && segmentLevel === 1 ? 0 : segmentLevel);
  };

  return (
    <div style={containerStyle} role="group" aria-label={`Fuel level ${activeLabel}`} title={activeLabel}>
      <span style={{ color: "var(--text-1)", display: "inline-flex" }} aria-hidden="true">
        <FuelPumpIcon />
      </span>
      <span style={capStyle} aria-hidden="true">
        E
      </span>
      <div style={barStyle} onMouseLeave={() => setHovered(null)}>
        {Array.from({ length: FUEL_LEVEL_COUNT }, (_, index) => {
          const segmentLevel = index + 1;
          const filled = segmentLevel <= level;
          const segLabel = fuelLevelDisplayLabel(segmentLevel);
          return (
            <button
              key={segmentLevel}
              type="button"
              disabled={disabled}
              onClick={() => handleSegment(segmentLevel)}
              onMouseEnter={() => setHovered(segmentLevel)}
              onFocus={() => setHovered(segmentLevel)}
              onBlur={() => setHovered(null)}
              title={segLabel}
              aria-label={`Set fuel to ${segLabel}`}
              style={{
                ...segmentStyle,
                // `--input-ring` is a `1px solid …` shorthand, not a colour, so
                // it cannot go inside box-shadow. Use the underlying ring colour
                // directly. Empty segments get a white surface fill so they read
                // as distinct outlined cells (matching the dashboard reference).
                backgroundColor: filled ? "var(--success)" : "var(--surface)",
                boxShadow: filled ? "none" : "inset 0 0 0 1px var(--secondary-hover)",
              }}
            />
          );
        })}
      </div>
      <span style={capStyle} aria-hidden="true">
        F
      </span>
    </div>
  );
}
