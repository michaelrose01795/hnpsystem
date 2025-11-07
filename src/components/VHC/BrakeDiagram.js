import React from "react";
import themeConfig from "@/styles/appTheme";

const palette = themeConfig.palette;

const BRAKE_KEYS = [
  { key: "nsf", label: "NSF", position: { x: 36, y: 76 } },
  { key: "osf", label: "OSF", position: { x: 228, y: 76 } },
  { key: "nsr", label: "NSR", position: { x: 36, y: 186 } },
  { key: "osr", label: "OSR", position: { x: 228, y: 186 } },
];

const PAD_WIDTH = 44;
const PAD_HEIGHT = 90;

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

export default function BrakeDiagram({ brakes = {}, activeBrake, onSelect }) {
  const activeKey = activeBrake?.toLowerCase();

  return (
    <div
      style={{
        width: "100%",
        background: "#1e1e1e",
        borderRadius: "24px",
        padding: "28px 24px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        boxShadow: "0 24px 48px rgba(0,0,0,0.55)",
      }}
    >
      <svg
        viewBox="0 0 308 300"
        role="img"
        aria-label="Brake pad and disc overview diagram"
        style={{ width: "100%", height: "auto", maxWidth: "360px" }}
      >
        <text
          x="154"
          y="28"
          textAnchor="middle"
          fontSize="16"
          fontWeight="700"
          fill="#F8FAFC"
          letterSpacing="1.2"
        >
          Brake Pad / Disc Overview
        </text>

        <rect
          x="60"
          y="46"
          width="188"
          height="220"
          rx="48"
          fill="none"
          stroke="#CBD5F5"
          strokeWidth="2"
          strokeDasharray="10 8"
          opacity="0.6"
        />
        <line x1="60" y1="148" x2="248" y2="148" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
        <line x1="60" y1="198" x2="248" y2="198" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />

        <text x="154" y="60" textAnchor="middle" fontSize="11" fill="#CBD5F5" letterSpacing="2">
          FRONT
        </text>
        <text x="154" y="282" textAnchor="middle" fontSize="11" fill="#CBD5F5" letterSpacing="2">
          REAR
        </text>
        <text x="14" y="170" textAnchor="middle" fontSize="11" fill="#CBD5F5" transform="rotate(-90 14 170)">
          N / S · LEFT
        </text>
        <text x="294" y="170" textAnchor="middle" fontSize="11" fill="#CBD5F5" transform="rotate(90 294 170)">
          O / S · RIGHT
        </text>

        {BRAKE_KEYS.map(({ key, label, position }) => {
          const value = brakes?.[key];
          const { text, status } = getPadStatus(value);
          const colors = statusPalette[status];
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
                width={PAD_WIDTH}
                height={PAD_HEIGHT}
                rx="12"
                fill={colors.fill}
                stroke={isActive ? palette.accent : "#0F172A"}
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
              <text
                x={position.x + PAD_WIDTH / 2}
                y={position.y + PAD_HEIGHT + 20}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill={isActive ? palette.accent : colors.label}
              >
                {label}
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
