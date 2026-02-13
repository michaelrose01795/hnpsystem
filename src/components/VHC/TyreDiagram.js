// file location: src/components/VHC/TyreDiagram.js
import React from "react";
import themeConfig from "@/styles/appTheme";

const { palette } = themeConfig;

const DIAGRAM_WIDTH = 310;
const DIAGRAM_HEIGHT = 382.47;
const TYRE_WIDTH = 42;
const TYRE_HEIGHT = 90;
const SHOW_ALIGNMENT_DEBUG = false;

const TYRE_KEYS = [
  { key: "nsf", label: "N/S/F", position: { left: 19.154, top: 30.264 } },
  { key: "osf", label: "O/S/F", position: { left: 80.194, top: 30.264 } },
  { key: "nsr", label: "N/S/R", position: { left: 19.154, top: 72.374 } },
  { key: "osr", label: "O/S/R", position: { left: 80.194, top: 72.374 } },
];

const statusPalette = {
  unknown: { fill: "var(--border)", text: "var(--text-primary)", label: "var(--accent-purple-surface)" },
  danger: { fill: "var(--danger)", text: "var(--text-primary)", label: "var(--danger)" },
  advisory: { fill: "var(--warning)", text: "var(--text-primary)", label: "var(--warning)" },
  good: { fill: "var(--success)", text: "var(--text-primary)", label: "var(--success)" },
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

export default function TyreDiagram({ tyres = {}, activeTyre, onSelect, spareActive = false, onSpareSelect }) {
  const activeKey = activeTyre?.toLowerCase();

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
    boxShadow: "none",
    color: palette.textPrimary,
  };

  const stageStyle = {
    width: "100%",
    maxWidth: "360px",
    aspectRatio: `${DIAGRAM_WIDTH} / ${DIAGRAM_HEIGHT}`,
    position: "relative",
    overflow: "hidden",
    borderRadius: "16px",
  };

  const backgroundStyle = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    backgroundImage: "url('/images/wheels-tyres/vehicle-bg.png')",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "contain",
    zIndex: 1,
  };

  const frontRearLabelStyle = {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: "11px",
    letterSpacing: "2px",
    color: palette.textMuted,
    fontWeight: 700,
    zIndex: 3,
  };

  return (
    <div style={containerStyle}>
      <div style={stageStyle}>
        <svg
          viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
          role="img"
          aria-label="Vehicle tyre overview diagram"
          style={backgroundStyle}
        />

        <div style={{ ...frontRearLabelStyle, top: "8%" }}>FRONT</div>
        <div style={{ ...frontRearLabelStyle, bottom: "7%" }}>REAR</div>

        {TYRE_KEYS.map(({ key, label, position }) => {
          const entry = tyres?.[key];
          const { depth, overrideStatus, readingText: overrideText } = resolveTyreEntry(entry);
          const { readingText, status: baseStatus } = getReadingStatus(depth);
          const status = overrideStatus || baseStatus;
          const colors = statusPalette[status] || statusPalette.unknown;
          const displayText = overrideText || readingText;
          const isActive = activeKey === key;

          return (
            <React.Fragment
              key={key}
            >
              <button
                type="button"
                onClick={() => onSelect?.(key)}
                aria-label={`${label} tyre`}
                style={{
                  position: "absolute",
                  left: `${position.left}%`,
                  top: `${position.top}%`,
                  transform: "translate(-50%, -50%)",
                  width: `${TYRE_WIDTH}px`,
                  height: `${TYRE_HEIGHT}px`,
                  borderRadius: "12px",
                  border: `${isActive ? 3 : 1.5}px solid ${isActive ? palette.accent : palette.border}`,
                  background: colors.fill,
                  color: colors.text,
                  fontSize: "12px",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  cursor: onSelect ? "pointer" : "default",
                  boxShadow: "0 4px 8px rgba(var(--shadow-rgb),0.55)",
                  zIndex: 4,
                }}
              >
                {displayText}
              </button>
              <div
                style={{
                  position: "absolute",
                  left: `${position.left}%`,
                  top: `${position.top}%`,
                  transform: "translate(-50%, calc(-50% + 62px))",
                  color: isActive ? palette.accent : colors.label,
                  fontSize: "12px",
                  fontWeight: 700,
                  textAlign: "center",
                  zIndex: 4,
                  pointerEvents: "none",
                }}
              >
                {label}
              </div>

              {SHOW_ALIGNMENT_DEBUG ? (
                <span
                  style={{
                    position: "absolute",
                    left: `${position.left}%`,
                    top: `${position.top}%`,
                    transform: "translate(-50%, -50%)",
                    width: "6px",
                    height: "6px",
                    borderRadius: "999px",
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
