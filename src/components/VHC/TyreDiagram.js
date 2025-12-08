// file location: src/components/VHC/TyreDiagram.js
import React from "react";
import themeConfig from "@/styles/appTheme";

const { palette, shadows } = themeConfig;

const DIAGRAM_WIDTH = 308;
const DIAGRAM_HEIGHT = 380;
const FRONT_Y = 70;
const REAR_Y = 230; // widened vertical gap so labels don't crowd other content
const TYRE_WIDTH = 42;
const TYRE_HEIGHT = 90;

const TYRE_KEYS = [
  { key: "nsf", label: "N/S/F", position: { x: 38, y: FRONT_Y } },
  { key: "osf", label: "O/S/F", position: { x: 226, y: FRONT_Y } },
  { key: "nsr", label: "N/S/R", position: { x: 38, y: REAR_Y } },
  { key: "osr", label: "O/S/R", position: { x: 226, y: REAR_Y } },
];

const statusPalette = {
  unknown: { fill: "var(--border)", text: "var(--accent-purple)", label: "var(--accent-purple-surface)" },
  danger: { fill: "var(--danger)", text: "var(--danger-surface)", label: "var(--danger)" },
  advisory: { fill: "var(--warning)", text: "var(--warning-dark)", label: "var(--warning)" },
  good: { fill: "var(--success)", text: "var(--success-surface)", label: "var(--success)" },
};

export const getReadingStatus = (value) => {
  const reading = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(reading)) return { readingText: "–", status: "unknown" };
  if (reading <= 2.5) return { readingText: `${reading.toFixed(1)} mm`, status: "danger" };
  if (reading <= 3.5) return { readingText: `${reading.toFixed(1)} mm`, status: "advisory" };
  return { readingText: `${reading.toFixed(1)} mm`, status: "good" };
};

const resolveTyreEntry = (value) => {
  if (value && typeof value === "object" && !(value instanceof Array)) {
    return {
      depth: value.depth,
      overrideStatus: value.severity,
    };
  }
  return { depth: value, overrideStatus: null };
};

export default function TyreDiagram({ tyres = {}, activeTyre, onSelect, spareActive = false, onSpareSelect }) {
  const activeKey = activeTyre?.toLowerCase();
  const svgPrimary = palette.textPrimary;
  const svgMuted = palette.textMuted;
  const bodyFill = palette.accentSurface;
  const cabinFill = palette.surfaceAlt;
  const axleColor = palette.border;

  const containerStyle = {
    width: "100%",
    borderRadius: "24px",
    padding: "24px",
    border: `1px solid ${palette.border}`,
    background: palette.surface,
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: shadows.lg,
    color: svgPrimary,
  };

  return (
    <div style={containerStyle}>
      <svg
        viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
        role="img"
        aria-label="Vehicle tyre overview diagram"
        style={{ width: "100%", height: "auto", maxWidth: "360px" }}
      >
        <rect
          x="58"
          y="46"
          width="190"
          height="260"
          rx="48"
          fill={bodyFill}
          stroke={palette.border}
          strokeWidth="2"
          strokeDasharray="10 8"
          opacity="0.9"
        />
        <rect x="82" y="72" width="142" height="208" rx="34" fill={cabinFill} stroke={palette.border} strokeWidth="1" opacity="0.8" />
        <line x1="58" y1={FRONT_Y + TYRE_HEIGHT / 2} x2="248" y2={FRONT_Y + TYRE_HEIGHT / 2} stroke={axleColor} strokeWidth="5" strokeLinecap="round" />
        <line x1="58" y1={REAR_Y + TYRE_HEIGHT / 2} x2="248" y2={REAR_Y + TYRE_HEIGHT / 2} stroke={axleColor} strokeWidth="5" strokeLinecap="round" />

        {TYRE_KEYS.map(({ key, label, position }) => {
          const entry = tyres?.[key];
          const { depth, overrideStatus } = resolveTyreEntry(entry);
          const { readingText, status: baseStatus } = getReadingStatus(depth);
          const status = overrideStatus || baseStatus;
          const colors = statusPalette[status] || statusPalette.unknown;
          const isActive = activeKey === key;

          return (
            <g
              key={key}
              onClick={() => onSelect?.(key)}
              style={{ cursor: onSelect ? "pointer" : "default" }}
            >
              <rect
                x={position.x}
                y={position.y}
                width={TYRE_WIDTH}
                height={TYRE_HEIGHT}
                rx="12"
                fill={colors.fill}
                stroke={isActive ? palette.accent : palette.border}
                strokeWidth={isActive ? 3 : 1.5}
                filter="url(#tyreShadow)"
              />
              <text
                x={position.x + TYRE_WIDTH / 2}
                y={position.y + TYRE_HEIGHT / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={colors.text}
                fontSize="12"
                fontWeight="700"
              >
                {readingText}
              </text>
              <text
                x={position.x + TYRE_WIDTH / 2}
                y={position.y + TYRE_HEIGHT + 20}
                textAnchor="middle"
                fill={isActive ? palette.accent : colors.label}
                fontSize="12"
                fontWeight="700"
              >
                {label}
              </text>
            </g>
          );
        })}

        <text x={DIAGRAM_WIDTH / 2} y="60" textAnchor="middle" fontSize="11" fill={svgMuted} letterSpacing="2">
          FRONT
        </text>
        <text x={DIAGRAM_WIDTH / 2} y={DIAGRAM_HEIGHT - 20} textAnchor="middle" fontSize="11" fill={svgMuted} letterSpacing="2">
          REAR
        </text>
        <text x="20" y={DIAGRAM_HEIGHT / 2} textAnchor="middle" fontSize="11" fill={svgMuted} transform={`rotate(-90 20 ${DIAGRAM_HEIGHT / 2})`}>
          
        </text>
        <text x={DIAGRAM_WIDTH - 22} y={DIAGRAM_HEIGHT / 2} textAnchor="middle" fontSize="11" fill={svgMuted} transform={`rotate(90 ${DIAGRAM_WIDTH - 22} ${DIAGRAM_HEIGHT / 2})`}>
          
        </text>

        <defs>
          <filter id="tyreShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(var(--shadow-rgb),0.55)" />
          </filter>
        </defs>
      </svg>

      <button
        type="button"
        onClick={onSpareSelect}
        style={{
          borderRadius: "18px",
          border: `1px solid ${spareActive ? palette.accent : palette.border}`,
          padding: "10px 20px",
          background: spareActive ? palette.accent : palette.surfaceAlt,
          color: spareActive ? "var(--surface)" : palette.textPrimary,
          fontWeight: 600,
          cursor: onSpareSelect ? "pointer" : "default",
          boxShadow: "none",
          transition: "transform 0.2s ease",
        }}
      >
        Spare / Kit
      </button>

    </div>
  );
}
