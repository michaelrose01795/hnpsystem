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

// The empty state has to say something true about the filter that produced it,
// otherwise "no updates yet" looks like a fault when the user has simply
// filtered everything out.
const emptyStateFor = ({ isSearching, hasActiveFilters }) => {
  if (isSearching) {
    return {
      icon: "🔍",
      title: "No matching announcements",
      description: "Try a shorter search, or clear the category and department filters.",
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
          <SkeletonBlock width="160px" height="14px" />
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
    density,
    busyActions = {},
    permissionsFor,

    // filter state
    filters = { categories: [], priorities: [], departments: [] },
    setFilters,
    hasActiveFilters,
    searchTerm,
    setSearchTerm,

    // actions
    onOpenPost,
    onAcknowledge,
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
  } = props;

  switch (props.view) {
    case "section1": {
      const empty = emptyStateFor({ isSearching, hasActiveFilters });

      return (
        <>
          <div className="app-news">
            <NewsFilterBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
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
              onOpenComposer={onOpenComposer}
              canPublish={capabilities.canPublish}
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
                      myReactions={myReactionsByPost[post.id] || []}
                      canEdit={permissions.canEdit}
                      busyAction={busyActions[post.id] || null}
                      onOpen={onOpenPost}
                      onAcknowledge={onAcknowledge}
                      onEdit={onEditPost}
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
            // Delete lives in the composer now, not on the row — it is the
            // same permission the row used to gate its bin button with.
            canDelete={Boolean(composerPost && (permissionsFor?.(composerPost) || {}).canDelete)}
            deleting={composerPost ? busyActions[composerPost.id] === "delete" : false}
            onDelete={onDeletePost}
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
          />
        </>
      );
    }
    default:
      return null; // keep unknown sections visually empty.
  }
}
