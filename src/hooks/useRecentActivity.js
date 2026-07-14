// file location: src/hooks/useRecentActivity.js
//
// Global recent activity (Phase 3.2). Remembers recently viewed jobs, customers,
// reports, vehicles, workflows and searches as the user moves around the app, and
// exposes them (newest-first, and grouped by category) for the command palette
// and the productivity panel.
//
// Per-user, on-device, reactive across tabs (workspaceStorage). Disabled in the
// presentation shell so the demo never records or restores real routes.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import {
  buildKey,
  readJSON,
  removeKey,
  subscribe,
  pushRecent,
} from "@/lib/topbar/workspaceStorage";
import { classifyRoute, buildSearchItem, RECENT_CATEGORIES } from "@/lib/topbar/recentActivity";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

const FEATURE = "recent-activity";
const MAX_ITEMS = WORKSPACE_LIMITS.recentActivity;

function normalise(value) {
  return Array.isArray(value) ? value.filter((i) => i && i.category && i.id) : [];
}

export function useRecentActivity(currentAsPath, { enabled = true } = {}) {
  const { user, dbUserId } = useUser() || {};
  const userId = dbUserId || user?.id || user?.username || null;
  const key = buildKey(FEATURE, userId);

  const [items, setItems] = useState(() => (enabled ? normalise(readJSON(key, [])) : []));

  useEffect(() => {
    setItems(enabled ? normalise(readJSON(key, [])) : []);
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe(key, (value) => setItems(normalise(value)));
  }, [key, enabled]);

  // Record the current route if it is a viewable record/workflow. Dedupe by href
  // so revisiting an item just bumps it to the top.
  useEffect(() => {
    if (!enabled) return;
    const entry = classifyRoute(currentAsPath, Date.now());
    if (!entry) return;
    setItems(normalise(pushRecent(key, entry, { max: MAX_ITEMS, dedupeBy: "href" })));
  }, [currentAsPath, key, enabled]);

  const recordSearch = useCallback(
    (query) => {
      if (!enabled) return;
      const entry = buildSearchItem(query, Date.now());
      if (!entry) return;
      setItems(normalise(pushRecent(key, entry, { max: MAX_ITEMS, dedupeBy: "id" })));
    },
    [key, enabled]
  );

  const clear = useCallback(() => {
    removeKey(key);
    setItems([]);
  }, [key]);

  // Grouped by category, each newest-first, in the categories' display order.
  const byCategory = useMemo(() => {
    const groups = {};
    for (const item of items) {
      (groups[item.category] ||= []).push(item);
    }
    return Object.entries(groups)
      .map(([category, list]) => ({
        category,
        meta: RECENT_CATEGORIES[category] || { label: category, order: 99 },
        items: list,
      }))
      .sort((a, b) => (a.meta.order || 99) - (b.meta.order || 99));
  }, [items]);

  return { items, byCategory, recordSearch, clear };
}

export default useRecentActivity;
