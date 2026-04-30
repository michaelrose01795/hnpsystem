import React from "react";
import themeConfig from "@/styles/appTheme";
import CarImage from "@/components/VHC/CarImage";

const { palette } = themeConfig;

const DIAGRAM_WIDTH = 308;
const DIAGRAM_HEIGHT = 380;
const PAD_WIDTH = 26;
const PAD_HEIGHT = 60;

const BRAKE_KEYS = [
  { key: "nsf", label: "NSF", position: { xPct: 27.2, yPct: 23.2 } },
  { key: "osf", label: "OSF", position: { xPct: 72.2, yPct: 23.2 } },
  { key: "nsr", label: "NSR", position: { xPct: 27.2, yPct: 72.374 } },
  { key: "osr", label: "OSR", position: { xPct: 72.2, yPct: 72.374 } },
];

const getPadStatus = (value) => {
  const reading = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(reading)) return { text: "–", status: "unknown" };
  if (reading <= 2) return { text: `${reading.toFixed(1)}`, status: "critical" };
  if (reading < 4) return { text: `${reading.toFixed(1)}`, status: "advisory" };
  return { text: `${reading.toFixed(1)}`, status: "good" };
};

const resolveBrakeEntry = (entry) => {
  if (entry && typeof entry === "object" && !(entry instanceof Array)) {
    return {
      measurement: entry.value,
      overrideStatus: entry.severity,
      isDrum: entry.isDrum || false,
    };
  }
  return { measurement: entry, overrideStatus: null, isDrum: false };
};

export default function BrakeDiagram({ brakes = {}, activeBrake, onSelect, invalidPositions = [] }) {
  const activeKey = activeBrake?.toLowerCase();
  const invalidSet = new Set((invalidPositions || []).map((key) => String(key).toLowerCase()));
  const isFrontActive = activeKey === "front" || activeKey === "nsf" || activeKey === "osf";
  const isRearActive = activeKey === "rear" || activeKey === "nsr" || activeKey === "osr";
  const unknownFill = "var(--primary)";
  const statusPalette = {
    critical: { fill: "var(--danger)", text: "var(--text-2)", label: "var(--danger)" },
    advisory: { fill: "var(--warning)", text: "var(--text-2)", label: "var(--warning)" },
    good: { fill: "var(--success)", text: "var(--text-2)", label: "var(--success)" },
    unknown: {
      fill: "rgba(var(--primary-rgb), 0.22)",
      text: "var(--text-1)",
      label: unknownFill,
    },
  };
  const selectedAxleFill = "rgba(var(--primary-rgb), 0.14)";
  const selectedAxleStroke = "rgba(var(--primary-rgb), 0.75)";

  const containerStyle = {
    width: "100%",
    background: "var(--theme)",
    padding: "4px",
    borderRadius: "var(--section-card-radius)",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    alignItems: "center",
    justifyContent: "center",
    color: palette.textPrimary,
    border: "1px solid var(--accent-border)",
    boxShadow: "none",
  };

  const stageStyle = {
    width: "100%",
    maxWidth: "none",
    aspectRatio: `${DIAGRAM_WIDTH} / ${DIAGRAM_HEIGHT}`,
    position: "relative",
    background: "transparent",
    overflow: "visible",
  };

  return (
    <div data-dev-section="1" data-dev-section-key="vhc-brakes-diagram-container" data-dev-section-type="content-card" data-dev-section-parent="vhc-brakes-diagram" style={containerStyle}>
      <div
        data-dev-section="1"
        data-dev-section-key="vhc-brakes-diagram-stage"
        data-dev-section-type="content-card"
        data-dev-section-parent="vhc-brakes-diagram-container"
        style={stageStyle}
      >
        <CarImage
          aria-hidden="true"
          data-dev-section="1"
          data-dev-section-key="vhc-brakes-diagram-image"
          data-dev-section-type="content-card"
          data-dev-section-parent="vhc-brakes-diagram-stage"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "140%",
            height: "auto",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      <svg
        viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
        role="img"
        aria-label="Brake pad and disc overview diagram"
        data-dev-section="1"
        data-dev-section-key="vhc-brakes-diagram-svg"
        data-dev-section-type="content-card"
        data-dev-section-parent="vhc-brakes-diagram-stage"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "140%",
          height: "140%",
        }}
      >
        {isFrontActive ? (
          <rect
            x={((27.2 / 100) * DIAGRAM_WIDTH) - PAD_WIDTH / 2 - 16}
            y={((23.2 / 100) * DIAGRAM_HEIGHT) - PAD_HEIGHT / 2 - 12}
            width={((72.2 - 27.2) / 100) * DIAGRAM_WIDTH + PAD_WIDTH + 32}
            height={PAD_HEIGHT + 24}
            rx="18"
            fill={selectedAxleFill}
            stroke={selectedAxleStroke}
            strokeWidth="2"
            strokeDasharray="5 5"
            pointerEvents="none"
          />
        ) : null}
        {isRearActive ? (
          <rect
            x={((27.2 / 100) * DIAGRAM_WIDTH) - PAD_WIDTH / 2 - 16}
            y={((72.374 / 100) * DIAGRAM_HEIGHT) - PAD_HEIGHT / 2 - 12}
            width={((72.2 - 27.2) / 100) * DIAGRAM_WIDTH + PAD_WIDTH + 32}
            height={PAD_HEIGHT + 24}
            rx="18"
            fill={selectedAxleFill}
            stroke={selectedAxleStroke}
            strokeWidth="2"
            strokeDasharray="5 5"
            pointerEvents="none"
          />
        ) : null}

        {BRAKE_KEYS.map(({ key, position }) => {
          const centerX = (position.xPct / 100) * DIAGRAM_WIDTH;
          const centerY = (position.yPct / 100) * DIAGRAM_HEIGHT;
          const x = centerX - PAD_WIDTH / 2;
          const y = centerY - PAD_HEIGHT / 2;
          const entry = brakes?.[key];
          const { measurement, overrideStatus, isDrum } = resolveBrakeEntry(entry);

          let text, status;

          if (isDrum && measurement === "drum") {
            // Display drum brake status
            text = "drum";
            status = overrideStatus || "unknown";
          } else {
            // Display regular pad measurement
            const padInfo = getPadStatus(measurement);
            text = padInfo.text;
            status = overrideStatus || padInfo.status;
          }

          const colors = statusPalette[status] || statusPalette.unknown;
          const isFrontWheel = key === "nsf" || key === "osf";
          const isRearWheel = key === "nsr" || key === "osr";
          const isActive = (isFrontWheel && isFrontActive) || (isRearWheel && isRearActive);
          const isInvalid = invalidSet.has(key);

          return (
            <g
              key={key}
              onClick={() => onSelect?.(isFrontWheel ? "front" : "rear")}
              style={{ cursor: onSelect ? "pointer" : "default" }}
              data-dev-section="1"
              data-dev-section-key={`vhc-brakes-diagram-pad-${key}`}
              data-dev-section-type="content-card"
              data-dev-section-parent="vhc-brakes-diagram-svg"
            >
              <rect
                x={x}
                y={y}
                width={PAD_WIDTH}
                height={PAD_HEIGHT}
                rx="12"
                fill={colors.fill}
                stroke={
                  isInvalid
                    ? "var(--danger)"
                    : isActive
                    ? "var(--primary)"
                    : status === "unknown"
                    ? "rgba(var(--primary-rgb), 0.45)"
                    : colors.fill
                }
                strokeWidth={isInvalid ? 3 : isActive ? 3 : 1.5}
              />
              <text
                x={centerX}
                y={centerY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={colors.text}
                fontSize={isDrum ? "9" : "11"}
                fontWeight="700"
              >
                {text}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}
