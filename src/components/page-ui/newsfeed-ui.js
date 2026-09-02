// file location: src/components/page-ui/newsfeed-ui.js
//
// Presentation layer for /newsfeed — the dealership communication hub.
//
// This file renders; it decides nothing. Every piece of state and every action
// arrives as a prop from the page, which gets them from useNewsFeed(). The
// `view` switch is the convention the rest of src/components/page-ui follows.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import NewsFilterBar from "@/components/NewsFeed/NewsFilterBar";
import NewsPostCard from "@/components/NewsFeed/NewsPostCard";
import NewsComposerModal from "@/components/NewsFeed/NewsComposerModal";
import NewsPostDetailModal from "@/components/NewsFeed/NewsPostDetailModal";
import NewsPreferencesModal from "@/components/NewsFeed/NewsPreferencesModal";
import NewsAnalyticsModal from "@/components/NewsFeed/NewsAnalyticsModal";
import { FEED_FILTER_ACK, FEED_FILTER_SAVED, FEED_FILTER_UNREAD } from "@/lib/news/constants";

// The empty state has to say something true about the filter that produced it,
// otherwise "no updates yet" reads as a fault when the reader has simply
// filtered everything out.
const emptyStateFor = ({ activeFilter, isSearching, hasActiveFilters }) => {
  if (isSearching) {
    return {
      icon: "🔍",
      title: "No matching announcements",
      description: "Try a shorter search, or clear the category and department filters.",
    };
  }
  if (activeFilter === FEED_FILTER_UNREAD) {
    return {
      icon: "✅",
      title: "You are all caught up",
      description: "Nothing in your departments is waiting to be read.",
    };
  }
  if (activeFilter === FEED_FILTER_ACK) {
    return {
      icon: "✅",
      title: "Nothing needs your sign-off",
      description: "Every announcement that asked for an acknowledgement has one from you.",
    };
  }
  if (activeFilter === FEED_FILTER_SAVED) {
    return {
      icon: "★",
      title: "No saved announcements",
      description: "Use the star on any post to keep it here for later.",
    };
  }
  if (hasActiveFilters) {
    return {
      icon: "🔍",
      title: "Nothing matches these filters",
      description: "Clear the filters to see the rest of the feed.",
    };
  }
  return {
    icon: "📣",
    title: "No updates yet",
    description:
      "No announcements have been published for your departments yet. New ones appear here.",
  };
};

function FeedSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SkeletonKeyframes />
      {Array.from({ length: 3 }).map((_, index) => (
        <LayerSurface key={index} radius="var(--radius-sm)" padding={18} gap={10}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <SkeletonBlock width="38px" height="38px" borderRadius="999px" />
            <SkeletonBlock width="160px" height="14px" />
          </div>
          <SkeletonBlock width="80%" height="18px" />
          <SkeletonBlock width="100%" height="12px" />
          <SkeletonBlock width="90%" height="12px" />
        </LayerSurface>
      ))}
    </div>
  );
}

export default function NewsFeedUi(props) {
  const {
    // data
    visiblePosts = [],
    reactionsByPost = {},
    myReactionsByPost = {},
    capabilities = {},
    currentUserId,
    loading,
    searching,
    error,
    isSearching,
    preferences,
    density,
    busyActions = {},
    permissionsFor,

    // filter state
    activeFilter,
    setActiveFilter,
    filters = { categories: [], priorities: [], departments: [] },
    setFilters,
    filterCounts,
    hasActiveFilters,
    clearFilters,
    searchTerm,
    setSearchTerm,
    includeArchived,
    setIncludeArchived,
    setDensity,

    // actions
    onOpenPost,
    onToggleRead,
    onToggleSave,
    onAcknowledge,
    onTogglePin,
    onEditPost,
    onDeletePost,
    onReact,

    // modal state
    composerOpen,
    composerPost,
    onCloseComposer,
    onOpenComposer,
    onComposerSaved,
    detailPost,
    onCloseDetail,
    preferencesOpen,
    onOpenPreferences,
    onClosePreferences,
    onPreferencesSaved,
    analyticsOpen,
    onOpenAnalytics,
    onCloseAnalytics,
  } = props;

  switch (props.view) {
    case "section1": {
      const empty = emptyStateFor({ activeFilter, isSearching, hasActiveFilters });

      return (
        <>
          <div className="app-news">
            <NewsFilterBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              filterCounts={filterCounts}
              categories={filters.categories}
              onCategoriesChange={(value) =>
                setFilters((previous) => ({ ...previous, categories: value }))
              }
              priorities={filters.priorities}
              onPrioritiesChange={(value) =>
                setFilters((previous) => ({ ...previous, priorities: value }))
              }
              departments={filters.departments}
              onDepartmentsChange={(value) =>
                setFilters((previous) => ({ ...previous, departments: value }))
              }
              density={density}
              onDensityChange={setDensity}
              includeArchived={includeArchived}
              onIncludeArchivedChange={setIncludeArchived}
              onOpenComposer={onOpenComposer}
              onOpenPreferences={onOpenPreferences}
              onOpenAnalytics={onOpenAnalytics}
              canPublish={capabilities.canPublish}
              canViewAnalytics={capabilities.canViewAnalytics}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
            />

            {error && (
              <div className="app-status-message app-status-message--danger" role="alert">
                {error}
              </div>
            )}

            {loading ? (
              <FeedSkeleton />
            ) : visiblePosts.length === 0 ? (
              <EmptyState
                icon={empty.icon}
                title={searching ? "Searching…" : empty.title}
                description={empty.description}
              />
            ) : (
              <div
                className={`app-news-list${density === "compact" ? " app-news-list--compact" : ""}`}
              >
                {visiblePosts.map((post) => {
                  const permissions = permissionsFor?.(post) || {};
                  return (
                    <NewsPostCard
                      key={post.id}
                      post={post}
                      currentUserId={currentUserId}
                      density={density}
                      reactions={reactionsByPost[post.id] || []}
                      myReactions={myReactionsByPost[post.id] || []}
                      canPin={capabilities.canPin}
                      canEdit={permissions.canEdit}
                      canDelete={permissions.canDelete}
                      busyAction={busyActions[post.id] || null}
                      onOpen={onOpenPost}
                      onToggleRead={onToggleRead}
                      onToggleSave={onToggleSave}
                      onAcknowledge={onAcknowledge}
                      onTogglePin={onTogglePin}
                      onEdit={onEditPost}
                      onDelete={onDeletePost}
                      onReact={onReact}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <NewsComposerModal
            isOpen={composerOpen}
            post={composerPost}
            onClose={onCloseComposer}
            onSaved={onComposerSaved}
          />

          <NewsPostDetailModal
            isOpen={Boolean(detailPost)}
            post={detailPost}
            currentUserId={currentUserId}
            reactions={detailPost ? reactionsByPost[detailPost.id] || [] : []}
            canModerate={capabilities.canModerate}
            busyAction={detailPost ? busyActions[detailPost.id] || null : null}
            onClose={onCloseDetail}
            onAcknowledge={onAcknowledge}
            onToggleSave={onToggleSave}
          />

          <NewsPreferencesModal
            isOpen={preferencesOpen}
            preferences={preferences}
            onClose={onClosePreferences}
            onSaved={onPreferencesSaved}
          />

          <NewsAnalyticsModal isOpen={analyticsOpen} onClose={onCloseAnalytics} />
        </>
      );
    }
    default:
      return null; // keep unknown sections visually empty.
  }
}
