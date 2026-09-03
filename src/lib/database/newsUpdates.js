// file location: src/lib/database/newsUpdates.js
//
// Browser-facing data access for the staff news feed.
//
// Since the feed became the dealership communication hub, the READ path is the
// role-guarded API (/api/news) rather than a direct Supabase select: audience
// filtering, scheduling, expiry and the per-viewer read / acknowledged / saved
// state all have to be resolved server-side, and a post targeted at one
// department must never be sent to a browser that should not see it.
//
// What stays here is the login hand-off cache. src/pages/login.js warms it
// while the shell is still painting, so the feed can render its first frame
// without a second round trip. The exported names are unchanged so that
// hand-off keeps working exactly as before.

import { fetchFeed, createNewsPost } from "@/lib/api/news";
import { supabase } from "@/lib/database/supabaseClient";

const NEWS_UPDATES_TABLE = "news_updates";
const NEWS_UPDATES_CACHE_KEY = "hnp-news-feed-v2";
let pendingNewsUpdatesRequest = null;
let warmedNewsUpdatesCache = null;

// Memory-only cache used during the client-side login hand-off. Unlike
// sessionStorage, this is empty on a hard-load hydration pass, so it can seed
// the newsfeed without creating server/client markup differences.
export function peekWarmedNewsUpdatesCache() {
  return warmedNewsUpdatesCache;
}

export function readCachedNewsUpdates() {
  if (typeof window === "undefined") return null;
  try {
    const cached = window.sessionStorage.getItem(NEWS_UPDATES_CACHE_KEY);
    const parsed = cached ? JSON.parse(cached) : null;
    return parsed && Array.isArray(parsed.posts) ? parsed : null;
  } catch {
    return null;
  }
}

export function cacheNewsUpdates(payload) {
  if (!payload || !Array.isArray(payload.posts)) return;
  warmedNewsUpdatesCache = payload;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(NEWS_UPDATES_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable in private/locked-down browser contexts.
  }
}

/**
 * The signed-in viewer's feed, as { posts, preferences, viewer }.
 * Concurrent callers share one in-flight request, exactly as before.
 */
export async function getNewsUpdates({ limit = 200, includeArchived = false } = {}) {
  if (!pendingNewsUpdatesRequest) {
    pendingNewsUpdatesRequest = (async () => {
      const data = await fetchFeed({ limit, includeArchived });
      return {
        posts: Array.isArray(data?.posts) ? data.posts : [],
        preferences: data?.preferences || null,
        viewer: data?.viewer || null,
      };
    })();
  }

  const request = pendingNewsUpdatesRequest;
  try {
    return await request;
  } finally {
    if (pendingNewsUpdatesRequest === request) {
      pendingNewsUpdatesRequest = null;
    }
  }
}

/**
 * Publish an update. Kept as a named export because it is the long-standing
 * entry point; the hub's richer fields (priority, scheduling, links…) go
 * straight through to the same API.
 */
export async function createNewsUpdate(payload) {
  return createNewsPost(payload);
}

export async function warmNewsUpdatesCache() {
  const payload = await getNewsUpdates();
  cacheNewsUpdates(payload);
  return payload;
}

/**
 * Realtime: anyone publishing, editing, pinning or expiring a post is a write
 * to public.news_updates, which lands here so every open feed re-reads.
 */
export function subscribeToNewsUpdates(onChange) {
  if (typeof window === "undefined") return () => {};

  const channel = supabase
    .channel("news-feed-updates")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: NEWS_UPDATES_TABLE },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
