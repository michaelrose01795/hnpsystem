// file location: src/components/VHC/TyreDiagram.js
import React from "react";
import themeConfig from "@/styles/appTheme";

const { palette } = themeConfig;

const DIAGRAM_WIDTH = 310;
const DIAGRAM_HEIGHT = 382.47;
const TYRE_HIT_WIDTH = 30;
const TYRE_HIT_HEIGHT = 70;
const SHOW_ALIGNMENT_DEBUG = false;

const TYRE_KEYS = [
  { key: "nsf", label: "N/S/F", position: { left: 27.2, top: 23.2 } },
  { key: "osf", label: "O/S/F", position: { left: 72.2, top: 23.2 } },
  { key: "nsr", label: "N/S/R", position: { left: 27.2, top: 72.374 } },
  { key: "osr", label: "O/S/R", position: { left: 72.2, top: 72.374 } },
];

const statusPalette = {
  unknown: {
    fill: "rgba(var(--accent-purple-rgb), 0.2)",
    text: "var(--text-primary)",
    label: "var(--accent-purple)",
    border: "rgba(var(--accent-purple-rgb), 0.5)",
  },
  danger: {
    fill: "var(--danger)",
    text: "var(--text-inverse)",
    label: "var(--danger-dark)",
    border: "var(--danger-dark)",
  },
  advisory: {
    fill: "var(--warning)",
    text: "var(--text-inverse)",
    label: "var(--warning-dark)",
    border: "var(--warning-dark)",
  },
  good: {
    fill: "var(--success)",
    text: "var(--text-inverse)",
    label: "var(--success-dark)",
    border: "var(--success-dark)",
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
  const selectedWheelFill = "rgba(var(--accent-purple-rgb), 0.14)";
  const selectedWheelStroke = "rgba(var(--accent-purple-rgb), 0.75)";

  const containerStyle = {
    width: "100%",
    borderRadius: "var(--radius-xl)",
    padding: "24px",
    border: "1px solid rgba(var(--accent-purple-rgb), 0.22)",
    background: palette.surface,
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "none",
    color: palette.textPrimary,
  };

  const stageStyle = {
    width: "100%",
    maxWidth: "360px",
    aspectRatio: `${DIAGRAM_WIDTH} / ${DIAGRAM_HEIGHT}`,
    position: "relative",
    margin: 0,
    padding: 0,
    borderRadius: "var(--radius-md)",
    backgroundColor: "rgba(var(--accent-purple-rgb), 0.03)",
    backgroundImage: "var(--vhc-vehicle-diagram-image)",
    backgroundPosition: "50% 50%",
    backgroundRepeat: "no-repeat",
    backgroundSize: "118% auto",
    display: "grid",
    placeItems: "center",
    boxShadow: "inset 0 0 0 1px rgba(var(--accent-purple-rgb), 0.18)",
  };

  return (
    <div style={containerStyle}>
      <div style={stageStyle}>
        <svg
          viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
          role="img"
          aria-label="Vehicle tyre overview diagram"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            pointerEvents: "none",
          }}
        />

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
                    isInvalid ? "var(--danger)" : isActive ? "var(--accent-purple)" : colors.border
                  }`,
                  background: colors.fill,
                  boxSizing: "border-box",
                  padding: 0,
                  color: colors.text,
                  fontSize: "14px",
                  fontWeight: 800,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  cursor: onSelect ? "pointer" : "default",
                  boxShadow: isInvalid ? "0 0 0 2px var(--danger-surface)" : "none",
                  zIndex: 4,
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
      <button
        type="button"
        onClick={onSpareSelect}
        style={{
          borderRadius: "var(--radius-md)",
          border: `1px solid ${invalidSpare ? "var(--danger)" : spareActive ? "var(--accent-purple)" : "rgba(var(--accent-purple-rgb), 0.22)"}`,
          padding: "8px 18px",
          background: invalidSpare
            ? "var(--danger-surface)"
            : spareActive
              ? "rgba(var(--accent-purple-rgb), 0.12)"
              : "rgba(var(--accent-purple-rgb), 0.05)",
          color: invalidSpare ? "var(--danger)" : spareActive ? "var(--accent-purple)" : palette.textPrimary,
          fontWeight: 600,
          cursor: onSpareSelect ? "pointer" : "default",
          boxShadow: invalidSpare ? "0 0 0 2px var(--danger-surface)" : "none",
          transition: "transform 0.2s ease",
          zIndex: 4,
        }}
      >
        Spare / Kit
      </button>
    </div>
  );
}
