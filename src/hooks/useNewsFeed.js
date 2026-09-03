// file location: src/hooks/useNewsFeed.js
//
// All of the communication hub's client state and behaviour in one place, so
// the page component stays a wiring layer and the presentation components stay
// dumb.
//
// It owns: loading the feed (with the login hand-off cache), the realtime
// re-read, filters and news-specific search, acknowledgement and delete
// actions with optimistic updates, reactions (through the
// existing shared reactions API — not a second implementation), and raising a
// toast for a new urgent post the reader has not muted.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useAlerts } from "@/context/AlertContext";
import {
  DENSITY_COMFORTABLE,
  PRIORITY_URGENT,
} from "@/lib/news/constants";
import { shouldNotify } from "@/lib/news/notify";
import { getNewsCapabilities, canDeletePost, canEditPost } from "@/lib/news/permissions";
import {
  cacheNewsUpdates,
  peekWarmedNewsUpdatesCache,
  readCachedNewsUpdates,
  subscribeToNewsUpdates,
} from "@/lib/database/newsUpdates";
import {
  REACTION_TARGET_NEWS_UPDATE,
  subscribeToReactions,
} from "@/lib/database/reactions";
import { fetchReactions, saveReaction } from "@/lib/api/reactions";
import {
  acknowledgePost as acknowledgePostRequest,
  deleteNewsPost,
  fetchFeed,
  searchNews,
} from "@/lib/api/news";
import { logFailure } from "@/lib/utils/logFailure";

const EMPTY_FILTERS = {
  categories: [],
  priorities: [],
  departments: [],
};

export default function useNewsFeed() {
  const { user, dbUserId } = useUser();
  const { pushAlert } = useAlerts();

  const warmed = peekWarmedNewsUpdatesCache();

  const [posts, setPosts] = useState(() => warmed?.posts || []);
  const [preferences, setPreferences] = useState(() => warmed?.preferences || null);
  const [viewerMeta, setViewerMeta] = useState(() => warmed?.viewer || null);
  const [loading, setLoading] = useState(() => warmed == null);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [density, setDensity] = useState(DENSITY_COMFORTABLE);

  const [reactionsByPost, setReactionsByPost] = useState({});
  const [busyActions, setBusyActions] = useState({});

  // Ids already announced, so a re-read never re-toasts the same post. Seeded
  // on the first load so signing in does not fire a burst of notifications for
  // everything published while you were away.
  const announcedRef = useRef(null);

  const userRoles = useMemo(() => user?.roles || [], [user?.roles]);
  const capabilities = useMemo(() => getNewsCapabilities(userRoles), [userRoles]);

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------
  const applyFeed = useCallback(
    (data) => {
      const nextPosts = Array.isArray(data?.posts) ? data.posts : [];

      if (announcedRef.current === null) {
        // First load: everything currently in the feed counts as already seen.
        announcedRef.current = new Set(nextPosts.map((post) => post.id));
      } else if (data?.preferences) {
        const fresh = nextPosts.filter(
          (post) =>
            !announcedRef.current.has(post.id) &&
            shouldNotify(data.preferences, post)
        );
        for (const post of fresh) {
          announcedRef.current.add(post.id);
          pushAlert(
            {
              message:
                post.priority === PRIORITY_URGENT
                  ? `Urgent: ${post.title}`
                  : `New announcement: ${post.title}`,
              type: post.priority === PRIORITY_URGENT ? "warning" : "info",
            },
            null,
            { duration: post.priority === PRIORITY_URGENT ? 12000 : 6000 }
          );
        }
        for (const post of nextPosts) announcedRef.current.add(post.id);
      }

      setPosts(nextPosts);
      if (data?.preferences) {
        setPreferences(data.preferences);
        setDensity(data.preferences.feedDensity || DENSITY_COMFORTABLE);
      }
      if (data?.viewer) setViewerMeta(data.viewer);
      cacheNewsUpdates(data);
    },
    [pushAlert]
  );

  const load = useCallback(async () => {
    try {
      const data = await fetchFeed();
      applyFeed(data);
      setError("");
    } catch (loadError) {
      logFailure("Failed to load the news feed:", loadError);
      setError("We could not load the news feed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [applyFeed]);

  // Seed from the session cache on mount so a hard load paints instantly.
  useEffect(() => {
    const cached = readCachedNewsUpdates();
    if (cached?.posts?.length) {
      setPosts(cached.posts);
      if (cached.preferences) {
        setPreferences(cached.preferences);
        setDensity(cached.preferences.feedDensity || DENSITY_COMFORTABLE);
      }
      if (cached.viewer) setViewerMeta(cached.viewer);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Somebody publishing, editing, pinning or expiring a post is a write to
    // public.news_updates, which lands here.
    return subscribeToNewsUpdates(() => {
      void load();
    });
  }, [load]);

  // -------------------------------------------------------------------------
  // Reactions — the shared content_reactions system, not a second one.
  // -------------------------------------------------------------------------
  const postIdKey = useMemo(() => posts.map((post) => post.id).join(","), [posts]);

  const refreshReactions = useCallback(async (ids) => {
    const list = (ids || []).filter(Boolean);
    if (!list.length) {
      setReactionsByPost({});
      return;
    }
    try {
      const response = await fetchReactions(REACTION_TARGET_NEWS_UPDATE, list);
      setReactionsByPost(response?.data || {});
    } catch (reactionError) {
      logFailure("Failed to load newsfeed reactions:", reactionError);
    }
  }, []);

  useEffect(() => {
    const ids = postIdKey ? postIdKey.split(",") : [];
    void refreshReactions(ids);
    return subscribeToReactions(REACTION_TARGET_NEWS_UPDATE, () => {
      void refreshReactions(ids);
    });
  }, [postIdKey, refreshReactions]);

  const myReactionsByPost = useMemo(() => {
    const mine = {};
    for (const [postId, entries] of Object.entries(reactionsByPost)) {
      mine[postId] = entries
        .filter((entry) => String(entry.userId) === String(dbUserId))
        .map((entry) => entry.emoji);
    }
    return mine;
  }, [reactionsByPost, dbUserId]);

  const toggleReaction = useCallback(
    async (post, emoji) => {
      if (!dbUserId) return;
      const targetId = String(post.id);
      const reactorName = user?.username || "You";

      // Optimistic: apply the one-reaction-per-user rule locally, then let the
      // server response and the realtime event settle it.
      setReactionsByPost((previous) => {
        const current = previous[targetId] || [];
        const mine = current.find((entry) => String(entry.userId) === String(dbUserId));
        const withoutMine = current.filter(
          (entry) => String(entry.userId) !== String(dbUserId)
        );
        const next =
          mine && mine.emoji === emoji
            ? withoutMine
            : [...withoutMine, { userId: dbUserId, name: reactorName, emoji }];
        return { ...previous, [targetId]: next };
      });

      try {
        await saveReaction({
          targetType: REACTION_TARGET_NEWS_UPDATE,
          targetId,
          userId: dbUserId,
          emoji,
        });
      } catch (reactionError) {
        logFailure("Failed to save newsfeed reaction:", reactionError);
      } finally {
        void refreshReactions(postIdKey ? postIdKey.split(",") : []);
      }
    },
    [dbUserId, postIdKey, refreshReactions, user?.username]
  );

  // -------------------------------------------------------------------------
  // Post actions
  // -------------------------------------------------------------------------
  const patchPost = useCallback((postId, patch) => {
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, ...patch } : post))
    );
    setSearchResults((current) =>
      current
        ? current.map((post) => (post.id === postId ? { ...post, ...patch } : post))
        : current
    );
  }, []);

  const withBusy = useCallback(async (postId, action, run) => {
    setBusyActions((current) => ({ ...current, [postId]: action }));
    try {
      await run();
    } finally {
      setBusyActions((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
    }
  }, []);

  const acknowledge = useCallback(
    (post) =>
      withBusy(post.id, "acknowledge", async () => {
        patchPost(post.id, { isAcknowledged: true });
        try {
          await acknowledgePostRequest(post.id);
          pushAlert({ message: "Thanks — your acknowledgement is recorded.", type: "success" });
        } catch (ackError) {
          logFailure("Failed to acknowledge the update:", ackError);
          patchPost(post.id, { isAcknowledged: false });
          pushAlert({ message: "We could not record that acknowledgement.", type: "error" });
        }
      }),
    [patchPost, pushAlert, withBusy]
  );

  const removePost = useCallback(
    (post) =>
      withBusy(post.id, "delete", async () => {
        try {
          await deleteNewsPost(post.id);
          setPosts((current) => current.filter((item) => item.id !== post.id));
          pushAlert({ message: "Announcement deleted.", type: "success" });
        } catch (deleteError) {
          logFailure("Failed to delete the update:", deleteError);
          pushAlert({ message: "We could not delete that announcement.", type: "error" });
        }
      }),
    [pushAlert, withBusy]
  );

  // -------------------------------------------------------------------------
  // Search — server-side, so it can reach posts outside the loaded page.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchNews({
          term,
          categories: filters.categories,
          priorities: filters.priorities,
          departments: filters.departments,
        });
        if (!cancelled) setSearchResults(Array.isArray(results) ? results : []);
      } catch (searchError) {
        logFailure("Failed to search the news feed:", searchError);
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters, searchTerm]);

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------
  const source = searchResults ?? posts;

  const matchesFilters = useCallback(
    (post) => {
      if (filters.categories.length && !filters.categories.includes(post.category)) return false;
      if (filters.priorities.length && !filters.priorities.includes(post.priority)) return false;
      if (
        filters.departments.length &&
        !post.departments.some((department) => filters.departments.includes(department))
      ) {
        return false;
      }
      return true;
    },
    [filters]
  );

  const visiblePosts = useMemo(
    () => source.filter((post) => matchesFilters(post)),
    [matchesFilters, source]
  );

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.priorities.length > 0 ||
    filters.departments.length > 0 ||
    searchTerm.trim().length > 0;

  // -------------------------------------------------------------------------
  // Per-post permissions, resolved once here rather than in every card.
  // -------------------------------------------------------------------------
  const permissionsFor = useCallback(
    (post) => ({
      canEdit: canEditPost(post, { userRoles, userId: dbUserId }),
      canDelete: canDeletePost(post, { userRoles, userId: dbUserId }),
    }),
    [dbUserId, userRoles]
  );

  return {
    // data
    posts,
    visiblePosts,
    preferences,
    viewerMeta,
    reactionsByPost,
    myReactionsByPost,
    capabilities,
    currentUserId: dbUserId,
    loading,
    searching,
    error,
    isSearching: searchResults !== null,

    // view state
    filters,
    setFilters,
    hasActiveFilters,
    searchTerm,
    setSearchTerm,
    density,
    setDensity,

    // actions
    reload: load,
    acknowledge,
    removePost,
    toggleReaction,
    permissionsFor,
    busyActions,
    setPreferences,
  };
}
