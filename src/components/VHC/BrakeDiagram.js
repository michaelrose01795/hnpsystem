import React from "react";
import themeConfig from "@/styles/appTheme";

const { palette, shadows } = themeConfig;

const DIAGRAM_WIDTH = 308;
const DIAGRAM_HEIGHT = 380;
const FRONT_Y = 70;
const REAR_Y = 230; // widened vertical gap to mirror tyre diagram spacing
const PAD_WIDTH = 44;
const PAD_HEIGHT = 90;

const BRAKE_KEYS = [
  { key: "nsf", label: "NSF", position: { x: 36, y: FRONT_Y } },
  { key: "osf", label: "OSF", position: { x: 228, y: FRONT_Y } },
  { key: "nsr", label: "NSR", position: { x: 36, y: REAR_Y } },
  { key: "osr", label: "OSR", position: { x: 228, y: REAR_Y } },
];

const statusPalette = {
  critical: { fill: "#E53935", text: "#FDECEE", label: "#F87171" },
  advisory: { fill: "#FB8C00", text: "#1F1400", label: "#FDBA74" },
  good: { fill: "#43A047", text: "#E6F4EA", label: "#34D399" },
  unknown: { fill: "#9E9E9E", text: "#111827", label: "#CBD5F5" },
};

const getPadStatus = (value) => {
  const reading = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(reading)) return { text: "–", status: "unknown" };
  if (reading <= 2) return { text: `${reading.toFixed(1)} mm`, status: "critical" };
  if (reading <= 4) return { text: `${reading.toFixed(1)} mm`, status: "advisory" };
  return { text: `${reading.toFixed(1)} mm`, status: "good" };
};

const resolveBrakeEntry = (entry) => {
  if (entry && typeof entry === "object" && !(entry instanceof Array)) {
    return {
      measurement: entry.value,
      overrideStatus: entry.severity,
    };
  }
  return { measurement: entry, overrideStatus: null };
};

export default function BrakeDiagram({ brakes = {}, activeBrake, onSelect }) {
  const activeKey = activeBrake?.toLowerCase();
  const isFrontActive = activeKey === "front" || activeKey === "nsf" || activeKey === "osf";
  const isRearActive = activeKey === "rear" || activeKey === "nsr" || activeKey === "osr";

  const containerStyle = {
    width: "100%",
    background: palette.surface,
    borderRadius: "24px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    alignItems: "center",
    justifyContent: "center",
    color: palette.textPrimary,
    border: `1px solid ${palette.border}`,
    boxShadow: shadows.lg,
  };

  return (
    <div style={containerStyle}>
      <svg
        viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
        role="img"
        aria-label="Brake pad and disc overview diagram"
        style={{ width: "100%", height: "auto", maxWidth: "360px" }}
      >
        <rect
          x="60"
          y="46"
          width="188"
          height="260"
          rx="48"
          fill={palette.accentSurface}
          stroke={palette.border}
          strokeWidth="2"
          strokeDasharray="10 8"
          opacity="0.6"
        />
        <line x1="60" y1={FRONT_Y + PAD_HEIGHT / 2} x2="248" y2={FRONT_Y + PAD_HEIGHT / 2} stroke={palette.border} strokeWidth="4" strokeLinecap="round" />
        <line x1="60" y1={REAR_Y + PAD_HEIGHT / 2} x2="248" y2={REAR_Y + PAD_HEIGHT / 2} stroke={palette.border} strokeWidth="4" strokeLinecap="round" />

        <text x={DIAGRAM_WIDTH / 2} y="60" textAnchor="middle" fontSize="11" fill={palette.textMuted} letterSpacing="2">
          FRONT
        </text>
        <text x={DIAGRAM_WIDTH / 2} y={DIAGRAM_HEIGHT - 20} textAnchor="middle" fontSize="11" fill={palette.textMuted} letterSpacing="2">
          REAR
        </text>

        {BRAKE_KEYS.map(({ key, position }) => {
          const entry = brakes?.[key];
          const { measurement, overrideStatus } = resolveBrakeEntry(entry);
          const { text, status: baseStatus } = getPadStatus(measurement);
          const status = overrideStatus || baseStatus;
          const colors = statusPalette[status] || statusPalette.unknown;
          const isFrontWheel = key === "nsf" || key === "osf";
          const isRearWheel = key === "nsr" || key === "osr";
          const isActive = (isFrontWheel && isFrontActive) || (isRearWheel && isRearActive);

          return (
            <g
              key={key}
              onClick={() => onSelect?.(isFrontWheel ? "front" : "rear")}
              style={{ cursor: onSelect ? "pointer" : "default" }}
            >
              <rect
                x={position.x}
                y={position.y}
                width={PAD_WIDTH}
                height={PAD_HEIGHT}
                rx="12"
                fill={colors.fill}
                stroke={isActive ? palette.accent : palette.border}
                strokeWidth={isActive ? 3 : 1.5}
                filter="url(#brakeShadow)"
              />
              <text
                x={position.x + PAD_WIDTH / 2}
                y={position.y + PAD_HEIGHT / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={colors.text}
                fontSize="12"
                fontWeight="700"
              >
                {text}
              </text>
            </g>
          );
        })}

        <defs>
          <filter id="brakeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.55)" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}
