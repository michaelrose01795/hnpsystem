// file location: src/components/VHC/TyreDiagram.js
import React from "react";
import themeConfig from "@/styles/appTheme";
import VehicleDiagram from "@/features/wheels-tyres/components/VehicleDiagram";

const { palette } = themeConfig;

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

  const wheelData = {
    NSF: resolveTyreEntry(tyres?.nsf),
    OSF: resolveTyreEntry(tyres?.osf),
    NSR: resolveTyreEntry(tyres?.nsr),
    OSR: resolveTyreEntry(tyres?.osr),
  };

  Object.keys(wheelData).forEach((key) => {
    const { depth, overrideStatus, readingText } = wheelData[key];
    const computed = getReadingStatus(depth);
    wheelData[key] = {
      treadDepth: readingText || computed.readingText,
      condition: overrideStatus || computed.status,
    };
  });

  return (
    <div style={containerStyle}>
      <VehicleDiagram
        selectedWheel={activeTyre || null}
        onWheelSelect={(wheelKey) => onSelect?.(wheelKey.toLowerCase())}
        wheelData={wheelData}
      />

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
