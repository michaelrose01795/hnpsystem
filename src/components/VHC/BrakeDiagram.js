// All borders in this file are diagram primitives — exempt from border ban.
import React from "react";
import themeConfig from "@/styles/appTheme";
import CarImage from "@/components/VHC/CarImage";
import useIsMobile from "@/hooks/useIsMobile";

const { palette } = themeConfig;

const DIAGRAM_WIDTH = 308;
const DIAGRAM_HEIGHT = 380;
const HEIGHT_DRIVEN_DIAGRAM_SIZE = "109cqh";
const PAD_WIDTH = 48;
const PAD_HEIGHT = 110;

const BRAKE_KEYS = [
  { key: "nsf", label: "NSF", position: { left: 27.2, top: 23.2 } },
  { key: "osf", label: "OSF", position: { left: 72.2, top: 23.2 } },
  { key: "nsr", label: "NSR", position: { left: 27.2, top: 72.374 } },
  { key: "osr", label: "OSR", position: { left: 72.2, top: 72.374 } },
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
  const isMobile = useIsMobile(767);
  const activeKey = activeBrake?.toLowerCase();
  const invalidSet = new Set((invalidPositions || []).map((key) => String(key).toLowerCase()));
  const isFrontActive = activeKey === "front" || activeKey === "nsf" || activeKey === "osf";
  const isRearActive = activeKey === "rear" || activeKey === "nsr" || activeKey === "osr";
  const statusPalette = {
    critical: { fill: "var(--danger)", text: "var(--text-2)", border: "none" },
    advisory: { fill: "var(--warning)", text: "var(--text-2)", border: "none" },
    good: { fill: "var(--success)", text: "var(--text-2)", border: "none" },
    unknown: {
      fill: "rgba(var(--primary-rgb), 0.22)",
      text: "var(--text-1)",
      border: "rgba(var(--primary-rgb), 0.45)",
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
    height: "100%",
    minHeight: 0,
    color: palette.textPrimary,
    border: "1px solid var(--accent-border)",
    boxShadow: "none",
  };

  const stageStyle = {
    width: "100%",
    maxWidth: "none",
    ...(isMobile
      ? {
          aspectRatio: `${DIAGRAM_WIDTH} / ${DIAGRAM_HEIGHT}`,
          flexShrink: 0,
        }
      : {
          flex: "1 1 auto",
          minHeight: `${DIAGRAM_HEIGHT}px`,
          containerType: "size", // Container-height units mirror the tyre diagram sizing.
        }),
    position: "relative",
    background: "transparent",
    overflow: "visible",
  };
  const diagramScaleStyle = isMobile
    ? {
        width: "140%",
        height: "auto",
      }
    : {
        width: HEIGHT_DRIVEN_DIAGRAM_SIZE,
        height: HEIGHT_DRIVEN_DIAGRAM_SIZE,
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
            ...diagramScaleStyle,
            aspectRatio: "1 / 1",
            maxWidth: "none",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      <div
        role="group"
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
          ...diagramScaleStyle,
          aspectRatio: "1 / 1",
          maxWidth: "none",
          pointerEvents: "none",
        }}
      >
        {BRAKE_KEYS.map(({ key, label, position }) => {
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
            <React.Fragment key={key}>
              {isActive ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: `${position.left}%`,
                    top: `${position.top}%`,
                    transform: "translate(-50%, -50%)",
                    width: `${PAD_WIDTH + 22}px`,
                    height: `${PAD_HEIGHT + 22}px`,
                    borderRadius: "var(--radius-md)",
                    border: `2px dashed ${selectedAxleStroke}`,
                    background: selectedAxleFill,
                    pointerEvents: "none",
                    zIndex: 3,
                  }}
                />
              ) : null}
              <button
                type="button"
                onClick={() => onSelect?.(isFrontWheel ? "front" : "rear")}
                aria-label={`${label} brake`}
                data-dev-section="1"
                data-dev-section-key={`vhc-brakes-diagram-pad-${key}`}
                data-dev-section-type="content-card"
                data-dev-section-parent="vhc-brakes-diagram-svg"
                style={{
                  position: "absolute",
                  left: `${position.left}%`,
                  top: `${position.top}%`,
                  transform: "translate(-50%, -50%)",
                  width: `${PAD_WIDTH}px`,
                  height: `${PAD_HEIGHT}px`,
                  maxWidth: `${PAD_WIDTH}px`,
                  minWidth: `${PAD_WIDTH}px`,
                  borderRadius: "var(--radius-pill)",
                  border: `${isInvalid ? 2 : isActive ? 2 : 1.5}px solid ${
                    isInvalid ? "var(--danger)" : isActive ? "var(--primary)" : colors.border
                  }`,
                  background: colors.fill,
                  boxSizing: "border-box",
                  padding: 0,
                  color: colors.text,
                  fontSize: isDrum ? "13px" : "16px",
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
                {text}
              </button>
            </React.Fragment>
          );
        })}
      </div>
      </div>
    </div>
  );
}
