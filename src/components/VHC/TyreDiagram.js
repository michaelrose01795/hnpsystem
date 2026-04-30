// file location: src/components/VHC/TyreDiagram.js
import React from "react";
import themeConfig from "@/styles/appTheme";
import CarImage from "@/components/VHC/CarImage";

const { palette } = themeConfig;

const DIAGRAM_WIDTH = 308;
const DIAGRAM_HEIGHT = 380;
const TYRE_HIT_WIDTH = 48;
const TYRE_HIT_HEIGHT = 110;
const SHOW_ALIGNMENT_DEBUG = false;

const TYRE_KEYS = [
  { key: "nsf", label: "N/S/F", position: { left: 27.2, top: 23.2 } },
  { key: "osf", label: "O/S/F", position: { left: 72.2, top: 23.2 } },
  { key: "nsr", label: "N/S/R", position: { left: 27.2, top: 72.374 } },
  { key: "osr", label: "O/S/R", position: { left: 72.2, top: 72.374 } },
];

const statusPalette = {
  unknown: {
    fill: "rgba(var(--primary-rgb), 0.2)",
    text: "var(--text-1)",
    label: "var(--primary)",
    border: "rgba(var(--primary-rgb), 0.5)",
  },
  danger: {
    fill: "var(--danger)",
    text: "var(--text-2)",
    label: "var(--danger-dark)",
    border: "none",
  },
  advisory: {
    fill: "var(--warning)",
    text: "var(--text-2)",
    label: "var(--warning-dark)",
    border: "none",
  },
  good: {
    fill: "var(--success)",
    text: "var(--text-2)",
    label: "var(--success-dark)",
    border: "none",
  },
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
      readingText: value.readingText,
    };
  }
  return { depth: value, overrideStatus: null };
};

export default function TyreDiagram({
  tyres = {},
  activeTyre,
  onSelect,
  spareActive = false,
  onSpareSelect,
  invalidTyres = [],
  invalidSpare = false,
}) {
  const activeKey = activeTyre?.toLowerCase();
  const invalidTyreSet = new Set((invalidTyres || []).map((key) => String(key).toLowerCase()));
  const selectedWheelFill = "rgba(var(--primary-rgb), 0.14)";
  const selectedWheelStroke = "rgba(var(--primary-rgb), 0.75)";

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
    flexShrink: 0,
  };

  return (
    <div data-dev-section="1" data-dev-section-key="vhc-wheels-diagram-container" data-dev-section-type="content-card" data-dev-section-parent="vhc-wheels-diagram" style={containerStyle}>
      <div
        data-dev-section="1"
        data-dev-section-key="vhc-wheels-diagram-stage"
        data-dev-section-type="content-card"
        data-dev-section-parent="vhc-wheels-diagram-container"
        style={stageStyle}
      >
        <CarImage
          aria-hidden="true"
          data-dev-section="1"
          data-dev-section-key="vhc-wheels-diagram-image"
          data-dev-section-type="content-card"
          data-dev-section-parent="vhc-wheels-diagram-stage"
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
        {/* Overlay matches the scaled-up car image so button percentages stay on the wheels */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "140%",
            height: "140%",
            pointerEvents: "none",
          }}
        >
        {TYRE_KEYS.map(({ key, label, position }) => {
          const entry = tyres?.[key];
          const { depth, overrideStatus, readingText: overrideText } = resolveTyreEntry(entry);
          const { readingText, status: baseStatus } = getReadingStatus(depth);
          const status = overrideStatus || baseStatus;
          const colors = statusPalette[status] || statusPalette.unknown;
          const displayText = overrideText || readingText;
          const isActive = activeKey === key;
          const isInvalid = invalidTyreSet.has(key);

          return (
            <React.Fragment
              key={key}
            >
              {isActive ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: `${position.left}%`,
                    top: `${position.top}%`,
                    transform: "translate(-50%, -50%)",
                    width: `${TYRE_HIT_WIDTH + 22}px`,
                    height: `${TYRE_HIT_HEIGHT + 22}px`,
                    borderRadius: "var(--radius-md)",
                    border: `2px dashed ${selectedWheelStroke}`,
                    background: selectedWheelFill,
                    pointerEvents: "none",
                    zIndex: 3,
                  }}
                />
              ) : null}
              <button
                type="button"
                onClick={() => onSelect?.(key)}
                aria-label={`${label} tyre`}
                data-dev-section="1"
                data-dev-section-key={`vhc-wheels-diagram-tyre-${key}`}
                data-dev-section-type="content-card"
                data-dev-section-parent="vhc-wheels-diagram-stage"
                style={{
                  position: "absolute",
                  left: `${position.left}%`,
                  top: `${position.top}%`,
                  transform: "translate(-50%, -50%)",
                  width: `${TYRE_HIT_WIDTH}px`,
                  height: `${TYRE_HIT_HEIGHT}px`,
                  maxWidth: `${TYRE_HIT_WIDTH}px`,
                  minWidth: `${TYRE_HIT_WIDTH}px`,
                  borderRadius: "var(--radius-pill)",
                  border: `${isInvalid ? 2 : isActive ? 2 : 1.5}px solid ${
                    isInvalid ? "var(--danger)" : isActive ? "var(--primary)" : colors.border
                  }`,
                  background: colors.fill,
                  boxSizing: "border-box",
                  padding: 0,
                  color: colors.text,
                  fontSize: "16px",
                  fontWeight: 800,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  cursor: onSelect ? "pointer" : "default",
                  boxShadow: isInvalid ? "0 0 0 2px var(--danger-surface)" : "none",
                  zIndex: 4,
                  pointerEvents: "auto",
                }}
              >
                {displayText}
              </button>

              {SHOW_ALIGNMENT_DEBUG ? (
                <span
                  style={{
                    position: "absolute",
                    left: `${position.left}%`,
                    top: `${position.top}%`,
                    transform: "translate(-50%, -50%)",
                    width: "6px",
                    height: "6px",
                    borderRadius: "var(--radius-pill)",
                    background: "var(--danger)",
                    zIndex: 5,
                    pointerEvents: "none",
                  }}
                />
              ) : null}
            </React.Fragment>
          );
        })}
        </div>

      </div>
      <button
        type="button"
        onClick={onSpareSelect}
        data-dev-section="1"
        data-dev-section-key="vhc-wheels-diagram-spare-btn"
        data-dev-section-type="content-card"
        data-dev-section-parent="vhc-wheels-diagram-container"
        style={{
          marginTop: "12px",
          borderRadius: "var(--control-radius)",
          border: "none",
          minHeight: "var(--control-height-md)",
          padding: "10px 20px",
          background: invalidSpare
            ? "var(--danger-surface)"
            : spareActive
              ? "var(--primary)"
              : "var(--control-bg-hover)",
          color: invalidSpare ? "var(--danger)" : spareActive ? "var(--text-2)" : "var(--text-1)",
          fontWeight: 600,
          fontSize: "15px",
          cursor: onSpareSelect ? "pointer" : "default",
          boxShadow: invalidSpare ? "0 0 0 2px var(--danger-surface)" : "none",
          transition: "background-color 0.18s ease, color 0.18s ease",
          zIndex: 4,
        }}
      >
        Spare / Kit
      </button>
    </div>
  );
}
