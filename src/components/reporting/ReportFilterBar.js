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

// The toolbar prefers a single row but is allowed to wrap. Report packages
// carry anywhere from four to eight tabs, and a long tab row (Executive on
// /reports/overview, Service Advisor on /reports/service) is wider than the
// space left beside the pickers. Wrapping drops the controls onto their own
// line instead of letting the tab strip run underneath them.
const toolbarStyle = {
  display: "flex",
  flexWrap: "wrap",
  columnGap: 12,
  rowGap: 10,
  alignItems: "center",
  justifyContent: "space-between",
};

const controlsStyle = {
  display: "flex",
  flexWrap: "nowrap",
  gap: 10,
  alignItems: "center",
  justifyContent: "flex-end",
  // Basis = two 150px pickers + the search bar at its minimum + gaps. Below
  // that the controls take a row of their own rather than squeezing the tabs.
  flex: "1 1 470px",
  minWidth: 0,
};

// The tab group takes whatever room is left on the row and is allowed to
// shrink, so `.tab-api` (flex-wrap: wrap, max-width: 100%) reflows its buttons
// onto a second line inside the strip instead of overflowing the toolbar.
const tabsWrapStyle = {
  display: "flex",
  flex: "1 1 auto",
  minWidth: 0,
};

// Both pickers share one fixed, even width so the date-range and granularity
// dropdowns line up regardless of their (differing) label lengths. They may
// shrink a little before the controls wrap, but never below a readable width.
const pickerStyle = {
  flex: "0 1 150px",
  width: 150,
  minWidth: 118,
};

// Search bar is the flexible control: it grows to fill the remaining space and
// auto-shrinks (down to its min) so the control row stays on one line. Its max
// width is capped so it stays even with the pickers.
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
