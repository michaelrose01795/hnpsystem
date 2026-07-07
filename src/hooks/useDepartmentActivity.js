// file location: src/hooks/useDepartmentActivity.js
//
// Rolling shared-department activity feed (Phase 4.3). Holds the previous
// operational + presence snapshot and, each time a new one arrives (the Phase 2
// metrics poll / the Phase 4.1 presence poll), derives the movement between them
// (deriveActivityEvents) and prepends it to a capped, session-lived feed.
//
// Deliberately in-memory only: the feed is a live "what just happened" view, not
// a durable log (there is no activity table). Suppressed in the presentation
// shell. Reuses data already fetched — it adds no polling of its own.

import { useEffect, useMemo, useRef, useState } from "react";
import { deriveActivityEvents } from "@/config/topbar/departmentActivity";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

export function useDepartmentActivity({
  metrics = {},
  presenceById = null,
  enabled = true,
} = {}) {
  const [feed, setFeed] = useState([]);
  const prevRef = useRef(null);
  // A monotonic counter guarantees stable ordering even if two polls land in the
  // same millisecond; combined with the wall clock for display.
  const seqRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      prevRef.current = null;
      setFeed([]);
      return;
    }

    const snapshot = { metrics: metrics || {}, presenceById: presenceById || null };
    const prev = prevRef.current;
    prevRef.current = snapshot;
    if (!prev) return; // establish a baseline first — no events on first load

    const ts = Date.now();
    const events = deriveActivityEvents(prev, snapshot, { ts });
    if (events.length === 0) return;

    setFeed((current) => {
      // Stamp a session-unique sequence so keys never collide.
      const stamped = events.map((e) => ({ ...e, seq: seqRef.current++ }));
      return [...stamped.reverse(), ...current].slice(0, WORKSPACE_LIMITS.activityFeed);
    });
  }, [metrics, presenceById, enabled]);

  const items = useMemo(() => feed, [feed]);

  return {
    items,
    hasActivity: items.length > 0,
    clear: () => setFeed([]),
  };
}

export default useDepartmentActivity;
