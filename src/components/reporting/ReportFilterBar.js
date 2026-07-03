// file location: src/components/reporting/ReportFilterBar.js
//
// Shared reporting toolbar: date range, trend granularity, search, and the
// report tab row in one surface. It emits a normalised-filter-shaped patch via
// `onPatch`; the engine/filters.js does the real normalisation server-side.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { reportDevKey } from "./reportDevOverlay";

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

// Everything stays on a single row — the toolbar never wraps; the search bar
// (below) is the flexible element that shrinks to keep the line intact.
const toolbarStyle = {
  display: "flex",
  flexWrap: "nowrap",
  gap: 12,
  alignItems: "center",
  justifyContent: "space-between",
};

const controlsStyle = {
  display: "flex",
  flexWrap: "nowrap",
  gap: 10,
  alignItems: "center",
  justifyContent: "flex-end",
  flex: "1 1 auto",
  minWidth: 0,
};

// Tabs keep their natural width and never shrink, so the tab group always
// renders on one line.
const tabsWrapStyle = {
  flex: "0 0 auto",
  minWidth: 0,
};

// Both pickers share one fixed, even width so the date-range and granularity
// dropdowns line up regardless of their (differing) label lengths.
const pickerStyle = {
  flex: "0 0 150px",
  width: 150,
};

// Search bar is the flexible control: it grows to fill the remaining space and
// auto-shrinks (down to its min) so the whole toolbar stays on one line. Its
// max width is capped so it stays even with the pickers and never crowds out an
// added tab (e.g. Efficiency) — keeping the whole row on a single line.
const searchStyle = {
  flex: "1 1 160px",
  minWidth: 140,
  maxWidth: 320,
};

export default function ReportFilterBar({
  filter,
  onPatch,
  departmentLabel,
  tabItems = [],
  tabValue,
  onTabChange,
  tabAriaLabel = "Report sections",
  children,
}) {
  const filterKey = reportDevKey("report-filter", departmentLabel || "global");

  return (
    <LayerSurface
      radius="var(--radius-sm)"
      padding="0"
      gap="12px"
      sectionKey={filterKey}
      sectionType="toolbar"
      data-dev-text-preview={`${departmentLabel || "Report"} filters and tabs`}
    >
      <div style={toolbarStyle}>
        {tabItems.length > 0 && (
          <div style={tabsWrapStyle}>
            <TabGroup
              items={tabItems}
              value={tabValue}
              onChange={onTabChange}
              ariaLabel={tabAriaLabel}
              devSectionKey={`${filterKey}-tabs`}
              devSectionParent={filterKey}
            />
          </div>
        )}

        <div style={controlsStyle}>
          <DropdownField
            ariaLabel="Date range"
            options={RANGE_OPTIONS}
            value={filter.range || "last_30d"}
            onChange={(event) => onPatch({ range: event.target.value, from: null, to: null })}
            placeholder="Select range"
            className="compact-picker"
            style={pickerStyle}
            size="sm"
          />

          <DropdownField
            ariaLabel="Trend granularity"
            options={GRANULARITY_OPTIONS}
            value={filter.granularity || "day"}
            onChange={(event) => onPatch({ granularity: event.target.value })}
            placeholder="Select granularity"
            className="compact-picker"
            style={pickerStyle}
            size="sm"
          />

          <SearchBar
            type="search"
            ariaLabel="Filter records"
            placeholder="Filter records..."
            value={filter.search || ""}
            onChange={(event) => onPatch({ search: event.target.value })}
            onClear={() => onPatch({ search: "" })}
            style={searchStyle}
          />

          {children && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{children}</div>}
        </div>
      </div>
    </LayerSurface>
  );
}
