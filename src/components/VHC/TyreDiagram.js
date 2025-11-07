import React from "react";
import themeConfig from "@/styles/appTheme";

const palette = themeConfig.palette;

const TYRE_KEYS = [
  { key: "nsf", label: "NSF", position: { x: 40, y: 52 } },
  { key: "osf", label: "OSF", position: { x: 224, y: 52 } },
  { key: "nsr", label: "NSR", position: { x: 40, y: 160 } },
  { key: "osr", label: "OSR", position: { x: 224, y: 160 } },
];

const TYRE_WIDTH = 40;
const TYRE_HEIGHT = 86;

const statusPalette = {
  unknown: { fill: "#9E9E9E", text: "#0F172A", label: "#E5E7EB" },
  danger: { fill: "#E53935", text: "#FDECEE", label: "#F87171" },
  advisory: { fill: "#FB8C00", text: "#1F1300", label: "#FDBA74" },
  good: { fill: "#43A047", text: "#E6F4EA", label: "#4ADE80" },
};

const getReadingStatus = (value) => {
  const reading = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(reading)) return { readingText: "–", status: "unknown" };
  if (reading <= 2.5) return { readingText: `${reading.toFixed(1)}mm`, status: "danger" };
  if (reading <= 3.5) return { readingText: `${reading.toFixed(1)}mm`, status: "advisory" };
  return { readingText: `${reading.toFixed(1)}mm`, status: "good" };
};

export default function TyreDiagram({ tyres = {}, activeTyre, onSelect }) {
  const activeKey = activeTyre?.toLowerCase();

  return (
    <div
      style={{
        width: "100%",
        background: "#0B1120",
        borderRadius: "22px",
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 24px 40px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#F8FAFC" }}>Vehicle Tyre Overview</h3>
        <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#CBD5F5" }}>
          Tablet layout showing live tread health around the car.
        </p>
      </div>

      <svg
        viewBox="0 0 304 260"
        role="img"
        aria-label="Vehicle tyre overview diagram"
        style={{ width: "100%", height: "auto", maxWidth: "340px" }}
      >
        <rect x="60" y="30" width="184" height="200" rx="46" fill="#1F2937" stroke="#4B5563" strokeWidth="2" />
        <rect x="80" y="50" width="144" height="160" rx="32" fill="#111827" stroke="#475569" strokeWidth="1" />
        <line x1="60" y1="120" x2="244" y2="120" stroke="#9CA3AF" strokeWidth="4" strokeLinecap="round" />
        <line x1="60" y1="170" x2="244" y2="170" stroke="#9CA3AF" strokeWidth="4" strokeLinecap="round" />

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
                rx="10"
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
                y={position.y + TYRE_HEIGHT + 18}
                textAnchor="middle"
                fill={isActive ? "#F8FAFC" : colors.label}
                fontSize="12"
                fontWeight="600"
              >
                {label}
              </text>
            </g>
          );
        })}

        <text x="152" y="18" textAnchor="middle" fontSize="12" fill="#CBD5F5" letterSpacing="2">
          FRONT
        </text>
        <text x="152" y="248" textAnchor="middle" fontSize="12" fill="#CBD5F5" letterSpacing="2">
          REAR
        </text>

        <defs>
          <filter id="tyreShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.45)" />
          </filter>
        </defs>
      </svg>

      <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap" }}>
        {[
          { label: "Not Checked", status: "unknown" },
          { label: "0–2.5mm", status: "danger" },
          { label: "2.6–3.5mm", status: "advisory" },
          { label: "3.6mm+", status: "good" },
        ].map(({ label, status }) => (
          <div
            key={status}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#E2E8F0",
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
