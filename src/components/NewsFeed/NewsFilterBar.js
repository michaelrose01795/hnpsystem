// file location: src/components/NewsFeed/NewsFilterBar.js
//
// The toolbar above the feed: news-specific search, the quick filter tabs
// (All / Unread / Needs action / Mentions / Saved / Pinned), the category,
// priority and department filters, and the compact/comfortable view switch.
//
// Every control is a shared primitive — SearchBar, TabGroup, DropdownField and
// MultiSelectDropdown — so the toolbar cannot drift from the rest of the app.

import React from "react";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { DropdownField, MultiSelectDropdown } from "@/components/ui/dropdownAPI";
import Button from "@/components/ui/Button";
import {
  AVAILABLE_DEPARTMENTS,
  CATEGORIES,
  DENSITY_COMFORTABLE,
  DENSITY_COMPACT,
  FEED_FILTERS,
  PRIORITIES,
} from "@/lib/news/constants";

const DENSITY_OPTIONS = [
  { value: DENSITY_COMFORTABLE, label: "Comfortable", description: "Full posts with attachments." },
  { value: DENSITY_COMPACT, label: "Compact", description: "Denser rows, shorter previews." },
];

export default function NewsFilterBar({
  searchTerm,
  onSearchChange,
  activeFilter,
  onFilterChange,
  filterCounts = {},
  categories = [],
  onCategoriesChange,
  priorities = [],
  onPrioritiesChange,
  departments = [],
  onDepartmentsChange,
  density = DENSITY_COMFORTABLE,
  onDensityChange,
  includeArchived = false,
  onIncludeArchivedChange,
  onOpenComposer,
  onOpenPreferences,
  onOpenAnalytics,
  canPublish = false,
  canViewAnalytics = false,
  hasActiveFilters = false,
  onClearFilters,
}) {
  const filterItems = FEED_FILTERS.map((filter) => {
    const count = filterCounts[filter.value];
    return {
      value: filter.value,
      label: count ? `${filter.label} (${count})` : filter.label,
    };
  });

  return (
    <div className="app-news-filters">
      <div className="app-news-toolbar">
        <div className="app-news-toolbar__search">
          <SearchBar
            value={searchTerm}
            onChange={(event) => onSearchChange?.(event.target.value)}
            onClear={() => onSearchChange?.("")}
            placeholder="Search announcements, authors and departments"
            ariaLabel="Search the news feed"
          />
        </div>

        <div className="app-news-toolbar__actions">
          {canViewAnalytics && (
            <Button type="button" variant="secondary" size="sm" onClick={onOpenAnalytics}>
              Analytics
            </Button>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={onOpenPreferences}>
            Notifications
          </Button>
          {canPublish && (
            <Button type="button" variant="primary" size="sm" onClick={onOpenComposer}>
              New announcement
            </Button>
          )}
        </div>
      </div>

      <TabGroup
        items={filterItems}
        value={activeFilter}
        onChange={onFilterChange}
        ariaLabel="Filter the feed"
      />

      <div className="app-news-filters__group" style={{ flex: "1 1 200px" }}>
        <MultiSelectDropdown
          id="news-filter-categories"
          label="Category"
          placeholder="All categories"
          searchPlaceholder="Search categories"
          options={CATEGORIES.map((category) => ({
            value: category.value,
            label: category.label,
          }))}
          value={categories}
          onChange={onCategoriesChange}
          emptyState="No categories"
          maxHeight="220px"
          usePortal
        />
      </div>

      <div className="app-news-filters__group" style={{ flex: "1 1 180px" }}>
        <MultiSelectDropdown
          id="news-filter-priorities"
          label="Priority"
          placeholder="Any priority"
          searchPlaceholder="Search priorities"
          options={PRIORITIES.map((priority) => ({
            value: priority.value,
            label: priority.label,
            description: priority.description,
          }))}
          value={priorities}
          onChange={onPrioritiesChange}
          emptyState="No priorities"
          maxHeight="220px"
          usePortal
        />
      </div>

      <div className="app-news-filters__group" style={{ flex: "1 1 200px" }}>
        <MultiSelectDropdown
          id="news-filter-departments"
          label="Department"
          placeholder="All my departments"
          searchPlaceholder="Search departments"
          options={AVAILABLE_DEPARTMENTS}
          value={departments}
          onChange={onDepartmentsChange}
          emptyState="No departments"
          maxHeight="220px"
          usePortal
        />
      </div>

      <div className="app-news-filters__group" style={{ flex: "0 1 190px" }}>
        <DropdownField
          id="news-filter-density"
          label="View"
          options={DENSITY_OPTIONS}
          value={density}
          onValueChange={(value) => onDensityChange?.(value)}
        />
      </div>

      <div className="app-news-filters__group">
        <Button
          type="button"
          variant={includeArchived ? "theme" : "ghost"}
          size="sm"
          aria-pressed={includeArchived}
          onClick={() => onIncludeArchivedChange?.(!includeArchived)}
        >
          {includeArchived ? "Hiding nothing" : "Include archived"}
        </Button>

        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
