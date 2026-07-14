// file location: src/hooks/useContinueContext.js
//
// Continue-Where-You-Left-Off (Phase 2.3). Records the user's resumable work as
// they navigate and exposes the most recent item that isn't the current page, so
// the top bar can offer a one-click "Resume" back into unfinished work (job
// cards, reports, searches, customers, parts orders — see continueContext.js).
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
import { resolveResumable, isSamePath } from "@/lib/topbar/continueContext";

const FEATURE = "continue";

export function useContinueContext(currentAsPath, { enabled = true } = {}) {
  const { user, dbUserId } = useUser() || {};
  const userId = dbUserId || user?.id || user?.username || null;
  const key = buildKey(FEATURE, userId);

  const [recent, setRecent] = useState(() => (enabled ? readJSON(key, []) : []));

  // Re-hydrate when the storage key (i.e. the signed-in user) changes.
  useEffect(() => {
    setRecent(enabled ? readJSON(key, []) : []);
  }, [key, enabled]);

  // Stay in sync with other hook instances / other tabs.
  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe(key, (value) => setRecent(Array.isArray(value) ? value : []));
  }, [key, enabled]);

  // Record the current route if it is a supported, resumable workflow.
  useEffect(() => {
    if (!enabled) return;
    const entry = resolveResumable(currentAsPath, Date.now());
    if (!entry) return;
    setRecent(pushRecent(key, entry, { max: 12 }));
  }, [currentAsPath, key, enabled]);

  // The resume target is the newest recorded item that isn't the current page.
  const mostRecent = useMemo(
    () => (recent || []).find((item) => !isSamePath(currentAsPath, item)) || null,
    [recent, currentAsPath]
  );

  const clear = useCallback(() => {
    removeKey(key);
    setRecent([]);
  }, [key]);

  return { recent, mostRecent, clear };
}

export default useContinueContext;
