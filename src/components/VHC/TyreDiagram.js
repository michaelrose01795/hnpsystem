import React from "react";
import themeConfig from "@/styles/appTheme";

const palette = themeConfig.palette;

const TYRE_KEYS = [
  { key: "nsf", label: "N/S/F", position: { x: 38, y: 78 } },
  { key: "osf", label: "O/S/F", position: { x: 226, y: 78 } },
  { key: "nsr", label: "N/S/R", position: { x: 38, y: 186 } },
  { key: "osr", label: "O/S/R", position: { x: 226, y: 186 } },
];

const TYRE_WIDTH = 42;
const TYRE_HEIGHT = 90;

const statusPalette = {
  unknown: { fill: "#9E9E9E", text: "#0F172A", label: "#E5E7EB" },
  danger: { fill: "#E53935", text: "#FDECEE", label: "#F87171" },
  advisory: { fill: "#FB8C00", text: "#1F1400", label: "#FDBA74" },
  good: { fill: "#43A047", text: "#E6F4EA", label: "#4ADE80" },
};

const getReadingStatus = (value) => {
  const reading = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(reading)) return { readingText: "–", status: "unknown" };
  if (reading <= 2.5) return { readingText: `${reading.toFixed(1)} mm`, status: "danger" };
  if (reading <= 3.5) return { readingText: `${reading.toFixed(1)} mm`, status: "advisory" };
  return { readingText: `${reading.toFixed(1)} mm`, status: "good" };
};

export default function TyreDiagram({ tyres = {}, activeTyre, onSelect, spareActive = false, onSpareSelect }) {
  const activeKey = activeTyre?.toLowerCase();
  const svgPrimary = "#F8FAFC";
  const svgMuted = "#94A3B8";
  const bodyFill = "rgba(148,163,184,0.15)";
  const cabinFill = "rgba(148,163,184,0.08)";
  const axleColor = "#94A3B8";

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
        color: svgPrimary,
        boxShadow: "0 24px 48px rgba(0,0,0,0.55)",
      }}
    >
      <svg
        viewBox="0 0 306 300"
        role="img"
        aria-label="Vehicle tyre overview diagram"
        style={{ width: "100%", height: "auto", maxWidth: "360px" }}
      >
        <text
          x="153"
          y="28"
          textAnchor="middle"
          fontSize="16"
          fontWeight="700"
          fill={svgPrimary}
          letterSpacing="1.2"
        >
          Vehicle Tyre Overview
        </text>

        <rect
          x="58"
          y="46"
          width="190"
          height="220"
          rx="48"
          fill={bodyFill}
          stroke="#CBD5F5"
          strokeWidth="2"
          strokeDasharray="10 8"
          opacity="0.6"
        />
        <rect x="82" y="72" width="142" height="168" rx="34" fill={cabinFill} stroke="#CBD5F5" strokeWidth="1" opacity="0.5" />
        <line x1="58" y1="148" x2="248" y2="148" stroke={axleColor} strokeWidth="5" strokeLinecap="round" />
        <line x1="58" y1="198" x2="248" y2="198" stroke={axleColor} strokeWidth="5" strokeLinecap="round" />

        {TYRE_KEYS.map(({ key, label, position }) => {
          const value = tyres?.[key];
          const { readingText, status } = getReadingStatus(value);
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
                width={TYRE_WIDTH}
                height={TYRE_HEIGHT}
                rx="12"
                fill={colors.fill}
                stroke={isActive ? palette.accent : "#0F172A"}
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

        <text x="153" y="60" textAnchor="middle" fontSize="11" fill={svgMuted} letterSpacing="2">
          FRONT
        </text>
        <text x="153" y="282" textAnchor="middle" fontSize="11" fill={svgMuted} letterSpacing="2">
          REAR
        </text>
        <text x="20" y="170" textAnchor="middle" fontSize="11" fill={svgMuted} transform="rotate(-90 20 170)">
          N / S · LEFT
        </text>
        <text x="286" y="170" textAnchor="middle" fontSize="11" fill={svgMuted} transform="rotate(90 286 170)">
          O / S · RIGHT
        </text>

        <defs>
          <filter id="tyreShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.55)" />
          </filter>
        </defs>
      </svg>

      <button
        type="button"
        onClick={onSpareSelect}
        style={{
          borderRadius: "18px",
          border: `1px solid ${spareActive ? palette.accent : "#334155"}`,
          padding: "12px 20px",
          background: spareActive ? palette.accent : "#0f172a",
          color: spareActive ? "#ffffff" : "#e2e8f0",
          fontWeight: 600,
          cursor: onSpareSelect ? "pointer" : "default",
          boxShadow: spareActive ? "0 10px 24px rgba(209,0,0,0.35)" : "0 4px 18px rgba(0,0,0,0.45)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
      >
        Spare / Kit
      </button>

      <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
        {[
          { label: "Not Checked", status: "unknown" },
          { label: "0–2.5 mm", status: "danger" },
          { label: "2.6–3.5 mm", status: "advisory" },
          { label: "3.6 mm+", status: "good" },
        ].map(({ label, status }) => (
          <div
            key={status}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 600,
              color: svgPrimary,
            }}
          >
            <span
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "4px",
                backgroundColor: statusPalette[status].fill,
                display: "inline-block",
              }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
