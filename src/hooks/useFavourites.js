// file location: src/hooks/useFavourites.js
//
// Cross-department favourites (Phase 3.3). Lets a user permanently favourite any
// page, record or report so it's always reachable from the command palette and
// the productivity panel, no matter which department view they're in.
//
// Per-user, on-device, reactive across tabs (workspaceStorage). Disabled in the
// presentation shell. Complements — does not replace — pinned bar shortcuts.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import {
  buildKey,
  readJSON,
  writeJSON,
  removeKey,
  subscribe,
} from "@/lib/topbar/workspaceStorage";
import { normaliseFavourite, isSameFavourite } from "@/lib/topbar/favourites";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

const FEATURE = "favourites";
const MAX = WORKSPACE_LIMITS.favourites; // generous — favourites are a library, not a bar strip

function normaliseList(value) {
  return Array.isArray(value) ? value.filter((f) => f && f.href) : [];
}

export function useFavourites({ enabled = true } = {}) {
  const { user, dbUserId } = useUser() || {};
  const userId = dbUserId || user?.id || user?.username || null;
  const key = buildKey(FEATURE, userId);

  const [favourites, setFavourites] = useState(() =>
    enabled ? normaliseList(readJSON(key, [])) : []
  );

  useEffect(() => {
    setFavourites(enabled ? normaliseList(readJSON(key, [])) : []);
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe(key, (value) => setFavourites(normaliseList(value)));
  }, [key, enabled]);

  const isFavourite = useCallback(
    (href) => favourites.some((f) => isSameFavourite(f, href)),
    [favourites]
  );

  const persist = useCallback(
    (next) => {
      setFavourites(next);
      writeJSON(key, next);
    },
    [key]
  );

  // Add or move-to-front a favourite (idempotent on href).
  const addFavourite = useCallback(
    (item) => {
      if (!enabled) return;
      const fav = normaliseFavourite(item, Date.now());
      if (!fav) return;
      const rest = favourites.filter((f) => !isSameFavourite(f, fav));
      persist([fav, ...rest].slice(0, MAX));
    },
    [favourites, enabled, persist]
  );

  const removeFavourite = useCallback(
    (href) => {
      if (!enabled) return;
      persist(favourites.filter((f) => !isSameFavourite(f, href)));
    },
    [favourites, enabled, persist]
  );

  // Toggle by item (needs the label/href to add). Returns the new state.
  const toggleFavourite = useCallback(
    (item) => {
      if (!enabled || !item?.href) return false;
      if (favourites.some((f) => isSameFavourite(f, item.href))) {
        removeFavourite(item.href);
        return false;
      }
      addFavourite(item);
      return true;
    },
    [favourites, enabled, addFavourite, removeFavourite]
  );

  const clear = useCallback(() => {
    removeKey(key);
    setFavourites([]);
  }, [key]);

  const byKind = useMemo(() => {
    const groups = {};
    for (const fav of favourites) (groups[fav.kind] ||= []).push(fav);
    return groups;
  }, [favourites]);

  return {
    favourites,
    byKind,
    isFavourite,
    addFavourite,
    removeFavourite,
    toggleFavourite,
    clear,
    canFavourite: enabled,
  };
}

export default useFavourites;
