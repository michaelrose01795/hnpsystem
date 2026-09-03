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
  const [showPresentationNotesDemo, setShowPresentationNotesDemo] = useState(false);

  useTraceMount("NewsFeed page");
  useTraceValue("newsfeed.loading", feed.loading);
  useTraceValue("newsfeed.user", user ? `${user.username}#${user.id}` : "null");

  React.useEffect(() => {
    setShowPresentationNotesDemo(isPresentationMode());
  }, []);

  const openPost = useCallback(
    (post) => {
      trace("newsfeed", `openPost: ${post.id}`);
      setDetailPost(post);
    },
    []
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
  }, [feed, router.query.post]);

  // The detail modal uses the live feed, so an acknowledgement or a new
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
        density={feed.density}
        busyActions={feed.busyActions}
        permissionsFor={feed.permissionsFor}
        filters={feed.filters}
        setFilters={feed.setFilters}
        hasActiveFilters={feed.hasActiveFilters}
        searchTerm={feed.searchTerm}
        setSearchTerm={feed.setSearchTerm}
        onOpenPost={openPost}
        onAcknowledge={feed.acknowledge}
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
      />
      {showPresentationNotesDemo && <GlobalNotesWidget presentationDemo />}
    </>
  );
}
