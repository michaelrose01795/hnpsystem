// file location: src/hooks/useSelfAvailability.js
//
// The current user's self-declared availability (Phase 4.2). Lets a staff member
// broadcast their operational state — working, busy, on break, road test,
// training, workshop maintenance or other — beyond what the live job-clocking
// signal can infer. Per-user, on-device, reactive across tabs (workspaceStorage),
// disabled in the presentation shell. Mirrors useReminders / useFavourites.
//
// Honest scope (see rollout): there is no server-side user-status table in the
// app, so a self-declared state persists on THIS device for THIS user. It is
// authoritative for the user's own presence row; colleagues' rows are derived
// from the live clocking signal. When product wants cross-device broadcast, this
// hook is the single write-point to swap for a persisted endpoint — no consumer
// changes.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import { buildKey, readJSON, writeJSON, removeKey, subscribe } from "@/lib/topbar/workspaceStorage";
import {
  getAvailabilityState,
  availabilityFromLegacyStatus,
  DEFAULT_AVAILABILITY_ID,
} from "@/config/topbar/availabilityStates";

const FEATURE = "self-availability";

function normalise(stored) {
  if (!stored || typeof stored !== "object") return null;
  const id = typeof stored.id === "string" ? stored.id : null;
  if (!id || !getAvailabilityState(id)) return null;
  return { id, ts: typeof stored.ts === "number" ? stored.ts : 0 };
}

export function useSelfAvailability({ enabled = true } = {}) {
  const { user, dbUserId, status } = useUser() || {};
  const userId = dbUserId || user?.id || user?.username || null;
  const key = buildKey(FEATURE, userId);

  const [declared, setDeclared] = useState(() =>
    enabled ? normalise(readJSON(key, null)) : null
  );

  useEffect(() => {
    setDeclared(enabled ? normalise(readJSON(key, null)) : null);
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe(key, (value) => setDeclared(normalise(value)));
  }, [key, enabled]);

  const setAvailability = useCallback(
    (id) => {
      if (!enabled) return;
      const state = getAvailabilityState(id);
      if (!state) return;
      const entry = { id, ts: Date.now() };
      setDeclared(entry);
      writeJSON(key, entry);
    },
    [key, enabled]
  );

  const clear = useCallback(() => {
    if (!enabled) return;
    setDeclared(null);
    removeKey(key);
  }, [key, enabled]);

  // The effective availability id used for the user's presence row:
  //  1. an explicit self-declaration (wins — the user is telling everyone), else
  //  2. a mapping of the app's existing technician status (In Progress / Tea
  //     Break / Waiting for Job) so the two stay consistent, else
  //  3. null → the presence builder falls back to the live clocking signal.
  const effectiveId = useMemo(() => {
    if (declared?.id) return declared.id;
    const fromStatus = availabilityFromLegacyStatus(status);
    return fromStatus || null;
  }, [declared, status]);

  return {
    declaredId: declared?.id || null,
    effectiveId,
    // A concrete descriptor for display (never null) — declared/derived/default.
    state: getAvailabilityState(effectiveId) || getAvailabilityState(DEFAULT_AVAILABILITY_ID),
    setAvailability,
    clear,
    isDeclared: Boolean(declared?.id),
  };
}

export default useSelfAvailability;
