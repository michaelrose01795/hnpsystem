// file location: src/pages/newsfeed.js
"use client";

// The dealership communication hub.
//
// This page is wiring only: useNewsFeed() owns the data and the actions,
// NewsFeedUi renders them, and the pieces in src/components/NewsFeed do the
// work. Anything that looks like a decision belongs in the hook, and anything
// that looks like a query belongs in src/lib/database/newsFeed.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import NewsFeedUi from "@/components/page-ui/newsfeed-ui"; // Extracted presentation layer.
import GlobalNotesWidget from "@/components/GlobalNotesWidget";
import useNewsFeed from "@/hooks/useNewsFeed";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { trace, useTraceMount, useTraceValue } from "@/utils/loadTrace"; // TEMP diagnostic tracer — remove after load flicker is fixed
import { useUser } from "@/context/UserContext";

export default function NewsFeed() {
  const { user } = useUser();
  const router = useRouter();
  const feed = useNewsFeed();

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerPost, setComposerPost] = useState(null);
  const [detailPost, setDetailPost] = useState(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [showPresentationNotesDemo, setShowPresentationNotesDemo] = useState(false);

  useTraceMount("NewsFeed page");
  useTraceValue("newsfeed.loading", feed.loading);
  useTraceValue("newsfeed.user", user ? `${user.username}#${user.id}` : "null");

  React.useEffect(() => {
    setShowPresentationNotesDemo(isPresentationMode());
  }, []);

  // Opening a post is what marks it read — the same rule everywhere, so the
  // unread count can never disagree with what the reader has actually seen.
  const openPost = useCallback(
    (post) => {
      trace("newsfeed", `openPost: ${post.id}`);
      setDetailPost(post);
      void feed.markRead(post);
    },
    [feed]
  );

  // Deep link: /newsfeed?post=<id> opens that announcement directly. This is
  // what the "Mentioned in" block on a job card, customer or VHC links to, and
  // what a notification can point at. Only fired once per id so closing the
  // modal does not immediately reopen it.
  const deepLinkedRef = useRef(null);
  useEffect(() => {
    const requested = router.query.post;
    if (!requested || feed.loading) return;
    if (deepLinkedRef.current === requested) return;

    const match = feed.posts.find((post) => String(post.id) === String(requested));
    if (!match) return;

    deepLinkedRef.current = requested;
    setDetailPost(match);
    void feed.markRead(match);
  }, [feed, router.query.post]);

  // The detail modal reads from the live feed, so an acknowledgement or a new
  // comment made inside it is reflected without closing and reopening.
  const liveDetailPost = detailPost
    ? feed.posts.find((post) => post.id === detailPost.id) || detailPost
    : null;

  const openComposer = useCallback(() => {
    setComposerPost(null);
    setComposerOpen(true);
  }, []);

  const editPost = useCallback((post) => {
    setComposerPost(post);
    setComposerOpen(true);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setComposerPost(null);
  }, []);

  const handleComposerSaved = useCallback(() => {
    void feed.reload();
  }, [feed]);

  const handlePreferencesSaved = useCallback(
    (preferences) => {
      feed.setPreferences(preferences);
      if (preferences?.feedDensity) feed.setDensity(preferences.feedDensity);
    },
    [feed]
  );

  return (
    <>
      <NewsFeedUi
        view="section1"
        visiblePosts={feed.visiblePosts}
        reactionsByPost={feed.reactionsByPost}
        myReactionsByPost={feed.myReactionsByPost}
        capabilities={feed.capabilities}
        currentUserId={feed.currentUserId}
        loading={feed.loading}
        searching={feed.searching}
        error={feed.error}
        isSearching={feed.isSearching}
        preferences={feed.preferences}
        density={feed.density}
        busyActions={feed.busyActions}
        permissionsFor={feed.permissionsFor}
        activeFilter={feed.activeFilter}
        setActiveFilter={feed.setActiveFilter}
        filters={feed.filters}
        setFilters={feed.setFilters}
        filterCounts={feed.filterCounts}
        hasActiveFilters={feed.hasActiveFilters}
        clearFilters={feed.clearFilters}
        searchTerm={feed.searchTerm}
        setSearchTerm={feed.setSearchTerm}
        includeArchived={feed.includeArchived}
        setIncludeArchived={feed.setIncludeArchived}
        setDensity={feed.setDensity}
        onOpenPost={openPost}
        onToggleRead={feed.toggleRead}
        onToggleSave={feed.toggleSave}
        onAcknowledge={feed.acknowledge}
        onTogglePin={feed.togglePin}
        onEditPost={editPost}
        onDeletePost={feed.removePost}
        onReact={feed.toggleReaction}
        composerOpen={composerOpen}
        composerPost={composerPost}
        onOpenComposer={openComposer}
        onCloseComposer={closeComposer}
        onComposerSaved={handleComposerSaved}
        detailPost={liveDetailPost}
        onCloseDetail={() => setDetailPost(null)}
        preferencesOpen={preferencesOpen}
        onOpenPreferences={() => setPreferencesOpen(true)}
        onClosePreferences={() => setPreferencesOpen(false)}
        onPreferencesSaved={handlePreferencesSaved}
        analyticsOpen={analyticsOpen}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        onCloseAnalytics={() => setAnalyticsOpen(false)}
      />
      {showPresentationNotesDemo && <GlobalNotesWidget presentationDemo />}
    </>
  );
}
