// file location: src/components/reporting/ReportFilterBar.js
//
// The shared reporting filter control: date-range preset, trend granularity and
// a free-text search. It emits a normalised-filter-shaped patch via `onPatch`;
// the engine/filters.js does the real normalisation server-side. Department is
// pinned by the package (workshop) and shown read-only.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";

// Mirror of filters.js DATE_PRESETS (the labels are presentation only).
const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_14d", label: "Last 14 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "last_90d", label: "Last 90 days" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
  { value: "month_to_date", label: "Month to date" },
  { value: "year_to_date", label: "Year to date" },
];

const GRANULARITY_OPTIONS = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "year", label: "Yearly" },
];

const fieldStyle = {
  height: 40,
  borderRadius: "var(--radius-sm)",
  padding: "0 10px",
  background: "var(--surface)",
  color: "var(--text-1)",
  border: "1px solid var(--input-ring)", // form input ring — sanctioned by the border law
  minWidth: 140,
};

export default function ReportFilterBar({ filter, onPatch, departmentLabel, children }) {
  return (
    <LayerSurface radius="var(--radius-sm)" padding="12px" gap="10px">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--surfaceTextMuted)" }}>
          Date range
          <select style={fieldStyle} value={filter.range || "last_30d"} onChange={(e) => onPatch({ range: e.target.value, from: null, to: null })}>
            {RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--surfaceTextMuted)" }}>
          Trend granularity
          <select style={fieldStyle} value={filter.granularity || "day"} onChange={(e) => onPatch({ granularity: e.target.value })}>
            {GRANULARITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--surfaceTextMuted)" }}>
          Search
          <input
            type="search"
            placeholder="Filter records…"
            style={{ ...fieldStyle, minWidth: 180 }}
            value={filter.search || ""}
            onChange={(e) => onPatch({ search: e.target.value })}
          />
        </label>

        {departmentLabel && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--surfaceTextMuted)" }}>
            Department
            <div style={{ ...fieldStyle, display: "flex", alignItems: "center", fontWeight: 600, color: "var(--accentText)" }}>
              {departmentLabel}
            </div>
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "flex-end" }}>{children}</div>
      </div>
    </LayerSurface>
  );
}
