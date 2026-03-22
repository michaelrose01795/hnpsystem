import React from "react";
import {
  widgetGhostButtonStyle,
  widgetInputStyle,
} from "@/components/profile/personal/widgets/shared";
import { formatMonthLabel, normaliseMonthKey, shiftMonthKey } from "@/lib/profile/monthPlanning";

export default function MonthPicker({
  value,
  onChange,
  compact = false,
  align = "left",
  showLabel = true,
}) {
  const monthKey = normaliseMonthKey(value);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        gap: "8px",
      }}
    >
      {showLabel ? (
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Month
        </div>
      ) : null}
      <button type="button" onClick={() => onChange?.(shiftMonthKey(monthKey, -1))} style={widgetGhostButtonStyle}>
        Prev
      </button>
      <input
        type="month"
        value={monthKey}
        onChange={(event) => onChange?.(normaliseMonthKey(event.target.value, monthKey))}
        style={{
          ...widgetInputStyle,
          width: compact ? "100%" : "150px",
          minWidth: compact ? "0" : "150px",
        }}
      />
      <button type="button" onClick={() => onChange?.(shiftMonthKey(monthKey, 1))} style={widgetGhostButtonStyle}>
        Next
      </button>
      {!compact ? (
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
          {formatMonthLabel(monthKey)}
        </div>
      ) : null}
    </div>
  );
}
