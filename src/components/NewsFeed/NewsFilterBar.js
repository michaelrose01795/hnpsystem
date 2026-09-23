// file location: src/components/NewsFeed/NewsFilterBar.js
//
// The toolbar above the feed: the news-specific search fills the row, then the
// filter button and the publish action sit at the end. The category, priority
// and department filters live inside the filter button's floating card.
//
// Every control is a shared primitive — SearchBar, FilterButton and
// MultiSelectDropdown — so the toolbar cannot drift from the rest of the app.

import React from "react";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { MultiSelectDropdown } from "@/components/ui/dropdownAPI";
import { FilterButton, FilterField } from "@/components/ui/filterAPI";
import Button from "@/components/ui/Button";
import {
  AVAILABLE_DEPARTMENTS,
  CATEGORIES,
  PRIORITIES,
} from "@/lib/news/constants";

export default function NewsFilterBar({
  searchTerm,
  onSearchChange,
  categories = [],
  onCategoriesChange,
  priorities = [],
  onPrioritiesChange,
  departments = [],
  onDepartmentsChange,
  onOpenComposer,
  canPublish = false,
}) {
  const activeFilterCount = categories.length + priorities.length + departments.length;

  const clearFilters = () => {
    onCategoriesChange?.([]);
    onPrioritiesChange?.([]);
    onDepartmentsChange?.([]);
  };

  return (
    <div className="app-news-filters">
      <div className="app-news-toolbar">
        <div className="app-news-toolbar__control">
          <SearchBar
            value={searchTerm}
            onChange={(event) => onSearchChange?.(event.target.value)}
            onClear={() => onSearchChange?.("")}
            placeholder="Search announcements"
            ariaLabel="Search the news feed"
          />
        </div>

        <div className="app-news-toolbar__control app-news-toolbar__control--action">
          <FilterButton activeCount={activeFilterCount} onClear={clearFilters}>
            <FilterField label="Categories" htmlFor="news-filter-categories">
              <MultiSelectDropdown
                id="news-filter-categories"
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
            </FilterField>

            <FilterField label="Priorities" htmlFor="news-filter-priorities">
              <MultiSelectDropdown
                id="news-filter-priorities"
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
            </FilterField>

            <FilterField label="Departments" htmlFor="news-filter-departments">
              <MultiSelectDropdown
                id="news-filter-departments"
                placeholder="All my departments"
                searchPlaceholder="Search departments"
                options={AVAILABLE_DEPARTMENTS}
                value={departments}
                onChange={onDepartmentsChange}
                emptyState="No departments"
                maxHeight="220px"
                usePortal
              />
            </FilterField>
          </FilterButton>

          {canPublish && (
            // A plus, not words: the label stays as the accessible name and
            // tooltip (Button does that for any symbol button).
            <Button type="button" variant="primary" symbol="add" onClick={onOpenComposer}>
              New announcement
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
