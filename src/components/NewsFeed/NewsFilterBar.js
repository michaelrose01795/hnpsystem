// file location: src/components/NewsFeed/NewsFilterBar.js
//
// The toolbar above the feed: the news-specific search on the far left, then
// the category, priority and department filters and the publish action — all on
// one full-width row.
//
// Every control is a shared primitive — SearchBar and
// MultiSelectDropdown — so the toolbar cannot drift from the rest of the app.

import React from "react";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { MultiSelectDropdown } from "@/components/ui/dropdownAPI";
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
  return (
    <div className="app-news-filters">
      {/* Everything on one full-width row: search leads on the far left, then
          the three filters and the publish action share the space evenly. */}
      <div className="app-news-toolbar">
        <div className="app-news-toolbar__control">
          <SearchBar
            value={searchTerm}
            onChange={(event) => onSearchChange?.(event.target.value)}
            onClear={() => onSearchChange?.("")}
            placeholder="Search announcements, authors and departments"
            ariaLabel="Search the news feed"
          />
        </div>

        <div className="app-news-toolbar__control">
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
        </div>

        <div className="app-news-toolbar__control">
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
        </div>

        <div className="app-news-toolbar__control">
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
        </div>

        {canPublish && (
          <div className="app-news-toolbar__control app-news-toolbar__control--action">
            {/* A plus, not words: the label stays as the accessible name and
                tooltip (Button does that for any symbol button). */}
            <Button type="button" variant="primary" symbol="add" onClick={onOpenComposer}>
              New announcement
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
