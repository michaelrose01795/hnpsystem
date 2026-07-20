// file location: src/lib/database/newsUpdates.js
// Browser-facing data access for the staff news feed. Keeping the Supabase
// reads, writes and realtime subscription here prevents page components from
// owning database operations.

import { supabase } from "@/lib/database/supabaseClient";

const NEWS_UPDATES_TABLE = "news_updates";
const NEWS_UPDATE_COLUMNS = "id, title, content, departments, author, created_at";
const NEWS_UPDATES_CACHE_KEY = "hnp-news-feed-v1";
let pendingNewsUpdatesRequest = null;

export function readCachedNewsUpdates() {
  if (typeof window === "undefined") return null;
  try {
    const cached = window.sessionStorage.getItem(NEWS_UPDATES_CACHE_KEY);
    const parsed = cached ? JSON.parse(cached) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function cacheNewsUpdates(rows) {
  if (typeof window === "undefined" || !Array.isArray(rows)) return;
  try {
    window.sessionStorage.setItem(NEWS_UPDATES_CACHE_KEY, JSON.stringify(rows));
  } catch {
    // Storage can be unavailable in private/locked-down browser contexts.
  }
}

export async function getNewsUpdates({ limit = 200 } = {}) {
  if (!pendingNewsUpdatesRequest) {
    pendingNewsUpdatesRequest = (async () => {
      const { data, error } = await supabase
        .from(NEWS_UPDATES_TABLE)
        .select(NEWS_UPDATE_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to load news updates: ${error.message}`);
      }

      return Array.isArray(data) ? data : [];
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

export async function createNewsUpdate(payload) {
  const { error } = await supabase.from(NEWS_UPDATES_TABLE).insert([payload]);
  if (error) {
    throw new Error(`Failed to create news update: ${error.message}`);
  }
}

export async function warmNewsUpdatesCache() {
  const rows = await getNewsUpdates();
  cacheNewsUpdates(rows);
  return rows;
}

export function subscribeToNewsUpdates(onChange) {
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
