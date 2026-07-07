// file location: src/hooks/useTeamPresence.js
//
// Live team presence for the collaborative top-bar workspace (Phase 4.1). Merges
// three sources into per-department presence groups:
//   1. the already-loaded staff roster (RosterContext — free client data),
//   2. the live "who's on a job" signal (/api/status/team-presence, polled), and
//   3. the current user's self-declared availability (useSelfAvailability, 4.2).
//
// Cheap and defensive, exactly like useOperationalSnapshot: polls infrequently,
// refreshes on window focus, aborts in-flight requests, degrades to roster-only
// (everyone "available") on any error, and is fully suppressed in the demo shell.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRoster } from "@/context/RosterContext";
import { useUser } from "@/context/UserContext";
import { buildTeamPresence, focusDepartment } from "@/config/topbar/teamPresence";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

const EMPTY_WORKING = [];

export function useTeamPresence({
  department = null,
  selfAvailabilityId = null,
  isPresentation = false,
  enabled = true,
} = {}) {
  const { allUsers } = useRoster() || {};
  const { dbUserId, user } = useUser() || {};
  const selfId = dbUserId ?? user?.id ?? null;

  const [working, setWorking] = useState(EMPTY_WORKING);
  const [updatedAt, setUpdatedAt] = useState(null);
  const abortRef = useRef(null);

  const shouldFetch = enabled && !isPresentation;
  const pollMs = WORKSPACE_LIMITS.presencePollMs;

  useEffect(() => {
    if (!shouldFetch) {
      setWorking(EMPTY_WORKING);
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/status/team-presence", {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled || !data?.success) return;
        setWorking(Array.isArray(data.working) ? data.working : EMPTY_WORKING);
        setUpdatedAt(data.updatedAt || Date.now());
      } catch (err) {
        if (err?.name === "AbortError" || cancelled) return;
        setWorking(EMPTY_WORKING); // degrade to roster-only "available"
      }
    };

    load();
    const onFocus = () => load();
    const interval = setInterval(load, pollMs);
    if (typeof window !== "undefined") window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (abortRef.current) abortRef.current.abort();
      clearInterval(interval);
      if (typeof window !== "undefined") window.removeEventListener("focus", onFocus);
    };
  }, [shouldFetch, pollMs]);

  const presence = useMemo(
    () =>
      buildTeamPresence({
        users: allUsers,
        working,
        selfId,
        selfAvailabilityId,
        isPresentation,
      }),
    [allUsers, working, selfId, selfAvailabilityId, isPresentation]
  );

  // The viewer's own department group, surfaced first in the panel.
  const myDepartment = useMemo(
    () => focusDepartment(presence, department),
    [presence, department]
  );

  return {
    departments: presence.departments,
    myDepartment,
    self: presence.self,
    byId: presence.byId,
    totals: presence.totals,
    updatedAt,
  };
}

export default useTeamPresence;
